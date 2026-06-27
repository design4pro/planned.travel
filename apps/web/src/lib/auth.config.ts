import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer, organization, twoFactor } from "better-auth/plugins";
import { createDb } from "@planned/db";
import type { CloudflareEnv } from "./env";

/**
 * Better Auth options, shared by the runtime factory (auth.ts) and the
 * @better-auth/cli introspection instance (auth.cli.ts). Keeping options in one
 * place guarantees the generated auth-tables migration matches the app config.
 *
 * Plugins: organizations (shared trips/teams), admin (RBAC), twoFactor
 * (TOTP + WebAuthn/passkey — passkey is part of twoFactor in 1.6), bearer
 * (Expo mobile sessions). Social providers are conditional on env.
 */
export function buildAuthOptions(env: CloudflareEnv): BetterAuthOptions {
  return {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    database: drizzleAdapter(createDb(env.DB), { provider: "sqlite" }),

    emailAndPassword: { enabled: true },

    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {}),
      ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
        ? { apple: { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET } }
        : {}),
    },

    plugins: [organization(), admin(), twoFactor(), bearer()],
  };
}
