import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db/client";

const PORT = Number(process.env.PORT ?? 4000);
const DB_PATH = process.env.DB_PATH ?? "data/app.db";
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const { db } = createDb(DB_PATH);
const app = createApp(db, { webOrigin: WEB_ORIGIN });

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(
    `learn-chinese sync server listening on http://localhost:${info.port}`,
  );
  console.log(`  db: ${DB_PATH}  ·  web origin: ${WEB_ORIGIN}`);
});
