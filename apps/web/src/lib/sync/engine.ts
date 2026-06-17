import type {
  Card,
  Deck,
  Note,
  ReviewLog,
  ServerChange,
  SyncMutation,
  SyncResponse,
} from "@learn-chinese/shared";
import { db, getDeviceId } from "@/lib/db/dexie";
import { env } from "@/lib/env";

/**
 * Client sync engine (ARCHITECTURE.md §5.4). Drains the local outbox to the
 * server, applies the server's changes back into Dexie, and advances the
 * cursor. Writes from here bypass the repository's outbox so applied server
 * changes are not re-queued.
 */

const CURSOR_KEY = "lc.syncCursor";

function getCursor(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(CURSOR_KEY) ?? 0);
}

function setCursor(value: number): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CURSOR_KEY, String(value));
  }
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  cursor: number;
}

/** Apply one server change into the local Dexie store (idempotent upsert). */
async function applyChange(change: ServerChange): Promise<void> {
  if (change.op === "delete") {
    const id = (change.payload as { id: string }).id;
    const table = {
      deck: db.decks,
      note: db.notes,
      card: db.cards,
      review: db.reviews,
    }[change.entity];
    await table.delete(id);
    return;
  }
  switch (change.entity) {
    case "deck":
      await db.decks.put(change.payload as Deck);
      return;
    case "note":
      await db.notes.put(change.payload as Note);
      return;
    case "card":
      await db.cards.put(change.payload as Card);
      return;
    case "review":
      await db.reviews.put(change.payload as ReviewLog);
      return;
  }
}

/**
 * Run one push/pull sync cycle. Resolves with counts; on network failure it
 * throws, and callers treat that as "offline, try later".
 */
export async function syncOnce(): Promise<SyncResult> {
  const outbox = await db.outbox.orderBy("queuedAt").toArray();
  const mutations: SyncMutation[] = outbox.map((o) => ({
    id: o.id,
    entity: o.entity,
    op: o.op,
    payload: o.payload,
  }));

  const res = await fetch(`${env.NEXT_PUBLIC_SYNC_URL}/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      cursor: getCursor(),
      mutations,
    }),
  });
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);

  const data = (await res.json()) as SyncResponse;

  await db.transaction(
    "rw",
    db.decks,
    db.notes,
    db.cards,
    db.reviews,
    async () => {
      for (const change of data.changes) {
        await applyChange(change);
      }
    },
  );

  // Clear acked mutations from the outbox and advance the cursor.
  if (data.applied.length > 0) await db.outbox.bulkDelete(data.applied);
  setCursor(data.cursor);

  return {
    pushed: data.applied.length,
    pulled: data.changes.length,
    cursor: data.cursor,
  };
}
