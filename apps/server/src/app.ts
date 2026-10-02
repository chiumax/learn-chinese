import { zSyncRequest } from "@learn-chinese/shared";
import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { Db } from "./db/client";
import { OWNER_USER_ID, processSync } from "./sync/service";

export interface AppOptions {
  /** Shared only with the authenticated Next.js proxy. */
  syncSecret: string;
}

function hasValidBearer(header: string | undefined, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

/**
 * Build the HTTP app around an injected database, so tests can pass an
 * in-memory DB and the entry point passes a file-backed one.
 */
export function createApp(db: Db, opts: AppOptions) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/sync", async (c) => {
    if (!hasValidBearer(c.req.header("authorization"), opts.syncSecret)) {
      c.header("WWW-Authenticate", "Bearer");
      return c.json({ error: "unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = zSyncRequest.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid request", issues: parsed.error.issues },
        400,
      );
    }
    const response = processSync(db, OWNER_USER_ID, parsed.data);
    return c.json(response);
  });

  return app;
}
