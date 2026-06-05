import type { CardSchedule, ReviewGrade } from "@/lib/srs/scheduler";

/** Card template kinds — one Chinese note spawns several of these. See ARCHITECTURE.md §5.1. */
export type CardTemplate = "recognition" | "production" | "tone" | "writing";

/** Sync bookkeeping shared by all mutable, last-write-wins entities. */
export interface SyncMeta {
  updatedAt: string;
  /** Soft-delete tombstone (ISO) so deletions propagate during sync. */
  deletedAt?: string;
}

export interface Deck extends SyncMeta {
  id: string;
  name: string;
  /** Per-deck FSRS overrides; falls back to user/global defaults. */
  desiredRetention?: number;
  parameters?: number[];
  createdAt: string;
}

/** The content of a Chinese item. Cards are generated from a note. */
export interface Note extends SyncMeta {
  id: string;
  deckId: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  audioUrl?: string;
  tags: string[];
  createdAt: string;
}

export interface Card extends SyncMeta {
  id: string;
  noteId: string;
  deckId: string;
  template: CardTemplate;
  schedule: CardSchedule;
  /**
   * Denormalized mirror of `schedule.due` (ISO). Dexie can't index nested
   * paths, so we keep this flat copy in sync to query "what's due" efficiently.
   */
  due: string;
}

/** Immutable, append-only review event. Never edited or deleted. See §5.2. */
export interface ReviewLog {
  id: string;
  cardId: string;
  deckId: string;
  deviceId: string;
  grade: ReviewGrade;
  /** When the review happened (ISO). */
  reviewedAt: string;
  durationMs: number;
  /** Snapshot of schedule state immediately before this review (for replay/debug). */
  prevSchedule: CardSchedule;
}

/** A queued local mutation awaiting push to the server. See §5.4. */
export interface OutboxItem {
  /** Client-generated ULID; used for idempotent server-side dedupe. */
  id: string;
  entity: "deck" | "note" | "card" | "review";
  op: "upsert" | "delete";
  payload: unknown;
  queuedAt: string;
}
