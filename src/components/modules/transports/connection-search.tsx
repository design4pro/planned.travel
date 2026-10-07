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
import { MapCreditList } from '#/components/map/map-attribution'
import { cn } from '#/lib/cn'
import { HERE_CREDITS } from '#/lib/geo/credits'
import { formatNumber } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatMoney } from '#/lib/money'
import { CHAIN_MAX_LEGS } from '#/lib/transport-chain'
import {
  saveSearchedConnectionFn,
  searchConnectionsFn,
  searchStationsFn,
} from '#/server/fns/transports'
import { useAction } from '../shared'
import { formatGap } from './connections'
import { modeIcon } from './mode-icon'
import { MODE_LABELS } from './vocabulary'

import type { ComboboxOption } from '#/components/ui'
import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import type { ChainPayload } from './leg-form'
import type {
  ConnectionSearchOutcome,
  StationMatch,
  TransitConnection,
  TransitLeg,
  TransitMode,
} from '#/server/fns/transports'
import type { TransportDayData } from './types'

/**
 * The HERE credit as the map's credit list takes it.
 *
 * The list is the one implementation of "a credit link" (`MapCreditList`), so the connection search
 * discharges its obligation through it rather than through a second mechanism.
 */
const HERE_CREDIT_LINKS = HERE_CREDITS.map((credit) => ({
  label: credit.name,
  href: credit.url,
}))

/* ------------------------------------------------------------------- filter */

/**
 * The modes a public-transport search may be filtered by.
 *
 * Restated rather than imported from `#/server/transit/search`, for the reason `leg-form.ts`
 * restates the twelve transport modes: importing the value would pull the proxy, its validators
 * and the database schema behind it into the browser bundle to render five chips. The type comes
 * across from the server, so the two lists cannot drift apart without a type error.
 */
const MODE_FILTERS: ReadonlyArray<TransitMode> = [
  'train',
  'bus',
  'metro',
  'tram',
  'ferry',
]

/**
 * The clock a search starts from before the traveller moves it.
 *
 * Some hour has to be picked, and midnight is the one hour that cannot be right: the router
 * returns the five services after the instant it is given, so a midnight search is a search of the
 * night trains. Eight is the earliest hour a person plans an ordinary day around, which makes it
 * the choice that hides the fewest services - anything before it is still reachable by moving the
 * field back, and everything after it is in the window already.
 */
const DEFAULT_DEPARTURE_TIME = '08:00'

type Ranking = 'earliest' | 'fewest-changes'

const RANKINGS: ReadonlyArray<{
  readonly value: Ranking
  readonly label: MessageKey
}> = [
  { value: 'earliest', label: 'modules.transports.rank.earliest' },
  { value: 'fewest-changes', label: 'modules.transports.rank.fewestChanges' },
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

/**
 * The zone one station on the chain is read in, from the stops the traveller picked.
 *
 * The two ends and nowhere else, and never from the answer: a provider states an offset
 * (`+01:00`), and an offset is not a zone — it does not survive the Sunday the clocks change, so
 * it cannot become the IANA name an endpoint needs. The catalogue rows behind the two pickers do
 * carry that name. The stations in between carry none, which reads as "not stated" and is the
 * truth.
 */
function zoneAt(
  index: number,
  total: number,
  origin: StationMatch | null,
  destination: StationMatch | null,
): string {
  if (index === 0) {
    return origin?.timezone ?? ''
  }
  if (index === total - 1) {
    return destination?.timezone ?? ''
  }
  return ''
}

/**
 * A connection as the chain writer takes it: N stations and N−1 legs.
 *
 * The station two legs meet at is written once, from the arrival endpoint of the earlier one, so
 * the two rows cannot disagree about which station they name — the join guarantee
 * `saveTransport` is built around, kept on this side of the wire too.
 *
 * The zone is set on the two outer stations only — see {@link zoneAt}.
 *
 * The translator is a parameter because a stop the provider left unnamed still needs a name, and
 * the word standing in for it is the reader's, not the provider's.
 */
export function chainFor(
  connection: TransitConnection,
  origin: StationMatch | null,
  destination: StationMatch | null,
  t: Translate,
): ChainPayload {
  // There is always a first leg: a route the provider answered with no sections at all is dropped
  // before it becomes a connection (`connectionOf` in `src/server/transit/here.ts`), and
  // `journeyLegs` never returns fewer legs than it was given one of.
  const legs = journeyLegs(connection)
  const stops = [legs[0].origin, ...legs.map((leg) => leg.destination)]
  return {
    stations: stops.map((stop, index) => ({
      name:
        stop.name === '' ? t('modules.transports.chain.stopLabel') : stop.name,
      code: '',
      lat: stop.lat,
      lng: stop.lng,
      timezone: zoneAt(index, stops.length, origin, destination),
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
  const t = useTranslate()
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
        placeholder={t('modules.transports.connection.findStop')}
        searchPlaceholder={t('modules.transports.connection.findStopSearch')}
        emptyMessage={t('modules.transports.connection.findStopEmpty')}
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
  const t = useTranslate()
  const locale = useLocale()
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
            ? t('modules.transports.connection.direct')
            : t('modules.transports.connection.changes', {
                count: connection.changes,
                changes: formatNumber(connection.changes, locale),
              })}
        </p>
        {connection.fare === null ? null : (
          <p className="text-caption font-semibold tabular-nums text-ink-2">
            {formatMoney(
              connection.fare.amountMinor,
              connection.fare.currency,
              locale,
            )}
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
            {expanded
              ? t('modules.transports.connection.hideStops')
              : t('modules.transports.connection.seeStops')}
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
            loadingLabel={t('modules.transports.connection.saving')}
            onClick={onSave}
          >
            {t('modules.transports.connection.use')}
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
                    {leg.name ??
                      t(
                        leg.mode === 'walk'
                          ? 'modules.transports.connection.onFoot'
                          : 'modules.transports.connection.service',
                      )}
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
              {t('modules.transports.connection.tooLong', {
                max: formatNumber(CHAIN_MAX_LEGS, locale),
              })}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/* ----------------------------------------------------------- what came back */

/** The half of an outcome that is a refusal, so the panel below can be typed by it. */
export type ConnectionRefusal = Extract<ConnectionSearchOutcome, { ok: false }>

/**
 * What a refusal is called on screen, and what it says underneath.
 *
 * One pair of words per state a reader can *act* on differently rather than one per reason: an
 * allowance that has to be bought and one that has to be waited out are two different answers,
 * while a provider unreachable, refusing or answering nonsense are one - try again, or write the
 * journey down by hand.
 *
 * Both halves are chosen here rather than carried on the wire. The errors behind these reasons
 * (`RateCeilingError`, `TransitProviderError`, `ProviderBlockedError`) hold an English sentence because that sentence is
 * for the log; rendering it would hand a reader in one of twenty-three languages the diagnostic,
 * and the parity gate would never see it because it is not a key. The reason and the ceiling are
 * facts, so they cross the wire; the words are the catalogue's.
 */
export function refusalTitle(outcome: ConnectionRefusal): MessageKey {
  switch (outcome.reason) {
    case 'ceiling':
      return outcome.ceiling === 0
        ? 'modules.transports.connection.refusal.plan'
        : 'modules.transports.connection.refusal.ceiling'
    case 'unconfigured':
      return 'modules.transports.connection.refusal.unconfigured'
    default:
      return 'modules.transports.connection.refusal.provider'
  }
}

export function refusalBody(
  outcome: ConnectionRefusal,
  t: Translate,
  locale: Locale,
): string {
  switch (outcome.reason) {
    case 'ceiling':
      return outcome.ceiling === 0
        ? t('modules.transports.connection.refusal.planBody')
        : t('modules.transports.connection.refusal.ceilingBody', {
            ceiling: formatNumber(outcome.ceiling, locale),
          })
    case 'unconfigured':
      return t('modules.transports.connection.refusal.unconfiguredBody')
    default:
      return t('modules.transports.connection.refusal.providerBody')
  }
}

/**
 * The one region the answer and everything standing in for it share.
 *
 * Five states, written as five returns rather than as one expression: the skeleton, the invitation
 * before anything was asked, a refusal, an answer with nothing in it, and the list. The skeleton is
 * the same three rows at the same height the results occupy, so an answer landing changes what is
 * in the box and never how tall it is.
 *
 * **The HERE credit belongs to the last state only.** It is owed where a routed answer is shown
 * (ADR 0019), and only the list shows one. It sits after the last row, inside the dialog's
 * scrolling body, so no footer or other control covers it. The skeleton reserves no line for it:
 * the list already grows past the skeleton's three rows when the answer has more, so one caption
 * line at the end of the scroll body is no new shift.
 */
export function SearchOutcome({
  pending,
  outcome,
  results,
  expanded,
  saving,
  onToggle,
  onSave,
}: {
  pending: boolean
  outcome: ConnectionSearchOutcome | null
  results: ReadonlyArray<TransitConnection>
  expanded: string | null
  saving: boolean
  onToggle: (id: string) => void
  onSave: (connection: TransitConnection) => void
}) {
  const t = useTranslate()
  const locale = useLocale()

  if (pending) {
    return (
      <ul className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <li key={row}>
            <Skeleton radius="lg" className="h-[3.25rem] w-full" />
          </li>
        ))}
      </ul>
    )
  }

  if (outcome === null) {
    return (
      <p className="text-caption text-ink-3">
        {t('modules.transports.connection.invitation')}
      </p>
    )
  }

  if (!outcome.ok) {
    return (
      <Alert
        data-part="connection-refusal"
        tone={outcome.reason === 'ceiling' ? 'warning' : 'danger'}
        title={t(refusalTitle(outcome))}
      >
        {refusalBody(outcome, t, locale)}
      </Alert>
    )
  }

  if (results.length === 0) {
    return (
      <p data-part="connection-empty" className="text-caption text-ink-3">
        {t('modules.transports.connection.empty')}
      </p>
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {results.map((connection) => (
          <ConnectionRow
            key={connection.id}
            connection={connection}
            expanded={expanded === connection.id}
            saving={saving}
            onToggle={() => onToggle(connection.id)}
            onSave={() => onSave(connection)}
          />
        ))}
      </ul>
      <p data-part="connection-credit" className="mt-3 text-caption text-ink-3">
        {t('modules.transports.connection.credit')}{' '}
        <MapCreditList credits={HERE_CREDIT_LINKS} />
      </p>
    </>
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
  const t = useTranslate()
  // `flatMap` rather than a filter and a `?? ''`: the fallback would be a branch no day can reach,
  // and an empty string here is the one value the date field must never be handed.
  const dated = useMemo(
    () => days.flatMap((day) => (day.date === null ? [] : [day.date])),
    [days],
  )
  const [origin, setOrigin] = useState<StationMatch | null>(null)
  const [destination, setDestination] = useState<StationMatch | null>(null)
  const [date, setDate] = useState(() => dated.at(0) ?? '')
  const [time, setTime] = useState(DEFAULT_DEPARTURE_TIME)
  const [modes, setModes] = useState<ReadonlyArray<TransitMode>>([])
  const [ranking, setRanking] = useState<Ranking>('earliest')
  const [outcome, setOutcome] = useState<ConnectionSearchOutcome | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const search = useAction(searchConnectionsFn, {
    invalidate: false,
    failure: t('modules.transports.connection.searchFailed'),
    fallback: t('modules.transports.connection.searchFailedBody'),
  })
  const save = useAction(saveSearchedConnectionFn, {
    success: t(
      transportId === undefined
        ? 'modules.transports.connection.saved'
        : 'modules.transports.connection.replaced',
    ),
    description: t(
      transportId === undefined
        ? 'modules.transports.toast.addedBody'
        : 'modules.transports.connection.replacedBody',
    ),
    failure: t('modules.transports.connection.saveFailed'),
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
  const ready = from !== null && to !== null && date !== '' && time !== ''
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
          time,
          modes: [...modes],
        },
      }),
    )
  }

  async function choose(connection: TransitConnection): Promise<void> {
    const chain = chainFor(connection, origin, destination, t)
    const saved = await save.run({
      data: {
        tripId,
        transportId: transportId ?? '',
        mode: connectionMode(connection),
        title: t('modules.transports.connection.title', {
          from: chain.stations[0].name,
          to: chain.stations[chain.stations.length - 1].name,
        }).slice(0, 160),
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
          label={t('modules.transports.end.from')}
          hint={t('modules.transports.connection.fromHint')}
          stop={origin}
          onPick={setOrigin}
        />
        <div className="hidden self-center pt-8 sm:block">
          <ArrowRight aria-hidden className="size-5 text-ink-4" />
        </div>
        <StopField
          label={t('modules.transports.end.to')}
          hint={t('modules.transports.connection.toHint')}
          stop={destination}
          onPick={setDestination}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[12rem_8rem_minmax(0,1fr)]">
        <Field label={t('modules.transports.field.date')}>
          <Input
            type="date"
            value={date}
            min={dated.at(0)}
            max={dated.at(-1)}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        {/*
          Not a refinement of the date but the other half of the question. The router answers with
          the services after an instant, five of them, so a search with no clock is a search of the
          night - see `transports.connection.fromHint` for the same point about the stops.
        */}
        <Field
          label={t('modules.transports.field.time')}
          hint={t('modules.transports.connection.timeHint')}
        >
          <Input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </Field>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-label font-medium text-ink">
            {t('modules.transports.connection.onlyModes')}
          </legend>
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {MODE_FILTERS.map((filter) => {
              const active = modes.includes(filter)
              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleMode(filter)}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-caption font-semibold whitespace-nowrap focus-ring',
                    'transition-[background-color,border-color,color] duration-base ease-out-quint',
                    active
                      ? 'border-transparent bg-accent text-accent-on'
                      : 'border-edge bg-surface text-ink-2 hover:border-edge-strong hover:text-ink',
                  )}
                >
                  {t(MODE_LABELS[filter])}
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
          loadingLabel={t('modules.transports.connection.searching')}
          onClick={() => void run()}
        >
          <Search aria-hidden strokeWidth={2.5} />
          {t('modules.transports.connection.search')}
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
                {t(option.label)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div aria-busy={search.pending} className="min-w-0">
        <SearchOutcome
          pending={search.pending}
          outcome={outcome}
          results={results}
          expanded={expanded}
          saving={save.pending}
          onToggle={(id) =>
            setExpanded((current) => (current === id ? null : id))
          }
          onSave={(connection) => void choose(connection)}
        />
      </div>

      {search.error === null ? null : (
        <Alert
          tone="danger"
          title={t('modules.transports.connection.searchFailed')}
        >
          {search.error}
        </Alert>
      )}

      {save.error === null ? null : (
        <Alert
          tone="danger"
          title={t('modules.transports.connection.saveError')}
        >
          {save.error}
        </Alert>
      )}
    </div>
  )
}
