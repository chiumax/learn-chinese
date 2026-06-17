import Dexie, { type EntityTable } from "dexie";
import { ulid } from "ulid";
import type {
  Card,
  Deck,
  Note,
  OutboxItem,
  ReviewLog,
} from "@learn-chinese/shared";

/**
 * Local-first source of truth (IndexedDB). All reads/writes during normal use
 * go here; the sync engine reconciles with the server. See ARCHITECTURE.md §5.
 */
class LearnChineseDB extends Dexie {
  decks!: EntityTable<Deck, "id">;
  notes!: EntityTable<Note, "id">;
  cards!: EntityTable<Card, "id">;
  reviews!: EntityTable<ReviewLog, "id">;
  outbox!: EntityTable<OutboxItem, "id">;

  constructor() {
    super("learn-chinese");
    this.version(1).stores({
      // Indexes only — the full object is stored regardless.
      decks: "id, updatedAt, deletedAt",
      notes: "id, deckId, updatedAt, deletedAt",
      // `[deckId+schedule.due]` would be ideal but Dexie can't index nested
      // paths; we keep a flat `due` mirror updated alongside the schedule.
      cards: "id, deckId, noteId, due, updatedAt, deletedAt",
      reviews: "id, cardId, deckId, reviewedAt",
      outbox: "id, queuedAt, entity",
    });
  }
}

export const db = new LearnChineseDB();

/** Client-side ID generation so offline creates never need a server round-trip. */
export const newId = ulid;

/**
 * Local device identifier, stable per browser. Used to key review events so
 * the same review from two devices never collides during sync.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const KEY = "lc.deviceId";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = ulid();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
