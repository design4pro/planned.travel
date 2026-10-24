/**
 * The day the whole e2e suite runs on, in one place.
 *
 * A dev server is told it per request (`x-pt-server-today`, `playwright.config.ts`); a build made
 * with `E2E_BUILD=1` has it folded in at compile time (`vite.config.ts`), because the production
 * guard in `src/server/clock.ts` drops the header branch from every build.
 */
export const FIXTURE_DAY = '2026-08-20'
