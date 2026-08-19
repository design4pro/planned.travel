import { env } from 'cloudflare:workers'

/** The Worker environment, narrowed to what the auth layer consumes. */
export type AuthEnv = Cloudflare.Env

/**
 * Reads a required secret, failing loudly at the first request rather than
 * silently signing sessions with `undefined`.
 */
function requireSecret(name: 'BETTER_AUTH_SECRET'): string {
  const value = env[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `Missing ${name}. Set it with \`wrangler secret put ${name}\` (or in .dev.vars for local development).`,
    )
  }
  return value
}

/** Product name, used in auth UI copy, email templates and TOTP issuers. */
export const APP_NAME = 'planned.travel'

/** Origin the app is served from; every auth URL is built from this. */
export function appUrl(): string {
  const configured = env.APP_URL
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/+$/, '')
  }
  return 'http://localhost:3000'
}

export function authSecret(): string {
  return requireSecret('BETTER_AUTH_SECRET')
}

/** Relying-party id for WebAuthn: the registrable domain, without a port. */
export function relyingPartyId(): string {
  return new URL(appUrl()).hostname
}

/**
 * Trusted origins accepted by WebAuthn assertions and OAuth callbacks.
 *
 * In dev the loopback origins are wildcarded by port: `vite dev` silently falls
 * back to the next free port when its configured one is taken, and pinning the
 * list to a single port turns every auth request into a 403 "Invalid origin".
 * Production stays strict — only the configured `APP_URL` origin is trusted.
 */
export function trustedOrigins(): Array<string> {
  const configured = new URL(appUrl()).origin
  if (!import.meta.env.DEV) return [configured]
  return [...new Set([configured, 'http://localhost:*', 'http://127.0.0.1:*'])]
}

type ProviderCredentials = { clientId: string; clientSecret: string }

function credentials(
  clientId: string | undefined,
  clientSecret: string | undefined,
): ProviderCredentials | null {
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

/** Google OAuth credentials, or `null` when the provider is not configured. */
export function googleCredentials(): ProviderCredentials | null {
  return credentials(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
}

/** Apple OAuth credentials, or `null` when the provider is not configured. */
export function appleCredentials(): ProviderCredentials | null {
  return credentials(env.APPLE_CLIENT_ID, env.APPLE_CLIENT_SECRET)
}

export function appleBundleIdentifier(): string | undefined {
  return env.APPLE_APP_BUNDLE_IDENTIFIER
}

export function d1(): D1Database {
  return env.DB
}

export function sessionStore(): KVNamespace {
  return env.SESSIONS
}

export function taskQueue(): Queue<unknown> {
  return env.TASKS
}
