import { create } from "zustand";

/**
 * Ephemeral study-session state. This is *client-only* UI state that vanishes
 * when the tab closes — never persisted server data. Persistent domain data
 * lives in Dexie and is accessed via React Query. See ARCHITECTURE.md §6.
 */
interface StudySessionState {
  queue: string[]; // card ids remaining this session
  index: number;
  answerShown: boolean;
  startedAt: number | null;
  cardShownAt: number | null;
  reviewedCount: number;

  start: (cardIds: string[]) => void;
  reveal: () => void;
  /** Advance past the current card; returns the next card id or null. */
  advance: () => string | null;
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

  advance: () => {
    const { index, queue } = get();
    const nextIndex = index + 1;
    set({
      index: nextIndex,
      answerShown: false,
      cardShownAt: Date.now(),
      reviewedCount: get().reviewedCount + 1,
    });
    return queue[nextIndex] ?? null;
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
