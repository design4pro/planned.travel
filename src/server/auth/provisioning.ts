import { and, asc, count, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { member, organization, user as userTable } from '#/server/db/auth-schema'
import { recordParticipation } from './participation'
import type { AuthDb } from './db'

/** Every account gets a workspace, so nothing in the product is org-less. */
const PERSONAL_ORG_SUFFIX = 'Travel'

/**
 * Turns arbitrary text into a URL-safe slug fragment.
 * Returns an empty string when nothing usable survives.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Derives the display name of a new user's personal workspace. */
export function personalOrganizationName(input: {
  name?: string | null
  email: string
}): string {
  const trimmed = input.name?.trim()
  if (trimmed) {
    const firstName = trimmed.split(/\s+/)[0]
    return `${firstName}'s ${PERSONAL_ORG_SUFFIX}`
  }
  const local = input.email.split('@')[0] ?? 'my'
  return `${local}'s ${PERSONAL_ORG_SUFFIX}`
}

/** Candidate slug for a personal workspace, before uniqueness is applied. */
export function personalOrganizationSlug(input: {
  name?: string | null
  email: string
}): string {
  const base =
    slugify(input.name ?? '') || slugify(input.email.split('@')[0] ?? '')
  return base || 'workspace'
}

/**
 * Finds a free slug by appending a short random suffix on collision. Bounded
 * retries; the final fallback is unconditionally unique.
 */
async function reserveSlug(db: AuthDb, base: string): Promise<string> {
  const candidates = [base, ...Array.from({ length: 3 }, () => `${base}-${nanoid(6).toLowerCase()}`)]

  for (const candidate of candidates) {
    const clash = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, candidate))
      .limit(1)
    if (clash.length === 0) return candidate
  }

  return `${base}-${nanoid(12).toLowerCase()}`
}

/**
 * How many workspaces one account may belong to. The organization plugin's `organizationLimit`
 * reads this, and so does workspace creation, which is why it is one exported value: the plugin
 * enforces its limit only inside its own `organization/create` endpoint, and creation no longer
 * goes through that endpoint.
 */
export const WORKSPACE_LIMIT = 20

/**
 * Writes an organization and the `owner` membership of `user` in one batch, reserving a free slug.
 *
 * The one writer of that pair: sign-up provisioning and workspace creation both end here, so the two
 * rows can never be written apart. `slugBase` is where the slug starts and defaults to the name; the
 * personal workspace passes its own, which is why it keeps the slug it always had. `metadata` is
 * written through as JSON, or as `null`.
 */
export async function createOrganizationFor(
  db: AuthDb,
  user: { id: string },
  input: {
    name: string
    metadata: Record<string, unknown> | null
    slugBase?: string
  },
): Promise<string> {
  const organizationId = nanoid(24)
  const slug = await reserveSlug(
    db,
    input.slugBase ?? (slugify(input.name) || 'workspace'),
  )
  const now = new Date()

  await db.batch([
    db.insert(organization).values({
      id: organizationId,
      name: input.name,
      slug,
      logo: null,
      metadata: input.metadata === null ? null : JSON.stringify(input.metadata),
      createdAt: now,
      updatedAt: now,
    }),
    recordParticipation(db, organizationId, user.id),
    db.insert(member).values({
      id: nanoid(24),
      organizationId,
      userId: user.id,
      role: 'owner',
      createdAt: now,
    }),
  ])

  return organizationId
}

/**
 * {@link createOrganizationFor}, held to `limit` memberships by the write itself.
 *
 * A count taken before the write cannot hold the limit: several requests in flight each read the
 * same count and each write. So the count is taken again once the batch is in, and a workspace that
 * took the account past `limit` is removed and `null` is returned. Two racing creates may both see
 * the overshoot and both withdraw, which refuses a create that would have fit; the account is left
 * over the limit only if the recount or the withdrawal itself fails. The removal deletes the
 * membership first, then the organization.
 */
export async function createOrganizationWithinLimit(
  db: AuthDb,
  user: { id: string },
  input: Parameters<typeof createOrganizationFor>[2],
  limit: number,
): Promise<string | null> {
  const organizationId = await createOrganizationFor(db, user, input)
  const [memberships] = await db
    .select({ n: count() })
    .from(member)
    .where(eq(member.userId, user.id))
  if (memberships.n <= limit) return organizationId

  await db.batch([
    db.delete(member).where(eq(member.organizationId, organizationId)),
    db.delete(organization).where(eq(organization.id, organizationId)),
  ])
  return null
}

/**
 * Creates the user's personal organization and their `owner` membership.
 * Idempotent: a user who already belongs to an organization is left alone, so a
 * retried hook cannot spawn duplicates.
 */
export async function provisionPersonalOrganization(
  db: AuthDb,
  user: { id: string; name?: string | null; email: string },
): Promise<string> {
  const existing = await firstOrganizationIdFor(db, user.id)
  if (existing) return existing

  return createOrganizationFor(db, user, {
    name: personalOrganizationName(user),
    metadata: { personal: true },
    slugBase: personalOrganizationSlug(user),
  })
}

/** The organization a returning user should land in: their oldest membership. */
export async function firstOrganizationIdFor(
  db: AuthDb,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(1)
  return rows[0]?.organizationId ?? null
}

/** Every organization the user belongs to, in no particular order. */
export async function organizationIdsFor(
  db: AuthDb,
  userId: string,
): Promise<Array<string>> {
  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
  return rows.map((row) => row.organizationId)
}

/** Resolves a user's role inside one organization, or `null` if not a member. */
export async function membershipRoleFor(
  db: AuthDb,
  input: { userId: string; organizationId: string },
): Promise<string | null> {
  const rows = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, input.userId),
        eq(member.organizationId, input.organizationId),
      ),
    )
    .limit(1)
  return rows[0]?.role ?? null
}

/**
 * The organization a session should be pinned to, provisioning the user's
 * personal one first if it does not exist yet.
 *
 * Sign-up creates the user row and the session row in the same request, and
 * Better Auth runs `user.create.after` (which provisions the organization)
 * without awaiting it before `session.create.before` runs. Reading memberships
 * alone therefore loses the race and leaves a brand-new session with a null
 * active organization — which every authenticated screen then rejects. Because
 * `provisionPersonalOrganization` is idempotent, resolving it here is safe on
 * every session creation and removes the ordering dependency entirely.
 *
 * Returns `null` only when the user row itself is gone, in which case the
 * caller should leave the session untouched.
 */
export async function resolveOrProvisionOrganization(
  db: AuthDb,
  userId: string,
): Promise<string | null> {
  const existing = await firstOrganizationIdFor(db, userId)
  if (existing) return existing

  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)

  const owner = rows.at(0)
  if (!owner) return null

  return provisionPersonalOrganization(db, owner)
}
