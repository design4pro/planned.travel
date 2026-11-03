import { nanoid } from 'nanoid'
import { AsyncLocalStorage } from 'node:async_hooks'
import { z } from 'zod'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import {
  AccountAuthorityError,
  acceptedSession,
  initializeAccount,
  deleteNativeSessionRows,
  readAccountProof,
  readEntryFence,
  insertNativeSession,
  insertNativeVerification,
  promotePasswordSession,
  recordVerificationProof,
  verificationProof,
  pendingOperations,
  acknowledgeRoomTarget,
} from '#/server/repos/account-security'
import { hashSecret } from '#/server/security/secret'
import { accountScopeBrand } from './account-authority-lib/scope'
import type { AccountAuthScope, ProofRevision } from './account-authority-lib/scope'
import type { AccountAuthDatabase as Database } from '#/server/auth/account-authority-lib/scope'
import type { BetterAuthPlugin, DBAdapter, DBTransactionAdapter } from 'better-auth'

interface RequestAuthority {
  readonly fence: number
  readonly proofs: Map<string, ProofRevision>
  readonly passwordEntry: boolean
  readonly provisional: Array<{ scope: AccountAuthScope; proof: ProofRevision; id: string; token: string }>
}
const authority = new AsyncLocalStorage<RequestAuthority>()
const identity = z.object({ id: z.string().min(1) })
const nativeSession = z.object({ id: z.string(), userId: z.string(), token: z.string() }).passthrough()
const nativeVerification = z.object({ identifier: z.string(), value: z.string(), expiresAt: z.coerce.date() }).passthrough()

/** Only native identity results reach this constructor; operation inputs never select an account. */
function scopeFor(db: Database, userId: string): AccountAuthScope {
  return { [accountScopeBrand]: true, db, userId }
}

export function createAccountAuthority(db: Database, enforced: () => boolean) {
  async function boundary<T>(run: () => Promise<T>, passwordEntry = false): Promise<T> {
    if (authority.getStore()) return run()
    const fence = await readEntryFence(db, !enforced())
    const state: RequestAuthority = { fence, proofs: new Map(), passwordEntry, provisional: [] }
    return authority.run(state, async () => {
      const result = await run()
      let body: unknown = result
      if (result instanceof Response) body = result.ok ? await result.clone().json().catch(() => null) : null
      if (typeof body === 'object' && body !== null && 'response' in body) body = body.response
      const success = z.object({ token: z.string(), user: identity }).safeParse(body)
      if (success.success) for (const pending of state.provisional) {
        if (pending.token !== success.data.token || pending.scope.userId !== success.data.user.id) continue
        await promotePasswordSession(pending.scope, pending.id, pending.proof)
        if (enforced() && !await acceptedSession(pending.scope, pending.token, Date.now())) throw new AccountAuthorityError()
      }
      return result
    })
  }

  async function bind(userId: string): Promise<{ scope: AccountAuthScope; proof: ProofRevision }> {
    const state = authority.getStore()
    if (!state) throw new AccountAuthorityError()
    const scope = scopeFor(db, userId)
    const current = await readAccountProof(scope, state.fence, !enforced())
    const previous = state.proofs.get(userId)
    if (previous && previous.revision !== current.revision) throw new AccountAuthorityError()
    const proof = previous ?? current
    state.proofs.set(userId, proof)
    return { scope, proof }
  }

  async function checkSession(value: unknown): Promise<boolean> {
    const candidate = z.object({ session: nativeSession }).safeParse(value)
    if (!candidate.success) return false
    if (!enforced()) return true
    return (await acceptedSession(scopeFor(db, candidate.data.session.userId), candidate.data.session.token, Date.now())) !== null
  }

  async function verification(identifier: string): Promise<boolean> {
    if (!enforced() || !/^(trust-device-|2fa-(?!attempts-|otp-))/.test(identifier)) return true
    const trust = identifier.startsWith('trust-device-')
    const found = await verificationProof(db, await hashSecret(identifier), trust, Date.now())
    if (!found) { if (trust) return false; throw new AccountAuthorityError() }
    const bound = await bind(found.userId)
    if (!trust && bound.proof.revision !== found.proof.revision) throw new AccountAuthorityError()
    if (bound.proof.trustRevision !== found.proof.trustRevision) throw new AccountAuthorityError()
    if (!trust) authority.getStore()?.proofs.set(found.userId, found.proof)
    return true
  }

  const plugin: BetterAuthPlugin = {
    id: 'account-authority',
    hooks: { before: [{ matcher: (ctx) => ctx.path === '/revoke-other-sessions', handler: createAuthMiddleware(async () => {
      if (enforced()) throw APIError.from('CONFLICT', { code: 'ACCOUNT_SECURITY_REGISTRATION_REQUIRED', message: 'Register and confirm this operation before revoking sessions.' })
    }) }] },
  }

  type InternalAdapter = Parameters<NonNullable<BetterAuthPlugin['init']>>[0]['internalAdapter']
  function wrapInternal(original: InternalAdapter): InternalAdapter {
      const wrapped = new Proxy(original, {
        get(target, property, receiver) {
          const method = Reflect.get(target, property, receiver)
          if (typeof method !== 'function') return method
          return async (...args: Array<unknown>) => {
            const name = String(property)
            if ((name === 'findVerificationValue' || name === 'consumeVerificationValue') && typeof args[0] === 'string' && !await verification(args[0])) return null
            if (name === 'updateSession' && enforced() && typeof args[0] === 'string') {
              const current: unknown = await original.findSession(args[0])
              if (!await checkSession(current)) throw new AccountAuthorityError()
            }
            let bound: Awaited<ReturnType<typeof bind>> | undefined
            if (name === 'createSession' && typeof args[0] === 'string') bound = await bind(args[0])
            if (name === 'createVerificationValue') {
              const input = nativeVerification.safeParse(args[0])
              if (input.success && /^(trust-device-|2fa-(?!attempts-|otp-))/.test(input.data.identifier)) bound = await bind(input.data.value)
            }
            const result: unknown = await Reflect.apply(method, target, args)
            if (name === 'createUser' || name === 'createOAuthUser') {
              const direct = identity.safeParse(result)
              const nested = z.object({ user: identity }).safeParse(result)
              const userId = direct.success ? direct.data.id : nested.success ? nested.data.user.id : null
              if (userId) await initializeAccount(scopeFor(db, userId))
            }
            if (['findUserById', 'findUserByEmail', 'findAccountOwnerByKey'].includes(name)) {
              const direct = identity.safeParse(result)
              const nested = z.object({ user: identity }).safeParse(result)
              const userId = direct.success ? direct.data.id : nested.success ? nested.data.user.id : null
              if (userId) await bind(userId)
            }
            if (name === 'createSession' && bound) {
              const created = nativeSession.parse(result)
              if (authority.getStore()?.passwordEntry) authority.getStore()?.provisional.push({ ...bound, id: created.id, token: created.token })
              else if (enforced() && !await acceptedSession(bound.scope, created.token, Date.now())) throw new AccountAuthorityError()
            }
            if (name === 'createVerificationValue' && bound) {
              const created = nativeVerification.parse(result)
              await recordVerificationProof(bound.scope, await hashSecret(created.identifier), bound.proof, created.expiresAt.getTime())
            }
            if ((name === 'findSession' || name === 'updateSession') && result !== null && enforced()) {
              if (name === 'findSession') return await checkSession(result) ? result : null
              const updated = nativeSession.safeParse(result)
              if (!updated.success || !await acceptedSession(scopeFor(db, updated.data.userId), updated.data.token, Date.now())) throw new AccountAuthorityError()
            }
            if (name === 'findSessions' && Array.isArray(result) && enforced()) {
              const filtered: Array<unknown> = []
              for (const value of result) if (await checkSession(value)) filtered.push(value)
              return filtered
            }
            return result
          }
        },
      })
      return wrapped
  }

  function wrap<T extends { handler: (request: Request) => Promise<Response>; api: object; $context: Promise<{ internalAdapter: InternalAdapter }> }>(auth: T): T {
    // Plugin init overrides are rebuilt by Better Auth after all init hooks; install once afterwards.
    const installed = auth.$context.then((context) => { context.internalAdapter = wrapInternal(context.internalAdapter) })
    const api = new Proxy(auth.api, {
      get(target, property, receiver) {
        const method = Reflect.get(target, property, receiver)
        if (typeof method !== 'function') return method
        return Object.assign((...args: Array<unknown>) => boundary(async () => { await installed; return Reflect.apply(method, target, args) }, property === 'signInEmail'), method)
      },
    })
    return { ...auth, api, handler: (request: Request) => boundary(async () => { await installed; return auth.handler(request) }, new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/sign-in/email')) }
  }

  function guardRows<T extends DBTransactionAdapter>(adapter: T): T {
    const guarded = { ...adapter,
      delete: async (input: Parameters<DBAdapter['delete']>[0]) => {
        if (input.model !== 'session' || !enforced()) return adapter.delete(input)
        await deleteNativeSessionRows(db, input.where)
      },
      deleteMany: async (input: Parameters<DBAdapter['deleteMany']>[0]) => {
        if (input.model !== 'session' || !enforced()) return adapter.deleteMany(input)
        return deleteNativeSessionRows(db, input.where)
      },
    }
    return new Proxy(guarded, {
      get(target, property, receiver) {
        if (property !== 'create') return Reflect.get(target, property, receiver)
        return async (input: Parameters<DBAdapter['create']>[0]) => {
          if (input.model === 'verification') {
            const value = nativeVerification.safeParse(input.data)
            if (value.success && /^(trust-device-|2fa-(?!attempts-|otp-))/.test(value.data.identifier)) {
              const bound = await bind(value.data.value)
              const dates = z.object({ id: z.string().optional(), createdAt: z.coerce.date(), updatedAt: z.coerce.date() }).parse(input.data)
              return insertNativeVerification(bound.scope, { ...value.data, ...dates, id: dates.id ?? nanoid(24) }, await hashSecret(value.data.identifier), bound.proof)
            }
          }
          if (input.model !== 'session') return adapter.create(input)
          const parsed = z.object({
            id: z.string().optional(), token: z.string(), userId: z.string(),
            activeOrganizationId: z.string().nullable().optional(), ipAddress: z.string().nullable().optional(),
            userAgent: z.string().nullable().optional(), impersonatedBy: z.string().nullable().optional(),
            expiresAt: z.coerce.date(), createdAt: z.coerce.date(), updatedAt: z.coerce.date(),
          }).parse(input.data)
          const { scope, proof } = await bind(parsed.userId)
          return insertNativeSession(scope, { ...parsed, id: parsed.id ?? nanoid(24), activeOrganizationId: parsed.activeOrganizationId ?? null, ipAddress: parsed.ipAddress ?? null, userAgent: parsed.userAgent ?? null, impersonatedBy: parsed.impersonatedBy ?? null }, proof, authority.getStore()?.passwordEntry ? 'password-pending' : 'native', Date.now())
        }
      },
    })
  }
  function guardAdapter(adapter: DBAdapter): DBAdapter {
    return { ...guardRows(adapter), transaction: (callback) => adapter.transaction((transaction) => callback(guardRows(transaction))) }
  }
  return { boundary, bind, checkSession, plugin, wrap, guardAdapter }
}

/** The system capability is minted only from bounded pending-work discovery, never request input. */
export async function discoverAccountCleanup(db: Database) {
  return (await pendingOperations(db)).map((operation) => ({
    operation,
    scope: { [accountScopeBrand]: true as const, db, userId: operation.userId },
  }))
}

/** A queue acknowledgement cannot name an account outside its recorded operation/room target. */
export async function acknowledgeAccountRoomEviction(db: Database, id: string, userId: string, organizationId: string): Promise<void> {
  await acknowledgeRoomTarget(db, id, userId, organizationId)
}
