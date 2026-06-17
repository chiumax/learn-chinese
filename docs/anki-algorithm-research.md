# Anki Spaced Repetition Algorithm — Research

> Research compiled 2026-06-05 for the `learn-chinese` flashcard project.
> Goal: understand the algorithms behind Anki well enough to design our own
> spaced-repetition scheduler for a Chinese-learning app.

## TL;DR

- Anki ships **two** schedulers:
  1. A modified **SM-2** (SuperMemo 2, 1987) — the historical default.
  2. **FSRS** (Free Spaced Repetition Scheduler) — a modern, data-driven
     model that became the recommended default and is the actively developed
     algorithm (FSRS-6 shipped in Anki 25.07, late 2025).
- SM-2 is a handful of hard-coded rules built around a per-card **ease factor**.
  It's trivial to implement but mediocre at predicting memory.
- FSRS models memory with three variables — **Difficulty, Stability,
  Retrievability (DSR)** — and fits ~17–21 parameters to real review logs.
  On the public benchmark (~700M reviews) it needs **~20–30% fewer reviews**
  for the same retention and is more accurate for ~99.5% of users.
- **Recommendation for our app:** implement FSRS. It is open source
  (MIT/BSD-style libraries exist in Rust, Python, JS/TS, Go, etc.), the math
  is well documented, and we can ship sane default parameters immediately and
  optimize per-user later once we have review history.

---

## 1. The SM-2 algorithm (the foundation)

SM-2 was written by Piotr Woźniak in 1987 and is the algorithm Anki was
originally built on (also used by Mnemosyne and others). It tracks three
values per card:

- `n` — number of consecutive successful recalls
- `EF` — easiness factor (starts at **2.5**)
- `I` — current inter-repetition interval, in days

### Grading (original SM-2: quality `q` from 0–5)

| q   | Meaning                                         |
| --- | ----------------------------------------------- |
| 5   | Perfect recall                                  |
| 4   | Correct, after hesitation                       |
| 3   | Correct, but with significant difficulty        |
| 2   | Incorrect; correct answer seemed easy to recall |
| 1   | Incorrect; correct answer remembered once shown |
| 0   | Complete blackout                               |

`q >= 3` counts as a pass; `q < 3` is a fail.

### Interval rules

```
if q >= 3:                    # correct
    if n == 0: I = 1
    elif n == 1: I = 6
    else:        I = round(I_prev * EF)
    n += 1
else:                         # incorrect
    n = 0
    I = 1                     # repeat from scratch

# update easiness factor after every review:
EF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
if EF < 1.3: EF = 1.3        # floor
```

So with `EF = 2.5` a perfectly-known card grows: `1 → 6 → 15 → 37 → 92 …` days.
The EF floor of **1.3** is the smallest multiplier the algorithm will allow.

### Why SM-2 is limited

- The forgetting model is implicit — it never explicitly predicts a
  probability of recall, so you can't target a retention rate.
- Failures reset the interval to 1 day, discarding accumulated memory.
- The ease factor conflates "difficulty" with "scheduling," which produces
  the infamous **"ease hell"** (see §2).

---

## 2. Anki's modifications to SM-2

Anki does **not** use textbook SM-2. Its scheduler differs in several ways
([Anki FAQ](https://faqs.ankiweb.net/what-spaced-repetition-algorithm)):

- **4 buttons instead of 6 grades:** `Again`, `Hard`, `Good`, `Easy` (only one
  fail option). Ease is adjusted via the positive buttons.
- **Configurable learning steps:** new cards pass through user-defined steps
  (default `1m`, `10m`) before graduating, instead of SM-2's fixed 1/6 days.
- **Graduating interval / easy interval:** `Good` on the last learning step
  graduates the card to **1 day**; `Easy` jumps it straight to **4 days**.
- **Late-review bonus:** reviewing after the due date gives credit for the
  extra elapsed time rather than ignoring it.
- **Lapses don't fully reset:** a configurable "new interval" multiplier
  (default `0`, i.e. relearn from short steps) instead of hard reset to 1 day.

### Ease factor & interval mechanics (Anki's SM-2)

Ease is stored as an integer percentage (e.g. `2500` = 2.5×), starting at
**250%**. On a review:

| Button  | Ease change       | Interval (next)                                                    |
| ------- | ----------------- | ------------------------------------------------------------------ |
| `Again` | −20% (floor 130%) | lapse: `interval × newIntervalMult` (default → relearn)            |
| `Hard`  | −15%              | `interval × 1.2` (hardFactor)                                      |
| `Good`  | unchanged         | `(interval + daysLate/2) × ease × intervalModifier`                |
| `Easy`  | +15%              | `(interval + daysLate) × ease × easyBonus(1.3) × intervalModifier` |

- **Interval modifier:** a global multiplier (default `1.0`) that scales every
  review interval — the blunt knob people use to trade retention for volume.
- **Maximum interval:** capped (default `36500` days).
- **Fuzz:** Anki adds random jitter to intervals (none below 2 days, up to
  ~±25% for short intervals, shrinking to ~±5% for intervals over ~30 days)
  to prevent cards from clumping on the same day.

### "Ease hell" — the key failure mode

Because every `Again`/`Hard` permanently lowers a card's ease, hard cards
spiral down to the **1.3× floor** and get stuck there forever — hundreds of
cards reviewed constantly without their intervals ever growing. This is the
single biggest practical complaint about the SM-2 scheduler and a major
motivation for FSRS. **If we build our own SM-2, we should avoid letting a
single difficulty number drive both grading penalty and interval growth.**

Sources: [Anki SRS deep-dive](https://juliensobczak.com/inspect/2022/05/30/anki-srs/),
[AnkiGenix interval guide](https://ankigenix.com/en/blog/anki-built-in-interval-algorithm),
[RemNote on Anki SM-2](https://help.remnote.com/en/articles/6026144-the-anki-sm-2-spaced-repetition-algorithm).

---

## 3. FSRS — the modern algorithm

FSRS is built on the **DSR (Difficulty, Stability, Retrievability)** memory
model (derived from MaiMemo's DHP model). Instead of hand-tuned rules it fits
parameters to review data with gradient descent (binary cross-entropy loss,
treating each review as pass/fail).

### The three state variables

- **Retrievability `R`** — probability you recall the card _right now_
  (0–1). Decays over time.
- **Stability `S`** — memory strength, defined as the **number of days for `R`
  to fall from 100% to 90%**. Higher = forgotten more slowly.
- **Difficulty `D`** — inherent hardness of the item, on a 1–10 scale.

### Forgetting curve (retrievability)

FSRS uses a **power function** (not a pure exponential — superposed
exponentials across many cards are better fit by a power law):

```
R(t, S) = (1 + FACTOR * t / S) ^ DECAY
```

In FSRS-4.5/5 the curve is fixed with `DECAY = -0.5` and
`FACTOR = 0.9^(1/DECAY) - 1 = 19/81`, which simplifies to the often-quoted

```
R(t, S) = (1 + t / (9S)) ^ -1
```

In **FSRS-6** the decay became a _trainable_ parameter `w20` (range 0.1–0.8),
personalizing curve shape per user. By construction `R = 0.9` exactly when
`t = S`.

### Scheduling: interval from desired retention

You pick a **desired retention** `r` (default **0.9**; 0.80–0.95 is the sane
range). Invert the forgetting curve to find the interval where `R` will have
decayed to `r`:

```
I(r, S) = (S / FACTOR) * (r ^ (1/DECAY) - 1)
```

With the FSRS-4.5 constants this is `I = 9S * (1/r - 1)`, and at `r = 0.9` the
interval simply equals the stability `S` (before fuzz). **Desired retention is
the single most important user-facing knob** — it directly trades review
volume against how much you forget.

### Parameters (the "weights")

FSRS-5 has **19** weights `w0…w18`; FSRS-6 adds short-term and decay terms for
**21** (`w0…w20`). Roughly:

| Weights   | Role                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `w0–w3`   | Initial stability after first review, per grade (Again/Hard/Good/Easy) |
| `w4–w5`   | Initial difficulty                                                     |
| `w6–w7`   | Difficulty update + mean-reversion strength                            |
| `w8–w10`  | Stability increase on successful recall                                |
| `w11–w14` | Stability after a lapse (forgetting)                                   |
| `w15–w16` | Hard / Easy grade multipliers                                          |
| `w17–w19` | Same-day / short-term review adjustment                                |
| `w20`     | Forgetting-curve decay (FSRS-6)                                        |

FSRS-5 default weights (a usable starting point if you have no data):

```
[0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
 2.9898, 0.51655, 0.6621]
```

### Core update equations (FSRS-5 form)

**Initial state** (first review, grade `G ∈ {1,2,3,4}`):

```
S0(G) = w[G-1]
D0(G) = w4 - exp(w5 * (G-1)) + 1        # clamped to [1, 10]
```

**Difficulty update** (linear damping + mean reversion toward the "easy"
target so difficulty doesn't drift forever):

```
ΔD  = -w6 * (G - 3)
D'  = D + ΔD * (10 - D) / 9              # damping near the ceiling
D'' = w7 * D0(4) + (1 - w7) * D'         # mean reversion
```

**Stability after a successful recall** (grows more when `R` is low — i.e.
reviewing right when you're about to forget is most efficient — less when `D`
or `S` is already high):

```
S_recall = S * (1 + exp(w8) * (11 - D) * S^(-w9) * (exp(w10*(1-R)) - 1)
                  * hardPenalty(w15 if G==2) * easyBonus(w16 if G==4))
```

**Stability after forgetting** (`Again`) — always less than before:

```
S_lapse = w11 * D^(-w12) * ((S + 1)^w13 - 1) * exp(w14 * (1 - R))
```

**Same-day / short-term reviews** (FSRS-6):

```
S' = S + w17 + w18*(G-3) - w19*ln(S)     # with S' >= S when G >= 3
```

Sources: [Expertium's FSRS technical explanation](https://expertium.github.io/Algorithm.html),
[awesome-fsrs wiki: The Algorithm](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm),
[rs-fsrs overview (DeepWiki)](https://deepwiki.com/open-spaced-repetition/rs-fsrs/3.1-fsrs-algorithm-overview),
[fsrs4anki repo](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler).

---

## 4. FSRS vs SM-2 — the evidence

From the open-spaced-repetition benchmark (~700M anonymized Anki reviews) and
community reports:

- **Accuracy:** FSRS-5 schedules to a 90% target with ~±5.3% deviation vs SM-2's
  ~±16.2%. FSRS gives better recall predictions for **~99.5%** of users tested.
- **Workload:** **~20–30% fewer reviews** at equal retention (published figures
  range 15–40% depending on deck/usage).
- **No ease hell:** FSRS has no ease factor, so hard cards can't get
  permanently stuck.
- **Handles delays well:** late reviews update stability correctly instead of
  being ad-hoc bonuses.
- **Improves over time:** re-optimizing on accumulated history sharpens the
  per-user fit; SM-2 is static.

Sources: [FSRS-5 vs SM-2 (Diane)](https://www.diane.app/en/guides/fsrs-vs-sm2),
[Comparison with SM-2 (DeepWiki)](https://deepwiki.com/open-spaced-repetition/fsrs-optimizer/7.3-comparison-with-sm-2),
[MemoForge FSRS vs SM-2 guide](https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/).

---

## 5. Recommendations for `learn-chinese`

1. **Use FSRS, not SM-2.** It's more accurate, lighter on the learner, open
   source, and avoids ease hell. The cost is more math, but mature libraries
   exist (`py-fsrs`, `fsrs-rs` (Rust), `ts-fsrs` (JS/TS), `go-fsrs`).
2. **Ship default parameters on day one.** Use FSRS-6 (or FSRS-5) defaults so
   new users get good scheduling before any personal data exists.
3. **Log every review** with: card id, timestamp, grade (1–4), elapsed days,
   and the pre-review `S`/`D`/`R`. This is exactly what the optimizer needs
   later — design the schema for it now.
4. **Expose only `desired retention`** to users (default 0.9). Hide the weights.
   Offer per-user re-optimization once a deck has ~hundreds of reviews
   (Anki recommends ~1,000+ for a stable fit).
5. **Chinese-specific considerations:**
   - A single hanzi often spawns multiple card types (recognition,
     production/handwriting, pinyin, tone, meaning). Treat each as its own
     card with independent S/D — they decay at different rates.
   - Consider modeling shared sub-components (radicals, shared characters in
     compounds) but keep scheduling per-card; cross-card "memory" is beyond
     stock FSRS and a research rabbit hole.
   - Tone and handwriting recall are typically _harder_ (lower initial S) than
     recognition — the per-card difficulty parameter captures this naturally.
6. **Keep a simple fallback.** If implementing FSRS in full is too much for an
   MVP, a clean SM-2 with a difficulty/scheduling split (to dodge ease hell)
   is acceptable — but plan to migrate.

---

## Sources

- [What spaced repetition algorithm does Anki use? — Anki FAQ](https://faqs.ankiweb.net/what-spaced-repetition-algorithm)
- [SuperMemo — Wikipedia (SM-2)](https://en.wikipedia.org/wiki/SuperMemo)
- [The true history of spaced repetition — SuperMemo](https://www.supermemo.com/en/blog/the-true-history-of-spaced-repetition)
- [Anki SRS algorithm deep-dive — Julien Sobczak](https://juliensobczak.com/inspect/2022/05/30/anki-srs/)
- [How Anki's built-in interval algorithm works — AnkiGenix](https://ankigenix.com/en/blog/anki-built-in-interval-algorithm)
- [The Anki SM-2 algorithm — RemNote](https://help.remnote.com/en/articles/6026144-the-anki-sm-2-spaced-repetition-algorithm)
- [A technical explanation of FSRS — Expertium](https://expertium.github.io/Algorithm.html)
- [The Algorithm — awesome-fsrs wiki](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)
- [FSRS algorithm overview — rs-fsrs (DeepWiki)](https://deepwiki.com/open-spaced-repetition/rs-fsrs/3.1-fsrs-algorithm-overview)
- [free-spaced-repetition-scheduler — GitHub](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler)
- [FSRS-5 vs SM-2 — Diane](https://www.diane.app/en/guides/fsrs-vs-sm2)
- [Comparison with SM-2 — fsrs-optimizer (DeepWiki)](https://deepwiki.com/open-spaced-repetition/fsrs-optimizer/7.3-comparison-with-sm-2)
- [FSRS vs SM-2 guide — MemoForge](https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/)
- [FSRS6 is more accurate in retention — Anki Forums](https://forums.ankiweb.net/t/fsrs6-is-more-accurate-in-retention/66275)
  </content>
  </invoke>
