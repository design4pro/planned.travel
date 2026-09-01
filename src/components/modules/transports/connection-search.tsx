/**
 * The second mode of the add-transport dialog: a connection the traveller did not have to look up.
 *
 * Two stops, a date, a filter by mode, a ranked list, and one row that expands into its
 * stop-by-stop detail. What is chosen is saved as an **ordinary journey** — the same chain
 * `03-S2b` writes — so it is editable afterwards like anything typed by hand, and a journey saved
 * this way can have its route re-searched and replaced in place without losing its identity, its
 * status or its booking code.
 *
 * Four things are worth knowing before reading the code.
 *
 * **The stop picker is a gate here, and only here.** Everywhere else in this area the station
 * catalogue is a shortcut over free text and never a gate in front of it — a traveller must be
 * able to record an airport that opened last week. A timetable router is asked *where*, not what a
 * place is called, so a search needs coordinates and free text cannot supply them. The constraint
 * is the provider's, so the dialog says so in the field's own hint rather than leaving a reader to
 * discover it by typing.
 *
 * **The list reserves its height before it has one.** The skeleton is the same three rows at the
 * same height the results will occupy, so the panel below never jumps when an answer lands. That
 * is `DESIGN.md`'s no-layout-shift rule applied to the one surface in this dialog that waits on a
 * network call.
 *
 * **A refusal is a designed state, not an error toast.** Four of them — the allowance spent, no
 * credential on this deployment, the provider unreachable, the provider answering nonsense — come
 * back from the server as *values* with a reason on them, and each gets its own words. A ceiling
 * refusal in particular has to say what ran out and when it comes back, or it is indistinguishable
 * from a fault.
 *
 * **Ranking is ours and the answer is the provider's.** "Earliest arrival" and "fewest changes"
 * are two orders over one list, applied here, so switching between them costs nothing and spends
 * nothing. The mode filter is not — it changes the question, so it is part of the query and part
 * of the cache key.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, Search } from 'lucide-react'

import {
  Alert,
  Button,
  Combobox,
  Field,
  Input,
  Skeleton,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatMoney } from '#/lib/money'
import {
  saveSearchedConnectionFn,
  searchConnectionsFn,
  searchStationsFn,
} from '#/server/fns/transports'
import { useAction } from '../shared'
import { formatGap } from './connections'
import { CHAIN_MAX_LEGS } from './leg-form'
import { modeIcon } from './mode-icon'

import type { ComboboxOption } from '#/components/ui'
import type {
  ConnectionSearchOutcome,
  StationMatch,
  TransitConnection,
  TransitLeg,
  TransitMode,
} from '#/server/fns/transports'
import type { TransportDayData } from './types'

/* ------------------------------------------------------------------- filter */

/**
 * The modes a public-transport search may be filtered by.
 *
 * Restated rather than imported from `#/server/transit/search`, for the reason `leg-form.ts`
 * restates the twelve transport modes: importing the value would pull the proxy, its validators
 * and the database schema behind it into the browser bundle to render five chips. The type comes
 * across from the server, so the two lists cannot drift apart without a type error.
 */
const MODE_FILTERS: ReadonlyArray<{
  readonly value: TransitMode
  readonly label: string
}> = [
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
  { value: 'metro', label: 'Metro' },
  { value: 'tram', label: 'Tram' },
  { value: 'ferry', label: 'Ferry' },
]

type Ranking = 'earliest' | 'fewest-changes'

const RANKINGS: ReadonlyArray<{
  readonly value: Ranking
  readonly label: string
}> = [
  { value: 'earliest', label: 'Earliest arrival' },
  { value: 'fewest-changes', label: 'Fewest changes' },
]

/**
 * Two orders over one answer.
 *
 * Both fall back to the shorter journey, so the order is total and a list never reshuffles between
 * renders on ties. `earliest` sorts on arrival rather than departure because that is what the
 * label promises: leaving sooner is worth nothing to somebody who arrives later.
 */
export function rankConnections(
  connections: ReadonlyArray<TransitConnection>,
  ranking: Ranking,
): ReadonlyArray<TransitConnection> {
  return [...connections].sort((left, right) => {
    if (ranking === 'fewest-changes' && left.changes !== right.changes) {
      return left.changes - right.changes
    }
    if (ranking === 'earliest' && left.arrivalAt !== right.arrivalAt) {
      return left.arrivalAt < right.arrivalAt ? -1 : 1
    }
    return left.durationMinutes - right.durationMinutes
  })
}

/* ------------------------------------------------------------------- clocks */

/** `2026-10-09T08:12:00` → `08:12`. The wall clock at the stop, never converted. */
function clockOf(at: string | null): string {
  return at === null ? '—' : (/T(\d{2}:\d{2})/.exec(at)?.[1] ?? '—')
}

/** `2026-10-09T08:12:00` → `2026-10-09`, for the columns that store a date. */
function dateOf(at: string | null): string {
  return at === null ? '' : (/^(\d{4}-\d{2}-\d{2})/.exec(at)?.[1] ?? '')
}

/** `08:12`, or `''` for a stop the provider gave no time for. */
function timeOf(at: string | null): string {
  const clock = clockOf(at)
  return clock === '—' ? '' : clock
}

/* -------------------------------------------------------------- the journey */

/**
 * The legs that are the journey, without the walk to the platform.
 *
 * A leading or trailing walk is how the traveller reaches the first stop and leaves the last one;
 * it is not part of the connection they are recording, and keeping it would make the journey start
 * at a pavement. A walk *between* two rides is a change and stays, because leaving it out would
 * break the chain: leg *i*'s arrival and leg *i+1*'s departure have to name the same station.
 */
export function journeyLegs(
  connection: TransitConnection,
): ReadonlyArray<TransitLeg> {
  const legs = [...connection.legs]
  while (legs.length > 1 && legs[0].mode === 'walk') {
    legs.shift()
  }
  while (legs.length > 1 && legs[legs.length - 1].mode === 'walk') {
    legs.pop()
  }
  return legs
}

/** A catalogue row as a query endpoint, or `null` when it has no coordinates to search from. */
export function placeOf(stop: StationMatch | null): {
  readonly name: string
  readonly lat: number
  readonly lng: number
} | null {
  if (stop === null || stop.lat === null || stop.lng === null) {
    return null
  }
  return { name: stop.name, lat: stop.lat, lng: stop.lng }
}

/** One mode when every ride agrees, and `transit` when they do not. */
export function connectionMode(
  connection: TransitConnection,
): TransitConnection['modes'][number] {
  const ridden = [...new Set(connection.modes)]
  return ridden.length === 1 ? ridden[0] : 'transit'
}

interface ChainPayload {
  readonly stations: Array<{
    name: string
    code: string
    lat: number | null
    lng: number | null
    timezone: string
  }>
  readonly legs: Array<{
    serviceNumber: string
    platform: string
    seat: string
    departureDayId: string
    arrivalDayId: string
    departureDate: string
    departureTime: string
    arrivalDate: string
    arrivalTime: string
  }>
}

/**
 * A connection as the chain writer takes it: N stations and N−1 legs.
 *
 * The station two legs meet at is written once, from the arrival endpoint of the earlier one, so
 * the two rows cannot disagree about which station they name — the join guarantee
 * `replaceTransportChain` is built around, kept on this side of the wire too.
 *
 * The **zone** is set on the two outer stations only, and from the stops the traveller picked
 * rather than from the answer. A provider states an offset (`+01:00`), and an offset is not a zone:
 * it does not survive the Sunday the clocks change, so it cannot become the IANA name an endpoint
 * needs. The catalogue rows behind the two pickers do carry that name. The stations in between
 * carry none, which reads as "not stated" and is the truth.
 */
export function chainFor(
  connection: TransitConnection,
  origin: StationMatch | null,
  destination: StationMatch | null,
): ChainPayload {
  const legs = journeyLegs(connection)
  const stops = [legs[0].origin, ...legs.map((leg) => leg.destination)]
  return {
    stations: stops.map((stop, index) => ({
      name: stop.name === '' ? 'Stop' : stop.name,
      code: '',
      lat: stop.lat,
      lng: stop.lng,
      timezone:
        index === 0
          ? (origin?.timezone ?? '')
          : index === stops.length - 1
            ? (destination?.timezone ?? '')
            : '',
    })),
    legs: legs.map((leg) => ({
      serviceNumber: leg.name ?? '',
      platform: '',
      seat: '',
      // A timetable knows dates and clocks; it does not know which day of the trip they are, and
      // inventing that answer is how a journey lands on the wrong page of the plan.
      departureDayId: '',
      arrivalDayId: '',
      departureDate: dateOf(leg.origin.at),
      departureTime: timeOf(leg.origin.at),
      arrivalDate: dateOf(leg.destination.at),
      arrivalTime: timeOf(leg.destination.at),
    })),
  }
}

/* ------------------------------------------------------------- stop picking */

/** Below this a prefix matches most of the world, and the list is unreadable. */
const MIN_TERM = 2

/** Long enough that a fast typist makes one request per word, not per letter. */
const DEBOUNCE_MS = 200

/**
 * The catalogue behind one stop field.
 *
 * Rows with no coordinates are dropped rather than offered: they cannot be searched from, and an
 * option that silently does nothing when picked is worse than one that is not there.
 */
function useStopPicker(): {
  readonly options: Array<ComboboxOption>
  readonly loading: boolean
  onSearchChange: (query: string) => void
  matchFor: (code: string) => StationMatch | undefined
} {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<ReadonlyArray<StationMatch>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = query.trim()
    if (term.length < MIN_TERM) {
      setMatches([])
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    const timer = setTimeout(() => {
      void searchStationsFn({ data: { term } })
        .then((rows) => {
          if (live) {
            setMatches(
              rows.filter((row) => row.lat !== null && row.lng !== null),
            )
          }
        })
        .catch(() => {
          if (live) setMatches([])
        })
        .finally(() => {
          if (live) setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query])

  const options = useMemo<Array<ComboboxOption>>(
    () =>
      matches.map((match) => ({
        value: match.code,
        label: `${match.code} · ${match.name}`,
        description: [match.city, match.countryCode].filter(Boolean).join(', '),
      })),
    [matches],
  )

  return {
    options,
    loading,
    onSearchChange: setQuery,
    matchFor: (code) => matches.find((match) => match.code === code),
  }
}

function StopField({
  label,
  hint,
  stop,
  onPick,
}: {
  label: string
  hint?: string
  stop: StationMatch | null
  onPick: (stop: StationMatch | null) => void
}) {
  const picker = useStopPicker()
  return (
    <Field label={label} hint={stop === null ? hint : stop.name}>
      <Combobox
        value={stop?.code ?? null}
        options={
          stop === null
            ? picker.options
            : [
                {
                  value: stop.code,
                  label: `${stop.code} · ${stop.name}`,
                  description: [stop.city, stop.countryCode]
                    .filter(Boolean)
                    .join(', '),
                },
                ...picker.options.filter((row) => row.value !== stop.code),
              ]
        }
        manualFiltering
        clearable
        loading={picker.loading}
        onSearchChange={picker.onSearchChange}
        onChange={(value) =>
          onPick(value === null ? null : (picker.matchFor(value) ?? stop))
        }
        ariaLabel={label}
        placeholder="Find a stop"
        searchPlaceholder="LIS, Santa Apolónia, Lisboa…"
        emptyMessage="No stop with that name in the catalogue."
      />
    </Field>
  )
}

/* -------------------------------------------------------------- one result */

function StopLine({ name, at }: { name: string; at: string | null }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="w-12 shrink-0 text-caption font-semibold tabular-nums text-ink">
        {clockOf(at)}
      </span>
      <span className="min-w-0 truncate text-caption text-ink-2">{name}</span>
    </div>
  )
}

function ConnectionRow({
  connection,
  expanded,
  saving,
  onToggle,
  onSave,
}: {
  connection: TransitConnection
  expanded: boolean
  saving: boolean
  onToggle: () => void
  onSave: () => void
}) {
  const detailId = useId()
  const legs = journeyLegs(connection)
  const tooLong = legs.length > CHAIN_MAX_LEGS
  const Icon = modeIcon(connectionMode(connection))

  return (
    <li
      data-part="connection-result"
      className="min-w-0 rounded-lg border border-edge bg-surface"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Icon aria-hidden className="size-4 shrink-0 text-ink-3" />
        <p className="min-w-0 text-body font-semibold tabular-nums text-ink">
          {clockOf(connection.departureAt)}
          <ArrowRight
            aria-hidden
            className="mx-1.5 inline size-3.5 text-ink-4"
          />
          {clockOf(connection.arrivalAt)}
        </p>
        <p className="text-caption tabular-nums text-ink-3">
          {formatGap(connection.durationMinutes)} ·{' '}
          {connection.changes === 0
            ? 'direct'
            : `${connection.changes} change${connection.changes === 1 ? '' : 's'}`}
        </p>
        {connection.fare === null ? null : (
          <p className="text-caption font-semibold tabular-nums text-ink-2">
            {formatMoney(connection.fare.amountMinor, connection.fare.currency)}
          </p>
        )}
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            data-part="connection-expand"
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-sm text-caption font-semibold text-ink-3 focus-ring hover:text-ink"
          >
            {expanded ? 'Hide the stops' : 'See the stops'}
            <ChevronDown
              aria-hidden
              className={cn(
                'size-3.5 transition-transform duration-base ease-out-quint',
                expanded && 'rotate-180',
              )}
            />
          </button>
          <Button
            type="button"
            data-part="connection-save"
            variant="secondary"
            size="sm"
            shape="pill"
            disabled={tooLong}
            loading={saving}
            loadingLabel="Saving the connection"
            onClick={onSave}
          >
            Use this one
          </Button>
        </div>
      </div>

      {expanded ? (
        <div
          id={detailId}
          className="animate-rise border-t border-edge px-4 py-3"
        >
          <ol className="flex flex-col gap-3">
            {legs.map((leg, index) => (
              <li key={`${leg.origin.name}-${index}`} className="min-w-0">
                <StopLine name={leg.origin.name} at={leg.origin.at} />
                <div className="my-1 ms-6 border-s border-edge ps-3">
                  <p className="text-micro font-semibold tracking-label text-ink-3 uppercase">
                    {leg.name ?? (leg.mode === 'walk' ? 'On foot' : 'Service')}
                    {leg.headsign === null ? '' : ` → ${leg.headsign}`}
                  </p>
                  {leg.intermediateStops.map((stop, at) => (
                    <p
                      key={`${stop.name}-${at}`}
                      className="text-caption text-ink-4"
                    >
                      {stop.name}
                    </p>
                  ))}
                </div>
                {index === legs.length - 1 ? (
                  <StopLine
                    name={leg.destination.name}
                    at={leg.destination.at}
                  />
                ) : null}
              </li>
            ))}
          </ol>
          {tooLong ? (
            <p className="mt-3 text-caption text-danger">
              This connection has more than {CHAIN_MAX_LEGS} legs, which is more
              than one journey record holds. Search a shorter hop and record the
              rest separately.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/* -------------------------------------------------------------- the surface */

export interface ConnectionSearchProps {
  tripId: string
  /** The journey whose route is being replaced. Absent when this saves a new one. */
  transportId?: string
  /** The trip's days, in order — the date field is bounded by the first and the last. */
  days: ReadonlyArray<TransportDayData>
  /** Called once a connection has been written, so the dialog can close. */
  onSaved: () => void
}

export function ConnectionSearch({
  tripId,
  transportId,
  days,
  onSaved,
}: ConnectionSearchProps) {
  const dated = useMemo(
    () => days.filter((day) => day.date !== null).map((day) => day.date ?? ''),
    [days],
  )
  const [origin, setOrigin] = useState<StationMatch | null>(null)
  const [destination, setDestination] = useState<StationMatch | null>(null)
  const [date, setDate] = useState(() => dated[0] ?? '')
  const [modes, setModes] = useState<ReadonlyArray<TransitMode>>([])
  const [ranking, setRanking] = useState<Ranking>('earliest')
  const [outcome, setOutcome] = useState<ConnectionSearchOutcome | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const search = useAction(searchConnectionsFn, {
    invalidate: false,
    failure: 'The search did not run',
    fallback: 'Try again in a moment.',
  })
  const save = useAction(saveSearchedConnectionFn, {
    success: transportId === undefined ? 'Connection saved' : 'Route replaced',
    description:
      transportId === undefined
        ? 'It is in the travel order now.'
        : 'The booking code and the seat are untouched.',
    failure: 'The connection was not saved',
  })

  /**
   * A picked stop as the query wants it, or `null`.
   *
   * The picker already drops catalogue rows with no coordinates, so this second check is belt and
   * braces rather than a real branch — but the alternative is a `?? 0` on a latitude, which is a
   * search of the Gulf of Guinea reported as a search of Lisbon.
   */
  const from = placeOf(origin)
  const to = placeOf(destination)
  const ready = from !== null && to !== null && date !== ''
  const results = useMemo(
    () =>
      outcome !== null && outcome.ok
        ? rankConnections(outcome.connections, ranking)
        : [],
    [outcome, ranking],
  )

  function toggleMode(mode: TransitMode): void {
    setModes((current) =>
      current.includes(mode)
        ? current.filter((value) => value !== mode)
        : [...current, mode],
    )
  }

  async function run(): Promise<void> {
    if (from === null || to === null || date === '') {
      return
    }
    setExpanded(null)
    setOutcome(
      await search.run({
        data: {
          tripId,
          origin: from,
          destination: to,
          date,
          modes: [...modes],
        },
      }),
    )
  }

  async function choose(connection: TransitConnection): Promise<void> {
    const chain = chainFor(connection, origin, destination)
    const saved = await save.run({
      data: {
        tripId,
        transportId: transportId ?? '',
        mode: connectionMode(connection),
        title:
          `${chain.stations[0].name} to ${chain.stations[chain.stations.length - 1].name}`.slice(
            0,
            160,
          ),
        priceMinor: connection.fare?.amountMinor ?? 0,
        currency: connection.fare?.currency ?? '',
        stations: chain.stations,
        legs: chain.legs,
      },
    })
    if (saved !== null) {
      onSaved()
    }
  }

  return (
    <div data-part="connection-search" className="flex min-w-0 flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
        <StopField
          label="From"
          hint="Pick a stop — a timetable is asked where, not what it is called."
          stop={origin}
          onPick={setOrigin}
        />
        <div className="hidden self-center pt-8 sm:block">
          <ArrowRight aria-hidden className="size-5 text-ink-4" />
        </div>
        <StopField
          label="To"
          hint="Pick a stop from the catalogue."
          stop={destination}
          onPick={setDestination}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <Field label="Date">
          <Input
            type="date"
            value={date}
            min={dated.at(0)}
            max={dated.at(-1)}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-label font-medium text-ink">
            Only these modes
          </legend>
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {MODE_FILTERS.map((filter) => {
              const active = modes.includes(filter.value)
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleMode(filter.value)}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-caption font-semibold whitespace-nowrap focus-ring',
                    'transition-[background-color,border-color,color] duration-base ease-out-quint',
                    active
                      ? 'border-transparent bg-accent text-accent-on'
                      : 'border-edge bg-surface text-ink-2 hover:border-edge-strong hover:text-ink',
                  )}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          data-part="connection-search-run"
          variant="primary"
          shape="pill"
          disabled={!ready}
          loading={search.pending}
          loadingLabel="Searching the timetable"
          onClick={() => void run()}
        >
          <Search aria-hidden strokeWidth={2.5} />
          Search connections
        </Button>
        {results.length === 0 ? null : (
          <div className="flex items-center gap-2">
            {RANKINGS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={ranking === option.value}
                onClick={() => setRanking(option.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-caption font-semibold focus-ring',
                  'transition-[background-color,color] duration-base ease-out-quint',
                  ranking === option.value
                    ? 'bg-surface-2 text-ink'
                    : 'text-ink-3 hover:text-ink',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/*
        The list and everything that stands in for it share one region, and the skeleton is the
        same three rows at the same height the results occupy — so an answer landing changes what
        is in the box and never how tall it is.
      */}
      <div aria-busy={search.pending} className="min-w-0">
        {search.pending ? (
          <ul className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <li key={row}>
                <Skeleton radius="lg" className="h-[3.25rem] w-full" />
              </li>
            ))}
          </ul>
        ) : outcome === null ? (
          <p className="text-caption text-ink-3">
            Two stops and a date, and the timetable answers. Nothing is saved
            until you choose one.
          </p>
        ) : !outcome.ok ? (
          <Alert
            data-part="connection-refusal"
            tone={outcome.reason === 'ceiling' ? 'warning' : 'danger'}
            title={
              outcome.reason === 'ceiling'
                ? 'No searches left this month'
                : outcome.reason === 'unconfigured'
                  ? 'Connection search is off on this deployment'
                  : 'The timetable service did not answer'
            }
          >
            {outcome.message}
          </Alert>
        ) : results.length === 0 ? (
          <p data-part="connection-empty" className="text-caption text-ink-3">
            No connection was found between those two stops on that date. Try a
            neighbouring station, or widen the mode filter.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map((connection) => (
              <ConnectionRow
                key={connection.id}
                connection={connection}
                expanded={expanded === connection.id}
                saving={save.pending}
                onToggle={() =>
                  setExpanded((current) =>
                    current === connection.id ? null : connection.id,
                  )
                }
                onSave={() => void choose(connection)}
              />
            ))}
          </ul>
        )}
      </div>

      {search.error === null ? null : (
        <Alert tone="danger" title="The search did not run">
          {search.error}
        </Alert>
      )}

      {save.error === null ? null : (
        <Alert tone="danger" title="That did not save">
          {save.error}
        </Alert>
      )}
    </div>
  )
}
