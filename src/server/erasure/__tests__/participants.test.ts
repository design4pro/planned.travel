/**
 * The participation anchor through the repositories and the catalog (ADR 0043): `addMember` writes
 * it before the membership, the backfill records only what its one workspace names, and the
 * cross-tenant discovery read returns ids and nothing else.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ERASURE_CATALOG_MAX_PAGE_SIZE,
  listOrganizationIds,
  listWorkspacesHoldingUser,
} from '#/server/catalog/erasure'
import { workspaceParticipants } from '#/server/db/schema'
import {
  addMember,
  backfillParticipants,
  createTrip,
  removeMember,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

let harness: Harness
let alpha: SeededTenant
let beta: SeededTenant

beforeEach(async () => {
  harness = await createHarness()
  alpha = await harness.seedTenant('alpha')
  beta = await harness.seedTenant('beta')
  await subscribeTenant(alpha.scope, 'crew', 5)
  await subscribeTenant(beta.scope, 'crew', 5)
})

afterEach(() => {
  harness.close()
})

const anchorsOf = async () =>
  (await harness.db.select().from(workspaceParticipants)).map(
    (row) => `${row.organizationId}/${row.userId}`,
  )

const newUser = async (label: string) => {
  const stray = await harness.seedTenant(label)
  return stray.ownerUserId
}

/** Leaves through the real path, `removeMember`, which must not take the anchor with it. */
const leave = async (tenant: SeededTenant, userId: string) => {
  const row = harness.sqlite
    .prepare('select id from member where organization_id = ? and user_id = ?')
    .get(tenant.organizationId, userId) as { id: string }
  await removeMember(tenant.scope, row.id)
}

describe('addMember', () => {
  it('records the participant in the workspace it adds them to, and only there', async () => {
    const person = await newUser('person')

    await addMember(alpha.scope, { userId: person, role: 'member' })

    expect(await anchorsOf()).toEqual([`${alpha.organizationId}/${person}`])
  })

  it('writes no membership when the anchor write fails', async () => {
    const person = await newUser('person')
    harness.sqlite.exec(
      `create trigger anchor_refuses before insert on workspace_participants
       begin select raise(abort, 'anchor refused'); end`,
    )

    await expect(
      addMember(alpha.scope, { userId: person, role: 'member' }),
    ).rejects.toThrow()

    const rows = harness.sqlite
      .prepare(
        'select count(*) as n from member where organization_id = ? and user_id = ?',
      )
      .get(alpha.organizationId, person) as { n: number }
    expect(rows.n).toBe(0)
  })

  it('keeps the anchor when the person leaves', async () => {
    const person = await newUser('person')
    await addMember(alpha.scope, { userId: person, role: 'member' })

    await leave(alpha, person)

    expect(await anchorsOf()).toEqual([`${alpha.organizationId}/${person}`])
  })
})

describe('backfillParticipants', () => {
  it('records the people a workspace names and writes nothing for another workspace', async () => {
    const stayer = await alpha.addUser('Stayer')
    const trip = await createTrip(alpha.scope, {
      title: 'Trip',
      currency: 'EUR',
    })
    expect(trip.id).toBeTruthy()
    const betaOnly = await beta.addUser('Beta only')

    await backfillParticipants(alpha.scope)

    const anchors = await anchorsOf()
    expect(anchors).toContain(`${alpha.organizationId}/${alpha.ownerUserId}`)
    expect(anchors).toContain(`${alpha.organizationId}/${stayer}`)
    expect(
      anchors.every((row) => row.startsWith(`${alpha.organizationId}/`)),
    ).toBe(true)
    expect(anchors.join()).not.toContain(betaOnly)
  })

  it('finds a person who left only through a column that names them', async () => {
    const leaver = await alpha.addUser('Leaver')
    const trip = await createTrip(alpha.scope, {
      title: 'Trip',
      currency: 'EUR',
    })
    harness.sqlite
      .prepare('update trips set created_by = ? where id = ?')
      .run(leaver, trip.id)
    await leave(alpha, leaver)

    await backfillParticipants(alpha.scope)

    expect(await anchorsOf()).toContain(`${alpha.organizationId}/${leaver}`)
  })

  it('records more people than one insert statement can bind', async () => {
    const people: Array<string> = []
    for (let index = 0; index < 40; index += 1) {
      people.push(await alpha.addUser(`Person ${index}`))
    }

    await backfillParticipants(alpha.scope)

    const anchors = await anchorsOf()
    for (const person of people) {
      expect(anchors).toContain(`${alpha.organizationId}/${person}`)
    }
  })

  it('is idempotent: a second run changes nothing', async () => {
    await alpha.addUser('Stayer')
    await backfillParticipants(alpha.scope)
    const first = await anchorsOf()

    await backfillParticipants(alpha.scope)

    expect((await anchorsOf()).sort()).toEqual(first.sort())
  })

  it('leaves the erasure job state of an existing anchor alone', async () => {
    harness.sqlite
      .prepare(
        'insert into workspace_participants (organization_id, user_id, erasure_id, created_at) values (?, ?, ?, ?)',
      )
      .run(alpha.organizationId, alpha.ownerUserId, 'erase_1', Date.now())

    await backfillParticipants(alpha.scope)

    const row = harness.sqlite
      .prepare(
        'select erasure_id from workspace_participants where organization_id = ? and user_id = ?',
      )
      .get(alpha.organizationId, alpha.ownerUserId) as { erasure_id: string }
    expect(row.erasure_id).toBe('erase_1')
  })
})

describe('the catalog read', () => {
  it('finds the workspaces a person left, and none they never joined', async () => {
    const person = await newUser('person')
    await addMember(alpha.scope, { userId: person, role: 'member' })
    await leave(alpha, person)

    const page = await listWorkspacesHoldingUser(harness.db, person)

    expect(page.items.map((row) => row.organizationId)).toEqual([
      alpha.organizationId,
    ])
    expect(page.next).toBeNull()
  })

  it('returns rows of exactly the documented keys', async () => {
    const person = await newUser('person')
    await addMember(alpha.scope, { userId: person, role: 'member' })

    const held = await listWorkspacesHoldingUser(harness.db, person)
    const organizations = await listOrganizationIds(harness.db)

    expect(Object.keys(held.items[0] ?? {}).sort()).toEqual([
      'erasureId',
      'organizationId',
    ])
    expect(organizations.items.every((id) => typeof id === 'string')).toBe(true)
  })

  it('pages by keyset with a fixed maximum page size', async () => {
    const ids = [alpha.organizationId, beta.organizationId].sort()

    const first = await listOrganizationIds(harness.db, { limit: 1 })
    const second = await listOrganizationIds(harness.db, {
      limit: 1,
      after: first.next,
    })
    expect(first.items).toEqual([ids[0]])
    expect(first.next).toBe(ids[0])
    expect(second.items).toEqual([ids[1]])
    expect(second.next).toBeNull()
  })

  it('never returns more than the maximum page size, however much is asked for', async () => {
    const insert = harness.sqlite.prepare(
      'insert into organization (id, name, slug, created_at) values (?, ?, ?, ?)',
    )
    for (let index = 0; index < ERASURE_CATALOG_MAX_PAGE_SIZE + 5; index += 1) {
      insert.run(`org_${index}`, 'W', `bulk-${index}`, Date.now())
    }

    const page = await listOrganizationIds(harness.db, { limit: 10_000 })

    expect(page.items).toHaveLength(ERASURE_CATALOG_MAX_PAGE_SIZE)
    expect(page.next).toBe(page.items.at(-1))
  })
})
