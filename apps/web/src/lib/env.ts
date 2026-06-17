import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Zod-validated environment variables. Fails the build if anything required is
 * missing or malformed. See ARCHITECTURE.md §10.
 *
 * The app runs fully offline without a server; sync targets NEXT_PUBLIC_SYNC_URL
 * (the standalone @learn-chinese/server) when reachable.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("learn-chinese"),
    NEXT_PUBLIC_SYNC_URL: z.string().url().default("http://localhost:4000"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SYNC_URL: process.env.NEXT_PUBLIC_SYNC_URL,
  },
  emptyStringAsUndefined: true,
});
