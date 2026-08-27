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

import {
  DAY_MS,
  REMINDER_SCAN_DAYS,
  listDueTripReminders,
  reminderDueAt,
} from '#/server/catalog/reminders'
import { createLogger, createMemorySink } from '#/server/observability'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { LogRecord } from '#/server/observability'
import type * as Repos from '#/server/repos'
import type { TenantContext } from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TaskBindings } from '../types'

/* ------------------------------------------------------------------ mocking */

const spies = vi.hoisted(() => ({
  /** The tenant context every `requireTrip` in the tick ran under, in order. */
  scopes: [] as Array<TenantContext>,
  /** When set, reading this trip throws — one broken workspace inside a healthy tick. */
  failTripId: null as string | null,
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
      return actual.requireTrip(...args)
    },
  }
})

const {
  REMINDER_COPY_KEY,
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

async function sweep(
  kv: ReturnType<typeof memoryKv>,
  queue: ReturnType<typeof recordingQueue>,
  at: number = NOW,
) {
  const { logger } = memoryLogger()
  return sweepReminders(env(kv, queue), logger, at, {
    databaseFor: () => harness.db,
  })
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
  })

  afterEach(() => {
    spies.scopes = []
    spies.failTripId = null
    harness.close()
  })

  it('writes one inbox row and one email envelope per member', async () => {
    const tripId = await seedTrip(alpha, { withSecondMember: true })
    const kv = memoryKv()
    const queue = recordingQueue()
    const { listNotifications } = await import('#/server/repos')

    const result = await sweep(kv, queue)

    expect(result).toEqual({
      scanned: 1,
      due: 1,
      notified: 1,
      skipped: 0,
      failed: 0,
    })
    // No actor, so the trip's owner is a recipient as well as the second member — a reminder that
    // excluded the person who owns the trip would be the obvious way to get this wrong.
    const owner = await listNotifications(alpha.tenant.scope, alpha.ownerId)
    const other = await listNotifications(alpha.tenant.scope, alpha.otherId)
    expect(owner.items).toHaveLength(1)
    expect(other.items).toHaveLength(1)
    // The shipped catalogue key, not the event kind: `trip.reminder` has no template, so defaulting
    // `titleKey` to the kind would print the fallback line on every reminder.
    expect(owner.items[0]?.titleKey).toBe(REMINDER_COPY_KEY)
    expect(owner.items[0]?.titleParams).toEqual({
      tripTitle: 'Lisbon in spring',
      days: 3,
    })
    expect(owner.items[0]?.actionUrl).toBe(`/trips/${tripId}`)
    // Measured, not desired: the event names no actor, but `notifyMany` stamps
    // `senderUserId` from the scope unconditionally, so the row records the member the sweep
    // resolved. Nothing renders the column today; changing it means editing
    // `src/server/repos/notifications.ts`, which this stage does not own.
    expect(owner.items[0]?.senderUserId).toBe(alpha.ownerId)

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

  it('reminds once per window, however many ticks fall inside it', async () => {
    const tripId = await seedTrip(alpha)
    const kv = memoryKv()
    const { listNotifications } = await import('#/server/repos')

    const first = await sweep(kv, recordingQueue())
    const second = await sweep(kv, recordingQueue(), NOW + 15 * 60_000)
    const third = await sweep(kv, recordingQueue(), DUE_AT + DAY_MS - 1)

    expect(first.notified).toBe(1)
    expect(second).toMatchObject({ due: 1, notified: 0, skipped: 1 })
    expect(third).toMatchObject({ due: 1, notified: 0, skipped: 1 })
    expect(
      (await listNotifications(alpha.tenant.scope, alpha.ownerId)).items,
    ).toHaveLength(1)
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

    expect(later.notified).toBe(1)
    expect(queue.ids()).toEqual([
      `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT}:${alpha.ownerId}`,
      `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT + 7 * DAY_MS}:${alpha.ownerId}`,
    ])
    expect([...kv.store.keys()]).toHaveLength(2)
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

    const result = await sweep(memoryKv(), recordingQueue())

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

    const result = await sweep(kv, recordingQueue())

    expect(result).toMatchObject({ due: 1, notified: 0, skipped: 1, failed: 0 })
    expect([...kv.store.keys()]).toEqual([])
  })

  it('isolates a failing trip from the rest of the tick', async () => {
    const failing = await seedTrip(alpha, { title: 'Broken' })
    await seedTrip(beta, { title: 'Porto in autumn' })
    spies.failTripId = failing
    const kv = memoryKv()
    const { logger, sink } = memoryLogger()
    const { listNotifications } = await import('#/server/repos')

    const result = await sweepReminders(
      env(kv, recordingQueue()),
      logger,
      NOW,
      {
        databaseFor: () => harness.db,
      },
    )

    expect(result).toMatchObject({ due: 2, notified: 1, failed: 1 })
    expect(
      (await listNotifications(beta.tenant.scope, beta.ownerId)).items,
    ).toHaveLength(1)
    expect(messaged(sink, 'a reminder failed for one trip')).toBe(1)
    // The failure left no marker, so the next tick tries again inside the same window.
    expect([...kv.store.keys()]).toHaveLength(1)
  })

  it('still reminds when KV cannot be read, and never sends twice on the queue', async () => {
    const tripId = await seedTrip(alpha)
    const kv = memoryKv({ get: true })
    const queue = recordingQueue()
    const { logger, sink } = memoryLogger()
    const bindings = env(kv, queue)

    const first = await sweepReminders(bindings, logger, NOW, {
      databaseFor: () => harness.db,
    })
    const second = await sweepReminders(bindings, logger, NOW + 15 * 60_000, {
      databaseFor: () => harness.db,
    })

    expect(first.notified).toBe(1)
    expect(second.notified).toBe(1)
    // Two dispatches, one envelope id: the queue's own idempotency is the half that still holds
    // when the marker cannot be read, which is why an unreadable marker means "not yet sent".
    expect(new Set(queue.ids()).size).toBe(1)
    expect(queue.ids()[0]).toBe(
      `notify:${REMINDER_EVENT_KIND}:${tripId}:${DUE_AT}:${alpha.ownerId}`,
    )
    expect(messaged(sink, 'reminder marker could not be read')).toBe(2)
  })

  it('reminds anyway when the marker cannot be written, and says so', async () => {
    await seedTrip(alpha)
    const kv = memoryKv({ put: true })
    const { logger, sink } = memoryLogger()

    const result = await sweepReminders(
      env(kv, recordingQueue()),
      logger,
      NOW,
      {
        databaseFor: () => harness.db,
      },
    )

    expect(result.notified).toBe(1)
    expect(result.failed).toBe(0)
    expect(messaged(sink, 'reminder marker could not be written')).toBe(1)
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

    expect(await sweep(kv, queue)).toEqual({
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
