import { defineConfig } from "drizzle-kit";

// For generating versioned SQL migrations later (`pnpm db:generate`). The
// runtime currently bootstraps the schema directly in db/client.ts.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DB_PATH ?? "data/app.db" },
});
