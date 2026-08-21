/**
 * Write paths for the atlas: the two things a traveller can do to a country
 * without planning a trip to it.
 *
 * `visited_countries` and `bucket_list_items` have had a complete, tenant-scoped,
 * isolation-tested repository since the schema landed, and nothing outside the
 * repository's own tests could reach it. This module is the missing boundary and
 * nothing more: it validates, it resolves the tenant, it calls named repository
 * functions, and it returns the state the caller should now render. There is no
 * SQL here, and there is no decision here that a client could have made.
 *
 * ## The shape every handler follows (ARCHITECTURE §2.2)
 *
 * 1. **Validate.** Zod at the boundary, and the repository parses its own input
 *    again, so a hand-rolled request cannot smuggle a field past the form.
 * 2. **Quota.** Neither table is metered: `USAGE_METRICS` sells trips, places,
 *    members, files, storage, exports, collections and journeys, and a country is
 *    none of those - a traveller who has been to 90 countries has not spent
 *    anything a plan rations. So no handler calls `assertQuota`, because there is
 *    no metric to assert against, and inventing one here would put the ceiling
 *    outside `src/server/repos/base.ts`, where §6 says it may not live. What every
 *    write *does* do is translate a `QuotaExceededError` should a repository ever
 *    start throwing one: see {@link AtlasQuotaError}. A plan ceiling that reaches
 *    the reader as a bare 500 is a bug waiting to happen, not a decision to defer.
 * 3. **Write.** One statement, through one repository function. There is no
 *    multi-row invariant to hold, so there is nothing to wrap in a transaction.
 * 4. **Invalidate.** Nothing to invalidate: `/atlas` is loader-driven straight off
 *    D1, and the only things this deployment keeps in KV are plan state and
 *    sessions, neither of which a country touches. Usage counters are not cached
 *    anywhere and are not cached here. The rule this obeys is §4's second one - a
 *    read-your-own-write path reads D1 - and {@link atlasCountryState} is where it
 *    is obeyed: every handler's answer is read back from D1 in the same request,
 *    never from a cache that is eventually consistent for up to a minute.
 * 5. **Return the new state.** {@link AtlasCountryState} is the whole answer for
 *    one country: whether it is visited, whether it is on the bucket list, and the
 *    continent it rolls up under. A caller can repaint the country and its popover
 *    from that alone, without waiting for a loader round trip.
 *
 * ## Idempotence
 *
 * All four handlers are safe to repeat. `visited_countries` carries a unique index
 * on `(organization_id, user_id, country_code)`, and the honest way to respect it
 * is to read the row first and return it unchanged rather than to insert and catch
 * a constraint violation - a double-tapped button, a retried request and a
 * reconnecting client all arrive here, and none of them means the traveller went
 * twice.
 *
 * ## Continent
 *
 * The continent is resolved from the country code by `#/lib/atlas/continents`,
 * server-side, and is never accepted from the client. The atlas summary groups on
 * that column in SQL, so a blank or misspelled value becomes a nameless cell in
 * the panel's roll-up with a real count in it.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { continentOf } from '#/lib/atlas/continents'
import { countryName } from '#/lib/atlas/country-names'
import {
  NotFoundError,
  QuotaExceededError,
  createBucketListItem,
  deleteBucketListItem,
  listBucketList,
  listVisitedCountries,
  markCountryVisited,
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
  const matches = items.filter(
    (row) =>
      row.kind === 'country' && (row.countryCode ?? '').toUpperCase() === code,
  )
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
 * Records a country as visited with no trip behind it - "I have been to Peru",
 * said by someone who is not about to reconstruct the itinerary.
 *
 * Idempotent: a country already on the traveller's list comes back untouched
 * rather than incrementing its visit counter, because the control that calls this
 * is a toggle and pressing it twice is not two visits. Correcting a date or a note
 * on an existing record is the atlas panel's job, not this one's.
 */
export const markCountryVisitedFn = createServerFn({ method: 'POST' })
  .validator(markCountryVisitedInputSchema)
  .handler(async ({ data }): Promise<AtlasCountryState> => {
    const scope = await appScope()
    const code = data.countryCode
    const current = await atlasCountryState(scope, code)

    if (current.visit !== null) {
      return current
    }

    const visit = await withQuotaBoundary(() =>
      markCountryVisited(scope, {
        countryCode: code,
        continent: continentOf(code),
        visitedOn: optionalText(data.visitedOn),
        note: optionalText(data.note),
      }),
    )
    return { ...current, visit: visitRecordOf(visit) }
  })

/**
 * Undoes {@link markCountryVisitedFn}.
 *
 * Also idempotent, and for the same reason: a country that is not on the list is
 * already in the state the caller asked for. The row is found inside the caller's
 * own tenant and traveller before it is addressed by id, so a code marked by
 * another workspace resolves to nothing here and is never touched.
 */
export const unmarkCountryVisitedFn = createServerFn({ method: 'POST' })
  .validator(unmarkCountryVisitedInputSchema)
  .handler(async ({ data }): Promise<AtlasCountryState> => {
    const scope = await appScope()
    const current = await atlasCountryState(scope, data.countryCode)

    if (current.visit === null) {
      return current
    }

    await unmarkCountryVisited(scope, current.visit.id)
    return { ...current, visit: null }
  })

/* -------------------------------------------------------------- bucket list */

/**
 * Puts a country on the bucket list.
 *
 * The entry's name is the country's name as this product spells it, resolved
 * server-side: a client that could choose the label could put anything into the
 * traveller's list. Idempotent against an entry that already exists for the
 * country, ticked off or not.
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

    const goal = await withQuotaBoundary(() =>
      createBucketListItem(scope, {
        kind: 'country',
        name: countryName(code),
        countryCode: code,
        targetYear: data.targetYear ?? undefined,
        note: optionalText(data.note),
      }),
    )
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
 * invisible, and so is an id that names a place goal rather than a country.
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

    await deleteBucketListItem(scope, item.id)
    return atlasCountryState(scope, item.countryCode)
  })
