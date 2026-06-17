import { db, getDeviceId, newId } from "@/lib/db/dexie";
import {
  newCardSchedule,
  schedule as scheduleNext,
  type ReviewGrade,
  type SchedulerOptions,
} from "@learn-chinese/shared";
import type {
  Card,
  CardTemplate,
  Deck,
  Note,
  OutboxItem,
} from "@learn-chinese/shared";

/**
 * All local writes funnel through here so that (a) the outbox is kept in sync
 * for the sync engine, and (b) the denormalized `Card.due` mirror stays
 * consistent with `Card.schedule.due`. See ARCHITECTURE.md §5.
 */

function queue(item: Omit<OutboxItem, "id" | "queuedAt">): OutboxItem {
  return { ...item, id: newId(), queuedAt: new Date().toISOString() };
}

export async function createDeck(name: string): Promise<Deck> {
  const now = new Date().toISOString();
  const deck: Deck = { id: newId(), name, createdAt: now, updatedAt: now };
  await db.transaction("rw", db.decks, db.outbox, async () => {
    await db.decks.put(deck);
    await db.outbox.add(queue({ entity: "deck", op: "upsert", payload: deck }));
  });
  return deck;
}

const TEMPLATES: CardTemplate[] = [
  "recognition",
  "production",
  "tone",
  "writing",
];

/** Create a note and its generated cards (one per template) in a single tx. */
export async function createNote(
  input: Omit<Note, "id" | "createdAt" | "updatedAt" | "tags"> & {
    tags?: string[];
  },
  templates: CardTemplate[] = TEMPLATES,
): Promise<{ note: Note; cards: Card[] }> {
  const now = new Date().toISOString();
  const note: Note = {
    ...input,
    tags: input.tags ?? [],
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
  const cards: Card[] = templates.map((template) => {
    const sched = newCardSchedule(new Date(now));
    return {
      id: newId(),
      noteId: note.id,
      deckId: note.deckId,
      template,
      schedule: sched,
      due: sched.due,
      updatedAt: now,
    };
  });

  await db.transaction("rw", db.notes, db.cards, db.outbox, async () => {
    await db.notes.put(note);
    await db.cards.bulkPut(cards);
    await db.outbox.bulkAdd([
      queue({ entity: "note", op: "upsert", payload: note }),
      ...cards.map((c) => queue({ entity: "card", op: "upsert", payload: c })),
    ]);
  });

  return { note, cards };
}

/** Cards due for review in a deck, soonest first. */
export async function getDueCards(
  deckId: string,
  now: Date = new Date(),
): Promise<Card[]> {
  const iso = now.toISOString();
  return db.cards
    .where("deckId")
    .equals(deckId)
    .filter((c) => !c.deletedAt && c.due <= iso)
    .sortBy("due");
}

/**
 * Grade a card: compute the next schedule (pure), append an immutable review
 * event, update the card, and enqueue both for sync — all atomically.
 */
export async function gradeCard(
  card: Card,
  grade: ReviewGrade,
  durationMs: number,
  opts: SchedulerOptions = {},
  now: Date = new Date(),
): Promise<Card> {
  const { schedule: next } = scheduleNext(card.schedule, grade, now, opts);
  const updated: Card = {
    ...card,
    schedule: next,
    due: next.due,
    updatedAt: now.toISOString(),
  };
  const review = {
    id: newId(),
    cardId: card.id,
    deckId: card.deckId,
    deviceId: getDeviceId(),
    grade,
    reviewedAt: now.toISOString(),
    durationMs,
    prevSchedule: card.schedule,
  };

  await db.transaction("rw", db.cards, db.reviews, db.outbox, async () => {
    await db.cards.put(updated);
    await db.reviews.add(review);
    await db.outbox.bulkAdd([
      queue({ entity: "card", op: "upsert", payload: updated }),
      queue({ entity: "review", op: "upsert", payload: review }),
    ]);
  });

  return updated;
}
