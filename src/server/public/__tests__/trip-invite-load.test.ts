import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { tripInviteLinks, tripMembers } from '#/server/db/schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  createTripInvite,
  replaceTripInvite,
  updateTripInvite,
} from '#/server/repos/invites'
import { archiveTrip, createTrip } from '#/server/repos/trips'
import { spendPublicBudget } from '../rate-limit'
import { loadTripInvite } from '../trip-invite'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { RateCounterStore } from '#/server/metering/rate'

const KEY = 'a-test-key-that-is-long-enough-for-hkdf'
const NOON = new Date('2026-10-17T12:00:20.000Z')

function memoryStore(): RateCounterStore {
  const entries = new Map<string, string>()
  return {
    get: async (key) => entries.get(key) ?? null,
    put: async (key, value) => {
      entries.set(key, value)
    },
  }
}

describe('loadTripInvite', () => {
  let h: Harness
  let a: SeededTenant
  let tripId: string
  let secret: string
  let store: RateCounterStore
  const logged: Array<{ event: string; fields: unknown }> = []

  const runtime = () => ({
    db: h.db,
    store,
    key: KEY,
    now: () => NOON,
    log: (event: string, fields: unknown) => {
      logged.push({ event, fields })
    },
  })
  const open = (
    value = secret,
    viewer: { id: string; banned: boolean } | null = null,
    ip = '203.0.113.9',
  ) => loadTripInvite(runtime(), { secret: value, ip, viewer })

  beforeEach(async () => {
    logged.length = 0
    store = memoryStore()
    h = await createHarness()
    a = await h.seedTenant('a')
    tripId = (await createTrip(a.scope, { title: 'Lisbon', currency: 'EUR' }))
      .id
    secret =
      (await createTripInvite(a.scope, tripId, { role: 'viewer', key: KEY }))
        .secret ?? ''
  })

  it('answers 200 with the anonymous whitelist for a live link', async () => {
    const answer = await open()
    expect(answer).toEqual({
      status: 200,
      preview: {
        state: 'invited',
        tripTitle: 'Lisbon',
        inviterName: 'Owner a',
        inviterImage: null,
        role: 'viewer',
      },
    })
  })

  it('answers a signed-in workspace member with the dates and destination', async () => {
    const friend = await a.addUser('Friend')
    const answer = await open(secret, { id: friend, banned: false })
    expect(answer).toMatchObject({
      status: 200,
      preview: { state: 'invited', startDate: null, destination: null },
    })
  })

  it('answers one identical 404 for every kind of dead link', async () => {
    const bodies = new Set<string>()
    const shapes: Array<string> = [
      'short',
      'x'.repeat(43),
      `${secret.slice(1)}!`,
      '',
    ]
    for (const value of shapes) bodies.add(JSON.stringify(await open(value)))
    await updateTripInvite(a.scope, tripId, {
      enabled: false,
      expectedRotation: 0,
      key: KEY,
    })
    bodies.add(JSON.stringify(await open()))
    expect(bodies).toEqual(new Set([JSON.stringify({ status: 404 })]))
  })

  it('answers 404 once the link is replaced, and for an archived trip', async () => {
    await replaceTripInvite(a.scope, tripId, {
      role: 'viewer',
      expectedRotation: 0,
      key: KEY,
    })
    expect(await open()).toEqual({ status: 404 })
    await archiveTrip(a.scope, tripId)
    expect(await open()).toEqual({ status: 404 })
  })

  it('answers a banned viewer exactly as a dead link', async () => {
    const friend = await a.addUser('Friend')
    expect(await open(secret, { id: friend, banned: true })).toEqual({
      status: 404,
    })
  })

  it('counts every dead link against the miss budget and then answers 429', async () => {
    for (let miss = 0; miss < 20; miss += 1)
      expect(await open('x'.repeat(43))).toEqual({ status: 404 })
    expect(await open('x'.repeat(43))).toEqual({
      status: 429,
      retryAfter: 40,
    })
    // The budget is the visitor's address, not the link: a different address is unaffected.
    expect(await open('x'.repeat(43), null, '198.51.100.7')).toEqual({
      status: 404,
    })
  })

  it('does not let a live link spend the miss budget', async () => {
    for (let hit = 0; hit < 30; hit += 1)
      expect((await open()).status).toBe(200)
  })

  it('answers 429 over the per-address budget, before it resolves anything', async () => {
    for (let call = 0; call < 120; call += 1)
      await spendPublicBudget(store, 'ip', '203.0.113.9', 120, NOON)
    expect(await open()).toEqual({ status: 429, retryAfter: 40 })
    expect((await open(secret, null, '198.51.100.7')).status).toBe(200)
  })

  it('answers 429 over the per-link budget, whoever asks', async () => {
    for (let call = 0; call < 60; call += 1)
      expect((await open(secret, null, `192.0.2.${call}`)).status).toBe(200)
    expect(await open(secret, null, '192.0.2.200')).toEqual({
      status: 429,
      retryAfter: 40,
    })
  })

  it('fails the limiter open when the store is down, but never resolution', async () => {
    store = {
      get: async () => {
        throw new Error('kv down')
      },
      put: async () => {
        throw new Error('kv down')
      },
    }
    expect((await open()).status).toBe(200)
    expect(await open('x'.repeat(43))).toEqual({ status: 404 })
    await updateTripInvite(a.scope, tripId, {
      enabled: false,
      expectedRotation: 0,
      key: KEY,
    })
    expect(await open()).toEqual({ status: 404 })
  })

  it('is read-only: a GET writes no membership and no use count', async () => {
    const friend = await a.addUser('Friend')
    const members = await h.db.select().from(tripMembers)
    await open(secret, { id: friend, banned: false })
    await open()
    expect(await h.db.select().from(tripMembers)).toEqual(members)
    const [link] = await h.db.select().from(tripInviteLinks)
    expect(link).toMatchObject({ useCount: 0, lastUsedAt: null })
  })

  it('logs the link id and the outcome and never the secret', async () => {
    await open()
    await open('x'.repeat(43))
    const text = JSON.stringify(logged)
    expect(text).not.toContain(secret)
    expect(text).not.toContain('x'.repeat(43))
    expect(logged[0]).toMatchObject({
      event: 'found',
      fields: { linkId: expect.any(String) },
    })
    expect(logged[1]).toMatchObject({ event: 'unavailable' })
  })
})

describe('the session-less read path', () => {
  const dir = join(process.cwd(), 'src/server/public')

  function sources(path: string): Array<string> {
    return readdirSync(path).flatMap((entry) => {
      const full = join(path, entry)
      if (statSync(full).isDirectory())
        return entry === '__tests__' ? [] : sources(full)
      return full.endsWith('.ts') ? [full] : []
    })
  }

  it('constructs no tenant scope, calls no auth helper and holds no SQL', () => {
    for (const file of sources(dir)) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/createScope|TenantScope|tenantFilter/)
      expect(text, file).not.toMatch(
        /server\/auth\/session|requireUser|requireOrg|getSession/,
      )
      expect(text, file).not.toMatch(/from 'drizzle-orm'|\.select\(|\.insert\(/)
    }
  })
})
