import { betterAuth } from "better-auth";
import { buildAuthOptions } from "./auth.config";
import type { CloudflareEnv } from "./env";

/**
 * Better Auth, configured for TanStack Start (web) + Expo (mobile), backed by D1.
 *
 * INSTANTIATE PER REQUEST: the D1 binding only exists at request time, so call
 * `createAuth(env)` inside a handler — never at module scope. See PLANS.md §4.3.
 *
 * Options live in auth.config.ts (shared with the CLI). Generate the auth
 * schema with the CLI against auth.cli.ts, then apply to D1:
 *   pnpm --filter @planned/web exec better-auth generate \
 *     --config src/lib/auth.cli.ts --output ./migrations --y
 *   pnpm db:migrate:local
 */
export function createAuth(env: CloudflareEnv) {
  return betterAuth(buildAuthOptions(env));
}

export type Auth = ReturnType<typeof createAuth>;
