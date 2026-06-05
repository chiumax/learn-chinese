# learn-chinese

An offline-first, local-first spaced-repetition app for learning Chinese,
scheduled with [FSRS](./docs/anki-algorithm-research.md).

## Stack

- **Next.js 16** (App Router) + **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui**
- **TanStack Query** (server/async state) + **Zustand** (session/UI state) + **nuqs** (URL state)
- **Dexie** (IndexedDB) as the local source of truth
- **Serwist** for the offline PWA app shell
- **ts-fsrs** for scheduling · **Drizzle** + Postgres for the sync backend
- **Vitest** + Testing Library for tests

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design, and
[`docs/anki-algorithm-research.md`](./docs/anki-algorithm-research.md) for the
algorithm research behind the scheduler choice.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The app seeds a small demo deck on first run, so you can study immediately with
no backend. Reviews are written to IndexedDB and queued in an outbox for sync.

## Scripts

| Command           | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `pnpm dev`        | Start the dev server                                  |
| `pnpm build`      | Production build (uses webpack — required by Serwist) |
| `pnpm test`       | Run unit tests once                                   |
| `pnpm test:watch` | Watch mode                                            |
| `pnpm typecheck`  | `tsc --noEmit`                                        |
| `pnpm lint`       | ESLint                                                |
| `pnpm format`     | Prettier                                              |

## Project layout

```
src/
  app/                 # routes, layout, service worker (sw.ts), manifest
  components/
    ui/                # shadcn components
    study/             # Flashcard, GradeBar, StudyView
    providers.tsx      # React Query / nuqs / Toaster
  hooks/               # React Query hooks
  lib/
    srs/               # ts-fsrs wrapper (pure, fully tested)
    db/                # Dexie schema, repository, seed
    types.ts           # domain model
    env.ts             # Zod-validated env
  stores/              # Zustand stores
```

## Status

Vertical slice: study loop works offline against the local DB. Not yet built:
the sync engine + server (`/api/sync`, Drizzle schema), auth, and parameter
optimization. See the "open questions" in `ARCHITECTURE.md`.
