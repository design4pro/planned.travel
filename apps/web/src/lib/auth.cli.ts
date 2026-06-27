/**
 * Introspection-only Better Auth instance for `@better-auth/cli generate`.
 *
 * NOT used at runtime. The CLI reads `auth.options` to emit the auth-tables
 * (user / session / account / verification / organization / member /
 * twoFactor / …) SQL; it never queries the database, so a no-op D1 shim + a
 * dummy secret suffice. Social providers are omitted here — they add rows to
 * `account`, not tables, so the generated schema is unaffected.
 *
 * Keep this in sync with auth.config.ts (the single source of options).
 */
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "./auth.config";
import type { CloudflareEnv } from "./env";

const shimEnv = {
  BETTER_AUTH_SECRET: "cli-introspect-only",
  APP_URL: "http://localhost",
  DB: {},
} as unknown as CloudflareEnv;

export const auth = betterAuth(buildAuthOptions(shimEnv));
