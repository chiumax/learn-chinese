import { describe, expect, it } from "vitest";
import { isOwnerEmail } from "./authz";

describe("isOwnerEmail", () => {
  const owners = "owner@example.com,owner-alt@example.com";

  it("allows both configured owner identities", () => {
    expect(isOwnerEmail("owner@example.com", owners)).toBe(true);
    expect(isOwnerEmail("owner-alt@example.com", owners)).toBe(true);
  });

  it("matches configured owners case-insensitively", () => {
    expect(isOwnerEmail(" Max@Finosu.com ", owners)).toBe(true);
  });

  it("rejects missing and different accounts", () => {
    expect(isOwnerEmail(undefined, owners)).toBe(false);
    expect(isOwnerEmail("other@example.com", owners)).toBe(false);
    expect(isOwnerEmail("max@finosu.co", owners)).toBe(false);
  });
});
