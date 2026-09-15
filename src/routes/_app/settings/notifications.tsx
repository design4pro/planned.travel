import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { Card, Skeleton, Switch } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import {
  loadNotificationPreferences,
  saveNotificationPreference,
} from '../-server/settings'
import { SettingsSection } from '../-ui/settings-nav'
import { RouteError } from './-ui/route-error'

import type { MessageKey, Translate } from '#/lib/i18n'

/**
 * The notification matrix: one row per switchable event, one column per channel.
 *
 * Both axes are declared here as message *keys* rather than read from
 * a second table. There used to be one — `../-lib/notifications` carried
 * `NOTIFICATION_EVENTS` and `CHANNEL_LABELS` in English for an inbox renderer
 * that `components/layout/notification-copy.ts` had already replaced — and it is
 * deleted now. The stored `event_type` and
 * `channel` values are the contract between this screen and the repository; the
 * words beside them belong to this module's catalogue, so a Polish traveller
 * reads Polish switches.
 */
const CHANNELS: ReadonlyArray<{
  channel: 'in_app' | 'email' | 'push'
  label: MessageKey
  hint: MessageKey
}> = [
  {
    channel: 'in_app',
    label: 'settings.notifications.channel.in_app',
    hint: 'settings.notifications.channel.in_app.hint',
  },
  {
    channel: 'email',
    label: 'settings.notifications.channel.email',
    hint: 'settings.notifications.channel.email.hint',
  },
  {
    channel: 'push',
    label: 'settings.notifications.channel.push',
    hint: 'settings.notifications.channel.push.hint',
  },
]

const EVENTS: ReadonlyArray<{
  eventType: string
  label: MessageKey
  hint: MessageKey
}> = [
  {
    eventType: 'trip.invited',
    label: 'settings.notifications.event.trip.invited',
    hint: 'settings.notifications.event.trip.invited.hint',
  },
  {
    eventType: 'trip.updated',
    label: 'settings.notifications.event.trip.updated',
    hint: 'settings.notifications.event.trip.updated.hint',
  },
  {
    eventType: 'trip.starting_soon',
    label: 'settings.notifications.event.trip.starting_soon',
    hint: 'settings.notifications.event.trip.starting_soon.hint',
  },
  {
    eventType: 'reservation.reminder',
    label: 'settings.notifications.event.reservation.reminder',
    hint: 'settings.notifications.event.reservation.reminder.hint',
  },
  {
    eventType: 'expense.added',
    label: 'settings.notifications.event.expense.added',
    hint: 'settings.notifications.event.expense.added.hint',
  },
  {
    eventType: 'expense.settled',
    label: 'settings.notifications.event.expense.settled',
    hint: 'settings.notifications.event.expense.settled.hint',
  },
  {
    eventType: 'list.assigned',
    label: 'settings.notifications.event.list.assigned',
    hint: 'settings.notifications.event.list.assigned.hint',
  },
  {
    eventType: 'collab.message',
    label: 'settings.notifications.event.collab.message',
    hint: 'settings.notifications.event.collab.message.hint',
  },
  {
    eventType: 'organization.invited',
    label: 'settings.notifications.event.organization.invited',
    hint: 'settings.notifications.event.organization.invited.hint',
  },
  {
    eventType: 'billing.plan_changed',
    label: 'settings.notifications.event.billing.plan_changed',
    hint: 'settings.notifications.event.billing.plan_changed.hint',
  },
  {
    eventType: 'billing.invoice_paid',
    label: 'settings.notifications.event.billing.invoice_paid',
    hint: 'settings.notifications.event.billing.invoice_paid.hint',
  },
  {
    eventType: 'billing.payment_failed',
    label: 'settings.notifications.event.billing.payment_failed',
    hint: 'settings.notifications.event.billing.payment_failed.hint',
  },
]

export const Route = createFileRoute('/_app/settings/notifications')({
  loader: () => loadNotificationPreferences(),
  pendingComponent: PreferencesPending,
  errorComponent: PreferencesError,
  component: PreferencesPage,
})

function PreferencesError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <RouteError error={error} title={t('settings.notifications.error')} />
}

/** A key that identifies one switch in the matrix. */
function keyOf(eventType: string, channel: string): string {
  return `${eventType}:${channel}`
}

/** One switch's accessible name: the event it belongs to, then its channel. */
function switchName(
  t: Translate,
  event: MessageKey,
  channel: MessageKey,
): string {
  return t('settings.notifications.switch', {
    event: t(event),
    channel: t(channel),
  })
}

function PreferencesPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const t = useTranslate()

  // Absent rows mean "not yet decided", which the repository treats as enabled.
  const stored = new Map(
    data.preferences.map((row) => [
      keyOf(row.eventType, row.channel),
      row.isEnabled,
    ]),
  )
  const [overrides, setOverrides] = useState<
    Record<string, boolean | undefined>
  >({})
  const [pending, setPending] = useState<string | null>(null)

  function isEnabled(eventType: string, channel: string): boolean {
    const key = keyOf(eventType, channel)
    return overrides[key] ?? stored.get(key) ?? true
  }

  async function toggle(
    eventType: string,
    channel: 'in_app' | 'email' | 'push',
    next: boolean,
  ): Promise<void> {
    const key = keyOf(eventType, channel)
    setOverrides((previous) => ({ ...previous, [key]: next }))
    setPending(key)
    try {
      await saveNotificationPreference({
        data: { eventType, channel, isEnabled: next },
      })
      await router.invalidate()
    } catch {
      setOverrides((previous) => ({ ...previous, [key]: !next }))
      toast.error(t('settings.notifications.saveFailed'), {
        description: t('settings.notifications.saveFailedBody'),
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <SettingsSection
      title={t('settings.notifications.title')}
      description={t('settings.notifications.description')}
    >
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-lg border-collapse">
          <caption className="sr-only">
            {t('settings.notifications.caption')}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="pb-3 text-start text-micro font-semibold tracking-label uppercase text-ink-3"
              >
                {t('settings.notifications.event')}
              </th>
              {CHANNELS.map((channel) => (
                <th
                  key={channel.channel}
                  scope="col"
                  className="w-24 pb-3 text-center text-micro font-semibold tracking-label uppercase text-ink-3"
                >
                  <span className="block">{t(channel.label)}</span>
                  {/* The hint is the only prose in this header, and it was set
                      a step below Micro — under the ramp's floor — to sit
                      quieter than the channel name above it. It does not need
                      the size for that: weight, case, tracking and ink-4
                      already separate the two, so the size can come back up
                      onto the ramp and stay readable. */}
                  <span className="mt-0.5 block text-micro font-normal tracking-normal normal-case text-ink-4">
                    {t(channel.hint)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((event) => (
              <tr key={event.eventType} className="border-t border-edge-faint">
                <th scope="row" className="py-3.5 pe-4 text-start align-top">
                  <span className="block text-label font-medium text-ink">
                    {t(event.label)}
                  </span>
                  <span className="mt-0.5 block text-caption leading-relaxed text-ink-3">
                    {t(event.hint)}
                  </span>
                </th>
                {CHANNELS.map((channel) => {
                  const key = keyOf(event.eventType, channel.channel)
                  return (
                    <td
                      key={channel.channel}
                      className="py-3.5 text-center align-middle"
                    >
                      <Switch
                        checked={isEnabled(event.eventType, channel.channel)}
                        disabled={pending === key}
                        aria-label={switchName(t, event.label, channel.label)}
                        onCheckedChange={(next) => {
                          void toggle(event.eventType, channel.channel, next)
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsSection>
  )
}

function PreferencesPending() {
  const t = useTranslate()
  return (
    <Card aria-busy="true" className="space-y-4">
      <span className="sr-only">{t('ui.status.loading')}</span>
      <Skeleton className="h-4 w-40" radius="sm" />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-6">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-44" radius="sm" />
            <Skeleton className="h-2.5 w-64" radius="sm" />
          </div>
          <div className="flex shrink-0 gap-6">
            {Array.from({ length: 3 }, (_slot, cell) => (
              <Skeleton key={cell} className="h-5 w-9" radius="full" />
            ))}
          </div>
        </div>
      ))}
    </Card>
  )
}
