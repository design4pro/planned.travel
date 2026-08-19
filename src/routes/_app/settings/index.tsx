import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { BadgeCheck, Building2, Save, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { ErrorPanel } from '#/components/layout/error-state'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  SimpleSelect,
  Skeleton,
} from '#/components/ui'
import { loadProfile, saveRegionalSettings } from '../-server/settings'
import { formatDate, humaniseToken } from '../-lib/format'
import { SettingsRow, SettingsSection } from '../-ui/settings-nav'

const DEFAULT = 'default'

const LOCALES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
  { value: 'pl-PL', label: 'Polish (Poland)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
]

const TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Dublin', label: 'Dublin' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Warsaw', label: 'Warsaw' },
  { value: 'Europe/Madrid', label: 'Madrid' },
  { value: 'America/New_York', label: 'New York' },
  { value: 'America/Chicago', label: 'Chicago' },
  { value: 'America/Los_Angeles', label: 'Los Angeles' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Australia/Sydney', label: 'Sydney' },
]

const CURRENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — Pound sterling' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'CHF', label: 'CHF — Swiss franc' },
  { value: 'PLN', label: 'PLN — Polish złoty' },
  { value: 'SEK', label: 'SEK — Swedish krona' },
  { value: 'JPY', label: 'JPY — Japanese yen' },
  { value: 'AUD', label: 'AUD — Australian dollar' },
  { value: 'CAD', label: 'CAD — Canadian dollar' },
]

const DATE_FORMATS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'dd MMM yyyy', label: '23 Jun 2026' },
  { value: 'dd/MM/yyyy', label: '23/06/2026' },
  { value: 'MM/dd/yyyy', label: '06/23/2026' },
  { value: 'yyyy-MM-dd', label: '2026-06-23' },
]

const WEEK_STARTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '1', label: 'Monday' },
  { value: '0', label: 'Sunday' },
  { value: '6', label: 'Saturday' },
]

const DISTANCE_UNITS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'metric', label: 'Kilometres' },
  { value: 'imperial', label: 'Miles' },
]

export const Route = createFileRoute('/_app/settings/')({
  loader: () => loadProfile(),
  pendingComponent: ProfilePending,
  errorComponent: ({ error }) => (
    <ErrorPanel error={error} title="Your profile did not load" />
  ),
  component: ProfilePage,
})

function ProfilePage() {
  const data = Route.useLoaderData()
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [locale, setLocale] = useState(data.overrides.locale ?? DEFAULT)
  const [timezone, setTimezone] = useState(data.overrides.timezone ?? DEFAULT)
  const [currency, setCurrency] = useState(data.overrides.currency ?? DEFAULT)
  const [dateFormat, setDateFormat] = useState(
    data.overrides.dateFormat ?? DEFAULT,
  )
  const [weekStartsOn, setWeekStartsOn] = useState(
    data.overrides.weekStartsOn === null
      ? DEFAULT
      : String(data.overrides.weekStartsOn),
  )
  const [distanceUnit, setDistanceUnit] = useState(
    data.overrides.distanceUnit ?? DEFAULT,
  )

  const dirty =
    locale !== (data.overrides.locale ?? DEFAULT) ||
    timezone !== (data.overrides.timezone ?? DEFAULT) ||
    currency !== (data.overrides.currency ?? DEFAULT) ||
    dateFormat !== (data.overrides.dateFormat ?? DEFAULT) ||
    weekStartsOn !==
      (data.overrides.weekStartsOn === null
        ? DEFAULT
        : String(data.overrides.weekStartsOn)) ||
    distanceUnit !== (data.overrides.distanceUnit ?? DEFAULT)

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await saveRegionalSettings({
        data: {
          locale: locale === DEFAULT ? '' : locale,
          timezone: timezone === DEFAULT ? '' : timezone,
          currency: currency === DEFAULT ? '' : currency,
          dateFormat: dateFormat === DEFAULT ? '' : dateFormat,
          weekStartsOn:
            weekStartsOn === DEFAULT ? null : Number.parseInt(weekStartsOn, 10),
          distanceUnit:
            distanceUnit === 'metric' || distanceUnit === 'imperial'
              ? distanceUnit
              : '',
        },
      })
      await router.invalidate()
      toast.success('Preferences saved')
    } catch {
      toast.error('Could not save that', {
        description: 'Check your connection and try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  /** Prepends the "follow the workspace" option to a curated list. */
  function withDefault(
    options: ReadonlyArray<{ value: string; label: string }>,
    fallback: string,
  ): Array<{ value: string; label: string }> {
    return [
      { value: DEFAULT, label: `Workspace default — ${fallback}` },
      ...options,
    ]
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Your account"
        description="Your name and email come from the account you sign in with."
      >
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={data.user.name} src={data.user.image} size="xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-title font-bold tracking-tight text-ink">
              {data.user.name}
            </p>
            <p className="truncate text-label text-ink-3">{data.user.email}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge
                tone={data.user.emailVerified ? 'success' : 'warning'}
                size="sm"
                icon={
                  data.user.emailVerified ? <BadgeCheck /> : <TriangleAlert />
                }
              >
                {data.user.emailVerified
                  ? 'Email verified'
                  : 'Email not verified'}
              </Badge>
              <Badge tone="brand" size="sm">
                {humaniseToken(data.membership.role)}
              </Badge>
              {data.user.twoFactorEnabled ? (
                <Badge tone="success" size="sm">
                  Two-factor on
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-edge-faint pt-5 sm:grid-cols-3">
          <Figure
            label="Workspace"
            value={data.membership.organizationName}
            icon
          />
          <Figure label="Role" value={humaniseToken(data.membership.role)} />
          <Figure
            label="Member since"
            value={formatDate(data.membership.joinedAt) ?? 'Unknown'}
          />
        </dl>
      </SettingsSection>

      <SettingsSection
        title="Dates, money and units"
        description="These override the workspace defaults for you alone. Leave one on the default and it follows the workspace."
        actions={
          <Button
            variant="primary"
            size="sm"
            shape="pill"
            disabled={!dirty}
            loading={saving}
            loadingLabel="Saving your preferences"
            onClick={() => {
              void save()
            }}
          >
            <Save aria-hidden />
            Save changes
          </Button>
        }
      >
        <div className="flex flex-col">
          <SettingsRow
            label="Language"
            hint="Used for month names and number grouping."
            control={
              <Field>
                <SimpleSelect
                  options={withDefault(LOCALES, data.workspaceDefaults.locale)}
                  value={locale}
                  onValueChange={setLocale}
                  ariaLabel="Language"
                />
              </Field>
            }
          />
          <SettingsRow
            label="Time zone"
            hint="Departure and arrival times are shown against this."
            control={
              <Field>
                <SimpleSelect
                  options={withDefault(
                    TIMEZONES,
                    data.workspaceDefaults.timezone,
                  )}
                  value={timezone}
                  onValueChange={setTimezone}
                  ariaLabel="Time zone"
                />
              </Field>
            }
          />
          <SettingsRow
            label="Currency"
            hint="New trips start in this currency; each trip can override it."
            control={
              <Field>
                <SimpleSelect
                  options={withDefault(
                    CURRENCIES,
                    data.workspaceDefaults.currency,
                  )}
                  value={currency}
                  onValueChange={setCurrency}
                  ariaLabel="Currency"
                />
              </Field>
            }
          />
          <SettingsRow
            label="Date format"
            control={
              <Field>
                <SimpleSelect
                  options={withDefault(
                    DATE_FORMATS,
                    data.workspaceDefaults.dateFormat,
                  )}
                  value={dateFormat}
                  onValueChange={setDateFormat}
                  ariaLabel="Date format"
                />
              </Field>
            }
          />
          <SettingsRow
            label="Week starts on"
            hint="Applies to every calendar, including the vacay year grid."
            control={
              <Field>
                <SimpleSelect
                  options={withDefault(
                    WEEK_STARTS,
                    WEEK_STARTS.find(
                      (option) =>
                        option.value ===
                        String(data.workspaceDefaults.weekStartsOn),
                    )?.label ?? 'Monday',
                  )}
                  value={weekStartsOn}
                  onValueChange={setWeekStartsOn}
                  ariaLabel="Week starts on"
                />
              </Field>
            }
          />
          <SettingsRow
            label="Distance"
            control={
              <Field>
                <SimpleSelect
                  options={withDefault(
                    DISTANCE_UNITS,
                    data.workspaceDefaults.distanceUnit === 'imperial'
                      ? 'Miles'
                      : 'Kilometres',
                  )}
                  value={distanceUnit}
                  onValueChange={setDistanceUnit}
                  ariaLabel="Distance"
                />
              </Field>
            }
          />
        </div>
      </SettingsSection>
    </div>
  )
}

function Figure({
  label,
  value,
  icon = false,
}: {
  label: string
  value: string
  icon?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-micro font-semibold tracking-label uppercase text-ink-4">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center gap-1.5 truncate text-label font-medium text-ink">
        {icon ? (
          <Building2 aria-hidden className="size-3.5 shrink-0 text-ink-4" />
        ) : null}
        {value}
      </dd>
    </div>
  )
}

function ProfilePending() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
      <Card className="flex items-center gap-5">
        <Skeleton className="size-14 shrink-0" radius="full" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-6 w-48" radius="sm" />
          <Skeleton className="h-3 w-64" radius="sm" />
        </div>
      </Card>
      <Card className="space-y-5">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <Skeleton className="h-3 w-32" radius="sm" />
            <Skeleton className="h-10 w-56" radius="md" />
          </div>
        ))}
      </Card>
    </div>
  )
}
