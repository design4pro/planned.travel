/** Owner-only invite RPCs. Secrets are projected explicitly and never returned by update. */
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { authSecret } from '#/server/auth/env'
import { trail } from '#/server/audit/trail'
import { RepositoryError, TripRoleError } from '#/server/repos'
import {
  createTripInvite,
  readTripInvite,
  replaceTripInvite,
  revealTripInviteSecret,
  updateTripInvite,
} from '#/server/repos/invites'
import { appScope } from '../../../-server/context'
import type { TripInviteView } from '#/server/repos/invites'
import type { TenantScope } from '#/server/repos'

const privateResponse = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    setResponseHeader('cache-control', 'private, no-store')
    return next()
  },
)

const tripId = z.string({ error: 'tripId' }).trim().min(1).max(64)
const role = z.enum(['editor', 'viewer'], { error: 'role' })
const expectedRotation = z
  .number({ error: 'expectedRotation' })
  .int()
  .nonnegative()
const readInput = z.strictObject({ tripId })
const createInput = z.strictObject({ tripId, role: role.default('viewer') })
const replaceInput = z.strictObject({ tripId, role, expectedRotation })
const updateInput = z.strictObject({
  tripId,
  role: role.optional(),
  enabled: z.boolean({ error: 'enabled' }).optional(),
  expectedRotation,
})
export type InviteRefusal =
  'archived' | 'notOwner' | 'changed' | 'creatorGone' | 'unavailable'
export type InviteAnswer<T = object> =
  | ({ readonly ok: true; readonly invite: TripInviteView | null } & T)
  | { readonly ok: false; readonly reason: InviteRefusal }

async function attempt<T>(
  work: (scope: TenantScope, key: string) => Promise<T>,
): Promise<T | { readonly ok: false; readonly reason: InviteRefusal }> {
  setResponseHeader('cache-control', 'private, no-store')
  try {
    return await work(await appScope(), authSecret())
  } catch (cause) {
    if (cause instanceof RepositoryError) {
      if (cause.code === 'TRIP_ARCHIVED')
        return { ok: false, reason: 'archived' }
      if (cause instanceof TripRoleError)
        return { ok: false, reason: 'notOwner' }
      if (cause.code === 'NOT_FOUND' || cause.code === 'FORBIDDEN')
        return { ok: false, reason: 'unavailable' }
    }
    throw cause
  }
}

export const revealInviteLinkFn = createServerFn({ method: 'POST' })
  .middleware([privateResponse])
  .validator(readInput)
  .handler(async ({ data }): Promise<InviteAnswer<{ secret: string | null }>> =>
    attempt(async (scope, key) => {
      const invite = await readTripInvite(scope, data.tripId, key)
      const secret = await revealTripInviteSecret(scope, data.tripId, key)
      return { ok: true as const, invite, secret }
    }),
  )

export const createInviteLinkFn = createServerFn({ method: 'POST' })
  .middleware([privateResponse])
  .validator(createInput)
  .handler(async ({ data }): Promise<InviteAnswer<{ secret: string | null }>> =>
    attempt(async (scope, key) => {
      const result = await createTripInvite(scope, data.tripId, {
        role: data.role,
        key,
      })
      await trail(scope, {
        action: 'trip_invite.rotated',
        entityType: 'trip',
        entityId: data.tripId,
        metadata: { inviteId: result.invite.id, role: result.invite.role },
      })
      return { ok: true as const, invite: result.invite, secret: result.secret }
    }),
  )

export const replaceInviteLinkFn = createServerFn({ method: 'POST' })
  .middleware([privateResponse])
  .validator(replaceInput)
  .handler(async ({ data }): Promise<InviteAnswer<{ secret: string | null }>> =>
    attempt(async (scope, key) => {
      const result = await replaceTripInvite(scope, data.tripId, {
        role: data.role,
        expectedRotation: data.expectedRotation,
        key,
      })
      if (!result.ok) return { ok: false as const, reason: result.reason }
      await trail(scope, {
        action: 'trip_invite.rotated',
        entityType: 'trip',
        entityId: data.tripId,
        metadata: { inviteId: result.invite.id, role: result.invite.role },
      })
      return { ok: true as const, invite: result.invite, secret: result.secret }
    }),
  )

export const updateInviteLinkFn = createServerFn({ method: 'POST' })
  .middleware([privateResponse])
  .validator(updateInput)
  .handler(async ({ data }): Promise<InviteAnswer> =>
    attempt(async (scope, key) => {
      const result = await updateTripInvite(scope, data.tripId, {
        role: data.role,
        enabled: data.enabled,
        expectedRotation: data.expectedRotation,
        key,
      })
      if (!result.ok) return { ok: false as const, reason: result.reason }
      await trail(scope, {
        action:
          data.enabled === true ? 'trip_invite.rotated' : 'trip_invite.updated',
        entityType: 'trip',
        entityId: data.tripId,
        metadata: { inviteId: result.invite.id, role: result.invite.role },
      })
      return { ok: true as const, invite: result.invite }
    }),
  )
