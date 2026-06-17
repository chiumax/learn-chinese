# learn-chinese

An offline-first, local-first spaced-repetition app for learning Chinese,
scheduled with [FSRS](./docs/anki-algorithm-research.md).

## Monorepo layout

pnpm workspace with three packages:

```
apps/
  web/        # Next.js 16 client (offline-first; Dexie/IndexedDB is the local store)
  server/     # standalone Hono sync server (not serverless) + better-sqlite3 + Drizzle
packages/
  shared/     # FSRS scheduler, domain types, Zod sync DTOs — used by web AND server
```

The **scheduler lives in `shared`** because it must run on both sides: the
client schedules during study, and the server _replays_ it to resolve
multi-device conflicts. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full
design and [`docs/anki-algorithm-research.md`](./docs/anki-algorithm-research.md)
for why FSRS.

## Getting started

```bash
pnpm install
pnpm dev            # runs web (:3000) and server (:4000) together
```

- Web alone: `pnpm dev:web` · Server alone: `pnpm dev:server`
- The app seeds a demo deck on first run and works fully offline; reviews land
  in IndexedDB and queue in an outbox. When the server is reachable, the client
  pushes the outbox and pulls changes (`POST /sync`).

## Scripts (root)

| Command          | Description                                        |
| ---------------- | -------------------------------------------------- |
| `pnpm dev`       | Run web + server in parallel                       |
| `pnpm build`     | Build every package (web uses webpack for Serwist) |
| `pnpm test`      | Run all package tests                              |
| `pnpm typecheck` | Typecheck every package                            |
| `pnpm lint`      | Lint the web app                                   |
| `pnpm format`    | Prettier across the repo                           |

## Data & sync model

- **Client truth:** Dexie/IndexedDB. Study never needs the network.
- **Server:** SQLite (better-sqlite3 + Drizzle), a long-lived Node process.
- **Reviews** are immutable, conflict-free events; **decks/notes/cards** are
  last-write-wins; a card's schedule is **derived** by replaying its review log.
- Sync is push/pull with a monotonic cursor and per-mutation idempotency.

## Status

Working end-to-end: offline study loop + multi-device sync against the local
SQLite server. Not yet built: real auth (server is single-user for now),
parameter optimization, deck/note authoring UI, audio, handwriting. See
`ARCHITECTURE.md` §11.
