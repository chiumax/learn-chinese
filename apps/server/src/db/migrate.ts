import { createDb } from "./client";

// Initialize the database file and ensure the schema exists. Safe to re-run.
const path = process.env.DB_PATH ?? "data/app.db";
createDb(path);
console.log(`Initialized database at ${path}`);
