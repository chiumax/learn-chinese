"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flashcard } from "@/components/study/flashcard";
import { GradeBar } from "@/components/study/grade-bar";
import { db } from "@/lib/db/dexie";
import { ensureDemoDeck } from "@/lib/db/seed";
import { useDueCards, useGradeCard } from "@/hooks/use-study";
import type { ReviewGrade } from "@/lib/srs/scheduler";
import { currentCardId, useStudySession } from "@/stores/study-session";

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

  // Populate the session queue once cards are loaded.
  useEffect(() => {
    if (dueCards && session.queue.length === 0 && dueCards.length > 0) {
      session.start(dueCards.map((c) => c.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueCards]);

  const { data: card } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => (cardId ? db.cards.get(cardId) : undefined),
    enabled: !!cardId,
  });
  const { data: note } = useQuery({
    queryKey: ["note", card?.noteId],
    queryFn: () => (card ? db.notes.get(card.noteId) : undefined),
    enabled: !!card,
  });

  if (isLoading || !deckId) {
    return <p className="text-muted-foreground text-center">Loading…</p>;
  }

  const total = session.queue.length;
  const done = total === 0 || session.index >= total;

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

  async function handleGrade(g: ReviewGrade) {
    if (!card) return;
    const durationMs = session.cardShownAt
      ? Date.now() - session.cardShownAt
      : 0;
    await grade.mutateAsync({ card, grade: g, durationMs });
    session.advance();
  }

  return (
    <div className="space-y-6">
      <Progress value={(session.index / total) * 100} />
      <Flashcard card={card} note={note} answerShown={session.answerShown} />

      {session.answerShown ? (
        <GradeBar onGrade={handleGrade} disabled={grade.isPending} />
      ) : (
        <Button className="h-12 w-full" onClick={() => session.reveal()}>
          Show answer
        </Button>
      )}

      <p className="text-muted-foreground text-center text-sm">
        {total - session.index} left
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
