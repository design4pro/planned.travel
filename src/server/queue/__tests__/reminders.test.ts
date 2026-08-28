/**
 * The reminder sweep, and the cross-tenant scan it reads from.
 *
 * Both halves run against the real thing: a fully migrated in-memory database, real repositories,
 * real tenant scoping, the real notification dispatch. Only the two bindings a cron cannot have in
 * Node are doubles — `KV` is a map that can be told to fail, and `TASKS` records what it was handed.
 *
 * The one module mock is `requireTrip`, and it earns its place twice: it is where the resolved
 * scope and the *role* it carries become observable — the row the sweep writes records the scope's
 * user but not its role — and it is the cheapest way to make exactly one trip in a tick throw.
 * With `spies.failTripId` unset it delegates, so nothing else here is a fixture.
 *
 * The stage this file covers replaced a schedule-at-write index with a scan (ADR 0005), so the
 * properties worth pinning are the ones that model makes possible and the old one could not keep:
 * the anchor is a pure function of two current columns, a trip is reminded once per due instant, a
 * moved start date is a *different* due instant rather than an orphaned key, and one trip's failure
 * does not take the tick down with it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createStoredTranslator, loadCatalogue } from '#/lib/i18n/catalogue'
import { paramsFrom, renderStored, storedKey } from '#/lib/notification-copy'
import {
  DAY_MS,
  REMINDER_SCAN_DAYS,
  listDueTripReminders,
  reminderDueAt,
} from '#/server/catalog/reminders'
import { createLogger, createMemorySink } from '#/server/observability'
import { createHarness } from '#/server/repos/__tests__/harness'

import { taskEnvelopeSchema } from '../types'

import type { ReminderScanOptions } from '#/server/catalog/reminders'
import type { LogRecord } from '#/server/observability'
import type * as Repos from '#/server/repos'
import type { TenantContext } from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { ReminderSweepResult } from '../reminders'
import type { TaskBindings } from '../types'

/* ------------------------------------------------------------------ mocking */

const spies = vi.hoisted(() => ({
  /** The tenant context every `requireTrip` in the tick ran under, in order. */
  scopes: [] as Array<TenantContext>,
  /** When set, reading this trip throws — one broken workspace inside a healthy tick. */
  failTripId: null as string | null,
  /**
   * Runs once inside the next read, before it delegates: the gap between the scan and the read,
   * held open long enough for a test to move the row the scan answered with.
   */
  beforeRead: null as (() => Promise<void>) | null,
}))

vi.mock('#/server/repos', async (importOriginal) => {
  const actual = await importOriginal<typeof Repos>()
  return {
    ...actual,
    requireTrip: async (
      ...args: Parameters<typeof actual.requireTrip>
    ): ReturnType<typeof actual.requireTrip> => {
      spies.scopes.push(args[0].ctx)
      if (spies.failTripId === args[1]) {
        throw new Error('the trip row could not be read')
      }
      const interleaved = spies.beforeRead
      if (interleaved !== null) {
        spies.beforeRead = null
        await interleaved()
      }
      return actual.requireTrip(...args)
    },
  }
})

const {
  REMINDER_EVENT_KIND,
  REMINDER_MARKER_TTL_SECONDS,
  reminderMarkerKey,
  sweepReminders,
} = await import('../reminders')

/* --------------------------------------------------------------------- time */

/** 09:00 UTC, an hour after the anchor, so "today at 08:00" is already behind `now`. */
const NOW = Date.UTC(2026, 2, 10, 9, 0)

/** The instant a trip starting three days after {@link NOW} with a 3-day lead time is due at. */
const DUE_AT = Date.UTC(2026, 2, 10, 8)

/**
 * The `eventType` the settings screen writes when "Departure reminders" is switched off — the
 * `trip.starting_soon` row of `NOTIFICATION_EVENTS` in `src/routes/_app/-lib/notifications.ts`.
 *
 * Spelled out rather than imported from {@link REMINDER_EVENT_KIND}, because the property under
 * test is precisely that the two are the same string: a sweep dispatching under a kind no screen
 * writes a preference row for is a switch that suppresses nothing.
 */
const SETTINGS_EVENT_TYPE = 'trip.starting_soon'

function dayString(instant: number): string {
  return new Date(instant).toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ doubles */

/** A `KV` double: a map, plus a switch that makes either half reject. */
function memoryKv(fails: { get?: boolean; put?: boolean } = {}) {
  const store = new Map<string, string>()
  const puts: Array<{ key: string; ttl: number | undefined }> = []
  return {
    store,
    puts,
    async get(key: string): Promise<string | null> {
      if (fails.get === true) throw new Error('KV unavailable')
      return store.get(key) ?? null
    },
    async put(
      key: string,
      value: string,
      options?: { expirationTtl?: number },
    ): Promise<void> {
      if (fails.put === true) throw new Error('KV unavailable')
      puts.push({ key, ttl: options?.expirationTtl })
      store.set(key, value)
    },
    async delete(key: string): Promise<void> {
      store.delete(key)
    },
    async list(): Promise<{
      keys: Array<{ name: string }>
      list_complete: boolean
    }> {
      return {
        keys: [...store.keys()].map((name) => ({ name })),
        list_complete: true,
      }
    },
  }
}

/** A `TASKS` double that records every envelope it is handed. */
function recordingQueue() {
  const bodies: Array<{ id: string; kind: string; orgId: string }> = []
  return {
    bodies,
    ids(): Array<string> {
      return bodies.map((body) => body.id)
    },
    async send(): Promise<unknown> {
      throw new Error('the sweep must batch, never send one at a time')
    },
    async sendBatch(messages: Array<{ body: unknown }>): Promise<unknown> {
      for (const message of messages) {
        bodies.push(message.body as { id: string; kind: string; orgId: string })
      }
      return undefined
    },
  }
}

function memoryLogger() {
  const sink = createMemorySink()
  return { sink, logger: createLogger({ level: 'debug', sink }) }
}

function messaged(sink: { records: Array<LogRecord> }, prefix: string): number {
  return sink.records.filter((record) => record.msg.startsWith(prefix)).length
}

/* ----------------------------------------------------------------- fixtures */

let harness: Harness

interface World {
  readonly tenant: SeededTenant
  readonly ownerId: string
  readonly otherId: string
}

async function seedWorld(label: string): Promise<World> {
  const { upsertSubscription } = await import('#/server/repos')
  const tenant = await harness.seedTenant(label)
  await upsertSubscription(tenant.scope, {
    plan: 'pro',
    status: 'active',
    seats: 5,
  })
  const otherId = await tenant.addUser(`Second ${label}`)
  return { tenant, ownerId: tenant.ownerUserId, otherId }
}

interface TripOptions {
  readonly startDate?: string | null
  readonly reminderDays?: number
  readonly isArchived?: boolean
  readonly title?: string
  readonly withSecondMember?: boolean
}

/** A trip whose default anchor is {@link DUE_AT}. */
async function seedTrip(
  world: World,
  options: TripOptions = {},
): Promise<string> {
  const { addTripMember, createTrip } = await import('#/server/repos')
  const trip = await createTrip(world.tenant.scope, {
    title: options.title ?? 'Lisbon in spring',
    currency: 'EUR',
    startDate:
      options.startDate === undefined
        ? dayString(NOW + 3 * DAY_MS)
        : options.startDate,
    reminderDays: options.reminderDays ?? 3,
    ...(options.isArchived === undefined
      ? {}
      : { isArchived: options.isArchived }),
  })
  if (options.withSecondMember === true) {
    await addTripMember(world.tenant.scope, {
      tripId: trip.id,
      userId: world.otherId,
    })
  }
  return trip.id
}

/** Drops one user's membership of a trip, by the row id the repository addresses it with. */
async function dropTripMember(
  world: World,
  tripId: string,
  userId: string,
): Promise<void> {
  const { listTripMembers, removeTripMember } = await import('#/server/repos')
  const members = await listTripMembers(world.tenant.scope, tripId)
  const row = members.find((member) => member.userId === userId)
  await removeTripMember(world.tenant.scope, row?.id ?? '')
}

/** The in-app half of a reminder: the rows one member can see in their own inbox. */
async function inbox(
  world: World,
  userId: string,
): Promise<Awaited<ReturnType<typeof Repos.listNotifications>>['items']> {
  const { listNotifications } = await import('#/server/repos')
  return (await listNotifications(world.tenant.scope, userId)).items
}

/** Switches "Departure reminders" off for one member on one channel, as the settings screen does. */
async function optOut(
  world: World,
  userId: string,
  channel: 'in_app' | 'email',
): Promise<void> {
  const { setPreference } = await import('#/server/repos')
  await setPreference(world.tenant.scope, {
    userId,
    eventType: SETTINGS_EVENT_TYPE,
    channel,
    isEnabled: false,
  })
}

/** The binding surface a cron tick sees, with the two doubles in place of KV and the queue. */
function env(
  kv: ReturnType<typeof memoryKv>,
  queue: ReturnType<typeof recordingQueue>,
): TaskBindings {
  return {
    KV: kv,
    FILES: {
      get: async () => null,
      put: async () => undefined,
      head: async () => null,
      delete: async () => undefined,
      list: async () => ({ objects: [], truncated: false }),
    },
    TASKS: queue,
    // Present but never dereferenced: the sweep builds its Drizzle handle through the injected
    // seam, so only the missing-binding guard reads this.
    DB: {} as TaskBindings['DB'],
    APP_URL: 'https://planned.test',
  }
}

/** One cron tick over the doubles: what it returned, and what it wrote to the log. */
async function sweep(
  kv: ReturnType<typeof memoryKv>,
  queue: ReturnType<typeof recordingQueue>,
  at: number = NOW,
  scan?: ReminderScanOptions,
): Promise<{
  result: ReminderSweepResult
  sink: ReturnType<typeof createMemorySink>
}> {
  const { logger, sink } = memoryLogger()
  const result = await sweepReminders(env(kv, queue), logger, at, {
    databaseFor: () => harness.db,
    ...(scan === undefined ? {} : { scan }),
  })
  return { result, sink }
}

/* ---------------------------------------------------------------- the anchor */

describe('reminderDueAt', () => {
  it('anchors at 08:00 UTC on the day the lead time lands on', () => {
    expect(reminderDueAt({ startDate: '2026-03-10', reminderDays: 3 })).toBe(
      Date.UTC(2026, 2, 7, 8),
    )
    expect(reminderDueAt({ startDate: '2026-03-01', reminderDays: 1 })).toBe(
      Date.UTC(2026, 1, 28, 8),
    )
  })

  it('answers for an instant already in the past, because it knows nothing about now', () => {
    expect(reminderDueAt({ startDate: '1999-01-04', reminderDays: 3 })).toBe(
      Date.UTC(1999, 0, 1, 8),
    )
  })

  it('answers null for every anchor that asks for no reminder', () => {
    expect(reminderDueAt({ startDate: null, reminderDays: 3 })).toBeNull()
    expect(
      reminderDueAt({ startDate: '2026-03-10', reminderDays: 0 }),
    ).toBeNull()
    expect(
      reminderDueAt({ startDate: '2026-03-10', reminderDays: -1 }),
    ).toBeNull()
    expect(
      reminderDueAt({ startDate: '2026-03-10', reminderDays: 1.5 }),
    ).toBeNull()
    // Out of range rather than rolled forward to 2 March, which `Date.parse` does on its own.
    expect(
      reminderDueAt({ startDate: '2026-02-30', reminderDays: 1 }),
    ).toBeNull()
    expect(reminderDueAt({ startDate: 'someday', reminderDays: 1 })).toBeNull()
  })
})

/* ------------------------------------------------------------------ the scan */

describe('listDueTripReminders', () => {
  let alpha: World
  let beta: World

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await seedWorld('alpha')
    beta = await seedWorld('beta')
  })

  afterEach(() => {
    harness.close()
  })

  it('returns both tenants’ due rows, and nothing but scheduling fields', async () => {
    const alphaTrip = await seedTrip(alpha)
    const betaTrip = await seedTrip(beta, { title: 'Porto in autumn' })

    const scan = await listDueTripReminders(harness.db, NOW)

    // A cross-tenant read that answered with a title, a destination or a member would be the leak
    // the carve-out is worth arguing about. It answers with coordinates.
    expect(scan.due.map((row) => Object.keys(row).sort())).toEqual([
      ['dueAt', 'organizationId', 'tripId'],
      ['dueAt', 'organizationId', 'tripId'],
    ])
    expect(
      scan.due
        .map((row) => `${row.organizationId}/${row.tripId}/${row.dueAt}`)
        .sort(),
    ).toEqual(
      [
        `${alpha.tenant.organizationId}/${alphaTrip}/${DUE_AT}`,
        `${beta.tenant.organizationId}/${betaTrip}/${DUE_AT}`,
      ].sort(),
    )
    expect(scan.truncated).toBe(false)
  })

  it('never surfaces a trip that asks for no reminder', async () => {
    await seedTrip(alpha, { reminderDays: 0 })
    await seedTrip(alpha, { startDate: null })
    await seedTrip(alpha, { isArchived: true })

    expect((await listDueTripReminders(harness.db, NOW)).due).toEqual([])
  })

  it('holds the 24-hour grace open and then closes it', async () => {
    await seedTrip(alpha)

    // The instant itself, and the last millisecond of the day after it.
    expect((await listDueTripReminders(harness.db, DUE_AT)).due).toHaveLength(1)
    expect(
      (await listDueTripReminders(harness.db, DUE_AT + DAY_MS - 1)).due,
    ).toHaveLength(1)
    // A minute before, and a day late: neither is this window.
    expect(
      (await listDueTripReminders(harness.db, DUE_AT - 60_000)).due,
    ).toEqual([])
    expect(
      (await listDueTripReminders(harness.db, DUE_AT + DAY_MS)).due,
    ).toEqual([])
  })

  it('reads a lead time up to the scan window and, statedly, not past it', async () => {
    // The window is a `start_date` range, so the longest lead time that can surface is the one the
    // range is wide enough to reach. `trips.reminder_days` accepts up to 365; this is the boundary.
    const inWindow = await seedTrip(alpha, {
      reminderDays: REMINDER_SCAN_DAYS,
      startDate: dayString(NOW + REMINDER_SCAN_DAYS * DAY_MS),
    })
    await seedTrip(alpha, {
      reminderDays: REMINDER_SCAN_DAYS + 1,
      startDate: dayString(NOW + (REMINDER_SCAN_DAYS + 1) * DAY_MS),
    })

    expect(
      (await listDueTripReminders(harness.db, NOW)).due.map(
        (row) => row.tripId,
      ),
    ).toEqual([inWindow])
  })

  it('walks past a page boundary without re-reading or losing a row', async () => {
    const ids = new Set<string>()
    for (let index = 0; index < 5; index += 1) {
      ids.add(await seedTrip(alpha, { title: `Trip ${index}` }))
    }

    const scan = await listDueTripReminders(harness.db, NOW, { pageSize: 2 })

    expect(scan.due).toHaveLength(5)
    expect(new Set(scan.due.map((row) => row.tripId))).toEqual(ids)
    expect(scan.truncated).toBe(false)
  })

  it('reports a scan the row bound cut short rather than reading it as “nothing else due”', async () => {
    for (let index = 0; index < 4; index += 1) {
      await seedTrip(alpha, { title: `Trip ${index}` })
    }

    const scan = await listDueTripReminders(harness.db, NOW, {
      pageSize: 2,
      maxRows: 2,
    })

    expect(scan.scanned).toBe(2)
    expect(scan.due).toHaveLength(2)
    expect(scan.truncated).toBe(true)
  })
})

/* ----------------------------------------------------------------- the sweep */

describe('sweepReminders', () => {
  let alpha: World
  let beta: World

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await seedWorld('alpha')
    beta = await seedWorld('beta')
    spies.scopes = []
    spies.failTripId = null
    spies.beforeRead = null
  })

  afterEach(() => {
    harness.close()
  })

  it('writes one inbox row and one email envelope per member', async () => {
    const tripId = await seedTrip(alpha, { withSecondMember: true })
    const kv = memoryKv()
    const queue = recordingQueue()

    const { result } = await sweep(kv, queue)

    expect(result).toEqual({
      scanned: 1,
      due: 1,
      notified: 1,
      skipped: 0,
      failed: 0,
    })
    // No actor, so the trip's owner is a recipient as well as the second member — a reminder that
    // excluded the person who owns the trip would be the obvious way to get this wrong.
    const owner = await inbox(alpha, alpha.ownerId)
    const other = await inbox(alpha, alpha.otherId)
    expect(owner).toHaveLength(1)
    expect(other).toHaveLength(1)
    // The kind *is* the catalogue key, so `titleKey` is simply left to default to it.
    expect(owner[0]?.titleKey).toBe(REMINDER_EVENT_KIND)
    expect(owner[0]?.bodyKey).toBe(REMINDER_EVENT_KIND)
    expect(owner[0]?.titleParams).toEqual({
      tripTitle: 'Lisbon in spring',
      days: 3,
    })
    expect(owner[0]?.actionUrl).toBe(`/trips/${tripId}`)
    // Measured, not desired: the event names no actor, but `notifyMany` stamps
    // `senderUserId` from the scope unconditionally, so the row records the member the sweep
    // resolved. Nothing renders the column today; changing it means editing
    // `src/server/repos/notifications.ts`, which this stage does not own.
    expect(owner[0]?.senderUserId).toBe(alpha.ownerId)

    expect(queue.ids().sort()).toEqual(
      [
        `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT}:${alpha.ownerId}`,
        `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT}:${alpha.otherId}`,
      ].sort(),
    )
    expect(
      queue.bodies.every((body) => body.orgId === alpha.tenant.organizationId),
    ).toBe(true)
  })

  it('delivers nothing to a member who switched Departure reminders off', async () => {
    const tripId = await seedTrip(alpha, { withSecondMember: true })
    await optOut(alpha, alpha.ownerId, 'in_app')
    await optOut(alpha, alpha.ownerId, 'email')
    const kv = memoryKv()
    const queue = recordingQueue()

    const { result } = await sweep(kv, queue)

    // Both halves, from the one row the switch writes. The other member never touched the switch
    // and is reminded in the same tick.
    expect(await inbox(alpha, alpha.ownerId)).toEqual([])
    expect(await inbox(alpha, alpha.otherId)).toHaveLength(1)
    expect(queue.ids()).toEqual([
      `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT}:${alpha.otherId}`,
    ])
    // An opt-out is a recipient filter, not a reason to come back next quarter-hour: the trip is
    // still notified and the window is still closed.
    expect(result).toMatchObject({ due: 1, notified: 1, skipped: 0, failed: 0 })
    expect([...kv.store.keys()]).toHaveLength(1)
  })

  it('suppresses only the channel each member switched off', async () => {
    const tripId = await seedTrip(alpha, { withSecondMember: true })
    await optOut(alpha, alpha.ownerId, 'in_app')
    await optOut(alpha, alpha.otherId, 'email')
    const queue = recordingQueue()

    await sweep(memoryKv(), queue)

    // The two channels are independent rows and the sweep asks about each separately: the owner
    // keeps the letter without the inbox row, the second member keeps the row without the letter.
    expect(await inbox(alpha, alpha.ownerId)).toEqual([])
    expect(await inbox(alpha, alpha.otherId)).toHaveLength(1)
    expect(queue.ids()).toEqual([
      `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT}:${alpha.ownerId}`,
    ])
  })

  it('closes the window even when every recipient opted out', async () => {
    const tripId = await seedTrip(alpha)
    await optOut(alpha, alpha.ownerId, 'in_app')
    await optOut(alpha, alpha.ownerId, 'email')
    const kv = memoryKv()
    const queue = recordingQueue()

    const first = await sweep(kv, queue)
    const second = await sweep(kv, queue, NOW + 15 * 60_000)

    // Nothing delivered, and nothing left for the next tick to try again: a trip whose whole
    // membership opted out would otherwise be re-dispatched every fifteen minutes for a day.
    expect(first.result).toMatchObject({ notified: 1, skipped: 0, failed: 0 })
    expect(second.result).toMatchObject({ notified: 0, skipped: 1 })
    expect(queue.bodies).toEqual([])
    expect([...kv.store.keys()]).toEqual([
      reminderMarkerKey({
        tripId,
        organizationId: alpha.tenant.organizationId,
        dueAt: DUE_AT,
      }),
    ])
  })

  it('renders the shipped Departure reminder sentence, never the fallback line', async () => {
    await seedTrip(alpha)

    await sweep(memoryKv(), recordingQueue())

    const row = (await inbox(alpha, alpha.ownerId))[0]
    expect(row.titleParams).toEqual({ tripTitle: 'Lisbon in spring', days: 3 })

    // Unifying the kind with the preference row only works because the kind is itself a shipped
    // catalogue key. `renderStored` answers `null` for a key with no template, which is exactly
    // the reader's fallback line ("Something changed in your workspace") on both sides of the
    // fence — so this is the assertion that a rename to a key with no copy would fail.
    const tStored = createStoredTranslator('en', await loadCatalogue('en'))
    const params = paramsFrom(row.titleParams, 'en')
    expect(
      renderStored(tStored, storedKey(row.titleKey, 'title'), params),
    ).toBe('Lisbon in spring starts in 3 days')
    expect(renderStored(tStored, storedKey(row.bodyKey, 'body'), params)).toBe(
      'Time to check the packing list and the bookings.',
    )
  })

  it('keeps the envelope id inside the bound the queue validates', async () => {
    const tripId = await seedTrip(alpha)
    const queue = recordingQueue()

    await sweep(memoryKv(), queue)

    // `notify:` + kind + entity id + recipient id, where the entity id carries the 13-digit due
    // instant as well as the trip. Ids are 25 characters (`newId`), so the whole is 91 against the
    // envelope's `max(128)` — over the bound, dispatch counts the recipient `unaddressable` and
    // drops the letter, which is the failure a longer kind would buy silently.
    const id = queue.ids()[0] ?? ''
    expect(id).toBe(
      `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT}:${alpha.ownerId}`,
    )
    expect(id).toHaveLength(91)
    expect(() => taskEnvelopeSchema.parse(queue.bodies[0])).not.toThrow()
  })

  it('reminds once per window, however many ticks fall inside it', async () => {
    const tripId = await seedTrip(alpha)
    const kv = memoryKv()

    const first = await sweep(kv, recordingQueue())
    const second = await sweep(kv, recordingQueue(), NOW + 15 * 60_000)
    const third = await sweep(kv, recordingQueue(), DUE_AT + DAY_MS - 1)

    expect(first.result.notified).toBe(1)
    expect(second.result).toMatchObject({ due: 1, notified: 0, skipped: 1 })
    expect(third.result).toMatchObject({ due: 1, notified: 0, skipped: 1 })
    expect(await inbox(alpha, alpha.ownerId)).toHaveLength(1)
    expect([...kv.store.keys()]).toEqual([
      reminderMarkerKey({
        tripId,
        organizationId: alpha.tenant.organizationId,
        dueAt: DUE_AT,
      }),
    ])
    expect(kv.puts[0]?.ttl).toBe(REMINDER_MARKER_TTL_SECONDS)
  })

  it('re-fires under a new envelope id when the start date moves', async () => {
    const tripId = await seedTrip(alpha)
    const kv = memoryKv()
    const queue = recordingQueue()
    const { updateTrip } = await import('#/server/repos')

    await sweep(kv, queue)

    // The traveller pushes the trip back a week. Nothing cancels anything and nothing is
    // rescheduled: the scan reads the new dates, and the window they fall in is a new due instant.
    // Under the old index this is exactly where the orphaned key lived.
    await updateTrip(alpha.tenant.scope, tripId, {
      startDate: dayString(NOW + 10 * DAY_MS),
    })
    const later = await sweep(kv, queue, DUE_AT + 7 * DAY_MS + 60_000)

    expect(later.result.notified).toBe(1)
    expect(queue.ids()).toEqual([
      `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT}:${alpha.ownerId}`,
      `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT + 7 * DAY_MS}:${alpha.ownerId}`,
    ])
    expect([...kv.store.keys()]).toHaveLength(2)
  })

  it('skips a trip whose anchor moved between the scan and the read', async () => {
    const tripId = await seedTrip(alpha)
    const kv = memoryKv()
    const queue = recordingQueue()
    const { updateTrip } = await import('#/server/repos')
    // The scan and the read are two statements. Moving the row inside that gap is the race the
    // re-derivation exists for: the sentence and the marker would otherwise describe an instant
    // this trip no longer has.
    spies.beforeRead = async () => {
      await updateTrip(alpha.tenant.scope, tripId, {
        startDate: dayString(NOW + 10 * DAY_MS),
      })
    }

    const { result, sink } = await sweep(kv, queue)

    expect(result).toMatchObject({ due: 1, notified: 0, skipped: 1, failed: 0 })
    expect(queue.bodies).toEqual([])
    // No marker and no message: the trip belongs to a later instant now, and the tick that finds
    // it there must not be looking at a window this one closed.
    expect([...kv.store.keys()]).toEqual([])
    expect(messaged(sink, 'a due trip’s anchor moved')).toBe(1)
  })

  it('runs under the trip owner’s scope, at the role that member holds in the workspace', async () => {
    await seedTrip(alpha, { withSecondMember: true })

    await sweep(memoryKv(), recordingQueue())

    // Two reads, one scope: the sweep's own `requireTrip` and the one dispatch makes to authorise
    // the fan-out. Both belong to the trip's owner.
    expect(spies.scopes).toHaveLength(2)
    for (const ctx of spies.scopes) {
      expect(ctx.userId).toBe(alpha.ownerId)
      expect(ctx.role).toBe('owner')
      expect(ctx.organizationId).toBe(alpha.tenant.organizationId)
    }
  })

  it('falls back to any member when the trip has no owner left', async () => {
    const tripId = await seedTrip(alpha, { withSecondMember: true })
    const { changeMemberRole, listMembers } = await import('#/server/repos')
    const members = await listMembers(alpha.tenant.scope)
    const second = members.find((row) => row.userId === alpha.otherId)
    await changeMemberRole(alpha.tenant.scope, second?.id ?? '', 'admin')
    await dropTripMember(alpha, tripId, alpha.ownerId)

    const { result } = await sweep(memoryKv(), recordingQueue())

    expect(result.notified).toBe(1)
    // The role comes from `member`, never from the trip row: the fallback member is an `editor` on
    // the trip and an `admin` in the workspace, and a scope carries the workspace role.
    expect(spies.scopes[0]?.userId).toBe(alpha.otherId)
    expect(spies.scopes[0]?.role).toBe('admin')
  })

  it('skips a due trip with no members and leaves no marker behind', async () => {
    const tripId = await seedTrip(alpha)
    await dropTripMember(alpha, tripId, alpha.ownerId)
    const kv = memoryKv()

    const { result } = await sweep(kv, recordingQueue())

    expect(result).toMatchObject({ due: 1, notified: 0, skipped: 1, failed: 0 })
    expect([...kv.store.keys()]).toEqual([])
  })

  it('isolates a failing trip from the rest of the tick', async () => {
    const failing = await seedTrip(alpha, { title: 'Broken' })
    await seedTrip(beta, { title: 'Porto in autumn' })
    spies.failTripId = failing
    const kv = memoryKv()

    const { result, sink } = await sweep(kv, recordingQueue())

    expect(result).toMatchObject({ due: 2, notified: 1, failed: 1 })
    expect(await inbox(beta, beta.ownerId)).toHaveLength(1)
    expect(messaged(sink, 'a reminder failed for one trip')).toBe(1)
    // The failure left no marker, so the next tick tries again inside the same window.
    expect([...kv.store.keys()]).toHaveLength(1)
  })

  it('still reminds when KV cannot be read, and never sends twice on the queue', async () => {
    const tripId = await seedTrip(alpha)
    const kv = memoryKv({ get: true })
    const queue = recordingQueue()

    const first = await sweep(kv, queue)
    const second = await sweep(kv, queue, NOW + 15 * 60_000)

    expect(first.result.notified).toBe(1)
    expect(second.result.notified).toBe(1)
    // Two dispatches, one envelope id: the queue's own idempotency is the half that still holds
    // when the marker cannot be read, which is why an unreadable marker means "not yet sent".
    expect(new Set(queue.ids()).size).toBe(1)
    expect(queue.ids()[0]).toBe(
      `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT}:${alpha.ownerId}`,
    )
    expect(messaged(first.sink, 'reminder marker could not be read')).toBe(1)
    expect(messaged(second.sink, 'reminder marker could not be read')).toBe(1)
  })

  it('reminds anyway when the marker cannot be written, and says so', async () => {
    await seedTrip(alpha)
    const kv = memoryKv({ put: true })

    const { result, sink } = await sweep(kv, recordingQueue())

    expect(result.notified).toBe(1)
    expect(result.failed).toBe(0)
    expect(messaged(sink, 'reminder marker could not be written')).toBe(1)
  })

  it('says so when the scan’s row bound cut the tick short', async () => {
    await seedTrip(alpha, { title: 'First' })
    await seedTrip(alpha, { title: 'Second' })
    const kv = memoryKv()

    const { result, sink } = await sweep(kv, recordingQueue(), NOW, {
      pageSize: 1,
      maxRows: 1,
    })

    // One trip reminded, the other left for a later tick — and a line saying so, because a bound
    // that truncates quietly reads exactly like a window with nothing else in it.
    expect(result).toMatchObject({ scanned: 1, due: 1, notified: 1 })
    expect(messaged(sink, 'reminder scan hit its row bound')).toBe(1)
  })

  it('reports a missing DB binding instead of throwing at the cron', async () => {
    const { logger, sink } = memoryLogger()

    const result = await sweepReminders(
      { ...env(memoryKv(), recordingQueue()), DB: undefined },
      logger,
      NOW,
      { databaseFor: () => harness.db },
    )

    expect(result).toEqual({
      scanned: 0,
      due: 0,
      notified: 0,
      skipped: 0,
      failed: 0,
    })
    expect(messaged(sink, 'reminder sweep has no DB binding')).toBe(1)
  })

  it('does nothing at all when no trip is due', async () => {
    await seedTrip(alpha, { reminderDays: 0 })
    const kv = memoryKv()
    const queue = recordingQueue()

    expect((await sweep(kv, queue)).result).toEqual({
      scanned: 0,
      due: 0,
      notified: 0,
      skipped: 0,
      failed: 0,
    })
    expect(queue.bodies).toEqual([])
    expect([...kv.store.keys()]).toEqual([])
  })
})

/* -------------------------------------------------------- the model, guarded */

describe('the scan model', () => {
  it('is reachable from the cron and from nowhere else in src/', async () => {
    // ADR 0005's standing claim: no write path schedules, cancels or re-registers a reminder. That
    // is a property of *who may call this module*, so it is checked against the tree rather than
    // against this module's exports — a scheduler re-introduced on a trip write would be a new
    // importer here long before it would be a new export there.
    const { readdir, readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')

    const QUEUE_DIR = join('src', 'server', 'queue')
    const ABSOLUTE = /['"][^'"]*queue\/reminders['"]/
    const RELATIVE = /['"]\.\.?\/reminders['"]/

    async function walk(dir: string): Promise<Array<string>> {
      const entries = await readdir(dir, { withFileTypes: true })
      const nested = await Promise.all(
        entries.map(async (entry) => {
          const path = join(dir, entry.name)
          if (entry.isDirectory()) return walk(path)
          return entry.name.endsWith('.ts') ? [path] : []
        }),
      )
      return nested.flat()
    }

    const importers: Array<string> = []
    for (const path of await walk('src')) {
      const source = await readFile(path, 'utf8')
      const reached =
        ABSOLUTE.test(source) ||
        (path.startsWith(QUEUE_DIR) && RELATIVE.test(source))
      if (reached) importers.push(path)
    }

    expect(importers.sort()).toEqual(
      [
        // The cron, and the three test files that exercise it. No route module, no server
        // function, no repository: a fourth non-test entry is the defect this case names.
        join('src', 'server', 'worker.ts'),
        join('src', 'server', '__tests__', 'worker.test.ts'),
        join('src', 'server', 'queue', '__tests__', 'reminders.test.ts'),
        join('src', 'server', 'repos', '__tests__', 'tenant-isolation.test.ts'),
      ].sort(),
    )
  })
})
