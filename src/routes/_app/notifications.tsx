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
import { notificationCopy } from '#/components/layout/notification-copy'
import { PageHeader } from '#/components/layout/page-header'
import { Badge, Button, Card, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useI18n, useTranslate } from '#/lib/i18n'
import {
  loadNotifications,
  readAllNotifications,
  readNotification,
} from './-server/overview'
import { formatNumber, formatRelative } from './-lib/format'
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

/* ------------------------------------------------------------------ route */

export const Route = createFileRoute('/_app/notifications')({
  validateSearch: z.object({ unread: z.boolean().optional() }),
  loaderDeps: ({ search }) => ({ unread: search.unread }),
  loader: ({ deps }) =>
    loadNotifications({ data: { unreadOnly: deps.unread } }),
  pendingComponent: NotificationsPending,
  errorComponent: NotificationsError,
  component: NotificationsPage,
})

function NotificationsError({ error }: { error: unknown }) {
  const t = useTranslate()
  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('shell.inbox.error')} />
    </AppFrame>
  )
}

function NotificationsPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const { t, locale } = useI18n()
  const [busy, setBusy] = useState(false)

  const unreadOnly = search.unread === true

  async function markEverythingRead(): Promise<void> {
    setBusy(true)
    try {
      await readAllNotifications()
      await router.invalidate()
      toast.success(t('shell.inbox.cleared'))
    } catch {
      toast.error(t('shell.inbox.markAllFailed'), {
        description: t('shell.inbox.retryHint'),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow={t('shell.inbox.eyebrow')}
          title={t('shell.inbox.title')}
          description={
            data.unreadCount === 0
              ? t('shell.inbox.allRead')
              : t('shell.inbox.unread', {
                  count: data.unreadCount,
                  unread: formatNumber(data.unreadCount, locale),
                })
          }
          actions={
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              disabled={data.unreadCount === 0}
              loading={busy}
              loadingLabel={t('shell.inbox.markingAll')}
              onClick={() => {
                void markEverythingRead()
              }}
            >
              <CheckCheck aria-hidden />
              {t('shell.inbox.markAll')}
            </Button>
          }
        >
          <FilterBar>
            <Link
              to="/notifications"
              search={{}}
              className={filterLinkClass(!unreadOnly)}
            >
              {t('shell.inbox.filter.all')}
            </Link>
            <Link
              to="/notifications"
              search={{ unread: true }}
              className={filterLinkClass(unreadOnly)}
            >
              {t('shell.inbox.filter.unread')}
              <FilterCount>
                {formatNumber(data.unreadCount, locale)}
              </FilterCount>
            </Link>
            {data.actionableCount === 0 ? null : (
              <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-caption font-semibold text-warning">
                <CircleAlert aria-hidden className="size-3.5" />
                {t('shell.inbox.waiting', {
                  count: data.actionableCount,
                  invitations: formatNumber(data.actionableCount, locale),
                })}
              </span>
            )}
          </FilterBar>
        </PageHeader>

        {data.items.length === 0 ? (
          <Card variant="dashed" padding="none" className="bg-surface-2">
            <EmptyState
              size="lg"
              tone="brand"
              icon={<Inbox />}
              title={
                unreadOnly
                  ? t('shell.inbox.emptyUnread.title')
                  : t('shell.inbox.empty.title')
              }
              description={
                unreadOnly
                  ? t('shell.inbox.emptyUnread.body')
                  : t('shell.inbox.empty.body')
              }
              action={
                unreadOnly ? (
                  <Button asChild variant="secondary" shape="pill">
                    <Link to="/notifications" search={{}}>
                      {t('shell.inbox.emptyUnread.action')}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="primary" shape="pill">
                    <Link to="/dashboard">
                      {t('shell.inbox.empty.action')}
                    </Link>
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <Panel
            label={
              unreadOnly
                ? t('shell.inbox.filter.unread')
                : t('shell.inbox.filter.all')
            }
            count={formatNumber(data.items.length, locale)}
            flush
          >
            <ul>
              {data.items.map((item) => (
                <li key={item.id}>
                  <NotificationRow item={item} now={data.now} />
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-label text-ink-3">{t('shell.inbox.preferences')}</p>
          <Button asChild variant="secondary" size="sm" shape="pill">
            <Link to="/settings/notifications">
              <Bell aria-hidden />
              {t('shell.inbox.preferencesAction')}
            </Link>
          </Button>
        </Card>
      </AppSections>
    </AppFrame>
  )
}

/**
 * One row. `now` arrives from the loader rather than being read here: a
 * `Date.now()` in a component body runs once during SSR and again during
 * hydration, and a row sitting on the "45 seconds" or the "7 days" boundary
 * between the two renders a different sentence each time — a text mismatch React
 * reports in the console, which §2 counts as a defect.
 */
function NotificationRow({
  item,
  now,
}: {
  item: NotificationCard
  now: number
}) {
  const router = useRouter()
  const { t, tStored, locale } = useI18n()
  const [busy, setBusy] = useState(false)
  const copy = notificationCopy(item, { locale, t, tStored })
  const Icon = TYPE_ICON[item.type] ?? Info

  async function markRead(): Promise<void> {
    setBusy(true)
    try {
      await readNotification({ data: { notificationId: item.id } })
      await router.invalidate()
    } catch {
      toast.error(t('shell.inbox.row.markReadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    /*
     * Two columns on a phone, three from `sm` up, and the actions move rather
     * than being written twice. Beside the sentence at 360px they left the title
     * about ninety pixels to wrap in, which is a squeezed desktop row and not a
     * designed mobile one (SPEC §2); underneath it they get the full measure.
     * `col-start-*` is direction-agnostic, so `ar` mirrors the whole grid.
     */
    <div
      className={cn(
        'grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 px-5 py-4',
        'sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-y-0',
        'not-last:border-b not-last:border-edge-faint',
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

      <div className="col-start-2 row-start-1 min-w-0">
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
              {t('shell.inbox.row.new')}
            </Badge>
          )}
          {item.response === null ? null : (
            <Badge
              tone={item.response === 'accepted' ? 'success' : 'neutral'}
              size="sm"
            >
              {item.response === 'accepted'
                ? t('shell.inbox.row.accepted')
                : t('shell.inbox.row.declined')}
            </Badge>
          )}
        </div>
        {copy.body === null ? null : (
          <p className="mt-0.5 text-caption leading-relaxed text-ink-3">
            {copy.body}
          </p>
        )}
        {/* No `data-numeric`. A relative time is a sentence with a figure in it
            — `قبل 3 أيام` — and the direction layer pins a `data-numeric` run to
            `direction: ltr`, which would reorder those Arabic words around their
            own number. `tabular-nums` is the part a changing timestamp needs. */}
        <p className="mt-1 text-caption tabular-nums text-ink-4">
          {formatRelative(item.createdAt, now, locale)}
        </p>
      </div>

      <div className="col-start-2 flex shrink-0 flex-wrap items-center gap-1.5 sm:col-start-3 sm:row-start-1">
        {item.actionUrl === null ? null : (
          <Button asChild variant="ghost" size="sm" shape="pill">
            <a href={item.actionUrl}>{t('shell.inbox.row.open')}</a>
          </Button>
        )}
        {item.isRead ? null : (
          <Button
            variant="ghost"
            size="sm"
            shape="pill"
            loading={busy}
            loadingLabel={t('shell.inbox.row.markingRead')}
            onClick={() => {
              void markRead()
            }}
          >
            <CheckCheck aria-hidden />
            {t('shell.inbox.row.markRead')}
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
        <Card variant="inset" padding="none">
          <RowsSkeleton rows={6} />
        </Card>
      </AppSections>
    </AppFrame>
  )
}
