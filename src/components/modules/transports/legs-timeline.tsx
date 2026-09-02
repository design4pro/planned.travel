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

import { Alert, Badge, Button, Chip, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatNumber, formatWeekday } from '#/lib/format'
import { formatMoney } from '#/lib/money'
import { resolve } from '../shared/deferred-message'
import { useLocale, useTranslate } from '#/lib/i18n'

import type { Locale, Translate } from '#/lib/i18n'
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

/* The label is a key, so the options are built per render rather than once at
 * module load: a module constant would freeze whichever locale happened to be
 * active when the bundle first ran. */
function statusOptions(t: Translate): ReadonlyArray<StatusOption> {
  return TRANSPORT_STATUSES.map((value) => ({
    value,
    label: t(STATUS_LABELS[value]),
    tone: STATUS_TONE[value],
  }))
}

function statusOption(status: string, t: Translate): StatusOption {
  const known = isTransportStatus(status) ? status : 'idea'
  return {
    value: known,
    label: t(STATUS_LABELS[known]),
    tone: STATUS_TONE[known],
  }
}

/** `HH:MM` off a stored time. No locale is involved, so none is taken. */
function formatClock(time: string | null): string | null {
  return time === null || time.length < 4 ? null : time.slice(0, 5)
}

/** Whole kilometres, grouped the way the reader's locale groups. */
function formatKilometres(metres: number, locale: Locale): string {
  return `${formatNumber(Math.round(metres / 1000), locale)} km`
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
  const locale = useLocale()
  const t = useTranslate()

  const [filter, setFilter] = useState<ModeFilter>('all')
  const [editing, setEditing] = useState<LegData | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const statuses = useOptimistic<TransportStatus>()

  const setStatus = useAction(setLegStatusFn, {
    failure: t('modules.transports.toast.statusFailed.title'),
    fallback: t('modules.transports.toast.statusFailed.body'),
  })
  const remove = useAction(deleteLegFn, {
    success: t('modules.transports.toast.removed'),
    failure: t('modules.transports.toast.removeFailed'),
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
          title={t('modules.transports.empty.title')}
          description={t('modules.transports.empty.body')}
          action={
            <Button
              variant="primary"
              shape="pill"
              onClick={() => onNewLegOpenChange(true)}
            >
              {t('modules.transports.empty.action')}
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
          title={t('modules.transports.alert.impossible.title', {
            count: summary.impossible,
            legs: formatNumber(summary.impossible, locale),
          })}
        >
          {t('modules.transports.alert.impossible.body')}
        </Alert>
      )}
      {summary.impossible === 0 && summary.tight > 0 ? (
        <Alert
          tone="warning"
          title={t('modules.transports.alert.tight.title', {
            count: summary.tight,
            legs: formatNumber(summary.tight, locale),
          })}
        >
          {t('modules.transports.alert.tight.body')}
        </Alert>
      ) : null}

      {modes.length < 2 ? null : (
        <FilterRow>
          <Chip
            selected={filter === 'all'}
            count={rendered.length}
            onClick={() => setFilter('all')}
          >
            {t('modules.transports.filter.all')}
          </Chip>
          {modes.map(([mode, count]) => {
            const Icon = modeIcon(mode)
            return (
              <Chip
                key={mode}
                selected={filter === mode}
                count={count}
                icon={<Icon aria-hidden />}
                onClick={() => setFilter(mode)}
              >
                {t(modeLabel(mode))}
              </Chip>
            )
          })}
        </FilterRow>
      )}

      {visible.length === 0 ? (
        <EmptyState
          variant="filled"
          size="md"
          icon={<PlaneTakeoff />}
          title={t('modules.transports.filtered.title')}
          description={t('modules.transports.filtered.body', {
            label: t('modules.transports.filter.all'),
          })}
          action={
            <Button
              variant="secondary"
              shape="pill"
              onClick={() => setFilter('all')}
            >
              {t('modules.transports.filtered.action')}
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
                      title: t('modules.remove.confirmTitle', {
                        name: leg.title,
                      }),
                      description: t('modules.transports.remove.body'),
                      confirmLabel: t('modules.transports.remove.confirm'),
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
                  <span aria-hidden className="ms-6 block h-4 w-px bg-edge" />
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

/* --------------------------------------------------------------- junction */

/** The hand-over between two legs, drawn on the rail between their cards. */
function Junction({ connection }: { connection: Connection }) {
  const t = useTranslate()

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
      <div className="flex min-w-0 flex-col gap-1 py-3 ps-1">
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-semibold',
            tone.chip,
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {resolve(connection.headline, t)}
        </span>
        {connection.detail === null ? null : (
          <p className="max-w-prose text-caption leading-relaxed text-ink-3">
            {resolve(connection.detail, t)}
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
  const t = useTranslate()
  const locale = useLocale()

  const Icon = modeIcon(leg.mode)
  const cancelled = leg.status === 'cancelled'

  const facts: Array<FactItem> = [
    ...(leg.carrier === null && leg.serviceNumber === null
      ? []
      : [
          {
            label: t('modules.transports.field.service'),
            value: [leg.carrier, leg.serviceNumber].filter(Boolean).join(' '),
          },
        ]),
    ...(leg.bookingCode === null
      ? []
      : [
          {
            label: t('modules.transports.field.bookingRef'),
            mono: true,
            value: (
              <CopyValue
                value={leg.bookingCode}
                label={t('modules.transports.bookingRefFor', {
                  title: leg.title,
                })}
              />
            ),
          },
        ]),
    ...(leg.seat === null
      ? []
      : [
          {
            label: t('modules.transports.field.seat'),
            mono: true,
            value: leg.seat,
          },
        ]),
    ...(leg.distanceMetres === null || leg.distanceMetres === 0
      ? []
      : [
          {
            label: t('modules.transports.field.distance'),
            value: formatKilometres(leg.distanceMetres, locale),
          },
        ]),
    ...(leg.priceMinor === null || leg.priceMinor === 0
      ? []
      : [
          {
            label: t('modules.field.price'),
            value: formatMoney(
              leg.priceMinor,
              leg.currency ?? currency,
              locale,
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
          {t(modeLabel(leg.mode))}
        </span>
        <h2
          className={cn(
            'min-w-0 flex-1 truncate text-label font-semibold text-ink',
            cancelled && 'line-through',
          )}
        >
          {leg.title}
        </h2>
        <StatusMenu
          current={statusOption(leg.status, t)}
          options={statusOptions(t)}
          label={t('modules.statusOf', { title: leg.title })}
          onSelect={onStatus}
        />
        <RowMenu
          label={t('modules.actionsFor', { name: leg.title })}
          items={[
            {
              label: t('modules.transports.menu.edit'),
              icon: <Pencil aria-hidden />,
              onSelect: onEdit,
            },
            {
              label: t('modules.transports.remove.confirm'),
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
          <FactNote label={t('modules.field.notes')}>{leg.notes}</FactNote>
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
  const t = useTranslate()
  const locale = useLocale()

  const day = formatWeekday(date, locale)
  const clock = formatClock(time)
  const when = [day, clock].filter((part) => part !== null).join(' · ')

  return (
    <div className={cn('min-w-0 flex-1', align === 'right' && 'text-end')}>
      <p
        className={cn(
          'truncate text-subtitle font-bold text-ink',
          code === null
            ? 'tracking-tight'
            : 'font-mono tracking-wide uppercase',
        )}
      >
        {code ?? name ?? t('modules.value.notSet')}
      </p>
      {code === null || name === null ? null : (
        <p className="truncate text-caption text-ink-3">{name}</p>
      )}
      <p className="truncate text-caption tabular-nums text-ink-4">
        {when === '' ? t('modules.transports.noTime') : when}
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
  const locale = useLocale()
  const t = useTranslate()

  if (impossible > 0) {
    return (
      <Badge tone="danger" dot size="lg">
        {t('modules.transports.badge.impossible', {
          count: impossible,
          legs: formatNumber(impossible, locale),
        })}
      </Badge>
    )
  }
  if (tight > 0) {
    return (
      <Badge tone="warning" dot size="lg">
        {t('modules.transports.badge.tight', {
          count: tight,
          legs: formatNumber(tight, locale),
        })}
      </Badge>
    )
  }
  return (
    <Badge tone="success" dot size="lg">
      {t('modules.transports.badge.ok')}
    </Badge>
  )
}
