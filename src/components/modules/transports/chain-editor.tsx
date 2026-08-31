/**
 * A journey with more than two stations, drawn as the chain it is.
 *
 * A long-distance rail journey is not a pair of endpoints — it is Shin-Osaka,
 * then Nagoya, then Tokyo, with a different train, platform and seat between
 * each pair. The editor is that shape literally: stations are the rail and legs
 * hang between them, the same vertical grammar the booking timeline already uses
 * for dates, so the two screens read as one product.
 *
 * Three things are worth knowing before reading the code.
 *
 * **The chain arithmetic is not this file's.** N stations and N−1 legs is
 * maintained by `splitLegAt` and `removeStationAt` in `leg-form.ts`, which are
 * pure and have their own tests. This file renders a chain and hands edits back
 * up; it never builds one by hand, so the invariant cannot be broken here.
 *
 * **Every time input says which clock it is on.** A time is stored exactly as it
 * is written at the place it applies to, so `14:05` out of Tokyo is `14:05` in
 * the database — and unreadable anywhere else without the zone beside it. The
 * zone therefore lives on the station, next to the times it governs, and the
 * resolved label (`14:05 · Asia/Tokyo (UTC+9)`) is printed under the field
 * rather than hidden in a settings panel.
 *
 * **The catalogue is a shortcut and never a gate.** Two ways in, and they behave
 * differently on purpose: picking a row from the type-ahead replaces the fields,
 * because that is an explicit choice, while typing a three-letter code and
 * leaving the field fills only the blanks around it, because that is a hint and
 * the traveller's own words outrank a cut of a public dataset taken months ago.
 * Either way the fields under it stay free text — a traveller may still record
 * an airport that opened last week, so an unknown code and an unreachable
 * catalogue both do nothing at all rather than refusing anything.
 *
 * **Motion, and the property it deliberately does not touch.** `DESIGN.md` rules
 * out animating layout-affecting properties, which is exactly what a reflex
 * implementation of "animate the chain's height as a row is inserted" would do.
 * An inserted row fades and rises on `transform` and `opacity` alone
 * (`animate-rise`, the design system's own entrance rather than a second one
 * four pixels different); the rows below take their new positions in the same
 * frame, so nothing layout-affecting is ever interpolated. The global
 * `prefers-reduced-motion` rule collapses it.
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, Plus, Trash2 } from 'lucide-react'

import {
  Alert,
  Combobox,
  Field,
  IconButton,
  Input,
  SimpleSelect,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { localClockLabel, timeZoneOptions } from '#/lib/timezones'
import { findStationFn, searchStationsFn } from '#/server/fns/transports'
import { NOT_SET, fromSelectValue, toSelectValue } from '../shared'
import { formatGap } from './connections'
import {
  CHAIN_MAX_LEGS,
  applyStationMatch,
  dayLabel,
  endpointLabels,
  fillStationFromCode,
  isLookupCode,
  removeStationAt,
  splitLegAt,
  stationLabel,
  usesCodes,
  usesSeat,
  usesService,
} from './leg-form'
import { legDurationMinutes } from './leg-timing'

import type { ComboboxOption } from '#/components/ui'
import type { StationMatch } from '#/server/fns/transports'
import type {
  ChainDraft,
  ChainErrors,
  ChainLegDraft,
  ChainLegErrors,
  StationDraft,
  StationErrors,
} from './leg-form'
import type { TransportDayData } from './types'

/* ------------------------------------------------------------------- zones */

/**
 * The zone rows, built once for the module rather than once per station.
 *
 * The offset each row shows is computed against a reference instant rather than
 * against the leg's own date, and that is a deliberate simplification of what
 * `timeZoneOptions` can do: the list is how a traveller *finds* Asia/Tokyo, and
 * rebuilding 418 rows on every keystroke in a date field to move one of them
 * between `UTC+1` and `UTC+2` is a cost paid on every render for a number nobody
 * is reading in that moment. The label that has to be right — the one under the
 * time input, beside the time it governs — is computed against the real date.
 *
 * Copied row by row rather than handed over as they come: `TimeZoneOption` is
 * read-only and `ComboboxOption` is not, and a spread is the honest way across
 * that boundary where a cast would only silence it.
 */
const ZONE_OPTIONS: Array<ComboboxOption> = timeZoneOptions(null).map(
  (zone) => ({ ...zone }),
)

/* ------------------------------------------------------------- the catalogue */

/** Below this a prefix matches most of the world, and the list is unreadable. */
const MIN_TERM = 2

/** Long enough that a fast typist makes one request per word, not per letter. */
const DEBOUNCE_MS = 200

/**
 * The catalogue lookup behind one station row.
 *
 * A failed search resolves to *no matches* rather than to an error: the picker
 * is a shortcut over free text, so "the catalogue is unreachable" and "the
 * catalogue does not know this" have to look the same to the traveller — they
 * type the code themselves either way. The stale guard is what stops a slow
 * answer for `LH` overwriting a fast one for `LHR`.
 */
function useStationSearch(): {
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
          if (live) setMatches(rows)
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

/* ------------------------------------------------------------------ station */

/**
 * What a station is called above its fields: the two ends take the mode's own
 * words, and everything between them is a change, numbered from the first.
 */
function stationHeading(mode: string, index: number, total: number): string {
  if (index === 0) {
    return endpointLabels(mode).from
  }
  if (index === total - 1) {
    return endpointLabels(mode).to
  }
  return `Change ${index}`
}

function StationRow({
  station,
  index,
  total,
  mode,
  errors,
  onChange,
  onRemove,
}: {
  station: StationDraft
  index: number
  total: number
  mode: string
  errors: StationErrors | undefined
  onChange: (next: StationDraft) => void
  onRemove: () => void
}) {
  const search = useStationSearch()
  const label = stationLabel(station, index)

  /** A row the traveller picked: an explicit choice, so it replaces the fields. */
  function pick(code: string | null): void {
    const match = code === null ? undefined : search.matchFor(code)
    if (match !== undefined) {
      onChange(applyStationMatch(station, match))
    }
  }

  /**
   * A code the traveller typed, resolved when they leave the field.
   *
   * On blur rather than on every keystroke, because this is the field somebody
   * types a code into deliberately and `NR` on the way to `NRT` is not a
   * question worth asking. A code the catalogue does not know, or a catalogue
   * that cannot be reached, both do nothing at all: the fields are free text and
   * stay exactly as typed, which is what keeps the lookup a shortcut rather than
   * a gate in front of recording an airport that opened last week.
   */
  async function resolveTypedCode(): Promise<void> {
    const code = station.code.trim()
    if (!isLookupCode(code)) {
      return
    }
    const match = await findStationFn({ data: { code } }).catch(() => null)
    if (match !== null) {
      onChange(fillStationFromCode(station, match))
    }
  }

  return (
    <div className="grid min-w-0 animate-rise grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-2">
      <span aria-hidden className="mt-3 grid size-6 place-items-center">
        <span className="size-2.5 rounded-full bg-brand ring-4 ring-surface" />
      </span>

      <div className="flex min-w-0 flex-col gap-2 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-micro font-semibold tracking-label text-ink-3 uppercase">
            {stationHeading(mode, index, total)}
          </p>
          {total > 2 ? (
            <IconButton
              size="xs"
              variant="ghost"
              icon={<Trash2 aria-hidden />}
              label={`Remove ${label}`}
              onClick={onRemove}
            />
          ) : null}
        </div>

        {usesCodes(mode) ? (
          <Combobox
            value={null}
            options={search.options}
            manualFiltering
            loading={search.loading}
            onSearchChange={search.onSearchChange}
            onChange={pick}
            size="sm"
            ariaLabel={`Find an airport or station for ${label}`}
            placeholder="Find an airport or station"
            searchPlaceholder="LHR, Heathrow, London…"
            emptyMessage="No match — type the stop in yourself below."
          />
        ) : null}

        <div
          className={cn(
            'grid min-w-0 gap-2',
            usesCodes(mode)
              ? 'sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,12rem)]'
              : 'sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]',
          )}
        >
          <Field label="Stop" error={errors?.name}>
            <Input
              size="sm"
              value={station.name}
              onChange={(event) =>
                onChange({ ...station, name: event.target.value })
              }
              placeholder="Shin-Osaka"
              maxLength={200}
              autoComplete="off"
            />
          </Field>
          {usesCodes(mode) ? (
            <Field label="Code" error={errors?.code}>
              <Input
                size="sm"
                value={station.code}
                onChange={(event) =>
                  onChange({
                    ...station,
                    code: event.target.value.toUpperCase(),
                  })
                }
                onBlur={() => void resolveTypedCode()}
                placeholder="OSA"
                maxLength={8}
                autoComplete="off"
                className="font-mono tracking-wide uppercase"
              />
            </Field>
          ) : null}
          <Field
            label="Time zone"
            error={errors?.timezone}
            hint={
              station.timezone === ''
                ? 'Which clock this stop is on'
                : undefined
            }
          >
            <Combobox
              size="sm"
              clearable
              value={station.timezone === '' ? null : station.timezone}
              options={ZONE_OPTIONS}
              onChange={(next) =>
                onChange({ ...station, timezone: next ?? '' })
              }
              ariaLabel={`Time zone at ${label}`}
              placeholder="Not stated"
              searchPlaceholder="Tokyo, Lisbon, UTC…"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- leg */

function LegRow({
  leg,
  index,
  from,
  to,
  mode,
  days,
  dayOptions,
  errors,
  canSplit,
  onChange,
  onSplit,
}: {
  leg: ChainLegDraft
  index: number
  from: StationDraft
  to: StationDraft
  mode: string
  days: ReadonlyArray<TransportDayData>
  dayOptions: Array<{ value: string; label: string }>
  errors: ChainLegErrors | undefined
  canSplit: boolean
  onChange: (next: ChainLegDraft) => void
  onSplit: () => void
}) {
  const labels = endpointLabels(mode)
  const duration = legDurationMinutes(leg)
  /*
   * Two zones is the case that stops being obvious: 09:00 Tokyo to 08:30 Seoul
   * is a ninety-minute flight, not a journey backwards in time. The wall clocks
   * are both true and neither is the elapsed time, so the elapsed time is said
   * out loud whenever the two ends are on different clocks.
   */
  const crossesZones =
    from.timezone !== '' && to.timezone !== '' && from.timezone !== to.timezone
  const departureClock = localClockLabel({
    time: leg.departureTime,
    timezone: from.timezone,
    date: leg.departureDate,
  })
  const arrivalClock = localClockLabel({
    time: leg.arrivalTime,
    timezone: to.timezone,
    date: leg.arrivalDate,
  })

  function set<TKey extends keyof ChainLegDraft>(
    key: TKey,
    value: ChainLegDraft[TKey],
  ): void {
    onChange({ ...leg, [key]: value })
  }

  return (
    <div className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] items-stretch gap-x-2">
      <span aria-hidden className="mx-auto w-px bg-edge" />

      <div className="flex min-w-0 animate-rise flex-col gap-3 rounded-lg border border-edge-faint bg-surface-2 p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-ink-2">
            <ArrowDown aria-hidden className="size-3.5 text-ink-4" />
            Leg {index + 1}
          </span>
          {duration === null ? null : (
            <span className="text-caption tabular-nums text-ink-3">
              {formatGap(duration)}
              {crossesZones ? ' across two clocks' : ''}
            </span>
          )}
          <span className="flex-1" />
          <IconButton
            size="xs"
            variant="subtle"
            icon={<Plus aria-hidden />}
            label={`Add a stop after ${stationLabel(from, index)}`}
            disabled={!canSplit}
            onClick={onSplit}
          />
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          {usesService(mode) ? (
            <Field label="Service">
              <Input
                size="sm"
                value={leg.serviceNumber}
                onChange={(event) => set('serviceNumber', event.target.value)}
                placeholder="Hikari 500"
                maxLength={200}
                autoComplete="off"
                className="font-mono tracking-wide uppercase"
              />
            </Field>
          ) : null}
          <Field label="Platform">
            <Input
              size="sm"
              value={leg.platform}
              onChange={(event) => set('platform', event.target.value)}
              placeholder="20"
              maxLength={200}
              autoComplete="off"
            />
          </Field>
          {usesSeat(mode) ? (
            <Field label="Seat">
              <Input
                size="sm"
                value={leg.seat}
                onChange={(event) => set('seat', event.target.value)}
                placeholder="7-11A"
                maxLength={200}
                autoComplete="off"
                className="font-mono tracking-wide uppercase"
              />
            </Field>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 text-micro font-semibold tracking-label text-ink-4 uppercase">
              Leaves {stationLabel(from, index)}
            </legend>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Date" error={errors?.departureDate}>
                <Input
                  size="sm"
                  type="date"
                  value={leg.departureDate}
                  onChange={(event) => set('departureDate', event.target.value)}
                />
              </Field>
              <Field label="Time" error={errors?.departureTime}>
                <Input
                  size="sm"
                  type="time"
                  className="w-28"
                  value={leg.departureTime}
                  onChange={(event) => set('departureTime', event.target.value)}
                />
              </Field>
            </div>
            {departureClock === null ? null : (
              <p className="text-caption tabular-nums text-ink-4">
                {departureClock}
              </p>
            )}
            {days.length === 0 ? null : (
              <Field label={labels.fromDay}>
                <SimpleSelect
                  size="sm"
                  options={dayOptions}
                  value={toSelectValue(leg.departureDayId)}
                  onValueChange={(next) =>
                    set('departureDayId', fromSelectValue(next))
                  }
                  ariaLabel={`${labels.fromDay} of leg ${index + 1}`}
                />
              </Field>
            )}
          </fieldset>

          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 text-micro font-semibold tracking-label text-ink-4 uppercase">
              Reaches {stationLabel(to, index + 1)}
            </legend>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Date" error={errors?.arrivalDate}>
                <Input
                  size="sm"
                  type="date"
                  min={leg.departureDate === '' ? undefined : leg.departureDate}
                  value={leg.arrivalDate}
                  onChange={(event) => set('arrivalDate', event.target.value)}
                />
              </Field>
              <Field label="Time" error={errors?.arrivalTime}>
                <Input
                  size="sm"
                  type="time"
                  className="w-28"
                  value={leg.arrivalTime}
                  onChange={(event) => set('arrivalTime', event.target.value)}
                />
              </Field>
            </div>
            {arrivalClock === null ? null : (
              <p className="text-caption tabular-nums text-ink-4">
                {arrivalClock}
              </p>
            )}
            {days.length === 0 ? null : (
              <Field label={labels.toDay} error={errors?.arrivalDayId}>
                <SimpleSelect
                  size="sm"
                  options={dayOptions}
                  value={toSelectValue(leg.arrivalDayId)}
                  onValueChange={(next) =>
                    set('arrivalDayId', fromSelectValue(next))
                  }
                  ariaLabel={`${labels.toDay} of leg ${index + 1}`}
                />
              </Field>
            )}
          </fieldset>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- editor */

export interface ChainEditorProps {
  readonly chain: ChainDraft
  readonly mode: string
  readonly days: ReadonlyArray<TransportDayData>
  readonly errors: ChainErrors
  /** Errors are shown once the traveller has tried to save, never before. */
  readonly showErrors: boolean
  readonly onChange: (next: ChainDraft) => void
}

export function ChainEditor({
  chain,
  mode,
  days,
  errors,
  showErrors,
  onChange,
}: ChainEditorProps) {
  const dayOptions = useMemo(
    () => [
      { value: NOT_SET, label: 'No day yet' },
      ...days.map((day) => ({ value: day.id, label: dayLabel(day) })),
    ],
    [days],
  )
  const atCap = chain.legs.length >= CHAIN_MAX_LEGS

  function setStation(index: number, next: StationDraft): void {
    onChange({
      ...chain,
      stations: chain.stations.map((station, at) =>
        at === index ? next : station,
      ),
    })
  }

  function setLeg(index: number, next: ChainLegDraft): void {
    onChange({
      ...chain,
      legs: chain.legs.map((leg, at) => (at === index ? next : leg)),
    })
  }

  return (
    <div data-part="chain-editor" className="flex min-w-0 flex-col gap-1">
      {errors.form === undefined || !showErrors ? null : (
        <Alert tone="danger" title="This chain cannot be saved">
          {errors.form}
        </Alert>
      )}

      {chain.stations.map((station, index) => (
        <div key={station.key} className="flex min-w-0 flex-col gap-1">
          <StationRow
            station={station}
            index={index}
            total={chain.stations.length}
            mode={mode}
            errors={showErrors ? errors.stations?.[index] : undefined}
            onChange={(next) => setStation(index, next)}
            onRemove={() => onChange(removeStationAt(chain, index))}
          />
          {index < chain.legs.length ? (
            <LegRow
              key={chain.legs[index].key}
              leg={chain.legs[index]}
              index={index}
              from={station}
              to={chain.stations[index + 1]}
              mode={mode}
              days={days}
              dayOptions={dayOptions}
              errors={showErrors ? errors.legs?.[index] : undefined}
              canSplit={!atCap}
              onChange={(next) => setLeg(index, next)}
              onSplit={() => onChange(splitLegAt(chain, index))}
            />
          ) : null}
        </div>
      ))}

      <p className="ps-8 pt-1 text-caption text-ink-4">
        {atCap
          ? `A chain holds at most ${CHAIN_MAX_LEGS} legs — that is a limit on what one save can carry, not on how many changes a journey may have.`
          : 'Add a stop on any leg to record a change of train, and each leg keeps its own service number, platform and seat.'}
      </p>
    </div>
  )
}
