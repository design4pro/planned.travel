import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { MailPlus, Save, Users } from 'lucide-react'
import { toast } from 'sonner'

import { ErrorPanel } from '#/components/layout/error-state'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Progress,
  SimpleSelect,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui'
import {
  loadOrganizationSettings,
  saveWorkspaceDefaults,
} from '../-server/settings'
import {
  formatDate,
  formatNumber,
  humaniseToken,
  pluralise,
} from '../-lib/format'
import { SettingsRow, SettingsSection } from '../-ui/settings-nav'

const CURRENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — Pound sterling' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'CHF', label: 'CHF — Swiss franc' },
  { value: 'PLN', label: 'PLN — Polish złoty' },
  { value: 'SEK', label: 'SEK — Swedish krona' },
  { value: 'JPY', label: 'JPY — Japanese yen' },
]

const LOCALES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'pl-PL', label: 'Polish (Poland)' },
]

const TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Warsaw', label: 'Warsaw' },
  { value: 'America/New_York', label: 'New York' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
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

const ROLE_TONE: Record<string, 'accent' | 'brand' | 'neutral'> = {
  owner: 'accent',
  admin: 'brand',
  member: 'neutral',
}

export const Route = createFileRoute('/_app/settings/organization')({
  loader: () => loadOrganizationSettings(),
  pendingComponent: OrganizationPending,
  errorComponent: ({ error }) => (
    <ErrorPanel error={error} title="The workspace did not load" />
  ),
  component: OrganizationPage,
})

function OrganizationPage() {
  const data = Route.useLoaderData()
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [currency, setCurrency] = useState(data.defaults.currency)
  const [locale, setLocale] = useState(data.defaults.locale)
  const [timezone, setTimezone] = useState(data.defaults.timezone)
  const [dateFormat, setDateFormat] = useState(data.defaults.dateFormat)
  const [weekStartsOn, setWeekStartsOn] = useState(
    String(data.defaults.weekStartsOn),
  )
  const [distanceUnit, setDistanceUnit] = useState(data.defaults.distanceUnit)

  const dirty =
    currency !== data.defaults.currency ||
    locale !== data.defaults.locale ||
    timezone !== data.defaults.timezone ||
    dateFormat !== data.defaults.dateFormat ||
    weekStartsOn !== String(data.defaults.weekStartsOn) ||
    distanceUnit !== data.defaults.distanceUnit

  const seatRatio = data.seats.used / Math.max(data.seats.limit, 1)
  const seatsFull =
    data.seats.used + data.invitations.length >= data.seats.limit

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await saveWorkspaceDefaults({
        data: {
          defaultCurrency: currency,
          locale,
          timezone,
          dateFormat,
          weekStartsOn: Number.parseInt(weekStartsOn, 10),
          distanceUnit,
        },
      })
      await router.invalidate()
      toast.success('Workspace defaults saved')
    } catch (cause) {
      toast.error('Could not save the workspace defaults', {
        description:
          cause instanceof Error && cause.message.length > 0
            ? cause.message
            : 'Check your connection and try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  /** Options that must always include whatever is currently stored. */
  function withStored(
    options: ReadonlyArray<{ value: string; label: string }>,
    stored: string,
  ): Array<{ value: string; label: string }> {
    const list = options.map((option) => ({ ...option }))
    return list.some((option) => option.value === stored)
      ? list
      : [{ value: stored, label: stored }, ...list]
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title={data.organization.name}
        description={`${humaniseToken(data.plan)} plan · created ${formatDate(data.organization.createdAt) ?? 'recently'}`}
        actions={
          <Button asChild variant="secondary" size="sm" shape="pill">
            <Link to="/settings/billing">Plan &amp; billing</Link>
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Progress
            value={data.seats.used}
            max={Math.max(data.seats.limit, 1)}
            size="sm"
            tone={seatRatio > 0.9 ? 'warning' : 'brand'}
            label="Seats used"
            valueText={`${formatNumber(data.seats.used)} of ${formatNumber(data.seats.limit)}`}
          />
          <p className="text-caption text-ink-3">
            Outstanding invitations count against your seats, so a workspace can
            never oversubscribe the plan it pays for.
          </p>
        </div>
      </SettingsSection>

      {seatsFull ? (
        <Alert
          tone="warning"
          title="Every seat on this plan is taken"
          actions={
            <Button asChild variant="secondary" size="sm" shape="pill">
              <Link to="/settings/billing">Add seats</Link>
            </Button>
          }
        >
          {`${pluralise(data.seats.used, 'member')} and ${pluralise(data.invitations.length, 'pending invitation')} fill all ${formatNumber(data.seats.limit)} seats.`}
        </Alert>
      ) : null}

      <SettingsSection
        title="Members"
        description="Everyone who can see the trips, the money and the files in this workspace."
        actions={
          <Badge tone="neutral" size="lg" icon={<Users />}>
            {pluralise(data.members.length, 'member')}
          </Badge>
        }
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
                    <Avatar name={member.name} src={member.image} size="sm" />
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
                  <Badge tone={ROLE_TONE[member.role] ?? 'neutral'} size="sm">
                    {humaniseToken(member.role)}
                  </Badge>
                </TableCell>
                <TableCell muted>{formatDate(member.joinedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SettingsSection>

      <SettingsSection
        title="Invitations"
        description="People who have been invited but have not joined yet."
      >
        {data.invitations.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<MailPlus />}
            title="No outstanding invitations"
            description="Everyone invited to this workspace has already joined."
          />
        ) : (
          <ul className="flex flex-col">
            {data.invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0 not-last:border-b not-last:border-edge-faint"
              >
                <span className="min-w-0 flex-1 truncate text-label text-ink">
                  {invitation.email}
                </span>
                <Badge tone="outline" size="sm">
                  {invitation.role === null
                    ? 'Member'
                    : humaniseToken(invitation.role)}
                </Badge>
                <span className="text-caption tabular-nums text-ink-4">
                  expires {formatDate(invitation.expiresAt) ?? 'soon'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection
        title="Shared defaults"
        description="What a new trip and a new member start with. Anyone can override these for themselves in their profile."
        actions={
          data.canAdminister ? (
            <Button
              variant="primary"
              size="sm"
              shape="pill"
              disabled={!dirty}
              loading={saving}
              loadingLabel="Saving the workspace defaults"
              onClick={() => {
                void save()
              }}
            >
              <Save aria-hidden />
              Save changes
            </Button>
          ) : (
            <Badge tone="outline" size="lg">
              Read only
            </Badge>
          )
        }
      >
        <div className="flex flex-col">
          <SettingsRow
            label="Default currency"
            hint="New trips are budgeted in this."
            control={
              <Field>
                <SimpleSelect
                  options={withStored(CURRENCIES, data.defaults.currency)}
                  value={currency}
                  disabled={!data.canAdminister}
                  onValueChange={setCurrency}
                  ariaLabel="Default currency"
                />
              </Field>
            }
          />
          <SettingsRow
            label="Language"
            control={
              <Field>
                <SimpleSelect
                  options={withStored(LOCALES, data.defaults.locale)}
                  value={locale}
                  disabled={!data.canAdminister}
                  onValueChange={setLocale}
                  ariaLabel="Language"
                />
              </Field>
            }
          />
          <SettingsRow
            label="Time zone"
            control={
              <Field>
                <SimpleSelect
                  options={withStored(TIMEZONES, data.defaults.timezone)}
                  value={timezone}
                  disabled={!data.canAdminister}
                  onValueChange={setTimezone}
                  ariaLabel="Time zone"
                />
              </Field>
            }
          />
          <SettingsRow
            label="Date format"
            control={
              <Field>
                <SimpleSelect
                  options={withStored(DATE_FORMATS, data.defaults.dateFormat)}
                  value={dateFormat}
                  disabled={!data.canAdminister}
                  onValueChange={setDateFormat}
                  ariaLabel="Date format"
                />
              </Field>
            }
          />
          <SettingsRow
            label="Week starts on"
            control={
              <Field>
                <SimpleSelect
                  options={withStored(
                    WEEK_STARTS,
                    String(data.defaults.weekStartsOn),
                  )}
                  value={weekStartsOn}
                  disabled={!data.canAdminister}
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
                  options={withStored(
                    DISTANCE_UNITS,
                    data.defaults.distanceUnit,
                  )}
                  value={distanceUnit}
                  disabled={!data.canAdminister}
                  onValueChange={(next) => {
                    if (next === 'metric' || next === 'imperial') {
                      setDistanceUnit(next)
                    }
                  }}
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

function OrganizationPending() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
      <Card className="space-y-4">
        <Skeleton className="h-5 w-48" radius="sm" />
        <Skeleton className="h-1.5 w-full" radius="full" />
      </Card>
      <Card className="space-y-4">
        <Skeleton className="h-4 w-28" radius="sm" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0" radius="full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" radius="sm" />
              <Skeleton className="h-2.5 w-56" radius="sm" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
