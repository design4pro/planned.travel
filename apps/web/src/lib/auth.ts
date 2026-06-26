import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer, organization, twoFactor } from "better-auth/plugins";
import { createDb } from "@planned/db";
import type { CloudflareEnv } from "./env";

/**
 * Better Auth, configured for Astro (web) + Expo (mobile), backed by D1.
 *
 * INSTANTIATE PER REQUEST: the D1 binding only exists at request time, so call
 * `createAuth(env)` inside a handler — never at module scope. See PLANS.md §4.3.
 *
 * Migrations: Better Auth owns its tables (user/session/account/verification/
 * organization/member/passkey/twoFactor). Generate with the CLI against the
 * options below, then apply to D1:
 *   pnpm dlx @better-auth/cli generate --config src/lib/auth.ts --output ./migrations
 *   pnpm db:migrate:local   # wrangler d1 migrations apply --local
 */
export function createAuth(env: CloudflareEnv) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    database: drizzleAdapter(createDb(env.DB), { provider: "sqlite" }),

    emailAndPassword: { enabled: true },

    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
        ? {
            apple: {
              clientId: env.APPLE_CLIENT_ID,
              clientSecret: env.APPLE_CLIENT_SECRET,
            },
          }
        : {}),
    },

    // organizations = shared trips/teams (consumer), admin = RBAC,
    // twoFactor = TOTP + WebAuthn/passkey, bearer = Expo mobile sessions.
    plugins: [organization(), admin(), twoFactor(), bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
