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

import {
  addTripMember,
  canReadTrip,
  createExpense,
  createReservation,
  createTransport,
  listFavouriteTripIds,
  listTrips,
  recordFile,
  requireTrip,
  updateTrip as writeTripRow,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import {
  ALL_TIME_STAT_YEAR,
  MAX_PURGE_KEYS,
  taskEnvelopeSchema,
} from '#/server/queue/types'
import { TRIP_DAY_COUNT_MAX } from '#/lib/trip-dates'
import { travelStatsTaskId } from '#/server/queue/handlers/travel-stats'
import { tripCopyTaskId } from '#/server/queue/handlers/trip-copy'

import type { z } from 'zod'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'
import type { TripDeleteSummary } from '../trip-lifecycle'
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
    // Recorded like a batch of one: a single-envelope producer — the `trip-copy` message — goes
    // through `send`, and the assertions read every envelope the same way whichever verb sent it.
    send: async (body: unknown) => {
      if (stubs.queueRejects) {
        throw new Error('TASKS binding is unreachable')
      }
      stubs.batches.push([body])
      return undefined
    },
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
  DELETE_CONFIRM_THRESHOLD,
  QUEUE_BATCH_MAX,
  archiveTripFn,
  archiveTripInputSchema,
  copyTripFn,
  copyTripInputSchema,
  createTripFn,
  createTripInputSchema,
  deleteTripFn,
  deleteTripInputSchema,
  restoreTripFn,
  restoreTripInputSchema,
  readTripForDelete,
  setTripFavouriteFn,
  setTripFavouriteInputSchema,
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

const setTripFavourite = async (data: unknown): Promise<void> => {
  await startStorage.run(startContext(), () =>
    setTripFavouriteFn({ data: atBoundary(setTripFavouriteInputSchema, data) }),
  )
}

const copyTrip = async (data: unknown): Promise<void> => {
  await startStorage.run(startContext(), () =>
    copyTripFn({ data: atBoundary(copyTripInputSchema, data) }),
  )
}

const deleteTrip = async (data: unknown): Promise<void> => {
  await startStorage.run(startContext(), () =>
    deleteTripFn({ data: atBoundary(deleteTripInputSchema, data) }),
  )
}

/** The scope `appScope()` would resolve to, which every case sets before it asks anything. */
function actingScope(): TenantScope {
  if (stubs.scope === null) {
    throw new Error('This case has no acting scope to read the trip with.')
  }
  return stubs.scope
}

/**
 * The summary `tripDeleteSummaryFn` answers with, read through the seam it sits on: a handler's
 * return value is discarded outside a Start build, so the boundary can only be asked what it
 * *refuses*, and what it *says* is asked of the function underneath it.
 */
const deleteSummary = async ({
  tripId,
}: {
  tripId: string
}): Promise<TripDeleteSummary> =>
  (await readTripForDelete(actingScope(), tripId)).summary

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

  it('stays silent when a trip is shelved, restored or starred', async () => {
    await createTrip({
      title: 'Lisbon',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()
    // The creation's own envelope is not what this case is about.
    stubs.batches = []

    await archiveTrip({ tripId })
    await restoreTrip({ tripId })
    await setTripFavourite({ tripId, isFavourite: true })

    // `00-S4` counts a person's trips by membership, and none of the three moves a membership row:
    // shelving a trip, bringing it back and bookmarking it all leave every member's statistics where
    // they were. The star is read back so this is a silence over a write that happened.
    expect(sent()).toEqual([])
    expect(await listFavouriteTripIds(tenant.scope)).toEqual([tripId])
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

  it('carries the summary, a day count and the reminder days through the strict create schema', () => {
    expect(
      createTripInputSchema.parse({
        title: 'Open-ended',
        summary: ' Two weeks. ',
        destination: '',
        startDate: '',
        endDate: '',
        dayCount: 14,
        currency: 'eur',
        reminderDays: 9,
      }),
    ).toMatchObject({ summary: 'Two weeks.', dayCount: 14, reminderDays: 9 })
  })

  it('refuses a day count beside either date, and one outside its range', () => {
    const base = { title: 'x', destination: '', currency: 'EUR' }
    const dated = [
      { startDate: '2026-06-01', endDate: '' },
      { startDate: '', endDate: '2026-06-03' },
      { startDate: '2026-06-01', endDate: '2026-06-03' },
    ]
    for (const dates of dated) {
      expect(() =>
        createTripInputSchema.parse({ ...base, ...dates, dayCount: 3 }),
      ).toThrow()
    }
    for (const dayCount of [0, -1, 1.5, TRIP_DAY_COUNT_MAX + 1]) {
      expect(() =>
        createTripInputSchema.parse({
          ...base,
          startDate: '',
          endDate: '',
          dayCount,
        }),
      ).toThrow()
    }
  })

  it('takes reminder days on an edit and refuses a day count there', () => {
    expect(
      updateTripInputSchema.parse({ tripId: 'trip-1', reminderDays: 0 }),
    ).toEqual({ tripId: 'trip-1', reminderDays: 0 })
    expect(() =>
      updateTripInputSchema.parse({ tripId: 'trip-1', dayCount: 3 }),
    ).toThrow()
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

/* ------------------------------------------------------------- deleting */

/**
 * Delete is terminal and its ceremony is graduated (PRD #104 decisions 3 and 10).
 *
 * The threshold is the **server's**: the client renders whichever dialog the payload asks for, and a
 * hand-rolled request that simply omits `confirmTitle` is refused by the same rule the dialog read.
 * That is the property these cases are built around — every one of them calls the server function
 * directly, which is exactly what a client skipping the ceremony would do.
 */
describe('the graduated delete confirmation', () => {
  /** A trip with nothing on it and one member — the two-day sketch decision 10 lets go lightly. */
  async function sketch(): Promise<string> {
    await createTrip({
      title: 'Weekend sketch',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    return newestTripId()
  }

  it('accepts an absent confirmation for a trip with no record and one member', async () => {
    const tripId = await sketch()

    expect(await deleteSummary({ tripId })).toMatchObject({
      requiresTitle: false,
      reservations: 0,
      transports: 0,
      expenses: 0,
      files: 0,
      members: 1,
    })

    await deleteTrip({ tripId })
    expect(await canReadTrip(tenant.scope, tripId)).toBe(false)
  })

  it.each([
    [
      'a booking',
      async (tripId: string) => {
        await createReservation(tenant.scope, { tripId, title: 'Hotel Lisboa' })
      },
    ],
    [
      'a leg',
      async (tripId: string) => {
        await createTransport(tenant.scope, { tripId, title: 'Flight out' })
      },
    ],
    [
      'an expense',
      async (tripId: string) => {
        await createExpense(tenant.scope, {
          tripId,
          title: 'Tram tickets',
          amountMinor: 640,
          spentOn: '2026-04-10',
        })
      },
    ],
    [
      'a file',
      async (tripId: string) => {
        await recordFile(tenant.scope, {
          tripId,
          storageKey: `trips/${tenant.organizationId}/${tripId}/f1-booking.pdf`,
          filename: 'booking.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
        })
      },
    ],
  ])(
    'demands the title once the trip carries %s',
    async (_label, addRecord) => {
      const tripId = await sketch()
      await addRecord(tripId)

      expect(await deleteSummary({ tripId })).toMatchObject({
        requiresTitle: true,
        title: 'Weekend sketch',
      })

      // The refusal is a validation failure, so what crosses the boundary is the sentence naming what
      // to type rather than a redacted diagnostic.
      await expect(deleteTrip({ tripId })).rejects.toThrow()
      await expect(
        deleteTrip({ tripId, confirmTitle: 'wrong' }),
      ).rejects.toThrow()
      expect(await canReadTrip(tenant.scope, tripId)).toBe(true)

      await deleteTrip({ tripId, confirmTitle: 'Weekend sketch' })
      expect(await canReadTrip(tenant.scope, tripId)).toBe(false)
    },
  )

  it('demands the title for a trip whose only weight is company', async () => {
    const tripId = await sketch()
    await addTripMember(tenant.scope, {
      tripId,
      userId: await tenant.addUser('Companion'),
      role: 'editor',
    })

    expect(DELETE_CONFIRM_THRESHOLD).toEqual({ records: 0, members: 1 })
    expect(await deleteSummary({ tripId })).toMatchObject({
      requiresTitle: true,
      members: 2,
    })

    await expect(deleteTrip({ tripId })).rejects.toThrow()
    await deleteTrip({ tripId, confirmTitle: 'Weekend sketch' })
    expect(await canReadTrip(tenant.scope, tripId)).toBe(false)
  })

  it('refuses a trip the caller may not see without saying whether it exists', async () => {
    const tripId = await sketch()
    const bystander = tenant.scopeFor(await tenant.addUser('Bystander'))
    stubs.scope = bystander

    await expect(deleteSummary({ tripId })).rejects.toThrow()
    await expect(deleteTrip({ tripId })).rejects.toThrow()

    stubs.scope = tenant.scope
    expect(await canReadTrip(tenant.scope, tripId)).toBe(true)
  })
})

/* --------------------------------------------------------------- the purge */

/** The `trip-purge` envelopes among everything that was sent. */
function purges(): Array<TaskEnvelopeOf<'trip-purge'>> {
  return sent().filter((envelope) => envelope.kind === 'trip-purge')
}

describe('the storage purge a delete leaves behind', () => {
  /** A trip carrying one file and a cover object, which is what a purge has to sweep. */
  async function tripWithObjects(): Promise<{
    tripId: string
    fileKey: string
    coverKey: string
  }> {
    await createTrip({
      title: 'Lisbon in April',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()
    const fileKey = `trips/${tenant.organizationId}/${tripId}/f1-booking.pdf`
    const coverKey = `trips/${tenant.organizationId}/${tripId}/cover.jpg`

    await recordFile(tenant.scope, {
      tripId,
      storageKey: fileKey,
      filename: 'booking.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
    })
    // No boundary schema carries the cover key yet (`01-S8` owns the form), so it is written through
    // the repository — the purge has to sweep it the day one does, and that is what this asserts.
    await writeTripRow(tenant.scope, tripId, { coverImageKey: coverKey })

    return { tripId, fileKey, coverKey }
  }

  it('enqueues one envelope carrying the file keys and the cover key', async () => {
    const { tripId, fileKey, coverKey } = await tripWithObjects()
    stubs.batches = []

    await deleteTrip({ tripId, confirmTitle: 'Lisbon in April' })

    const enqueued = purges()
    expect(enqueued).toHaveLength(1)
    expect(enqueued[0]?.id).toBe(`trip-purge:${tripId}`)
    expect(enqueued[0]?.orgId).toBe(tenant.organizationId)
    expect(new Set(enqueued[0]?.payload.keys)).toEqual(
      new Set([fileKey, coverKey]),
    )
  })

  it('sweeps the files of a trip whose cover column holds a blank key', async () => {
    const { tripId, fileKey } = await tripWithObjects()
    // A blank cover column names no object, and carried into the payload it would fail the envelope
    // schema — taking the trip's real keys down with it, inside the catch that keeps a queue failure
    // off the delete.
    await writeTripRow(tenant.scope, tripId, { coverImageKey: '' })
    stubs.batches = []

    await deleteTrip({ tripId, confirmTitle: 'Lisbon in April' })

    expect(purges().flatMap((envelope) => envelope.payload.keys)).toEqual([
      fileKey,
    ])
  })

  it('sends nothing to sweep for a trip that owns no object', async () => {
    await createTrip({
      title: 'Weekend sketch',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()
    stubs.batches = []

    await deleteTrip({ tripId })
    expect(purges()).toEqual([])
  })

  // Recording `MAX_PURGE_KEYS + 1` files one at a time costs a few thousand queries before the
  // assertion is even reached, which is more than the default per-test budget allows.
  it('splits a trip with more objects than one message can carry', async () => {
    await createTrip({
      title: 'A very well documented expedition',
      destination: '',
      startDate: '',
      endDate: '',
      currency: 'EUR',
    })
    const tripId = await newestTripId()
    await subscribeTenant(tenant.scope, 'crew', 5)

    const keys = Array.from(
      { length: MAX_PURGE_KEYS + 1 },
      (_, index) =>
        `trips/${tenant.organizationId}/${tripId}/f${index}-doc.pdf`,
    )
    for (const storageKey of keys) {
      await recordFile(tenant.scope, {
        tripId,
        storageKey,
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        sizeBytes: 16,
      })
    }
    stubs.batches = []

    await deleteTrip({
      tripId,
      confirmTitle: 'A very well documented expedition',
    })

    // Two envelopes, distinct ids, and every key carried exactly once: an id shared between chunks
    // would see the second acked as a duplicate and its objects left in the bucket forever.
    const enqueued = purges()
    expect(enqueued.map((envelope) => envelope.payload.keys.length)).toEqual([
      MAX_PURGE_KEYS,
      1,
    ])
    expect(new Set(enqueued.map((envelope) => envelope.id)).size).toBe(2)
    expect(
      new Set(enqueued.flatMap((envelope) => envelope.payload.keys)),
    ).toEqual(new Set(keys))
  }, 60_000)

  it('deletes the trip anyway when the queue refuses the sweep', async () => {
    const { tripId } = await tripWithObjects()
    stubs.queueRejects = true

    await expect(
      deleteTrip({ tripId, confirmTitle: 'Lisbon in April' }),
    ).resolves.toBeUndefined()
    expect(await canReadTrip(tenant.scope, tripId)).toBe(false)
  })

  it('fans the statistics out to the members the trip had, read before the cascade', async () => {
    await createTrip({
      title: 'Lisbon',
      destination: '',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    const tripId = await newestTripId()
    const companion = await tenant.addUser('Companion')
    await addTripMember(tenant.scope, {
      tripId,
      userId: companion,
      role: 'viewer',
    })
    stubs.batches = []

    await deleteTrip({ tripId, confirmTitle: 'Lisbon' })

    // The membership rows go with the cascade, so a fan-out that read them afterwards would send
    // nothing at all and every member's trip count would stay one too high until their next write.
    expect(new Set(statsRecipients())).toEqual(
      new Set([tenant.ownerUserId, companion]),
    )
    expect(new Set(statYears(sent()))).toEqual(
      new Set([ALL_TIME_STAT_YEAR, 2026]),
    )
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

/* ------------------------------------------------------------ the trip copy */

/**
 * What `copyTripFn` sends, and what it undoes when it cannot.
 *
 * The synchronous half's own behaviour — the quotas, the slug, the owner row, the day run — belongs
 * to `startTripCopy` and is asserted in `src/server/repos/__tests__/trip-lifecycle.test.ts`. What is
 * this boundary's is the envelope, the rollback, and the range rule the schema carries.
 */
describe('the trip copy', () => {
  /** The `trip-copy` envelopes among a batch, narrowed so their payload can be read as itself. */
  function tripCopies(): Array<TaskEnvelopeOf<'trip-copy'>> {
    return sent().filter((envelope) => envelope.kind === 'trip-copy')
  }

  async function seedSource(): Promise<string> {
    await createTrip({
      title: 'Lisbon',
      destination: 'Lisbon, Portugal',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    const tripId = await newestTripId()
    stubs.batches = []
    return tripId
  }

  it('refuses a range with only one end, before anything is written', () => {
    const half = copyTripInputSchema.safeParse({
      tripId: 'trip-1',
      title: 'Lisbon again',
      startDate: '2026-06-01',
    })
    expect(half.success).toBe(false)

    // Both ends, or neither: an undated copy is a template rather than a mistake.
    for (const dates of [
      {},
      { startDate: '2026-06-01', endDate: '2026-06-03' },
    ]) {
      expect(
        copyTripInputSchema.safeParse({
          tripId: 'trip-1',
          title: 'Lisbon again',
          ...dates,
        }).success,
      ).toBe(true)
    }
  })

  it('enqueues one envelope named on the target it just minted', async () => {
    const sourceId = await seedSource()

    await copyTrip({
      tripId: sourceId,
      title: 'Lisbon again',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    })

    const envelopes = tripCopies()
    expect(envelopes).toHaveLength(1)
    const envelope = envelopes[0]
    const targetId = envelope.payload.targetTripId
    expect(envelope.payload).toEqual({
      sourceTripId: sourceId,
      targetTripId: targetId,
      requestedBy: tenant.ownerUserId,
    })
    // Deterministic on the target, which cannot repeat: a redelivery is one job, and a second Copy
    // on the same source is a different trip and a different envelope.
    expect(envelope.id).toBe(tripCopyTaskId(targetId))
    expect(targetId).not.toBe(sourceId)

    // The target exists, stamped, with the reader's own range rather than the source's.
    const target = await requireTrip(tenant.scope, targetId)
    expect(target.copyPendingAt).not.toBeNull()
    expect(target.startDate).toBe('2026-06-01')

    // And the copier's own statistics moved: the all-time roll-up and the year they are copying into.
    expect(statYears(sent()).sort()).toEqual([ALL_TIME_STAT_YEAR, 2026])
    // One recipient — the copier, sole member of a trip that is one minute old — and one envelope
    // per year, which is what the two entries are.
    expect(new Set(statsRecipients())).toEqual(new Set([tenant.ownerUserId]))
  })

  it('rolls the target back when the queue refuses the message', async () => {
    const sourceId = await seedSource()
    stubs.queueRejects = true

    await expect(
      copyTrip({ tripId: sourceId, title: 'Lisbon again' }),
    ).rejects.toThrow()

    // A stamped trip with no consumer to clear it is a tile stuck on "Copying" for good, so the
    // half that did land is undone rather than left for a `wrangler d1 execute` to repair.
    expect((await listTrips(tenant.scope)).map((row) => row.id)).toEqual([
      sourceId,
    ])
  })
})
