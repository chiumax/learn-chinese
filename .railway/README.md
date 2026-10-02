# Railway deployment

This project uses Railway Infrastructure as Code (not the deprecated
`railway.json` format) to define two services and one volume:

- `web`: the only public service; Next.js, Google sign-in, and the authenticated
  `/api/sync` proxy.
- `sync`: private-network-only Hono service; exactly one replica.
- `sync-data`: mounted at `/data`; SQLite lives at `/data/app.db`.

The browser never receives the private sync hostname or service credential.
Offline study still reads and writes IndexedDB; failed sync attempts leave the
outbox intact for the next online attempt.

## Required decisions and credentials

Set the confirmed two-address owner allowlist as a shared variable rather than
committing personal email addresses. Auth.js also requires Google's verified
email claim. Both accounts reach the same fixed `owner` identity in the private
sync service and therefore share one study dataset.

Create these Railway **shared variables** after that confirmation:

| Variable               | Requirement                                      |
| ---------------------- | ------------------------------------------------ |
| `AUTH_OWNER_EMAILS`    | Confirmed owner emails, comma-separated          |
| `AUTH_SECRET`          | Random secret of at least 32 characters          |
| `AUTH_GOOGLE_ID`       | Google OAuth web client ID                       |
| `AUTH_GOOGLE_SECRET`   | Matching Google OAuth client secret              |
| `INTERNAL_SYNC_SECRET` | Separate random secret of at least 32 characters |

In Google Cloud, create an OAuth 2.0 **Web application**. After Railway creates
the public web domain, set its authorized redirect URI to:

```text
https://<web-domain>/api/auth/callback/google
```

No Google API scopes beyond Auth.js's sign-in defaults are needed.

## Review before apply

1. The initial IaC source tracks the reviewed
   `codex/railway-private-app` branch. Move it to `main` after an explicitly
   approved merge.
2. Install/log in to Railway CLI and link the intended project/environment.
3. Add the four shared variables above without committing their values.
4. Run `railway config plan` and review the proposed two services plus one
   500 MB volume (the Trial plan maximum).
5. Only after explicit approval, run `railway config apply`.
6. Generate a Railway public domain for **web only**. Do not generate a domain
   or TCP proxy for `sync`.
7. Add the final web callback URI in Google Cloud, then redeploy `web` if its
   auth configuration changed.

## Post-deploy checks

```bash
curl -i https://<web-domain>/api/health
curl -i -X POST https://<web-domain>/api/sync \
  -H 'content-type: application/json' \
  --data '{"deviceId":"probe","cursor":0,"mutations":[]}'
```

The health request should return `200`. The unauthenticated sync request should
return `401`. Then sign in with the confirmed owner account, study a card,
sync, reload on another authenticated browser, and verify the change arrives.

Railway volumes cannot be used with replicas, so `sync` must remain at one
replica. Back up the volume before any destructive storage or schema change.
