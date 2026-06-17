import {
  newCardSchedule,
  schedule as scheduleNext,
  type Card,
  type Deck,
  type Note,
  type ReviewLog,
  type SyncMutation,
  type SyncRequest,
} from "@learn-chinese/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/client";
import { LOCAL_USER, processSync } from "./service";

let db: Db;
beforeEach(() => {
  db = createDb(":memory:").db;
});

const T0 = "2026-01-01T00:00:00.000Z";

function mut(
  entity: SyncMutation["entity"],
  payload: unknown,
  id: string,
): SyncMutation {
  return { id, entity, op: "upsert", payload };
}

function fixtures() {
  const deck: Deck = {
    id: "deck1",
    name: "Test",
    createdAt: T0,
    updatedAt: T0,
  };
  const note: Note = {
    id: "note1",
    deckId: "deck1",
    hanzi: "你好",
    pinyin: "nǐ hǎo",
    meaning: "hello",
    tags: [],
    createdAt: T0,
    updatedAt: T0,
  };
  const sched = newCardSchedule(new Date(T0));
  const card: Card = {
    id: "card1",
    noteId: "note1",
    deckId: "deck1",
    template: "recognition",
    schedule: sched,
    due: sched.due,
    updatedAt: T0,
  };
  return { deck, note, card, sched };
}

function review(
  prev: Card["schedule"],
  grade: 1 | 2 | 3 | 4,
  at: string,
  deviceId: string,
  id: string,
): ReviewLog {
  return {
    id,
    cardId: "card1",
    deckId: "deck1",
    deviceId,
    grade,
    reviewedAt: at,
    durationMs: 1000,
    prevSchedule: prev,
  };
}

function req(
  mutations: SyncMutation[],
  cursor = 0,
  deviceId = "A",
): SyncRequest {
  return { deviceId, cursor, mutations };
}

describe("processSync", () => {
  it("applies a deck/note/card and returns them as changes", () => {
    const { deck, note, card } = fixtures();
    const res = processSync(
      db,
      LOCAL_USER,
      req([
        mut("deck", deck, "m1"),
        mut("note", note, "m2"),
        mut("card", card, "m3"),
      ]),
    );
    expect(res.applied).toEqual(["m1", "m2", "m3"]);
    expect(res.changes.map((c) => c.entity)).toEqual(["deck", "note", "card"]);
    expect(res.cursor).toBe(3);
  });

  it("is idempotent: re-sending the same mutations adds no new changes", () => {
    const { deck } = fixtures();
    const first = processSync(db, LOCAL_USER, req([mut("deck", deck, "m1")]));
    // Re-send from the cursor we just reached — nothing new should come back.
    const again = processSync(
      db,
      LOCAL_USER,
      req([mut("deck", deck, "m1")], first.cursor),
    );
    expect(again.applied).toEqual(["m1"]); // still acked
    expect(again.changes).toHaveLength(0); // but no new change row created
  });

  it("lets a second device pull everything from cursor 0", () => {
    const { deck, note, card } = fixtures();
    processSync(
      db,
      LOCAL_USER,
      req([
        mut("deck", deck, "m1"),
        mut("note", note, "m2"),
        mut("card", card, "m3"),
      ]),
    );
    const deviceB = processSync(db, LOCAL_USER, req([], 0, "B"));
    expect(deviceB.changes.map((c) => c.entity)).toEqual([
      "deck",
      "note",
      "card",
    ]);
    expect(deviceB.cursor).toBe(3);
  });

  it("derives card schedule from the review log (not the client's copy)", () => {
    const { deck, note, card, sched } = fixtures();
    const r = review(sched, 3, T0, "A", "rev1");
    const res = processSync(
      db,
      LOCAL_USER,
      req([
        mut("deck", deck, "m1"),
        mut("note", note, "m2"),
        mut("card", card, "m3"),
        mut("review", r, "m4"),
      ]),
    );
    // A recomputed card change is emitted after the review.
    const cardChanges = res.changes.filter((c) => c.entity === "card");
    expect(cardChanges.length).toBeGreaterThanOrEqual(1);
    const last = cardChanges[cardChanges.length - 1].payload as Card;
    // Server-derived due should match a local schedule step from the same input.
    const expected = scheduleNext(sched, 3, new Date(T0)).schedule;
    expect(last.schedule.due).toBe(expected.due);
    expect(last.due).toBe(expected.due);
  });

  it("merges reviews from two devices conflict-free and recomputes once", () => {
    const { deck, note, card, sched } = fixtures();
    processSync(
      db,
      LOCAL_USER,
      req([
        mut("deck", deck, "m1"),
        mut("note", note, "m2"),
        mut("card", card, "m3"),
      ]),
    );

    // Device A reviews at T0; device B reviews the same card a day later.
    const rA = review(sched, 3, T0, "A", "revA");
    const rB = review(sched, 4, "2026-01-02T00:00:00.000Z", "B", "revB");
    processSync(db, LOCAL_USER, req([mut("review", rA, "mA")], 3, "A"));
    processSync(db, LOCAL_USER, req([mut("review", rB, "mB")], 3, "B"));

    const reviewsStored = processSync(
      db,
      LOCAL_USER,
      req([], 0, "C"),
    ).changes.filter((c) => c.entity === "review");
    expect(reviewsStored).toHaveLength(2); // both kept, no conflict

    // Canonical state equals replaying both reviews in time order.
    const afterA = scheduleNext(sched, 3, new Date(T0)).schedule;
    const afterB = scheduleNext(
      afterA,
      4,
      new Date("2026-01-02T00:00:00.000Z"),
    ).schedule;
    const cardNow = processSync(db, LOCAL_USER, req([], 0, "C"))
      .changes.filter((c) => c.entity === "card")
      .pop()!.payload as Card;
    expect(cardNow.schedule.due).toBe(afterB.due);
  });
});
