import { db } from "@/lib/db/dexie";
import { createDeck, createNote } from "@/lib/db/repository";

export const DEMO_DECK_ID_KEY = "lc.demoDeckId";

const SAMPLE_NOTES = [
  { hanzi: "你好", pinyin: "nǐ hǎo", meaning: "hello" },
  { hanzi: "谢谢", pinyin: "xiè xie", meaning: "thank you" },
  { hanzi: "学习", pinyin: "xué xí", meaning: "to study / learn" },
  { hanzi: "中文", pinyin: "zhōng wén", meaning: "Chinese (language)" },
  { hanzi: "朋友", pinyin: "péng you", meaning: "friend" },
];

/**
 * Idempotently seed a demo deck so the app is usable on first run with no
 * server. Returns the demo deck id.
 */
export async function ensureDemoDeck(): Promise<string> {
  const existing =
    typeof window !== "undefined"
      ? window.localStorage.getItem(DEMO_DECK_ID_KEY)
      : null;
  if (existing && (await db.decks.get(existing))) return existing;

  const deck = await createDeck("Demo · Beginner Chinese");
  for (const n of SAMPLE_NOTES) {
    await createNote({ ...n, deckId: deck.id }, ["recognition", "production"]);
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DEMO_DECK_ID_KEY, deck.id);
  }
  return deck.id;
}
