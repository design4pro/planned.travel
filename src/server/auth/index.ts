import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization, twoFactor } from 'better-auth/plugins'
import { nanoid } from 'nanoid'
import { authSchema } from '#/server/db/auth-schema'
import { authDb } from './db'
import { queueAuthEmail } from './email'
import {
  APP_NAME,
  appUrl,
  appleBundleIdentifier,
  appleCredentials,
  authSecret,
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

export { APP_NAME } from './env'

/** Session lifetime and how often a live session is silently extended. */
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24
/** Signed session snapshot in a cookie, so the hot path skips KV and D1. */
const SESSION_COOKIE_CACHE_SECONDS = 60 * 5

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

    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: true,
        maxAge: SESSION_COOKIE_CACHE_SECONDS,
      },
    },

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
