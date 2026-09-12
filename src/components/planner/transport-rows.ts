/**
 * What a journey is called on each day it covers, and how it becomes those rows.
 *
 * Pure arithmetic and a vocabulary, kept out of `transport-row.tsx` because the row is a
 * rendering concern and this is not: a three-day flight produces three rows whether or not
 * anybody draws them, and the rules for which day gets which label are the kind of thing a
 * test should be able to state in one line.
 *
 * `TRANSPORT_MODES` comes from `modules/transports/vocabulary.ts` and never from
 * `src/server/db/schema.ts`, which would pull Drizzle into the browser bundle — the same
 * boundary `types.ts` records for `DAY_NOTE_ICONS`.
 */

import { isTransportMode } from '#/components/modules/transports/vocabulary'
import { legItemId } from './ordering'

import type { TransportMode } from '#/components/modules/transports/vocabulary'
import type { MessageKey } from '#/lib/i18n'
import type { PlannerTransport } from './types'

/** What the three parts of a journey are called, for one family of modes. */
export interface JourneyPhases {
  readonly departing: MessageKey
  readonly travelling: MessageKey
  readonly arriving: MessageKey
}

const AIR: JourneyPhases = {
  departing: 'trips.plan.transport.phase.flight.departing',
  travelling: 'trips.plan.transport.phase.flight.travelling',
  arriving: 'trips.plan.transport.phase.flight.arriving',
}

const HIRE: JourneyPhases = {
  departing: 'trips.plan.transport.phase.hire.departing',
  travelling: 'trips.plan.transport.phase.hire.travelling',
  arriving: 'trips.plan.transport.phase.hire.arriving',
}

const GENERIC: JourneyPhases = {
  departing: 'trips.plan.transport.phase.journey.departing',
  travelling: 'trips.plan.transport.phase.journey.travelling',
  arriving: 'trips.plan.transport.phase.journey.arriving',
}

/**
 * Every mode's triple, as a mapped type rather than a `switch` with a `default`.
 *
 * The mapping is total by construction: adding a thirteenth mode to `TRANSPORT_MODES` is a
 * compile error here until somebody says what it is called on the day it happens.
 */
const MODE_PHASES: { readonly [K in TransportMode]: JourneyPhases } = {
  flight: AIR,
  train: GENERIC,
  bus: GENERIC,
  ferry: GENERIC,
  car: HIRE,
  taxi: GENERIC,
  transit: GENERIC,
  metro: GENERIC,
  tram: GENERIC,
  bike: GENERIC,
  walk: GENERIC,
  other: GENERIC,
}

/**
 * What each part of a journey in this mode is called.
 *
 * Takes a `string` rather than a {@link TransportMode} because the column's `CHECK` was added
 * after rows already existed and no migration narrows them; an unknown mode takes the generic
 * triple, exactly as `modeIcon` falls back to a generic glyph.
 */
export function transportPhases(mode: string): JourneyPhases {
  return isTransportMode(mode) ? MODE_PHASES[mode] : GENERIC
}

/**
 * One journey as it is stored, before it is cut into the rows its days show.
 *
 * Everything locale-dependent arrives already formatted, as everywhere else in this directory:
 * the caller owns the formatters, and three strings is cheaper than a date library.
 */
export interface Journey {
  readonly kind: 'transport' | 'leg'
  readonly id: string
  readonly departureDayId: string | null
  readonly arrivalDayId: string | null
  /** As stored. Narrowed by nothing; {@link transportPhases} falls back. */
  readonly mode: string
  /** As stored. The status pill's vocabulary falls back. */
  readonly status: string
  readonly serviceNumber: string | null
  readonly fromName: string | null
  readonly toName: string | null
  /** Already formatted, e.g. `09:00`. */
  readonly departureLabel: string | null
  /** Already formatted, e.g. `12:30`. */
  readonly arrivalLabel: string | null
  /** Already formatted, e.g. `09:00 – 12:30`. What a one-day journey shows. */
  readonly rangeLabel: string | null
  /** Already formatted, e.g. `¥13,320`. */
  readonly price: string | null
  /** `sort_order` as stored. */
  readonly position: number
}

/**
 * One journey in, one row per day it covers out.
 *
 * `dayIds` is the trip's days in order, which is what turns two day references into a range.
 * Four shapes come out of it:
 *
 * - **One day.** One row, `departing`, and *no* phase label: naming a part only makes sense
 *   when there is more than one. It shows the range rather than either end.
 * - **Several days.** `departing` on the first, `arriving` on the last, `travelling` between,
 *   each carrying its own label and only the ends carrying a clock.
 * - **An arrival and no departure.** One row on the arrival day, `arriving`, which is what
 *   keeps it off the ruler: a journey with no departure day has no stored position to measure.
 * - **Neither day, or a day the trip does not have.** Nothing. It stays on the Transports tab.
 *
 * A journey arriving before it departs expands to its departure day alone rather than to an
 * empty range — `requireChainDays` already refuses to write one, and a row that reaches the
 * client anyway is still drawn somewhere rather than silently dropped.
 */
export function expandJourneyRows(
  journey: Journey,
  dayIds: ReadonlyArray<string>,
): Array<PlannerTransport> {
  const first =
    journey.departureDayId === null
      ? -1
      : dayIds.indexOf(journey.departureDayId)
  const last =
    journey.arrivalDayId === null ? -1 : dayIds.indexOf(journey.arrivalDayId)

  if (first < 0) {
    return last < 0
      ? []
      : [row(journey, dayIds[last], 'arriving', null, journey.arrivalLabel)]
  }

  if (last <= first) {
    return [row(journey, dayIds[first], 'departing', null, journey.rangeLabel)]
  }

  const phases = transportPhases(journey.mode)
  const rows: Array<PlannerTransport> = []
  for (let at = first; at <= last; at += 1) {
    if (at === first) {
      rows.push(
        row(
          journey,
          dayIds[at],
          'departing',
          phases.departing,
          journey.departureLabel,
        ),
      )
    } else if (at === last) {
      rows.push(
        row(
          journey,
          dayIds[at],
          'arriving',
          phases.arriving,
          journey.arrivalLabel,
        ),
      )
    } else {
      rows.push(row(journey, dayIds[at], 'travelling', phases.travelling, null))
    }
  }
  return rows
}

function row(
  journey: Journey,
  dayId: string,
  part: PlannerTransport['part'],
  phase: MessageKey | null,
  time: string | null,
): PlannerTransport {
  return {
    itemId: legItemId(journey.kind, dayId, journey.id),
    kind: journey.kind,
    id: journey.id,
    dayId,
    part,
    phase,
    mode: journey.mode,
    status: journey.status,
    serviceNumber: journey.serviceNumber,
    fromName: journey.fromName,
    toName: journey.toName,
    time,
    price: journey.price,
    position: journey.position,
  }
}
