import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Library,
  Radar,
  ShieldCheck,
  UserRoundX,
  Users,
  Wrench,
} from 'lucide-react'

import { ErrorPanel } from '#/components/layout/error-state'
import {
  AccountIdentity,
  PLATFORM_ROLE_VOCABULARY,
  PlatformRoleBadge,
  displayPlatformRole,
} from '#/components/console'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  StatCard,
} from '#/components/ui'
import { loadConsoleOverview } from './-server/overview'
import { formatDate, formatNumber } from '../-lib/format'
import { Panel, PanelRow, RowsSkeleton, StatsSkeleton } from '../-ui/scaffold'

import type { ConsoleOverview } from './-server/overview'

/**
 * What the platform looks like from above.
 *
 * Two halves with two different reasons to exist. The accounts half is live and is `admin`-only —
 * `user:list` sits in the `admin` column alone (`docs/ACCESS.md` §2.1), so a `curator` never asks
 * for it and the loader does not call for it. The catalogue half is not built yet: the nine global
 * tables of `docs/SPEC.md` §5 land with the ingestion pipeline, and until they do these panels have
 * nothing to count.
 *
 * **They are still designed, and they are not zeros.** A tile reading `0 places` is a claim that the
 * catalogue is empty, which is a different statement from "the catalogue does not exist yet", and it
 * is the statement a reader would act on. Each panel therefore says what it will hold and what has
 * to happen first — which is also the answer to the reference screen's four inert KPI cards, where
 * `0 Files` carries exactly the same weight as `36 Places` and neither can be clicked.
 */
export const Route = createFileRoute('/_app/console/')({
  loader: async ({ context }): Promise<ConsoleOverview | null> =>
    context.consoleAccess.canManageUsers ? await loadConsoleOverview() : null,
  pendingComponent: OverviewPending,
  errorComponent: ({ error }) => (
    <ErrorPanel
      className="bg-surface-2"
      error={error}
      title="The overview did not load"
    />
  ),
  component: ConsoleOverviewPage,
})

function ConsoleOverviewPage() {
  const data = Route.useLoaderData()
  const { consoleAccess } = Route.useRouteContext()

  return (
    <div className="flex flex-col gap-6">
      {data === null ? (
        <CuratorStanding role={consoleAccess.role} />
      ) : (
        <>
          <AccountStats overview={data} />
          <NewestAccounts overview={data} />
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel label="Catalogue by status">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<Library />}
            tone="brand"
            title="The global catalogue is not open yet"
            description="Once the ingestion pipeline lands, this panel counts every place in the shared catalogue as draft, in review or published — and each count opens the list behind it."
          />
        </Panel>

        <Panel label="Scraping runs">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<Radar />}
            title="No source has been run"
            description="Sources are scraped on a weekly schedule. When the first run finishes, the last five appear here with what each one ingested, changed and rejected."
          />
        </Panel>
      </div>
    </div>
  )
}

/** The standing a curator holds, said plainly, since the accounts half is not theirs. */
function CuratorStanding({ role }: { role: 'admin' | 'curator' | 'user' }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <PlatformRoleBadge role={role} />
        <p className="text-label font-semibold text-ink">
          Your standing on the platform
        </p>
      </div>
      <p className="max-w-prose text-label leading-relaxed text-ink-3">
        {PLATFORM_ROLE_VOCABULARY[role].summary} Accounts, sessions and
        impersonation belong to a platform admin, so the console shows you the
        catalogue and nothing else.
      </p>
    </Card>
  )
}

function AccountStats({ overview }: { overview: ConsoleOverview }) {
  const { counts } = overview
  const staff = counts.admins + counts.curators

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="inverse"
        icon={<Users />}
        label="Accounts"
        value={formatNumber(counts.total)}
        caption={
          staff === 1
            ? 'One of them holds a platform role'
            : `${formatNumber(staff)} of them hold a platform role`
        }
      />
      <StatCard
        icon={<ShieldCheck />}
        label="Admins"
        value={formatNumber(counts.admins)}
        caption="Full authority over accounts and sessions"
      />
      <StatCard
        icon={<Wrench />}
        label="Curators"
        value={formatNumber(counts.curators)}
        caption="The catalogue only — never accounts"
      />
      <StatCard
        icon={<UserRoundX />}
        label="Suspended"
        value={formatNumber(counts.suspended)}
        valueTone={counts.suspended === 0 ? 'default' : 'danger'}
        caption={
          counts.suspended === 0
            ? 'Nobody is locked out'
            : 'Signed out everywhere until a ban is lifted'
        }
        footer={
          counts.suspended === 0 ? undefined : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              shape="pill"
              className="-ml-3"
            >
              <Link to="/console/users" search={{ status: 'suspended' }}>
                Review them
              </Link>
            </Button>
          )
        }
      />
    </div>
  )
}

function NewestAccounts({ overview }: { overview: ConsoleOverview }) {
  return (
    <Panel
      label="Newest accounts"
      count={formatNumber(overview.newest.length)}
      flush
      action={
        <Button asChild variant="secondary" size="sm" shape="pill">
          <Link to="/console/users">All accounts</Link>
        </Button>
      }
    >
      {overview.newest.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<Users />}
            title="No accounts yet"
            description="The first person to register appears here."
          />
        </div>
      ) : (
        <ul>
          {overview.newest.map((account) => (
            <li key={account.id}>
              <PanelRow className="flex-wrap gap-x-3 gap-y-2.5">
                {/* Full width on a phone, then the standing and the date wrap
                    onto a second line: at 360px the three of them on one row
                    left the name and the address as five characters and an
                    ellipsis, which is the one thing this row exists to say. */}
                <AccountIdentity
                  className="basis-full sm:min-w-0 sm:flex-1 sm:basis-auto"
                  name={account.name}
                  email={account.email}
                  image={account.image}
                  emailVerified={account.emailVerified}
                  nameAs={(label) => (
                    <Link
                      to="/console/users/$userId"
                      params={{ userId: account.id }}
                      className="rounded-sm underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-base ease-out-quint hover:decoration-ink-4 focus-ring"
                    >
                      {label}
                    </Link>
                  )}
                />
                <PlatformRoleBadge
                  role={displayPlatformRole(account.role)}
                  size="sm"
                />
                {account.banned ? (
                  <Badge tone="danger" size="sm" dot>
                    Suspended
                  </Badge>
                ) : null}
                <span className="ml-auto shrink-0 text-caption tabular-nums text-ink-4">
                  {formatDate(account.createdAt) ?? '—'}
                </span>
              </PanelRow>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function OverviewPending() {
  return (
    <div className="flex flex-col gap-6">
      <StatsSkeleton />
      <Card padding="none" className="bg-surface-2">
        <RowsSkeleton rows={4} />
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
