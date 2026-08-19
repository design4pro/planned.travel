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
import { formatStorage } from '#/lib/plans'
import { loadAdmin } from './-server/overview'
import {
  formatDate,
  formatNumber,
  formatRelative,
  humaniseToken,
  pluralise,
} from './-lib/format'
import {
  HeaderSkeleton,
  Panel,
  PanelRow,
  RowsSkeleton,
  StatsSkeleton,
} from './-ui/scaffold'

const ROLE_TONE: Record<string, 'accent' | 'brand' | 'neutral'> = {
  owner: 'accent',
  admin: 'brand',
  member: 'neutral',
}

export const Route = createFileRoute('/_app/admin')({
  loader: () => loadAdmin(),
  pendingComponent: AdminPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="The admin console did not load" />
    </AppFrame>
  ),
  component: AdminPage,
})

function AdminPage() {
  const data = Route.useLoaderData()
  const { shell } = Route.useRouteContext()
  const now = Date.now()

  if (!shell.session.user.isAdmin) {
    return (
      <AppFrame>
        <Card variant="dashed" padding="none">
          <EmptyState
            size="lg"
            icon={<ShieldCheck />}
            title="Only workspace admins can open this"
            description="Ask an owner or an admin of this workspace to change your role if you need it."
            action={
              <Button asChild variant="primary" shape="pill">
                <Link to="/dashboard">Back to the dashboard</Link>
              </Button>
            }
          />
        </Card>
      </AppFrame>
    )
  }

  const storage = data.limits.find((row) => row.metric === 'storage_bytes')

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow="Workspace admin"
          title={data.organization.name}
          description={`${humaniseToken(data.plan)} plan · created ${formatDate(data.organization.createdAt) ?? 'recently'}`}
          actions={
            <>
              <Button asChild variant="secondary" size="sm" shape="pill">
                <Link to="/settings/organization">
                  <Building2 aria-hidden />
                  Workspace settings
                </Link>
              </Button>
              <Button asChild variant="primary" size="sm" shape="pill">
                <Link to="/settings/billing">Plan &amp; billing</Link>
              </Button>
            </>
          }
        />

        {data.pendingInvitations === 0 ? null : (
          <Alert
            tone="info"
            title={`${pluralise(data.pendingInvitations, 'invitation')} still outstanding`}
            actions={
              <Button asChild variant="secondary" size="sm" shape="pill">
                <Link to="/settings/organization">Review invitations</Link>
              </Button>
            }
          >
            Every outstanding invitation counts against the seats your plan pays
            for.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            tone="inverse"
            icon={<Users />}
            label="Members"
            value={data.members.length}
            caption={`${formatNumber(data.pendingInvitations)} invitations pending`}
          />
          <StatCard
            icon={<Database />}
            label="Storage"
            value={storage === undefined ? '—' : formatStorage(storage.used)}
            unit={
              storage === undefined
                ? undefined
                : `of ${storage.limit === null ? 'unlimited' : formatStorage(storage.limit)}`
            }
            caption="Files, photos and exports"
          />
          <StatCard
            icon={<Activity />}
            label="Audit entries"
            value={data.audit.length}
            caption="Most recent activity shown below"
          />
          <StatCard
            icon={<ShieldCheck />}
            label="Plan"
            value={humaniseToken(data.plan)}
            caption="Quotas are enforced at the repository boundary"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <Panel
              label="Quotas"
              count={pluralise(data.limits.length, 'metric')}
            >
              <ul className="flex flex-col gap-4">
                {data.limits.map((row) => {
                  const isStorage = row.metric === 'storage_bytes'
                  const used = isStorage
                    ? formatStorage(row.used)
                    : formatNumber(row.used)
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
                          label={humaniseToken(row.metric)}
                          valueText={`${used} / Unlimited`}
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
                        label={humaniseToken(row.metric)}
                        valueText={
                          isStorage
                            ? `${used} / ${formatStorage(row.limit)}`
                            : `${used} / ${formatNumber(row.limit)}`
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel
              label="Members"
              count={formatNumber(data.members.length)}
              flush
              bodyClassName="p-0"
            >
              <Table label="Members of this workspace" fixed>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead className="w-28">Role</TableHead>
                    <TableHead className="w-32">Joined</TableHead>
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
                          {humaniseToken(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell muted>{formatDate(member.joinedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <Panel
              label="Recent activity"
              count={
                data.audit.length === 0
                  ? undefined
                  : formatNumber(data.audit.length)
              }
              flush
            >
              {data.audit.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyState
                    size="sm"
                    icon={<ScrollText />}
                    title="Nothing recorded yet"
                    description="Every write that matters is appended to the audit trail as it happens."
                  />
                </div>
              ) : (
                <ul>
                  {data.audit.map((row) => (
                    <li key={row.id}>
                      <PanelRow>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-caption text-ink-2">
                            {row.action}
                          </p>
                          <p className="truncate text-caption text-ink-4">
                            {row.entityType === null
                              ? 'workspace'
                              : `${row.entityType}${row.entityId === null ? '' : ` · ${row.entityId.slice(0, 8)}`}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-caption tabular-nums text-ink-4">
                          {formatRelative(row.createdAt, now)}
                        </span>
                      </PanelRow>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {data.actionCounts.length === 0 ? null : (
              <Panel
                label="Busiest actions"
                count={pluralise(data.actionCounts.length, 'action')}
              >
                <ul className="flex flex-col gap-3">
                  {data.actionCounts.map((row) => (
                    <li key={row.action}>
                      <Progress
                        value={row.value}
                        max={Math.max(data.actionCounts[0]?.value ?? 1, 1)}
                        size="xs"
                        tone="accent"
                        label={<span className="font-mono">{row.action}</span>}
                        valueText={formatNumber(row.value)}
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
          <Card padding="none">
            <RowsSkeleton rows={6} />
          </Card>
          <Card padding="none">
            <RowsSkeleton rows={4} />
          </Card>
        </div>
      </AppSections>
    </AppFrame>
  )
}
