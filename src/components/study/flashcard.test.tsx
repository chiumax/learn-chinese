import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { newCardSchedule } from "@/lib/srs/scheduler";
import type { Card, Note } from "@/lib/types";
import { Flashcard } from "./flashcard";

const note: Note = {
  id: "n1",
  deckId: "d1",
  hanzi: "你好",
  pinyin: "nǐ hǎo",
  meaning: "hello",
  tags: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function card(template: Card["template"]): Card {
  const sched = newCardSchedule(new Date("2026-01-01T00:00:00Z"));
  return {
    id: "c1",
    noteId: "n1",
    deckId: "d1",
    template,
    schedule: sched,
    due: sched.due,
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("Flashcard", () => {
  it("shows the hanzi prompt and hides the answer for a recognition card", () => {
    render(
      <Flashcard card={card("recognition")} note={note} answerShown={false} />,
    );
    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.queryByText("hello")).not.toBeInTheDocument();
  });

  it("reveals pinyin and meaning once the answer is shown", () => {
    render(
      <Flashcard card={card("recognition")} note={note} answerShown={true} />,
    );
    expect(screen.getByText("nǐ hǎo")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("prompts with the meaning (not the hanzi) for a production card", () => {
    render(
      <Flashcard card={card("production")} note={note} answerShown={false} />,
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.queryByText("你好")).not.toBeInTheDocument();
  });
});
