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
import { loadSandcastleRegistry } from './-server/sandcastle'
import { formatNumber } from '../-lib/format'
import { Panel, PanelRow, RowsSkeleton, StatsSkeleton } from '../-ui/scaffold'

import type { SandcastleRegistryView } from './-server/sandcastle'
import type { BadgeTone } from '#/components/ui'
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
  errorComponent: ({ error }) => (
    <ErrorPanel
      className="bg-surface-2"
      error={error}
      title="The run registry did not answer"
    />
  ),
  component: SandcastlePage,
})

const ORIGIN_LABEL: Record<SandcastleOrigin, string> = {
  local: 'Local',
  'github-actions': 'GitHub Actions',
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
  const summary = summariseFleet(state)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          tone="inverse"
          icon={<Radio />}
          label="Live runs"
          value={formatNumber(summary.liveRuns)}
          caption={
            summary.liveRuns === 0
              ? 'Nothing is building right now'
              : 'Heartbeating against a five-minute lease'
          }
        />
        <StatCard
          icon={<ListChecks />}
          label="Issues held"
          value={formatNumber(summary.issuesHeld)}
          caption="Leased to one run each, ancestors and sub-issues included"
        />
        <StatCard
          icon={<GitBranch />}
          label="Orphaned branches"
          value={formatNumber(summary.orphanedBranches)}
          valueTone={summary.orphanedBranches === 0 ? 'default' : 'warning'}
          caption={
            summary.orphanedBranches === 0
              ? 'No work is sitting unclaimed'
              : 'Commits from a run that stopped, waiting to be adopted'
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
  return (
    <Panel label="Live runs" count={formatNumber(runs.length)} flush>
      {runs.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<Castle />}
            title="No run is registered"
            description="A run appears here the moment it registers — from this machine, from another, or from a GitHub Actions runner — with the issues it has claimed."
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
                      {ORIGIN_LABEL[run.origin]}
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
                    ? 'holds nothing'
                    : `holds ${run.issues.map((id) => `#${id}`).join(', ')}`}
                </span>

                <span className="ml-auto shrink-0 text-caption tabular-nums text-ink-4">
                  {formatElapsed(now - run.startedAt)} up ·{' '}
                  {formatLease(run.expiresAt, now)}
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
  const ordered = orderWip(wip)

  return (
    <Panel label="Work in progress" count={formatNumber(ordered.length)} flush>
      {ordered.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<GitBranch />}
            title="No branch is carrying work"
            description="A run records its branch as soon as it has commits on it, so that if the run dies the next one to claim the issue is offered the work instead of starting it again."
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
                        Orphaned
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-ink-3">
                    {entry.branch}
                  </span>
                </span>
                <span className="ml-auto shrink-0 text-caption tabular-nums text-ink-4">
                  {formatNumber(entry.commits)} commit
                  {entry.commits === 1 ? '' : 's'} ·{' '}
                  {formatElapsed(now - entry.updatedAt)} ago
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
  return (
    <Panel label="Recently finished" count={formatNumber(runs.length)} flush>
      {runs.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<History />}
            title="No run has finished yet"
            description="The last fifty runs are kept here with how each one ended."
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
                <span className="ml-auto shrink-0 text-caption tabular-nums text-ink-4">
                  {formatElapsed(now - run.lastHeartbeatAt)} ago
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
  return (
    <Card className="bg-surface-2">
      <EmptyState
        icon={<CloudOff />}
        title="This deployment does not coordinate the fleet"
        description="The run registry is bound on staging alone, and deliberately: a second registry would let two fleets each believe they hold the backlog, which is the one thing it exists to prevent. Read the fleet on staging."
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
