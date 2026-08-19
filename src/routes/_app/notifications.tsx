import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  Bell,
  CheckCheck,
  CircleAlert,
  Inbox,
  Info,
  Navigation,
} from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import { Badge, Button, Card, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  loadNotifications,
  readAllNotifications,
  readNotification,
} from './-server/overview'
import { formatNumber, formatRelative, pluralise } from './-lib/format'
import { renderNotification } from './-lib/notifications'
import {
  FilterBar,
  FilterCount,
  HeaderSkeleton,
  Panel,
  RowsSkeleton,
  filterLinkClass,
} from './-ui/scaffold'

import type { LucideIcon } from 'lucide-react'
import type { NotificationCard } from './-server/overview'

const TYPE_ICON: Record<string, LucideIcon> = {
  info: Info,
  action: CircleAlert,
  navigate: Navigation,
}

export const Route = createFileRoute('/_app/notifications')({
  validateSearch: z.object({ unread: z.boolean().optional() }),
  loaderDeps: ({ search }) => ({ unread: search.unread }),
  loader: ({ deps }) =>
    loadNotifications({ data: { unreadOnly: deps.unread } }),
  pendingComponent: NotificationsPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="Your inbox did not load" />
    </AppFrame>
  ),
  component: NotificationsPage,
})

function NotificationsPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const unreadOnly = search.unread === true

  async function markEverythingRead(): Promise<void> {
    setBusy(true)
    try {
      await readAllNotifications()
      await router.invalidate()
      toast.success('Inbox cleared')
    } catch {
      toast.error('Could not mark everything read', {
        description: 'Check your connection and try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow="Inbox"
          title="Notifications"
          description={
            data.unreadCount === 0
              ? 'Everything is read'
              : `${pluralise(data.unreadCount, 'unread message')}`
          }
          actions={
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              disabled={data.unreadCount === 0}
              loading={busy}
              loadingLabel="Marking everything read"
              onClick={() => {
                void markEverythingRead()
              }}
            >
              <CheckCheck aria-hidden />
              Mark all read
            </Button>
          }
        >
          <FilterBar>
            <Link
              to="/notifications"
              search={{}}
              className={filterLinkClass(!unreadOnly)}
            >
              Everything
            </Link>
            <Link
              to="/notifications"
              search={{ unread: true }}
              className={filterLinkClass(unreadOnly)}
            >
              Unread
              <FilterCount>{formatNumber(data.unreadCount)}</FilterCount>
            </Link>
            {data.actionableCount === 0 ? null : (
              <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-caption font-semibold text-warning">
                <CircleAlert aria-hidden className="size-3.5" />
                {pluralise(data.actionableCount, 'invitation')} waiting
              </span>
            )}
          </FilterBar>
        </PageHeader>

        {data.items.length === 0 ? (
          <Card variant="dashed" padding="none">
            <EmptyState
              size="lg"
              tone="brand"
              icon={<Inbox />}
              title={unreadOnly ? 'Nothing unread' : 'Your inbox is empty'}
              description={
                unreadOnly
                  ? 'You have read everything. Switch to Everything to look back through the history.'
                  : 'Trip invitations, plan changes, booking reminders and settled balances all arrive here.'
              }
              action={
                unreadOnly ? (
                  <Button asChild variant="secondary" shape="pill">
                    <Link to="/notifications" search={{}}>
                      Show everything
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="primary" shape="pill">
                    <Link to="/dashboard">Back to the dashboard</Link>
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <Panel
            label={unreadOnly ? 'Unread' : 'Everything'}
            count={formatNumber(data.items.length)}
            flush
          >
            <ul>
              {data.items.map((item) => (
                <li key={item.id}>
                  <NotificationRow item={item} />
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-label text-ink-3">
            Choose which of these reach your inbox, your email and your phone.
          </p>
          <Button asChild variant="secondary" size="sm" shape="pill">
            <Link to="/settings/notifications">
              <Bell aria-hidden />
              Notification settings
            </Link>
          </Button>
        </Card>
      </AppSections>
    </AppFrame>
  )
}

function NotificationRow({ item }: { item: NotificationCard }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const copy = renderNotification(item)
  const Icon = TYPE_ICON[item.type] ?? Info
  const now = Date.now()

  async function markRead(): Promise<void> {
    setBusy(true)
    try {
      await readNotification({ data: { notificationId: item.id } })
      await router.invalidate()
    } catch {
      toast.error('Could not mark that read')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-3 px-5 py-4 not-last:border-b not-last:border-edge-faint',
        item.isRead ? '' : 'bg-brand-subtle/40',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          item.type === 'action'
            ? 'bg-warning-soft text-warning'
            : 'bg-surface-2 text-ink-3',
        )}
      >
        <Icon aria-hidden className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <p
            className={cn(
              'min-w-0 text-label',
              item.isRead ? 'text-ink-2' : 'font-semibold text-ink',
            )}
          >
            {copy.title}
          </p>
          {item.isRead ? null : (
            <Badge tone="brand" size="sm">
              New
            </Badge>
          )}
          {item.response === null ? null : (
            <Badge
              tone={item.response === 'accepted' ? 'success' : 'neutral'}
              size="sm"
            >
              {item.response === 'accepted' ? 'Accepted' : 'Declined'}
            </Badge>
          )}
        </div>
        {copy.body === null ? null : (
          <p className="mt-0.5 text-caption leading-relaxed text-ink-3">
            {copy.body}
          </p>
        )}
        <p className="mt-1 text-caption tabular-nums text-ink-4">
          {formatRelative(item.createdAt, now)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {item.actionUrl === null ? null : (
          <Button asChild variant="ghost" size="sm" shape="pill">
            <a href={item.actionUrl}>Open</a>
          </Button>
        )}
        {item.isRead ? null : (
          <Button
            variant="ghost"
            size="sm"
            shape="pill"
            loading={busy}
            loadingLabel="Marking read"
            onClick={() => {
              void markRead()
            }}
          >
            <CheckCheck aria-hidden />
            Read
          </Button>
        )}
      </div>
    </div>
  )
}

function NotificationsPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <Card padding="none">
          <RowsSkeleton rows={6} />
        </Card>
      </AppSections>
    </AppFrame>
  )
}
