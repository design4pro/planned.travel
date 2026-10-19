/** Authenticated product orchestration; the auth adapter owns the sole, atomic deletion. */
import { z } from 'zod'
import { withMemberDeletion } from '#/server/auth/member-deletion'
import {
  getMembership,
  idSchema,
  membersRepository,
  removeMember,
  RepositoryError,
} from '#/server/repos'
import type { TenantScope } from '#/server/repos'

export const memberDepartureInput = z.strictObject({
  memberId: idSchema.optional(),
})
export type MemberDepartureResult =
  | {
      readonly ok: true
      readonly left: boolean
      readonly activationFailed: boolean
    }
  | {
      readonly ok: false
      readonly reason:
        'impersonated' | 'not-found' | 'not-permitted' | 'last-owner'
    }
export interface DeparturePorts {
  readonly impersonated: boolean
  readonly scope: () => Promise<TenantScope>
  readonly remove: (
    organizationId: string,
    memberId: string,
    self: boolean,
  ) => Promise<unknown>
  readonly repairOffboarding: (
    userId: string,
    organizationId: string,
  ) => Promise<void>
  readonly activateRemaining: (userId: string) => Promise<void>
}
export async function departMember(
  ports: DeparturePorts,
  input: z.infer<typeof memberDepartureInput>,
): Promise<MemberDepartureResult> {
  if (ports.impersonated) return { ok: false, reason: 'impersonated' }
  const scope = await ports.scope()
  const own = await getMembership(scope, scope.ctx.userId)
  if (!own) return { ok: false, reason: 'not-permitted' }
  const target = input.memberId
    ? await membersRepository.findById(scope, input.memberId)
    : own
  if (!target) return { ok: false, reason: 'not-found' }
  const self = target.userId === scope.ctx.userId
  const actorRoles = own.role.split(',').map((role) => role.trim())
  const targetOwns = target.role
    .split(',')
    .some((role) => role.trim() === 'owner')
  if (
    !self &&
    !actorRoles.includes('owner') &&
    (!actorRoles.includes('admin') || targetOwns)
  ) {
    return { ok: false, reason: 'not-permitted' }
  }
  const result = await withMemberDeletion(
    target.id,
    () => removeMember(scope, target.id, true),
    () => ports.remove(scope.ctx.organizationId, target.id, self),
  )
  if (!result.committed) {
    const cause = result.error
    if (cause instanceof RepositoryError) {
      if (cause.code === 'MEMBERSHIP_COMMIT_UNKNOWN') {
        // A lost write response plus unavailable reconciliation must still revoke live room access.
        // Eviction is safe if the batch rolled back: current members can reconnect after auth checks.
        await ports.repairOffboarding(target.userId, scope.ctx.organizationId)
        throw cause
      }
      if (cause.code === 'LAST_OWNER')
        return { ok: false, reason: 'last-owner' }
      if (cause.code === 'NOT_FOUND') return { ok: false, reason: 'not-found' }
      if (cause.code === 'FORBIDDEN')
        return { ok: false, reason: 'not-permitted' }
    }
    // Better Auth can refuse the sole owner before reaching the conditional adapter write.
    const parsed = z
      .object({ body: z.object({ code: z.string() }) })
      .safeParse(cause)
    if (
      parsed.data?.body.code ===
      'YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER'
    )
      return { ok: false, reason: 'last-owner' }
    if (parsed.data?.body.code === 'MEMBER_NOT_FOUND')
      return { ok: false, reason: 'not-found' }
    if (parsed.data?.body.code === 'YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER')
      return { ok: false, reason: 'not-permitted' }
    if (cause) throw cause
    throw new Error('Auth operation did not delete its bound membership.')
  }
  if (result.error)
    await ports.repairOffboarding(target.userId, scope.ctx.organizationId)
  let activationFailed = false
  if (self) {
    try {
      await ports.activateRemaining(scope.ctx.userId)
    } catch {
      activationFailed = true
    }
  }
  return { ok: true, left: self, activationFailed }
}
