/**
 * Atlas country and region boundaries. Every handler derives the acting traveller
 * from appScope; id-addressed removals prove ownership through that traveller's rows.
 * Country toggles remain idempotent. Region names resolve against own rows before
 * hashing; unique-index races re-read by country and code without exposing SQL.
 * The region ceiling is a noisy-neighbour guard, translated through withQuotaBoundary.
 * Region writes enqueue all-time statistics once per changed call; queue failures
 * are logged by the producer. A new region plus country cascade costs 8-9 D1 statements.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { continentOf } from '#/lib/atlas/continents'
import { foldPlaceName, placeNameSchema } from '#/lib/atlas/place-name'
import { COUNTRY_NAMES, countryName } from '#/lib/atlas/country-names'
import {
  affectedStatYears,
  requestTravelStatsRecompute,
} from '#/server/queue/travel-stats-fanout'
import {
  NotFoundError,
  QuotaExceededError,
  createBucketListItem,
  deleteBucketListItem,
  listBucketList,
  listVisitedCountries,
  listVisitedRegions,
  recordRegionVisit,
  regionCodeFor,
  unmarkRegionVisited,
  markCountryVisited,
  isUniqueConstraintViolation,
  unmarkCountryVisited,
} from '#/server/repos'
import { appScope } from './context'

import type { Continent } from '#/lib/atlas/continents'
import type { BucketListItem, VisitedCountry } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ inputs */

/**
 * Two letters, upper-cased here so a code arriving from a map feature, a URL or a
 * form works whatever its case. The repository's own `countryCodeSchema` demands
 * upper case and re-parses what this produces.
 */
const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code.')
  .transform((value) => value.toUpperCase())

const visitDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')

/**
 * Shorter than the repository's 20 000-character ceiling on purpose: this note is
 * the one line under a country in a popover, not a journal entry.
 */
const noteSchema = z.string().trim().max(2_000)

const targetYearSchema = z.number().int().min(1900).max(2200)

const rowIdSchema = z.string().trim().min(1).max(64)

export const markCountryVisitedInputSchema = z.object({
  countryCode: countryCodeSchema,
  /** The day it happened, when the traveller remembers one. */
  visitedOn: visitDateSchema.nullish(),
  note: noteSchema.nullish(),
})

export const unmarkCountryVisitedInputSchema = z.object({
  countryCode: countryCodeSchema,
})

export const addCountryToBucketListInputSchema = z.object({
  countryCode: countryCodeSchema,
  targetYear: targetYearSchema.nullish(),
  note: noteSchema.nullish(),
})

export const removeCountryFromBucketListInputSchema = z.object({
  itemId: rowIdSchema,
})

/* ------------------------------------------------------------------- state */

/** A country's row in `visited_countries`, as the client needs it. */
export interface AtlasVisitRecord {
  readonly id: string
  readonly countryCode: string
  readonly continent: string | null
  readonly firstVisitedOn: string | null
  readonly lastVisitedOn: string | null
  readonly visitCount: number
  readonly note: string | null
}

/** A country's entry on the bucket list, as the client needs it. */
export interface AtlasBucketGoal {
  readonly id: string
  readonly name: string
  readonly targetYear: number | null
  readonly note: string | null
  readonly isAchieved: boolean
  readonly achievedOn: string | null
}

/**
 * Everything true about one country for the traveller who asked. Both halves are
 * read from D1, never from a cache.
 */
export interface AtlasCountryState {
  readonly countryCode: string
  /** Resolved from the code, so it is the same string the roll-up groups on. */
  readonly continent: Continent | null
  readonly visit: AtlasVisitRecord | null
  readonly bucketGoal: AtlasBucketGoal | null
}

/**
 * The boundary's translation of a repository quota refusal.
 *
 * Modelled on `AuthRequirementError`, which is how this codebase already carries
 * an HTTP status out of a server function: the status says what kind of refusal it
 * is, and the message is written to be read by a person, naming both the metric
 * that ran out and the ceiling it ran out at. 402 rather than 409 because the fix
 * is a plan, not a retry.
 */
export class AtlasQuotaError extends Error {
  override readonly name = 'AtlasQuotaError'
  readonly status = 402

  constructor(
    readonly metric: string,
    readonly limit: number,
    readonly current: number,
  ) {
    super(
      `Your plan allows ${limit} ${metric.replace(/_/g, ' ')} and this workspace already has ${current}. Upgrade the plan to add more.`,
    )
  }
}

/**
 * The boundary's answer when two writes for the same country collide and neither
 * attempt can be resolved into a stable state.
 *
 * Reaching this needs the other request to have inserted the row and then rolled
 * it back between this one's two attempts, which is a genuine conflict rather
 * than a fault: 409, and a message that says what to do about it. What it
 * deliberately does *not* repeat is anything the database said - the driver's
 * refusal carries the failing statement, the organisation id and the traveller
 * id, and none of those is a thing to hand back over a wire.
 */
export class AtlasConflictError extends Error {
  override readonly name = 'AtlasConflictError'
  readonly status = 409

  constructor(readonly countryCode: string) {
    super(
      `${countryName(countryCode)} was being changed somewhere else at the same moment. Try that again.`,
    )
  }
}

/* ----------------------------------------------------------------- helpers */

/**
 * Runs a repository write and turns its quota refusal into one a person can act
 * on. Everything else - not found, tenant isolation, a real fault - propagates
 * untouched, because swallowing those is how a boundary starts lying.
 */
async function withQuotaBoundary<TResult>(
  write: () => Promise<TResult>,
): Promise<TResult> {
  try {
    return await write()
  } catch (cause) {
    if (cause instanceof QuotaExceededError) {
      throw new AtlasQuotaError(cause.metric, cause.limit, cause.current)
    }
    throw cause
  }
}

/**
 * Runs a delete whose whole purpose is that the row should not exist afterwards,
 * and treats "it already does not" as the success it is.
 *
 * The repositories raise {@link NotFoundError} when a delete matches nothing,
 * which is the right answer for an id a caller supplied and the wrong one for an
 * id this module found in the row it is removing: between the read and the delete
 * a second tab, a retry or a colleague can have removed it, and refusing the
 * request then tells the traveller a change failed when it is exactly what they
 * asked for. Only ever wrapped around a delete whose ownership has already been
 * proved, so nothing here can swallow a refusal that meant "not yours".
 */
async function alreadyGone(remove: () => Promise<void>): Promise<boolean> {
  try {
    await remove()
    return true
  } catch (cause) {
    if (!(cause instanceof NotFoundError)) {
      throw cause
    }
    return false
  }
}

/** `''` and whitespace mean "not given", which is `undefined` to a repository. */
function optionalText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

function visitRecordOf(row: VisitedCountry): AtlasVisitRecord {
  return {
    id: row.id,
    countryCode: row.countryCode.toUpperCase(),
    continent: row.continent,
    firstVisitedOn: row.firstVisitedOn,
    lastVisitedOn: row.lastVisitedOn,
    visitCount: row.visitCount,
    note: row.note,
  }
}

function bucketGoalOf(row: BucketListItem): AtlasBucketGoal {
  return {
    id: row.id,
    name: row.name,
    targetYear: row.targetYear,
    note: row.note,
    isAchieved: row.isAchieved,
    achievedOn: row.achievedOn,
  }
}

/** Every bucket-list entry that is this country, in a stable order. */
function countryGoals(
  items: ReadonlyArray<BucketListItem>,
  code: string,
): Array<BucketListItem> {
  return items
    .filter(
      (row) =>
        row.kind === 'country' &&
        (row.countryCode ?? '').toUpperCase() === code,
    )
    .sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * The country goal for `code`, preferring one still to be achieved.
 *
 * `bucket_list_items` has no unique index on the country, so a data set that
 * predates this boundary can hold both a ticked-off entry and a fresh one. The
 * live aspiration is the one a popover should show.
 */
function pickGoal(
  items: ReadonlyArray<BucketListItem>,
  code: string,
): BucketListItem | null {
  const matches = countryGoals(items, code)
  return matches.find((row) => !row.isAchieved) ?? matches.at(0) ?? null
}

/**
 * One country's state, read from D1 in two scoped queries.
 *
 * This is both the answer every handler returns and the check that makes every
 * handler idempotent - "is it already visited?" and "is it already on the list?"
 * are `visit !== null` and `bucketGoal !== null`. Reading before the write costs
 * nothing extra, because the half the write does not touch has to be read anyway
 * for the answer to be complete.
 *
 * Both queries are tenant-scoped *and* traveller-scoped: the atlas is one
 * person's record of where they have been, not the workspace's.
 */
export async function atlasCountryState(
  scope: TenantScope,
  countryCode: string,
): Promise<AtlasCountryState> {
  const code = countryCode.trim().toUpperCase()
  const userId = scope.ctx.userId
  const [countries, bucket] = await Promise.all([
    listVisitedCountries(scope, userId),
    listBucketList(scope, userId),
  ])

  const visit =
    countries.find((row) => row.countryCode.toUpperCase() === code) ?? null
  const goal = pickGoal(bucket, code)

  return {
    countryCode: code,
    continent: continentOf(code),
    visit: visit === null ? null : visitRecordOf(visit),
    bucketGoal: goal === null ? null : bucketGoalOf(goal),
  }
}

/* -------------------------------------------------------- visited countries */

/**
 * How many times {@link markCountryVisitedFn} will try before it calls a
 * collision a conflict.
 *
 * Two is the whole space. Attempt one loses the index to a request that is still
 * in flight; attempt two re-reads and finds that request's row, which is the
 * answer. The only way past two is for the winner to have rolled its own insert
 * back in between, and a third attempt would be guessing rather than converging.
 */
const MARK_VISITED_ATTEMPTS = 2

/**
 * Records a country as visited with no trip behind it - "I have been to Peru",
 * said by someone who is not about to reconstruct the itinerary.
 *
 * Idempotent, twice over. A country already on the traveller's list comes back
 * untouched rather than incrementing its visit counter, because the control that
 * calls this is a toggle and pressing it twice is not two visits. And a country
 * that arrives on the list *while this request is running* comes back the same
 * way: `visited_countries_org_user_country_unq` refuses the second insert, and
 * the refusal is read as "somebody already did it", not as an error. Correcting a
 * date or a note on an existing record is the atlas panel's job, not this one's.
 *
 * The statistics the visit moves are rebuilt off the request: the map repaints
 * optimistically from {@link AtlasCountryState}, and the panel catches up on its
 * next read once the `travel-stats` envelopes have been consumed.
 */
async function recordCountryVisit(
  scope: TenantScope,
  code: string,
  options: { visitedOn?: string | null; note?: string | null } = {},
): Promise<{ state: AtlasCountryState; created: boolean }> {
  for (let attempt = 0; attempt < MARK_VISITED_ATTEMPTS; attempt += 1) {
    const current = await atlasCountryState(scope, code)
    if (current.visit !== null) {
      return { state: current, created: false }
    }

    try {
      const visit = await withQuotaBoundary(() =>
        markCountryVisited(scope, {
          countryCode: code,
          continent: continentOf(code),
          visitedOn: optionalText(options.visitedOn),
          note: optionalText(options.note),
        }),
      )
      return {
        state: { ...current, visit: visitRecordOf(visit) },
        created: true,
      }
    } catch (cause) {
      if (!isUniqueConstraintViolation(cause)) {
        throw cause
      }
      // A concurrent request holds the index. Its row is the truth; go round
      // and read it back from D1 rather than answering from this one's memory.
    }
  }

  throw new AtlasConflictError(code)
}

export const markCountryVisitedFn = createServerFn({ method: 'POST' })
  .validator(markCountryVisitedInputSchema)
  .handler(async ({ data }): Promise<AtlasCountryState> => {
    const scope = await appScope()
    const result = await recordCountryVisit(scope, data.countryCode, data)
    if (result.created) {
      await requestTravelStatsRecompute(
        scope,
        [scope.ctx.userId],
        affectedStatYears(data.visitedOn),
        { route: 'atlas' },
      )
    }
    return result.state
  })

/**
 * Undoes {@link markCountryVisitedFn}.
 *
 * Also idempotent, and for the same reason: a country that is not on the list is
 * already in the state the caller asked for - and so is one whose row went in the
 * moment between this request's read and its delete, which is why the delete is
 * allowed to find nothing. The row is found inside the caller's own tenant and
 * traveller before it is addressed by id, so a code marked by another workspace
 * resolves to nothing here and is never touched.
 */
export const unmarkCountryVisitedFn = createServerFn({ method: 'POST' })
  .validator(unmarkCountryVisitedInputSchema)
  .handler(async ({ data }): Promise<AtlasCountryState> => {
    const scope = await appScope()
    const current = await atlasCountryState(scope, data.countryCode)

    if (current.visit === null) {
      return current
    }

    const visit = current.visit
    await alreadyGone(() => unmarkCountryVisited(scope, visit.id))
    // A row spanning several years is folded onto its most recent one rather
    // than fanned out across the range: `byContinent` on the intervening years
    // is rebuilt by the all-time envelope's sibling writes, and a fan-out here
    // would cost a consumer invocation per year for a country that was, at
    // most, one trip. On an undo the row being removed carries the only date
    // this has to go on.
    await requestTravelStatsRecompute(
      scope,
      [scope.ctx.userId],
      affectedStatYears(visit.lastVisitedOn ?? visit.firstVisitedOn),
      { route: 'atlas' },
    )
    return { ...current, visit: null }
  })

/* -------------------------------------------------------------- bucket list */

/**
 * Collapses the rival entries an overlapping add can leave behind, and answers
 * with the one that survives.
 *
 * `bucket_list_items` has no unique index, so two requests that both found the
 * country absent both insert, and nothing stops them. The repair is to re-read
 * the list - from D1, in the same request - and keep the lowest id among the live
 * entries for this country. Both racers compute the same keeper from the same
 * rows, so whichever one reaches a delete first, the other's delete finds the
 * row already gone - which is the outcome it was asking for, and is why it goes
 * through {@link alreadyGone}.
 *
 * Achieved entries are never touched: a ticked-off goal is a record of something
 * that happened. This runs only when the country had no entry at all a moment
 * ago, so the rivals it can see are entries written in the same instant as its
 * own.
 */
async function collapseRivalGoals(
  scope: TenantScope,
  code: string,
  created: BucketListItem,
): Promise<BucketListItem> {
  const live = countryGoals(
    await listBucketList(scope, scope.ctx.userId),
    code,
  ).filter((row) => !row.isAchieved)

  const keeper = live.at(0) ?? created
  for (const rival of live.slice(1)) {
    await alreadyGone(() => deleteBucketListItem(scope, rival.id))
  }
  return keeper
}

/**
 * Puts a country on the bucket list.
 *
 * The entry's name is the country's name as this product spells it, resolved
 * server-side: a client that could choose the label could put anything into the
 * traveller's list. Idempotent against an entry that already exists for the
 * country, ticked off or not - and, because the table has no unique index to lean
 * on, idempotent against one that appears while this request is running too: the
 * write is read back and any rival entry for the same country is collapsed onto a
 * single keeper before the answer is returned. See {@link collapseRivalGoals}.
 */
export const addCountryToBucketListFn = createServerFn({ method: 'POST' })
  .validator(addCountryToBucketListInputSchema)
  .handler(async ({ data }): Promise<AtlasCountryState> => {
    const scope = await appScope()
    const code = data.countryCode
    const current = await atlasCountryState(scope, code)

    if (current.bucketGoal !== null) {
      return current
    }

    const created = await withQuotaBoundary(() =>
      createBucketListItem(scope, {
        kind: 'country',
        name: countryName(code),
        countryCode: code,
        targetYear: data.targetYear ?? undefined,
        note: optionalText(data.note),
      }),
    )
    const goal = await collapseRivalGoals(scope, code, created)
    return { ...current, bucketGoal: bucketGoalOf(goal) }
  })

/**
 * Takes a country back off the bucket list.
 *
 * Addressed by row id, and the row is resolved inside the caller's own tenant
 * *and* against their own traveller id before anything is deleted. The
 * repository's delete is organisation-scoped, which is one boundary short of what
 * the atlas promises - every other atlas read is per traveller - so the refusal is
 * made here, as the same `NotFoundError` a cross-tenant id would have produced. An
 * id from another workspace and an id belonging to a colleague are equally
 * invisible, and so is an id that names a place goal rather than a country. Once
 * that ownership is settled the delete itself is allowed to find nothing: a
 * second tap on the same control asked for a row that is already gone, and it got
 * one.
 */
export const removeCountryFromBucketListFn = createServerFn({ method: 'POST' })
  .validator(removeCountryFromBucketListInputSchema)
  .handler(async ({ data }): Promise<AtlasCountryState> => {
    const scope = await appScope()

    const items = await listBucketList(scope, scope.ctx.userId)
    const item = items.find((row) => row.id === data.itemId) ?? null
    if (item === null || item.kind !== 'country' || item.countryCode === null) {
      throw new NotFoundError('bucket list country', data.itemId)
    }

    await alreadyGone(() => deleteBucketListItem(scope, item.id))
    return atlasCountryState(scope, item.countryCode)
  })

/* ----------------------------------------------------------- visited regions */
const knownCountryCodeSchema = countryCodeSchema.refine(
  (code) => COUNTRY_NAMES[code] !== undefined,
)
export const loadCountryRegionsInputSchema = z.strictObject({
  countryCode: knownCountryCodeSchema,
})
export const markRegionVisitedInputSchema = z.strictObject({
  countryCode: knownCountryCodeSchema,
  regionName: placeNameSchema(120),
})
export const unmarkRegionVisitedInputSchema = z.strictObject({
  regionId: rowIdSchema,
})

export interface AtlasRegionsState {
  readonly regions: Array<{ id: string; name: string }>
  readonly total: number
}

async function countryRegions(
  scope: TenantScope,
  code: string,
): Promise<AtlasRegionsState> {
  const rows = await listVisitedRegions(scope, scope.ctx.userId)
  return {
    regions: rows
      .filter((row) => row.countryCode === code)
      .map((row) => ({ id: row.id, name: row.regionName })),
    total: rows.length,
  }
}

export const loadCountryRegionsFn = createServerFn({ method: 'GET' })
  .validator(loadCountryRegionsInputSchema)
  .handler(async ({ data }): Promise<AtlasRegionsState> =>
    countryRegions(await appScope(), data.countryCode),
  )

export const markRegionVisitedFn = createServerFn({ method: 'POST' })
  .validator(markRegionVisitedInputSchema)
  .handler(async ({ data }) => {
    const scope = await appScope()
    const code = data.countryCode
    const own = await listVisitedRegions(scope, scope.ctx.userId)
    const folded = foldPlaceName(data.regionName)
    let existing = own.find(
      (row) =>
        row.countryCode === code && foldPlaceName(row.regionName) === folded,
    )
    let created = false
    if (!existing) {
      const regionCode = await regionCodeFor(code, data.regionName)
      for (let attempt = 0; attempt < MARK_VISITED_ATTEMPTS; attempt += 1) {
        try {
          const result = await withQuotaBoundary(() =>
            recordRegionVisit(scope, {
              countryCode: code,
              regionCode,
              regionName: data.regionName,
            }),
          )
          existing = result.row
          created = result.created
          break
        } catch (cause) {
          if (!isUniqueConstraintViolation(cause)) throw cause
          existing = (await listVisitedRegions(scope, scope.ctx.userId)).find(
            (row) => row.countryCode === code && row.regionCode === regionCode,
          )
          if (existing) break
        }
      }
      if (!existing) throw new AtlasConflictError(code)
    }
    const country = await recordCountryVisit(scope, code)
    if (created || country.created) {
      await requestTravelStatsRecompute(scope, [scope.ctx.userId], [0], {
        route: 'atlas',
      })
    }
    return {
      ...(await countryRegions(scope, code)),
      country: country.state,
      countryCreated: country.created,
      created,
    }
  })

export const unmarkRegionVisitedFn = createServerFn({ method: 'POST' })
  .validator(unmarkRegionVisitedInputSchema)
  .handler(async ({ data }): Promise<AtlasRegionsState> => {
    const scope = await appScope()
    const own = await listVisitedRegions(scope, scope.ctx.userId)
    const row = own.find((item) => item.id === data.regionId)
    if (!row) throw new NotFoundError('visited region', data.regionId)
    const removed = await alreadyGone(() => unmarkRegionVisited(scope, row.id))
    if (removed)
      await requestTravelStatsRecompute(scope, [scope.ctx.userId], [0], {
        route: 'atlas',
      })
    return countryRegions(scope, row.countryCode)
  })
