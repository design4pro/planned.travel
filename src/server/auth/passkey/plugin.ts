/**
 * Passkey (WebAuthn) support as a first-party Better Auth plugin.
 *
 * Better Auth 1.7 ships no passkey plugin and no WebAuthn library is present in
 * the dependency set, so the relying-party ceremonies live here, implemented on
 * WebCrypto in `./webauthn`. Challenges are single-use rows in Better Auth's own
 * `verification` table, consumed atomically, so a challenge can never be
 * replayed even across concurrent requests.
 */
import { createAuthEndpoint, sessionMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import * as z from 'zod'
import { MAX_PASSKEYS_PER_USER } from '#/lib/auth/passkey-limit'
import type { BetterAuthPlugin } from 'better-auth'
import {
  base64UrlDecode,
  base64UrlEncode,
  utf8Decode,
  utf8Encode,
} from './bytes'
import {
  createChallenge,
  verifyAuthentication,
  verifyRegistration,
} from './webauthn'
import { SUPPORTED_COSE_ALGORITHMS } from './cose'

/** How long a WebAuthn ceremony may stay open. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000
const CHALLENGE_PREFIX = 'passkey-challenge:'

/**
 * The ceiling is `MAX_PASSKEYS_PER_USER`, shared with the screen that words it. The count and the
 * write are two statements, so ceremonies that all pass the count before the first one writes can
 * all finish: a burst overshoots by what the registration rate limit lets each address involved
 * start in its window (10 per 300 s, per address and not per user). That is a known property of a ceiling that bounds storage
 * and is not a quota anyone sells; the list reads newest first, so the rows that could fall past
 * its `limit` are the oldest.
 */
export { MAX_PASSKEYS_PER_USER }

/**
 * Registration is the dangerous half of a sign-in factor. Better Auth's limiter keys on address
 * and path, never on the user, so these bound attempts from one client and the per-user ceiling
 * above still bounds what a person can end up holding.
 */
const REGISTRATION_RATE_LIMIT = { window: 300, max: 10 } as const
const REGISTRATION_PATHS: ReadonlySet<string> = new Set([
  '/passkey/register/options',
  '/passkey/register/verify',
])

/** A rename changes what a person sees in a list, so it gets the tighter budget of the two. */
const RENAME_RATE_LIMIT = { window: 300, max: 5 } as const
const RENAME_PATH = '/passkey/rename'

/** Stable refusal codes. The screen renders catalogue text chosen by code, never `message`. */
export const PASSKEY_ERROR_CODES = {
  limitReached: 'PASSKEY_LIMIT_REACHED',
  sessionNotFresh: 'PASSKEY_SESSION_NOT_FRESH',
  impersonated: 'PASSKEY_IMPERSONATED',
  notFound: 'PASSKEY_NOT_FOUND',
} as const

export type PasskeyPluginOptions = {
  /** Relying-party id — the registrable domain, no scheme and no port. */
  relyingPartyId: string
  /** Human-readable relying-party name shown by the authenticator. */
  relyingPartyName: string
  /** Origins an assertion may come from. */
  origins: ReadonlyArray<string>
}

type StoredPasskey = {
  id: string
  name: string | null
  userId: string
  credentialId: string
  publicKey: string
  algorithm: number
  counter: number
  deviceType: string
  backedUp: boolean
  transports: string | null
  aaguid: string | null
  createdAt: Date
  lastUsedAt: Date | null
}

type Ceremony = { ceremony: 'register' | 'authenticate'; userId?: string }

const registrationCredentialSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
    transports: z.array(z.string()).optional(),
  }),
})

const authenticationCredentialSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().nullish(),
  }),
})

const pubKeyCredParams = SUPPORTED_COSE_ALGORITHMS.map((alg) => ({
  type: 'public-key' as const,
  alg,
}))

type RefusalStatus = 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND'

type RefusalContext = {
  error: (
    status: RefusalStatus,
    body: { code: string; message: string },
  ) => Error
}

/** The slice of an endpoint context the impersonation veto reads. */
type ImpersonationGuardContext = RefusalContext & {
  context: { session: { session: { id: string; impersonatedBy?: unknown } } }
}

/** The slice of an endpoint context the registration guards read. */
type RegistrationGuardContext = ImpersonationGuardContext & {
  context: {
    session: {
      session: { createdAt: Date | string }
      user: { id: string }
    }
    sessionConfig: { freshAge: number }
    adapter: {
      count: (input: {
        model: string
        where: Array<{ field: string; value: string }>
      }) => Promise<number>
    }
  }
}

/**
 * An impersonated session is refused for every operator, because a passkey an operator registers
 * or renames outlives the 900-second impersonation with no audit row (docs/ACCESS.md §6.4). Any
 * non-null marker counts, an empty string included: `guard.ts` reads a session that `tenant.ts`
 * has normalised, so the raw check here is the stricter of the two. Evaluated first on every
 * mutating endpoint, before any read or write.
 */
function assertNotImpersonated(
  ctx: ImpersonationGuardContext,
  message: string,
): void {
  const { impersonatedBy } = ctx.context.session.session
  if (impersonatedBy !== null && impersonatedBy !== undefined) {
    throw ctx.error('FORBIDDEN', {
      code: PASSKEY_ERROR_CODES.impersonated,
      message,
    })
  }
}

/**
 * Evaluated first on both registration endpoints, before any read or write.
 *
 * - The impersonation veto above.
 * - The session must be younger than the library's `freshAge` (0 switches the check off, as in
 *   the library), for every account. A borrowed 30-day session that adds a passkey would otherwise
 *   keep access after a password reset, which revokes sessions and not passkeys.
 */
function assertMayRegister(ctx: RegistrationGuardContext): void {
  assertNotImpersonated(
    ctx,
    'An impersonated session cannot register a passkey.',
  )
  const { session } = ctx.context.session

  const freshAge = ctx.context.sessionConfig.freshAge * 1000
  if (freshAge !== 0) {
    const age = Date.now() - new Date(session.createdAt).getTime()
    // Written so that an unreadable `createdAt` (NaN) refuses instead of passing.
    if (!(age < freshAge)) {
      throw ctx.error('BAD_REQUEST', {
        code: PASSKEY_ERROR_CODES.sessionNotFresh,
        message: 'Sign in again to add a passkey.',
      })
    }
  }
}

/** Refuses at the ceiling. Called before anything is written or consumed. */
async function assertUnderCeiling(ctx: RegistrationGuardContext) {
  const held = await ctx.context.adapter.count({
    model: 'passkey',
    where: [{ field: 'userId', value: ctx.context.session.user.id }],
  })
  if (held >= MAX_PASSKEYS_PER_USER) {
    throw ctx.error('BAD_REQUEST', {
      code: PASSKEY_ERROR_CODES.limitReached,
      message: 'The passkey limit has been reached.',
    })
  }
}

function descriptorsFor(passkeys: Array<StoredPasskey>) {
  return passkeys.map((entry) => ({
    id: entry.credentialId,
    type: 'public-key' as const,
    transports: entry.transports
      ? entry.transports.split(',').filter(Boolean)
      : undefined,
  }))
}

export function passkey(options: PasskeyPluginOptions): BetterAuthPlugin {
  const { relyingPartyId, relyingPartyName, origins } = options

  return {
    id: 'passkey',

    rateLimit: [
      ...[...REGISTRATION_PATHS].map((path) => ({
        pathMatcher: (candidate: string) => candidate === path,
        ...REGISTRATION_RATE_LIMIT,
      })),
      {
        pathMatcher: (candidate: string) => candidate === RENAME_PATH,
        ...RENAME_RATE_LIMIT,
      },
    ],

    schema: {
      passkey: {
        fields: {
          name: { type: 'string', required: false },
          userId: {
            type: 'string',
            required: true,
            references: { model: 'user', field: 'id', onDelete: 'cascade' },
            index: true,
          },
          credentialId: { type: 'string', required: true, unique: true },
          publicKey: { type: 'string', required: true, returned: false },
          algorithm: { type: 'number', required: true },
          counter: { type: 'number', required: true, defaultValue: 0 },
          deviceType: { type: 'string', required: true },
          backedUp: { type: 'boolean', required: true, defaultValue: false },
          transports: { type: 'string', required: false },
          aaguid: { type: 'string', required: false },
          createdAt: {
            type: 'date',
            required: true,
            defaultValue: () => new Date(),
          },
          lastUsedAt: { type: 'date', required: false },
        },
      },
    },

    endpoints: {
      /** POST `/passkey/register/options` — start enrolling a new passkey. */
      generatePasskeyRegistrationOptions: createAuthEndpoint(
        '/passkey/register/options',
        { method: 'POST', use: [sessionMiddleware] },
        async (ctx) => {
          assertMayRegister(ctx)
          await assertUnderCeiling(ctx)
          const { user } = ctx.context.session
          const challenge = createChallenge()

          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `${CHALLENGE_PREFIX}${challenge}`,
            value: JSON.stringify({
              ceremony: 'register',
              userId: user.id,
            } satisfies Ceremony),
            expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
          })

          const existing = await ctx.context.adapter.findMany<StoredPasskey>({
            model: 'passkey',
            where: [{ field: 'userId', value: user.id }],
            limit: 50,
          })

          return ctx.json({
            challenge,
            rp: { id: relyingPartyId, name: relyingPartyName },
            user: {
              id: base64UrlEncode(utf8Encode(user.id)),
              name: user.email,
              displayName: user.name || user.email,
            },
            pubKeyCredParams,
            timeout: CHALLENGE_TTL_MS,
            attestation: 'none' as const,
            excludeCredentials: descriptorsFor(existing),
            authenticatorSelection: {
              residentKey: 'required' as const,
              requireResidentKey: true,
              userVerification: 'preferred' as const,
            },
          })
        },
      ),

      /** POST `/passkey/register/verify` — finish enrolling a new passkey. */
      verifyPasskeyRegistration: createAuthEndpoint(
        '/passkey/register/verify',
        {
          method: 'POST',
          use: [sessionMiddleware],
          body: z.object({
            credential: registrationCredentialSchema,
            name: z.string().trim().min(1).max(64).optional(),
          }),
        },
        async (ctx) => {
          assertMayRegister(ctx)
          // Before `consumeCeremony` and any attestation work: a refused call burns no challenge.
          await assertUnderCeiling(ctx)
          const { user } = ctx.context.session
          const challenge = readClientDataChallenge(
            ctx.body.credential.response.clientDataJSON,
          )
          const stored = await consumeCeremony(
            ctx.context.internalAdapter,
            challenge,
          )

          if (
            !challenge ||
            !stored ||
            stored.ceremony !== 'register' ||
            stored.userId !== user.id
          ) {
            throw ctx.error('BAD_REQUEST', {
              message: 'This passkey request has expired. Please try again.',
            })
          }

          let verified
          try {
            verified = await verifyRegistration({
              credential: ctx.body.credential,
              expectedChallenge: challenge,
              expectedOrigins: origins,
              relyingPartyId,
              requireUserVerification: false,
            })
          } catch (cause) {
            throw ctx.error('BAD_REQUEST', {
              message:
                cause instanceof Error
                  ? cause.message
                  : 'Passkey registration could not be verified.',
            })
          }

          const duplicate = await ctx.context.adapter.findOne<StoredPasskey>({
            model: 'passkey',
            where: [{ field: 'credentialId', value: verified.credentialId }],
          })
          if (duplicate) {
            throw ctx.error('BAD_REQUEST', {
              message: 'This passkey is already registered.',
            })
          }

          const created = await ctx.context.adapter.create<
            Omit<StoredPasskey, 'id'>,
            StoredPasskey
          >({
            model: 'passkey',
            data: {
              name: ctx.body.name ?? null,
              userId: user.id,
              credentialId: verified.credentialId,
              publicKey: verified.publicKey,
              algorithm: verified.algorithm,
              counter: verified.signCount,
              deviceType: verified.deviceType,
              backedUp: verified.backedUp,
              transports:
                verified.transports.length > 0
                  ? verified.transports.join(',')
                  : null,
              aaguid: verified.aaguid,
              createdAt: new Date(),
              lastUsedAt: null,
            },
          })

          return ctx.json({ passkey: toPublicPasskey(created) })
        },
      ),

      /** POST `/passkey/authenticate/options` — start a passkey sign-in. */
      generatePasskeyAuthenticationOptions: createAuthEndpoint(
        '/passkey/authenticate/options',
        {
          method: 'POST',
          body: z
            .object({ email: z.string().trim().max(320).optional() })
            .optional(),
        },
        async (ctx) => {
          const challenge = createChallenge()
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `${CHALLENGE_PREFIX}${challenge}`,
            value: JSON.stringify({
              ceremony: 'authenticate',
            } satisfies Ceremony),
            expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
          })

          // A hint is only ever a convenience: an unknown address yields an
          // empty allow-list, exactly like a discoverable-credential sign-in,
          // so the response never reveals whether an account exists.
          let allowCredentials: ReturnType<typeof descriptorsFor> = []
          const email = ctx.body?.email?.toLowerCase()
          if (email) {
            const account =
              await ctx.context.internalAdapter.findUserByEmail(email)
            if (account) {
              const passkeys =
                await ctx.context.adapter.findMany<StoredPasskey>({
                  model: 'passkey',
                  where: [{ field: 'userId', value: account.user.id }],
                  limit: 50,
                })
              allowCredentials = descriptorsFor(passkeys)
            }
          }

          return ctx.json({
            challenge,
            rpId: relyingPartyId,
            timeout: CHALLENGE_TTL_MS,
            userVerification: 'preferred' as const,
            allowCredentials,
          })
        },
      ),

      /** POST `/passkey/authenticate/verify` — finish a passkey sign-in. */
      verifyPasskeyAuthentication: createAuthEndpoint(
        '/passkey/authenticate/verify',
        {
          method: 'POST',
          body: z.object({ credential: authenticationCredentialSchema }),
        },
        async (ctx) => {
          const challenge = readClientDataChallenge(
            ctx.body.credential.response.clientDataJSON,
          )
          const stored = await consumeCeremony(
            ctx.context.internalAdapter,
            challenge,
          )
          if (!challenge || !stored || stored.ceremony !== 'authenticate') {
            throw ctx.error('BAD_REQUEST', {
              message: 'This passkey request has expired. Please try again.',
            })
          }

          const record = await ctx.context.adapter.findOne<StoredPasskey>({
            model: 'passkey',
            where: [
              { field: 'credentialId', value: ctx.body.credential.rawId },
            ],
          })
          if (!record) {
            throw ctx.error('UNAUTHORIZED', {
              message: 'This passkey is not registered.',
            })
          }

          let verified
          try {
            verified = await verifyAuthentication({
              credential: ctx.body.credential,
              storedPublicKey: record.publicKey,
              storedSignCount: record.counter,
              expectedChallenge: challenge,
              expectedOrigins: origins,
              relyingPartyId,
              requireUserVerification: false,
            })
          } catch (cause) {
            throw ctx.error('UNAUTHORIZED', {
              message:
                cause instanceof Error
                  ? cause.message
                  : 'Passkey sign-in could not be verified.',
            })
          }

          await ctx.context.adapter.update({
            model: 'passkey',
            where: [{ field: 'id', value: record.id }],
            update: {
              counter: verified.signCount,
              backedUp: verified.backedUp,
              lastUsedAt: new Date(),
            },
          })

          const session = await ctx.context.internalAdapter.createSession(
            record.userId,
            false,
          )
          const account = await ctx.context.internalAdapter.findUserById(
            record.userId,
          )
          if (!account) {
            throw ctx.error('UNAUTHORIZED', { message: 'Account not found.' })
          }

          await setSessionCookie(ctx, { session, user: account })
          return ctx.json({
            redirect: false,
            token: session.token,
            user: {
              id: account.id,
              email: account.email,
              name: account.name,
              image: account.image ?? null,
              emailVerified: account.emailVerified,
            },
          })
        },
      ),

      /** GET `/passkey/list` — the signed-in user's registered passkeys. */
      listPasskeys: createAuthEndpoint(
        '/passkey/list',
        { method: 'GET', use: [sessionMiddleware] },
        async (ctx) => {
          const passkeys = await ctx.context.adapter.findMany<StoredPasskey>({
            model: 'passkey',
            where: [{ field: 'userId', value: ctx.context.session.user.id }],
            sortBy: { field: 'createdAt', direction: 'desc' },
            limit: 50,
          })
          return ctx.json({ passkeys: passkeys.map(toPublicPasskey) })
        },
      ),

      /**
       * POST `/passkey/rename` — name one of the user's passkeys, or change its name. A rename never
       * clears a name: an empty one is refused by the schema, and clearing is not an operation.
       */
      renamePasskey: createAuthEndpoint(
        RENAME_PATH,
        {
          method: 'POST',
          use: [sessionMiddleware],
          body: z.strictObject({
            id: z.string().min(1),
            name: z.string().trim().min(1).max(64),
          }),
        },
        async (ctx) => {
          assertNotImpersonated(
            ctx,
            'An impersonated session cannot rename a passkey.',
          )
          const record = await ctx.context.adapter.findOne<StoredPasskey>({
            model: 'passkey',
            where: [{ field: 'id', value: ctx.body.id }],
          })
          // The same answer for a missing id and another person's, so the endpoint never confirms
          // that someone else's credential exists.
          const notFound = () =>
            ctx.error('NOT_FOUND', {
              code: PASSKEY_ERROR_CODES.notFound,
              message: 'Passkey not found.',
            })
          if (!record || record.userId !== ctx.context.session.user.id) {
            throw notFound()
          }
          const updated = await ctx.context.adapter.update<StoredPasskey>({
            model: 'passkey',
            where: [{ field: 'id', value: record.id }],
            update: { name: ctx.body.name },
          })
          if (!updated) throw notFound()
          return ctx.json({ passkey: toPublicPasskey(updated) })
        },
      ),

      /** POST `/passkey/delete` — remove one of the user's passkeys. */
      deletePasskey: createAuthEndpoint(
        '/passkey/delete',
        {
          method: 'POST',
          use: [sessionMiddleware],
          body: z.object({ id: z.string().min(1) }),
        },
        async (ctx) => {
          const record = await ctx.context.adapter.findOne<StoredPasskey>({
            model: 'passkey',
            where: [{ field: 'id', value: ctx.body.id }],
          })
          if (!record || record.userId !== ctx.context.session.user.id) {
            throw ctx.error('NOT_FOUND', { message: 'Passkey not found.' })
          }
          await ctx.context.adapter.delete({
            model: 'passkey',
            where: [{ field: 'id', value: record.id }],
          })
          return ctx.json({ deleted: true })
        },
      ),
    },
  }
}

/**
 * Reads the challenge out of `clientDataJSON`. This value is untrusted — it is
 * only a lookup key; the authoritative check is that a matching unconsumed
 * challenge exists server-side, and `assertClientData` compares the two again.
 */
export function readClientDataChallenge(clientDataJson: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(utf8Decode(base64UrlDecode(clientDataJson)))
  } catch {
    return null
  }
  const challenge = (parsed as { challenge?: unknown }).challenge
  if (typeof challenge !== 'string' || challenge.length === 0) return null
  return challenge
}

type ChallengeStore = {
  consumeVerificationValue: (
    identifier: string,
  ) => Promise<{ value: string } | null>
}

/**
 * Atomically consumes the stored challenge. A second attempt with the same
 * challenge finds nothing, which is what makes replay impossible.
 */
async function consumeCeremony(
  store: ChallengeStore,
  challenge: string | null,
): Promise<Ceremony | null> {
  if (!challenge) return null
  const stored = await store.consumeVerificationValue(
    `${CHALLENGE_PREFIX}${challenge}`,
  )
  if (!stored) return null
  try {
    // The stored value is opaque text from KV, so it gets validated rather than
    // asserted: a hand-written key could otherwise smuggle any shape through.
    const parsed: unknown = JSON.parse(stored.value)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { ceremony, userId } = parsed as Record<keyof Ceremony, unknown>
    if (ceremony !== 'register' && ceremony !== 'authenticate') return null
    if (userId !== undefined && typeof userId !== 'string') return null
    return userId === undefined ? { ceremony } : { ceremony, userId }
  } catch {
    return null
  }
}

function toPublicPasskey(record: StoredPasskey) {
  return {
    id: record.id,
    name: record.name,
    deviceType: record.deviceType,
    backedUp: record.backedUp,
    aaguid: record.aaguid,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
  }
}
