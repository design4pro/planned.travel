/**
 * The one batch that writes an organization and its owner, behind two doors.
 *
 * `provisionPersonalOrganization` (sign-up) and the workspace-creation path both go through
 * `createOrganizationFor`, so the claims are the ones that must hold for both: the personal
 * workspace is written exactly as before, a name that slugifies to nothing still gets a unique slug,
 * and `metadata` is written through as given.
 *
 * The harness database is a plain SQLite handle behind the Drizzle proxy driver, not the D1 handle
 * `AuthDb` names. They accept the same statements, so the one cast sits in `asAuthDb`.
 */
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { member, organization, user } from '#/server/db/auth-schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  WORKSPACE_LIMIT,
  createOrganizationFor,
  provisionPersonalOrganization,
} from '../provisioning'
import type { AuthDb } from '../db'
import type { Harness } from '#/server/repos/__tests__/harness'

function asAuthDb(harness: Harness): AuthDb {
  return harness.db as unknown as AuthDb
}

let harness: Harness
let db: AuthDb

beforeEach(async () => {
  harness = await createHarness()
  db = asAuthDb(harness)
})

async function userId(label: string): Promise<string> {
  const tenant = await harness.seedTenant(label)
  return tenant.ownerUserId
}

describe('provisionPersonalOrganization', () => {
  it('writes the personal workspace exactly as before: its name, its slug, the personal flag, an owner', async () => {
    const now = new Date()
    await db.insert(user).values({
      id: 'user_fresh',
      name: 'Anna Kowalska',
      email: 'anna@example.test',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })

    const organizationId = await provisionPersonalOrganization(db, {
      id: 'user_fresh',
      name: 'Anna Kowalska',
      email: 'anna@example.test',
    })

    const [created] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, organizationId))
    expect(created.name).toBe("Anna's Travel")
    expect(created.slug).toBe('anna-kowalska')
    expect(created.metadata).toBe(JSON.stringify({ personal: true }))

    const members = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, organizationId))
    expect(members.map((row) => [row.userId, row.role])).toEqual([
      ['user_fresh', 'owner'],
    ])
  })

  it('is idempotent: a user who already belongs to a workspace gets that one back', async () => {
    const owner = await userId('existing')
    const before = await db.select().from(organization)

    const returned = await provisionPersonalOrganization(db, {
      id: owner,
      name: 'Owner existing',
      email: 'owner@example.test',
    })

    expect(before.map((row) => row.id)).toContain(returned)
    expect(await db.select().from(organization)).toHaveLength(before.length)
  })
})

describe('createOrganizationFor', () => {
  it('writes the organization and one owner membership for the caller, and nothing else', async () => {
    const tenant = await harness.seedTenant('origin')
    const organizations = await db.select().from(organization)
    const members = await db.select().from(member)

    const organizationId = await createOrganizationFor(
      db,
      { id: tenant.ownerUserId },
      { name: 'Family holiday', metadata: null },
    )

    expect(await db.select().from(organization)).toHaveLength(
      organizations.length + 1,
    )
    expect(await db.select().from(member)).toHaveLength(members.length + 1)

    const created = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, organizationId))
    expect(created.map((row) => [row.userId, row.role])).toEqual([
      [tenant.ownerUserId, 'owner'],
    ])
    // No member of the workspace it was created from is added to it.
    expect(created.map((row) => row.organizationId)).not.toContain(
      tenant.organizationId,
    )
  })

  it('writes the name verbatim, a slug derived from it, and no metadata', async () => {
    const owner = await userId('slug')

    const organizationId = await createOrganizationFor(
      db,
      { id: owner },
      { name: '  Lisbon & Porto 2027  ', metadata: null },
    )

    const [created] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, organizationId))
    expect(created.name).toBe('  Lisbon & Porto 2027  ')
    expect(created.slug).toBe('lisbon-porto-2027')
    expect(created.metadata).toBeNull()
  })

  it('writes metadata through as given', async () => {
    const owner = await userId('meta')

    const organizationId = await createOrganizationFor(
      db,
      { id: owner },
      { name: 'Tagged', metadata: { kind: 'client' } },
    )

    const [created] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, organizationId))
    expect(created.metadata).toBe(JSON.stringify({ kind: 'client' }))
  })

  it('gives a name that slugifies to nothing a usable, unique slug', async () => {
    const owner = await userId('empty')

    const first = await createOrganizationFor(
      db,
      { id: owner },
      { name: '日本', metadata: null },
    )
    const second = await createOrganizationFor(
      db,
      { id: owner },
      { name: '!!!', metadata: null },
    )

    const rows = await db.select().from(organization)
    const slugs = [first, second].map(
      (id) => rows.find((row) => row.id === id)?.slug ?? '',
    )
    expect(slugs[0]).toMatch(/^workspace/)
    expect(slugs[1]).toMatch(/^workspace/)
    expect(slugs[0]).not.toBe(slugs[1])
  })

  it('never reuses a slug that is taken', async () => {
    const owner = await userId('taken')

    const first = await createOrganizationFor(
      db,
      { id: owner },
      { name: 'Same name', metadata: null },
    )
    const second = await createOrganizationFor(
      db,
      { id: owner },
      { name: 'Same name', metadata: null },
    )

    const rows = await db.select().from(organization)
    const slugOf = (id: string) => rows.find((row) => row.id === id)?.slug
    expect(slugOf(first)).toBe('same-name')
    expect(slugOf(second)).toMatch(/^same-name-/)
  })
})

describe('WORKSPACE_LIMIT', () => {
  it('is the number the product and the plugin both name', () => {
    expect(WORKSPACE_LIMIT).toBe(20)
  })
})
