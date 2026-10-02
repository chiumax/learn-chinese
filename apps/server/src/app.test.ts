import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDb } from "./db/client";

const syncSecret = "test-secret-with-at-least-32-characters";

describe("sync API authentication", () => {
  const app = createApp(createDb(":memory:").db, { syncSecret });

  it("keeps the health check available to Railway", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
  });

  it("rejects a sync request without the service credential", async () => {
    const response = await app.request("/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(401);
  });

  it("accepts the credential before validating the sync payload", async () => {
    const response = await app.request("/sync", {
      method: "POST",
      headers: {
        authorization: `Bearer ${syncSecret}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(response.status).toBe(400);
  });
});
