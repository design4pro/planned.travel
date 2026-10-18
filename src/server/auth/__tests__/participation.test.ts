/**
 * The participation anchor's auth-layer writer (ADR 0043): written in the same batch as the
 * organization and the owner membership, so a failed anchor leaves neither, and carried away by the
 * organization cascade when the over-limit rollback withdraws a workspace.
 */
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { member, organization } from '#/server/db/auth-schema'
import { workspaceParticipants } from '#/server/db/schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import { recordParticipation } from '../participation'
import {
  createOrganizationFor,
  createOrganizationWithinLimit,
} from '../provisioning'
import type { AuthDb } from '../db'
import type { Harness } from '#/server/repos/__tests__/harness'

let harness: Harness
let db: AuthDb
let person: string

beforeEach(async () => {
  harness = await createHarness()
  db = harness.db as unknown as AuthDb
  person = (await harness.seedTenant('home')).ownerUserId
})

const anchors = () => harness.db.select().from(workspaceParticipants)

describe('recordParticipation', () => {
  it('writes the pair and leaves the erasure job state empty, and a repeat writes nothing', async () => {
    const tenant = await harness.seedTenant('other')
    await recordParticipation(db, tenant.organizationId, person)
    await recordParticipation(db, tenant.organizationId, person)

    const rows = await anchors()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      organizationId: tenant.organizationId,
      userId: person,
      erasureId: null,
      tombstoneId: null,
      scrubbedAt: null,
    })
  })
})

describe('createOrganizationFor', () => {
  it('anchors the owner to the very organization it minted', async () => {
    const organizationId = await createOrganizationFor(
      db,
      { id: person },
      { name: 'Team', metadata: null },
    )

    const rows = await anchors()
    expect(rows.map((row) => [row.organizationId, row.userId])).toEqual([
      [organizationId, person],
    ])
    const members = await harness.db
      .select()
      .from(member)
      .where(eq(member.organizationId, organizationId))
    expect(members.map((row) => row.userId)).toEqual([person])
  })

  it('writes neither organization nor membership when the anchor write fails', async () => {
    harness.sqlite.exec(
      `create trigger anchor_refuses before insert on workspace_participants
       begin select raise(abort, 'anchor refused'); end`,
    )
    const before = await harness.db.select().from(organization)

    await expect(
      createOrganizationFor(
        db,
        { id: person },
        { name: 'Team', metadata: null },
      ),
    ).rejects.toThrow()

    expect(await harness.db.select().from(organization)).toHaveLength(
      before.length,
    )
    expect(
      await harness.db.select().from(member).where(eq(member.userId, person)),
    ).toHaveLength(1)
  })

  it('takes the anchor with it when the over-limit rollback withdraws the workspace', async () => {
    const created = await createOrganizationWithinLimit(
      db,
      { id: person },
      { name: 'One too many', metadata: null },
      1,
    )

    expect(created).toBeNull()
    expect(await anchors()).toEqual([])
  })
})
