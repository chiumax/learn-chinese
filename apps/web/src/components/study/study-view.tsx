"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flashcard } from "@/components/study/flashcard";
import { GradeBar } from "@/components/study/grade-bar";
import { ensureDemoDeck } from "@/lib/db/seed";
import { useCard, useDueCards, useGradeCard, useNote } from "@/hooks/use-study";
import { isLearningSchedule, type ReviewGrade } from "@learn-chinese/shared";
import {
  currentCardId,
  remainingCount,
  useStudySession,
} from "@/stores/study-session";

export function StudyView() {
  // Seed + resolve the demo deck (offline, local-first).
  const { data: deckId } = useQuery({
    queryKey: ["demoDeck"],
    queryFn: ensureDemoDeck,
  });

  const { data: dueCards, isLoading } = useDueCards(deckId ?? "");
  const grade = useGradeCard(deckId ?? "");

  const session = useStudySession();
  const cardId = currentCardId(session);

  const { data: card } = useCard(cardId);
  const { data: note } = useNote(card?.noteId);

  // Populate the session queue once cards are loaded.
  useEffect(() => {
    if (dueCards && session.queue.length === 0 && dueCards.length > 0) {
      session.start(dueCards.map((c) => c.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueCards]);

  const remaining = remainingCount(session);
  const done = !dueCards || (session.queue.length > 0 && remaining === 0);

  const handleGrade = useCallback(
    async (g: ReviewGrade) => {
      if (!card || grade.isPending) return;
      const durationMs = session.cardShownAt
        ? Date.now() - session.cardShownAt
        : 0;
      const updated = await grade.mutateAsync({ card, grade: g, durationMs });
      // Cards still in their learning steps come due again this session.
      session.advance(
        isLearningSchedule(updated.schedule) ? updated.id : undefined,
      );
    },
    [card, grade, session],
  );

  // Keyboard shortcuts: Space/Enter reveals, 1–4 grades.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card) return;
      if (!session.answerShown && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        session.reveal();
      } else if (session.answerShown && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        void handleGrade(Number(e.key) as ReviewGrade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, session, handleGrade]);

  if (isLoading || !deckId) {
    return <p className="text-muted-foreground text-center">Loading…</p>;
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-semibold">All caught up 🎉</h2>
        <p className="text-muted-foreground">
          Reviewed {session.reviewedCount} card
          {session.reviewedCount === 1 ? "" : "s"} this session.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            session.reset();
            grade.reset();
          }}
        >
          Refresh
        </Button>
      </div>
    );
  }

  if (!card || !note) {
    return <p className="text-muted-foreground text-center">Loading card…</p>;
  }

  const total = session.reviewedCount + remaining;

  return (
    <div className="space-y-6">
      <Progress value={total ? (session.reviewedCount / total) * 100 : 0} />
      <Flashcard card={card} note={note} answerShown={session.answerShown} />

      {session.answerShown ? (
        <GradeBar onGrade={handleGrade} disabled={grade.isPending} />
      ) : (
        <Button className="h-12 w-full" onClick={() => session.reveal()}>
          Show answer{" "}
          <kbd className="bg-muted ml-2 rounded px-1.5 text-xs">space</kbd>
        </Button>
      )}

      <p className="text-muted-foreground text-center text-sm">
        {remaining} left
        <button
          className="ml-3 underline"
          onClick={() => toast.info("Sync runs automatically when online.")}
        >
          status
        </button>
      </p>
    </div>
  );
}
