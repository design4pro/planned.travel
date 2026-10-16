import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import type * as ReactStart from '@tanstack/react-start'
import {
  addTripMember,
  archiveTrip,
  createCollabNote,
  createPoll,
  createTrip,
  postMessage,
  tripsRepository,
  TripArchivedError,
  TripRoleError,
  NotFoundError,
  updateTrip,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  mirrors: [] as Array<{ tripId: string; patches: ReadonlyArray<unknown> }>,
}))

// Keep the real handler and Zod validation; only replace Start's generated RPC transport.
vi.mock('@tanstack/react-start', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactStart>()),
  createServerFn: () => ({
    validator: <T>(schema: ZodType<T>) => ({
      handler:
        <R>(handler: (ctx: { data: T }) => Promise<R>) =>
        async ({ data }: { data: unknown }) =>
          handler({ data: schema.parse(data) }),
    }),
  }),
}))

vi.mock('../../../../-server/context', () => ({
  appScope: async () => {
    if (stubs.scope === null) throw new Error('unauthenticated')
    return stubs.scope
  },
}))
vi.mock('#/server/fns/context', () => ({
  mirrorToRoom: async (
    scope: TenantScope,
    tripId: string,
    patches: ReadonlyArray<unknown>,
  ) => {
    expect(
      (await tripsRepository.requireById(scope, tripId)).collabModules,
    ).toEqual({ conversation: true, notes: true, polls: false })
    stubs.mirrors.push({ tripId, patches })
  },
  patch: (kind: string, id: string, fields: unknown) => ({
    entity: { kind, id },
    op: 'upsert',
    fields,
  }),
}))

const { loadTripCollab, setCollabSectionFn } = await import('../collab')
let tenant: SeededTenant
let tripId: string
let readerId: string

beforeEach(async () => {
  tenant = await (await createHarness()).seedTenant('collab-handler')
  tripId = (
    await createTrip(tenant.scope, {
      title: 'Lisbon',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      timezone: 'Europe/Lisbon',
    })
  ).id
  readerId = await tenant.addUser('Reader')
  stubs.scope = tenant.scope
  stubs.mirrors = []
})

const write = () =>
  setCollabSectionFn({ data: { tripId, section: 'polls', on: false } })

describe('collaboration handlers', () => {
  it('returns the persisted record and mirrors only a scalar signal after saving', async () => {
    expect(await write()).toEqual({
      ok: true,
      sections: { conversation: true, notes: true, polls: false },
    })
    expect(stubs.mirrors).toEqual([
      {
        tripId,
        patches: [
          {
            entity: { kind: 'trip', id: tripId },
            op: 'upsert',
            fields: { collabSectionsChangedAt: expect.any(Number) },
          },
        ],
      },
    ])
  })

  it('returns last-section refusal as data and emits nothing', async () => {
    await tripsRepository.requireUpdate(tenant.scope, tripId, {
      collabModules: { conversation: false, notes: false, polls: true },
    })
    const before = await tripsRepository.requireById(tenant.scope, tripId)
    expect(await write()).toEqual({ ok: false, reason: 'last-section' })
    expect(await tripsRepository.requireById(tenant.scope, tripId)).toEqual(
      before,
    )
    expect(stubs.mirrors).toEqual([])
  })

  it('keeps visibility, archive and role refusals ahead of last-section validation', async () => {
    await tripsRepository.requireUpdate(tenant.scope, tripId, {
      collabModules: { conversation: false, notes: false, polls: true },
    })
    stubs.scope = tenant.scopeFor(readerId)
    await expect(write()).rejects.toBeInstanceOf(NotFoundError)
    await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
    await expect(write()).rejects.toBeInstanceOf(TripRoleError)
    await archiveTrip(tenant.scope, tripId)
    await expect(write()).rejects.toBeInstanceOf(TripArchivedError)
    expect(stubs.mirrors).toEqual([])
  })

  it('rejects an invalid input before writing or mirroring', async () => {
    const before = await tripsRepository.requireById(tenant.scope, tripId)
    await expect(
      setCollabSectionFn({
        data: { tripId, section: 'polls', on: false, extra: true },
      } as Parameters<typeof setCollabSectionFn>[0]),
    ).rejects.toThrow()
    expect(await tripsRepository.requireById(tenant.scope, tripId)).toEqual(
      before,
    )
    expect(stubs.mirrors).toEqual([])
  })

  it('preserves all payloads and people even when their section is disabled', async () => {
    await postMessage(tenant.scope, { tripId, body: 'Hello' })
    await createCollabNote(tenant.scope, { tripId, title: 'A note' })
    await createPoll(tenant.scope, {
      tripId,
      question: 'Where?',
      options: [
        { id: 'a', label: 'Here' },
        { id: 'b', label: 'There' },
      ],
    })
    await write()
    const payload = await loadTripCollab({ data: { tripId } })
    expect(payload.sections).toEqual({
      conversation: true,
      notes: true,
      polls: false,
    })
    expect(payload.canConfigure).toBe(true)
    expect(payload.messages).toHaveLength(1)
    expect(payload.notes).toHaveLength(1)
    expect(payload.polls).toHaveLength(1)
    expect(payload.people).toHaveLength(1)
    expect(payload.viewerUserId).toBe(tenant.scope.ctx.userId)
    expect(payload.timeZone).toBe('Europe/Lisbon')
  })

  it('offers configuration only to non-archived owners and editors', async () => {
    await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
    stubs.scope = tenant.scopeFor(readerId)
    expect((await loadTripCollab({ data: { tripId } })).canConfigure).toBe(
      false,
    )
    await addTripMember(tenant.scope, {
      tripId,
      userId: readerId,
      role: 'editor',
    })
    expect((await loadTripCollab({ data: { tripId } })).canConfigure).toBe(true)
    await archiveTrip(tenant.scope, tripId)
    expect((await loadTripCollab({ data: { tripId } })).canConfigure).toBe(
      false,
    )
  })

  it('does not read child payloads for an invisible trip', async () => {
    stubs.scope = tenant.scopeFor(readerId)
    await expect(loadTripCollab({ data: { tripId } })).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })
})
