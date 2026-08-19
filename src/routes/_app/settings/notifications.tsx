import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { ErrorPanel } from '#/components/layout/error-state'
import { Card, Skeleton, Switch } from '#/components/ui'
import {
  loadNotificationPreferences,
  saveNotificationPreference,
} from '../-server/settings'
import { CHANNEL_LABELS, NOTIFICATION_EVENTS } from '../-lib/notifications'
import { SettingsSection } from '../-ui/settings-nav'

export const Route = createFileRoute('/_app/settings/notifications')({
  loader: () => loadNotificationPreferences(),
  pendingComponent: PreferencesPending,
  errorComponent: ({ error }) => (
    <ErrorPanel error={error} title="Notification settings did not load" />
  ),
  component: PreferencesPage,
})

/** A key that identifies one switch in the matrix. */
function keyOf(eventType: string, channel: string): string {
  return `${eventType}:${channel}`
}

function PreferencesPage() {
  const data = Route.useLoaderData()
  const router = useRouter()

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
      toast.error('Could not save that preference', {
        description: 'Check your connection and try again.',
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <SettingsSection
      title="Notifications"
      description="Every switch applies to you alone. Turning one off never stops the event from happening — it only stops us telling you about it."
    >
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-lg border-collapse">
          <caption className="sr-only">
            Which notifications reach each channel
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="pb-3 text-left text-micro font-semibold tracking-label uppercase text-ink-3"
              >
                Event
              </th>
              {CHANNEL_LABELS.map((channel) => (
                <th
                  key={channel.channel}
                  scope="col"
                  className="w-24 pb-3 text-center text-micro font-semibold tracking-label uppercase text-ink-3"
                >
                  <span className="block">{channel.label}</span>
                  <span className="mt-0.5 block text-[0.625rem] font-normal tracking-normal normal-case text-ink-4">
                    {channel.hint}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_EVENTS.map((event) => (
              <tr key={event.eventType} className="border-t border-edge-faint">
                <th scope="row" className="py-3.5 pr-4 text-left align-top">
                  <span className="block text-label font-medium text-ink">
                    {event.label}
                  </span>
                  <span className="mt-0.5 block text-caption leading-relaxed text-ink-3">
                    {event.description}
                  </span>
                </th>
                {CHANNEL_LABELS.map((channel) => {
                  const key = keyOf(event.eventType, channel.channel)
                  return (
                    <td
                      key={channel.channel}
                      className="py-3.5 text-center align-middle"
                    >
                      <Switch
                        checked={isEnabled(event.eventType, channel.channel)}
                        disabled={pending === key}
                        aria-label={`${event.label} — ${channel.label}`}
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
  return (
    <Card aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading</span>
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
