# Architecture — `learn-chinese`

> An offline-first, local-first spaced-repetition app for learning Chinese.
> Status: design doc (greenfield). Last updated 2026-06-05.
>
> Companion doc: [`docs/anki-algorithm-research.md`](./docs/anki-algorithm-research.md)
> — why we use FSRS for scheduling.

---

## 1. Goals & principles

1. **Offline-first.** A full review session must work with zero network — on
   a subway, a plane, a dead-zone. The network is an _enhancement_, not a
   requirement.
2. **Local-first data.** The client's local database is the source of truth
   for the active session. The server is a durable backup + multi-device sync
   point, not a hard dependency for day-to-day use.
3. **Type safety end-to-end.** TypeScript `strict`, Zod at every boundary
   (API, forms, env, DB rows).
4. **Server state vs client state stay separate.** Never copy server data into
   a client state store; each tool owns one concern (see §6).
5. **Scheduling is a pure, testable module.** FSRS logic has no I/O — it takes
   state in and returns state out, so it runs identically on client and server.
6. **Event-sourced reviews.** A review is an immutable, append-only event.
   Card scheduling state is _derived_ from the review log, which makes sync
   conflict-resistant (see §5.3).

---

## 2. Tech stack

Status legend: ✅ in use · 🔜 planned (dependency added only when its first
feature lands, to avoid dead dependencies).

| Concern              | Choice                                           | Status | Notes                                                     |
| -------------------- | ------------------------------------------------ | ------ | --------------------------------------------------------- |
| Framework            | **Next.js (App Router)**                         | ✅     | RSC for static pages; client components for the study app |
| Language             | **TypeScript** (`strict`)                        | ✅     |                                                           |
| Styling              | **Tailwind CSS** + `clsx` + `tailwind-merge`     | ✅     | `cva` for component variants                              |
| Components           | **shadcn/ui**                                    | ✅     | We own the component source                               |
| Icons                | **lucide-react**                                 | ✅     | shadcn default                                            |
| Server state         | **TanStack Query** (React Query)                 | ✅     | Async gateway to local data; will orchestrate sync        |
| Client/UI state      | **Zustand**                                      | ✅     | Review-session state, ephemeral UI only                   |
| URL state            | **nuqs**                                         | ✅     | Adapter wired; deck/filter params to come                 |
| Local DB             | **Dexie** (IndexedDB)                            | ✅     | Local-first source of truth on the client                 |
| Service worker / PWA | **Serwist**                                      | ✅     | App-shell caching (maintained successor to next-pwa)      |
| Scheduling           | **`ts-fsrs`**                                    | ✅     | FSRS; pure wrapper in `lib/srs`, runs client-side         |
| Validation           | **Zod**                                          | ✅     | Env today; shared client/server schemas as the API grows  |
| Env validation       | **`@t3-oss/env-nextjs`**                         | ✅     | Imported in `next.config.ts`, validated at build          |
| Animation            | **`motion`** (framer-motion)                     | ✅     | Card flip; swipe-to-grade to come                         |
| Toasts               | **sonner**                                       | ✅     | shadcn-friendly                                           |
| Unit/component tests | **Vitest** + **React Testing Library**           | ✅     | `lib/srs` + component tests                               |
| Quality              | **ESLint**, **Prettier**, **Husky**, lint-staged | ✅     | Pre-commit gate + CI                                      |
| Server ORM           | **Drizzle ORM**                                  | 🔜     | For the sync backend                                      |
| Server DB            | **Postgres** (Neon / Supabase)                   | 🔜     | Serverless-friendly                                       |
| API layer            | **Server Actions** + Route Handlers              | 🔜     | `/api/sync`; mutations as actions                         |
| Auth                 | **Auth.js (NextAuth v5)**                        | 🔜     | Gates sync, not study                                     |
| Forms                | **react-hook-form** + Zod resolver               | 🔜     | Deck/note authoring UI                                    |
| Charts               | **recharts**                                     | 🔜     | Review heatmap, retention forecast                        |
| E2E tests            | **Playwright**                                   | 🔜     | Offline review-flow scenario                              |

---

## 3. High-level architecture

```
┌───────────────────────────────────────────────────────────────┐
│                          Browser (PWA)                          │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐     │
│  │  UI (React) │   │  Zustand     │   │  nuqs (URL state) │     │
│  │  shadcn/ui  │◄─►│  session/UI  │   └───────────────────┘     │
│  └──────┬──────┘   └──────────────┘                             │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐        ┌────────────────────────────┐     │
│  │  TanStack Query │◄──────►│  Dexie (IndexedDB)          │     │
│  │  (cache + sync) │        │  SOURCE OF TRUTH locally    │     │
│  └────────┬────────┘        │  decks/notes/cards/reviews  │     │
│           │                 │  + outbox (mutation queue)  │     │
│           │                 └─────────────┬──────────────┘     │
│           │                               │                    │
│   ┌───────▼────────┐              ┌────────▼─────────┐         │
│   │  ts-fsrs       │              │  Sync Engine     │         │
│   │  (scheduler)   │              │  push/pull       │         │
│   └────────────────┘              └────────┬─────────┘         │
│                                            │                    │
│  ┌──────────────────────────────────────┐ │                    │
│  │  Serwist service worker (app shell)  │ │                    │
│  └──────────────────────────────────────┘ │                    │
└────────────────────────────────────────────┼───────────────────┘
                                              │  (online only)
                                              ▼
                          ┌─────────────────────────────────┐
                          │  Next.js server                 │
                          │  Route Handlers: /api/sync       │
                          │  Server Actions: auth, authoring │
                          │  Drizzle ──► Postgres            │
                          └─────────────────────────────────┘
```

---

## 4. The offline-first model in one paragraph

The app **reads and writes exclusively to Dexie (IndexedDB)** during normal
use. Every state-changing action (grade a card, edit a note, create a deck) is
written locally _and_ appended to an **outbox** queue. A **sync engine** drains
the outbox to the server when online and pulls remote changes back. Because the
scheduler (`ts-fsrs`) runs in the browser, a study session never touches the
network. The **Serwist** service worker caches the app shell and static assets
so the app loads with no connection at all. If the user never logs in, the app
still works fully — it just won't sync across devices.

---

## 5. Data architecture

### 5.1 Entities

```
Deck      (id, name, config, createdAt, updatedAt, deletedAt?)
Note      (id, deckId, fields{hanzi, pinyin, meaning, audio…}, tags, …)
Card      (id, noteId, deckId, template: recognition|production|tone|writing,
           fsrs: { stability, difficulty, due, lastReview, state, reps, lapses })
ReviewLog (id, cardId, ts, deviceId, grade(1-4), durationMs,
           elapsedDays, scheduledDays, prevState, snapshot of S/D/R)
```

Notes hold the _content_; Cards are individual study items generated from a
note (one hanzi → recognition, production, tone, and handwriting cards, which
decay at different rates — FSRS tracks each independently). See the research
doc, §5.

### 5.2 Two kinds of writeable data

- **Immutable events** → `ReviewLog`. Append-only. Never edited or deleted.
- **Mutable documents** → `Deck`, `Note`, `Card` content. Edited in place.

This split is what makes sync tractable.

### 5.3 Conflict resolution

- **Review logs are conflict-free.** They're immutable and uniquely keyed by
  `(cardId, ts, deviceId)`. Sync = set union. No conflicts possible.
- **Card scheduling state is _derived_, not synced as truth.** On conflict
  (same card reviewed on two offline devices), the server re-runs FSRS over the
  merged, time-ordered review log to recompute the canonical `stability /
difficulty / due`. The scheduler being a pure function makes this
  deterministic and replayable.
- **Mutable content (notes/decks)** uses **last-write-wins** by `updatedAt`
  with a `deletedAt` tombstone for soft deletes. Content edits are rare and
  low-stakes compared to reviews, so LWW is acceptable for v1. (A field-level
  merge or CRDT is a possible future upgrade — explicitly out of scope now.)

### 5.4 Sync protocol

Pull-then-push, driven by a logical clock / `updatedAt` cursor per entity:

```
POST /api/sync
  body: { since: <cursor>, outbox: [ ...local mutations ] }
  →    { changes: [ ...server mutations since cursor ], cursor: <new> }
```

- Client applies server `changes` to Dexie, then marks outbox items acked.
- Trigger points: app focus/online event, after each review batch, periodic
  background sync (where supported), manual "sync now".
- TanStack Query orchestrates the request lifecycle, retries, and backoff.
- The outbox makes mutations **idempotent**: each carries a client-generated
  ULID so replays are deduped server-side.

### 5.5 IDs

Use **ULID/UUIDv7** generated **client-side** for all entities, so offline
creates never collide and don't need a server round-trip to get an id.

---

## 6. State management — who owns what

| State                     | Tool                                         | Examples                                                  |
| ------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Persistent domain data    | **Dexie** (local truth) → synced to Postgres | decks, notes, cards, review logs                          |
| Async access to that data | **TanStack Query**                           | `useDueCards()`, `useDeck(id)`, sync mutations            |
| Ephemeral session/UI      | **Zustand**                                  | current card index, is-flipped, answer-shown, study timer |
| URL-addressable state     | **nuqs**                                     | `?deck=...&filter=due`, current route params              |

Rule: **server/persistent data is never duplicated into Zustand.** Zustand only
holds things that vanish when you close the tab.

---

## 7. FSRS integration

- `lib/srs/` wraps `ts-fsrs` behind our own thin interface so the rest of the
  app never imports the library directly (swap-ability + testability).
- **Pure functions only:** `schedule(card, grade, now) → { card', reviewLog }`.
  No I/O, no Dexie, no fetch. This is what lets the server replay it (§5.3).
- Ship **default FSRS-6 parameters** so new users get good scheduling with zero
  data. Store parameters per-user (and optionally per-deck).
- **Optimization** (re-fitting weights to a user's history) runs server-side as
  a background job once a deck has enough reviews (~1k+; see research doc). The
  client just fetches updated weights on next sync.
- Single user-facing knob: **desired retention** (default 0.9).

---

## 8. Folder structure (proposed)

```
src/
  app/                    # Next.js App Router
    (marketing)/          # RSC static pages
    (app)/                # the authenticated/study app (client-heavy)
      study/
      decks/
      stats/
    api/
      sync/route.ts       # sync endpoint (Route Handler)
  components/
    ui/                   # shadcn components
    study/                # Flashcard, GradeBar, Flip, etc.
  lib/
    db/
      dexie.ts            # local schema + migrations
      schema.ts           # Drizzle (server) schema
    srs/                  # ts-fsrs wrapper (pure)
    sync/                 # outbox + sync engine
    validators/           # Zod schemas (shared client/server)
    env.ts                # t3-env
  stores/                 # Zustand stores
  hooks/                  # React Query hooks
  server/
    actions/              # Server Actions
    auth/                 # Auth.js config
```

---

## 9. Testing strategy

- **Unit (Vitest):** the `lib/srs` scheduler (deterministic, table-driven cases)
  and the sync merge/conflict logic — the two highest-risk modules.
- **Component (RTL):** Flashcard flip, grade buttons, deck forms.
- **E2E (Playwright):** the full review loop, including an **offline scenario**
  (toggle `context.setOffline(true)`, grade cards, go online, assert sync).
- The pure-function design of FSRS + event-sourced reviews makes the core
  exhaustively testable without mocks.

---

## 10. Tooling & quality gates

- ESLint + Prettier; Husky pre-commit running `lint-staged` (typecheck + lint
  on staged files).
- `tsc --noEmit` in CI; Playwright + Vitest in CI.
- `@t3-oss/env-nextjs` fails the build on missing/invalid env vars.

---

## 11. Decisions made & open questions

**Decided**

- Offline-first + local-first (Dexie as local truth).
- FSRS (not SM-2) for scheduling — see research doc.
- Event-sourced reviews; derived scheduling state; LWW for content.

**Open / future**

- Audio (TTS vs recorded) and storage/caching strategy for offline playback.
- Handwriting recognition for the `writing` card type (on-device model?).
- CRDT/field-level merge for note editing if multi-device content conflicts
  become real.
- Shared sub-component memory (radicals / shared characters) — beyond stock
  FSRS; research rabbit hole, deferred.
- Background re-optimization job infra (cron vs queue).

```

```
