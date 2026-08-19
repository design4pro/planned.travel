import { and, asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { member, organization, user as userTable } from '#/server/db/auth-schema'
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

  const organizationId = nanoid(24)
  const slug = await reserveSlug(db, personalOrganizationSlug(user))
  const now = new Date()

  await db.batch([
    db.insert(organization).values({
      id: organizationId,
      name: personalOrganizationName(user),
      slug,
      logo: null,
      metadata: JSON.stringify({ personal: true }),
      createdAt: now,
      updatedAt: now,
    }),
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
