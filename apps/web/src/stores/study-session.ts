import { create } from "zustand";

/**
 * Ephemeral study-session state. This is *client-only* UI state that vanishes
 * when the tab closes — never persisted server data. Persistent domain data
 * lives in Dexie and is accessed via React Query. See ARCHITECTURE.md §6.
 */
interface StudySessionState {
  queue: string[]; // card ids remaining this session (may grow via re-queue)
  index: number;
  answerShown: boolean;
  startedAt: number | null;
  cardShownAt: number | null;
  reviewedCount: number;

  start: (cardIds: string[]) => void;
  reveal: () => void;
  /**
   * Advance past the current card. Pass `requeueId` to append a card back onto
   * the queue — used for cards still in their learning steps, which become due
   * again within the same session (mirrors Anki). Returns the next card id.
   */
  advance: (requeueId?: string) => string | null;
  reset: () => void;
}

export const useStudySession = create<StudySessionState>((set, get) => ({
  queue: [],
  index: 0,
  answerShown: false,
  startedAt: null,
  cardShownAt: null,
  reviewedCount: 0,

  start: (cardIds) =>
    set({
      queue: cardIds,
      index: 0,
      answerShown: false,
      startedAt: Date.now(),
      cardShownAt: Date.now(),
      reviewedCount: 0,
    }),

  reveal: () => set({ answerShown: true }),

  advance: (requeueId) => {
    const { index, queue, reviewedCount } = get();
    const nextQueue = requeueId ? [...queue, requeueId] : queue;
    const nextIndex = index + 1;
    set({
      queue: nextQueue,
      index: nextIndex,
      answerShown: false,
      cardShownAt: Date.now(),
      reviewedCount: reviewedCount + 1,
    });
    return nextQueue[nextIndex] ?? null;
  },

  reset: () =>
    set({
      queue: [],
      index: 0,
      answerShown: false,
      startedAt: null,
      cardShownAt: null,
      reviewedCount: 0,
    }),
}));

export const currentCardId = (s: StudySessionState): string | null =>
  s.queue[s.index] ?? null;

/** Cards left in the session (including any re-queued learning cards). */
export const remainingCount = (s: StudySessionState): number =>
  Math.max(0, s.queue.length - s.index);
