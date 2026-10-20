import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'

import { useLocale, useTranslate } from '#/lib/i18n'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import { Avatar, Button, Card, Skeleton } from '#/components/ui'
import { cn } from '#/lib/cn'
import { loadVacay } from './-server/library'
import { YearGrid } from '#/components/vacay/year-grid'
import {
  loadVacayGridFn,
  markVacayDayFn,
  clearVacayDayFn,
  loadVacayAllowance,
} from './-server/vacay'
import { formatNumber } from './-lib/format'
import { inkOn } from './-lib/tone'
import { AllowancePanel } from './-ui/allowance-panel'
import { PlanSettingsDialog } from './-ui/plan-settings-dialog'
import { HeaderSkeleton, Panel } from './-ui/scaffold'

import type { AllowanceSaved } from './-server/vacay'

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
    const grid = await loadVacayGridFn({
      data: { planId: overview.plan.id, year: overview.year },
    })
    return { ...overview, allowance, grid }
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
  const router = useRouter()
  const data = Route.useLoaderData()
  /** Outlives the allowance panel, which is keyed by year: the replaced year is where they go next. */
  const [superseded, setSuperseded] =
    useState<AllowanceSaved['superseded']>(null)

  const colourByUser = new Map(
    data.colours.map((row) => [row.userId, row.colour]),
  )
  const othersByDate = new Map<string, number>()
  for (const entry of data.entries) {
    if (entry.userId !== data.viewerUserId)
      othersByDate.set(entry.date, (othersByDate.get(entry.date) ?? 0) + 1)
  }

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow={t('modules.vacay.page.eyebrow')}
          title={t('modules.vacay.page.title')}
          description={t('modules.vacay.page.description')}
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
              label={t('modules.vacay.people.title')}
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
                          ? t('modules.vacay.people.you', { name: person.name })
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
          </aside>

          <YearGrid
            key={`${data.plan.id}-${data.year}`}
            year={data.year}
            today={data.grid.today}
            weekStartsOn={data.grid.weekStartsOn}
            initial={data.grid}
            colour={colourByUser.get(data.viewerUserId)}
            ink={inkOn(colourByUser.get(data.viewerUserId))}
            others={othersByDate}
            write={(date, kind) =>
              kind === null
                ? clearVacayDayFn({ data: { planId: data.plan.id, date } })
                : markVacayDayFn({ data: { planId: data.plan.id, date, kind } })
            }
            reread={() =>
              loadVacayGridFn({
                data: { planId: data.plan.id, year: data.year },
              })
            }
            refresh={() => {
              void router.invalidate()
            }}
          />
        </div>
      </AppSections>
    </AppFrame>
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
          <div>
            <Skeleton
              className="mb-3 h-[calc(var(--text-caption)*var(--text-caption--line-height))] w-64 max-w-full"
              radius="sm"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }, (_monthSlot, index) => (
                <Card key={index} padding="none" className="min-w-0 p-3.5">
                  <Skeleton
                    className="mb-3 h-[calc(var(--text-label)*var(--text-label--line-height))] w-24"
                    radius="sm"
                  />
                  <table
                    aria-hidden
                    className="w-full table-fixed border-separate border-spacing-y-1"
                  >
                    <thead>
                      <tr>
                        {Array.from({ length: 7 }, (_columnSlot, column) => (
                          <th key={column}>
                            <Skeleton
                              className="h-[calc(var(--text-micro)*var(--text-micro--line-height))] w-full"
                              radius="sm"
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 6 }, (_rowSlot, row) => (
                        <tr key={row}>
                          {Array.from({ length: 7 }, (_columnSlot, column) => (
                            <td key={column}>
                              <Skeleton
                                className="h-7 w-full [@media(pointer:coarse)]:h-10"
                                radius="md"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </AppSections>
    </AppFrame>
  )
}
