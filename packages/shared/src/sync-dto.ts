import { z } from "zod";

/**
 * Wire format for the sync protocol (ARCHITECTURE.md §5.4), shared by the web
 * client and the server so both validate against one source of truth.
 *
 * Sync model:
 * - Reviews are immutable events → conflict-free set union by id.
 * - Decks/notes/cards are mutable docs → last-write-wins by `updatedAt`.
 * - The server assigns each applied change a monotonic `seq`; the client keeps
 *   the highest `seq` it has seen as its `cursor` and asks for everything after.
 */

export const SYNC_ENTITIES = ["deck", "note", "card", "review"] as const;
export const zSyncEntity = z.enum(SYNC_ENTITIES);
export type SyncEntity = z.infer<typeof zSyncEntity>;

export const zSyncMeta = z.object({
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
});

export const zCardSchedule = z.object({
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number(),
  scheduledDays: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.number().int(),
  learningSteps: z.number().int(),
  lastReview: z.string().optional(),
});

export const zDeck = zSyncMeta.extend({
  id: z.string(),
  name: z.string(),
  desiredRetention: z.number().optional(),
  parameters: z.array(z.number()).optional(),
  createdAt: z.string(),
});

export const zNote = zSyncMeta.extend({
  id: z.string(),
  deckId: z.string(),
  hanzi: z.string(),
  pinyin: z.string(),
  meaning: z.string(),
  audioUrl: z.string().optional(),
  tags: z.array(z.string()),
  createdAt: z.string(),
});

export const zCard = zSyncMeta.extend({
  id: z.string(),
  noteId: z.string(),
  deckId: z.string(),
  template: z.enum(["recognition", "production", "tone", "writing"]),
  schedule: zCardSchedule,
  due: z.string(),
});

export const zReviewLog = z.object({
  id: z.string(),
  cardId: z.string(),
  deckId: z.string(),
  deviceId: z.string(),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  reviewedAt: z.string(),
  durationMs: z.number(),
  prevSchedule: zCardSchedule,
});

/** Zod payload schema for a given entity, used to validate incoming mutations. */
export const ENTITY_SCHEMA = {
  deck: zDeck,
  note: zNote,
  card: zCard,
  review: zReviewLog,
} as const;

export const zSyncMutation = z.object({
  /** Client-generated ULID; the idempotency key for server-side dedupe. */
  id: z.string(),
  entity: zSyncEntity,
  op: z.enum(["upsert", "delete"]),
  payload: z.unknown(),
});
export type SyncMutation = z.infer<typeof zSyncMutation>;

export const zSyncRequest = z.object({
  deviceId: z.string(),
  /** Highest server `seq` this client has already applied (0 = full sync). */
  cursor: z.number().int().nonnegative(),
  mutations: z.array(zSyncMutation),
});
export type SyncRequest = z.infer<typeof zSyncRequest>;

export const zServerChange = z.object({
  seq: z.number().int(),
  entity: zSyncEntity,
  op: z.enum(["upsert", "delete"]),
  payload: z.unknown(),
});
export type ServerChange = z.infer<typeof zServerChange>;

export const zSyncResponse = z.object({
  /** Changes from the server with `seq` greater than the request cursor. */
  changes: z.array(zServerChange),
  /** New cursor: the highest `seq` now known to the client. */
  cursor: z.number().int(),
  /** Mutation ids the server accepted, so the client can clear its outbox. */
  applied: z.array(z.string()),
});
export type SyncResponse = z.infer<typeof zSyncResponse>;
