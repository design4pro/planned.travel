import { defineConfig } from "drizzle-kit";

// D1 is SQLite under the hood. drizzle-kit generates SQL migrations into
// apps/web/migrations so `wrangler d1 migrations apply` can consume them.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "../../apps/web/migrations",
  dialect: "sqlite",
});
