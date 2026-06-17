import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
  type RecordLogItem,
} from "ts-fsrs";

/**
 * Thin, pure wrapper around `ts-fsrs`.
 *
 * The rest of the app must go through this module rather than importing
 * `ts-fsrs` directly. This keeps the library swappable and, crucially, keeps
 * scheduling a *pure function* (state in -> state out, no I/O) so it can run
 * identically on the client and be replayed on the server over a merged review
 * log. See ARCHITECTURE.md §5.3 and §7.
 */

/** Default FSRS desired retention (probability of recall at review time). */
export const DEFAULT_DESIRED_RETENTION = 0.9;

/** Grade is the user's answer button: 1=Again, 2=Hard, 3=Good, 4=Easy. */
export type ReviewGrade = 1 | 2 | 3 | 4;

const GRADE_TO_RATING: Record<ReviewGrade, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

/**
 * Serializable FSRS state we persist per card (Dexie + Postgres). Dates are
 * stored as ISO strings so the shape survives IndexedDB and JSON transport.
 */
export interface CardSchedule {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: State;
  /** Index into the configured learning/relearning steps. Must round-trip. */
  learningSteps: number;
  lastReview?: string;
}

/** One immutable review event, appended to the log (never edited). See §5.2. */
export interface ReviewEvent {
  grade: ReviewGrade;
  /** When the review happened (ISO). */
  review: string;
}

export interface SchedulerOptions {
  desiredRetention?: number;
  /** Per-user / per-deck FSRS weights. Omit to use library defaults. */
  parameters?: number[];
}

function buildScheduler(opts: SchedulerOptions = {}) {
  return fsrs(
    generatorParameters({
      request_retention: opts.desiredRetention ?? DEFAULT_DESIRED_RETENTION,
      ...(opts.parameters ? { w: opts.parameters } : {}),
      enable_fuzz: true,
    }),
  );
}

function toFsrsCard(schedule: CardSchedule): FsrsCard {
  return {
    due: new Date(schedule.due),
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsed_days: schedule.elapsedDays,
    scheduled_days: schedule.scheduledDays,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: schedule.state,
    last_review: schedule.lastReview
      ? new Date(schedule.lastReview)
      : undefined,
    learning_steps: schedule.learningSteps,
  };
}

function fromFsrsCard(card: FsrsCard): CardSchedule {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    learningSteps: card.learning_steps,
    lastReview: card.last_review?.toISOString(),
  };
}

/** Fresh schedule for a brand-new card. */
export function newCardSchedule(now: Date = new Date()): CardSchedule {
  return fromFsrsCard(createEmptyCard(now));
}

/**
 * Pure scheduling step. Given a card's current schedule and a grade, return
 * the next schedule. No persistence, no clock side effects — `now` is injected
 * so this is fully deterministic and unit-testable.
 */
export function schedule(
  current: CardSchedule,
  grade: ReviewGrade,
  now: Date = new Date(),
  opts: SchedulerOptions = {},
): { schedule: CardSchedule; log: RecordLogItem["log"] } {
  const scheduler = buildScheduler(opts);
  const result = scheduler.next(
    toFsrsCard(current),
    now,
    GRADE_TO_RATING[grade],
  );
  return { schedule: fromFsrsCard(result.card), log: result.log };
}

/**
 * Replay an ordered review log from a starting schedule. This is how the
 * server recomputes canonical scheduling state after merging reviews from
 * multiple offline devices (ARCHITECTURE.md §5.3).
 */
export function replay(
  events: ReviewEvent[],
  opts: SchedulerOptions = {},
  start: CardSchedule = newCardSchedule(
    events[0] ? new Date(events[0].review) : new Date(),
  ),
): CardSchedule {
  return events.reduce((state, event) => {
    return schedule(state, event.grade, new Date(event.review), opts).schedule;
  }, start);
}

/**
 * Whether a card is still in its (re)learning steps and will fall due again
 * within the current session, so the UI should re-queue it rather than wait.
 */
export function isLearningSchedule(s: CardSchedule): boolean {
  return s.state === State.Learning || s.state === State.Relearning;
}

/** Human-readable retrievability (recall probability) of a card right now. */
export function retrievability(
  current: CardSchedule,
  now: Date = new Date(),
  opts: SchedulerOptions = {},
): number {
  const scheduler = buildScheduler(opts);
  return scheduler.get_retrievability(
    toFsrsCard(current),
    now,
    false,
  ) as number;
}

export { State, Rating };
