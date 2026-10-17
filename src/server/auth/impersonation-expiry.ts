/**
 * What keeps an impersonated session inside the 900 seconds docs/ACCESS.md §6.2 states.
 *
 * `impersonateUser` mints the session with `expiresAt = now + 900 s`, but Better Auth's sliding
 * refresh (`updateAge`) rewrites `expiresAt` to `now + expiresIn` (30 days) on the first read of a
 * session older than `updateAge` - and a 900-second session always is. The one thing that skips the
 * refresh is the signed `dont_remember` cookie, which the client supplies: a holder of the session
 * token who leaves that cookie out extends the impersonation to 30 days. Two halves close it, and
 * neither replaces the other:
 *
 * - {@link clampSessionExpiry} runs in the session `update.before` hook, so the refresh can never
 *   move an impersonated session's expiry later than it already is;
 * - {@link isImpersonationExpired} runs on the read the server functions use, so a row that was
 *   already extended before this shipped stops authorising at once;
 * - {@link impersonationCookieGuard} drops the persistent session-token cookie the library would
 *   otherwise re-issue with a 30-day `Max-Age` on that same refresh.
 *
 * Binding-free on purpose, like `./tenant` and `./admin-options`: both are unit-testable in plain
 * Node, and `./admin-options` is the single owner of the duration.
 */
import { createAuthMiddleware } from 'better-auth/api'
import { IMPERSONATION_SESSION_SECONDS } from './admin-options'
import type { BetterAuthPlugin } from 'better-auth'

const IMPERSONATION_MS = IMPERSONATION_SESSION_SECONDS * 1000

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : null
  }
  return null
}

/**
 * True when an impersonated session is older than the impersonation duration, whatever its stored
 * `expiresAt` says. An ordinary session (`impersonatedBy` null) is never judged here, and an
 * impersonated one with no usable `createdAt` is expired: it cannot be shown to be inside the bound.
 */
export function isImpersonationExpired(
  session: { impersonatedBy: string | null; createdAt: unknown },
  now: Date = new Date(),
): boolean {
  if (session.impersonatedBy === null) return false
  const createdAt = asDate(session.createdAt)
  if (createdAt === null) return true
  return createdAt.getTime() + IMPERSONATION_MS <= now.getTime()
}

/**
 * The `expiresAt` an `update.before` hook should force onto a session update, or `undefined` to
 * leave the patch alone.
 *
 * - A patch that does not carry `expiresAt` (organisation set-active, update-session) is left alone.
 * - The session being updated is `stored`, resolved by the caller from the endpoint context. An
 *   ordinary session is left alone; an impersonated one keeps `min(stored expiry, createdAt + 900 s)`.
 * - A patch that moves `expiresAt` for a session that cannot be resolved fails closed:
 *   `{ expiresAt: undefined }` removes the key from the merged patch, so nothing is extended.
 */
export function clampSessionExpiry(
  patch: Record<string, unknown>,
  stored: Record<string, unknown> | null,
): { expiresAt: Date | undefined } | undefined {
  if (!Object.hasOwn(patch, 'expiresAt')) return undefined
  if (stored === null) return { expiresAt: undefined }
  if (
    typeof stored.impersonatedBy !== 'string' ||
    stored.impersonatedBy === ''
  ) {
    return undefined
  }

  const expiresAt = asDate(stored.expiresAt)
  const createdAt = asDate(stored.createdAt)
  if (expiresAt === null || createdAt === null) return { expiresAt: undefined }

  const deadline = createdAt.getTime() + IMPERSONATION_MS
  return { expiresAt: new Date(Math.min(expiresAt.getTime(), deadline)) }
}

/**
 * Drops the session-token `Set-Cookie` the refresh adds to a `get-session` answer for an
 * impersonated session. The refresh is declined by {@link clampSessionExpiry}, so the browser's
 * existing cookie is still right and a new one with `Max-Age` of 30 days would only outlive its row.
 */
export const impersonationCookieGuard: BetterAuthPlugin = {
  id: 'impersonation-cookie-guard',
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === '/get-session',
        handler: createAuthMiddleware(async (ctx) => {
          const worn =
            ctx.context.newSession?.session ?? ctx.context.session?.session
          if (typeof worn?.impersonatedBy !== 'string') return

          const headers = ctx.context.responseHeaders
          if (!headers) return
          const cookieName = ctx.context.authCookies.sessionToken.name
          const kept = headers
            .getSetCookie()
            .filter((entry) => !entry.startsWith(`${cookieName}=`))
          headers.delete('set-cookie')
          for (const entry of kept) headers.append('set-cookie', entry)
        }),
      },
    ],
  },
}
