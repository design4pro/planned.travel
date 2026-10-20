import {
  APIError,
  createAuthMiddleware,
  getSession,
  isAPIError,
} from 'better-auth/api'
import { z } from 'zod'
import type { BetterAuthPlugin } from 'better-auth'

const PATHS = new Set([
  '/two-factor/enable',
  '/two-factor/get-totp-uri',
  '/two-factor/generate-backup-codes',
  '/two-factor/disable',
  '/change-password',
  '/passkey/delete',
])
const LIMIT = 5
const stateSchema = z.object({
  count: z.number().int().min(0).max(LIMIT),
  pending: z.boolean(),
  version: z.string().min(1),
})
type Reservation = {
  id: string
  value: string
  count: number
  checksPassword: boolean
}
type AttemptContext = { passwordAttemptReservation?: Reservation }

function locked() {
  return APIError.from('FORBIDDEN', {
    code: 'PASSWORD_ATTEMPTS_LOCKED',
    message: 'This session can no longer confirm a password',
  })
}

/**
 * Password attempts are serialized in D1, never KV. A crashed request leaves its session closed;
 * another session can still recover. The distant expiry survives rolling session extensions so
 * verification cleanup cannot silently unlock a live session. No credential or token is stored.
 */
export const passwordAttempts = {
  id: 'session-password-attempts',
  hooks: {
    before: [
      {
        matcher: (ctx) => PATHS.has(ctx.path ?? ''),
        handler: createAuthMiddleware(async (ctx) => {
          try {
            let session = ctx.context.session
            if (!session) {
              const result = await getSession()({
                ...ctx,
                method: 'GET',
                asResponse: false,
                headers: ctx.headers ?? new Headers(),
                returnHeaders: true,
                returnStatus: false,
                query: { ...ctx.query, disableCookieCache: true },
              })
              result.headers.forEach((value, key) => {
                if (key.toLowerCase() === 'set-cookie')
                  ctx.responseHeaders.append(key, value)
              })
              session = result.response
              ctx.context.session = session
            }
            if (!session) {
              throw APIError.from('UNAUTHORIZED', {
                code: 'UNAUTHORIZED',
                message: 'Unauthorized',
              })
            }
            const checksPassword =
              ctx.path !== '/passkey/delete' ||
              Boolean(
                (
                  await ctx.context.internalAdapter.findCredentialAccount(
                    session.user.id,
                  )
                )?.password,
              )
            const id = `password-attempts:${session.session.id}`
            const adapter = ctx.context.adapter
            const row = await adapter.findOne<{ value: string }>({
              model: 'verification',
              where: [{ field: 'id', value: id }],
            })
            let count = 0
            if (row) {
              const state = stateSchema.parse(JSON.parse(row.value))
              if (state.pending || state.count >= LIMIT) throw locked()
              count = state.count
            }
            const value = JSON.stringify({
              count,
              pending: true,
              version: crypto.randomUUID(),
            })
            if (row) {
              const updated = await adapter.update({
                model: 'verification',
                where: [
                  { field: 'id', value: id },
                  { field: 'value', value: row.value },
                ],
                update: { value },
              })
              if (!updated) throw locked()
            } else {
              const created = await adapter.create({
                model: 'verification',
                forceAllowId: true,
                data: {
                  id,
                  identifier: id,
                  value,
                  expiresAt: new Date('9999-12-31T00:00:00Z'),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              })
              if (created?.id !== id || created.value !== value) throw locked()
            }
            const attemptContext = ctx.context as typeof ctx.context &
              AttemptContext
            attemptContext.passwordAttemptReservation = {
              id,
              value,
              count,
              checksPassword,
            }
          } catch (cause) {
            if (isAPIError(cause) && cause.body?.code === 'UNAUTHORIZED')
              throw cause
            throw locked()
          }
        }),
      },
    ],
    after: [
      {
        matcher: (ctx) => PATHS.has(ctx.path ?? ''),
        handler: createAuthMiddleware(async (ctx) => {
          const reservation = (
            ctx.context as typeof ctx.context & AttemptContext
          ).passwordAttemptReservation
          if (!reservation) return
          const result = ctx.context.returned
          let count = reservation.checksPassword ? 0 : reservation.count
          if (isAPIError(result)) {
            count = reservation.count
            if (
              result.body?.code === 'INVALID_PASSWORD' ||
              result.body?.code === 'PASSKEY_INVALID_PASSWORD'
            )
              count++
          }
          try {
            const updated = await ctx.context.adapter.update({
              model: 'verification',
              where: [
                { field: 'id', value: reservation.id },
                { field: 'value', value: reservation.value },
              ],
              update: {
                value: JSON.stringify({
                  count,
                  pending: false,
                  version: crypto.randomUUID(),
                }),
              },
            })
            if (!updated) throw locked()
          } catch {
            if (!isAPIError(result)) {
              throw APIError.from('FORBIDDEN', {
                code: 'PASSWORD_ATTEMPTS_RESULT_UNKNOWN',
                message:
                  'The action may have completed; sign in again and check security settings',
              })
            }
            throw locked()
          }
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin
