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
 * 3. **Write.** One row, through one repository function. There is no multi-row
 *    invariant to hold, so there is nothing to wrap in a transaction. The
 *    unmetered table without a unique index pays for that with one extra read
 *    after its insert (see Idempotence below), which keeps every handler inside
 *    §2.2's 1-4 statement budget and none of them holding a lock across an await.
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
 * All four handlers are safe to repeat, and "repeat" here means *overlapping*, not
 * merely sequential: a double-tapped button, a retried request and a reconnecting
 * client all arrive here, two of them can be in flight at once, and none of them
 * means the traveller went twice. Reading the row before writing it answers the
 * sequential case and cannot answer the concurrent one - between the read and the
 * write, the other request commits - so each write path also converges after the
 * fact, and the two tables need different mechanics for that because they are
 * protected differently:
 *
 * - `visited_countries` carries `visited_countries_org_user_country_unq` on
 *   `(organization_id, user_id, country_code)`. The loser of a race is refused by
 *   the database, so {@link markCountryVisitedFn} treats that refusal as the
 *   answer it was looking for - see {@link isUniqueConstraintViolation} - re-reads
 *   the winner's row from D1 and returns it. The raw refusal never leaves this
 *   module: the driver puts the whole `INSERT`, the organisation id, the user id
 *   and the country code into its message, and a boundary that forwards that is
 *   handing an internal schema to whoever double-tapped a button.
 * - `bucket_list_items` carries no unique index at all, so nothing refuses the
 *   loser and the duplicate is permanent rather than caught.
 *   {@link addCountryToBucketListFn} therefore re-reads its own write and
 *   collapses any rival entry for the same country onto one deterministic
 *   keeper - the lowest id, so both racers choose the same survivor and the
 *   loser's delete is a harmless no-op. A unique index would be cheaper and
 *   belongs in the schema; it is not this module's to add.
 * - The two undo paths converge the easy way: a row that has gone between this
 *   request's read and its delete is the state the caller asked for, so
 *   {@link alreadyGone} lets it pass. That never softens a refusal that meant
 *   "not yours" - ownership is proved before the delete is attempted, and a
 *   stranger's id is refused before any write is reached at all.
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
import { createLogger, serializeError } from '#/server/observability'
import { enqueueTask } from '#/server/queue/jobs'
import {
  recomputeDelaySeconds,
  travelStatsTaskId,
} from '#/server/queue/handlers/travel-stats'
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
import type { Logger } from '#/server/observability'
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
 * SQLite's constraint sub-codes for the two indexes that can refuse a duplicate:
 * `SQLITE_CONSTRAINT_PRIMARYKEY` and `SQLITE_CONSTRAINT_UNIQUE`.
 */
const UNIQUE_CONSTRAINT_CODES: ReadonlySet<number> = new Set([1555, 2067])

/** How far down a `cause` chain {@link isUniqueConstraintViolation} will look. */
const CAUSE_DEPTH = 8

function errorCode(value: object): number | null {
  const code: unknown = (value as { errcode?: unknown }).errcode
  return typeof code === 'number' ? code : null
}

/**
 * True when `cause` is a database refusal from a unique index.
 *
 * The chain has to be walked because no two drivers agree on where the refusal
 * ends up. The proxy driver the tests run against wraps it: the outer error says
 * "Failed query: insert into …" and carries the real one as `cause`, with
 * `errcode` 2067 on it. D1 in the Worker throws its own error whose message is
 * `D1_ERROR: UNIQUE constraint failed: …: SQLITE_CONSTRAINT` and carries no
 * numeric code at all. Matching either the sub-code or the sentence SQLite emits
 * covers both without asking the caller which runtime it is in.
 */
export function isUniqueConstraintViolation(cause: unknown): boolean {
  let current: unknown = cause
  for (let depth = 0; depth < CAUSE_DEPTH; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return false
    }
    const code = errorCode(current)
    if (code !== null && UNIQUE_CONSTRAINT_CODES.has(code)) {
      return true
    }
    if (
      current instanceof Error &&
      /unique constraint failed/i.test(current.message)
    ) {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}

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
async function alreadyGone(remove: () => Promise<void>): Promise<void> {
  try {
    await remove()
  } catch (cause) {
    if (!(cause instanceof NotFoundError)) {
      throw cause
    }
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

/* --------------------------------------------------------- stats recompute */

/**
 * Memoised per isolate: the logger holds no request state.
 *
 * Built here rather than taken from `./context` because that module's logger is
 * private to it; the level is the default rather than `LOG_LEVEL`, which costs
 * nothing — the only line this module emits is a `warn` that every level prints.
 */
let logger: Logger | undefined

function log(): Logger {
  logger ??= createLogger({
    context: { component: 'server-fn', route: 'atlas' },
  })
  return logger
}

/**
 * Asks the queue to rebuild this traveller's `travel_stats` rows.
 *
 * `travel_stats` is a derived cache — trip, day, place, city, country, region,
 * spend, distance and continent aggregates — and rebuilding it is six aggregate
 * queries over the workspace, which is the shape `ARCHITECTURE.md` §5 sends to
 * `TASKS` rather than running on a request. The map still repaints optimistically
 * from {@link AtlasCountryState}; the panel catches up on its next read.
 *
 * Three properties are deliberate:
 *
 * - **The envelope id collapses a burst.** Marking five countries in a row must
 *   not buy five recomputes of the same rows. The id is derived from the tenant,
 *   the traveller, the year and the ten-second window the write fell into, and
 *   the consumer acks a redelivery of an id it has already completed. The message
 *   is held back until that window closes, so the one recompute that survives the
 *   collapse sees every write in it — see `travelStatsTaskId`.
 * - **The binding is reached at call time, not at import time.** `#/server/auth/env` is
 *   the module that reads the Worker environment for `TASKS`, and it imports
 *   `cloudflare:workers` at module scope — a specifier that does not resolve
 *   outside workerd. This module is imported by suites that run in plain Node to
 *   exercise the read half of the atlas, so the door is opened inside the
 *   function that walks through it rather than at the top of the file.
 * - **A queue refusal never fails the traveller's write.** D1 is the durable
 *   record and has already been written by the time this runs. A binding that is
 *   unreachable costs a stale panel until the next write, which is strictly less
 *   than turning a successful save into a 500. Same reasoning, and the same
 *   shape, as `mirrorToRoom` in `./context`.
 */
async function enqueueTravelStatsRecompute(
  scope: TenantScope,
  years: ReadonlyArray<number>,
): Promise<void> {
  const orgId = scope.ctx.organizationId
  const userId = scope.ctx.userId
  const at = Date.now()

  try {
    const { taskQueue } = await import('#/server/auth/env')
    const queue = taskQueue()
    for (const statYear of [...new Set(years)]) {
      await enqueueTask(queue, {
        kind: 'travel-stats',
        orgId,
        id: travelStatsTaskId(orgId, userId, statYear, at),
        payload: { userId, statYear },
        delaySeconds: recomputeDelaySeconds(at),
      })
    }
  } catch (cause) {
    log().warn('travel stats recompute was not enqueued', {
      organizationId: orgId,
      ...serializeError(cause),
    })
  }
}

/**
 * The years one visited-country write can have moved, all-time first.
 *
 * On the all-time row a visit moves `countryCount` and `byContinent`; on a year
 * row it moves `byContinent` alone, because a year's country count is derived
 * from that year's trips and not from the visited list. So the year is worth
 * sending exactly when the write names one — and on an undo the date the write
 * names is the one on the row being removed, which is the only date an undo has.
 * A row spanning several years is folded onto its most recent one rather than
 * fanned out across the range: `byContinent` on the intervening years is
 * rebuilt by the all-time envelope's sibling writes, and a fan-out here would
 * cost a consumer invocation per year for a country that was, at most, one trip.
 */
function affectedStatYears(
  visitedOn: string | null | undefined,
): Array<number> {
  const year =
    typeof visitedOn === 'string' ? Number(visitedOn.slice(0, 4)) : Number.NaN
  return Number.isInteger(year) ? [0, year] : [0]
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
 */
export const markCountryVisitedFn = createServerFn({ method: 'POST' })
  .validator(markCountryVisitedInputSchema)
  .handler(async ({ data }): Promise<AtlasCountryState> => {
    const scope = await appScope()
    const code = data.countryCode

    for (let attempt = 0; attempt < MARK_VISITED_ATTEMPTS; attempt += 1) {
      const current = await atlasCountryState(scope, code)
      if (current.visit !== null) {
        return current
      }

      try {
        const visit = await withQuotaBoundary(() =>
          markCountryVisited(scope, {
            countryCode: code,
            continent: continentOf(code),
            visitedOn: optionalText(data.visitedOn),
            note: optionalText(data.note),
          }),
        )
        await enqueueTravelStatsRecompute(
          scope,
          affectedStatYears(data.visitedOn),
        )
        return { ...current, visit: visitRecordOf(visit) }
      } catch (cause) {
        if (!isUniqueConstraintViolation(cause)) {
          throw cause
        }
        // A concurrent request holds the index. Its row is the truth; go round
        // and read it back from D1 rather than answering from this one's memory.
      }
    }

    throw new AtlasConflictError(code)
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
    await enqueueTravelStatsRecompute(
      scope,
      affectedStatYears(visit.lastVisitedOn ?? visit.firstVisitedOn),
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
