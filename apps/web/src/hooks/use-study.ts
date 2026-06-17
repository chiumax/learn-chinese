"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db/dexie";
import { gradeCard, getDueCards } from "@/lib/db/repository";
import type { ReviewGrade } from "@learn-chinese/shared";
import type { Card } from "@learn-chinese/shared";

/** React Query is our async gateway to the local (Dexie) source of truth. */

export function useDueCards(deckId: string) {
  return useQuery({
    queryKey: ["dueCards", deckId],
    queryFn: () => getDueCards(deckId),
  });
}

export function useCard(cardId: string | null) {
  return useQuery({
    queryKey: ["card", cardId],
    queryFn: () => (cardId ? db.cards.get(cardId) : undefined),
    enabled: !!cardId,
  });
}

export function useNote(noteId: string | null | undefined) {
  return useQuery({
    queryKey: ["note", noteId],
    queryFn: () => (noteId ? db.notes.get(noteId) : undefined),
    enabled: !!noteId,
  });
}

export function useGradeCard(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      card,
      grade,
      durationMs,
    }: {
      card: Card;
      grade: ReviewGrade;
      durationMs: number;
    }) => gradeCard(card, grade, durationMs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dueCards", deckId] });
    },
  });
}
