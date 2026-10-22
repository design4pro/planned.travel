/**
 * A journey's place on the day's number line: the one rule, shared by both writers of it.
 *
 * A day is one number line. `reorderDayTimelines` (`./itinerary`) owns it and numbers the stops and
 * notes `0..n-1`; a journey expresses where it sits **between** two of those positions, through the
 * fractional `sort_order` its own columns were declared to be (`schema.ts`). Two callers place
 * journeys, and the rule exists once, here:
 *
 * - `reorderDayTimelines` places them in the same batch that renumbers the stops and notes, against
 *   the numbering that very write produces.
 * - `reorderDayTransports` (`./transports`) places them against the numbering already stored, for
 *   the writes that never renumber a day (schedule, unschedule, delete).
 *
 * This module reads and plans; it writes nothing itself. The caller owns the batch.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { transportLegs, transports } from '#/server/db/schema'
import { tenantFilter } from './base'
import { idSchema } from './validation'
import type { BatchStatement } from './batch'
import type { TenantScope } from './base'

/**
 * One row of a day's resulting run, as a reorder names it.
 *
 * The stops and the notes are the **ruler**; the journeys are placed against it.
 */
export const dayRunItemInput = z.strictObject(
  {
    kind: z.enum(['stop', 'note', 'transport', 'leg']),
    id: idSchema,
  },
  {
    error:
      'A day run item is a stop, a note, a transport or a leg, named by its id.',
  },
)
export type DayRunItemInput = z.infer<typeof dayRunItemInput>

/**
 * The most rows one day's run may carry.
 *
 * A day holds at most 200 stops and notes; the journeys get their own 200 rather than taking them
 * out of that budget, so a day the primary write accepts is never refused for its journeys.
 */
export const DAY_RUN_MAX_ITEMS = 400

/** The bound a day's stops and notes have always had. */
export const DAY_RUN_MAX_ANCHORS = 200

export const DAY_RUN_ANCHORS_MESSAGE = `A day carries at most ${DAY_RUN_MAX_ANCHORS} stops and notes.`

/** `kind/id`, so the four id spaces share one `Set` without colliding. */
export function dayRunKey(ref: DayRunItemInput): string {
  return `${ref.kind}/${ref.id}`
}

/** A stop or a note: the kinds that carry the ruler. */
export type AnchorRef = DayRunItemInput & { readonly kind: 'stop' | 'note' }

/** True for the two kinds that carry the ruler: a stop or a note. */
export function isAnchor(ref: DayRunItemInput): ref is AnchorRef {
  return ref.kind === 'stop' || ref.kind === 'note'
}

/** True when a run names no more stops and notes than a day may hold. */
export function withinAnchorBound(
  items: ReadonlyArray<DayRunItemInput>,
): boolean {
  return items.filter(isAnchor).length <= DAY_RUN_MAX_ANCHORS
}

/** A row of the day as stored: who it is and the position it holds. */
export interface DayRunEntry {
  readonly ref: DayRunItemInput
  readonly position: number
}

/**
 * The day as it stands. A journey that ties with a stop or a note follows it — the client's rule,
 * and the only tie this design can produce (`schedulePlaceFn` positions a stop among stops alone,
 * so it can land on a note's integer).
 */
export function byDayRun(a: DayRunEntry, b: DayRunEntry): number {
  return (
    a.position - b.position ||
    Number(isAnchor(b.ref)) - Number(isAnchor(a.ref)) ||
    a.ref.id.localeCompare(b.ref.id)
  )
}

/**
 * The journeys that **depart** from one day: a record with no legs whose `day_id` is this day, and
 * a leg whose `departure_day_id` is.
 *
 * A journey drawn as its legs is never also drawn whole, so a record that has legs contributes
 * nothing here — its legs do, each on its own departure day.
 *
 * Read as the **day** rather than as the trip, unlike `listTripDayTransports`, which answers the
 * board and has to draw every day at once. The placement needs one day of a set that grows with the
 * whole itinerary, and the planner issues one per day a drag touches, in parallel — so borrowing the
 * board's read here meant pulling every `transports` and `transport_legs` row of the trip to keep
 * one day's.
 *
 * Three questions, asked together, and each one of them an index seek rather than a filter over
 * the trip — `EXPLAIN QUERY PLAN` is the assertion, in `transports.test.ts`, because a day-scoped
 * `WHERE` that the planner answers by walking the trip is trip-wide work wearing the right words,
 * and D1 bills rows read:
 *
 * 1. the records of this day (`transports_org_trip_day_idx`),
 * 2. the legs that depart from it (`transport_legs_org_trip_departure_day_idx`) — the half this
 *    run places,
 * 3. which of those records have legs at all (`transport_legs_org_transport_idx`), which is the
 *    only thing that can say a record of this day is drawn as its legs and so not drawn whole.
 *
 * The third is one question, not three merged into the second with an `OR`: an `OR` across two
 * columns costs SQLite the seek and sends it back to walking the trip's legs. It reads the ids it
 * needs as a subquery rather than waiting for (1), so all three still go out together.
 *
 * None of them orders: the caller sorts this list against the day's stops and notes with
 * {@link byDayRun}, which breaks every tie by id, so an `ORDER BY` here would be a sort SQLite
 * performs and the caller discards.
 */
export async function departingJourneys(
  scope: TenantScope,
  tripId: string,
  dayId: string,
): Promise<Array<DayRunEntry>> {
  const ofTheDay = and(
    eq(transports.tripId, tripId),
    eq(transports.dayId, dayId),
  )
  const theDaysRecords = scope.db
    .select({ id: transports.id })
    .from(transports)
    .where(tenantFilter(scope, transports, ofTheDay))

  const [records, legs, chainedRows] = await Promise.all([
    scope.db
      .select()
      .from(transports)
      .where(tenantFilter(scope, transports, ofTheDay)),
    scope.db
      .select()
      .from(transportLegs)
      .where(
        tenantFilter(
          scope,
          transportLegs,
          and(
            eq(transportLegs.tripId, tripId),
            eq(transportLegs.departureDayId, dayId),
          ),
        ),
      ),
    scope.db
      .select({ transportId: transportLegs.transportId })
      .from(transportLegs)
      .where(
        tenantFilter(
          scope,
          transportLegs,
          inArray(transportLegs.transportId, theDaysRecords),
        ),
      ),
  ])

  const chained = new Set(chainedRows.map((row) => row.transportId))
  return [
    ...records
      .filter((row) => !chained.has(row.id))
      .map((row) => ({
        ref: { kind: 'transport' as const, id: row.id },
        position: row.sortOrder,
      })),
    ...legs.map((leg) => ({
      ref: { kind: 'leg' as const, id: leg.id },
      position: leg.sortOrder,
    })),
  ]
}

/**
 * The value a journey takes between the anchor it follows and the next one.
 *
 * `before` is the position of the preceding stop or note and `anchorPositions` every position the
 * day's ruler holds, ascending; the next one strictly greater than `before` closes the gap. It is
 * never a count of entries, because a day is numbered `0..n-1` only straight after a renumbering:
 * `schedulePlaceFn` stores a new stop at the midpoint of its neighbours and `unschedulePlaceFn`
 * deletes one without renumbering, so on a day of stops at `0` and `2` an index formula would write
 * `1.5` for a journey that belongs behind the second.
 *
 * An open end is one unit wide: `b − 1` ahead of the day's first anchor, `a + 1` behind its last,
 * and `0`/`1` on a day with neither. Every value therefore lies strictly between two positions and
 * ties with no stop or note.
 */
function splitGap(
  before: number | null,
  anchorPositions: ReadonlyArray<number>,
  sharing: number,
): Array<number> {
  const first = anchorPositions.at(0)
  const [low, high] =
    before === null
      ? [(first ?? 1) - 1, first ?? 1]
      : [before, anchorPositions.find((value) => value > before) ?? before + 1]

  return Array.from(
    { length: sharing },
    (_unused, index) => low + ((index + 1) * (high - low)) / (sharing + 1),
  )
}

export interface PlacedJourney {
  readonly ref: DayRunItemInput
  readonly position: number
}

/**
 * Gives every journey of a resolved run its position, in the order the run names them.
 *
 * `wanted` is the day's whole run once the caller has dropped what it does not know and put back
 * what the payload left out; `positionOfAnchor` says where each stop and note of it sits — the
 * stored position for a day that is not being renumbered, the new index for one that is. The
 * journeys sharing one gap split it evenly, in the order the run names them.
 */
export function placeJourneys(
  wanted: ReadonlyArray<DayRunItemInput>,
  positionOfAnchor: ReadonlyMap<string, number>,
): Array<PlacedJourney> {
  const anchorPositions = [...positionOfAnchor.values()].sort((a, b) => a - b)

  const placed: Array<PlacedJourney> = []
  let before: number | null = null
  let run: Array<DayRunItemInput> = []
  const flush = (): void => {
    if (run.length === 0) return
    const positions = splitGap(before, anchorPositions, run.length)
    for (const [index, ref] of run.entries()) {
      placed.push({ ref, position: positions[index] })
    }
    run = []
  }
  for (const ref of wanted) {
    if (isAnchor(ref)) {
      flush()
      before = positionOfAnchor.get(dayRunKey(ref)) ?? before
      continue
    }
    run.push(ref)
  }
  flush()
  return placed
}

/**
 * The statements that write the placed journeys: `transports.sort_order` and
 * `transport_legs.sort_order`, and nothing else. Prepared, not awaited, so a caller can put them in
 * the same {@link runBatch} as the rows they were measured against.
 */
export function journeyPositionStatements(
  scope: TenantScope,
  placed: ReadonlyArray<PlacedJourney>,
): Array<BatchStatement> {
  return placed.map(({ ref, position }) =>
    ref.kind === 'transport'
      ? scope.db
          .update(transports)
          .set({ sortOrder: position })
          .where(tenantFilter(scope, transports, eq(transports.id, ref.id)))
      : scope.db
          .update(transportLegs)
          .set({ sortOrder: position })
          .where(
            tenantFilter(scope, transportLegs, eq(transportLegs.id, ref.id)),
          ),
  )
}
