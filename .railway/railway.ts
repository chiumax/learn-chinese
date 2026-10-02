import { defineRailway, github, project, service, volume } from "railway/iac";

export default defineRailway((ctx) => {
  const syncData = volume("sync-data", { sizeMB: 512 });

  const sync = service("sync", {
    source: github("chiumax/learn-chinese", {
      branch: "codex/railway-private-app",
    }),
    build: {
      buildCommand: "pnpm --filter @learn-chinese/server build",
      watchPatterns: [
        "/apps/server/**",
        "/packages/shared/**",
        "/package.json",
        "/pnpm-lock.yaml",
        "/pnpm-workspace.yaml",
      ],
    },
    start: "pnpm --filter @learn-chinese/server start",
    healthcheck: "/health",
    healthcheckTimeout: 30,
    replicas: 1,
    volumeMounts: { "/data": syncData },
    env: {
      PORT: "4000",
      DB_PATH: "/data/app.db",
      INTERNAL_SYNC_SECRET: ctx.shared.INTERNAL_SYNC_SECRET,
    },
  });

  const web = service("web", {
    source: github("chiumax/learn-chinese", {
      branch: "codex/railway-private-app",
    }),
    build: {
      buildCommand: "pnpm --filter @learn-chinese/web build",
      watchPatterns: [
        "/apps/web/**",
        "/packages/shared/**",
        "/package.json",
        "/pnpm-lock.yaml",
        "/pnpm-workspace.yaml",
      ],
    },
    start: "pnpm --filter @learn-chinese/web start",
    healthcheck: "/api/health",
    healthcheckTimeout: 30,
    replicas: 1,
    env: {
      AUTH_OWNER_EMAILS: ctx.shared.AUTH_OWNER_EMAILS,
      AUTH_SECRET: ctx.shared.AUTH_SECRET,
      AUTH_GOOGLE_ID: ctx.shared.AUTH_GOOGLE_ID,
      AUTH_GOOGLE_SECRET: ctx.shared.AUTH_GOOGLE_SECRET,
      AUTH_TRUST_HOST: "true",
      INTERNAL_SYNC_SECRET: ctx.shared.INTERNAL_SYNC_SECRET,
      SYNC_SERVER_HOST: sync.env.RAILWAY_PRIVATE_DOMAIN,
      SYNC_SERVER_PORT: sync.env.PORT,
      NEXT_PUBLIC_APP_NAME: "learn-chinese",
    },
  });

  return project("learn-chinese", {
    resources: [web, sync, syncData],
  });
});
