/**
 * The `travel-stats` handler, driven the way the consumer drives it.
 *
 * Everything below the handler is real: a fully migrated SQLite database from
 * the Drizzle schema, two real tenants, the real repositories, the real
 * aggregates and the real unique index on `(organization_id, user_id,
 * stat_year)`. The one seam that is not real is the D1 handle: the handler is
 * built through {@link createTravelStatsHandler} over the harness's database
 * instead of over a binding, which is the seam that exists so a recompute can be
 * exercised at all outside a Worker.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createPlace,
  createTransport,
  createTrip,
  addTripMember,
  getMembership,
  removeMember,
  getTravelStats,
  listTravelStats,
  markCountryVisited,
  markRegionVisited,
  upsertTravelStats,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import { taskHandlers } from '../../consumer'
import { buildTaskEnvelope } from '../../jobs'
import { TaskConfigurationError, travelStatsPayloadSchema } from '../../types'
import {
  RECOMPUTE_WINDOW_MS,
  createTravelStatsHandler,
  handleTravelStats,
  recomputeDelaySeconds,
  travelStatsTaskId,
} from '../travel-stats'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TaskBindings, TaskContext } from '../../types'

/* -------------------------------------------------------------------- setup */

const NOW = Date.parse('2026-08-27T09:00:00.000Z')

/** A binding surface with nothing on it a recompute can reach for by accident. */
function fakeEnv(overrides: Partial<TaskBindings> = {}): TaskBindings {
  return {
    KV: {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    },
    FILES: {
      get: async () => null,
      put: async () => undefined,
      head: async () => null,
      delete: async () => undefined,
      list: async () => ({ objects: [], truncated: false }),
    },
    TASKS: { send: async () => undefined, sendBatch: async () => undefined },
    // Present but never dereferenced: the handlers under test build their
    // Drizzle handle through the injected seam, so only the guard reads this.
    DB: {} as TaskBindings['DB'],
    ...overrides,
  }
}

function context(orgId: string, env: TaskBindings = fakeEnv()): TaskContext {
  return {
    env,
    logger: createLogger({ level: 'error', sink: createMemorySink() }),
    now: () => NOW,
    attempt: 1,
    taskId: 'task-under-test',
    orgId,
    // This handler makes no outbound call; a pass-through is the whole of what it needs.
    callProvider: (_label, send) => send(),
  }
}

let harness: Harness
let alpha: SeededTenant
let beta: SeededTenant

/** The shipped handler, over the harness database rather than a D1 binding. */
const recompute = (
  payload: { userId: string; statYear: number },
  ctx: TaskContext,
) => createTravelStatsHandler(() => harness.db)(payload, ctx)

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

/** Numbers only: `computedAt` and `updatedAt` move with the wall clock. */
async function figures(
  tenant: SeededTenant,
  userId: string,
): Promise<Array<Record<string, unknown>>> {
  const rows = await listTravelStats(tenant.scope, userId)
  return rows.map((row) => ({
    statYear: row.statYear,
    tripCount: row.tripCount,
    dayCount: row.dayCount,
    placeCount: row.placeCount,
    cityCount: row.cityCount,
    countryCount: row.countryCount,
    regionCount: row.regionCount,
    distanceMetres: row.distanceMetres,
    spendMinor: row.spendMinor,
    yearStreak: row.yearStreak,
    byContinent: row.byContinent,
  }))
}

/**
 * One trip in 2026 with a place, a country and one dated flight leg, owned by the
 * tenant's owner — who is therefore its only `trip_members` row.
 */
async function seedTravel(tenant: SeededTenant): Promise<void> {
  const trip = await createTrip(tenant.scope, {
    title: 'Lisbon in spring',
    startDate: '2026-04-10',
    endDate: '2026-04-12',
    countryCodes: ['PT'],
    currency: 'EUR',
  })
  await createPlace(tenant.scope, {
    tripId: trip.id,
    name: 'Miradouro da Senhora do Monte',
    city: 'Lisbon',
  })
  await createTransport(tenant.scope, {
    tripId: trip.id,
    title: 'Flight to Lisbon',
    mode: 'flight',
    departureDate: '2026-04-10',
    distanceMetres: 1_720_000,
  })
  await markCountryVisited(tenant.scope, {
    userId: tenant.ownerUserId,
    countryCode: 'PT',
    continent: 'Europe',
    visitedOn: '2026-04-10',
  })
}

/**
 * A second traveller in the same workspace, with a trip of their own in the same
 * year that the owner is not a member of.
 */
async function seedSecondTraveller(
  tenant: SeededTenant,
): Promise<{ userId: string; tripId: string }> {
  const userId = await tenant.addUser('Second traveller')
  const scope = tenant.scopeFor(userId)

  const trip = await createTrip(scope, {
    title: 'Kyoto in autumn',
    startDate: '2026-10-02',
    endDate: '2026-10-03',
    countryCodes: ['JP'],
    currency: 'JPY',
  })
  await createPlace(scope, {
    tripId: trip.id,
    name: 'Fushimi Inari',
    city: 'Kyoto',
  })
  await createTransport(scope, {
    tripId: trip.id,
    title: 'Flight to Osaka',
    mode: 'flight',
    departureDate: '2026-10-02',
    distanceMetres: 9_500_000,
  })

  return { userId, tripId: trip.id }
}

/* ------------------------------------------------------------------- tests */

describe('handleTravelStats', () => {
  it('writes the row for the year its own envelope names', async () => {
    await seedTravel(alpha)

    const metrics = await recompute(
      { userId: alpha.ownerUserId, statYear: 2026 },
      context(alpha.organizationId),
    )

    expect(metrics).toMatchObject({ statYear: 2026, tripCount: 1 })
    expect(await figures(alpha, alpha.ownerUserId)).toEqual([
      {
        statYear: 2026,
        tripCount: 1,
        dayCount: 3,
        placeCount: 1,
        cityCount: 1,
        countryCount: 1,
        regionCount: 0,
        distanceMetres: 1_720_000,
        spendMinor: 0,
        yearStreak: 0,
        byContinent: { Europe: 1 },
      },
    ])
  })

  it('leaves two rows when the all-time and year envelopes are both handled', async () => {
    await seedTravel(alpha)

    await recompute(
      { userId: alpha.ownerUserId, statYear: 0 },
      context(alpha.organizationId),
    )
    await recompute(
      { userId: alpha.ownerUserId, statYear: 2026 },
      context(alpha.organizationId),
    )

    const rows = await figures(alpha, alpha.ownerUserId)
    expect(rows.map((row) => row.statYear)).toEqual([2026, 0])
  })

  /**
   * `region_count` is the one column that belongs to no year, and the regression these two cases
   * guard is that a year row ever printed a figure at all: until #139 the recompute wrote the
   * traveller's lifetime `visited_regions` total onto every row, so 2026, 2025 and all-time all
   * carried the same number — the shape `country_count` beside it is explicitly written to avoid.
   *
   * The regions below are dated in two different calendar years on purpose. That is the fixture
   * under which the old code was indistinguishable from a correct year-scoped one, and it is also
   * the fixture that shows why year-scoping is not on the table: `visited_regions` stores one row
   * per region and a single `first_visited_on`, so the table cannot answer "which regions in 2026".
   */
  it('writes the lifetime region count on the all-time row and none on a year row', async () => {
    await seedTravel(alpha)
    await markRegionVisited(alpha.scope, {
      userId: alpha.ownerUserId,
      countryCode: 'PT',
      regionCode: 'PT-11',
      regionName: 'Lisboa',
      visitedOn: '2026-04-10',
    })
    await markRegionVisited(alpha.scope, {
      userId: alpha.ownerUserId,
      countryCode: 'PT',
      regionCode: 'PT-08',
      regionName: 'Faro',
      visitedOn: '2025-06-02',
    })

    await recompute(
      { userId: alpha.ownerUserId, statYear: 0 },
      context(alpha.organizationId),
    )
    await recompute(
      { userId: alpha.ownerUserId, statYear: 2026 },
      context(alpha.organizationId),
    )

    const rows = await figures(alpha, alpha.ownerUserId)
    expect(
      rows.map((row) => ({
        statYear: row.statYear,
        regionCount: row.regionCount,
      })),
    ).toEqual([
      { statYear: 2026, regionCount: 0 },
      { statYear: 0, regionCount: 2 },
    ])
  })

  /**
   * The field is written as an explicit `0` rather than omitted on year rows, and this is the case
   * that pins the difference: `upsertTravelStats` patches through `definedOnly`, so an omitted
   * field would leave the stale lifetime figure on every year row written before #139 and would
   * need a backfill migration. The explicit `0` heals those rows on their next recompute.
   */
  it('clears a stale lifetime figure left on a year row by an earlier write', async () => {
    await seedTravel(alpha)
    await markRegionVisited(alpha.scope, {
      userId: alpha.ownerUserId,
      countryCode: 'PT',
      regionCode: 'PT-11',
      regionName: 'Lisboa',
    })
    // The row as the pre-#139 recompute left it: the lifetime total on a year row.
    await upsertTravelStats(alpha.scope, {
      userId: alpha.ownerUserId,
      statYear: 2026,
      regionCount: 1,
    })

    await recompute(
      { userId: alpha.ownerUserId, statYear: 2026 },
      context(alpha.organizationId),
    )

    expect(
      (await getTravelStats(alpha.scope, alpha.ownerUserId, 2026))?.regionCount,
    ).toBe(0)
  })

  it('leaves the same numbers when the same message is delivered twice', async () => {
    await seedTravel(alpha)
    const envelope = { userId: alpha.ownerUserId, statYear: 2026 }

    await recompute(envelope, context(alpha.organizationId))
    const once = await figures(alpha, alpha.ownerUserId)
    await recompute(envelope, context(alpha.organizationId))

    expect(await figures(alpha, alpha.ownerUserId)).toEqual(once)
    expect(once).toHaveLength(1)
  })

  it('derives the streak from the year rows and stops at a gap year', async () => {
    // A history built by hand: 2026 and 2025 travelled, 2024 did not, 2023 did.
    await upsertTravelStats(alpha.scope, {
      userId: alpha.ownerUserId,
      statYear: 2026,
      tripCount: 2,
    })
    await upsertTravelStats(alpha.scope, {
      userId: alpha.ownerUserId,
      statYear: 2025,
      tripCount: 1,
    })
    await upsertTravelStats(alpha.scope, {
      userId: alpha.ownerUserId,
      statYear: 2024,
      tripCount: 0,
    })
    await upsertTravelStats(alpha.scope, {
      userId: alpha.ownerUserId,
      statYear: 2023,
      tripCount: 3,
    })

    const metrics = await recompute(
      { userId: alpha.ownerUserId, statYear: 0 },
      context(alpha.organizationId),
    )

    expect(metrics.yearStreak).toBe(2)
    const allTime = (
      await listTravelStats(alpha.scope, alpha.ownerUserId)
    ).find((row) => row.statYear === 0)
    expect(allTime?.yearStreak).toBe(2)
  })

  it('breaks the streak on a missing year as well as on an empty one', async () => {
    await upsertTravelStats(alpha.scope, {
      userId: alpha.ownerUserId,
      statYear: 2026,
      tripCount: 1,
    })
    // No 2025 row at all: the traveller's run is one year, not two.
    await upsertTravelStats(alpha.scope, {
      userId: alpha.ownerUserId,
      statYear: 2024,
      tripCount: 1,
    })

    const metrics = await recompute(
      { userId: alpha.ownerUserId, statYear: 0 },
      context(alpha.organizationId),
    )

    expect(metrics.yearStreak).toBe(1)
  })

  it('sums transport distance, filters a year row by the leg’s departure date', async () => {
    const trip = await createTrip(alpha.scope, {
      title: 'Two calendars, one trip',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    await createTransport(alpha.scope, {
      tripId: trip.id,
      title: 'Flight out',
      mode: 'flight',
      departureDate: '2026-04-10',
      distanceMetres: 1_720_000,
    })
    // A leg with no recorded distance must not turn the sum into null.
    await createTransport(alpha.scope, {
      tripId: trip.id,
      title: 'Tram, distance never entered',
      mode: 'train',
      departureDate: '2026-04-11',
    })
    // Dated into the previous year on purpose: the year row filters on the
    // leg's own departure date, not on the trip it hangs off.
    await createTransport(alpha.scope, {
      tripId: trip.id,
      title: 'Positioning drive, last December',
      mode: 'car',
      departureDate: '2025-12-30',
      distanceMetres: 300_000,
    })

    await recompute(
      { userId: alpha.ownerUserId, statYear: 2026 },
      context(alpha.organizationId),
    )
    await recompute(
      { userId: alpha.ownerUserId, statYear: 0 },
      context(alpha.organizationId),
    )

    const rows = await listTravelStats(alpha.scope, alpha.ownerUserId)
    expect(rows.find((row) => row.statYear === 2026)?.distanceMetres).toBe(
      1_720_000,
    )
    expect(rows.find((row) => row.statYear === 0)?.distanceMetres).toBe(
      2_020_000,
    )
  })

  it('writes a zero distance over a stored figure the trips cannot account for', async () => {
    // What the dev seeder leaves behind: a distance no transport leg supports.
    await upsertTravelStats(alpha.scope, {
      userId: alpha.ownerUserId,
      statYear: 0,
      distanceMetres: 128_400_000,
    })

    await recompute(
      { userId: alpha.ownerUserId, statYear: 0 },
      context(alpha.organizationId),
    )

    const allTime = (
      await listTravelStats(alpha.scope, alpha.ownerUserId)
    ).find((row) => row.statYear === 0)
    expect(allTime?.distanceMetres).toBe(0)
  })

  it('acknowledges a non-member without writing', async () => {
    const sink = createMemorySink()
    const ctx = {
      ...context(alpha.organizationId),
      logger: createLogger({ level: 'debug', sink }),
    }
    await expect(
      recompute({ userId: beta.ownerUserId, statYear: 0 }, ctx),
    ).resolves.toEqual({})
    expect(await listTravelStats(alpha.scope, beta.ownerUserId)).toEqual([])
    expect(sink.records.filter((entry) => entry.level === 'warn')).toHaveLength(
      1,
    )
  })

  it('acknowledges a departed workspace member who remains on a trip', async () => {
    const userId = await alpha.addUser('Departed traveller')
    const trip = await createTrip(alpha.scope, { title: 'Still on the trip' })
    await addTripMember(alpha.scope, {
      tripId: trip.id,
      userId,
      role: 'editor',
    })
    const membership = await getMembership(alpha.scope, userId)
    if (membership === null) throw new Error('Missing fixture membership')
    await removeMember(alpha.scope, membership.id)
    const sink = createMemorySink()
    const ctx = {
      ...context(alpha.organizationId),
      logger: createLogger({ level: 'debug', sink }),
    }
    await expect(recompute({ userId, statYear: 0 }, ctx)).resolves.toEqual({})
    expect(await listTravelStats(alpha.scope, userId)).toEqual([])
    expect(sink.records.filter((entry) => entry.level === 'warn')).toHaveLength(
      1,
    )
  })

  it('never reads or writes outside the envelope’s organization', async () => {
    await seedTravel(alpha)
    await seedTravel(beta)
    const before = await figures(beta, beta.ownerUserId)

    await recompute(
      { userId: alpha.ownerUserId, statYear: 0 },
      context(alpha.organizationId),
    )

    expect(await figures(beta, beta.ownerUserId)).toEqual(before)
    expect(await listTravelStats(beta.scope, alpha.ownerUserId)).toEqual([])
  })

  it('refuses to run without the D1 binding rather than half-recomputing', async () => {
    // The shipped handler, so the guard is asserted on the value the consumer
    // actually registers rather than on a test-built one.
    const failure = await handleTravelStats(
      { userId: alpha.ownerUserId, statYear: 0 },
      context(alpha.organizationId, fakeEnv({ DB: undefined })),
    ).catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(TaskConfigurationError)
  })
})

/**
 * The `00-S4` amendment (PRD #104, decision 11): a trip is private to its members
 * (ADR 0007), so every trip-derived figure on a person's row counts the trips
 * that person is on. Before the amendment both travellers below carried the same
 * eight workspace-wide numbers, and a private trip a traveller could not open
 * still moved their statistics.
 */
describe('two members of one workspace, two trip memberships', () => {
  it('gives each traveller their own trip’s figures and none of the other’s', async () => {
    await seedTravel(alpha)
    const secondTraveller = await seedSecondTraveller(alpha)

    await recompute(
      { userId: alpha.ownerUserId, statYear: 2026 },
      context(alpha.organizationId),
    )
    await recompute(
      { userId: secondTraveller.userId, statYear: 2026 },
      context(alpha.organizationId),
    )

    expect(await figures(alpha, alpha.ownerUserId)).toEqual([
      {
        statYear: 2026,
        tripCount: 1,
        dayCount: 3,
        placeCount: 1,
        cityCount: 1,
        countryCount: 1,
        regionCount: 0,
        distanceMetres: 1_720_000,
        spendMinor: 0,
        yearStreak: 0,
        byContinent: { Europe: 1 },
      },
    ])
    expect(await figures(alpha, secondTraveller.userId)).toEqual([
      {
        statYear: 2026,
        tripCount: 1,
        dayCount: 2,
        placeCount: 1,
        cityCount: 1,
        countryCount: 1,
        regionCount: 0,
        distanceMetres: 9_500_000,
        spendMinor: 0,
        yearStreak: 0,
        // The second traveller has visited nothing: `visited_countries` was
        // already per-traveller and stays that way.
        byContinent: {},
      },
    ])
  })

  it('takes the currency and the last trip from the traveller’s own trips', async () => {
    await seedTravel(alpha)
    const secondTraveller = await seedSecondTraveller(alpha)

    await recompute(
      { userId: secondTraveller.userId, statYear: 0 },
      context(alpha.organizationId),
    )

    const row = await getTravelStats(alpha.scope, secondTraveller.userId, 0)
    expect(row?.lastTripId).toBe(secondTraveller.tripId)
    expect(row?.currency).toBe('JPY')
    // The owner's Lisbon leg is in the same workspace and is not counted.
    expect(row?.distanceMetres).toBe(9_500_000)
  })

  it('gives each traveller a streak of their own travelling years', async () => {
    // The amendment's one derived figure. Three trips in three consecutive
    // years in one workspace, split between two travellers: the owner is on
    // 2026 and 2025, the second traveller on 2024 alone. When the year rows
    // were the workspace's, both all-time rows read a streak of three - the
    // same run of years, held by two people who did not travel together.
    const soloTravellerId = await alpha.addUser('Travels alone')
    const soloScope = alpha.scopeFor(soloTravellerId)

    await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    await createTrip(alpha.scope, {
      title: 'Porto the year before',
      startDate: '2025-05-01',
      endDate: '2025-05-03',
      currency: 'EUR',
    })
    await createTrip(soloScope, {
      title: 'Kyoto in autumn',
      startDate: '2024-10-02',
      endDate: '2024-10-04',
      currency: 'JPY',
    })

    // Every year either of them could have travelled in, then the all-time row
    // the streak is written onto - which is the order the producer enqueues in.
    for (const statYear of [2026, 2025, 2024, 0]) {
      await recompute(
        { userId: alpha.ownerUserId, statYear },
        context(alpha.organizationId),
      )
      await recompute(
        { userId: soloTravellerId, statYear },
        context(alpha.organizationId),
      )
    }

    const owner = await getTravelStats(alpha.scope, alpha.ownerUserId, 0)
    const soloTraveller = await getTravelStats(alpha.scope, soloTravellerId, 0)
    expect(owner?.yearStreak).toBe(2)
    expect(soloTraveller?.yearStreak).toBe(1)
    // The 2024 row the owner is on no trip in ends their run rather than
    // extending it: a year row exists, and its `tripCount` is zero.
    const ownerYears = await figures(alpha, alpha.ownerUserId)
    expect(ownerYears.find((row) => row.statYear === 2024)?.tripCount).toBe(0)
  })

  it('recomputes to nothing for a workspace member on no trip at all', async () => {
    await seedTravel(alpha)
    const bystander = await alpha.addUser('Never travels')

    const metrics = await recompute(
      { userId: bystander, statYear: 0 },
      context(alpha.organizationId),
    )

    expect(metrics).toMatchObject({ tripCount: 0, distanceMetres: 0 })
    expect(await figures(alpha, bystander)).toEqual([
      {
        statYear: 0,
        tripCount: 0,
        dayCount: 0,
        placeCount: 0,
        cityCount: 0,
        countryCount: 0,
        regionCount: 0,
        distanceMetres: 0,
        spendMinor: 0,
        yearStreak: 0,
        byContinent: {},
      },
    ])
  })
})

describe('the task kind on the queue', () => {
  it('is registered, so a message is not dead-lettered as unhandled', () => {
    expect(taskHandlers['travel-stats']).toBe(handleTravelStats)
  })

  it('accepts the envelope the producer builds', () => {
    const envelope = buildTaskEnvelope(
      {
        kind: 'travel-stats',
        orgId: 'org_1',
        id: travelStatsTaskId('org_1', 'user_1', 2026, NOW),
        payload: { userId: 'user_1', statYear: 2026 },
      },
      () => NOW,
    )
    expect(envelope).toMatchObject({
      kind: 'travel-stats',
      payload: { userId: 'user_1', statYear: 2026 },
    })
  })

  it('refuses a year that is not a year, and anything beside the two fields', () => {
    for (const statYear of [12, -2026, 2026.5, 20_260]) {
      expect(
        travelStatsPayloadSchema.safeParse({ userId: 'user_1', statYear })
          .success,
      ).toBe(false)
    }
    expect(
      travelStatsPayloadSchema.safeParse({ userId: 'user_1', statYear: 0 })
        .success,
    ).toBe(true)
    // `strictObject`: an organization id on the payload would be a second, forgeable tenant.
    expect(
      travelStatsPayloadSchema.safeParse({
        userId: 'user_1',
        statYear: 0,
        organizationId: 'org_2',
      }).success,
    ).toBe(false)
  })
})

describe('travelStatsTaskId', () => {
  it('collapses a burst for the same traveller and year onto one id', () => {
    const first = travelStatsTaskId('org_1', 'user_1', 2026, NOW)
    const second = travelStatsTaskId('org_1', 'user_1', 2026, NOW + 3_000)
    expect(second).toBe(first)
  })

  it('separates the years, the travellers and the tenants', () => {
    const base = travelStatsTaskId('org_1', 'user_1', 0, NOW)
    expect(travelStatsTaskId('org_1', 'user_1', 2026, NOW)).not.toBe(base)
    expect(travelStatsTaskId('org_1', 'user_2', 0, NOW)).not.toBe(base)
    expect(travelStatsTaskId('org_2', 'user_1', 0, NOW)).not.toBe(base)
  })

  it('starts a new id once the collapse window has passed', () => {
    const first = travelStatsTaskId('org_1', 'user_1', 0, NOW)
    const later = travelStatsTaskId('org_1', 'user_1', 0, NOW + 60_000)
    expect(later).not.toBe(first)
  })
})

describe('recomputeDelaySeconds', () => {
  /** The instant a window opens; `NOW` is a round minute, so it opens one. */
  const windowStart = NOW

  it('holds the message for the rest of the window it was written in', () => {
    expect(recomputeDelaySeconds(windowStart)).toBe(RECOMPUTE_WINDOW_MS / 1_000)
    expect(recomputeDelaySeconds(windowStart + 9_500)).toBe(1)
  })

  it('never delivers before the window it collapses closes', () => {
    // Every millisecond of a window, sampled: a delay that lands short of the
    // window's end would recompute from a snapshot the burst is still filling.
    for (let offset = 0; offset < RECOMPUTE_WINDOW_MS; offset += 250) {
      const at = windowStart + offset
      const delay = recomputeDelaySeconds(at)
      expect(delay).toBeGreaterThan(0)
      expect(at + delay * 1_000).toBeGreaterThanOrEqual(
        windowStart + RECOMPUTE_WINDOW_MS,
      )
    }
  })
})
