import {
  Link,
  createFileRoute,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  Building2,
  Check,
  CreditCard,
  History,
  Minus,
  MonitorSmartphone,
  TriangleAlert,
} from 'lucide-react'

import { ErrorPanel } from '#/components/layout/error-state'
import {
  AccountIdentity,
  AccountStatus,
  AuditChangeList,
  AuditDot,
  AuditActorBadge,
  PLATFORM_ROLE_VOCABULARY,
  PlatformRoleBadge,
  SubscriptionStatusBadge,
  describeAuditActor,
  describePlan,
  describePlatformAction,
  describeUserAgent,
  describeWorkspaceRole,
  displayPlatformRole,
  formatConsoleInstant,
  platformActionTone,
  readConsoleFailureDetail,
} from '#/components/console'
import {
  Alert,
  Badge,
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
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadConsoleAccount } from './-server/users'
import { RevokeSessionButton } from './-ui/session-actions'
import { UserActions } from './-ui/user-actions'
import { formatDate, formatNumber, trimmedOrNull } from '../-lib/format'
import { MetaGrid, MetaStrip, Panel, RowsSkeleton } from '../-ui/scaffold'

import type { ErrorComponentProps } from '@tanstack/react-router'
import type { MessageKey } from '#/lib/i18n'
import type { ConsoleAuditEntry } from '#/server/fns/console/account'
import type {
  ConsoleSubscription,
  ConsoleWorkspace,
} from './-server/account-billing'
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
 * **Four panels, from one loader call.** `loadConsoleAccount` runs `getPlatformUserFn`,
 * `listPlatformSessions` and `readAccountContext` together, then one billing statement over the
 * organization ids they returned: each passes `requirePermission` and each projects its rows before
 * they leave the server — a `session` row's `token` is the live credential and never crosses the
 * wire. None of them is audited: `docs/ACCESS.md` §4.2 closes the vocabulary at thirty-one mutations
 * and says in as many words that reads are not among them. No statement and no adapter read is
 * written under `src/routes/**`: the ledger query lives in `src/server/catalog/audit.ts` beside the
 * only writer of the table it reads, the `member` and `organization` reads go through Better Auth's
 * own adapter in `src/server/fns/console`, and the plan beside each workspace comes from the billing
 * repository.
 *
 * The four are the four questions an operator arrives with. *Where does this person belong* is the
 * workspaces panel, with the membership role beside each — the workspace vocabulary, which
 * `docs/SPEC.md` §5 forbids conflating with the platform one and which this screen is the one place
 * in the product to show side by side. *What is being paid* is the subscription panel, and only for
 * the workspaces this account owns, because a member of somebody else's crew workspace is not who it
 * bills. *What is signed in* is the sessions table. *What has been done* is the ledger, read from
 * `platform_audit_log` by `(entity_type, entity_id)` — §4.4's timeline query, and the stated reason
 * that table exists instead of a per-entity revision log.
 */
export const Route = createFileRoute('/_app/console/users/$userId')({
  /**
   * An id that names nobody is a `404`, not a `500`.
   *
   * `notFound()` here is what makes the console shell's `notFoundComponent` reachable — without it
   * that configuration was dead, and a mistyped id answered HTTP 500 under the copy "Nothing was
   * lost. Try again", which is advice that cannot work for an account that does not exist. The
   * refusal is not thrown by the server function any more: it reports the absence, and the decision
   * about what that means to a *route* is taken here.
   */
  loader: async ({ params }) => {
    const result = await loadConsoleAccount({
      data: { userId: params.userId },
    })
    if (!result.found) {
      throw notFound()
    }
    return result.detail
  },
  pendingComponent: AccountPending,
  errorComponent: AccountError,
  component: ConsoleAccountPage,
})

function AccountError({ error }: ErrorComponentProps) {
  const t = useTranslate()
  return (
    <ErrorPanel
      className="bg-surface-2"
      error={error}
      detail={readConsoleFailureDetail(error, t('console.failure.fallback'))}
      title={t('console.account.error.title')}
    />
  )
}

function ConsoleAccountPage() {
  const locale = useLocale()
  const t = useTranslate()
  const { account, sessions, truncated, context } = Route.useLoaderData()
  const { shell } = Route.useRouteContext()
  const router = useRouter()
  const role = displayPlatformRole(account.role)
  const self = account.id === shell.session.user.id

  async function refresh(): Promise<void> {
    await router.invalidate()
  }

  /**
   * Where to go once this account no longer exists.
   *
   * Never `refresh()`: the loader would re-run for the id that was just removed and settle on "That
   * account did not load" underneath an "Account deleted" toast — a screen whose two halves say
   * opposite things, measured on this page. The list is where the operator was, and it is still
   * there.
   */
  async function leaveAfterDelete(): Promise<void> {
    await router.navigate({ to: '/console/users', replace: true })
    await router.invalidate()
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        icon={<ArrowLeft />}
        className="-ms-3 self-start"
      >
        <Link to="/console/users">{t('console.shell.allAccounts')}</Link>
      </Button>

      <Card className="flex flex-col gap-5">
        {/* On a phone the identity takes the whole row and the standing wraps under it. Sharing the
            row left the name and the address about seventy pixels wide — "Mika Tan…" over an
            ellipsis — which is the one thing this card exists to say. */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <AccountIdentity
            className="min-w-0 basis-full sm:flex-1 sm:basis-auto"
            size="xl"
            name={account.name}
            email={account.email}
            image={account.image}
            emailVerified={account.emailVerified}
            self={self}
          />
          <div className="flex shrink-0 items-center gap-2">
            <PlatformRoleBadge role={role} size="lg" />
            <UserActions
              user={account}
              self={self}
              onChanged={refresh}
              onDeleted={leaveAfterDelete}
            />
          </div>
        </div>

        <p className="max-w-prose text-label leading-relaxed text-ink-3">
          {t(PLATFORM_ROLE_VOCABULARY[role].summaryKey)}
        </p>

        <MetaGrid
          columns={4}
          items={[
            {
              label: t('console.users.column.status'),
              value: (
                <AccountStatus
                  banned={account.banned}
                  banExpiresAt={account.banExpiresAt}
                />
              ),
            },
            {
              label: t('console.users.column.joined'),
              value: (
                <span className="tabular-nums">
                  {formatDate(account.createdAt, locale) ?? '—'}
                </span>
              ),
            },
            {
              label: t('console.account.meta.lastChange'),
              value: (
                <span className="tabular-nums">
                  {formatDate(account.updatedAt, locale) ?? '—'}
                </span>
              ),
            },
            {
              label: t('console.account.meta.id'),
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
          title={t('console.account.banned.title')}
        >
          {account.banReason === null
            ? t('console.account.banned.noReason')
            : account.banReason}
          {account.banExpiresAt === null
            ? t('console.account.banned.permanent')
            : t('console.account.banned.until', {
                date:
                  formatDate(account.banExpiresAt, locale) ??
                  t('console.account.banned.untilUnknown'),
              })}
        </Alert>
      ) : null}

      <AuthorityPanel role={role} />

      <WorkspacesPanel
        memberships={context.memberships}
        truncated={context.membershipsTruncated}
      />

      <SubscriptionPanel
        subscriptions={context.subscriptions}
        owns={context.memberships.some(
          (membership) => membership.role === 'owner',
        )}
      />

      <SessionsPanel
        userId={account.id}
        sessions={sessions}
        truncated={truncated}
        onChanged={refresh}
      />

      <AuditPanel entries={context.audit} truncated={context.auditTruncated} />
    </div>
  )
}

/**
 * The workspaces this account belongs to, and the role it holds inside each.
 *
 * The two vocabularies meet on this screen and nowhere else, so they are kept in different shapes
 * rather than different shades: the platform role is the glyphed weight ladder in the header card,
 * and the workspace role is plain text in a column headed "Role". `docs/SPEC.md` §5's rule is that
 * they must never be conflated, and two badges that differ only by tone is how that starts.
 *
 * The plan column is the workspace's, not this person's — it is here because "which workspace is
 * this, exactly" is the question a name and a slug half answer, and a `Business` beside a name is
 * the fastest way to tell two workspaces called "Design" apart.
 */
function WorkspacesPanel({
  memberships,
  truncated,
}: {
  readonly memberships: ReadonlyArray<ConsoleWorkspace>
  readonly truncated: boolean
}) {
  const locale = useLocale()
  const t = useTranslate()
  return (
    <Panel
      label={t('console.account.workspaces.label')}
      count={
        memberships.length === 0
          ? undefined
          : formatNumber(memberships.length, locale)
      }
      toolbar={
        truncated ? (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-caption text-ink-3">
            {t('console.account.workspaces.truncated', {
              listed: formatNumber(memberships.length, locale),
            })}
          </p>
        ) : undefined
      }
      flush
    >
      {memberships.length === 0 ? (
        <div className="p-5">
          <EmptyState
            variant="filled"
            size="sm"
            icon={<Building2 />}
            title={t('console.account.workspaces.empty.title')}
            description={t('console.account.workspaces.empty.body')}
          />
        </div>
      ) : (
        <>
          <div className="hidden sm:block">
            <Table label={t('console.account.workspaces.label')} fixed>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t('console.account.workspaces.column.workspace')}
                  </TableHead>
                  <TableHead className="w-28">
                    {t('console.account.workspaces.column.role')}
                  </TableHead>
                  <TableHead className="w-28">
                    {t('console.account.workspaces.column.plan')}
                  </TableHead>
                  <TableHead className="w-32">
                    {t('console.users.column.joined')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((membership) => (
                  <TableRow key={membership.organizationId}>
                    <TableCell truncate>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium text-ink">
                          {membership.name}
                        </span>
                        <span className="truncate font-mono text-caption text-ink-4">
                          {membership.slug}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          membership.role === 'owner' ? 'outline' : 'neutral'
                        }
                        size="sm"
                      >
                        {describeWorkspaceRole(t, membership.role)}
                      </Badge>
                    </TableCell>
                    <TableCell muted>
                      {describePlan(t, membership.plan)}
                    </TableCell>
                    <TableCell muted className="tabular-nums">
                      {formatDate(membership.joinedAt, locale) ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col sm:hidden">
            {memberships.map((membership) => (
              <li
                key={membership.organizationId}
                className="flex flex-col gap-2 px-4 py-4 not-last:border-b not-last:border-edge-faint"
              >
                <div className="min-w-0">
                  <p className="truncate text-label font-medium text-ink">
                    {membership.name}
                  </p>
                  <p className="truncate font-mono text-caption text-ink-4">
                    {membership.slug}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Badge
                    tone={membership.role === 'owner' ? 'outline' : 'neutral'}
                    size="sm"
                  >
                    {describeWorkspaceRole(t, membership.role)}
                  </Badge>
                  <span className="text-caption text-ink-3">
                    {describePlan(t, membership.plan)}
                  </span>
                  <span className="ms-auto text-caption tabular-nums text-ink-4">
                    {t('console.users.joined', {
                      date: formatDate(membership.joinedAt, locale) ?? '—',
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

/**
 * What the workspaces this account *owns* are paying for.
 *
 * Two empty states rather than one, because they mean different things and lead to different next
 * steps. An account that owns no workspace has nothing to bill and never will from here; an account
 * that owns one with no `subscriptions` row is on the free tier and has simply never been through
 * checkout. Collapsing the two into "No subscription" would tell an operator chasing a payment
 * problem the same thing in both cases.
 */
function SubscriptionPanel({
  subscriptions,
  owns,
}: {
  readonly subscriptions: ReadonlyArray<ConsoleSubscription>
  readonly owns: boolean
}) {
  const locale = useLocale()
  const t = useTranslate()
  return (
    <Panel
      label={t('console.account.subscription.label')}
      bodyClassName="flex flex-col gap-5"
    >
      {subscriptions.length === 0 ? (
        <EmptyState
          variant="filled"
          size="sm"
          icon={<CreditCard />}
          title={
            owns
              ? t('console.account.subscription.free.title')
              : t('console.account.subscription.none.title')
          }
          description={
            owns
              ? t('console.account.subscription.free.body')
              : t('console.account.subscription.none.body')
          }
        />
      ) : (
        subscriptions.map((subscription) => (
          <div
            key={subscription.organizationId}
            className="flex min-w-0 flex-col gap-3 not-last:border-b not-last:border-edge-faint not-last:pb-5"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="min-w-0 truncate text-label font-semibold text-ink">
                {subscription.organizationName}
              </p>
              <Badge tone="outline" size="sm">
                {describePlan(t, subscription.plan)}
              </Badge>
              <SubscriptionStatusBadge status={subscription.status} />
              {subscription.cancelAtPeriodEnd ? (
                <Badge tone="warning" size="sm">
                  {t('console.account.subscription.endsAtClose')}
                </Badge>
              ) : null}
            </div>
            <MetaStrip
              items={[
                {
                  label: t('console.account.subscription.seats'),
                  value: t('console.account.subscription.seatsValue', {
                    used: formatNumber(subscription.seats, locale),
                    limit: formatNumber(subscription.seatLimit, locale),
                  }),
                },
                {
                  label:
                    subscription.cancelAtPeriodEnd || subscription.trialEndsAt
                      ? t('console.account.subscription.ends')
                      : t('console.account.subscription.renews'),
                  value:
                    formatDate(
                      subscription.trialEndsAt ?? subscription.currentPeriodEnd,
                      locale,
                    ) ?? '—',
                },
              ]}
            />
          </div>
        ))
      )}
    </Panel>
  )
}

/**
 * Everything the platform has done to this account, newest first.
 *
 * This is `docs/ACCESS.md` §4.4's timeline query and the reason `platform_audit_log` exists at all
 * rather than a revision table per entity: one three-column index, `(entity_type, entity_id,
 * created_at)`, serves this panel whole. Until it shipped the ledger had a writer and no reader,
 * which made the argument for the table unbacked by anything anybody could look at.
 *
 * A rail with a dot per entry rather than a table. The rows are of unequal height by nature — a role
 * change moves one field and a suspension moves three — and a table forces the tallest row's height
 * on every other one. The rail also carries the one thing the reference's history view drops: what
 * actually moved, as a before and an after, instead of the raw payload in a cell.
 */
function AuditPanel({
  entries,
  truncated,
}: {
  readonly entries: ReadonlyArray<ConsoleAuditEntry>
  readonly truncated: boolean
}) {
  const locale = useLocale()
  const t = useTranslate()
  return (
    <Panel
      label={t('console.account.audit.label')}
      count={
        entries.length === 0 ? undefined : formatNumber(entries.length, locale)
      }
      toolbar={
        truncated ? (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-caption text-ink-3">
            {t('console.account.audit.truncated')}
          </p>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          variant="filled"
          size="sm"
          icon={<History />}
          title={t('console.account.audit.empty.title')}
          description={t('console.account.audit.empty.body')}
        />
      ) : (
        <ol className="relative flex flex-col gap-5">
          {/* The rail. Absolutely positioned so it cannot add a row of its own, and stopped short of
              the last dot so the thread ends at the oldest entry rather than trailing past it. */}
          <span
            aria-hidden
            className="absolute top-2 bottom-2 start-1 w-px bg-edge-faint"
          />
          {entries.map((entry) => {
            const actor = describeAuditActor(
              t,
              entry.actorKind,
              entry.actorName,
            )
            return (
              <li key={entry.id} className="flex min-w-0 gap-3.5">
                <AuditDot tone={platformActionTone(entry.action)} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <p className="text-label font-semibold text-ink">
                      {describePlatformAction(t, entry.action)}
                    </p>
                    <p className="text-caption tabular-nums text-ink-4">
                      {formatConsoleInstant(entry.at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 text-caption text-ink-3">
                      {actor.name}
                      {actor.detail === null ? '' : ` · ${actor.detail}`}
                    </p>
                    <AuditActorBadge
                      kind={entry.actorKind}
                      role={entry.actorRole}
                    />
                  </div>
                  <AuditChangeList payload={entry.changes} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
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
  const t = useTranslate()
  const { holds, withheld } = PLATFORM_ROLE_VOCABULARY[role]
  return (
    <Panel label={t('console.account.authority.label')}>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <AuthorityList
          heading={t('console.account.authority.may')}
          items={holds}
          empty={t('console.account.authority.none')}
          granted
        />
        <AuthorityList
          heading={t('console.account.authority.mayNot')}
          items={withheld}
          empty=""
        />
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
  readonly items: ReadonlyArray<MessageKey>
  readonly empty: string
  readonly granted?: boolean
}) {
  const t = useTranslate()
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
                {granted ? (
                  <Check strokeWidth={3} />
                ) : (
                  <Minus strokeWidth={3} />
                )}
              </span>
              <span className="min-w-0 text-label leading-relaxed text-ink-2">
                {t(item)}
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
  const locale = useLocale()
  const t = useTranslate()
  return (
    <Panel
      label={t('console.account.sessions.label')}
      count={
        sessions.length === 0
          ? undefined
          : formatNumber(sessions.length, locale)
      }
      flush
      toolbar={
        truncated ? (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-caption text-warning">
            {t('console.account.sessions.truncated')}
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
            title={t('console.account.sessions.empty.title')}
            description={t('console.account.sessions.empty.body')}
          />
        </div>
      ) : (
        <>
          <div className="hidden sm:block">
            <Table label={t('console.account.sessions.label')} fixed>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t('console.account.sessions.column.device')}
                  </TableHead>
                  <TableHead className="w-36">
                    {t('console.account.sessions.column.address')}
                  </TableHead>
                  <TableHead className="w-36">
                    {t('console.account.sessions.column.started')}
                  </TableHead>
                  <TableHead className="w-36">
                    {t('console.account.sessions.column.expires')}
                  </TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">
                      {t('console.users.column.actions')}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell truncate>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium text-ink">
                          {describeUserAgent(t, session.userAgent)}
                        </span>
                        {session.impersonatedBy === null ? null : (
                          <span className="truncate text-caption text-warning">
                            {t('console.account.sessions.impersonated')}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell
                      muted
                      truncate
                      className="font-mono text-caption"
                    >
                      {trimmedOrNull(session.ipAddress) ??
                        t('console.account.sessions.noAddress')}
                    </TableCell>
                    <TableCell muted className="tabular-nums">
                      {formatConsoleInstant(session.createdAt)}
                    </TableCell>
                    <TableCell muted className="tabular-nums">
                      {formatConsoleInstant(session.expiresAt)}
                    </TableCell>
                    <TableCell className="pe-1 text-end">
                      <RevokeSessionButton
                        userId={userId}
                        sessionId={session.id}
                        describedAs={describeUserAgent(t, session.userAgent)}
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
                    {describeUserAgent(t, session.userAgent)}
                  </p>
                  <p className="truncate font-mono text-caption text-ink-3">
                    {trimmedOrNull(session.ipAddress) ??
                      t('console.account.sessions.noAddressLong')}
                  </p>
                  <p className="mt-1 text-caption tabular-nums text-ink-4">
                    {t('console.account.sessions.when', {
                      started: formatConsoleInstant(session.createdAt),
                      expires: formatConsoleInstant(session.expiresAt),
                    })}
                  </p>
                </div>
                <RevokeSessionButton
                  userId={userId}
                  sessionId={session.id}
                  describedAs={describeUserAgent(t, session.userAgent)}
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
  const t = useTranslate()
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5 bg-surface-2">
        <span className="sr-only">{t('console.account.loading')}</span>
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
      {/* One block per panel the screen settles into — authority, workspaces, subscription,
          sessions, ledger — so nothing below the fold jumps when the data lands. */}
      <Card className="flex flex-col gap-3 bg-surface-2">
        <Skeleton className="h-3 w-32" radius="sm" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" radius="md" />
          <Skeleton className="h-24 w-full" radius="md" />
        </div>
      </Card>
      <Card padding="none" className="bg-surface-2">
        <RowsSkeleton rows={2} />
      </Card>
      <Card padding="none" className="bg-surface-2">
        <RowsSkeleton rows={3} />
      </Card>
      <Card className="flex flex-col gap-4 bg-surface-2">
        <Skeleton className="h-3 w-28" radius="sm" />
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex gap-3.5">
            <Skeleton className="mt-1.5 size-2.5 shrink-0" radius="full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-2/5" radius="sm" />
              <Skeleton className="h-2.5 w-3/5" radius="sm" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
