import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Zod-validated environment variables. Fails the build if anything required is
 * missing or malformed. See ARCHITECTURE.md §10.
 *
 * DATABASE_URL is optional for now so the app runs fully offline/local without
 * a configured server. Make it required once the sync backend is wired up.
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("learn-chinese"),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
  emptyStringAsUndefined: true,
});
