import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index";

export type Database = ReturnType<typeof createDb>;

/**
 * Build a per-request Drizzle client from the D1 binding.
 *
 * Important (Better Auth on Workers): the D1 binding is only available at
 * request time, not at module init. Always call this inside a handler with
 * the live `env.DB` binding — never cache it in a module-level variable.
 */
export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema });
}
