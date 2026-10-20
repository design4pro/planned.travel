import { useEffect, useRef, useState } from 'react'
import { Button, Card } from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  formatDate,
  formatList,
  monthName,
  formatNumber,
  weekdayName,
} from '#/lib/format'
import { useDirection, useLocale, useTranslate } from '#/lib/i18n'
import { blockedReason, isWeekend } from '#/lib/vacay/day-rules'
import { ENTRY_KINDS } from '#/lib/vacay/entry-kinds'
import { moveDay, weekColumns, leadingDays } from '#/lib/vacay/week'
import { KIND_LABEL, BLOCKED_LABEL } from './copy'
import { DayCell, KindCue } from './day-cell'
import { DayPicker } from './day-picker'
import { BottomRegion } from './bottom-region'
import type { EntryKind } from '#/lib/vacay/entry-kinds'

export interface GridSnapshot {
  entries: ReadonlyArray<{ date: string; kind: string }>
  remainingDays: number
  blockWeekends: boolean
  companyHolidaysEnabled: boolean
  companyHolidays: ReadonlyArray<string>
}
export interface YearGridProps {
  year: number
  today: string
  weekStartsOn?: number
  initial: GridSnapshot
  colour?: string
  ink: string
  others: ReadonlyMap<string, number>
  write: (
    date: string,
    kind: EntryKind | null,
  ) => Promise<{ ok: boolean; retryable?: boolean }>
  reread: () => Promise<GridSnapshot>
  refresh: () => void
}
function kindOf(value: string | undefined): EntryKind | undefined {
  return ENTRY_KINDS.find((kind) => kind === value)
}
export function YearGrid({
  year,
  today,
  weekStartsOn = 1,
  initial,
  colour,
  ink,
  others,
  write,
  reread,
  refresh,
}: YearGridProps) {
  const t = useTranslate()
  const locale = useLocale()
  const rtl = useDirection() === 'rtl'
  const start = today.startsWith(`${year}-`) ? today : `${year}-01-01`
  const [active, setActive] = useState(start)
  const [snapshot, setSnapshot] = useState(initial)
  const [overrides, setOverrides] = useState(
    new Map<string, EntryKind | null>(),
  )
  const pending = useRef(new Set<string>())
  const [picker, setPicker] = useState<{
    date: string
    anchor: HTMLButtonElement
  } | null>(null)
  const [message, setMessage] = useState('')
  const [described, setDescribed] = useState<string | null>(null)
  const [failure, setFailure] = useState<{
    date: string
    kind: EntryKind | null
    retryable: boolean
  } | null>(null)
  const [height, setHeight] = useState(0)
  const cells = useRef(new Map<string, HTMLButtonElement>())
  const request = useRef(0)
  useEffect(() => {
    setSnapshot(initial)
    setOverrides(
      (current) =>
        new Map([...current].filter(([date]) => pending.current.has(date))),
    )
  }, [initial])
  const entries = new Map(
    snapshot.entries.map((row) => [row.date, kindOf(row.kind)]),
  )
  for (const [date, kind] of overrides) entries.set(date, kind ?? undefined)
  const rules = {
    ...snapshot,
    companyHolidays: new Set(snapshot.companyHolidays),
  }
  const focus = (date: string) => {
    setActive(date)
    cells.current.get(date)?.focus()
  }
  const close = () => {
    const date = picker?.date
    setPicker(null)
    if (date) focus(date)
  }
  const status = (date: string, kind: EntryKind | null, balance?: number) => {
    const description =
      kind === null
        ? t('modules.vacay.day.cleared', {
            date: formatDate(date, locale) ?? date,
          })
        : t('modules.vacay.day.saved', {
            date: formatDate(date, locale) ?? date,
            kind: t(KIND_LABEL[kind]),
          })
    setMessage(
      balance === undefined
        ? description
        : `${description} ${t(balance < 0 ? 'modules.vacay.allowance.daysOver' : 'modules.vacay.allowance.daysLeft', { count: Math.abs(balance), value: formatNumber(Math.abs(balance), locale) })}`,
    )
    setDescribed(null)
    setFailure(null)
  }
  const mutate = async (
    date: string,
    kind: EntryKind | null,
    reconcileFirst = false,
  ) => {
    if (pending.current.has(date)) return
    pending.current.add(date)
    if (reconcileFirst) {
      try {
        const read = await reread()
        setSnapshot(read)
        const persisted = read.entries.find((row) => row.date === date)?.kind
        if (kind === null ? persisted === undefined : persisted === kind) {
          pending.current.delete(date)
          status(date, kind, read.remainingDays)
          refresh()
          return
        }
        if (
          kind !== null &&
          blockedReason(date, {
            ...read,
            companyHolidays: new Set(read.companyHolidays),
          })
        ) {
          pending.current.delete(date)
          setFailure({ date, kind, retryable: false })
          return
        }
      } catch {
        pending.current.delete(date)
        setFailure({ date, kind, retryable: true })
        return
      }
    }
    setOverrides((current) => new Map(current).set(date, kind))
    setPicker(null)
    focus(date)
    let committed = false
    let retryable = false
    try {
      const result = await write(date, kind)
      committed = result.ok
      retryable = result.retryable === true
    } catch {
      retryable = true
    }
    let read: GridSnapshot | undefined
    const sequence = ++request.current
    try {
      read = await reread()
      if (sequence === request.current) {
        setSnapshot(read)
      }
    } catch {
      /* A committed day remains successful even when its read fails. */
    }
    const persisted = read?.entries.find((row) => row.date === date)?.kind
    const reconciled =
      read !== undefined &&
      (kind === null ? persisted === undefined : persisted === kind)
    pending.current.delete(date)
    if (committed || reconciled) {
      if (read)
        setOverrides((current) => {
          const next = new Map(current)
          next.delete(date)
          return next
        })
      else setOverrides((current) => new Map(current))
      status(date, kind, read?.remainingDays)
      refresh()
    } else {
      setOverrides((current) => {
        const next = new Map(current)
        next.delete(date)
        return next
      })
      const currentRules = read && {
        ...read,
        companyHolidays: new Set(read.companyHolidays),
      }
      const writable =
        currentRules && (kind === null || !blockedReason(date, currentRules))
      setMessage('')
      setFailure({
        date,
        kind,
        retryable: retryable && (read === undefined || !!writable),
      })
    }
  }
  return (
    <section data-part="vacay-year" style={{ paddingBottom: height + 160 }}>
      {snapshot.entries.length === 0 ? (
        <Card variant="dashed" className="mb-6">
          <h2 className="font-semibold">
            {t('modules.vacay.grid.empty', { year })}
          </h2>
          <p className="my-3 text-caption text-ink-3">
            {t('modules.vacay.grid.gesture')}
          </p>
          <Button variant="secondary" onClick={() => focus(start)}>
            {t(
              today.startsWith(`${year}-`)
                ? 'modules.vacay.grid.today'
                : 'modules.vacay.grid.start',
            )}
          </Button>
        </Card>
      ) : null}
      <p id="vacay-grid-help" className="mb-3 text-caption text-ink-3">
        {t('modules.vacay.grid.help')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_monthSlot, month) => {
          const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
          const name = `${monthName(month, locale, 'long')} ${year}`
          const leading = leadingDays(year, month, weekStartsOn)
          const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
          return (
            <Card key={month} padding="none" className="min-w-0 p-3.5">
              <h2
                id={`vacay-month-${month}`}
                className="sticky top-20 z-10 mb-3 break-words bg-surface font-display text-label font-bold text-ink sm:static"
              >
                {name}
              </h2>
              <table
                role="grid"
                aria-label={name}
                aria-describedby="vacay-grid-help"
                className="w-full table-fixed border-separate border-spacing-y-1"
              >
                <thead>
                  <tr>
                    {weekColumns(weekStartsOn).map((weekday) => (
                      <th
                        key={weekday}
                        scope="col"
                        abbr={weekdayName(weekday, locale, 'long') ?? undefined}
                        className="truncate text-center text-micro font-semibold text-ink-3"
                      >
                        {weekdayName(weekday, locale)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_rowSlot, row) => (
                    <tr key={row}>
                      {Array.from({ length: 7 }, (_columnSlot, column) => {
                        const day = row * 7 + column - leading + 1
                        if (day < 1 || day > count)
                          return (
                            <td
                              key={column}
                              className="h-7 [@media(pointer:coarse)]:h-10"
                            />
                          )
                        const date = `${prefix}-${String(day).padStart(2, '0')}`
                        const kind = entries.get(date)
                        const reason = blockedReason(date, rules)
                        const company = rules.companyHolidays.has(date)
                        const parts = [formatDate(date, locale) ?? date]
                        if (kind) parts.push(t(KIND_LABEL[kind]))
                        if (company)
                          parts.push(t('modules.vacay.legend.company'))
                        if (others.get(date))
                          parts.push(
                            t('modules.vacay.grid.others', {
                              value: formatNumber(
                                others.get(date) ?? 0,
                                locale,
                              ),
                            }),
                          )
                        let className = 'text-ink'
                        if (company) className = 'bg-warning-soft text-ink'
                        else if (isWeekend(date))
                          className = 'bg-surface-inset text-ink'
                        return (
                          <td key={column} role="gridcell">
                            <DayCell
                              day={day}
                              kind={kind}
                              companyHoliday={company}
                              other={!!others.get(date)}
                              busy={pending.current.has(date)}
                              ref={(node) => {
                                if (node) cells.current.set(date, node)
                                else cells.current.delete(date)
                              }}
                              tabIndex={active === date ? 0 : -1}
                              aria-label={formatList(parts, locale)}
                              aria-current={date === today ? 'date' : undefined}
                              aria-disabled={
                                (!!reason && !kind) ||
                                pending.current.has(date) ||
                                undefined
                              }
                              aria-haspopup="dialog"
                              aria-expanded={picker?.date === date}
                              aria-describedby={
                                described === date
                                  ? 'vacay-day-status'
                                  : undefined
                              }
                              className={cn(className, kind && 'font-semibold')}
                              style={
                                kind
                                  ? {
                                      background:
                                        colour ?? 'var(--color-brand)',
                                      color: colour
                                        ? ink
                                        : 'var(--color-brand-on)',
                                    }
                                  : undefined
                              }
                              onFocus={() => setActive(date)}
                              onKeyDown={(event) => {
                                if (
                                  ![
                                    'ArrowLeft',
                                    'ArrowRight',
                                    'ArrowUp',
                                    'ArrowDown',
                                    'PageUp',
                                    'PageDown',
                                    'Home',
                                    'End',
                                  ].includes(event.key)
                                )
                                  return
                                event.preventDefault()
                                focus(
                                  moveDay(date, event.key, rtl, weekStartsOn),
                                )
                              }}
                              onClick={(event) => {
                                if (pending.current.has(date)) return
                                if (reason && !kind) {
                                  setMessage(t(BLOCKED_LABEL[reason]))
                                  setDescribed(date)
                                  return
                                }
                                setPicker({ date, anchor: event.currentTarget })
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )
        })}
      </div>
      <ul
        aria-label={t('modules.vacay.legend.title')}
        className="mt-5 flex flex-wrap gap-4 text-caption text-ink-2"
      >
        {ENTRY_KINDS.map((kind) => (
          <li key={kind} className="flex items-center gap-2">
            <KindCue kind={kind} />
            {t(KIND_LABEL[kind])}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-surface-inset" />
          {t('modules.vacay.legend.weekend')}
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 border border-dashed border-current"
          />
          {t('modules.vacay.legend.company')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 bg-current" />
          {t('modules.vacay.legend.other')}
        </li>
      </ul>
      {picker ? (
        <DayPicker
          title={t('modules.vacay.day.title', {
            date: formatDate(picker.date, locale) ?? picker.date,
          })}
          anchor={picker.anchor}
          kind={entries.get(picker.date)}
          clearOnly={!!blockedReason(picker.date, rules)}
          onClose={close}
          onChoose={(kind) => {
            void mutate(picker.date, kind)
          }}
        />
      ) : null}
      <BottomRegion
        message={message}
        onHeight={setHeight}
        failure={
          failure
            ? t('modules.vacay.day.failed', {
                date: formatDate(failure.date, locale) ?? failure.date,
              })
            : null
        }
        retry={
          failure?.retryable
            ? () => {
                void mutate(failure.date, failure.kind, true)
              }
            : undefined
        }
      />
    </section>
  )
}
