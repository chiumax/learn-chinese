import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** The transaction handle passed to `db.transaction(tx => …)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Idempotent schema bootstrap. SQLite is simple enough that we create tables
 * directly rather than running a migration toolchain; drizzle-kit can generate
 * versioned migrations later (`pnpm db:generate`) without changing call sites.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
  desired_retention REAL, parameters TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, deck_id TEXT NOT NULL,
  hanzi TEXT NOT NULL, pinyin TEXT NOT NULL, meaning TEXT NOT NULL,
  audio_url TEXT, tags TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, note_id TEXT NOT NULL,
  deck_id TEXT NOT NULL, template TEXT NOT NULL, schedule TEXT NOT NULL,
  due TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, card_id TEXT NOT NULL,
  deck_id TEXT NOT NULL, device_id TEXT NOT NULL, grade INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL, duration_ms INTEGER NOT NULL, prev_schedule TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
  entity TEXT NOT NULL, op TEXT NOT NULL, entity_id TEXT NOT NULL,
  payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS processed_mutations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_changes_user_seq ON changes (user_id, seq);
CREATE INDEX IF NOT EXISTS idx_reviews_card ON reviews (card_id, reviewed_at);
`;

/** Open a database (file path or ":memory:") and ensure the schema exists. */
export function createDb(path: string): { db: Db; sqlite: Database.Database } {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export { schema };
