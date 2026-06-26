import { createDb } from "@planned/db";
import type { CloudflareEnv } from "./env";

/** Per-request Drizzle client bound to the live D1 database. */
export function db(env: CloudflareEnv) {
  return createDb(env.DB);
}
