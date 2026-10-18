import { beforeEach, describe, expect, it } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTripInvite } from '#/server/repos/invites'
import { addTripMember, createTrip } from '#/server/repos/trips'
import { viewInvite } from '../view'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { InviteViewDeps } from '../view'

const KEY = 'a-test-key-that-is-long-enough-for-hkdf'

describe('viewInvite', () => {
  let h: Harness
  let a: SeededTenant
  let b: SeededTenant
  let tripId: string
  let secret: string
  const logged: Array<{ event: string; fields: unknown }> = []

  const deps = (session: InviteViewDeps['session'] = null): InviteViewDeps => ({
    db: h.db,
    store: { get: async () => null, put: async () => {} },
    key: KEY,
    ip: '203.0.113.9',
    session,
    log: (event, fields) => {
      logged.push({ event, fields })
    },
  })

  beforeEach(async () => {
    logged.length = 0
    h = await createHarness()
    a = await h.seedTenant('a')
    b = await h.seedTenant('b')
    tripId = (
      await createTrip(a.scope, {
        title: 'Lisbon',
        currency: 'EUR',
        destination: 'Portugal',
      })
    ).id
    secret =
      (await createTripInvite(a.scope, tripId, { role: 'viewer', key: KEY }))
        .secret ?? ''
  })

  it('shows an anonymous visitor the whitelist, marked as signed out', async () => {
    expect(await viewInvite(deps(), secret)).toEqual({
      state: 'invited',
      signedIn: false,
      tripTitle: 'Lisbon',
      inviterName: 'Owner a',
      inviterImage: null,
      role: 'viewer',
    })
  })

  it('shows a workspace member the dates and destination', async () => {
    const friend = await a.addUser('Friend')
    expect(
      await viewInvite(
        deps({
          id: friend,
          email: 'f@example.test',
          banned: false,
          activeOrganizationId: null,
        }),
        secret,
      ),
    ).toMatchObject({
      state: 'invited',
      signedIn: true,
      destination: 'Portugal',
    })
  })

  it('says member, with the trip and workspace, and nothing about the card', async () => {
    const friend = await a.addUser('Friend')
    await addTripMember(a.scope, { tripId, userId: friend, role: 'viewer' })
    expect(
      await viewInvite(
        deps({
          id: friend,
          email: 'f@example.test',
          banned: false,
          activeOrganizationId: null,
        }),
        secret,
      ),
    ).toEqual({
      state: 'member',
      tripId,
      organizationId: a.organizationId,
      switchWorkspace: true,
    })
  })

  it("does not ask a member to switch workspace when the link's workspace is already active", async () => {
    const friend = await a.addUser('Friend')
    await addTripMember(a.scope, { tripId, userId: friend, role: 'viewer' })
    expect(
      await viewInvite(
        deps({
          id: friend,
          email: 'f@example.test',
          banned: false,
          activeOrganizationId: a.organizationId,
        }),
        secret,
      ),
    ).toMatchObject({ state: 'member', switchWorkspace: false })
  })

  it('tells a signed-in outsider which address they are using, and nothing of the workspace', async () => {
    const outsider = await b.addUser('Outsider')
    const view = await viewInvite(
      deps({
        id: outsider,
        email: 'out@example.test',
        banned: false,
        activeOrganizationId: null,
      }),
      secret,
    )
    expect(view).toEqual({
      state: 'needs-workspace',
      tripTitle: 'Lisbon',
      inviterName: 'Owner a',
      email: 'out@example.test',
    })
    expect(JSON.stringify(view)).not.toContain(a.organizationId)
    expect(JSON.stringify(view)).not.toContain('Workspace a')
  })

  it('is one unavailable card for a dead link, which only differs in whether the visitor is signed in', async () => {
    const friend = await a.addUser('Friend')
    const signedIn = deps({
      id: friend,
      email: 'f@example.test',
      banned: false,
      activeOrganizationId: null,
    })
    expect(await viewInvite(deps(), 'x'.repeat(43))).toEqual({
      state: 'unavailable',
      signedIn: false,
    })
    expect(await viewInvite(signedIn, 'nonsense')).toEqual({
      state: 'unavailable',
      signedIn: true,
    })
    expect(
      await viewInvite(
        deps({
          id: friend,
          email: 'f@example.test',
          banned: true,
          activeOrganizationId: null,
        }),
        secret,
      ),
    ).toEqual({ state: 'unavailable', signedIn: true })
  })

  it('answers busy with the wait once the miss budget is spent', async () => {
    const store = new Map<string, string>()
    const spent = {
      ...deps(),
      store: {
        get: async (key: string) => store.get(key) ?? null,
        put: async (key: string, value: string) => {
          store.set(key, value)
        },
      },
    }
    for (let miss = 0; miss < 20; miss += 1)
      await viewInvite(spent, 'x'.repeat(43))
    expect(await viewInvite(spent, 'x'.repeat(43))).toEqual({
      state: 'busy',
      retryAfter: expect.any(Number),
    })
  })

  it('logs the link id and the outcome and never the secret', async () => {
    await viewInvite(deps(), secret)
    await viewInvite(deps(), 'x'.repeat(43))
    const text = JSON.stringify(logged)
    expect(text).not.toContain(secret)
    expect(text).not.toContain('join/')
    expect(logged.map((entry) => entry.event)).toEqual(['found', 'unavailable'])
  })
})
