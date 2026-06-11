"use client";

import { AnimatePresence, motion } from "motion/react";
import { Card } from "@/components/ui/card";
import type { Card as CardModel, Note } from "@/lib/types";

/**
 * Per-template prompt/answer mapping. Each template tests a different facet of
 * the same note, so they're scheduled independently. See ARCHITECTURE.md §5.1.
 */
const TEMPLATE_LABEL: Record<CardModel["template"], string> = {
  recognition: "Recognition · hanzi → meaning",
  production: "Production · meaning → hanzi",
  tone: "Tone · recall the tones",
  writing: "Writing · meaning → character",
};

interface Face {
  /** Large primary prompt text. */
  primary: string;
  /** Optional secondary line under the prompt. */
  secondary?: string;
}

function front(template: CardModel["template"], note: Note): Face {
  switch (template) {
    case "production":
      return { primary: note.meaning };
    case "writing":
      return { primary: note.meaning, secondary: note.pinyin };
    case "tone":
    case "recognition":
      return { primary: note.hanzi };
  }
}

function back(template: CardModel["template"], note: Note): Face {
  switch (template) {
    case "production":
    case "writing":
      return { primary: note.hanzi, secondary: note.pinyin };
    case "tone":
      return { primary: note.pinyin, secondary: note.meaning };
    case "recognition":
      return { primary: note.pinyin, secondary: note.meaning };
  }
}

/** The flip-able study card. Front/back content depends on the template. */
export function Flashcard({
  card,
  note,
  answerShown,
}: {
  card: CardModel;
  note: Note;
  answerShown: boolean;
}) {
  const f = front(card.template, note);
  const b = back(card.template, note);

  return (
    <Card className="flex min-h-64 flex-col items-center justify-center gap-6 p-10 text-center">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">
        {TEMPLATE_LABEL[card.template]}
      </span>

      <div className="space-y-1">
        <div className="text-6xl font-semibold">{f.primary}</div>
        {f.secondary && (
          <div className="text-muted-foreground text-lg">{f.secondary}</div>
        )}
      </div>

      <AnimatePresence>
        {answerShown && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-1 border-t pt-6"
          >
            <div className="text-5xl font-semibold">{b.primary}</div>
            {b.secondary && (
              <div className="text-muted-foreground text-lg">{b.secondary}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
