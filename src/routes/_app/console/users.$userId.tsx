import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  Minus,
  MonitorSmartphone,
  TriangleAlert,
} from 'lucide-react'

import { ErrorPanel } from '#/components/layout/error-state'
import {
  AccountIdentity,
  AccountStatus,
  PLATFORM_ROLE_VOCABULARY,
  PlatformRoleBadge,
  describeUserAgent,
  displayPlatformRole,
  formatConsoleInstant,
} from '#/components/console'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { loadConsoleAccount } from './-server/users'
import { RevokeSessionButton } from './-ui/session-actions'
import { UserActions } from './-ui/user-actions'
import { formatDate, formatNumber, trimmedOrNull } from '../-lib/format'
import { MetaGrid, Panel, RowsSkeleton } from '../-ui/scaffold'

import type { ConsoleSession } from '#/server/fns/console/projections'

/**
 * One account, and everything the console can currently say about it.
 *
 * Composed from the same primitives `src/routes/_app/admin.tsx` uses — `PageHeader` upstairs in the
 * console shell, then `Panel`, `MetaGrid`, `Table`, `Badge` and `EmptyState` — rather than from a
 * second arrangement invented for this screen. The reference has no per-account page at all: it
 * edits a row inline behind a pencil, so a suspension has no reason beside it, a session has nowhere
 * to be listed, and there is no address for "this person" to send anybody to.
 *
 * **Two reads behind one call.** `loadConsoleAccount` runs `getPlatformUserFn` and
 * `listPlatformSessionsFn` together: both pass `requirePermission` and both project their rows
 * before they leave the server — a `session` row's `token` is the live credential and never crosses
 * the wire. Neither read is audited: `docs/ACCESS.md` §4.2 closes the vocabulary at thirty-one
 * mutations and says in as many words that reads are not among them.
 */
export const Route = createFileRoute('/_app/console/users/$userId')({
  loader: async ({ params }) =>
    await loadConsoleAccount({ data: { userId: params.userId } }),
  pendingComponent: AccountPending,
  errorComponent: ({ error }) => (
    <ErrorPanel
      className="bg-surface-2"
      error={error}
      title="That account did not load"
    />
  ),
  component: ConsoleAccountPage,
})

function ConsoleAccountPage() {
  const { account, sessions, truncated } = Route.useLoaderData()
  const { shell } = Route.useRouteContext()
  const router = useRouter()
  const role = displayPlatformRole(account.role)
  const self = account.id === shell.session.user.id

  async function refresh(): Promise<void> {
    await router.invalidate()
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        icon={<ArrowLeft />}
        className="-ml-3 self-start"
      >
        <Link to="/console/users">All accounts</Link>
      </Button>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <AccountIdentity
            className="min-w-0 flex-1"
            size="xl"
            name={account.name}
            email={account.email}
            image={account.image}
            emailVerified={account.emailVerified}
            self={self}
          />
          <div className="flex shrink-0 items-center gap-2">
            <PlatformRoleBadge role={role} size="lg" />
            <UserActions user={account} self={self} onChanged={refresh} />
          </div>
        </div>

        <p className="max-w-prose text-label leading-relaxed text-ink-3">
          {PLATFORM_ROLE_VOCABULARY[role].summary}
        </p>

        <MetaGrid
          columns={4}
          items={[
            {
              label: 'Status',
              value: (
                <AccountStatus
                  banned={account.banned}
                  banExpiresAt={account.banExpiresAt}
                />
              ),
            },
            {
              label: 'Joined',
              value: (
                <span className="tabular-nums">
                  {formatDate(account.createdAt) ?? '—'}
                </span>
              ),
            },
            {
              label: 'Last change',
              value: (
                <span className="tabular-nums">
                  {formatDate(account.updatedAt) ?? '—'}
                </span>
              ),
            },
            {
              label: 'Account id',
              value: (
                <span className="block truncate font-mono text-caption">
                  {account.id}
                </span>
              ),
            },
          ]}
        />
      </Card>

      {account.banned ? (
        <Alert
          tone="danger"
          icon={<TriangleAlert />}
          title="This account is suspended"
        >
          {account.banReason === null
            ? 'No reason was recorded with the suspension.'
            : account.banReason}
          {account.banExpiresAt === null
            ? ' It stays in force until an admin lifts it.'
            : ` It lifts itself on ${formatDate(account.banExpiresAt) ?? 'its expiry date'}.`}
        </Alert>
      ) : null}

      <AuthorityPanel role={role} />

      <SessionsPanel
        userId={account.id}
        sessions={sessions}
        truncated={truncated}
        onChanged={refresh}
      />
    </div>
  )
}

/**
 * What this account's role means, spelled out rather than left to a badge.
 *
 * The reference answers the same question with a screen-wide grid of permission toggles, which is
 * the configuration and not the consequence: a reader looking at one person still has to hold three
 * roles in their head to work out what that person can do. This is the consequence, for the one
 * account on screen, in both directions.
 */
function AuthorityPanel({ role }: { role: 'admin' | 'curator' | 'user' }) {
  const { holds, withheld } = PLATFORM_ROLE_VOCABULARY[role]
  return (
    <Panel label="Platform authority">
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <AuthorityList
          heading="May"
          items={holds}
          empty="Nothing on the platform."
          granted
        />
        <AuthorityList heading="May not" items={withheld} empty="" />
      </div>
    </Panel>
  )
}

function AuthorityList({
  heading,
  items,
  empty,
  granted = false,
}: {
  readonly heading: string
  readonly items: ReadonlyArray<string>
  readonly empty: string
  readonly granted?: boolean
}) {
  if (items.length === 0 && empty.length === 0) {
    return null
  }
  return (
    <div className="min-w-0">
      <p className="mb-2.5 text-micro font-semibold uppercase tracking-label text-ink-4">
        {heading}
      </p>
      {items.length === 0 ? (
        <p className="text-label text-ink-3">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full [&_svg]:size-3',
                  granted
                    ? 'bg-brand-subtle text-brand'
                    : 'bg-surface-inset text-ink-4',
                )}
              >
                {granted ? <Check strokeWidth={3} /> : <Minus strokeWidth={3} />}
              </span>
              <span className="min-w-0 text-label leading-relaxed text-ink-2">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SessionsPanel({
  userId,
  sessions,
  truncated,
  onChanged,
}: {
  readonly userId: string
  readonly sessions: ReadonlyArray<ConsoleSession>
  readonly truncated: boolean
  readonly onChanged: () => Promise<void>
}) {
  return (
    <Panel
      label="Live sessions"
      count={sessions.length === 0 ? undefined : formatNumber(sessions.length)}
      flush
      toolbar={
        truncated ? (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-caption text-warning">
            This account holds more sessions than one call lists. Revoke every
            session from the actions menu to be sure none is left behind.
          </p>
        ) : undefined
      }
    >
      {sessions.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<MonitorSmartphone />}
            title="Signed out everywhere"
            description="This account holds no session that has not expired. It will appear here the moment it signs in again."
          />
        </div>
      ) : (
        <>
          <div className="hidden sm:block">
            <Table label="Live sessions" fixed>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead className="w-36">Address</TableHead>
                  <TableHead className="w-36">Started</TableHead>
                  <TableHead className="w-36">Expires</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell truncate>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium text-ink">
                          {describeUserAgent(session.userAgent)}
                        </span>
                        {session.impersonatedBy === null ? null : (
                          <span className="truncate text-caption text-warning">
                            Minted by impersonation
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell muted truncate className="font-mono text-caption">
                      {trimmedOrNull(session.ipAddress) ?? 'Not recorded'}
                    </TableCell>
                    <TableCell muted className="tabular-nums">
                      {formatConsoleInstant(session.createdAt)}
                    </TableCell>
                    <TableCell muted className="tabular-nums">
                      {formatConsoleInstant(session.expiresAt)}
                    </TableCell>
                    <TableCell className="pr-1 text-right">
                      <RevokeSessionButton
                        userId={userId}
                        sessionId={session.id}
                        describedAs={describeUserAgent(session.userAgent)}
                        onRevoked={onChanged}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col sm:hidden">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-start gap-3 px-4 py-4 not-last:border-b not-last:border-edge-faint"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label font-medium text-ink">
                    {describeUserAgent(session.userAgent)}
                  </p>
                  <p className="truncate font-mono text-caption text-ink-3">
                    {trimmedOrNull(session.ipAddress) ?? 'Address not recorded'}
                  </p>
                  <p className="mt-1 text-caption tabular-nums text-ink-4">
                    Started {formatConsoleInstant(session.createdAt)} · expires{' '}
                    {formatConsoleInstant(session.expiresAt)}
                  </p>
                </div>
                <RevokeSessionButton
                  userId={userId}
                  sessionId={session.id}
                  describedAs={describeUserAgent(session.userAgent)}
                  onRevoked={onChanged}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

function AccountPending() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5 bg-surface-2">
        <span className="sr-only">Loading the account</span>
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 shrink-0" radius="full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-44" radius="sm" />
            <Skeleton className="h-3 w-60" radius="sm" />
          </div>
          <Skeleton className="h-7 w-24 shrink-0" radius="full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-14 w-full" radius="md" />
          ))}
        </div>
      </Card>
      <Card padding="none" className="bg-surface-2">
        <RowsSkeleton rows={3} />
      </Card>
    </div>
  )
}
