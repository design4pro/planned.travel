/**
 * What a trip write sends, and what it must never call.
 *
 * The cross-plan obligation `00-foundations.md` filed on this stage, held as assertions rather than
 * as prose: a trip write moves every member's travel statistics, so it enqueues the `travel-stats`
 * envelopes `00-S4` defined — to **the trip's members** (PRD #104 decision 9), never to the
 * workspace, because after decision 1 a private trip is invisible to a non-member and its statistics
 * must be too.
 *
 * And the obligation that was withdrawn: after the grilling redesigned `00-S5` into a scan, no
 * lifecycle write schedules, cancels or re-registers a reminder. That is asserted structurally, by
 * reading the module's own imports — a reflex `cancelReminder()` added here would type-check, pass
 * every behavioural test, and be exactly the defect the redesign exists to prevent.
 *
 * Three properties of `createServerFn` shape the wrappers below, all the framework's rather than this
 * module's, and all already met the same way in `src/server/fns/__tests__/atlas.test.ts`: a handler
 * only runs inside Start's `AsyncLocalStorage`; outside a Start build the boundary validator is not
 * applied on the way in, so it is applied here explicitly; and a handler's return value is discarded
 * on that path, so what a write *did* is read back through the repository rather than off the call.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addTripMember, listTrips, requireTrip } from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { ALL_TIME_STAT_YEAR, taskEnvelopeSchema } from '#/server/queue/types'
import { travelStatsTaskId } from '#/server/queue/handlers/travel-stats'

import type { z } from 'zod'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'
import type { TaskEnvelope, TaskEnvelopeOf } from '#/server/queue/types'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  /** The scope `appScope()` resolves to. */
  scope: null as TenantScope | null,
  /** Every `sendBatch` call, as the array of bodies it carried. */
  batches: [] as Array<Array<unknown>>,
  /** When true, the queue refuses the way an unreachable binding does. */
  queueRejects: false,
}))

/**
 * The `TASKS` binding. `#/server/auth/env` reads the Worker environment for it and imports
 * `cloudflare:workers` at module scope, so it is replaced wholesale: this project runs in plain Node,
 * where that specifier does not resolve.
 */
vi.mock('#/server/auth/env', () => ({
  taskQueue: () => ({
    send: async () => undefined,
    sendBatch: async (messages: Array<{ body: unknown }>) => {
      if (stubs.queueRejects) {
        throw new Error('TASKS binding is unreachable')
      }
      stubs.batches.push(messages.map((message) => message.body))
      return undefined
    },
  }),
}))

vi.mock('../context', async () => {
  const { AuthRequirementError } = await import('#/server/auth/tenant')
  return {
    appScope: async (): Promise<unknown> => {
      if (stubs.scope === null) {
        throw new AuthRequirementError(
          'unauthenticated',
          'You need to sign in to continue.',
        )
      }
      return stubs.scope
    },
  }
})

/* ------------------------------------------------------------ start context */

interface StartContext {
  readonly startOptions: Record<string, never>
  readonly request: Request
}

const startStorage = ((): AsyncLocalStorage<StartContext> => {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage<StartContext>()
  return globals[key] as AsyncLocalStorage<StartContext>
})()

function startContext(): StartContext {
  return {
    startOptions: {},
    request: new Request('https://planned.travel/_serverFn/trip-lifecycle', {
      method: 'POST',
    }),
  }
}

const {
  QUEUE_BATCH_MAX,
  archiveTripFn,
  archiveTripInputSchema,
  createTripFn,
  createTripInputSchema,
  restoreTripFn,
  restoreTripInputSchema,
  updateTripFn,
  updateTripInputSchema,
} = await import('../trip-lifecycle')

/**
 * Applies a boundary validator the way a Start build applies it, and hands the result to the call
 * site as the type that call site asks for.
 *
 * `.validator(schema)` types `createTripFn({ data })` with the schema's *input*, because in a real
 * build the boundary parses on the way in: a caller passes `''` and the handler sees `null`. Here the
 * parse happens on this side of the call, so what is passed already *is* the output — the same object
 * the handler receives either way — and this is the one place the two spellings of it meet.
 */
function atBoundary<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
): z.input<TSchema> {
  return schema.parse(data) as z.input<TSchema>
}

const createTrip = async (data: unknown): Promise<void> => {
  await startStorage.run(startContext(), () =>
    createTripFn({ data: atBoundary(createTripInputSchema, data) }),
  )
}

/**
 * The trip the last {@link createTrip} wrote, read back through the repository — the handler's own
 * return value is discarded outside a Start build.
 */
async function newestTripId(): Promise<string> {
  const rows = await listTrips(tenant.scope, { limit: 1 })
  const id = rows.at(0)?.id
  if (id === undefined) {
    throw new Error(
      'The trip that was just created is not in the caller’s list.',
    )
  }
  return id
}

const updateTrip = async (data: unknown): Promise<void> => {
  await startStorage.run(startContext(), () =>
    updateTripFn({ data: atBoundary(updateTripInputSchema, data) }),
  )
}

const archiveTrip = async (data: unknown): Promise<void> => {
  await startStorage.run(startContext(), () =>
    archiveTripFn({ data: atBoundary(archiveTripInputSchema, data) }),
  )
}

const restoreTrip = async (data: unknown): Promise<void> => {
  await startStorage.run(startContext(), () =>
    restoreTripFn({ data: atBoundary(restoreTripInputSchema, data) }),
  )
}

/* -------------------------------------------------------------------- setup */

let harness: Harness
let tenant: SeededTenant

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('lifecycle')
  stubs.scope = tenant.scope
  stubs.batches = []
  stubs.queueRejects = false
})

afterEach(() => {
  harness.close()
})

/** Every envelope sent, flattened and validated against the real schema. */
function sent(): Array<TaskEnvelope> {
  return stubs.batches.flat().map((body) => taskEnvelopeSchema.parse(body))
}

/** The `travel-stats` envelopes among a batch, narrowed so their payload can be read as itself. */
function travelStats(
  envelopes: ReadonlyArray<TaskEnvelope>,
): Array<TaskEnvelopeOf<'travel-stats'>> {
  return envelopes.filter((envelope) => envelope.kind === 'travel-stats')
}

function statYears(envelopes: ReadonlyArray<TaskEnvelope>): Array<number> {
  return travelStats(envelopes).map((envelope) => envelope.payload.statYear)
}

function statsRecipients(): Array<string> {
  return travelStats(sent()).map((envelope) => envelope.payload.userId)
}

/* ---------------------------------------------------------------- the fan-out */

describe('the travel-statistics fan-out', () => {
  it('sends the all-time envelope to the creator on a new trip', async () => {
    await createTrip({
      title: 'Lisbon in April',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })

    const envelopes = sent()
    expect(envelopes).toHaveLength(1)
    expect(envelopes[0]).toMatchObject({
      kind: 'travel-stats',
      orgId: tenant.organizationId,
      payload: { userId: tenant.ownerUserId, statYear: ALL_TIME_STAT_YEAR },
    })
  })

  it('adds the year of a dated trip, with `00-S4`’s deterministic ids', async () => {
    await createTrip({
      title: 'Lisbon in April',
      destination: '',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })

    const envelopes = sent()
    expect(envelopes.map((envelope) => envelope.kind)).toEqual([
      'travel-stats',
      'travel-stats',
    ])
    expect(statYears(envelopes)).toEqual([ALL_TIME_STAT_YEAR, 2026])

    // `00-S4` owns the id and this stage reuses it rather than composing a second string that could
    // drift: `travel-stats:<org>:<user>:<year>:<collapse window>`.
    for (const envelope of travelStats(envelopes)) {
      const [kind, orgId, userId, statYear] = envelope.id.split(':')
      expect(kind).toBe('travel-stats')
      expect(orgId).toBe(tenant.organizationId)
      expect(userId).toBe(tenant.ownerUserId)
      expect(Number(statYear)).toBe(envelope.payload.statYear)
    }
  })

  it('collapses repeats of one (user, year) onto one id inside a window', () => {
    const at = Date.now()
    expect(
      travelStatsTaskId(tenant.organizationId, tenant.ownerUserId, 2026, at),
    ).toBe(
      travelStatsTaskId(
        tenant.organizationId,
        tenant.ownerUserId,
        2026,
        at + 1,
      ),
    )
  })

  it('sends to the trip’s members and to no other workspace member', async () => {
    const companion = await tenant.addUser('Companion')
    const bystander = await tenant.addUser('Bystander')

    await createTrip({
      title: 'Lisbon in April',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()
    await addTripMember(tenant.scope, {
      tripId,
      userId: companion,
      role: 'editor',
    })

    stubs.batches = []
    await updateTrip({ tripId, title: 'Lisbon in May' })

    const recipients = statsRecipients()
    expect(new Set(recipients)).toEqual(
      new Set([tenant.ownerUserId, companion]),
    )
    expect(recipients).not.toContain(bystander)
  })

  it('carries the year the dates moved from as well as the year they moved to', async () => {
    await createTrip({
      title: 'Lisbon',
      destination: '',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    const tripId = await newestTripId()

    stubs.batches = []
    await updateTrip({ tripId, startDate: '2027-04-10', endDate: '2027-04-12' })

    expect(new Set(statYears(sent()))).toEqual(
      new Set([ALL_TIME_STAT_YEAR, 2026, 2027]),
    )
  })

  it('chunks the fan-out at the Queues batch limit', async () => {
    // 250 members over a 100-message ceiling is three `sendBatch` calls, and the third is short.
    // Asserted as a call count rather than as a total, because a producer that sent 250 messages in
    // one array would pass a total and be refused by the runtime.
    await createTrip({
      title: 'A very large expedition',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()

    for (let index = 0; index < 249; index += 1) {
      await addTripMember(tenant.scope, {
        tripId,
        userId: await tenant.addUser(`Traveller ${index}`),
        role: 'viewer',
      })
    }

    stubs.batches = []
    await updateTrip({ tripId, title: 'A very large expedition, renamed' })

    expect(QUEUE_BATCH_MAX).toBe(100)
    expect(stubs.batches).toHaveLength(3)
    expect(stubs.batches.map((batch) => batch.length)).toEqual([100, 100, 50])
    expect(new Set(statsRecipients()).size).toBe(250)
  })

  it('never fails the write when the queue refuses', async () => {
    await createTrip({
      title: 'Lisbon',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()

    stubs.queueRejects = true
    await expect(
      updateTrip({ tripId, title: 'Lisbon in April' }),
    ).resolves.toBeUndefined()
    expect((await requireTrip(tenant.scope, tripId)).title).toBe(
      'Lisbon in April',
    )
  })
})

/* ------------------------------------------------------------- the verbs */

describe('the lifecycle verbs', () => {
  it('clears an optional field with a blank string and leaves it with `undefined`', async () => {
    await createTrip({
      title: 'Lisbon',
      destination: 'Lisbon, Portugal',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()

    await updateTrip({ tripId, title: 'Lisbon in April' })
    expect((await requireTrip(tenant.scope, tripId)).destination).toBe(
      'Lisbon, Portugal',
    )

    await updateTrip({ tripId, destination: '' })
    expect((await requireTrip(tenant.scope, tripId)).destination).toBeNull()
  })

  it('archives and restores without moving the lifecycle status', async () => {
    await createTrip({
      title: 'Patagonia',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()

    await archiveTrip({ tripId })
    const archived = await requireTrip(tenant.scope, tripId)
    expect(archived.isArchived).toBe(true)
    expect(archived.status).not.toBe('archived')

    await restoreTrip({ tripId })
    const restored = await requireTrip(tenant.scope, tripId)
    expect(restored.isArchived).toBe(false)
    expect(restored.status).toBe(archived.status)
  })

  it('hands the repository the shape it stores, so no field is copied by hand', () => {
    // The normalisation is the schema's, not the handler's. A field the strict object accepts is
    // therefore a field the repository receives — there is no second, hand-written map for a sixth
    // field to be forgotten from, and forgetting it would be silent because every repository field
    // is optional.
    expect(
      createTripInputSchema.parse({
        title: '  Lisbon  ',
        destination: '',
        startDate: '',
        endDate: '',
        currency: 'eur',
      }),
    ).toEqual({
      title: 'Lisbon',
      destination: null,
      startDate: null,
      endDate: null,
      currency: 'EUR',
    })

    expect(
      updateTripInputSchema.parse({
        tripId: 'trip-1',
        destination: '',
        summary: '',
        startDate: '',
        endDate: '',
      }),
    ).toEqual({
      tripId: 'trip-1',
      destination: null,
      summary: null,
      startDate: null,
      endDate: null,
    })
  })

  it('refuses a backwards date range at the boundary, before any write', () => {
    expect(() =>
      updateTripInputSchema.parse({
        tripId: 'x',
        startDate: '2026-04-12',
        endDate: '2026-04-10',
      }),
    ).toThrow()
  })

  it('refuses an unknown field rather than dropping it', () => {
    expect(() =>
      archiveTripInputSchema.parse({ tripId: 'x', isArchived: false }),
    ).toThrow()
  })

  it('leaves the created trip visible to its creator and to nobody else', async () => {
    await createTrip({
      title: 'Lisbon',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()

    expect((await listTrips(tenant.scope)).map((row) => row.id)).toEqual([
      tripId,
    ])
    const bystander = tenant.scopeFor(await tenant.addUser('Bystander'))
    expect(await listTrips(bystander)).toEqual([])
  })
})

/* ------------------------------------------------------ the reminder non-call */

describe('the pre-departure-notice obligation, which no longer exists', () => {
  it('imports nothing from either notice module', () => {
    // Resolved from this file rather than from `process.cwd()`: the module under test is the one
    // next door whatever directory the runner was started in.
    const source = readFileSync(
      new URL('../trip-lifecycle.ts', import.meta.url),
      'utf8',
    )

    // Read off the shipped source rather than asserted behaviourally: under `00-S5`'s scan model the
    // *absence* of a call has no observable effect, so the only honest gate is the import list.
    //
    // A pattern rather than the two specifiers spelled out, because the sweep's own suite walks
    // `src/**` for that literal and asserts the exact set of files carrying it — writing it here
    // would make this file an importer of the module it is checking nobody imports. The pattern also
    // covers the catalogue half, which that walk does not reach.
    expect(source).not.toMatch(/['"][^'"]*\/(?:queue|catalog)\/reminders['"]/)
    for (const banned of [
      'sweepReminders',
      'scheduleReminder',
      'cancelReminder',
    ]) {
      expect(source).not.toContain(banned)
    }
  })
})
