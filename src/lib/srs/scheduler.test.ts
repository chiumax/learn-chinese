import { describe, expect, it } from "vitest";
import {
  newCardSchedule,
  replay,
  retrievability,
  schedule,
  State,
  type ReviewEvent,
} from "./scheduler";

const T0 = new Date("2026-01-01T00:00:00Z");

describe("newCardSchedule", () => {
  it("starts a card in the New state with no reps", () => {
    const card = newCardSchedule(T0);
    expect(card.state).toBe(State.New);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
  });
});

describe("schedule", () => {
  it("is pure: same inputs produce the same output", () => {
    const card = newCardSchedule(T0);
    const a = schedule(card, 3, T0);
    const b = schedule(card, 3, T0);
    expect(a.schedule).toEqual(b.schedule);
  });

  it("advances reps on a successful review", () => {
    const card = newCardSchedule(T0);
    const { schedule: next } = schedule(card, 3, T0);
    expect(next.reps).toBe(1);
    expect(next.lastReview).toBe(T0.toISOString());
  });

  it("a better grade yields a longer or equal interval than a worse grade", () => {
    const card = newCardSchedule(T0);
    const good = schedule(card, 3, T0).schedule;
    const easy = schedule(card, 4, T0).schedule;
    expect(new Date(easy.due).getTime()).toBeGreaterThanOrEqual(
      new Date(good.due).getTime(),
    );
  });

  it("counts a lapse when a graduated (Review-state) card is forgotten", () => {
    let card = newCardSchedule(T0);
    let now = T0;
    // Drive the card through learning until it graduates to the Review state.
    for (let i = 0; i < 10 && card.state !== State.Review; i++) {
      now = new Date(card.due);
      card = schedule(card, 3, now).schedule;
    }
    expect(card.state).toBe(State.Review);

    const before = card.lapses;
    const lapsed = schedule(card, 1, new Date(card.due)).schedule;
    expect(lapsed.lapses).toBe(before + 1);
  });
});

describe("replay", () => {
  it("reproduces the same final state as sequential scheduling", () => {
    const events: ReviewEvent[] = [
      { grade: 3, review: "2026-01-01T00:00:00Z" },
      { grade: 4, review: "2026-01-03T00:00:00Z" },
      { grade: 2, review: "2026-01-20T00:00:00Z" },
    ];

    const replayed = replay(events);

    let manual = newCardSchedule(new Date(events[0].review));
    for (const e of events) {
      manual = schedule(manual, e.grade, new Date(e.review)).schedule;
    }

    expect(replayed.stability).toBeCloseTo(manual.stability, 5);
    expect(replayed.difficulty).toBeCloseTo(manual.difficulty, 5);
    expect(replayed.due).toBe(manual.due);
  });

  it("returns the starting state for an empty log", () => {
    const start = newCardSchedule(T0);
    expect(replay([], {}, start)).toEqual(start);
  });
});

describe("retrievability", () => {
  it("decays from ~1 at review time toward 0 as time passes", () => {
    const card = schedule(newCardSchedule(T0), 3, T0).schedule;
    const atDue = retrievability(card, new Date(card.due));
    const muchLater = retrievability(card, new Date("2027-01-01T00:00:00Z"));
    expect(atDue).toBeGreaterThan(muchLater);
    expect(atDue).toBeLessThanOrEqual(1);
    expect(muchLater).toBeGreaterThanOrEqual(0);
  });
});
