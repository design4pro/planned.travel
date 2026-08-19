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
import type { BetterAuthPlugin } from 'better-auth'
import { base64UrlDecode, base64UrlEncode, utf8Decode, utf8Encode } from './bytes'
import {
  createChallenge,
  verifyAuthentication,
  verifyRegistration,
} from './webauthn'
import { SUPPORTED_COSE_ALGORITHMS } from './cose'

/** How long a WebAuthn ceremony may stay open. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000
const CHALLENGE_PREFIX = 'passkey-challenge:'

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
              const passkeys = await ctx.context.adapter.findMany<StoredPasskey>(
                {
                  model: 'passkey',
                  where: [{ field: 'userId', value: account.user.id }],
                  limit: 50,
                },
              )
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
            where: [{ field: 'credentialId', value: ctx.body.credential.rawId }],
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
