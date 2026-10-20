import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import {
  addTripMember,
  archiveTrip,
  createTrip,
  listTripMembers,
  updateTripMember,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { findLiveTripInviteByDigestUnscoped } from '#/server/repos/invites'
import { hashSecret } from '#/server/security/secret'
import { tripInviteLinks } from '#/server/db/schema'
import type { TenantScope } from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

import { readTripPeople } from '../people'
import {
  createInviteLinkFn,
  replaceInviteLinkFn,
  revealInviteLinkFn,
  updateInviteLinkFn,
} from '../invite'

const KEY = 'owner-invite-interface-test-key'
const wire = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  key: 'owner-invite-interface-test-key',
  headers: {} as Record<string, string>,
  audits: [] as unknown[],
}))
vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({ server: (handler: unknown) => handler }),
  createServerFn: (options: { method: string }) => ({
    middleware() {
      return this
    },
    validator: <T>(schema: z.ZodType<T>) => ({
      handler:
        <R>(handler: (ctx: { data: T }) => Promise<R>) =>
        async ({ data }: { data: unknown }) => {
          expect(options.method).toBe('POST')
          return handler({ data: schema.parse(data) })
        },
    }),
  }),
}))
vi.mock('@tanstack/react-start/server', () => ({
  setResponseHeader: (key: string, value: string) => {
    wire.headers[key] = value
  },
}))
vi.mock('../../../../-server/context', () => ({
  appScope: async () => {
    if (!wire.scope) throw new Error('unauthenticated')
    return wire.scope
  },
}))
vi.mock('#/server/auth/env', () => ({ authSecret: () => wire.key }))
vi.mock('#/server/audit/trail', () => ({
  trail: async (_scope: TenantScope, input: unknown) => {
    wire.audits.push(input)
  },
}))
describe('owner invite RPC boundary', () => {
  let h: Harness
  let a: SeededTenant
  let b: SeededTenant
  let tripId: string
  beforeEach(async () => {
    h = await createHarness()
    a = await h.seedTenant('a')
    b = await h.seedTenant('b')
    tripId = (
      await createTrip(a.scope, {
        title: 'Lisbon',
        currency: 'EUR',
        visibility: 'organization',
      })
    ).id
    wire.key = KEY
    wire.scope = a.scope
    wire.headers = {}
    wire.audits = []
  })
  const create = () => createInviteLinkFn({ data: { tripId } })
  it('defaults viewer, creates idempotently, reveals the same secret, and rotates with CAS', async () => {
    const first = await create()
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error('create refused')
    expect(first.invite?.role).toBe('viewer')
    expect(await create()).toEqual(first)
    const payload = await readTripPeople(a.scope, tripId, KEY)
    expect(payload.invite).toMatchObject({ state: 'active', role: 'viewer' })
    expect(JSON.stringify(payload)).not.toContain(first.secret)
    expect(JSON.stringify(payload)).not.toContain(
      await hashSecret(first.secret ?? ''),
    )
    expect(await revealInviteLinkFn({ data: { tripId } })).toMatchObject({
      ok: true,
      secret: first.secret,
    })
    const replaced = await replaceInviteLinkFn({
      data: { tripId, role: 'viewer', expectedRotation: 0 },
    })
    expect(replaced.ok).toBe(true)
    if (!replaced.ok) throw new Error('replace refused')
    expect(replaced.secret).not.toBe(first.secret)
    expect(
      await findLiveTripInviteByDigestUnscoped(
        h.db,
        await hashSecret(first.secret ?? ''),
        KEY,
      ),
    ).toBeNull()
    const stale = await replaceInviteLinkFn({
      data: { tripId, role: 'editor', expectedRotation: 0 },
    })
    expect(stale).toMatchObject({ ok: false, reason: 'changed' })
    expect(JSON.stringify(stale)).not.toContain(replaced.secret)
    expect(wire.headers['cache-control']).toBe('private, no-store')
    expect(JSON.stringify(wire.audits)).not.toContain(first.secret)
  })
  it('never returns a secret from update, including switch-on, and old copies remain dead', async () => {
    const first = await create()
    if (!first.ok) throw new Error('create refused')
    const off = await updateInviteLinkFn({
      data: { tripId, enabled: false, expectedRotation: 0 },
    })
    expect(off).toMatchObject({
      ok: true,
      invite: { state: 'off', rotation: 1 },
    })
    const on = await updateInviteLinkFn({
      data: { tripId, enabled: true, expectedRotation: 1 },
    })
    expect(on).toMatchObject({
      ok: true,
      invite: { state: 'active', rotation: 2 },
    })
    expect(on).not.toHaveProperty('secret')
    expect(off).not.toHaveProperty('secret')
    expect(
      await findLiveTripInviteByDigestUnscoped(
        h.db,
        await hashSecret(first.secret ?? ''),
        KEY,
      ),
    ).toBeNull()
  })
  it.each(['editor', 'viewer', 'admin', 'foreign'] as const)(
    'refuses %s at every interface without touching the row',
    async (kind) => {
      await create()
      const before = await h.db.select().from(tripInviteLinks)
      if (kind === 'foreign') wire.scope = b.scope
      else {
        const userId = await a.addUser(
          kind,
          kind === 'admin' ? 'admin' : 'member',
        )
        if (kind !== 'admin')
          await addTripMember(a.scope, { tripId, userId, role: kind })
        wire.scope = a.scopeFor(userId, kind === 'admin' ? 'admin' : 'member')
      }
      if (kind !== 'foreign')
        expect(
          (await readTripPeople(wire.scope, tripId, KEY)).invite,
        ).toBeNull()
      else await expect(readTripPeople(b.scope, tripId, KEY)).rejects.toThrow()
      for (const run of [
        () => create(),
        () => revealInviteLinkFn({ data: { tripId } }),
        () =>
          replaceInviteLinkFn({
            data: { tripId, role: 'viewer', expectedRotation: 0 },
          }),
        () =>
          updateInviteLinkFn({
            data: { tripId, enabled: false, expectedRotation: 0 },
          }),
      ]) {
        const result = await run()
        expect(result).toMatchObject({ ok: false })
        expect(result).not.toHaveProperty('secret')
        expect(result).not.toHaveProperty('invite')
      }
      expect(await h.db.select().from(tripInviteLinks)).toEqual(before)
    },
  )
  it('archived refuses writes and reveals no usable secret', async () => {
    await create()
    await archiveTrip(a.scope, tripId)
    expect(await create()).toEqual({ ok: false, reason: 'archived' })
    expect(await revealInviteLinkFn({ data: { tripId } })).toMatchObject({
      ok: true,
      secret: null,
      invite: { state: 'archived' },
    })
  })
  it('requires replacement after the creator is demoted, and never revives the old copy', async () => {
    const first = await create()
    if (!first.ok) throw new Error('create refused')
    const coowner = await a.addUser('coowner')
    await addTripMember(a.scope, { tripId, userId: coowner, role: 'owner' })
    const creator = (await listTripMembers(a.scope, tripId)).find(
      (row) => row.userId === a.ownerUserId,
    )
    if (!creator) throw new Error('missing owner')
    await updateTripMember(a.scope, creator.id, { role: 'editor' })
    wire.scope = a.scopeFor(coowner)
    expect(await revealInviteLinkFn({ data: { tripId } })).toMatchObject({
      ok: true,
      secret: null,
      invite: { state: 'creator-gone' },
    })
    expect(
      await updateInviteLinkFn({
        data: { tripId, role: 'editor', expectedRotation: 0 },
      }),
    ).toEqual({ ok: false, reason: 'creatorGone' })
    const replacement = await replaceInviteLinkFn({
      data: { tripId, role: 'viewer', expectedRotation: 0 },
    })
    expect(replacement).toMatchObject({
      ok: true,
      invite: { createdBy: coowner, state: 'active' },
    })
    expect(
      await findLiveTripInviteByDigestUnscoped(
        h.db,
        await hashSecret(first.secret ?? ''),
        KEY,
      ),
    ).toBeNull()
  })
  it('shows stale after an auth-key rotation and requires a replacement', async () => {
    const first = await create()
    if (!first.ok) throw new Error('create refused')
    wire.key = 'rotated-auth-key-for-this-test'
    expect(await revealInviteLinkFn({ data: { tripId } })).toMatchObject({
      ok: true,
      secret: null,
      invite: { state: 'stale' },
    })
    expect(
      await replaceInviteLinkFn({
        data: { tripId, role: 'viewer', expectedRotation: 0 },
      }),
    ).toMatchObject({ ok: true, invite: { state: 'active' } })
  })
  it('rejects owner grants and caller-supplied scope/key', async () => {
    await expect(
      Reflect.apply(createInviteLinkFn, undefined, [
        { data: { tripId, role: 'owner' } },
      ]),
    ).rejects.toThrow()
    await expect(
      Reflect.apply(createInviteLinkFn, undefined, [
        { data: { tripId, key: KEY } },
      ]),
    ).rejects.toThrow()
  })
})
