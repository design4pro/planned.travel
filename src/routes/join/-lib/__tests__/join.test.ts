import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTripInvite, replaceTripInvite } from '#/server/repos/invites'
import { createTrip, listTripMembers } from '#/server/repos/trips'
import { joinInvite } from '../join'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { JoinDeps } from '../join'

const KEY = 'a-test-key-that-is-long-enough-for-hkdf'

describe('joinInvite', () => {
  let h: Harness
  let a: SeededTenant
  let b: SeededTenant
  let tripId: string
  let secret: string
  let counters: Map<string, string>
  const audit = vi.fn<JoinDeps['audit']>(async () => {})
  const log = vi.fn<NonNullable<JoinDeps['log']>>()

  const deps = (
    user: Partial<JoinDeps['user']> & { id: string },
    ip = '203.0.113.9',
  ): JoinDeps => ({
    db: h.db,
    store: {
      get: async (key) => counters.get(key) ?? null,
      put: async (key, value) => {
        counters.set(key, value)
      },
    },
    key: KEY,
    ip,
    user: {
      banned: false,
      impersonated: false,
      activeOrganizationId: null,
      ...user,
    },
    audit,
    log,
  })
  const members = () => listTripMembers(a.scope, tripId)

  beforeEach(async () => {
    audit.mockClear()
    log.mockClear()
    counters = new Map()
    h = await createHarness()
    a = await h.seedTenant('a')
    b = await h.seedTenant('b')
    tripId = (await createTrip(a.scope, { title: 'Lisbon', currency: 'EUR' }))
      .id
    secret =
      (await createTripInvite(a.scope, tripId, { role: 'viewer', key: KEY }))
        .secret ?? ''
  })

  it('joins a workspace member and writes an audit row with the link and the role, never the secret', async () => {
    const friend = await a.addUser('Friend')
    const answer = await joinInvite(
      deps({ id: friend, activeOrganizationId: a.organizationId }),
      secret,
    )
    expect(answer).toEqual({
      outcome: 'joined',
      tripId,
      organizationId: a.organizationId,
      switchWorkspace: false,
    })
    expect(await members()).toHaveLength(2)
    expect(audit).toHaveBeenCalledOnce()
    const [context, input] = audit.mock.calls[0] ?? []
    expect(context).toEqual({
      organizationId: a.organizationId,
      userId: friend,
      role: 'member',
    })
    expect(input).toMatchObject({
      action: 'trip.member_joined',
      entityId: tripId,
      metadata: { role: 'viewer' },
    })
    const written = JSON.stringify([input, log.mock.calls])
    expect(written).not.toContain(secret)
    expect(Object.keys(input?.metadata ?? {}).sort()).toEqual([
      'inviteId',
      'role',
    ])
  })

  it('tells a member of two workspaces whose active one is the other to switch', async () => {
    const both = await b.addUser('Both')
    await a.addMembership(both)
    expect(
      await joinInvite(
        deps({ id: both, activeOrganizationId: b.organizationId }),
        secret,
      ),
    ).toMatchObject({
      outcome: 'joined',
      organizationId: a.organizationId,
      switchWorkspace: true,
    })
    expect(
      (await members()).find((row) => row.userId === both)?.organizationId,
    ).toBe(a.organizationId)
  })

  it('answers member for a second submit, with no second audit row', async () => {
    const friend = await a.addUser('Friend')
    await joinInvite(deps({ id: friend }), secret)
    const again = await joinInvite(deps({ id: friend }), secret)
    expect(again).toMatchObject({ outcome: 'member', tripId })
    expect(audit).toHaveBeenCalledOnce()
  })

  it('carries no ids for a non-member of the workspace and writes nothing', async () => {
    const outsider = await b.addUser('Outsider')
    const answer = await joinInvite(deps({ id: outsider }), secret)
    expect(answer).toEqual({ outcome: 'needs-workspace' })
    expect(await members()).toHaveLength(1)
    expect(audit).not.toHaveBeenCalled()
  })

  it('refuses a banned joiner and an impersonated session as an unavailable link', async () => {
    const friend = await a.addUser('Friend')
    expect(
      await joinInvite(deps({ id: friend, banned: true }), secret),
    ).toEqual({ outcome: 'unavailable' })
    expect(
      await joinInvite(deps({ id: friend, impersonated: true }), secret),
    ).toEqual({ outcome: 'unavailable' })
    expect(await members()).toHaveLength(1)
    expect(audit).not.toHaveBeenCalled()
  })

  it('fails a submit for a secret that was replaced while the tab was open', async () => {
    const friend = await a.addUser('Friend')
    await replaceTripInvite(a.scope, tripId, {
      role: 'viewer',
      expectedRotation: 0,
      key: KEY,
    })
    expect(await joinInvite(deps({ id: friend }), secret)).toEqual({
      outcome: 'unavailable',
    })
    expect(await members()).toHaveLength(1)
  })

  it('answers unavailable to anything that is not shaped like a secret, before any query', async () => {
    const friend = await a.addUser('Friend')
    h.statements.length = 0
    expect(await joinInvite(deps({ id: friend }), 'short')).toEqual({
      outcome: 'unavailable',
    })
    expect(h.statements).toHaveLength(0)
  })

  it('stops a user after ten submits a minute, and an address after thirty', async () => {
    const friend = await a.addUser('Friend')
    const now = () => new Date('2027-01-01T10:00:30Z')
    for (let n = 0; n < 10; n += 1) {
      await joinInvite({ ...deps({ id: friend }), now }, 'x'.repeat(43))
    }
    expect(
      await joinInvite({ ...deps({ id: friend }), now }, secret),
    ).toMatchObject({ outcome: 'busy', retryAfter: 30 })
    expect(await members()).toHaveLength(1)

    for (let n = 0; n < 30; n += 1) {
      const other = await a.addUser(`Other ${n}`)
      const answer = await joinInvite(
        { ...deps({ id: other }, '198.51.100.1'), now },
        'x'.repeat(43),
      )
      expect(answer).toEqual({ outcome: 'unavailable' })
    }
    const last = await a.addUser('Last')
    expect(
      await joinInvite({ ...deps({ id: last }, '198.51.100.1'), now }, secret),
    ).toMatchObject({ outcome: 'busy' })
  })
})
