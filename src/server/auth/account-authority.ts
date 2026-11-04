import { nanoid } from 'nanoid'
import { AsyncLocalStorage } from 'node:async_hooks'
import { z } from 'zod'
import {
  APIError,
  createAuthMiddleware,
  getSession,
  isAPIError,
} from 'better-auth/api'
import {
  AccountAuthorityError,
  factorSnapshot,
  reserveFactorAttempt,
  factorRetryAfter,
  resetFactorAttempts,
  consumeNativeBackup,
  acceptedSession,
  initializeAccount,
  deleteNativeSessionRows,
  readAccountProof,
  readEntryFence,
  insertNativeSession,
  insertNativeVerification,
  promotePasswordSession,
  verificationProof,
  pendingOperations,
  acknowledgeRoomTarget,
  backfillLegacyAuthority,
  recordAnchorBackfillCompletion,
  reserveNativeAccountDeletion,
  reservedAccountDeletions,
  pruneAccountSecurityMetadata,
} from '#/server/repos/account-security'
import type {
  FactorReservation,
  FactorSnapshot,
} from '#/server/repos/account-security'
import { hashSecret } from '#/server/security/secret'
import { accountScopeBrand } from './account-authority-lib/scope'
import type {
  AccountAuthScope,
  ProofRevision,
} from './account-authority-lib/scope'
import type { AccountAuthDatabase as Database } from '#/server/auth/account-authority-lib/scope'
import type {
  BetterAuthPlugin,
  DBAdapter,
  DBTransactionAdapter,
} from 'better-auth'

interface RequestAuthority {
  nativeFactor?: {
    scope: AccountAuthScope
    proof: ProofRevision
    snapshot: NonNullable<FactorSnapshot['factor']>
    reservation: FactorReservation
  }
  readonly fence: number
  readonly enforced: boolean
  readonly proofs: Map<string, ProofRevision>
  readonly passwordEntry: boolean
  readonly factorEntry: boolean
  readonly deletionEntry: boolean
  readonly deletionReservations: Map<string, string>
  readonly trustedProofAccounts: Set<string>
  readonly verificationOwners: Map<string, string>
  readonly provisional: Array<{
    scope: AccountAuthScope
    proof: ProofRevision
    id: string
    token: string
  }>
}
const authority = new AsyncLocalStorage<RequestAuthority>()
const identity = z.object({ id: z.string().min(1) })
function resultUserId(result: unknown): string | null {
  const direct = identity.safeParse(result)
  if (direct.success) return direct.data.id
  const nested = z.object({ user: identity }).safeParse(result)
  return nested.success ? nested.data.user.id : null
}
const nativeSession = z
  .object({ id: z.string(), userId: z.string(), token: z.string() })
  .passthrough()
const nativeVerification = z
  .object({
    identifier: z.string(),
    value: z.string(),
    expiresAt: z.coerce.date(),
  })
  .passthrough()

/** Only native identity results reach this constructor; operation inputs never select an account. */
function scopeFor(db: Database, userId: string): AccountAuthScope {
  return { [accountScopeBrand]: true, db, userId }
}

export function createAccountAuthority(
  db: Database,
  requestCutover: () => boolean,
) {
  function enforced(): boolean {
    const state = authority.getStore()
    if (!state) throw new AccountAuthorityError()
    return state.enforced
  }
  async function boundary<T>(
    run: () => Promise<T>,
    passwordEntry = false,
    factorEntry = false,
    deletionEntry = false,
  ): Promise<T> {
    if (authority.getStore()) return run()
    const entry = await readEntryFence(db, !requestCutover())
    const state: RequestAuthority = {
      fence: entry.fence,
      enforced: entry.enforced,
      proofs: new Map(),
      passwordEntry,
      factorEntry,
      deletionEntry,
      deletionReservations: new Map(),
      trustedProofAccounts: new Set(),
      verificationOwners: new Map(),
      provisional: [],
    }
    return authority.run(state, async () => {
      const result = await run()
      if (state.provisional.length === 0) return result
      let body: unknown = result
      if (result instanceof Response)
        body = result.ok
          ? await result
              .clone()
              .json()
              .catch(() => null)
          : null
      if (typeof body === 'object' && body !== null && 'response' in body)
        body = body.response
      const success = z
        .object({ token: z.string(), user: identity })
        .safeParse(body)
      if (success.success)
        for (const pending of state.provisional) {
          if (
            pending.token !== success.data.token ||
            pending.scope.userId !== success.data.user.id
          )
            continue
          await promotePasswordSession(pending.scope, pending.id, pending.proof)
          if (
            enforced() &&
            !(await acceptedSession(pending.scope, pending.token, Date.now()))
          )
            throw new AccountAuthorityError()
        }
      return result
    })
  }

  async function bind(
    userId: string,
  ): Promise<{ scope: AccountAuthScope; proof: ProofRevision }> {
    const state = authority.getStore()
    if (!state) throw new AccountAuthorityError()
    const scope = scopeFor(db, userId)
    const current = await readAccountProof(scope, state.fence, !enforced())
    const previous = state.proofs.get(userId)
    if (previous && previous.revision !== current.revision)
      throw new AccountAuthorityError()
    const proof = previous ?? current
    state.proofs.set(userId, proof)
    return { scope, proof }
  }

  async function checkSession(value: unknown): Promise<boolean> {
    const candidate = z
      .object({ session: nativeSession, user: identity })
      .safeParse(value)
    if (
      !candidate.success ||
      candidate.data.user.id !== candidate.data.session.userId
    )
      return false
    if (!enforced()) return true
    return (
      (await acceptedSession(
        scopeFor(db, candidate.data.session.userId),
        candidate.data.session.token,
        Date.now(),
      )) !== null
    )
  }

  async function verification(identifier: string): Promise<boolean> {
    if (!/^(trust-device-|2fa-(?!attempts-|otp-))/.test(identifier)) return true
    const trust = identifier.startsWith('trust-device-')
    const found = await verificationProof(
      db,
      identifier,
      await hashSecret(identifier),
      trust,
      Date.now(),
    )
    if (!found) {
      if (!enforced()) return true
      if (trust) return false
      throw new AccountAuthorityError()
    }
    authority.getStore()?.verificationOwners.set(identifier, found.userId)
    const bound = await bind(found.userId)
    if (!trust && bound.proof.revision !== found.proof.revision)
      throw new AccountAuthorityError()
    if (bound.proof.trustRevision !== found.proof.trustRevision)
      throw new AccountAuthorityError()
    if (!trust) authority.getStore()?.proofs.set(found.userId, found.proof)
    else authority.getStore()?.trustedProofAccounts.add(found.userId)
    return true
  }

  async function reserveDeletion(userId: string): Promise<void> {
    const state = authority.getStore()
    if (!state) throw new AccountAuthorityError()
    if (state.deletionReservations.has(userId)) return
    const id = await reserveNativeAccountDeletion(
      scopeFor(db, userId),
      crypto.randomUUID(),
      Date.now(),
    )
    state.deletionReservations.set(userId, id)
  }

  function upgradeRequired(): never {
    throw APIError.from('FORBIDDEN', {
      code: 'CLIENT_UPGRADE_REQUIRED',
      message: 'settings.twoFactor.security.upgrade',
    })
  }
  const nativeManagement = new Set([
    '/two-factor/enable',
    '/two-factor/disable',
    '/two-factor/generate-backup-codes',
    '/two-factor/get-totp-uri',
    '/two-factor/send-otp',
    '/two-factor/verify-otp',
  ])
  const nativeVerificationPaths = new Set([
    '/two-factor/verify-totp',
    '/two-factor/verify-backup-code',
  ])
  const plugin: BetterAuthPlugin = {
    id: 'account-authority',
    hooks: {
      after: [
        {
          matcher: (ctx) => nativeVerificationPaths.has(ctx.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => {
            const attempt = authority.getStore()?.nativeFactor
            if (attempt && !isAPIError(ctx.context.returned))
              await resetFactorAttempts(
                attempt.scope,
                attempt.proof.revision,
                attempt.reservation,
              )
          }),
        },
      ],
      before: [
        {
          matcher: (ctx) =>
            nativeManagement.has(ctx.path ?? '') ||
            nativeVerificationPaths.has(ctx.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => {
            if (!enforced()) return
            if (nativeManagement.has(ctx.path ?? '')) upgradeRequired()
            const result = await getSession()({
              ...ctx,
              method: 'GET',
              asResponse: false,
              headers: ctx.headers ?? new Headers(),
              returnHeaders: true,
              returnStatus: false,
              query: { disableCookieCache: true },
            })
            if (result.response) upgradeRequired()
            const cookie = ctx.context.createAuthCookie('two_factor')
            const identifier = await ctx.getSignedCookie(
              cookie.name,
              ctx.context.secret,
            )
            if (!identifier) return
            const challenge =
              await ctx.context.internalAdapter.findVerificationValue(
                identifier,
              )
            if (!challenge) return
            const bound = await bind(challenge.value)
            const snapshot = (await factorSnapshot(bound.scope)).factor
            if (!snapshot?.verified) throw new AccountAuthorityError()
            const reservation = await reserveFactorAttempt(
              bound.scope,
              bound.proof.revision,
              'active',
              Date.now(),
            )
            if (!reservation) {
              throw new APIError(
                'TOO_MANY_REQUESTS',
                {
                  code: 'ACCOUNT_TEMPORARILY_LOCKED',
                  message: 'settings.security.other.refused',
                },
                {
                  'retry-after': String(
                    await factorRetryAfter(bound.scope, 'active', Date.now()),
                  ),
                },
              )
            }
            const state = authority.getStore()
            if (!state) throw new AccountAuthorityError()
            state.nativeFactor = { ...bound, snapshot, reservation }
          }),
        },
        {
          matcher: (ctx) => ctx.path === '/revoke-other-sessions',
          handler: createAuthMiddleware(async () => {
            if (enforced())
              throw APIError.from('CONFLICT', {
                code: 'ACCOUNT_SECURITY_REGISTRATION_REQUIRED',
                message: 'settings.security.other.refused',
              })
          }),
        },
      ],
    },
  }

  type InternalAdapter = Parameters<
    NonNullable<BetterAuthPlugin['init']>
  >[0]['internalAdapter']
  function wrapInternal(original: InternalAdapter): InternalAdapter {
    const wrapped = new Proxy(original, {
      get(target, property, receiver) {
        const method = Reflect.get(target, property, receiver)
        if (typeof method !== 'function') return method
        return async function invoke(
          ...args: Array<unknown>
        ): Promise<unknown> {
          if (!authority.getStore()) {
            if (property === 'createSession') throw new AccountAuthorityError()
            return boundary(
              () => invoke(...args),
              false,
              false,
              property === 'deleteUser',
            )
          }
          try {
            const name = String(property)
            if (
              (name === 'deleteUser' ||
                (name === 'deleteUserSessions' &&
                  authority.getStore()?.deletionEntry)) &&
              typeof args[0] === 'string'
            )
              await reserveDeletion(args[0])
            if (
              (name === 'findVerificationValue' ||
                name === 'consumeVerificationValue') &&
              typeof args[0] === 'string' &&
              !(await verification(args[0]))
            )
              return null
            if (
              name === 'updateSession' &&
              enforced() &&
              typeof args[0] === 'string'
            ) {
              const current: unknown = await original.findSession(args[0])
              if (!(await checkSession(current)))
                throw new AccountAuthorityError()
            }
            let bound: Awaited<ReturnType<typeof bind>> | undefined
            if (name === 'createSession' && typeof args[0] === 'string')
              bound = await bind(args[0])

            const result: unknown = await Reflect.apply(method, target, args)
            if (
              (name === 'findVerificationValue' ||
                name === 'consumeVerificationValue') &&
              typeof args[0] === 'string'
            ) {
              const expected = authority
                .getStore()
                ?.verificationOwners.get(args[0])
              const record = nativeVerification.safeParse(result)
              if (
                expected &&
                (!record.success || record.data.value !== expected)
              )
                return null
            }
            if (name === 'createUser' || name === 'createOAuthUser') {
              const userId = resultUserId(result)
              if (userId) await initializeAccount(scopeFor(db, userId))
            }
            if (
              [
                'findUserById',
                'findUserByEmail',
                'findAccountOwnerByKey',
              ].includes(name)
            ) {
              const userId = resultUserId(result)
              if (userId) await bind(userId)
            }
            if (name === 'createSession' && bound) {
              const created = nativeSession.parse(result)
              if (authority.getStore()?.passwordEntry)
                authority.getStore()?.provisional.push({
                  ...bound,
                  id: created.id,
                  token: created.token,
                })
              else if (
                enforced() &&
                !(await acceptedSession(bound.scope, created.token, Date.now()))
              )
                throw new AccountAuthorityError()
            }

            if (
              (name === 'findSession' || name === 'updateSession') &&
              result !== null &&
              enforced()
            ) {
              if (name === 'findSession') {
                const candidate = z
                  .object({ session: nativeSession })
                  .safeParse(result)
                return candidate.success &&
                  candidate.data.session.token === args[0] &&
                  (await checkSession(result))
                  ? result
                  : null
              }
              const updated = nativeSession.safeParse(result)
              if (
                !updated.success ||
                !(await acceptedSession(
                  scopeFor(db, updated.data.userId),
                  updated.data.token,
                  Date.now(),
                ))
              )
                throw new AccountAuthorityError()
            }
            if (
              (name === 'findSessions' || name === 'listSessions') &&
              Array.isArray(result) &&
              enforced()
            ) {
              const filtered: Array<unknown> = []
              for (const value of result) {
                if (name === 'findSessions') {
                  if (await checkSession(value)) filtered.push(value)
                  continue
                }
                const row = nativeSession.safeParse(value)
                if (
                  row.success &&
                  (await acceptedSession(
                    scopeFor(db, row.data.userId),
                    row.data.token,
                    Date.now(),
                  ))
                )
                  filtered.push(value)
              }
              return filtered
            }
            return result
          } catch (error) {
            if (isAPIError(error)) throw error
            throw new AccountAuthorityError()
          }
        }
      },
    })
    return wrapped
  }

  function wrap<
    T extends {
      handler: (request: Request) => Promise<Response>
      api: object
      $context: Promise<{ internalAdapter: InternalAdapter }>
    },
  >(auth: T): T {
    // Plugin init overrides are rebuilt by Better Auth after all init hooks; install once afterwards.
    const installed = auth.$context.then((context) => {
      context.internalAdapter = wrapInternal(context.internalAdapter)
    })
    const api = new Proxy(auth.api, {
      get(target, property, receiver) {
        const method = Reflect.get(target, property, receiver)
        if (typeof method !== 'function') return method
        return Object.assign(
          (...args: Array<unknown>) =>
            boundary(
              async () => {
                await installed
                if (property === 'viewBackupCodes' && enforced())
                  upgradeRequired()
                return Reflect.apply(method, target, args)
              },
              property === 'signInEmail',
              property === 'verifyTOTP' || property === 'verifyBackupCode',
              ['removeUser', 'deleteUser', 'deleteUserCallback'].includes(
                String(property),
              ),
            ),
          method,
        )
      },
    })
    return {
      ...auth,
      api,
      handler: (request: Request) =>
        boundary(
          async () => {
            await installed
            return auth.handler(request)
          },
          new URL(request.url).pathname
            .replace(/\/+$/, '')
            .endsWith('/sign-in/email'),
          /\/two-factor\/verify-(totp|backup-code)\/?$/.test(
            new URL(request.url).pathname,
          ),
          /\/(admin\/remove-user|delete-user(?:\/callback)?)\/?$/.test(
            new URL(request.url).pathname,
          ),
        ),
    }
  }

  function guardRows<T extends DBTransactionAdapter>(adapter: T): T {
    const guarded = {
      ...adapter,
      delete: async (input: Parameters<DBAdapter['delete']>[0]) =>
        boundary(async () => {
          if (input.model === 'user') {
            const [where] = input.where
            if (
              input.where.length !== 1 ||
              where?.field !== 'id' ||
              typeof where.value !== 'string' ||
              (where.operator && where.operator !== 'eq')
            )
              throw new AccountAuthorityError()
            await reserveDeletion(where.value)
            return adapter.delete(input)
          }
          if (input.model !== 'session' || !enforced())
            return adapter.delete(input)
          await deleteNativeSessionRows(db, input.where)
        }),
      deleteMany: async (input: Parameters<DBAdapter['deleteMany']>[0]) =>
        boundary(async () => {
          if (input.model === 'user') throw new AccountAuthorityError()
          if (input.model !== 'session' || !enforced())
            return adapter.deleteMany(input)
          return deleteNativeSessionRows(db, input.where)
        }),
    }
    return new Proxy(guarded, {
      get(target, property, receiver) {
        if (property === 'findOne')
          return async (input: Parameters<DBAdapter['findOne']>[0]) => {
            const row = await adapter.findOne(input)
            const attempt = authority.getStore()?.nativeFactor
            if (input.model !== 'twoFactor' || !attempt || !row) return row
            const factor = z
              .object({
                id: z.string(),
                userId: z.string(),
                secret: z.string(),
                backupCodes: z.string(),
              })
              .passthrough()
              .parse(row)
            if (
              factor.id !== attempt.snapshot.id ||
              factor.userId !== attempt.scope.userId ||
              factor.secret !== attempt.snapshot.secret ||
              factor.backupCodes !== attempt.snapshot.backupCodes
            )
              throw new AccountAuthorityError()
            return { ...factor, failedVerificationCount: 0, lockedUntil: null }
          }
        if (property === 'update' || property === 'incrementOne')
          return async (
            input:
              | Parameters<DBAdapter['update']>[0]
              | Parameters<DBAdapter['incrementOne']>[0],
          ) => {
            if (input.model !== 'twoFactor' || !enforced()) {
              if ('increment' in input) return adapter.incrementOne(input)
              return adapter.update(input)
            }
            const attempt = authority.getStore()?.nativeFactor
            if (!attempt) throw new AccountAuthorityError()
            const values =
              'increment' in input ? (input.set ?? {}) : input.update
            if ('backupCodes' in values) {
              if (typeof values.backupCodes !== 'string')
                throw new AccountAuthorityError()
              return consumeNativeBackup(
                attempt.scope,
                attempt.proof,
                attempt.snapshot,
                values.backupCodes,
              )
            }
            if (
              Object.keys(values).some(
                (key) =>
                  key !== 'failedVerificationCount' && key !== 'lockedUntil',
              )
            )
              throw new AccountAuthorityError()
            return {
              ...attempt.snapshot,
              failedVerificationCount: 0,
              lockedUntil: null,
            }
          }
        if (property !== 'create')
          return Reflect.get(target, property, receiver)
        return async (input: Parameters<DBAdapter['create']>[0]) => {
          if (input.model === 'verification') {
            const value = nativeVerification.safeParse(input.data)
            if (
              value.success &&
              /^(trust-device-|2fa-(?!attempts-|otp-))/.test(
                value.data.identifier,
              )
            ) {
              const bound = await bind(value.data.value)
              const dates = z
                .object({
                  id: z.string().optional(),
                  createdAt: z.coerce.date(),
                  updatedAt: z.coerce.date(),
                })
                .parse(input.data)
              return insertNativeVerification(
                bound.scope,
                { ...value.data, ...dates, id: dates.id ?? nanoid(24) },
                await hashSecret(value.data.identifier),
                bound.proof,
                authority.getStore()?.factorEntry === true ||
                  authority
                    .getStore()
                    ?.trustedProofAccounts.has(bound.scope.userId) === true,
              )
            }
          }
          if (input.model !== 'session') return adapter.create(input)
          const parsed = z
            .object({
              id: z.string().optional(),
              token: z.string(),
              userId: z.string(),
              activeOrganizationId: z.string().nullable().optional(),
              ipAddress: z.string().nullable().optional(),
              userAgent: z.string().nullable().optional(),
              impersonatedBy: z.string().nullable().optional(),
              expiresAt: z.coerce.date(),
              createdAt: z.coerce.date(),
              updatedAt: z.coerce.date(),
            })
            .parse(input.data)
          const { scope, proof } = await bind(parsed.userId)
          return insertNativeSession(
            scope,
            {
              ...parsed,
              id: parsed.id ?? nanoid(24),
              activeOrganizationId: parsed.activeOrganizationId ?? null,
              ipAddress: parsed.ipAddress ?? null,
              userAgent: parsed.userAgent ?? null,
              impersonatedBy: parsed.impersonatedBy ?? null,
            },
            proof,
            authority.getStore()?.passwordEntry ? 'password-pending' : 'native',
            Date.now(),
          )
        }
      },
    })
  }
  function guardAdapter(adapter: DBAdapter): DBAdapter {
    return {
      ...guardRows(adapter),
      transaction: (callback) =>
        adapter.transaction((transaction) => callback(guardRows(transaction))),
    }
  }
  return { boundary, bind, checkSession, plugin, wrap, guardAdapter, enforced }
}

/** The system capability is minted only from bounded pending-work discovery, never request input. */
export async function discoverAccountCleanup(db: Database) {
  return (await pendingOperations(db)).map((operation) => ({
    operation,
    scope: { [accountScopeBrand]: true as const, db, userId: operation.userId },
  }))
}

/** A queue acknowledgement cannot name an account outside its recorded operation/room target. */
export async function acknowledgeAccountRoomEviction(
  db: Database,
  id: string,
  userId: string,
  organizationId: string,
): Promise<void> {
  await acknowledgeRoomTarget(db, id, userId, organizationId)
}

/** Scheduled expand capability has no account selector and refuses use after cutover. */
export async function expandAccountAuthority(
  db: Database,
  now: number,
  marker: { runId: string; completedAt: string } | null,
): Promise<void> {
  await backfillLegacyAuthority(db, now)
  if (marker) await recordAnchorBackfillCompletion(db, marker, now)
}

/** The caller resumes only durable, previously authorized deletion reservations. */
export async function recoverAccountDeletions(
  db: Database,
  now: number,
  resume: (userId: string) => Promise<void>,
): Promise<void> {
  for (const userId of await reservedAccountDeletions(db, now))
    await resume(userId)
}

export async function retireAccountSecurityMetadata(
  db: Database,
  now: number,
): Promise<void> {
  await pruneAccountSecurityMetadata(db, now)
}
