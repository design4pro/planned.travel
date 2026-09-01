/**
 * The transports screen, laid out as a journey rather than a list.
 *
 * Transports are shown in departure order with the *hand-over between* them drawn
 * as a junction on the rail: how long there is, whether that is enough for the
 * mode being caught, and whether the two ends even name the same place. A journey
 * that cannot be caught after the one before it is a real, named warning — not a
 * silently wrong plan.
 *
 * Each card says which day of the trip it belongs to, and says both when the
 * journey spans two — the overnight train that leaves on day 3 and lands on day 4
 * is the case the whole second reference exists for.
 *
 * A journey with more than two stations reads as the chain it is: the stations
 * down the rail with their own clocks, and the service number, platform and seat
 * of each leg between them. A journey with no legs recorded keeps the two-endpoint
 * row it has always had, which is the compatibility claim of `03-S2b` seen from
 * the reading side.
 *
 * Stored values are typeset as facts. A previous round of this screen presented
 * them as filled grey rounded rectangles, which reads as a form full of disabled
 * inputs; every value here is set in the card's own ink with a whisper-quiet label
 * over it, and the things that *are* controls — the status, the overflow menu —
 * look like controls.
 */
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  MapPinOff,
  Pencil,
  PlaneTakeoff,
  Trash2,
} from 'lucide-react'

import { Alert, Badge, Button, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatWeekday } from '#/lib/format'
import { timeZoneOffsetLabel } from '#/lib/timezones'
import { deleteLegFn, setLegStatusFn } from '#/server/fns/transports'
import {
  ConfirmDialog,
  FactList,
  FactNote,
  FilterRow,
  MaskedCode,
  RowMenu,
  StatusMenu,
  useAction,
  useOptimistic,
} from '../shared'
import {
  analyseConnections,
  sortLegsByDeparture,
  summariseConnections,
} from './connections'
import { LegDialog } from './leg-dialog'
import {
  STATUS_LABELS,
  TRANSPORT_STATUSES,
  isTransportStatus,
  modeLabel,
} from './leg-form'
import { modeIcon } from './mode-icon'

import type { ReactNode } from 'react'
import type { BadgeTone } from '#/components/ui'
import type { ConfirmRequest, FactItem, StatusOption } from '../shared'
import type { Connection } from './connections'
import type { TransportStatus } from './leg-form'
import type { TransportData, TransportDayData, TransportLegData } from './types'

/* ------------------------------------------------------------------- labels */

const STATUS_TONE: { readonly [K in TransportStatus]: BadgeTone } = {
  idea: 'neutral',
  pending: 'warning',
  confirmed: 'success',
  completed: 'outline',
  cancelled: 'danger',
}

const STATUS_OPTIONS: ReadonlyArray<StatusOption> = TRANSPORT_STATUSES.map(
  (value) => ({ value, label: STATUS_LABELS[value], tone: STATUS_TONE[value] }),
)

function statusOption(status: string): StatusOption {
  const known = isTransportStatus(status) ? status : 'idea'
  return { value: known, label: STATUS_LABELS[known], tone: STATUS_TONE[known] }
}

const LOCALE = 'en-GB'

function formatClock(time: string | null): string | null {
  return time === null || time.length < 4 ? null : time.slice(0, 5)
}

function formatMoney(minor: number, currency: string): string {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'EUR'
  const formatter = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
  })
  const digits = formatter.resolvedOptions().minimumFractionDigits ?? 2
  return formatter.format(minor / 10 ** digits)
}

function formatDistance(metres: number): string {
  return `${new Intl.NumberFormat(LOCALE).format(Math.round(metres / 1000))} km`
}

/* ------------------------------------------------------------------ screen */

export interface TransportsTimelineProps {
  readonly tripId: string
  readonly transports: ReadonlyArray<TransportData>
  /** The trip's days: what the two day selects offer, and what a day chip reads. */
  readonly days: ReadonlyArray<TransportDayData>
  readonly currency: string
  /**
   * The reader's own display preference, read by the route beside the transport
   * desk and handed down: a `components/modules` component never fetches and
   * never imports from `server/`, so the booking reference below obeys a switch
   * it is told about rather than one it goes looking for.
   *
   * Required rather than defaulted — a masking flag that can be forgotten at a
   * call site is a masking flag that leaks a code.
   */
  readonly maskCodes: boolean
  readonly newLegOpen: boolean
  readonly onNewLegOpenChange: (open: boolean) => void
}

type ModeFilter = 'all' | string

export function TransportsTimeline({
  tripId,
  transports,
  days,
  currency,
  maskCodes,
  newLegOpen,
  onNewLegOpenChange,
}: TransportsTimelineProps) {
  const [filter, setFilter] = useState<ModeFilter>('all')
  const [editing, setEditing] = useState<TransportData | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const statuses = useOptimistic<TransportStatus>()

  const setStatus = useAction(setLegStatusFn, {
    failure: 'The status did not change',
    fallback: 'The transport is still in its previous state.',
  })
  const remove = useAction(deleteLegFn, {
    success: 'Transport removed',
    failure: 'The transport was not removed',
    onSuccess: () => setConfirm(null),
  })

  const rendered = useMemo<Array<TransportData>>(
    () =>
      transports.map((transport) => {
        const claimed = statuses.get(transport.id)
        return claimed === undefined
          ? transport
          : { ...transport, status: claimed }
      }),
    [transports, statuses],
  )

  /**
   * Connections are analysed over *every* transport, not the filtered set:
   * hiding the ferry does not make the flight after it catchable, so the
   * warnings must not disappear with the filter.
   */
  const connections = useMemo(() => analyseConnections(rendered), [rendered])
  const summary = useMemo(
    () => summariseConnections(connections),
    [connections],
  )
  const byFromId = useMemo(
    () => new Map(connections.map((entry) => [entry.fromId, entry])),
    [connections],
  )

  /** Day id → the number a person refers to that day by. */
  const dayNumbers = useMemo(
    () => new Map(days.map((day) => [day.id, day.dayNumber])),
    [days],
  )

  /** The number behind a day reference, or `null` where the end names no day. */
  function dayNumberOf(dayId: string | null): number | null {
    return dayId === null ? null : (dayNumbers.get(dayId) ?? null)
  }

  const modes = useMemo(() => {
    const tally = new Map<string, number>()
    for (const transport of rendered) {
      tally.set(transport.mode, (tally.get(transport.mode) ?? 0) + 1)
    }
    return [...tally.entries()].sort((left, right) => right[1] - left[1])
  }, [rendered])

  const ordered = useMemo(() => sortLegsByDeparture(rendered), [rendered])
  const visible = ordered.filter(
    (transport) => filter === 'all' || transport.mode === filter,
  )

  function changeStatus(transport: TransportData, next: string): void {
    if (!isTransportStatus(next) || next === transport.status) {
      return
    }
    void statuses.claim([[transport.id, next]], () =>
      setStatus.run({
        data: { tripId, transportId: transport.id, status: next },
      }),
    )
  }

  if (transports.length === 0) {
    return (
      <>
        <EmptyState
          variant="dashed"
          size="lg"
          tone="brand"
          icon={<PlaneTakeoff />}
          title="No transports yet"
          description="Add the flight, the train or the hire car and the days it covers — with the booking code and the seat to hand on the day, and each hand-over checked against the one before it."
          action={
            <Button
              variant="primary"
              shape="pill"
              onClick={() => onNewLegOpenChange(true)}
            >
              Add the first transport
            </Button>
          }
        />
        <LegDialog
          tripId={tripId}
          days={days}
          currency={currency}
          open={newLegOpen}
          onOpenChange={onNewLegOpenChange}
        />
      </>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {summary.impossible === 0 ? null : (
        <Alert
          tone="danger"
          title={
            summary.impossible === 1
              ? 'One hand-over cannot be made'
              : `${summary.impossible} hand-overs cannot be made`
          }
        >
          A transport departs before the one before it arrives. The junctions
          below say which, and by how much.
        </Alert>
      )}
      {summary.impossible === 0 && summary.tight > 0 ? (
        <Alert
          tone="warning"
          title={
            summary.tight === 1
              ? 'One connection is tight'
              : `${summary.tight} connections are tight`
          }
        >
          There is time, but not much of it for the mode you are catching. The
          junctions below show how long each one leaves you.
        </Alert>
      ) : null}

      {modes.length < 2 ? null : (
        <FilterRow>
          <ModeChip
            selected={filter === 'all'}
            count={rendered.length}
            onClick={() => setFilter('all')}
          >
            Every transport
          </ModeChip>
          {modes.map(([mode, count]) => {
            const Icon = modeIcon(mode)
            return (
              <ModeChip
                key={mode}
                selected={filter === mode}
                count={count}
                onClick={() => setFilter(mode)}
              >
                <Icon aria-hidden className="size-3.5" />
                {modeLabel(mode)}
              </ModeChip>
            )
          })}
        </FilterRow>
      )}

      {visible.length === 0 ? (
        <EmptyState
          variant="filled"
          size="md"
          icon={<PlaneTakeoff />}
          title="No transports of that kind"
          description="Every transport on this trip travels a different way. Switch back to “Every transport” to see them all."
          action={
            <Button
              variant="secondary"
              shape="pill"
              onClick={() => setFilter('all')}
            >
              Show every transport
            </Button>
          }
        />
      ) : (
        <ol className="flex min-w-0 flex-col gap-0">
          {visible.map((transport, index) => {
            const connection = byFromId.get(transport.id)
            const nextVisible =
              index + 1 < visible.length ? visible[index + 1] : null
            return (
              <li key={transport.id} className="min-w-0">
                <TransportCard
                  transport={transport}
                  currency={currency}
                  maskCodes={maskCodes}
                  departureDay={dayNumberOf(transport.departureDayId)}
                  arrivalDay={dayNumberOf(transport.arrivalDayId)}
                  onEdit={() => setEditing(transport)}
                  onStatus={(next) => changeStatus(transport, next)}
                  onDelete={() =>
                    setConfirm({
                      title: `Remove “${transport.title}”?`,
                      description:
                        'The transport comes off this trip for good, along with its booking reference and seat. If it is only cancelled, set its status to Cancelled instead.',
                      confirmLabel: 'Remove transport',
                      onConfirm: () =>
                        remove.run({
                          data: { tripId, transportId: transport.id },
                        }),
                    })
                  }
                />
                {/* The junction is only drawn when the transport it describes
                  is the one actually shown next — a filter that hides the middle
                  transport must not claim the two remaining ones connect. */}
                {connection !== undefined &&
                nextVisible !== null &&
                connection.toId === nextVisible.id ? (
                  <Junction connection={connection} />
                ) : index === visible.length - 1 ? null : (
                  <span aria-hidden className="ml-6 block h-4 w-px bg-edge" />
                )}
              </li>
            )
          })}
        </ol>
      )}

      <LegDialog
        tripId={tripId}
        transport={editing ?? undefined}
        days={days}
        currency={currency}
        open={newLegOpen || editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null)
            onNewLegOpenChange(false)
          }
        }}
      />

      <ConfirmDialog
        request={confirm}
        pending={remove.pending}
        onOpenChange={(next) => {
          if (!next) {
            setConfirm(null)
          }
        }}
      />
    </div>
  )
}

function ModeChip({
  selected,
  count,
  onClick,
  children,
}: {
  selected: boolean
  count: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-caption font-semibold whitespace-nowrap focus-ring',
        'transition-[background-color,border-color,color] duration-base ease-out-quint',
        selected
          ? 'border-transparent bg-accent text-accent-on'
          : 'border-edge bg-surface text-ink-2 hover:border-edge-strong hover:text-ink',
      )}
    >
      {children}
      <span
        className={cn(
          'rounded-full px-1.5 text-[0.6875rem] leading-4 tabular-nums',
          selected ? 'bg-current/15' : 'bg-surface-2 text-ink-4',
        )}
      >
        {count}
      </span>
    </button>
  )
}

/* --------------------------------------------------------------- junction */

/** The hand-over between two transports, drawn on the rail between their cards. */
function Junction({ connection }: { connection: Connection }) {
  const tone =
    connection.severity === 'impossible'
      ? {
          rail: 'bg-danger/40',
          chip: 'border-danger/30 bg-danger-soft text-danger',
          icon: AlertTriangle,
        }
      : connection.severity === 'tight'
        ? {
            rail: 'bg-warning/40',
            chip: 'border-warning/30 bg-warning-soft text-warning',
            icon: Clock,
          }
        : connection.severity === 'unknown'
          ? {
              rail: 'bg-edge',
              chip: 'border-edge bg-surface-2 text-ink-3',
              icon: Clock,
            }
          : {
              rail: 'bg-edge',
              chip: 'border-edge bg-surface-2 text-ink-3',
              icon: Clock,
            }
  const Icon =
    connection.placeMismatch && connection.severity === 'ok'
      ? MapPinOff
      : tone.icon

  return (
    <div className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] items-stretch">
      <span
        aria-hidden
        className={cn('mx-auto w-px', tone.rail)}
        style={{ minHeight: '2.5rem' }}
      />
      <div className="flex min-w-0 flex-col gap-1 py-3 pl-1">
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-semibold',
            tone.chip,
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {connection.headline}
        </span>
        {connection.detail === null ? null : (
          <p className="max-w-prose text-caption leading-relaxed text-ink-3">
            {connection.detail}
          </p>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- one card */

function TransportCard({
  transport,
  currency,
  maskCodes,
  departureDay,
  arrivalDay,
  onEdit,
  onStatus,
  onDelete,
}: {
  transport: TransportData
  currency: string
  /** Whether the booking reference below is kept off the screen until it is asked for. */
  maskCodes: boolean
  /** The day numbers this journey is anchored to, or `null` where it names none. */
  departureDay: number | null
  arrivalDay: number | null
  onEdit: () => void
  onStatus: (next: string) => void
  onDelete: () => void
}) {
  const Icon = modeIcon(transport.mode)
  const cancelled = transport.status === 'cancelled'

  const facts: Array<FactItem> = [
    ...(transport.carrier === null && transport.serviceNumber === null
      ? []
      : [
          {
            label: 'Service',
            value: [transport.carrier, transport.serviceNumber]
              .filter(Boolean)
              .join(' '),
          },
        ]),
    ...(transport.bookingCode === null
      ? []
      : [
          {
            label: 'Booking reference',
            mono: true,
            value: (
              <MaskedCode
                value={transport.bookingCode}
                label={`the booking reference for ${transport.title}`}
                masked={maskCodes}
              />
            ),
          },
        ]),
    ...(transport.seat === null
      ? []
      : [{ label: 'Seat', mono: true, value: transport.seat }]),
    ...(transport.distanceMetres === null || transport.distanceMetres === 0
      ? []
      : [
          {
            label: 'Distance',
            value: formatDistance(transport.distanceMetres),
          },
        ]),
    ...(transport.priceMinor === null || transport.priceMinor === 0
      ? []
      : [
          {
            label: 'Price',
            value: formatMoney(
              transport.priceMinor,
              transport.currency ?? currency,
            ),
          },
        ]),
  ]

  return (
    <article
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border border-edge-faint bg-surface shadow-card',
        'transition-[box-shadow,opacity] duration-slow ease-out-quint hover:shadow-elevated',
        cancelled && 'opacity-65',
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-edge-faint px-4 py-3 sm:px-5">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-caption font-medium text-ink-3">
          <Icon aria-hidden className="size-3.5" />
          {modeLabel(transport.mode)}
        </span>
        <h4
          className={cn(
            'min-w-0 flex-1 truncate text-label font-semibold text-ink',
            cancelled && 'line-through',
          )}
        >
          {transport.title}
        </h4>
        <StatusMenu
          current={statusOption(transport.status)}
          options={STATUS_OPTIONS}
          label={`Status of ${transport.title}`}
          onSelect={onStatus}
        />
        <RowMenu
          label={`Actions for ${transport.title}`}
          items={[
            {
              label: 'Edit transport…',
              icon: <Pencil aria-hidden />,
              onSelect: onEdit,
            },
            {
              label: 'Remove transport',
              icon: <Trash2 aria-hidden />,
              tone: 'danger',
              separated: true,
              onSelect: onDelete,
            },
          ]}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:px-5">
        {transport.legs.length > 1 ? (
          <Chain legs={transport.legs} />
        ) : (
          <div className="flex min-w-0 items-start gap-3">
            <Endpoint
              code={transport.departureCode}
              name={transport.departureName}
              date={transport.departureDate}
              time={transport.departureTime}
              dayNumber={departureDay}
            />
            <ArrowRight
              aria-hidden
              className="mt-1.5 size-4 shrink-0 text-ink-4"
            />
            <Endpoint
              code={transport.arrivalCode}
              name={transport.arrivalName}
              date={transport.arrivalDate}
              time={transport.arrivalTime}
              dayNumber={arrivalDay}
              align="right"
            />
          </div>
        )}

        {facts.length === 0 ? null : (
          <FactList items={facts} columns={facts.length > 3 ? 4 : 3} />
        )}

        {transport.notes === null ? null : (
          <FactNote label="Notes">{transport.notes}</FactNote>
        )}
      </div>
    </article>
  )
}

/* -------------------------------------------------------------- the chain */

/** One stop on the rail: its name or code, and the clock it is read on. */
function Stop({
  code,
  name,
  timezone,
  time,
  showZone,
}: {
  code: string | null
  name: string
  timezone: string | null
  time: string | null
  /** Only when the journey crosses zones; otherwise it is noise on every row. */
  showZone: boolean
}) {
  const clock = formatClock(time)
  const zone =
    showZone && timezone !== null && timezone !== ''
      ? timeZoneOffsetLabel(timezone)
      : null
  // A code leads and the name follows it; with no code the name leads alone.
  const coded = code !== null && code !== ''

  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-2">
      <p className="min-w-0 truncate text-label font-semibold text-ink">
        {coded ? code : name}
      </p>
      {coded ? (
        <p className="min-w-0 truncate text-caption text-ink-3">{name}</p>
      ) : null}
      <span className="flex-1" />
      <span className="shrink-0 text-caption tabular-nums text-ink-3">
        {clock ?? '—'}
        {zone === null ? null : <span className="ps-1 text-ink-4">{zone}</span>}
      </span>
    </div>
  )
}

/**
 * What is read between two stops: the ticket, or nothing worth a line.
 *
 * `null` rather than `''` so the caller decides what an unrecorded leg is
 * called, which is the only thing it can be called — its place in the chain.
 */
function ticketLine(leg: TransportLegData): string | null {
  const parts = [
    leg.serviceNumber,
    leg.platform === null ? null : `Platform ${leg.platform}`,
    leg.seat === null ? null : `Seat ${leg.seat}`,
  ].filter(Boolean)
  return parts.length === 0 ? null : parts.join(' · ')
}

/**
 * A journey with more than two stations, read as the chain it is.
 *
 * The stations are the rail and the ticket facts hang between them, which is the
 * same grammar the editor uses — so what a traveller typed and what they read
 * back are the same shape. The zone is printed beside a clock **only when the
 * journey crosses one**: on a chain that stays inside Japan it says nothing, and
 * on one that leaves it, it is the difference between a ninety-minute flight and
 * an apparent journey backwards in time.
 */
function Chain({ legs }: { legs: ReadonlyArray<TransportLegData> }) {
  const ordered = [...legs].sort(
    (left, right) => left.position - right.position,
  )
  const first = ordered.at(0)
  if (first === undefined) {
    // Its one caller renders the flat endpoints instead; said here too so the
    // component answers for itself rather than for what happens to call it.
    return null
  }
  const zones = new Set(
    ordered
      .flatMap((leg) => [leg.fromTimezone, leg.toTimezone])
      .filter((zone): zone is string => zone !== null && zone !== ''),
  )
  const showZone = zones.size > 1

  return (
    <ol data-part="chain" className="flex min-w-0 flex-col">
      <li className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 size-2 shrink-0 rounded-full bg-brand"
        />
        <Stop
          code={first.fromCode}
          name={first.fromName}
          timezone={first.fromTimezone}
          time={first.departureTime}
          showZone={showZone}
        />
      </li>
      {ordered.map((leg, index) => (
        <li key={leg.id} className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-stretch gap-3">
            <span
              aria-hidden
              className="ms-[0.1875rem] w-px shrink-0 bg-edge"
            />
            <p className="min-w-0 truncate py-1 text-caption text-ink-4">
              {ticketLine(leg) ?? `Leg ${index + 1}`}
            </p>
          </div>
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className={cn(
                'mt-1.5 size-2 shrink-0 rounded-full',
                index === ordered.length - 1 ? 'bg-brand' : 'bg-edge-strong',
              )}
            />
            <Stop
              code={leg.toCode}
              name={leg.toName}
              timezone={leg.toTimezone}
              time={leg.arrivalTime}
              showZone={showZone}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * One end of a transport.
 *
 * Both ends are identifiers a traveller reads back at a desk, so both are set in
 * the UI face rather than the rounded display face: at this size the display face
 * turns G into Q, and "LGW" must never look like "LQW". Only a code takes the wide
 * tracking.
 */
function Endpoint({
  code,
  name,
  date,
  time,
  dayNumber,
  align = 'left',
}: {
  code: string | null
  name: string | null
  date: string | null
  time: string | null
  /** The trip day this end is anchored to, or `null` when it names none. */
  dayNumber: number | null
  align?: 'left' | 'right'
}) {
  /*
   * `2026-06-23` → `Tue 23 Jun`, from the shared CLDR table rather than from a
   * module-local `Intl.DateTimeFormat`. `12-verification-protocol.md` §7.2 defers
   * seven abbreviated-month call sites that ask the platform for
   * `month: 'short'`, which workerd and WebKit resolve from different ICU builds
   * — latent until a trip tab is baselined, which this area is the first to do.
   * `src/lib/format.ts` already answers from a table, so this file asks it
   * instead of asking the runtime.
   */
  const day = formatWeekday(date)
  const clock = formatClock(time)
  const when = [day, clock].filter((part) => part !== null).join(' · ')

  return (
    <div className={cn('min-w-0 flex-1', align === 'right' && 'text-right')}>
      <p
        className={cn(
          'truncate text-subtitle font-bold text-ink',
          code === null
            ? 'tracking-tight'
            : 'font-mono tracking-wide uppercase',
        )}
      >
        {code ?? name ?? 'Not set'}
      </p>
      {code === null || name === null ? null : (
        <p className="truncate text-caption text-ink-3">{name}</p>
      )}
      <div
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1',
          align === 'right' && 'justify-end',
        )}
      >
        <span className="truncate text-caption tabular-nums text-ink-4">
          {when === '' ? 'No time yet' : when}
        </span>
        {dayNumber === null ? null : (
          <span
            data-part="day-chip"
            className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[0.6875rem] leading-4 font-semibold tabular-nums text-ink-3"
          >
            Day {dayNumber}
          </span>
        )}
      </div>
    </div>
  )
}

/** A summary badge for the module header. */
export function ConnectionsBadge({
  impossible,
  tight,
}: {
  impossible: number
  tight: number
}) {
  if (impossible > 0) {
    return (
      <Badge tone="danger" dot size="lg">
        {impossible} broken hand-over{impossible === 1 ? '' : 's'}
      </Badge>
    )
  }
  if (tight > 0) {
    return (
      <Badge tone="warning" dot size="lg">
        {tight} tight connection{tight === 1 ? '' : 's'}
      </Badge>
    )
  }
  return (
    <Badge tone="success" dot size="lg">
      Every hand-over works
    </Badge>
  )
}
