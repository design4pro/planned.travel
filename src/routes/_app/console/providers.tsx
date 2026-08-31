import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Gauge, ShieldAlert, TrendingUp, Users } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { ErrorPanel } from '#/components/layout/error-state'
import { readConsoleFailure } from '#/components/console'
import {
  Badge,
  Card,
  EmptyState,
  Progress,
  Sparkline,
  StatCard,
} from '#/components/ui'
import { useI18n, useTranslate } from '#/lib/i18n'
import { forecast, meterTone, projectAtScale } from './-lib/providers'
import { loadProviders } from './-server/providers'
import { ProviderLimitDialog } from './-ui/provider-limit-dialog'
import { formatNumber } from '../-lib/format'
import { Panel, PanelRow, RowsSkeleton, StatsSkeleton } from '../-ui/scaffold'

import type { ProviderPanel, ProvidersView } from './-server/providers'
import type { ErrorComponentProps } from '@tanstack/react-router'
import type { Translate } from '#/lib/i18n'

/**
 * What each third-party service has been called for, what stops it, and what the month is on track
 * to cost.
 *
 * **Every number is computed from `view.asOf`, never from the browser's clock.** That is a hard
 * constraint rather than a preference: `auditServerClock` in `e2e/visual.spec.ts` runs over every
 * console route, so a screen whose output moves with the wall clock cannot have a stable baseline —
 * and a dashboard that renders differently on each load is one nobody can screenshot for a bug
 * report either. So there is no "2 hours ago" anywhere here; durations are whole-window words and
 * instants are dates.
 *
 * **A provider with no client behind it renders an empty state, not a zero.** "Nothing called it"
 * and "nothing can call it" are opposite facts and a `0` cannot tell them apart — the same argument
 * `-server/providers.ts` makes for carrying `integrated` at all. The four decided-but-unwritten
 * vendors (ADRs 0011, 0012 and 0013, plus the backup export) are listed for exactly this reason:
 * a ceiling can be entered against a signed contract before the first call rather than after the
 * first invoice, and the row starts reporting the day a client is written.
 *
 * **`admin` only** (`docs/ACCESS.md` §2.3b). What this deployment owes a vendor is an operational
 * fact about the platform's own bill, not a claim about accounts and not catalogue content, so it
 * has its own statement rather than borrowing one. A curator is redirected to `/console`, which is
 * the part of it that is theirs.
 */
export const Route = createFileRoute('/_app/console/providers')({
  beforeLoad: ({ context }) => {
    if (!context.consoleAccess.canSeeProviders) {
      throw redirect({ to: '/console' })
    }
  },
  loader: async (): Promise<ProvidersView> => await loadProviders(),
  pendingComponent: ProvidersPending,
  errorComponent: ProvidersError,
  component: ProvidersPage,
})

function ProvidersError({ error }: ErrorComponentProps) {
  const t = useTranslate()
  return (
    <ErrorPanel
      error={readConsoleFailure(error, t('console.failure.fallback'))}
      title={t('console.providers.error.title')}
    />
  )
}

function ProvidersPending() {
  return (
    <div className="flex flex-col gap-6">
      <StatsSkeleton tiles={4} />
      <RowsSkeleton rows={5} />
    </div>
  )
}

/** The month bucket a `YYYY-MM-DDTHH` key belongs to, rendered as a date rather than a duration. */
function measuringSinceLabel(bucket: string, locale: string): string {
  return new Date(`${bucket}:00:00.000Z`).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function policyBadge(panel: ProviderPanel, t: Translate) {
  if (panel.policy === 'block') {
    // Permanently `danger`, not only once the ceiling is reached: the setting itself is the risk,
    // because the day it bites is the day a feature stops, and by then the badge is too late.
    return <Badge tone="danger">{t('console.providers.policy.block')}</Badge>
  }
  return <Badge tone="neutral">{t('console.providers.policy.allow')}</Badge>
}

function ProviderRow({
  panel,
  canConfigure,
  onSaved,
}: {
  panel: ProviderPanel
  canConfigure: boolean
  onSaved: () => Promise<void>
}) {
  const t = useTranslate()
  const { locale } = useI18n()

  const editor = canConfigure ? (
    <ProviderLimitDialog panel={panel} onSaved={onSaved} />
  ) : null

  if (!panel.integrated) {
    return (
      <PanelRow className="flex-col items-start gap-1">
        <span className="flex w-full items-center gap-2">
          <span className="text-label font-semibold text-ink">
            {panel.slug}
          </span>
          <Badge tone="neutral">{t('console.providers.status.planned')}</Badge>
          <span className="ms-auto">{editor}</span>
        </span>
        <span className="text-caption text-ink-3">
          {/* Two whole sentences rather than one with an interpolated window label: the labels are
              written for a progress bar ("Today"), and reusing one here read as "3,000 · Today". A
              noun phrase assembled from fragments breaks differently in each of the 23 locales. */}
          {panel.callLimit === null
            ? t('console.providers.status.planned.description')
            : t(
                panel.limitWindow === 'day'
                  ? 'console.providers.status.planned.agreed.day'
                  : 'console.providers.status.planned.agreed.month',
                { limit: formatNumber(panel.callLimit, locale) },
              )}
        </span>
      </PanelRow>
    )
  }

  const used = panel.monthToDate
  const limit = panel.callLimit

  return (
    <PanelRow className="flex-col items-stretch gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-label font-semibold text-ink">{panel.slug}</span>
        {policyBadge(panel, t)}
        {panel.blocked > 0 ? (
          <Badge tone="danger">
            {t('console.providers.badge.blocked', {
              count: panel.blocked,
              calls: formatNumber(panel.blocked, locale),
            })}
          </Badge>
        ) : null}
        <span className="ms-auto">{editor}</span>
      </span>

      {limit === null ? (
        <span className="text-caption text-ink-3">
          {t('console.providers.limit.none', {
            used: formatNumber(used, locale),
          })}
        </span>
      ) : (
        <Progress
          value={used}
          max={Math.max(limit, 1)}
          size="sm"
          tone={meterTone(
            used,
            limit,
            panel.warnPercent,
            panel.criticalPercent,
          )}
          label={t(
            panel.limitWindow === 'day'
              ? 'console.providers.limit.window.day'
              : 'console.providers.limit.window.month',
          )}
          valueText={t('console.providers.limit.value', {
            used: formatNumber(used, locale),
            limit: formatNumber(limit, locale),
          })}
        />
      )}

      <span className="text-caption text-ink-3">
        {panel.measuringSince === null
          ? t('console.providers.measuring.none')
          : t('console.providers.measuring.since', {
              date: measuringSinceLabel(panel.measuringSince, locale),
            })}
      </span>

      {panel.series.length > 0 ? (
        <Sparkline
          data={panel.series.map((point) => point.calls)}
          area
          className="h-8 w-full text-brand"
        />
      ) : null}
    </PanelRow>
  )
}

/**
 * The three projections, and the control that asks "what about at N workspaces".
 *
 * The rate input is pre-filled with the *measured* figure, so the honest number is what the screen
 * shows until an operator deliberately replaces it. When nothing has been measured there is no
 * default to fall back on and the control says so rather than inventing one — `docs/ARCHITECTURE.md`
 * §8's assumed workload is a fine number to type in here, but it is not a measurement and the
 * screen must not present it as one.
 */
function ForecastPanel({ view }: { view: ProvidersView }) {
  const t = useTranslate()
  const { locale } = useI18n()
  const [slug, setSlug] = useState<string>(
    view.providers.find((panel) => panel.integrated)?.slug ?? '',
  )
  const panel = view.providers.find((entry) => entry.slug === slug)

  const result = useMemo(() => {
    if (panel === undefined || !panel.integrated) return null
    return forecast({
      now: new Date(view.asOf),
      series: panel.series,
      monthToDate: panel.monthToDate,
      activeWorkspaces: panel.workspaces.filter(
        (row) => row.organizationId !== null,
      ).length,
      measuringSince: panel.measuringSince,
    })
  }, [panel, view.asOf])

  const [workspaces, setWorkspaces] = useState<string>('')
  const [perWorkspace, setPerWorkspace] = useState<string>('')

  const measuredPerWorkspace = result?.perWorkspace ?? null
  const rate = perWorkspace === '' ? measuredPerWorkspace : Number(perWorkspace)
  const count =
    workspaces === ''
      ? (panel?.workspaces.filter((row) => row.organizationId !== null)
          .length ?? 0)
      : Number(workspaces)
  const projected = projectAtScale(count, rate)

  return (
    <Panel label={t('console.providers.forecast.label')}>
      <div className="flex flex-col gap-4 px-5 py-4">
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-3">
            {t('console.providers.forecast.provider')}
          </span>
          <select
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value)
            }}
            className="focus-ring rounded-lg border border-edge bg-surface px-3 py-2 text-label text-ink"
          >
            {view.providers
              .filter((entry) => entry.integrated)
              .map((entry) => (
                <option key={entry.slug} value={entry.slug}>
                  {entry.slug}
                </option>
              ))}
          </select>
        </label>

        {result === null || result.provisional ? (
          <p className="max-w-prose text-label leading-relaxed text-ink-3">
            {t('console.providers.forecast.tooEarly', {
              count: result?.windowHours ?? 0,
              hours: formatNumber(result?.windowHours ?? 0, locale),
            })}
          </p>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-caption text-ink-3">
                  {t('console.providers.forecast.monthEnd')}
                </dt>
                <dd className="text-title font-semibold text-ink">
                  {formatNumber(Math.round(result.monthEnd ?? 0), locale)}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-ink-3">
                  {t('console.providers.forecast.runRate')}
                </dt>
                <dd className="text-title font-semibold text-ink">
                  {formatNumber(Math.round(result.runRate ?? 0), locale)}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-ink-3">
                  {t('console.providers.forecast.perWorkspace')}
                </dt>
                <dd className="text-title font-semibold text-ink">
                  {measuredPerWorkspace === null
                    ? t('console.providers.forecast.noWorkspaceTraffic')
                    : formatNumber(Math.round(measuredPerWorkspace), locale)}
                </dd>
              </div>
            </dl>

            <p className="text-caption text-ink-3">
              {t('console.providers.forecast.window', {
                count: result.windowHours,
                hours: formatNumber(result.windowHours, locale),
              })}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-caption text-ink-3">
                  {t('console.providers.forecast.atWorkspaces')}
                </span>
                <input
                  inputMode="numeric"
                  value={workspaces}
                  placeholder={String(count)}
                  onChange={(event) => {
                    setWorkspaces(event.target.value)
                  }}
                  className="focus-ring rounded-lg border border-edge bg-surface px-3 py-2 text-label text-ink"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-caption text-ink-3">
                  {t('console.providers.forecast.callsEach')}
                </span>
                <input
                  inputMode="numeric"
                  value={perWorkspace}
                  disabled={measuredPerWorkspace === null}
                  placeholder={
                    measuredPerWorkspace === null
                      ? t('console.providers.forecast.noWorkspaceTraffic')
                      : String(Math.round(measuredPerWorkspace))
                  }
                  onChange={(event) => {
                    setPerWorkspace(event.target.value)
                  }}
                  className="focus-ring rounded-lg border border-edge bg-surface px-3 py-2 text-label text-ink disabled:opacity-50"
                />
              </label>
            </div>

            <p className="text-label text-ink">
              {projected === null
                ? t('console.providers.forecast.noWorkspaceTraffic')
                : t('console.providers.forecast.projected', {
                    calls: formatNumber(Math.round(projected), locale),
                  })}
            </p>
          </>
        )}
      </div>
    </Panel>
  )
}

function ProvidersPage() {
  const t = useTranslate()
  const { locale } = useI18n()
  const view = Route.useLoaderData()
  const router = useRouter()

  // The loader owns every number on this screen, so a save refreshes it rather than patching a copy
  // in component state: a ceiling that moved changes the meters, the tones and the near-a-ceiling
  // tile at once, and two of those are derived from rows this component never sees.
  const reload = useCallback(async () => {
    await router.invalidate()
  }, [router])

  const integrated = view.providers.filter((panel) => panel.integrated)
  const monthTotal = integrated.reduce(
    (total, panel) => total + panel.monthToDate,
    0,
  )
  const errorTotal = integrated.reduce(
    (total, panel) => total + panel.errors,
    0,
  )
  const blockedTotal = integrated.reduce(
    (total, panel) => total + panel.blocked,
    0,
  )
  const overThreshold = integrated.filter(
    (panel) =>
      panel.callLimit !== null &&
      meterTone(
        panel.monthToDate,
        panel.callLimit,
        panel.warnPercent,
        panel.criticalPercent,
      ) !== 'brand',
  ).length

  const workspaceTotals = new Map<string, number>()
  let platformCalls = 0
  for (const panel of integrated) {
    for (const row of panel.workspaces) {
      if (row.organizationId === null) {
        platformCalls += row.calls
        continue
      }
      workspaceTotals.set(
        row.organizationId,
        (workspaceTotals.get(row.organizationId) ?? 0) + row.calls,
      )
    }
  }
  const topWorkspaces = [...workspaceTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="inverse"
          icon={<Gauge />}
          label={t('console.providers.stat.calls')}
          value={formatNumber(monthTotal, locale)}
          caption={t('console.providers.stat.calls.caption')}
        />
        <StatCard
          icon={<ShieldAlert />}
          label={t('console.providers.stat.errors')}
          value={formatNumber(errorTotal, locale)}
          valueTone={errorTotal === 0 ? 'default' : 'warning'}
          caption={t('console.providers.stat.errors.caption')}
        />
        <StatCard
          icon={<TrendingUp />}
          label={t('console.providers.stat.nearLimit')}
          value={formatNumber(overThreshold, locale)}
          valueTone={overThreshold === 0 ? 'default' : 'warning'}
          caption={t('console.providers.stat.nearLimit.caption')}
        />
        <StatCard
          icon={<Users />}
          label={t('console.providers.stat.blocked')}
          value={formatNumber(blockedTotal, locale)}
          valueTone={blockedTotal === 0 ? 'default' : 'danger'}
          caption={
            blockedTotal === 0
              ? t('console.providers.stat.blocked.none')
              : t('console.providers.stat.blocked.some')
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            label={t('console.providers.list.label')}
            count={formatNumber(view.providers.length, locale)}
            flush
          >
            {view.providers.map((panel) => (
              <ProviderRow
                key={panel.slug}
                panel={panel}
                canConfigure={view.canConfigure}
                onSaved={reload}
              />
            ))}
          </Panel>

          <ForecastPanel view={view} />
        </div>

        <Panel label={t('console.providers.workspaces.label')} flush>
          {topWorkspaces.length === 0 && platformCalls === 0 ? (
            <div className="px-5 py-6">
              <EmptyState
                title={t('console.providers.workspaces.empty.title')}
                description={t(
                  'console.providers.workspaces.empty.description',
                )}
              />
            </div>
          ) : (
            <>
              {topWorkspaces.map(([organizationId, calls]) => (
                <PanelRow key={organizationId}>
                  <span className="min-w-0 flex-1 truncate text-label text-ink">
                    {organizationId}
                  </span>
                  <span className="text-label tabular-nums text-ink-2">
                    {formatNumber(calls, locale)}
                  </span>
                </PanelRow>
              ))}
              <PanelRow>
                <span className="min-w-0 flex-1 truncate text-label text-ink-3">
                  {t('console.providers.workspaces.platform')}
                </span>
                <span className="text-label tabular-nums text-ink-2">
                  {formatNumber(platformCalls, locale)}
                </span>
              </PanelRow>
            </>
          )}
        </Panel>
      </div>

      {view.canConfigure ? null : (
        <Card className="px-5 py-4">
          <p className="max-w-prose text-label leading-relaxed text-ink-3">
            {t('console.providers.readOnly')}
          </p>
        </Card>
      )}
    </div>
  )
}
