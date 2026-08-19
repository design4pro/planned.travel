/**
 * The one step the tenant repositories cannot perform: resolving which workspace to seed, and giving
 * the demo dataset three collaborators to be about.
 *
 * `user`, `organization` and `member` belong to the auth module — Better Auth's organization plugin
 * writes them directly, and `src/server/auth/db.ts` exists precisely so provisioning can touch them
 * without importing the product data layer. This module follows that same seam: it looks the owner up
 * by email, reads their organization through the auth module's own `firstOrganizationIdFor`, and
 * inserts the collaborator rows. Everything after this point goes through `src/server/repos`.
 *
 * The collaborators are deliberately created without a credential account, so they exist as people in
 * the workspace — names, avatars, splits, votes — but cannot sign in. A demo dataset has no business
 * minting passwords.
 */

import { eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { user } from '#/server/db/auth-schema'
import { authDb } from '#/server/auth/db'
import { firstOrganizationIdFor, membershipRoleFor } from '#/server/auth/provisioning'
import { addMember, createScope } from '#/server/repos'
import { people } from './dataset'
import type { OrganizationRole } from '#/server/db/auth-schema'
import type { Database } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type { PersonKey } from './types'

/** Better Auth generates 24-character ids; the demo users match so nothing looks foreign. */
const ID_LENGTH = 24

export class SeedBootstrapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeedBootstrapError'
  }
}

export interface SeedPeople {
  /** `user.id` for every person key in the dataset. */
  readonly ids: ReadonlyMap<PersonKey, string>
  /** How many collaborator rows this run created, for the report. */
  readonly created: number
  /** A scope per person, so chat, votes and journal entries are attributed correctly. */
  readonly scopes: ReadonlyMap<PersonKey, TenantScope>
}

/** The workspace itself, resolved before anything is written. */
export interface ResolvedWorkspace {
  readonly organizationId: string
  readonly ownerUserId: string
  readonly ownerRole: OrganizationRole
  readonly ownerScope: TenantScope
}

/** Resolves the workspace owner from their email address, or explains what is missing. */
async function resolveOwner(email: string): Promise<{ userId: string; organizationId: string }> {
  const db = authDb()
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  const owner = rows.at(0)
  if (owner === undefined) {
    throw new SeedBootstrapError(
      `No account found for ${email}. Register it first, then run the seed again.`,
    )
  }

  const organizationId = await firstOrganizationIdFor(db, owner.id)
  if (organizationId === null) {
    throw new SeedBootstrapError(
      `${email} exists but belongs to no organization. Sign in once so it is provisioned.`,
    )
  }

  return { userId: owner.id, organizationId }
}

/**
 * Ensures a `user` row exists for every collaborator in the dataset. Idempotent: existing addresses
 * are adopted rather than duplicated, which is what lets the seed be re-run.
 */
async function ensureCollaboratorUsers(
  ownerUserId: string,
): Promise<{ ids: Map<PersonKey, string>; created: number }> {
  const db = authDb()
  const wanted = people.filter((person) => person.key !== 'rafal')
  const ids = new Map<PersonKey, string>([['rafal', ownerUserId]])

  const existing = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(
      inArray(
        user.email,
        wanted.map((person) => person.email),
      ),
    )
  const byEmail = new Map(existing.map((row) => [row.email, row.id]))

  const missing = wanted.filter((person) => !byEmail.has(person.email))
  if (missing.length > 0) {
    const now = new Date()
    await db.insert(user).values(
      missing.map((person) => ({
        id: nanoid(ID_LENGTH),
        name: person.name,
        email: person.email,
        emailVerified: true,
        image: null,
        twoFactorEnabled: false,
        createdAt: now,
        updatedAt: now,
      })),
    )
    const refreshed = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(
        inArray(
          user.email,
          missing.map((person) => person.email),
        ),
      )
    for (const row of refreshed) {
      byEmail.set(row.email, row.id)
    }
  }

  for (const person of wanted) {
    const id = byEmail.get(person.email)
    if (id === undefined) {
      throw new SeedBootstrapError(`Could not create or resolve the demo user ${person.email}.`)
    }
    ids.set(person.key, id)
  }

  return { ids, created: missing.length }
}

/**
 * Resolves which workspace to seed and builds the owner's scope.
 *
 * Deliberately separate from {@link ensureWorkspacePeople}: the caller has to raise the seat quota
 * through the billing repository before three collaborators can be added, and it needs a scope to do
 * that with.
 */
export async function resolveWorkspace(
  db: Database,
  ownerEmail: string,
): Promise<ResolvedWorkspace> {
  const owner = await resolveOwner(ownerEmail)
  const ownerRole = await membershipRoleFor(authDb(), {
    userId: owner.userId,
    organizationId: owner.organizationId,
  })
  if (ownerRole !== 'owner' && ownerRole !== 'admin') {
    throw new SeedBootstrapError(
      `${ownerEmail} is "${ownerRole ?? 'not a member'}" of the workspace and cannot seed it.`,
    )
  }

  return {
    organizationId: owner.organizationId,
    ownerUserId: owner.userId,
    ownerRole,
    ownerScope: createScope(db, {
      userId: owner.userId,
      organizationId: owner.organizationId,
      role: ownerRole,
    }),
  }
}

/**
 * Creates the collaborator user rows, joins them to the workspace and builds a scope for each.
 *
 * Membership goes through the repository, so the seat quota and the "never remove the last owner"
 * rules apply exactly as they would to a real invitation — which is why the caller must have set the
 * subscription first. The collaborators' scopes carry the role the dataset gives them, so a write
 * attempted by the wrong person still fails the way it would in production.
 */
export async function ensureWorkspacePeople(
  db: Database,
  workspace: ResolvedWorkspace,
): Promise<SeedPeople> {
  const { ids, created } = await ensureCollaboratorUsers(workspace.ownerUserId)

  for (const person of people) {
    const userId = ids.get(person.key)
    if (userId === undefined || person.key === 'rafal') {
      continue
    }
    await addMember(workspace.ownerScope, { userId, role: person.role })
  }

  const scopes = new Map<PersonKey, TenantScope>()
  for (const person of people) {
    const userId = ids.get(person.key)
    if (userId === undefined) {
      continue
    }
    scopes.set(
      person.key,
      person.key === 'rafal'
        ? workspace.ownerScope
        : createScope(db, {
            userId,
            organizationId: workspace.organizationId,
            role: person.role,
          }),
    )
  }

  return { ids, created, scopes }
}
