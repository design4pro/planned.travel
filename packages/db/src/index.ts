/**
 * @planned/db — Drizzle ORM schema + helpers for Cloudflare D1.
 *
 * The schema is authored against SQLite (D1) but kept portable to Postgres
 * (no SQLite-only types in hot paths) so we can move to Postgres + Hyperdrive
 * later without a rewrite. See PLANS.md §2 (data layer decision).
 */

export * from "./schema/index";
export { createDb, type Database } from "./client";
