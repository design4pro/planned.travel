import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  Castle,
  CloudOff,
  GitBranch,
  History,
  ListChecks,
  Radio,
} from 'lucide-react'

import { ErrorPanel } from '#/components/layout/error-state'
import { Badge, Card, EmptyState, Skeleton, StatCard } from '#/components/ui'
import {
  formatElapsed,
  formatLease,
  orderWip,
  summariseFleet,
} from './-lib/sandcastle'
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadSandcastleRegistry } from './-server/sandcastle'
import { formatNumber } from '../-lib/format'
import { Panel, PanelRow, RowsSkeleton, StatsSkeleton } from '../-ui/scaffold'

import type { SandcastleRegistryView } from './-server/sandcastle'
import type { ErrorComponentProps } from '@tanstack/react-router'
import type { BadgeTone } from '#/components/ui'
import type { MessageKey } from '#/lib/i18n'
import type {
  RegistryState,
  RunView,
  SandcastleOrigin,
  SandcastleRunStatus,
  WipView,
} from '#/server/do'

/**
 * What the agent fleet is doing, read from the one registry that decides it (ADR 0009).
 *
 * **Read-only, and there is nothing here to press.** Every fact on this screen is written by a
 * sandcastle run through `/api/sandcastle/*` under a bearer token; a console session cannot claim,
 * release or kill anything, which is why `sandcastle` has exactly one action in the dictionary. A
 * button that ended a run from here would be a second way to release a lease, and the value of the
 * registry is that there is one.
 *
 * **`admin` only** (`docs/ACCESS.md` §2.3a). A curator curates the catalogue; which machine is
 * building which ticket is an operational fact about how this repository is developed and names
 * hosts, branches and run ids. The refusal is the same shape as the accounts half's — sent to
 * `/console`, which is the part of the console that *is* theirs.
 *
 * **On production this page opens and says it is not the coordinator.** The registry binding is
 * declared on `env.staging` alone, because a second registry would let two fleets each believe they
 * hold the backlog. An empty fleet and no fleet are opposite facts, so they are drawn differently.
 */
export const Route = createFileRoute('/_app/console/sandcastle')({
  beforeLoad: ({ context }) => {
    if (!context.consoleAccess.canSeeRuns) {
      throw redirect({ to: '/console' })
    }
  },
  loader: async (): Promise<SandcastleRegistryView> =>
    await loadSandcastleRegistry(),
  pendingComponent: SandcastlePending,
  errorComponent: SandcastleError,
  component: SandcastlePage,
})

function SandcastleError({ error }: ErrorComponentProps) {
  const t = useTranslate()
  return (
    <ErrorPanel
      className="bg-surface-2"
      error={error}
      title={t('console.runs.error.title')}
    />
  )
}

/**
 * Where a run is executing, as a word.
 *
 * The only registry field on this screen that is translated. `kind`, `stage` and `status` beside it
 * are printed as the registry stores them, next to the run id, the host and the branch name — they
 * are data being read out, and a dashboard that renames half its columns' values and not the other
 * half is harder to reconcile with the wire than one that renames none. `origin` was already a
 * hand-written display map when it arrived, so it stays one.
 */
const ORIGIN_KEY: Record<SandcastleOrigin, MessageKey> = {
  local: 'console.runs.origin.local',
  'github-actions': 'console.runs.origin.githubActions',
}

const STATUS_TONE: Record<SandcastleRunStatus, BadgeTone> = {
  active: 'brand',
  finished: 'success',
  failed: 'danger',
  // Not a failure and not a success: nobody said how it ended, the lease simply ran out.
  expired: 'warning',
}

function SandcastlePage() {
  const view = Route.useLoaderData()

  if (!view.coordinator) return <NotTheCoordinator />

  return <Fleet state={view.state} />
}

function Fleet({ state }: { state: RegistryState }) {
  const locale = useLocale()
  const t = useTranslate()
  const summary = summariseFleet(state)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          tone="inverse"
          icon={<Radio />}
          label={t('console.runs.stat.live')}
          value={formatNumber(summary.liveRuns, locale)}
          caption={
            summary.liveRuns === 0
              ? t('console.runs.stat.live.none')
              : t('console.runs.stat.live.some')
          }
        />
        <StatCard
          icon={<ListChecks />}
          label={t('console.runs.stat.issues')}
          value={formatNumber(summary.issuesHeld, locale)}
          caption={t('console.runs.stat.issues.caption')}
        />
        <StatCard
          icon={<GitBranch />}
          label={t('console.runs.stat.orphans')}
          value={formatNumber(summary.orphanedBranches, locale)}
          valueTone={summary.orphanedBranches === 0 ? 'default' : 'warning'}
          caption={
            summary.orphanedBranches === 0
              ? t('console.runs.stat.orphans.none')
              : t('console.runs.stat.orphans.some')
          }
        />
      </div>

      <LiveRuns runs={state.active} now={state.now} />

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkInProgress wip={state.wip} now={state.now} />
        <RecentRuns runs={state.recent} now={state.now} />
      </div>
    </div>
  )
}

function LiveRuns({
  runs,
  now,
}: {
  runs: ReadonlyArray<RunView>
  now: number
}) {
  const locale = useLocale()
  const t = useTranslate()
  return (
    <Panel
      label={t('console.runs.stat.live')}
      count={formatNumber(runs.length, locale)}
      flush
    >
      {runs.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<Castle />}
            title={t('console.runs.live.empty.title')}
            description={t('console.runs.live.empty.body')}
          />
        </div>
      ) : (
        <ul>
          {runs.map((run) => (
            <li key={run.runId}>
              <PanelRow className="flex-wrap gap-x-3 gap-y-2.5">
                <span className="basis-full sm:min-w-0 sm:flex-1 sm:basis-auto">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label font-semibold text-ink">
                      {run.runId}
                    </span>
                    <Badge tone="outline" size="sm">
                      {run.kind}
                    </Badge>
                    <Badge
                      tone={run.origin === 'local' ? 'neutral' : 'info'}
                      size="sm"
                    >
                      {t(ORIGIN_KEY[run.origin])}
                    </Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-ink-3">
                    {run.host}
                    {run.integrationBranch === null
                      ? ''
                      : ` · ${run.integrationBranch}`}
                  </span>
                </span>

                <Badge tone="brand" size="sm" dot>
                  {run.stage}
                </Badge>

                <span className="min-w-0 text-caption text-ink-3">
                  {run.issues.length === 0
                    ? t('console.runs.holds.nothing')
                    : t('console.runs.holds', {
                        issues: run.issues.map((id) => `#${id}`).join(', '),
                      })}
                </span>

                <span className="ms-auto shrink-0 text-caption tabular-nums text-ink-4">
                  {t('console.runs.uptime', {
                    elapsed: formatElapsed(now - run.startedAt),
                    lease: formatLease(t, run.expiresAt, now),
                  })}
                </span>
              </PanelRow>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function WorkInProgress({
  wip,
  now,
}: {
  wip: ReadonlyArray<WipView>
  now: number
}) {
  const locale = useLocale()
  const t = useTranslate()
  const ordered = orderWip(wip)

  return (
    <Panel
      label={t('console.runs.wip.label')}
      count={formatNumber(ordered.length, locale)}
      flush
    >
      {ordered.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<GitBranch />}
            title={t('console.runs.wip.empty.title')}
            description={t('console.runs.wip.empty.body')}
          />
        </div>
      ) : (
        <ul>
          {ordered.map((entry) => (
            <li key={entry.issueId}>
              <PanelRow className="flex-wrap gap-x-3 gap-y-2">
                <span className="basis-full sm:min-w-0 sm:flex-1 sm:basis-auto">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label font-semibold text-ink">
                      #{entry.issueId}
                    </span>
                    {entry.orphaned ? (
                      <Badge tone="warning" size="sm" dot>
                        {t('console.runs.wip.orphaned')}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-ink-3">
                    {entry.branch}
                  </span>
                </span>
                <span className="ms-auto shrink-0 text-caption tabular-nums text-ink-4">
                  {t('console.runs.wip.meta', {
                    count: entry.commits,
                    commits: formatNumber(entry.commits, locale),
                    elapsed: formatElapsed(now - entry.updatedAt),
                  })}
                </span>
              </PanelRow>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function RecentRuns({
  runs,
  now,
}: {
  runs: ReadonlyArray<RunView>
  now: number
}) {
  const locale = useLocale()
  const t = useTranslate()
  return (
    <Panel
      label={t('console.runs.recent.label')}
      count={formatNumber(runs.length, locale)}
      flush
    >
      {runs.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<History />}
            title={t('console.runs.recent.empty.title')}
            description={t('console.runs.recent.empty.body')}
          />
        </div>
      ) : (
        <ul>
          {runs.map((run) => (
            <li key={run.runId}>
              <PanelRow className="flex-wrap gap-x-3 gap-y-2">
                <span className="basis-full sm:min-w-0 sm:flex-1 sm:basis-auto">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label font-semibold text-ink">
                      {run.runId}
                    </span>
                    <Badge tone={STATUS_TONE[run.status]} size="sm" dot>
                      {run.status}
                    </Badge>
                  </span>
                  {run.summary === '' ? null : (
                    <span className="mt-0.5 block truncate text-caption text-ink-3">
                      {run.summary}
                    </span>
                  )}
                </span>
                <span className="ms-auto shrink-0 text-caption tabular-nums text-ink-4">
                  {t('console.runs.ago', {
                    elapsed: formatElapsed(now - run.lastHeartbeatAt),
                  })}
                </span>
              </PanelRow>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/**
 * Production, and the answer it deserves.
 *
 * Not an error and not an empty fleet: this deployment has no registry binding because exactly one
 * deployment may have it. Saying so is the only way an operator can tell "nothing is running" apart
 * from "you are looking in the wrong place".
 */
function NotTheCoordinator() {
  const t = useTranslate()
  return (
    <Card className="bg-surface-2">
      <EmptyState
        icon={<CloudOff />}
        title={t('console.runs.notCoordinator.title')}
        description={t('console.runs.notCoordinator.body')}
      />
    </Card>
  )
}

function SandcastlePending() {
  return (
    <div className="flex flex-col gap-6">
      <StatsSkeleton />
      <Card padding="none" className="bg-surface-2">
        <RowsSkeleton rows={3} />
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        {[0, 1].map((index) => (
          <Card key={index} className="flex flex-col gap-3 bg-surface-2">
            <Skeleton className="h-3 w-28" radius="sm" />
            <Skeleton className="h-24 w-full" radius="lg" />
          </Card>
        ))}
      </div>
    </div>
  )
}
