/**
 * Recipient consumption of an existing workspace invitation. The sole production caller of
 * resolveWorkspaceInvitationScopeUnscoped is auth/organization-invitations.ts. Before membership
 * exists it resolves only an organization id, using the authenticated user's current email (FU-3).
 * This leaf never imports auth runtime; only its recipient operations may use the delegated scope.
 */
import { and, eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { invitation, member, user } from '#/server/db/auth-schema'
import { workspaceParticipants } from '#/server/db/schema'
import {
  allOf,
  createTenantRepository,
  prepareTenantInsert,
  tenantFilter,
} from './base'
import { runAtomicBatch } from './batch'
import type { Database } from '#/server/db/types'
import type { TenantScope } from './base'

const invitations = createTenantRepository(invitation, 'invitation')
const members = createTenantRepository(member, 'member')

export async function resolveWorkspaceInvitationScopeUnscoped(
  db: Database,
  invitationId: string,
  recipientId: string,
) {
  const rows = await db
    .select({ organizationId: invitation.organizationId })
    .from(invitation)
    .innerJoin(
      user,
      and(
        eq(user.id, recipientId),
        sql`lower(${user.email}) = lower(${invitation.email})`,
      ),
    )
    .where(eq(invitation.id, invitationId))
    .limit(1)
  return rows[0] ?? null
}

function recipient(scope: TenantScope) {
  return sql`exists (select 1 from ${user} where ${user.id} = ${scope.ctx.userId}
    and ${user.emailVerified} = 1 and lower(${user.email}) = lower(${invitation.email}))`
}

/** Transfers an already reserved seat, including its erasure anchor, in one atomic driver batch. */
export async function acceptWorkspaceInvitation(
  scope: TenantScope,
  invitationId: string,
  now: Date,
) {
  const source = await invitations.findById(scope, invitationId)
  if (!source?.role) return null
  const id = nanoid()
  const eligible = tenantFilter(
    scope,
    invitation,
    eq(invitation.id, invitationId),
    eq(invitation.status, 'pending'),
    eq(invitation.role, source.role),
    sql`${invitation.expiresAt} >= ${now.getTime()}`,
    recipient(scope),
    sql`${invitation.role} in ('member', 'admin', 'owner')`,
  )
  const winningMember = sql`exists (select 1 from ${member} where ${tenantFilter(
    scope,
    member,
    eq(member.id, id),
    eq(member.userId, scope.ctx.userId),
  )})`
  await runAtomicBatch(scope, [
    prepareTenantInsert(
      scope,
      member,
      {
        id,
        userId: scope.ctx.userId,
        createdAt: now,
        role: source.role,
      },
      sql`exists (select 1 from ${invitation} where ${eligible})
      and (select count(*) from ${member} where ${tenantFilter(scope, member)}) < 100
      and not exists (select 1 from ${member} where ${tenantFilter(scope, member, eq(member.userId, scope.ctx.userId))})`,
    ),
    prepareTenantInsert(
      scope,
      workspaceParticipants,
      { userId: scope.ctx.userId },
      winningMember,
    ).onConflictDoNothing(),
    scope.db
      .update(invitation)
      .set({ status: 'accepted' })
      .where(and(eligible, winningMember)),
  ])
  const joined = await members.findById(scope, id)
  const accepted = await invitations.findById(scope, invitationId)
  if (!joined || accepted?.status !== 'accepted' || !accepted.role) return null
  return {
    invitation: {
      ...accepted,
      role: accepted.role,
      status: 'accepted' as const,
    },
    member: joined,
  }
}

/** A stale rejection can never overwrite an accepted, revoked or previously rejected invitation. */
export async function rejectWorkspaceInvitation(
  scope: TenantScope,
  invitationId: string,
) {
  const rows = await invitations.updateWhere(
    scope,
    allOf(
      eq(invitation.id, invitationId),
      eq(invitation.status, 'pending'),
      recipient(scope),
    ),
    { status: 'rejected' },
  )
  const row = rows[0]
  return row && row.role
    ? { ...row, role: row.role, status: 'rejected' as const }
    : null
}
