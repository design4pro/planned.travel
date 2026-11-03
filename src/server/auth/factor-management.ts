import {
  APIError,
  createAuthEndpoint,
  sessionMiddleware,
} from 'better-auth/api'
import { z } from 'zod'
import { hashSecret } from '#/server/security/secret'
import {
  commitRevocation,
  operationFor,
  pendingRegistration,
  receiptStatus,
  registerRevocation,
} from '#/server/repos/account-security'
import type { BetterAuthPlugin } from 'better-auth'
import type { AccountAuthDatabase as Database } from '#/server/auth/account-authority-lib/scope'
import type { createAccountAuthority } from './account-authority'

const intent = z.string().uuid()
const operationInput = z
  .object({ id: z.string().uuid(), intent, confirm: z.literal(true) })
  .strict()
const receiptPattern = /^([0-9a-f-]{36})\.([0-9a-f-]{36})$/

function refused(): never {
  throw APIError.from('FORBIDDEN', {
    code: 'ACCOUNT_SECURITY_REFUSED',
    message: 'settings.security.other.refused',
  })
}

function outcomeOf(
  operation: NonNullable<Awaited<ReturnType<typeof receiptStatus>>>,
  now: number,
) {
  let status: 'unknown' | 'refused' | 'committed' = 'committed'
  if (operation.committedAt === null)
    status = operation.expiresAt <= now ? 'refused' : 'unknown'
  return { status, cleanupPending: operation.cleanupPending }
}

export function accountSessionManagement(
  db: Database,
  authority: ReturnType<typeof createAccountAuthority>,
  enabled: () => boolean,
  cleanup: () => Promise<void>,
): BetterAuthPlugin {
  return {
    id: 'account-session-management',
    endpoints: {
      otherDeviceRevocationAvailability: createAuthEndpoint(
        '/account-security/availability',
        { method: 'GET', use: [sessionMiddleware] },
        async (ctx) => {
          ctx.setHeader('cache-control', 'no-store')
          const cookie = ctx.context.createAuthCookie(
            'account_security_receipt',
            { path: '/api/auth/account-security' },
          )
          const receipt = await ctx.getSignedCookie(
            cookie.name,
            ctx.context.secret,
          )
          const id = receipt && receiptPattern.exec(receipt)?.[1]
          const previous =
            id && receipt
              ? await receiptStatus(
                  db,
                  id,
                  await hashSecret(receipt),
                  Date.now(),
                )
              : null
          let ownerMatches = false
          if (previous && id) {
            const { scope } = await authority.bind(ctx.context.session.user.id)
            ownerMatches = (await operationFor(scope, id)) !== null
          }
          return ctx.json({
            available: enabled(),
            recovery:
              previous && id && ownerMatches
                ? { id, ...outcomeOf(previous, Date.now()) }
                : null,
          })
        },
      ),
      registerOtherDeviceRevocation: createAuthEndpoint(
        '/account-security/register-operation',
        {
          method: 'POST',
          body: z.object({ intent }).strict(),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          if (!enabled()) refused()
          if (
            ctx.headers?.get('origin') !== new URL(ctx.context.baseURL).origin
          )
            refused()
          const current = ctx.context.session
          const now = Date.now()
          if (
            current.session.impersonatedBy ||
            current.session.createdAt.getTime() <= now - 300_000 ||
            current.session.createdAt.getTime() > now
          )
            refused()
          if (!(await authority.checkSession(current))) refused()
          const { scope, proof } = await authority.bind(current.user.id)
          if (await pendingRegistration(scope, current.session.id, now))
            refused()
          const id = crypto.randomUUID()
          const receipt = `${id}.${crypto.randomUUID()}`
          await registerRevocation(scope, {
            id,
            sessionId: current.session.id,
            intent: ctx.body.intent,
            receiptDigest: await hashSecret(receipt),
            revision: proof.revision,
            expiresAt: now + 300_000,
          })
          const cookie = ctx.context.createAuthCookie(
            'account_security_receipt',
            {
              httpOnly: true,
              sameSite: 'strict',
              path: '/api/auth/account-security',
              maxAge: 1200,
            },
          )
          await ctx.setSignedCookie(
            cookie.name,
            receipt,
            ctx.context.secret,
            cookie.attributes,
          )
          ctx.setHeader('cache-control', 'no-store')
          return ctx.json({ id, status: 'registered' as const })
        },
      ),
      commitOtherDeviceRevocation: createAuthEndpoint(
        '/account-security/revoke-other-sessions',
        {
          method: 'POST',
          body: operationInput,
          use: [sessionMiddleware],
        },
        async (ctx) => {
          if (!enabled()) refused()
          if (
            ctx.headers?.get('origin') !== new URL(ctx.context.baseURL).origin
          )
            refused()
          const cookie = ctx.context.createAuthCookie(
            'account_security_receipt',
            { path: '/api/auth/account-security' },
          )
          const receipt = await ctx.getSignedCookie(
            cookie.name,
            ctx.context.secret,
          )
          if (!receipt || receiptPattern.exec(receipt)?.[1] !== ctx.body.id)
            refused()
          const current = ctx.context.session
          if (
            current.session.impersonatedBy ||
            !(await authority.checkSession(current))
          )
            refused()
          const { scope } = await authority.bind(current.user.id)
          const operation = await operationFor(scope, ctx.body.id)
          if (
            !operation ||
            operation.sessionId !== current.session.id ||
            operation.intent !== ctx.body.intent ||
            operation.receiptDigest !== (await hashSecret(receipt))
          )
            refused()
          if (
            !(await receiptStatus(
              db,
              operation.id,
              operation.receiptDigest,
              Date.now(),
            ))
          )
            refused()
          ctx.setHeader('cache-control', 'no-store')
          if (operation.committedAt !== null)
            return ctx.json({
              status: 'committed' as const,
              cleanupPending: operation.cleanupPending,
            })
          const committed = await commitRevocation(scope, {
            id: operation.id,
            sessionId: current.session.id,
            token: current.session.token,
            intent: ctx.body.intent,
            claim: crypto.randomUUID(),
            now: Date.now(),
          })
          if (committed) {
            try {
              await cleanup()
            } catch {
              /* Durable pending intent is recovered by the scheduled sweep. */
            }
          }
          const settled = await operationFor(scope, operation.id)
          return ctx.json({
            status: committed ? ('committed' as const) : ('refused' as const),
            cleanupPending: settled?.cleanupPending ?? committed,
          })
        },
      ),
      otherDeviceRevocationStatus: createAuthEndpoint(
        '/account-security/operation-status',
        {
          method: 'GET',
          query: z.object({ id: z.string().uuid() }).strict(),
        },
        async (ctx) => {
          const cookie = ctx.context.createAuthCookie(
            'account_security_receipt',
            { path: '/api/auth/account-security' },
          )
          const receipt = await ctx.getSignedCookie(
            cookie.name,
            ctx.context.secret,
          )
          if (!receipt || receiptPattern.exec(receipt)?.[1] !== ctx.query.id)
            refused()
          const operation = await receiptStatus(
            db,
            ctx.query.id,
            await hashSecret(receipt),
            Date.now(),
          )
          if (!operation) refused()
          ctx.setHeader('cache-control', 'no-store')
          return ctx.json(outcomeOf(operation, Date.now()))
        },
      ),
    },
  }
}
