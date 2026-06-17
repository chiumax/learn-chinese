import type {
  CardSchedule,
  CardTemplate,
  ReviewGrade,
} from "@learn-chinese/shared";
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Server-side mirror of the client entities (ARCHITECTURE.md §5.1), scoped by
 * `userId`. JSON-shaped fields are stored as text with a typed accessor.
 *
 * Auth is not built yet, so a single `LOCAL_USER` owns everything for now; the
 * schema is already multi-user so adding real auth is just populating userId.
 */

export const decks = sqliteTable("decks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  desiredRetention: real("desired_retention"),
  parameters: text("parameters", { mode: "json" }).$type<number[]>(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  deckId: text("deck_id").notNull(),
  hanzi: text("hanzi").notNull(),
  pinyin: text("pinyin").notNull(),
  meaning: text("meaning").notNull(),
  audioUrl: text("audio_url"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  noteId: text("note_id").notNull(),
  deckId: text("deck_id").notNull(),
  template: text("template").$type<CardTemplate>().notNull(),
  schedule: text("schedule", { mode: "json" }).$type<CardSchedule>().notNull(),
  due: text("due").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  cardId: text("card_id").notNull(),
  deckId: text("deck_id").notNull(),
  deviceId: text("device_id").notNull(),
  grade: integer("grade").$type<ReviewGrade>().notNull(),
  reviewedAt: text("reviewed_at").notNull(),
  durationMs: integer("duration_ms").notNull(),
  prevSchedule: text("prev_schedule", { mode: "json" })
    .$type<CardSchedule>()
    .notNull(),
});

/**
 * Append-only change log. Each applied mutation gets a monotonic `seq`
 * (autoincrement); clients pull everything with `seq` greater than their cursor.
 */
export const changes = sqliteTable("changes", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  entity: text("entity").notNull(),
  op: text("op").notNull(),
  entityId: text("entity_id").notNull(),
  payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/** Idempotency ledger: a client mutation id is applied at most once. */
export const processedMutations = sqliteTable("processed_mutations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
