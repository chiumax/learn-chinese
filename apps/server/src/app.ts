import { zSyncRequest } from "@learn-chinese/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Db } from "./db/client";
import { LOCAL_USER, processSync } from "./sync/service";

export interface AppOptions {
  /** Allowed CORS origin for the web client. */
  webOrigin?: string;
}

/**
 * Build the HTTP app around an injected database, so tests can pass an
 * in-memory DB and the entry point passes a file-backed one.
 */
export function createApp(db: Db, opts: AppOptions = {}) {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: opts.webOrigin ?? "http://localhost:3000",
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/sync", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = zSyncRequest.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid request", issues: parsed.error.issues },
        400,
      );
    }
    // Single-user until auth lands; the protocol is already user-scoped.
    const response = processSync(db, LOCAL_USER, parsed.data);
    return c.json(response);
  });

  return app;
}
