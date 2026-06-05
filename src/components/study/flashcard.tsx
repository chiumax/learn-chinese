"use client";

import { AnimatePresence, motion } from "motion/react";
import { Card } from "@/components/ui/card";
import type { Card as CardModel, Note } from "@/lib/types";

const TEMPLATE_LABEL: Record<CardModel["template"], string> = {
  recognition: "Recognition · hanzi → meaning",
  production: "Production · meaning → hanzi",
  tone: "Tone",
  writing: "Writing",
};

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
  const showHanziFront = card.template !== "production";

  return (
    <Card className="flex min-h-64 flex-col items-center justify-center gap-6 p-10 text-center">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">
        {TEMPLATE_LABEL[card.template]}
      </span>

      <div className="text-6xl font-semibold">
        {showHanziFront ? note.hanzi : note.meaning}
      </div>

      <AnimatePresence>
        {answerShown && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-1 border-t pt-6"
          >
            {showHanziFront ? (
              <>
                <div className="text-2xl">{note.pinyin}</div>
                <div className="text-muted-foreground text-lg">
                  {note.meaning}
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl font-semibold">{note.hanzi}</div>
                <div className="text-muted-foreground text-lg">
                  {note.pinyin}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
