import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  Building2,
  Database,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Progress,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui'
import { useI18n, useTranslate } from '#/lib/i18n'
import { formatStorage, planFromUnknown } from '#/lib/plans'
import { loadAdmin } from './-server/overview'
import { formatDate, formatNumber, formatRelative } from './-lib/format'
import {
  HeaderSkeleton,
  Panel,
  PanelRow,
  RowsSkeleton,
  StatsSkeleton,
} from './-ui/scaffold'

import type { MessageKey, Translate } from '#/lib/i18n'

const ROLE_TONE: Record<string, 'accent' | 'brand' | 'neutral'> = {
  owner: 'accent',
  admin: 'brand',
  member: 'neutral',
}

/**
 * The workspace roles and the quota metrics, as message keys.
 *
 * Both are closed sets in `src/server/auth/tenant.ts` and `resolveQuotas`, so
 * the tables are total. A token a later migration adds falls through to itself —
 * a reportable data value rather than an English word posing as translated copy.
 */
const ROLE_LABEL: Record<string, MessageKey | undefined> = {
  owner: 'shell.role.owner',
  admin: 'shell.role.admin',
  member: 'shell.role.member',
}

const METRIC_LABEL: Record<string, MessageKey | undefined> = {
  trips: 'shell.metric.trips',
  places: 'shell.metric.places',
  members: 'shell.metric.members',
  files: 'shell.metric.files',
  storage_bytes: 'shell.metric.storage_bytes',
  collections: 'shell.metric.collections',
  journeys: 'shell.metric.journeys',
}

function labelFor(
  table: Record<string, MessageKey | undefined>,
  token: string,
  t: Translate,
): string {
  const key = table[token]
  return key === undefined ? token : t(key)
}

export const Route = createFileRoute('/_app/admin')({
  loader: () => loadAdmin(),
  pendingComponent: AdminPending,
  errorComponent: AdminError,
  component: AdminPage,
})

function AdminError({ error }: { error: unknown }) {
  const t = useTranslate()
  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('shell.admin.error')} />
    </AppFrame>
  )
}

function AdminPage() {
  const data = Route.useLoaderData()
  const { shell } = Route.useRouteContext()
  const { t, locale } = useI18n()
  const now = Date.now()

  if (!shell.session.user.isAdmin) {
    return (
      <AppFrame>
        <Card variant="dashed" padding="none" className="bg-surface-2">
          <EmptyState
            size="lg"
            icon={<ShieldCheck />}
            title={t('shell.admin.denied.title')}
            description={t('shell.admin.denied.body')}
            action={
              <Button asChild variant="primary" shape="pill">
                <Link to="/dashboard">{t('shell.admin.denied.action')}</Link>
              </Button>
            }
          />
        </Card>
      </AppFrame>
    )
  }

  const storage = data.limits.find((row) => row.metric === 'storage_bytes')
  // The plan's own name is a product name, not copy: it lives in
  // `src/lib/plans.ts` and reads the same in every locale.
  const planName = planFromUnknown(data.plan)?.name ?? data.plan

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow={t('shell.admin.eyebrow')}
          title={data.organization.name}
          description={t('shell.admin.description', {
            plan: planName,
            date:
              formatDate(data.organization.createdAt, locale) ??
              t('shell.admin.createdUnknown'),
          })}
          actions={
            <>
              <Button asChild variant="secondary" size="sm" shape="pill">
                <Link to="/settings/organization">
                  <Building2 aria-hidden />
                  {t('shell.admin.workspaceSettings')}
                </Link>
              </Button>
              <Button asChild variant="primary" size="sm" shape="pill">
                <Link to="/settings/billing">{t('shell.admin.billing')}</Link>
              </Button>
            </>
          }
        />

        {data.pendingInvitations === 0 ? null : (
          <Alert
            tone="info"
            title={t('shell.admin.invitations.title', {
              count: data.pendingInvitations,
              invitations: formatNumber(data.pendingInvitations, locale),
            })}
            actions={
              <Button asChild variant="secondary" size="sm" shape="pill">
                <Link to="/settings/organization">
                  {t('shell.admin.invitations.action')}
                </Link>
              </Button>
            }
          >
            {t('shell.admin.invitations.body')}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            tone="inverse"
            icon={<Users />}
            label={t('shell.admin.stat.members')}
            value={formatNumber(data.members.length, locale)}
            caption={t('shell.admin.stat.membersCaption', {
              count: data.pendingInvitations,
              invitations: formatNumber(data.pendingInvitations, locale),
            })}
          />
          <StatCard
            icon={<Database />}
            label={t('shell.admin.stat.storage')}
            value={storage === undefined ? '—' : formatStorage(storage.used)}
            unit={
              storage === undefined
                ? undefined
                : t('shell.admin.stat.storageUnit', {
                    limit:
                      storage.limit === null
                        ? t('shell.admin.stat.storageUnlimited')
                        : formatStorage(storage.limit),
                  })
            }
            caption={t('shell.admin.stat.storageCaption')}
          />
          <StatCard
            icon={<Activity />}
            label={t('shell.admin.stat.audit')}
            value={formatNumber(data.audit.length, locale)}
            caption={t('shell.admin.stat.auditCaption')}
          />
          <StatCard
            icon={<ShieldCheck />}
            label={t('shell.admin.stat.plan')}
            value={planName}
            caption={t('shell.admin.stat.planCaption')}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <Panel
              label={t('shell.admin.quotas.label')}
              count={t('shell.admin.quotas.count', {
                count: data.limits.length,
                metrics: formatNumber(data.limits.length, locale),
              })}
            >
              <ul className="flex flex-col gap-4">
                {data.limits.map((row) => {
                  const isStorage = row.metric === 'storage_bytes'
                  const used = isStorage
                    ? formatStorage(row.used)
                    : formatNumber(row.used, locale)
                  // An uncapped metric arrives as `null`, and a bar with no ceiling has
                  // no ratio to draw: show it filled, the way the billing meters do,
                  // rather than a red bar against a ceiling of one.
                  if (row.limit === null) {
                    return (
                      <li key={row.metric}>
                        <Progress
                          value={1}
                          max={1}
                          size="sm"
                          tone="brand"
                          label={labelFor(METRIC_LABEL, row.metric, t)}
                          valueText={t('shell.admin.quotas.value', {
                            used,
                            limit: t('shell.admin.quotas.unlimited'),
                          })}
                        />
                      </li>
                    )
                  }
                  const limit = Math.max(row.limit, 1)
                  const ratio = row.used / limit
                  return (
                    <li key={row.metric}>
                      <Progress
                        value={row.used}
                        max={limit}
                        size="sm"
                        tone={
                          ratio > 0.9
                            ? 'danger'
                            : ratio > 0.7
                              ? 'warning'
                              : 'brand'
                        }
                        label={labelFor(METRIC_LABEL, row.metric, t)}
                        valueText={t('shell.admin.quotas.value', {
                          used,
                          limit: isStorage
                            ? formatStorage(row.limit)
                            : formatNumber(row.limit, locale),
                        })}
                      />
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel
              label={t('shell.admin.members.label')}
              count={formatNumber(data.members.length, locale)}
              flush
              bodyClassName="p-0"
            >
              <Table label={t('shell.admin.members.table')} fixed>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('shell.admin.members.person')}</TableHead>
                    <TableHead className="w-28">
                      {t('shell.admin.members.role')}
                    </TableHead>
                    {/* At 360px a fixed 128px date column left the person
                        column too narrow to hold a name, so the join date is
                        dropped there rather than truncated: `/settings/organization`
                        is where a member's history belongs anyway. */}
                    <TableHead className="hidden w-32 sm:table-cell">
                      {t('shell.admin.members.joined')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((member) => (
                    <TableRow key={member.memberId}>
                      <TableCell truncate>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            name={member.name}
                            src={member.image}
                            size="sm"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">
                              {member.name}
                            </span>
                            <span className="block truncate text-caption text-ink-3">
                              {member.email}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          tone={ROLE_TONE[member.role] ?? 'neutral'}
                          size="sm"
                        >
                          {labelFor(ROLE_LABEL, member.role, t)}
                        </Badge>
                      </TableCell>
                      <TableCell muted className="hidden sm:table-cell">
                        {formatDate(member.joinedAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <Panel
              label={t('shell.admin.activity.label')}
              count={
                data.audit.length === 0
                  ? undefined
                  : formatNumber(data.audit.length, locale)
              }
              flush
            >
              {data.audit.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyState
                    size="sm"
                    icon={<ScrollText />}
                    title={t('shell.admin.activity.empty.title')}
                    description={t('shell.admin.activity.empty.body')}
                  />
                </div>
              ) : (
                <ul>
                  {data.audit.map((row) => (
                    <li key={row.id}>
                      <PanelRow>
                        <div className="min-w-0 flex-1">
                          {/* An action name and an entity id are identifiers, not
                              copy: `code` sets them in the mono face and the
                              direction layer keeps them left-to-right in `ar`. */}
                          <code className="block truncate font-mono text-caption text-ink-2">
                            {row.action}
                          </code>
                          <p className="truncate text-caption text-ink-4">
                            {row.entityType === null ? (
                              t('shell.admin.activity.workspace')
                            ) : (
                              <code className="font-mono">
                                {row.entityType}
                                {row.entityId === null
                                  ? ''
                                  : ` · ${row.entityId.slice(0, 8)}`}
                              </code>
                            )}
                          </p>
                        </div>
                        <span
                          data-numeric
                          className="shrink-0 text-caption tabular-nums text-ink-4"
                        >
                          {formatRelative(row.createdAt, now, locale)}
                        </span>
                      </PanelRow>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {data.actionCounts.length === 0 ? null : (
              <Panel
                label={t('shell.admin.actions.label')}
                count={t('shell.admin.actions.count', {
                  count: data.actionCounts.length,
                  actions: formatNumber(data.actionCounts.length, locale),
                })}
              >
                <ul className="flex flex-col gap-3">
                  {data.actionCounts.map((row) => (
                    <li key={row.action}>
                      <Progress
                        value={row.value}
                        max={Math.max(data.actionCounts[0]?.value ?? 1, 1)}
                        size="xs"
                        tone="accent"
                        label={<code className="font-mono">{row.action}</code>}
                        valueText={formatNumber(row.value, locale)}
                      />
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </aside>
        </div>
      </AppSections>
    </AppFrame>
  )
}

function AdminPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <Card variant="inset" padding="none">
            <RowsSkeleton rows={6} />
          </Card>
          <Card variant="inset" padding="none">
            <RowsSkeleton rows={4} />
          </Card>
        </div>
      </AppSections>
    </AppFrame>
  )
}
