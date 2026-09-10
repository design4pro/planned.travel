import { useEffect, useState } from 'react'
import { Clock, X } from 'lucide-react'

import {
  Alert,
  Button,
  Combobox,
  EmptyState,
  IconButton,
} from '#/components/ui'
import {
  millisecondsToNextMinute,
  offsetLabel,
  readZones,
  withZone,
  withoutZone,
  zoneClockTime,
} from '#/lib/clock-zones'
import { useI18n } from '#/lib/i18n'
import { timeZoneOptions } from '#/lib/timezones'
import { Panel, PanelRow } from './scaffold'

import type { ZoneReading } from '#/lib/clock-zones'

/**
 * The reference column's clock: one row per pinned zone, each carrying the
 * place, its wall clock and how far ahead of the reader it is.
 *
 * Every decision that can be taken without a DOM is taken in
 * `src/lib/clock-zones.ts` and unit-tested there; what is left here is the
 * rendering, the tick, and the two facts only a browser knows — which zone the
 * reader is in, and whether the document is still being looked at.
 */

/**
 * The instant the rows are drawn at, re-read on each minute boundary.
 *
 * Held as an epoch **number** rather than a `Date`, which matters twice. A fresh
 * `Date` would be a new object every minute, so React would re-render the widget
 * even when the printed minute had not moved — and under the e2e harness's
 * `page.clock.setFixedTime`, which pins `Date` while leaving timers running,
 * that is a re-render every minute of every gate run for no visible change. A
 * number that has not moved is `Object.is`-equal, React bails out, and the
 * settle helper sees the quiet document it is waiting for.
 *
 * The delay is recomputed after every tick rather than fixed at a minute: a
 * clock mounted at `:59.7` would otherwise show the wrong minute for almost the
 * whole of every minute it is up.
 */
function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const stop = (): void => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
    }

    const schedule = (): void => {
      stop()
      timer = setTimeout(() => {
        setNow(Date.now())
        schedule()
      }, millisecondsToNextMinute(Date.now()))
    }

    // A tab nobody is looking at is a tab whose clock nobody is reading, so the
    // timer stops rather than waking the page once a minute in the background.
    // Coming back re-reads the clock first, because the minute has moved on
    // while the timer was not running.
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        stop()
        return
      }
      setNow(Date.now())
      schedule()
    }

    if (document.visibilityState !== 'hidden') schedule()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return now
}

/**
 * The zone the reader is sitting in, known only after mount.
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` answers `UTC` on the Worker
 * and something else in the browser, so reading it during render would print two
 * different documents and hydrate with a mismatch — a console error on a screen
 * whose gate requires a silent one. `null` until the effect runs; the widget
 * holds a row's worth of space in the meantime.
 */
function useHomeZone(): string | null {
  const [zone, setZone] = useState<string | null>(null)
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])
  return zone
}

export interface TimezoneClockProps {
  /** The pinned zones, exactly as stored — including any the runtime refuses. */
  readonly zones: ReadonlyArray<string> | null
  readonly onZonesChange: (next: ReadonlyArray<string>) => void
  /** The dashboard's own day, so an offset is read on the day it is shown. */
  readonly today: string
}

export function TimezoneClock({
  zones,
  onZonesChange,
  today,
}: TimezoneClockProps) {
  const { t, locale } = useI18n()
  const now = useMinuteTick()
  const homeZone = useHomeZone()

  // `null` is a reader who has never chosen, and takes their own zone as the
  // default so the widget is useful before it is configured; `[]` is a reader
  // who removed the last row and gets the designed nothing instead.
  const pinned =
    zones ?? (homeZone === null ? [] : ([homeZone] as ReadonlyArray<string>))
  const rows = homeZone === null ? null : readZones(pinned, homeZone, today)

  return (
    <Panel
      label={t('shell.dashboard.clock.label')}
      flush
      // Pinned under the rows rather than scrolled away with them: adding a zone
      // is what a reader with no zones came here to do, and the empty state's
      // own invitation points at this control.
      footer={
        <AddZone
          today={today}
          onAdd={(zone) => {
            onZonesChange(withZone(pinned, zone))
          }}
        />
      }
    >
      {rows === null ? (
        // One row's worth of space until the reader's own zone is known, so the
        // column does not grow a row under the content below it.
        <div className="h-[3.75rem]" aria-hidden />
      ) : rows.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            size="sm"
            icon={<Clock />}
            title={t('shell.dashboard.clock.empty.title')}
            description={t('shell.dashboard.clock.empty.body')}
          />
        </div>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.zone}>
              <ZoneRow
                row={row}
                now={now}
                locale={locale}
                onRemove={() => {
                  onZonesChange(withoutZone(pinned, row.zone))
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function ZoneRow({
  row,
  now,
  locale,
  onRemove,
}: {
  row: ZoneReading
  now: number
  locale: string
  onRemove: () => void
}) {
  const { t } = useI18n()

  if (!row.ok) {
    // A stored identifier that outlived the runtime that knew it. The row says
    // which zone went away and offers the way out, rather than handing the name
    // to a formatter that would throw and take the dashboard with it.
    return (
      <div className="px-5 py-3.5">
        <Alert
          tone="warning"
          size="sm"
          className="bg-surface-2"
          title={t('shell.dashboard.clock.unknown.title', { zone: row.zone })}
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={onRemove}
            >
              {t('shell.dashboard.clock.remove', { zone: row.zone })}
            </Button>
          }
        >
          {t('shell.dashboard.clock.unknown.body')}
        </Alert>
      </div>
    )
  }

  const time = zoneClockTime(row.zone, now, locale)
  const offset = offsetLabel(row.offsetMinutes)

  return (
    <PanelRow className="group" data-part="clock-row" data-zone={row.zone}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-label font-semibold text-ink">
          {row.label}
        </p>
        <p
          className="truncate text-caption tabular-nums text-ink-3"
          // The figure on its own is a number beside other numbers; the name
          // says what it is a comparison with.
          aria-label={
            row.offsetMinutes === 0
              ? t('shell.dashboard.clock.here')
              : t('shell.dashboard.clock.offset', { offset })
          }
        >
          {offset}
        </p>
      </div>
      <span className="shrink-0 font-display text-title leading-none font-bold tabular-nums text-ink">
        {time}
      </span>
      <IconButton
        variant="ghost"
        size="sm"
        icon={<X />}
        label={t('shell.dashboard.clock.remove', { zone: row.label })}
        onClick={onRemove}
        // Present for the keyboard from the start; revealed to the pointer on
        // hover, the way the planner's own row actions behave.
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />
    </PanelRow>
  )
}

function AddZone({
  today,
  onAdd,
}: {
  today: string
  onAdd: (zone: string) => void
}) {
  const { t } = useI18n()
  // The picker's rows are the platform's own zone list, described by their
  // offset on the day being read. Computed once per day rather than per render.
  const [options] = useState(() => [...timeZoneOptions(today)])

  return (
    <Combobox
      options={options}
      value={null}
      onChange={(zone) => {
        if (zone !== null) onAdd(zone)
      }}
      placeholder={t('shell.dashboard.clock.add')}
      searchPlaceholder={t('shell.dashboard.clock.search')}
      emptyMessage={t('shell.dashboard.clock.noMatches')}
      ariaLabel={t('shell.dashboard.clock.add')}
      size="sm"
    />
  )
}
