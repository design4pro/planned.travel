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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { requireFound } from '#/lib/absence'
import { readPublicFailure } from '#/lib/errors'
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
import { timeZoneOffsetLabel } from '#/lib/timezones'
import { resolve } from '../shared/deferred-message'
import { useLocale, useTranslate } from '#/lib/i18n'

import type { Locale, Translate } from '#/lib/i18n'
import {
  loadTransportDeskFn,
  deleteTransportFn,
  setTransportStatusFn,
} from '#/server/fns/transports'
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
  sortTransportsByDeparture,
  summariseConnections,
} from './connections'
import { TransportDialog } from './leg-dialog'
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
import type { TransportData, TransportDayData, TransportLegData } from './types'

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

export interface TransportsTimelineProps {
  readonly tripId: string
  readonly transports: ReadonlyArray<TransportData>
  /** The trip's days: what the two day selects offer, and what a day chip reads. */
  readonly days: ReadonlyArray<TransportDayData>
  readonly canWrite: boolean
  readonly isArchived: boolean
  readonly canSearchConnections: boolean
  readonly currency: string
  /**
   * The reader's own display preference, read by the route beside the transport
   * desk and handed down. The booking reference obeys that switch; revalidating
   * write capability after a refusal does not replace the display preference.
   *
   * Required rather than defaulted — a masking flag that can be forgotten at a
   * call site is a masking flag that leaks a code.
   */
  readonly maskCodes: boolean
  readonly newTransportOpen: boolean
  readonly onWriteBlockedChange?: (blocked: boolean) => void
  readonly onNewTransportOpenChange: (open: boolean) => void
}

type ModeFilter = 'all' | string

export function TransportsTimeline({
  tripId,
  transports,
  days,
  currency,
  maskCodes,
  canSearchConnections,
  canWrite,
  isArchived,
  newTransportOpen,
  onNewTransportOpenChange,
  onWriteBlockedChange,
}: TransportsTimelineProps) {
  const locale = useLocale()
  const t = useTranslate()

  const [filter, setFilter] = useState<ModeFilter>('all')
  const [editing, setEditing] = useState<TransportData | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const router = useRouter()
  const noticeRef = useRef<HTMLDivElement>(null)
  const currentTripId = useRef(tripId)
  currentTripId.current = tripId
  const [recovery, setRecovery] = useState<
    'idle' | 'refreshing' | 'failed' | 'ready'
  >('idle')
  const [freshCapability, setFreshCapability] = useState<{
    canWrite: boolean
    isArchived: boolean
  } | null>(null)
  const writable =
    canWrite &&
    freshCapability?.canWrite !== false &&
    recovery !== 'refreshing' &&
    recovery !== 'failed'
  const archived = freshCapability?.isArchived ?? isArchived

  useEffect(() => {
    setFreshCapability(null)
  }, [canWrite, isArchived])
  useEffect(() => {
    setRecovery('idle')
    setFreshCapability(null)
  }, [tripId])
  useEffect(() => {
    if (
      !canWrite &&
      (editing !== null || confirm !== null || newTransportOpen)
    ) {
      setEditing(null)
      setConfirm(null)
      onNewTransportOpenChange(false)
      noticeRef.current?.focus()
    }
  }, [canWrite, editing, confirm, newTransportOpen, onNewTransportOpenChange])
  useEffect(() => {
    if (recovery === 'ready' || recovery === 'failed')
      noticeRef.current?.focus()
  }, [recovery])

  async function refreshAfterRefusal(): Promise<void> {
    if (currentTripId.current !== tripId) return
    setRecovery('refreshing')
    setEditing(null)
    setConfirm(null)
    onNewTransportOpenChange(false)
    onWriteBlockedChange?.(true)
    try {
      // invalidate alone can resolve even when a loader fails. Confirm capability through the
      // server interface before allowing a new action; a retry here repeats only this read.
      const fresh = requireFound(
        await loadTransportDeskFn({ data: { tripId } }),
      )
      if (currentTripId.current !== tripId) return
      setFreshCapability({
        canWrite: fresh.canWrite,
        isArchived: fresh.isArchived,
      })
      await router.invalidate({ sync: true })
      if (currentTripId.current !== tripId) return
      setRecovery('ready')
      onWriteBlockedChange?.(!fresh.canWrite)
    } catch {
      if (currentTripId.current !== tripId) return
      setRecovery('failed')
    }
  }

  function onWriteError(cause: unknown): void {
    if (readPublicFailure(cause).kind === 'refusal') void refreshAfterRefusal()
  }

  const statuses = useOptimistic<TransportStatus>()

  const setStatus = useAction(setTransportStatusFn, {
    failure: t('modules.transports.toast.statusFailed.title'),
    fallback: t('modules.transports.toast.statusFailed.body'),
    onError: onWriteError,
  })
  const remove = useAction(deleteTransportFn, {
    success: t('modules.transports.toast.removed'),
    failure: t('modules.transports.toast.removeFailed'),
    onSuccess: () => setConfirm(null),
    onError: onWriteError,
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

  const ordered = useMemo(() => sortTransportsByDeparture(rendered), [rendered])
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

  let noticeCopy = t('trips.transports.recovery.refused')
  if (archived) noticeCopy = t('trips.transports.readOnly.archived')
  if (recovery === 'failed') noticeCopy = t('trips.transports.recovery.failed')
  const archiveNotice =
    archived || recovery !== 'idle' ? (
      <Alert
        ref={noticeRef}
        aria-busy={recovery === 'refreshing'}
        tabIndex={-1}
        tone={recovery === 'failed' ? 'danger' : 'neutral'}
        className="focus-visible:outline-2 focus-visible:outline-ring"
        actions={
          recovery === 'failed' ? (
            <Button onClick={() => void refreshAfterRefusal()}>
              {t('shell.error.retry')}
            </Button>
          ) : undefined
        }
      >
        {noticeCopy}
      </Alert>
    ) : null

  if (transports.length === 0) {
    return (
      <>
        {archiveNotice}
        <EmptyState
          variant="dashed"
          size="lg"
          tone="brand"
          icon={<PlaneTakeoff />}
          title={t('modules.transports.empty.title')}
          description={t('modules.transports.empty.body')}
          action={
            writable ? (
              <Button
                variant="primary"
                shape="pill"
                onClick={() => onNewTransportOpenChange(true)}
              >
                {t('modules.transports.empty.action')}
              </Button>
            ) : undefined
          }
        />
        {writable ? (
          <TransportDialog
            onWriteError={onWriteError}
            canSearchConnections={canSearchConnections}
            tripId={tripId}
            days={days}
            currency={currency}
            open={newTransportOpen}
            onOpenChange={onNewTransportOpenChange}
          />
        ) : null}
      </>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {archiveNotice}
      {summary.impossible === 0 ? null : (
        <Alert
          tone="danger"
          title={t('modules.transports.alert.impossible.title', {
            count: summary.impossible,
            value: formatNumber(summary.impossible, locale),
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
            value: formatNumber(summary.tight, locale),
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
          {visible.map((transport, index) => {
            const connection = byFromId.get(transport.id)
            const nextVisible =
              index + 1 < visible.length ? visible[index + 1] : null
            return (
              <li key={transport.id} className="min-w-0">
                <TransportCard
                  transport={transport}
                  canWrite={writable}
                  currency={currency}
                  maskCodes={maskCodes}
                  departureDay={dayNumberOf(transport.departureDayId)}
                  arrivalDay={dayNumberOf(transport.arrivalDayId)}
                  onEdit={() => setEditing(transport)}
                  onStatus={(next) => changeStatus(transport, next)}
                  onDelete={() =>
                    setConfirm({
                      title: t('modules.remove.confirmTitle', {
                        name: transport.title,
                      }),
                      description: t('modules.transports.remove.body'),
                      confirmLabel: t('modules.transports.remove.confirm'),
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
                  <span aria-hidden className="ms-6 block h-4 w-px bg-edge" />
                )}
              </li>
            )
          })}
        </ol>
      )}

      {writable ? (
        <>
          <TransportDialog
            onWriteError={onWriteError}
            canSearchConnections={canSearchConnections}
            tripId={tripId}
            transport={editing ?? undefined}
            days={days}
            currency={currency}
            open={newTransportOpen || editing !== null}
            onOpenChange={(next) => {
              if (!next) {
                setEditing(null)
                onNewTransportOpenChange(false)
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
        </>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------- junction */

/** The hand-over between two transports, drawn on the rail between their cards. */
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

function TransportCard({
  transport,
  canWrite,
  currency,
  maskCodes,
  departureDay,
  arrivalDay,
  onEdit,
  onStatus,
  onDelete,
}: {
  transport: TransportData
  canWrite: boolean
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
  const t = useTranslate()
  const locale = useLocale()

  const Icon = modeIcon(transport.mode)
  const cancelled = transport.status === 'cancelled'

  const facts: Array<FactItem> = [
    ...(transport.carrier === null && transport.serviceNumber === null
      ? []
      : [
          {
            label: t('modules.transports.field.service'),
            value: [transport.carrier, transport.serviceNumber]
              .filter(Boolean)
              .join(' '),
          },
        ]),
    ...(transport.bookingCode === null
      ? []
      : [
          {
            label: t('modules.transports.field.bookingRef'),
            mono: true,
            value: (
              <MaskedCode
                value={transport.bookingCode}
                label={t('modules.transports.bookingRefFor', {
                  title: transport.title,
                })}
                masked={maskCodes}
              />
            ),
          },
        ]),
    ...(transport.seat === null
      ? []
      : [
          {
            label: t('modules.transports.field.seat'),
            mono: true,
            value: transport.seat,
          },
        ]),
    ...(transport.distanceMetres === null || transport.distanceMetres === 0
      ? []
      : [
          {
            label: t('modules.transports.field.distance'),
            value: formatKilometres(transport.distanceMetres, locale),
          },
        ]),
    ...(transport.priceMinor === null || transport.priceMinor === 0
      ? []
      : [
          {
            label: t('modules.field.price'),
            value: formatMoney(
              transport.priceMinor,
              transport.currency ?? currency,
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
          {t(modeLabel(transport.mode))}
        </span>
        <h2
          className={cn(
            'min-w-0 flex-1 truncate text-label font-semibold text-ink',
            cancelled && 'line-through',
          )}
        >
          {transport.title}
        </h2>
        {canWrite ? (
          <StatusMenu
            current={statusOption(transport.status, t)}
            options={statusOptions(t)}
            label={t('modules.statusOf', { title: transport.title })}
            onSelect={onStatus}
          />
        ) : (
          <Badge tone={statusOption(transport.status, t).tone}>
            {statusOption(transport.status, t).label}
          </Badge>
        )}
        {canWrite ? (
          <RowMenu
            label={t('modules.actionsFor', { name: transport.title })}
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
        ) : null}
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
          <FactNote label={t('modules.field.notes')}>
            {transport.notes}
          </FactNote>
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
  date,
  time,
  showZone,
}: {
  code: string | null
  name: string
  timezone: string | null
  /**
   * The day this stop is read on, because the offset is a fact about the
   * instant and not about the zone: Paris is `UTC+1` in January and `UTC+2` in
   * July, and a July flight labelled from the winter offset is off by an hour
   * in the one place on the card whose whole job is to say which hour it is.
   */
  date: string | null
  time: string | null
  /** Only when the journey crosses zones; otherwise it is noise on every row. */
  showZone: boolean
}) {
  const clock = formatClock(time)
  const zone =
    showZone && timezone !== null && timezone !== ''
      ? timeZoneOffsetLabel(timezone, date)
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
function ticketLine(leg: TransportLegData, t: Translate): string | null {
  const parts = [
    leg.serviceNumber,
    leg.platform === null
      ? null
      : t('modules.transports.chain.platform', { value: leg.platform }),
    leg.seat === null
      ? null
      : t('modules.transports.chain.seat', { value: leg.seat }),
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
  const t = useTranslate()

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
          date={first.departureDate}
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
              {ticketLine(leg, t) ??
                t('modules.transports.chain.legNumber', { n: index + 1 })}
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
              date={leg.arrivalDate}
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
  const t = useTranslate()
  const locale = useLocale()

  /*
   * `2026-06-23` → `Tue 23 Jun`, from the shared CLDR table rather than from a
   * module-local `Intl.DateTimeFormat`: workerd and WebKit resolve an
   * abbreviated month from different ICU builds, and a divergence there is a
   * hydration error rather than a tolerance.
   */
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
      <div
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1',
          align === 'right' && 'justify-end',
        )}
      >
        <span className="truncate text-caption tabular-nums text-ink-4">
          {when === '' ? t('modules.transports.noTime') : when}
        </span>
        {dayNumber === null ? null : (
          <span
            data-part="day-chip"
            className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[0.6875rem] leading-4 font-semibold tabular-nums text-ink-3"
          >
            {t('modules.transports.dayNumber', { n: dayNumber })}
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
  const locale = useLocale()
  const t = useTranslate()

  if (impossible > 0) {
    return (
      <Badge tone="danger" dot size="lg">
        {t('modules.transports.badge.impossible', {
          count: impossible,
          value: formatNumber(impossible, locale),
        })}
      </Badge>
    )
  }
  if (tight > 0) {
    return (
      <Badge tone="warning" dot size="lg">
        {t('modules.transports.badge.tight', {
          count: tight,
          value: formatNumber(tight, locale),
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
