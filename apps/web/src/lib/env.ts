import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Zod-validated environment variables. Fails the build if anything required is
 * missing or malformed. See ARCHITECTURE.md §10.
 *
 * Browser code only sees the app name. Auth, the private sync host, and the
 * service credential remain server-only in the Next.js process.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AUTH_OWNER_EMAILS: z.string().min(1),
    AUTH_SECRET: z.string().min(32),
    AUTH_GOOGLE_ID: z.string().min(1),
    AUTH_GOOGLE_SECRET: z.string().min(1),
    SYNC_SERVER_HOST: z.string().min(1).default("127.0.0.1"),
    SYNC_SERVER_PORT: z.coerce.number().int().positive().default(4000),
    INTERNAL_SYNC_SECRET: z.string().min(32),
  },
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("learn-chinese"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_OWNER_EMAILS: process.env.AUTH_OWNER_EMAILS,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    SYNC_SERVER_HOST: process.env.SYNC_SERVER_HOST,
    SYNC_SERVER_PORT: process.env.SYNC_SERVER_PORT,
    INTERNAL_SYNC_SECRET: process.env.INTERNAL_SYNC_SECRET,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
  emptyStringAsUndefined: true,
});
