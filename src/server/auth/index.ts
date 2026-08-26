import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, organization, twoFactor } from 'better-auth/plugins'
import { drizzle } from 'drizzle-orm/d1'
import { nanoid } from 'nanoid'
import {
  PLATFORM_ACTIONS,
  PLATFORM_SYSTEM_ACTOR,
  appendPlatformAudit,
} from '#/server/catalog/audit'
import { authSchema } from '#/server/db/auth-schema'
import { createLogger } from '#/server/observability'
import { DISABLED_ADMIN_PATHS, adminOptions } from './admin-options'
import { authDb } from './db'
import { queueAuthEmail } from './email'
import {
  APP_NAME,
  appUrl,
  appleBundleIdentifier,
  appleCredentials,
  authSecret,
  d1,
  googleCredentials,
  relyingPartyId,
  sessionStore,
  trustedOrigins,
} from './env'
import { logAuth } from './log'
import { passkey } from './passkey/plugin'
import {
  provisionPersonalOrganization,
  resolveOrProvisionOrganization,
} from './provisioning'
import { createKvSecondaryStorage } from './secondary-storage'
import type { Database } from '#/server/db/types'
import type { Logger } from '#/server/observability'

export { APP_NAME } from './env'

/** Session lifetime and how often a live session is silently extended. */
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24

const VERIFICATION_TOKEN_TTL_SECONDS = 60 * 60 * 24
const RESET_TOKEN_TTL_SECONDS = 60 * 60
const INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7

/** Passwords: long enough to matter, short enough to be a real passphrase. */
export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 128

function socialProviders() {
  const providers: NonNullable<
    Parameters<typeof betterAuth>[0]['socialProviders']
  > = {}

  const google = googleCredentials()
  if (google) {
    providers.google = {
      ...google,
      prompt: 'select_account',
      // Ask for a refresh token so long-lived integrations keep working.
      accessType: 'offline',
    }
  }

  const apple = appleCredentials()
  if (apple) {
    providers.apple = {
      ...apple,
      appBundleIdentifier: appleBundleIdentifier(),
    }
  }

  return providers
}

/** Which social providers the sign-in screens should offer. */
export function enabledSocialProviders(): Array<'google' | 'apple'> {
  const enabled: Array<'google' | 'apple'> = []
  if (googleCredentials()) enabled.push('google')
  if (appleCredentials()) enabled.push('apple')
  return enabled
}

/* -------------------------------------------------------------------------------------------------
 * The ban tripwire (docs/ACCESS.md §4.3)
 * ---------------------------------------------------------------------------------------------- */

/**
 * The two endpoints that already write their own `platform_audit_log` row.
 *
 * `src/server/fns/console/*` is their only reachable caller — the HTTP paths answer `404`
 * (docs/ACCESS.md §2.6) — and it appends a `human` row naming the operator. Auditing them here as
 * well would double every deliberate ban in the ledger and attribute half of each one to nobody.
 */
const SELF_AUDITING_BAN_PATHS: ReadonlySet<string> = new Set([
  '/admin/ban-user',
  '/admin/unban-user',
])

type BanAuditAction =
  | typeof PLATFORM_ACTIONS.USER_BANNED
  | typeof PLATFORM_ACTIONS.USER_UNBANNED

/**
 * Ban changes seen in `update.before`, waiting for their row to commit.
 *
 * Keyed on the per-request endpoint context, which `getWithHooks` resolves once and hands to both
 * halves of the same update, so two concurrent requests cannot read each other's entry. Weak so a
 * request that dies between the two halves leaves nothing behind.
 */
const pendingBanAudit = new WeakMap<object, BanAuditAction>()

/**
 * The handle the tripwire writes `platform_audit_log` through.
 *
 * Deliberately not `authDb()`. That handle is bound to the Better Auth schema and `platform_audit_log`
 * is not one of its tables; `appendPlatformAudit` takes the same plain, schema-less {@link Database}
 * every repository takes, and giving it one keeps the global table off the auth-scoped handle. The
 * wrapper is stateless, so one per isolate is the whole cost.
 */
let platformDbInstance: Database | null = null

function platformDb(): Database {
  platformDbInstance ??= drizzle(d1())
  return platformDbInstance
}

/** The audit writer's logger. One per isolate; it holds no request state. */
let auditLoggerInstance: Logger | null = null

function auditLogger(): Logger {
  auditLoggerInstance ??= createLogger({ context: { component: 'auth' } })
  return auditLoggerInstance
}

/**
 * Which of the two ban verbs this update payload performs, or `null` for every other user update.
 *
 * Read off the payload rather than the row because `banned` is absent from a payload that does not
 * touch it, and absent is the whole signal.
 */
function banTransition(patch: Record<string, unknown>): BanAuditAction | null {
  if (!Object.hasOwn(patch, 'banned')) return null
  if (patch.banned === true) return PLATFORM_ACTIONS.USER_BANNED
  if (patch.banned === false) return PLATFORM_ACTIONS.USER_UNBANNED
  return null
}

function banStateOf(record: Record<string, unknown>): Record<string, unknown> {
  const expires = record.banExpires
  return {
    banned: record.banned === true,
    banReason: typeof record.banReason === 'string' ? record.banReason : null,
    banExpires:
      expires instanceof Date
        ? expires.toISOString()
        : typeof expires === 'string'
          ? expires
          : null,
  }
}

/**
 * Appends the `system` row for a ban change nothing else audits.
 *
 * There is exactly one such change in the product today and it is the reason this tripwire exists:
 * a *temporary* ban lifts itself. The `admin` plugin's `session.create.before` writes
 * `{ banned: false, banReason: null, banExpires: null }` on the next ordinary sign-in once
 * `banExpires` has passed, with no console call to hang an append on (docs/ACCESS.md §4.3, first
 * stated exception). Without this, the ban ledger would record every ban and only the deliberate
 * half of the unbans, which is the shape of an audit trail that quietly stops being one.
 *
 * It swallows every error it can raise, and that is a correctness requirement rather than caution.
 * `queueAfterTransactionHook` runs an `after` hook inline when no transaction is open, and no
 * endpoint on this stack opens one, so a rejection here surfaces to whoever called `auth.api.*` —
 * which for the auto-unban case is the user's own sign-in. A logging failure would become a
 * sign-in failure for an account whose ban has just expired.
 */
async function auditBanTransition(
  action: BanAuditAction,
  user: Record<string, unknown> & { id: string },
): Promise<void> {
  try {
    const after = banStateOf(user)
    await appendPlatformAudit(
      platformDb(),
      PLATFORM_SYSTEM_ACTOR,
      {
        action,
        entityId: user.id,
        changes: { before: { banned: after.banned !== true }, after },
      },
      auditLogger(),
    )
  } catch (cause) {
    logAuth('error', 'audit.ban-tripwire.failed', {
      userId: user.id,
      action,
      reason: cause instanceof Error ? cause.message : 'unknown',
    })
  }
}

function buildAuth() {
  const baseUrl = appUrl()
  const db = authDb()

  return betterAuth({
    appName: APP_NAME,
    baseURL: baseUrl,
    basePath: '/api/auth',
    secret: authSecret(),
    trustedOrigins: trustedOrigins(),

    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: authSchema,
      usePlural: false,
    }),

    // Sessions, OAuth state and rate-limit counters live at the edge in KV;
    // D1 remains the durable record so a KV miss degrades to a slower read
    // rather than a signed-out user.
    secondaryStorage: createKvSecondaryStorage(sessionStore()),

    // No `cookieCache`. A signed session snapshot in a cookie is the cheapest
    // possible read and it is also a five-minute window in which a banned or
    // demoted account keeps its old authority, because nothing re-reads the row
    // until the snapshot expires. `./session` asks for a fresh read explicitly
    // as well, so a caller reaching `auth.api.getSession` directly cannot
    // reintroduce the window by omission.
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      storeSessionInDatabase: true,
    },

    // The `admin` plugin's fifteen HTTP paths, closed (docs/ACCESS.md §2.6).
    // Top-level and a sibling of `plugins`: inside `admin({ … })` this is an
    // ignored extra property that closes nothing.
    disabledPaths: DISABLED_ADMIN_PATHS,

    // Single-use tokens are consumed transactionally in D1: KV's eventual
    // consistency is not a safe substrate for one-shot credentials.
    verification: { storeInDatabase: true },

    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await queueAuthEmail({
          kind: 'auth.reset-password',
          to: user.email,
          name: user.name,
          url,
          expiresInMinutes: RESET_TOKEN_TTL_SECONDS / 60,
        })
      },
      onPasswordReset: async ({ user }) => {
        logAuth('info', 'password.reset', { userId: user.id })
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
      sendVerificationEmail: async ({ user, url }) => {
        await queueAuthEmail({
          kind: 'auth.verify-email',
          to: user.email,
          name: user.name,
          url,
          expiresInMinutes: VERIFICATION_TOKEN_TTL_SECONDS / 60,
        })
      },
    },

    socialProviders: socialProviders(),

    account: {
      accountLinking: {
        enabled: true,
        // Only providers that assert a verified address may auto-link, so a
        // spoofed profile email cannot take over an existing account.
        trustedProviders: ['google', 'apple'],
      },
    },

    rateLimit: {
      enabled: true,
      storage: 'secondary-storage',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 300, max: 5 },
        '/request-password-reset': { window: 300, max: 5 },
        '/reset-password': { window: 300, max: 10 },
        '/send-verification-email': { window: 300, max: 5 },
        '/two-factor/verify-totp': { window: 60, max: 10 },
        '/two-factor/verify-backup-code': { window: 300, max: 5 },
        '/passkey/authenticate/verify': { window: 60, max: 20 },
        '/organization/accept-invitation': { window: 300, max: 20 },
      },
    },

    advanced: {
      cookiePrefix: 'planned',
      database: {
        // Short, URL-safe, collision-resistant ids, matching the rest of the app.
        generateId: () => nanoid(24),
      },
      defaultCookieAttributes: {
        sameSite: 'lax',
        httpOnly: true,
      },
    },

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const organizationId = await provisionPersonalOrganization(
              authDb(),
              { id: user.id, name: user.name, email: user.email },
            )
            logAuth('info', 'organization.provisioned', {
              userId: user.id,
              organizationId,
            })
          },
        },
        update: {
          // Half one of the ban tripwire: the update *payload* is the only place
          // the direction of the change is visible. `update.after` receives the
          // finished row, which cannot say whether this call is what moved
          // `banned` or merely a profile edit on an account that happens not to
          // be banned.
          before: async (data, context) => {
            if (!context) return
            const action = banTransition(data)
            if (action === null) return
            if (SELF_AUDITING_BAN_PATHS.has(context.path)) return
            pendingBanAudit.set(context, action)
          },
          after: async (user, context) => {
            if (!context) return
            const action = pendingBanAudit.get(context)
            if (action === undefined) return
            pendingBanAudit.delete(context)
            await auditBanTransition(action, user)
          },
        },
      },
      session: {
        create: {
          // Land every new session inside a tenant so no authenticated screen
          // ever has to cope with a null organization.
          before: async (session) => {
            const organizationId = await resolveOrProvisionOrganization(
              authDb(),
              session.userId,
            )
            if (!organizationId) return
            return { data: { ...session, activeOrganizationId: organizationId } }
          },
        },
      },
    },

    plugins: [
      // First in the array, deliberately. Plugin `databaseHooks` do not merge —
      // `runPluginInit` queues them in registration order and appends the user
      // hooks below last (`dist/context/helpers.mjs`) — so position decides who
      // sees a new session first. The `admin` plugin's `session.create.before`
      // is the ban check, and a banned account should be refused before any
      // other plugin, and before our own organization provisioning, does work on
      // its behalf. Nothing here replaces the hooks below; both run.
      admin(adminOptions),

      twoFactor({
        issuer: APP_NAME,
        totpOptions: { digits: 6, period: 30 },
        backupCodeOptions: { amount: 10, length: 10 },
        accountLockout: {
          enabled: true,
          maxFailedAttempts: 8,
          durationSeconds: 900,
        },
      }),

      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 20,
        membershipLimit: 100,
        creatorRole: 'owner',
        invitationLimit: 50,
        invitationExpiresIn: INVITATION_TTL_SECONDS,
        cancelPendingInvitationsOnReInvite: true,
        sendInvitationEmail: async (data) => {
          await queueAuthEmail({
            kind: 'auth.organization-invitation',
            to: data.email,
            invitedByName: data.inviter.user.name,
            invitedByEmail: data.inviter.user.email,
            organizationName: data.organization.name,
            role: data.role,
            url: `${baseUrl}/accept-invitation/${data.id}`,
            expiresInHours: INVITATION_TTL_SECONDS / 3600,
          })
        },
      }),

      passkey({
        relyingPartyId: relyingPartyId(),
        relyingPartyName: APP_NAME,
        origins: trustedOrigins(),
      }),
    ],

    onAPIError: {
      onError: (error) => {
        logAuth('error', 'api.error', {
          reason: error instanceof Error ? error.message : 'unknown',
        })
      },
    },
  })
}

export type Auth = ReturnType<typeof buildAuth>

let instance: Auth | null = null

/**
 * The Better Auth instance for this isolate.
 *
 * Built lazily and memoised: bindings are only available inside a request, and
 * rebuilding per request would re-read every binding and re-derive the adapter.
 */
export function getAuth(): Auth {
  instance ??= buildAuth()
  return instance
}
