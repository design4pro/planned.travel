import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'

import { useLocale, useTranslate } from '#/lib/i18n'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { loadVacay } from './-server/library'
import { loadVacayAllowance } from './-server/vacay'
import { formatNumber, humaniseToken, pluralise } from './-lib/format'
import { VACAY_KIND_TONE, inkOn, toneFor } from './-lib/tone'
import { AllowancePanel } from './-ui/allowance-panel'
import { PlanSettingsDialog } from './-ui/plan-settings-dialog'
import { HeaderSkeleton, Panel } from './-ui/scaffold'

import type { VacayPayload } from './-server/library'
import type { AllowanceSaved } from './-server/vacay'

const MONTH_NAMES: ReadonlyArray<string> = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Monday-first, matching the schema default for `week_starts_on`. */
const WEEKDAY_INITIALS: ReadonlyArray<string> = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
]

export const Route = createFileRoute('/_app/vacay')({
  validateSearch: z.object({
    year: z.number().int().min(1970).max(2200).optional(),
  }),
  loaderDeps: ({ search }) => ({ year: search.year }),
  // One after the other: `loadVacay` ensures the plan, and the allowance read creates none, so the
  // two must not race on the plan's owner index.
  loader: async ({ deps }) => {
    const overview = await loadVacay({ data: { year: deps.year } })
    const allowance = await loadVacayAllowance({
      data: { planId: overview.plan.id, year: overview.year },
    })
    return { ...overview, allowance }
  },
  pendingComponent: VacayPending,
  errorComponent: VacayError,
  component: VacayPage,
})

function VacayError({ error }: { error: Error }) {
  const t = useTranslate()
  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('modules.vacay.error.title')} />
    </AppFrame>
  )
}

function VacayPage() {
  const t = useTranslate()
  const locale = useLocale()
  const data = Route.useLoaderData()
  /** Outlives the allowance panel, which is keyed by year: the replaced year is where they go next. */
  const [superseded, setSuperseded] =
    useState<AllowanceSaved['superseded']>(null)

  const colourByUser = new Map(
    data.colours.map((row) => [row.userId, row.colour]),
  )
  const holidays = new Set(data.companyHolidays.map((row) => row.date))

  const mine = data.entries.filter(
    (entry) => entry.userId === data.viewerUserId,
  )
  const others = data.entries.filter(
    (entry) => entry.userId !== data.viewerUserId,
  )

  const entryByDate = new Map(mine.map((entry) => [entry.date, entry]))
  const othersByDate = new Map<string, Array<string>>()
  for (const entry of others) {
    const bucket = othersByDate.get(entry.date)
    if (bucket) {
      bucket.push(entry.userId)
    } else {
      othersByDate.set(entry.date, [entry.userId])
    }
  }

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow="Time off"
          title="Vacay"
          description="Plan the days you are away and see them against everyone else's"
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <PlanSettingsDialog
                planId={data.plan.id}
                carryOverEnabled={data.plan.carryOverEnabled}
                defaultEntitlementDays={data.plan.defaultEntitlementDays}
              />
              {/* One group, so a wrapping header moves the whole switcher and never splits the year from its arrows. */}
              <div className="flex items-center gap-1.5">
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  shape="pill"
                  aria-label={t('modules.vacay.year.previous')}
                >
                  <Link to="/vacay" search={{ year: data.year - 1 }}>
                    <ChevronLeft aria-hidden />
                  </Link>
                </Button>
                <span className="min-w-16 text-center font-display text-subtitle font-bold tabular-nums text-ink">
                  {data.year}
                </span>
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  shape="pill"
                  aria-label={t('modules.vacay.year.next')}
                >
                  <Link to="/vacay" search={{ year: data.year + 1 }}>
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-8">
          <aside className="flex min-w-0 flex-col gap-6">
            <AllowancePanel
              key={data.year}
              planId={data.plan.id}
              year={data.year}
              allowance={data.allowance}
              carryOverEnabled={data.plan.carryOverEnabled}
              superseded={superseded}
              onSupersededChange={setSuperseded}
            />

            <Panel
              label="Travellers"
              count={formatNumber(data.people.length, locale)}
              flush
            >
              <ul>
                {data.people.map((person) => {
                  const colour = colourByUser.get(person.userId)
                  const used = data.balances.find(
                    (row) => row.userId === person.userId,
                  )?.usedDays
                  return (
                    <li
                      key={person.userId}
                      className="flex items-center gap-2.5 px-5 py-2.5 not-last:border-b not-last:border-edge-faint"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'size-2.5 shrink-0 rounded-full',
                          colour ? '' : 'bg-brand',
                        )}
                        style={
                          colour === undefined
                            ? undefined
                            : { backgroundColor: colour }
                        }
                      />
                      <Avatar name={person.name} src={person.image} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-caption text-ink">
                        {person.userId === data.viewerUserId
                          ? `${person.name} (you)`
                          : person.name}
                      </span>
                      <span className="shrink-0 text-caption tabular-nums text-ink-4">
                        {used === undefined ? '—' : formatNumber(used, locale)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel label="Legend">
              <ul className="flex flex-col gap-2.5">
                <LegendRow className="bg-brand" label="Your time off" />
                <LegendRow className="bg-warning" label="Company holiday" />
                <LegendRow className="bg-surface-inset" label="Weekend" />
                <LegendRow className="bg-info" label="Someone else away" />
              </ul>
            </Panel>
          </aside>

          <div className="min-w-0">
            {data.entries.length === 0 && data.companyHolidays.length === 0 ? (
              <Card variant="dashed" padding="none" className="mb-6">
                <EmptyState
                  size="md"
                  tone="brand"
                  icon={<CalendarDays />}
                  title={`Nothing marked in ${data.year}`}
                  description="Mark the days you are away and the whole year fills in below, weekends and company holidays included."
                />
              </Card>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {MONTH_NAMES.map((name, month) => (
                <MonthGrid
                  key={name}
                  name={name}
                  year={data.year}
                  month={month}
                  holidays={holidays}
                  entryByDate={entryByDate}
                  othersByDate={othersByDate}
                  colourByUser={colourByUser}
                  data={data}
                />
              ))}
            </div>
          </div>
        </div>
      </AppSections>
    </AppFrame>
  )
}

function LegendRow({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-caption text-ink-2">
      <span aria-hidden className={cn('size-3 rounded-sm', className)} />
      {label}
    </li>
  )
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function MonthGrid({
  name,
  year,
  month,
  holidays,
  entryByDate,
  othersByDate,
  colourByUser,
  data,
}: {
  name: string
  year: number
  month: number
  holidays: Set<string>
  entryByDate: Map<string, VacayPayload['entries'][number]>
  othersByDate: Map<string, Array<string>>
  colourByUser: Map<string, string>
  data: VacayPayload
}) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
  // Monday-first: shift Sunday (0) to the end of the week.
  const leading = (firstWeekday + 6) % 7
  const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const cells: Array<number | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => index + 1),
  ]

  return (
    <Card padding="none" className="min-w-0 p-3.5">
      <h2 className="mb-3 font-display text-subtitle font-bold tracking-tight text-ink">
        {name}
      </h2>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAY_INITIALS.map((initial) => (
          <span
            key={initial}
            aria-hidden
            className="pb-1 text-center text-micro font-semibold tracking-label uppercase text-ink-4"
          >
            {initial}
          </span>
        ))}

        {cells.map((day, index) => {
          if (day === null) {
            return <span key={`blank-${index}`} aria-hidden />
          }

          const date = `${year}-${pad(month + 1)}-${pad(day)}`
          // Column position in a Monday-first week: 5 and 6 are the weekend.
          const isWeekend = index % 7 >= 5
          const entry = entryByDate.get(date)
          const holiday = holidays.has(date)
          const otherIds = othersByDate.get(date) ?? []
          const mineColour =
            entry === undefined
              ? undefined
              : colourByUser.get(data.viewerUserId)

          const label = [
            date,
            entry === undefined ? null : humaniseToken(entry.kind),
            holiday ? 'company holiday' : null,
            otherIds.length === 0
              ? null
              : pluralise(otherIds.length, 'other traveller'),
          ]
            .filter((part) => part !== null)
            .join(' — ')

          return (
            <span
              key={date}
              title={label}
              className={cn(
                'relative mx-auto flex size-7 items-center justify-center rounded-md text-caption tabular-nums',
                entry !== undefined
                  ? 'font-semibold'
                  : holiday
                    ? 'bg-warning-soft font-semibold text-warning'
                    : isWeekend
                      ? 'bg-surface-inset text-ink-4'
                      : 'text-ink-2',
              )}
              style={
                entry === undefined
                  ? undefined
                  : {
                      backgroundColor: mineColour ?? 'var(--color-brand)',
                      // The traveller's own colour is theme-independent, so the
                      // numeral on top of it has to be measured, not tokenised.
                      color: inkOn(mineColour),
                    }
              }
            >
              {day}
              {otherIds.length === 0 ? null : (
                // Underneath the numeral, inside the cell. Pinned to the corner
                // it floated clear of an unfilled chip and read as a stray dot
                // hovering above the week rather than a mark on the day.
                <span
                  aria-hidden
                  className="absolute bottom-[0.1875rem] left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-info"
                />
              )}
            </span>
          )
        })}
      </div>

      {data.entries.filter((entry) =>
        entry.date.startsWith(`${year}-${pad(month + 1)}`),
      ).length === 0 ? null : (
        <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-edge-faint pt-3">
          {[
            ...new Set(
              data.entries
                .filter((entry) =>
                  entry.date.startsWith(`${year}-${pad(month + 1)}`),
                )
                .map((entry) => entry.kind),
            ),
          ].map((kind) => (
            <li key={kind}>
              <Badge tone={toneFor(VACAY_KIND_TONE, kind)} size="sm">
                {humaniseToken(kind)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function VacayPending() {
  const t = useTranslate()
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <div
          aria-busy="true"
          className="grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-8"
        >
          <span className="sr-only">{t('modules.vacay.pending.loading')}</span>
          <div className="flex flex-col gap-6">
            <Card className="space-y-4">
              <Skeleton className="h-3 w-28" radius="sm" />
              <Skeleton
                className="h-[calc(var(--text-subtitle)*var(--text-subtitle--line-height))] w-32"
                radius="sm"
              />
              <Skeleton className="h-1.5 w-full" radius="full" />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-12 w-full" radius="md" />
                ))}
              </div>
            </Card>
            <Card className="space-y-3">
              <Skeleton className="h-3 w-24" radius="sm" />
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-7 w-full" radius="md" />
              ))}
            </Card>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Card key={index} className="space-y-3">
                <Skeleton className="h-5 w-24" radius="sm" />
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }, (_slot, cell) => (
                    <Skeleton key={cell} className="size-6" radius="md" />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </AppSections>
    </AppFrame>
  )
}
