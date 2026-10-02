import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db/client";

const PORT = Number(process.env.PORT ?? 4000);
const DB_PATH = process.env.DB_PATH ?? "data/app.db";
const SYNC_SECRET = process.env.INTERNAL_SYNC_SECRET;

if (!SYNC_SECRET || SYNC_SECRET.length < 32) {
  throw new Error("INTERNAL_SYNC_SECRET must be at least 32 characters");
}

const { db } = createDb(DB_PATH);
const app = createApp(db, { syncSecret: SYNC_SECRET });

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(
    `learn-chinese sync server listening on http://localhost:${info.port}`,
  );
  console.log(`  db: ${DB_PATH}`);
});
