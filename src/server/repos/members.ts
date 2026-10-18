/**
 * Membership — the workspace itself, who is in it, and who has been invited.
 *
 * These three tables are written by Better Auth's organization plugin as well as by this repository
 * (`src/server/db/auth-schema.ts`), so everything here is deliberately defensive: seat quota, "never
 * remove the last owner", and role changes gated behind {@link assertCanAdminister}.
 *
 * `organization` is the one tenant table whose discriminator *is* its primary key, so its scoping
 * predicate is `id = <scope>` rather than `organization_id = <scope>`. There is no code path that
 * reads it without that predicate.
 */

import { and, asc, count, eq, exists, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  INVITATION_STATUSES,
  ORGANIZATION_ROLES,
  invitation,
  member,
  organization,
  user,
} from '#/server/db/auth-schema'
import { newId } from '#/server/db/schema'
import { allOf, assertQuota, createTenantRepository, tenantFilter } from './base'
import {
  ForbiddenError,
  NotFoundError,
  RepositoryError,
  assertCanAdminister,
} from './context'
import { definedOnly, idSchema, instantSchema, shortTextSchema, titleSchema } from './validation'
import type { Invitation, Member, Organization, OrganizationRole } from '#/server/db/types'
import type { SQL } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { TenantScope } from './base'

export const membersRepository = createTenantRepository(member, 'member')
export const invitationsRepository = createTenantRepository(invitation, 'invitation')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const roleSchema = z.enum(ORGANIZATION_ROLES)

export const updateOrganizationInput = z.object({
  name: titleSchema.optional(),
  logo: shortTextSchema.nullish(),
  metadata: z.string().trim().max(4000).nullish(),
})
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationInput>

export const addMemberInput = z.object({
  userId: idSchema,
  role: roleSchema.optional(),
})
export type AddMemberInput = z.infer<typeof addMemberInput>

export const createInvitationInput = z.object({
  email: z.string().trim().min(3).max(320).toLowerCase(),
  role: roleSchema.optional(),
  expiresAt: instantSchema,
})
export type CreateInvitationInput = z.infer<typeof createInvitationInput>

/* -------------------------------------------------------------------------------------------------
 * The workspace
 * ---------------------------------------------------------------------------------------------- */

export async function getOrganization(scope: TenantScope): Promise<Organization> {
  const rows = await scope.db
    .select()
    .from(organization)
    // The tenant discriminator of this table is its primary key.
    .where(eq(organization.id, scope.ctx.organizationId))
    .limit(1)
  const row = rows.at(0)
  if (row === undefined) {
    throw new NotFoundError('organization', scope.ctx.organizationId)
  }
  return row
}

export async function updateOrganization(
  scope: TenantScope,
  input: UpdateOrganizationInput,
): Promise<Organization> {
  assertCanAdminister(scope.ctx, 'rename the workspace')
  const values = definedOnly(updateOrganizationInput.parse(input))
  const rows = await scope.db
    .update(organization)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(organization.id, scope.ctx.organizationId))
    .returning()
  const row = rows.at(0)
  if (row === undefined) {
    throw new NotFoundError('organization', scope.ctx.organizationId)
  }
  return row
}

/* -------------------------------------------------------------------------------------------------
 * Members
 * ---------------------------------------------------------------------------------------------- */

export async function listMembers(scope: TenantScope): Promise<Array<Member>> {
  return membersRepository.findMany(scope, { orderBy: [asc(member.createdAt)] })
}

export interface MemberProfile {
  readonly memberId: string
  readonly userId: string
  readonly role: OrganizationRole
  readonly name: string
  readonly email: string
  readonly image: string | null
  readonly joinedAt: Date
}

/**
 * The member list with the profile fields the UI shows. `user` carries no tenant column of its own —
 * the tenant predicate is applied to `member`, and the join can therefore only reach users who are in
 * this workspace.
 */
export async function listMemberProfiles(scope: TenantScope): Promise<Array<MemberProfile>> {
  const rows = await scope.db
    .select({
      memberId: member.id,
      userId: member.userId,
      role: member.role,
      name: user.name,
      email: user.email,
      image: user.image,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(tenantFilter(scope, member))
    .orderBy(asc(member.createdAt))

  return rows.map((row) => ({
    ...row,
    role: roleSchema.catch('member').parse(row.role),
  }))
}

export async function countMembers(scope: TenantScope): Promise<number> {
  return membersRepository.count(scope)
}

/**
 * Whether the person a column names still holds a `member` row in this workspace, as one correlated
 * `EXISTS`. The single home of "this user still belongs here" for the quotas that leave out what
 * only a departed person could reach: the orphaned journey (#799) and the stranded trip (#810).
 *
 * Worked out inside the query that needs it rather than when a person leaves, because people leave
 * through Better Auth's organization endpoints and through the console deleting the user, neither of
 * which passes through the repositories — and so that the answer reverses when they return.
 */
export function stillInWorkspace(
  scope: TenantScope,
  userId: SQLiteColumn,
): SQL {
  return exists(
    scope.db
      .select({ present: sql`1` })
      .from(member)
      .where(tenantFilter(scope, member, eq(member.userId, userId))),
  )
}

export async function getMembership(
  scope: TenantScope,
  userId: string,
): Promise<Member | null> {
  return membersRepository.findOne(scope, eq(member.userId, idSchema.parse(userId)))
}

/** Adds someone straight to the workspace — used by the invitation-accept flow and by admins. */
export async function addMember(scope: TenantScope, input: AddMemberInput): Promise<Member> {
  assertCanAdminister(scope.ctx, 'add a member')
  const values = addMemberInput.parse(input)

  const existing = await getMembership(scope, values.userId)
  if (existing) {
    return existing
  }
  await assertQuota(scope, 'members', await countMembers(scope))

  return membersRepository.insert(scope, {
    id: newId(),
    userId: values.userId,
    role: values.role ?? 'member',
    createdAt: new Date(),
  })
}

/**
 * Whether a stored role string names an owner. Better Auth's own endpoint accepts a comma-joined
 * list, so a row written through it can hold `admin,owner`; the ceiling reads that as an owner row
 * rather than let an admin treat it as a lesser one.
 */
function holdsOwnerRole(stored: string): boolean {
  return stored.split(',').some((part) => part.trim() === 'owner')
}

/**
 * The roles a caller may set on a row that currently holds `current`: the one place that decides who
 * may grant which role, read by `changeMemberRole` to refuse and by the Workspace console to decide
 * which control a row gets, so the two cannot disagree.
 *
 * An owner may set any role. An admin may move a member or another admin between `admin` and
 * `member`, and may neither grant `owner` nor touch a row that is one - an owner's authority is
 * not an admin's to give or take. A member may set nothing.
 */
export function assignableRoles(
  caller: OrganizationRole,
  current: string,
): ReadonlyArray<OrganizationRole> {
  if (caller === 'owner') return ['owner', 'admin', 'member']
  if (caller === 'admin' && !holdsOwnerRole(current)) return ['admin', 'member']
  return []
}

export interface MemberRoleChange {
  readonly member: Member
  /** The role the row held before this call, for the audit entry. */
  readonly previousRole: string
}

/**
 * Changes a role within the caller's ceiling ({@link assignableRoles}). The workspace must keep at
 * least one owner. Every refusal happens before the write.
 */
export async function changeMemberRole(
  scope: TenantScope,
  memberId: string,
  role: OrganizationRole,
): Promise<MemberRoleChange> {
  assertCanAdminister(scope.ctx, 'change a member role')
  const next = roleSchema.parse(role)
  const row = await membersRepository.requireById(scope, memberId)

  if (!assignableRoles(scope.ctx.role, row.role).includes(next)) {
    throw new ForbiddenError(
      holdsOwnerRole(row.role)
        ? "change an owner's role"
        : `grant the ${next} role`,
      ['owner'],
    )
  }
  if (row.role === 'owner' && next !== 'owner' && (await countOwners(scope, memberId)) === 0) {
    throw new RepositoryError('A workspace needs at least one owner.', 'LAST_OWNER')
  }
  const updated = await membersRepository.requireUpdate(scope, memberId, { role: next })
  if (row.role === 'owner' && next !== 'owner' && (await countOwners(scope)) === 0) {
    // The count above and this write are separate statements, so two owners demoting each other at
    // once each saw the other as the remaining owner. The loser puts the role back rather than leave
    // a workspace nobody can administer or pay for.
    await membersRepository.requireUpdate(scope, memberId, { role: row.role })
    throw new RepositoryError('A workspace needs at least one owner.', 'LAST_OWNER')
  }
  return { member: updated, previousRole: row.role }
}

/** Removes a member. The last owner cannot be removed. */
export async function removeMember(scope: TenantScope, memberId: string): Promise<void> {
  const row = await membersRepository.requireById(scope, memberId)
  if (row.userId !== scope.ctx.userId) {
    assertCanAdminister(scope.ctx, 'remove a member')
  }
  if (row.role === 'owner' && (await countOwners(scope, memberId)) === 0) {
    throw new RepositoryError('A workspace needs at least one owner.', 'LAST_OWNER')
  }
  await membersRepository.requireRemove(scope, memberId)
}

/** Owners other than `exceptMemberId`. */
async function countOwners(scope: TenantScope, exceptMemberId?: string): Promise<number> {
  return membersRepository.count(
    scope,
    and(
      eq(member.role, 'owner'),
      exceptMemberId ? ne(member.id, exceptMemberId) : undefined,
    ),
  )
}

/** Profile lookups for a set of user ids — avatar stacks, expense balances, participant chips. */
export async function listUserProfiles(
  scope: TenantScope,
  userIds: ReadonlyArray<string>,
): Promise<Array<MemberProfile>> {
  const wanted = new Set(z.array(idSchema).max(200).parse([...userIds]))
  if (wanted.size === 0) {
    return []
  }
  const rows = await scope.db
    .select({
      memberId: member.id,
      userId: member.userId,
      role: member.role,
      name: user.name,
      email: user.email,
      image: user.image,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(tenantFilter(scope, member, inArray(member.userId, [...wanted])))

  return rows.map((row) => ({ ...row, role: roleSchema.catch('member').parse(row.role) }))
}

/* -------------------------------------------------------------------------------------------------
 * Invitations
 * ---------------------------------------------------------------------------------------------- */

export async function listInvitations(
  scope: TenantScope,
  options: { readonly status?: (typeof INVITATION_STATUSES)[number] } = {},
): Promise<Array<Invitation>> {
  return invitationsRepository.findMany(scope, {
    where: options.status ? eq(invitation.status, options.status) : undefined,
    orderBy: [asc(invitation.createdAt)],
  })
}

export async function listPendingInvitations(scope: TenantScope): Promise<Array<Invitation>> {
  return listInvitations(scope, { status: 'pending' })
}

/**
 * Invites an email address. Seats are checked against members **plus** outstanding invitations, so a
 * workspace cannot oversubscribe its plan by inviting more people than it can seat.
 */
export async function createInvitation(
  scope: TenantScope,
  input: CreateInvitationInput,
): Promise<Invitation> {
  assertCanAdminister(scope.ctx, 'invite a member')
  const values = createInvitationInput.parse(input)

  const existing = await invitationsRepository.findOne(
    scope,
    allOf(eq(invitation.email, values.email), eq(invitation.status, 'pending')),
  )
  if (existing) {
    return existing
  }

  const [members, pending] = await Promise.all([
    countMembers(scope),
    invitationsRepository.count(scope, eq(invitation.status, 'pending')),
  ])
  await assertQuota(scope, 'members', members + pending)

  return invitationsRepository.insert(scope, {
    id: newId(),
    email: values.email,
    role: values.role ?? 'member',
    status: 'pending',
    inviterId: scope.ctx.userId,
    expiresAt: values.expiresAt,
    createdAt: new Date(),
  })
}

export async function setInvitationStatus(
  scope: TenantScope,
  invitationId: string,
  status: (typeof INVITATION_STATUSES)[number],
): Promise<Invitation> {
  return invitationsRepository.requireUpdate(scope, invitationId, {
    status: z.enum(INVITATION_STATUSES).parse(status),
  })
}

export async function cancelInvitation(
  scope: TenantScope,
  invitationId: string,
): Promise<Invitation> {
  assertCanAdminister(scope.ctx, 'cancel an invitation')
  return setInvitationStatus(scope, invitationId, 'canceled')
}

/** Expired pending invitations, for the retention cron to mark. */
export async function countPendingInvitations(scope: TenantScope): Promise<number> {
  const rows = await scope.db
    .select({ value: count() })
    .from(invitation)
    .where(tenantFilter(scope, invitation, eq(invitation.status, 'pending')))
  return rows[0]?.value ?? 0
}
