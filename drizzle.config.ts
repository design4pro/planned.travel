import { defineConfig } from 'drizzle-kit'

/**
 * Migrations are generated into `./drizzle` and applied to D1 with
 * `wrangler d1 migrations apply planned-travel-db` (see the `db:migrate:*` scripts).
 *
 * Both schema files are listed explicitly rather than going through `src/server/db/index.ts`, so
 * that generation never depends on the barrel's re-export order.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: ['./src/server/db/auth-schema.ts', './src/server/db/schema.ts'],
  out: './drizzle',
  strict: true,
  verbose: true,
})
