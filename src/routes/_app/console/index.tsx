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
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadConsoleOverview } from './-server/overview'
import { formatDate, formatNumber } from '../-lib/format'
import { Panel, PanelRow, RowsSkeleton, StatsSkeleton } from '../-ui/scaffold'

import type { ConsoleOverview } from './-server/overview'
import type { ErrorComponentProps } from '@tanstack/react-router'

/**
 * What the platform looks like from above.
 *
 * Two halves with two different reasons to exist. The accounts half is live and is `admin`-only —
 * `user:list` sits in the `admin` column alone (`docs/ACCESS.md` §2.1), so a `curator` never asks
 * for it and the loader does not call for it. The catalogue half is not built yet: the eight
 * catalogue tables of `docs/SPEC.md` §5 land with the ingestion pipeline, and until they do these
 * panels have nothing to count.
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
  errorComponent: OverviewError,
  component: ConsoleOverviewPage,
})

function OverviewError({ error }: ErrorComponentProps) {
  const t = useTranslate()
  return (
    <ErrorPanel
      className="bg-surface-2"
      error={error}
      title={t('console.overview.error.title')}
    />
  )
}

function ConsoleOverviewPage() {
  const t = useTranslate()
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
        <Panel label={t('console.overview.catalogue.label')}>
          <EmptyState
            variant="filled"
            size="sm"
            icon={<Library />}
            tone="brand"
            title={t('console.overview.catalogue.empty.title')}
            description={t('console.overview.catalogue.empty.body')}
          />
        </Panel>

        <Panel label={t('console.overview.scraping.label')}>
          <EmptyState
            variant="filled"
            size="sm"
            icon={<Radar />}
            title={t('console.overview.scraping.empty.title')}
            description={t('console.overview.scraping.empty.body')}
          />
        </Panel>
      </div>
    </div>
  )
}

/** The standing a curator holds, said plainly, since the accounts half is not theirs. */
function CuratorStanding({ role }: { role: 'admin' | 'curator' | 'user' }) {
  const t = useTranslate()
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <PlatformRoleBadge role={role} />
        <p className="text-label font-semibold text-ink">
          {t('console.overview.standing.title')}
        </p>
      </div>
      <p className="max-w-prose text-label leading-relaxed text-ink-3">
        {t(PLATFORM_ROLE_VOCABULARY[role].summaryKey)}{' '}
        {t('console.overview.standing.body')}
      </p>
    </Card>
  )
}

function AccountStats({ overview }: { overview: ConsoleOverview }) {
  const locale = useLocale()
  const t = useTranslate()
  const { counts } = overview
  const staff = counts.admins + counts.curators

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="inverse"
        icon={<Users />}
        label={t('console.overview.stat.accounts')}
        value={formatNumber(counts.total, locale)}
        caption={t('console.overview.stat.accounts.caption', {
          count: staff,
          staff: formatNumber(staff, locale),
        })}
      />
      <StatCard
        icon={<ShieldCheck />}
        label={t('console.overview.stat.admins')}
        value={formatNumber(counts.admins, locale)}
        caption={t('console.overview.stat.admins.caption')}
      />
      <StatCard
        icon={<Wrench />}
        label={t('console.overview.stat.curators')}
        value={formatNumber(counts.curators, locale)}
        caption={t('console.overview.stat.curators.caption')}
      />
      <StatCard
        icon={<UserRoundX />}
        label={t('console.overview.stat.suspended')}
        value={formatNumber(counts.suspended, locale)}
        valueTone={counts.suspended === 0 ? 'default' : 'danger'}
        caption={
          counts.suspended === 0
            ? t('console.overview.stat.suspended.none')
            : t('console.overview.stat.suspended.some')
        }
        footer={
          counts.suspended === 0 ? undefined : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              shape="pill"
              className="-ms-3"
            >
              <Link to="/console/users" search={{ status: 'suspended' }}>
                {t('console.overview.stat.suspended.review')}
              </Link>
            </Button>
          )
        }
      />
    </div>
  )
}

function NewestAccounts({ overview }: { overview: ConsoleOverview }) {
  const locale = useLocale()
  const t = useTranslate()
  return (
    <Panel
      label={t('console.overview.newest.label')}
      count={formatNumber(overview.newest.length, locale)}
      flush
      action={
        <Button asChild variant="secondary" size="sm" shape="pill">
          <Link to="/console/users">{t('console.shell.allAccounts')}</Link>
        </Button>
      }
    >
      {overview.newest.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<Users />}
            title={t('console.overview.newest.empty.title')}
            description={t('console.overview.newest.empty.body')}
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
                    {t('console.status.suspended')}
                  </Badge>
                ) : null}
                <span className="ms-auto shrink-0 text-caption tabular-nums text-ink-4">
                  {formatDate(account.createdAt, locale) ?? '—'}
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
