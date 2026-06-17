import {
  ENTITY_SCHEMA,
  newCardSchedule,
  replay,
  type Card,
  type Deck,
  type Note,
  type ReviewEvent,
  type ReviewLog,
  type ServerChange,
  type SyncMutation,
  type SyncRequest,
  type SyncResponse,
} from "@learn-chinese/shared";
import { and, asc, eq, gt } from "drizzle-orm";
import type { Db, Tx } from "../db/client";
import {
  cards,
  changes,
  decks,
  notes,
  processedMutations,
  reviews,
} from "../db/schema";

export const LOCAL_USER = "local-user";

/** Validate a mutation's payload against its entity schema; throws on mismatch. */
function parsePayload(m: SyncMutation) {
  return ENTITY_SCHEMA[m.entity].parse(m.payload);
}

/**
 * Apply a client's outbox and return everything that changed after its cursor.
 * Runs in a single transaction so a partial failure rolls back cleanly.
 */
export function processSync(
  db: Db,
  userId: string,
  request: SyncRequest,
): SyncResponse {
  const applied: string[] = [];

  db.transaction((tx) => {
    const touchedCards = new Set<string>();

    for (const m of request.mutations) {
      // Idempotency: a mutation id is honored at most once, but always acked
      // so the client can clear it from its outbox.
      const seen = tx
        .select({ id: processedMutations.id })
        .from(processedMutations)
        .where(eq(processedMutations.id, m.id))
        .get();
      applied.push(m.id);
      if (seen) continue;

      applyMutation(tx, userId, m, touchedCards);
      tx.insert(processedMutations).values({ id: m.id, userId }).run();
    }

    // Conflict resolution: a card's canonical schedule is *derived* by replaying
    // its full review log, not trusted from any single device. See §5.3.
    for (const cardId of touchedCards) {
      recomputeCard(tx, userId, cardId);
    }
  });

  const rows = db
    .select()
    .from(changes)
    .where(and(eq(changes.userId, userId), gt(changes.seq, request.cursor)))
    .orderBy(asc(changes.seq))
    .all();

  const serverChanges: ServerChange[] = rows.map((r) => ({
    seq: r.seq,
    entity: r.entity as ServerChange["entity"],
    op: r.op as ServerChange["op"],
    payload: r.payload,
  }));
  const cursor =
    serverChanges.length > 0
      ? serverChanges[serverChanges.length - 1].seq
      : request.cursor;

  return { changes: serverChanges, cursor, applied };
}

function recordChange(
  tx: Tx,
  userId: string,
  entity: ServerChange["entity"],
  op: ServerChange["op"],
  entityId: string,
  payload: unknown,
) {
  tx.insert(changes)
    .values({
      userId,
      entity,
      op,
      entityId,
      payload,
      createdAt: new Date().toISOString(),
    })
    .run();
}

/** True when `incoming` should overwrite `existing` under last-write-wins. */
function isNewer(incoming: string, existing: string | undefined): boolean {
  return existing === undefined || incoming >= existing;
}

function applyMutation(
  tx: Tx,
  userId: string,
  m: SyncMutation,
  touchedCards: Set<string>,
) {
  const payload = parsePayload(m);

  switch (m.entity) {
    case "deck": {
      const d = payload as Deck;
      const existing = tx
        .select({ updatedAt: decks.updatedAt })
        .from(decks)
        .where(eq(decks.id, d.id))
        .get();
      if (!isNewer(d.updatedAt, existing?.updatedAt)) return;
      tx.insert(decks)
        .values({ ...d, userId })
        .onConflictDoUpdate({
          target: decks.id,
          set: { ...d, userId },
        })
        .run();
      recordChange(tx, userId, "deck", "upsert", d.id, d);
      return;
    }
    case "note": {
      const n = payload as Note;
      const existing = tx
        .select({ updatedAt: notes.updatedAt })
        .from(notes)
        .where(eq(notes.id, n.id))
        .get();
      if (!isNewer(n.updatedAt, existing?.updatedAt)) return;
      tx.insert(notes)
        .values({ ...n, userId })
        .onConflictDoUpdate({ target: notes.id, set: { ...n, userId } })
        .run();
      recordChange(tx, userId, "note", "upsert", n.id, n);
      return;
    }
    case "card": {
      const c = payload as Card;
      const existing = tx
        .select({ updatedAt: cards.updatedAt })
        .from(cards)
        .where(eq(cards.id, c.id))
        .get();
      if (!isNewer(c.updatedAt, existing?.updatedAt)) return;
      tx.insert(cards)
        .values({ ...c, userId })
        .onConflictDoUpdate({ target: cards.id, set: { ...c, userId } })
        .run();
      recordChange(tx, userId, "card", "upsert", c.id, c);
      return;
    }
    case "review": {
      const r = payload as ReviewLog;
      // Reviews are immutable, conflict-free: insert once, ignore re-sends.
      const res = tx
        .insert(reviews)
        .values({ ...r, userId })
        .onConflictDoNothing({ target: reviews.id })
        .run();
      if (res.changes > 0) {
        recordChange(tx, userId, "review", "upsert", r.id, r);
        touchedCards.add(r.cardId);
      }
      return;
    }
  }
}

function recomputeCard(tx: Tx, userId: string, cardId: string) {
  const card = tx
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)))
    .get();
  if (!card) return; // card mutation not yet applied; nothing to recompute

  const cardReviews = tx
    .select()
    .from(reviews)
    .where(and(eq(reviews.cardId, cardId), eq(reviews.userId, userId)))
    .orderBy(asc(reviews.reviewedAt))
    .all();
  if (cardReviews.length === 0) return;

  const deck = tx
    .select({
      desiredRetention: decks.desiredRetention,
      parameters: decks.parameters,
    })
    .from(decks)
    .where(eq(decks.id, card.deckId))
    .get();

  const events: ReviewEvent[] = cardReviews.map((r) => ({
    grade: r.grade,
    review: r.reviewedAt,
  }));
  const schedule = replay(
    events,
    {
      desiredRetention: deck?.desiredRetention ?? undefined,
      parameters: deck?.parameters ?? undefined,
    },
    newCardSchedule(new Date(events[0].review)),
  );

  const updatedAt = new Date().toISOString();
  const next = { ...card, schedule, due: schedule.due, updatedAt };
  tx.update(cards).set(next).where(eq(cards.id, cardId)).run();
  recordChange(tx, userId, "card", "upsert", cardId, {
    id: card.id,
    noteId: card.noteId,
    deckId: card.deckId,
    template: card.template,
    schedule,
    due: schedule.due,
    updatedAt,
    deletedAt: card.deletedAt ?? undefined,
  });
}
