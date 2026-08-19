/**
 * The transports screen, laid out as a journey rather than a list.
 *
 * Legs are shown in departure order with the *hand-over between* them drawn as a
 * junction on the rail: how long there is, whether that is enough for the mode
 * being caught, and whether the two ends even name the same place. A leg that
 * cannot be caught after the one before it is a real, named warning — not a
 * silently wrong plan.
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
import { deleteLegFn, setLegStatusFn } from '#/server/fns/transports'
import {
  ConfirmDialog,
  CopyValue,
  FactList,
  FactNote,
  FilterRow,
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
import type { LegData } from './types'

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

const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

function formatDay(date: string | null): string | null {
  if (date === null || date.length < 10) {
    return null
  }
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? date : weekdayFormatter.format(parsed)
}

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

export interface LegsTimelineProps {
  readonly tripId: string
  readonly legs: ReadonlyArray<LegData>
  readonly currency: string
  readonly newLegOpen: boolean
  readonly onNewLegOpenChange: (open: boolean) => void
}

type ModeFilter = 'all' | string

export function LegsTimeline({
  tripId,
  legs,
  currency,
  newLegOpen,
  onNewLegOpenChange,
}: LegsTimelineProps) {
  const [filter, setFilter] = useState<ModeFilter>('all')
  const [editing, setEditing] = useState<LegData | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const statuses = useOptimistic<TransportStatus>()

  const setStatus = useAction(setLegStatusFn, {
    failure: 'The status did not change',
    fallback: 'The leg is still in its previous state.',
  })
  const remove = useAction(deleteLegFn, {
    success: 'Leg removed',
    failure: 'The leg was not removed',
    onSuccess: () => setConfirm(null),
  })

  const rendered = useMemo<Array<LegData>>(
    () =>
      legs.map((leg) => {
        const claimed = statuses.get(leg.id)
        return claimed === undefined ? leg : { ...leg, status: claimed }
      }),
    [legs, statuses],
  )

  /**
   * Connections are analysed over *every* leg, not the filtered set: hiding the
   * ferry does not make the flight after it catchable, so the warnings must not
   * disappear with the filter.
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

  const modes = useMemo(() => {
    const tally = new Map<string, number>()
    for (const leg of rendered) {
      tally.set(leg.mode, (tally.get(leg.mode) ?? 0) + 1)
    }
    return [...tally.entries()].sort((left, right) => right[1] - left[1])
  }, [rendered])

  const ordered = useMemo(() => sortLegsByDeparture(rendered), [rendered])
  const visible = ordered.filter(
    (leg) => filter === 'all' || leg.mode === filter,
  )

  function changeStatus(leg: LegData, next: string): void {
    if (!isTransportStatus(next) || next === leg.status) {
      return
    }
    void statuses.claim([[leg.id, next]], () =>
      setStatus.run({ data: { tripId, transportId: leg.id, status: next } }),
    )
  }

  if (legs.length === 0) {
    return (
      <>
        <EmptyState
          variant="dashed"
          size="lg"
          tone="brand"
          icon={<PlaneTakeoff />}
          title="No travel legs yet"
          description="Flights, trains, ferries and the drive from the airport all live here, with their booking codes and seat numbers to hand on the day — and each hand-over checked against the one before it."
          action={
            <Button
              variant="primary"
              shape="pill"
              onClick={() => onNewLegOpenChange(true)}
            >
              Add the first leg
            </Button>
          }
        />
        <LegDialog
          tripId={tripId}
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
          A leg departs before the one before it arrives. The junctions below
          say which, and by how much.
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
            Every leg
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
          title="No legs of that kind"
          description="Every leg on this trip travels a different way. Switch back to “Every leg” to see them all."
          action={
            <Button
              variant="secondary"
              shape="pill"
              onClick={() => setFilter('all')}
            >
              Show every leg
            </Button>
          }
        />
      ) : (
        <ol className="flex min-w-0 flex-col gap-0">
          {visible.map((leg, index) => {
            const connection = byFromId.get(leg.id)
            const nextVisible =
              index + 1 < visible.length ? visible[index + 1] : null
            return (
              <li key={leg.id} className="min-w-0">
                <LegCard
                  leg={leg}
                  currency={currency}
                  onEdit={() => setEditing(leg)}
                  onStatus={(next) => changeStatus(leg, next)}
                  onDelete={() =>
                    setConfirm({
                      title: `Remove “${leg.title}”?`,
                      description:
                        'The leg comes off this trip for good, along with its booking reference and seat. If it is only cancelled, set its status to Cancelled instead.',
                      confirmLabel: 'Remove leg',
                      onConfirm: () =>
                        remove.run({ data: { tripId, transportId: leg.id } }),
                    })
                  }
                />
                {/* The junction is only drawn when the leg it describes is the one
                  actually shown next — a filter that hides the middle leg must not
                  claim the two remaining ones connect. */}
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
        leg={editing ?? undefined}
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

/** The hand-over between two legs, drawn on the rail between their cards. */
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

function LegCard({
  leg,
  currency,
  onEdit,
  onStatus,
  onDelete,
}: {
  leg: LegData
  currency: string
  onEdit: () => void
  onStatus: (next: string) => void
  onDelete: () => void
}) {
  const Icon = modeIcon(leg.mode)
  const cancelled = leg.status === 'cancelled'

  const facts: Array<FactItem> = [
    ...(leg.carrier === null && leg.serviceNumber === null
      ? []
      : [
          {
            label: 'Service',
            value: [leg.carrier, leg.serviceNumber].filter(Boolean).join(' '),
          },
        ]),
    ...(leg.bookingCode === null
      ? []
      : [
          {
            label: 'Booking reference',
            mono: true,
            value: (
              <CopyValue
                value={leg.bookingCode}
                label={`the booking reference for ${leg.title}`}
              />
            ),
          },
        ]),
    ...(leg.seat === null
      ? []
      : [{ label: 'Seat', mono: true, value: leg.seat }]),
    ...(leg.distanceMetres === null || leg.distanceMetres === 0
      ? []
      : [{ label: 'Distance', value: formatDistance(leg.distanceMetres) }]),
    ...(leg.priceMinor === null || leg.priceMinor === 0
      ? []
      : [
          {
            label: 'Price',
            value: formatMoney(leg.priceMinor, leg.currency ?? currency),
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
          {modeLabel(leg.mode)}
        </span>
        <h4
          className={cn(
            'min-w-0 flex-1 truncate text-label font-semibold text-ink',
            cancelled && 'line-through',
          )}
        >
          {leg.title}
        </h4>
        <StatusMenu
          current={statusOption(leg.status)}
          options={STATUS_OPTIONS}
          label={`Status of ${leg.title}`}
          onSelect={onStatus}
        />
        <RowMenu
          label={`Actions for ${leg.title}`}
          items={[
            {
              label: 'Edit leg…',
              icon: <Pencil aria-hidden />,
              onSelect: onEdit,
            },
            {
              label: 'Remove leg',
              icon: <Trash2 aria-hidden />,
              tone: 'danger',
              separated: true,
              onSelect: onDelete,
            },
          ]}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <Endpoint
            code={leg.departureCode}
            name={leg.departureName}
            date={leg.departureDate}
            time={leg.departureTime}
          />
          <ArrowRight
            aria-hidden
            className="mt-1.5 size-4 shrink-0 text-ink-4"
          />
          <Endpoint
            code={leg.arrivalCode}
            name={leg.arrivalName}
            date={leg.arrivalDate}
            time={leg.arrivalTime}
            align="right"
          />
        </div>

        {facts.length === 0 ? null : (
          <FactList items={facts} columns={facts.length > 3 ? 4 : 3} />
        )}

        {leg.notes === null ? null : (
          <FactNote label="Notes">{leg.notes}</FactNote>
        )}
      </div>
    </article>
  )
}

/**
 * One end of a leg.
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
  align = 'left',
}: {
  code: string | null
  name: string | null
  date: string | null
  time: string | null
  align?: 'left' | 'right'
}) {
  const day = formatDay(date)
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
      <p className="truncate text-caption tabular-nums text-ink-4">
        {when === '' ? 'No time yet' : when}
      </p>
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
