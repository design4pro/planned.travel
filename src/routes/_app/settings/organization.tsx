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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SimpleSelect,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui'
import { planFromUnknown } from '#/lib/plans'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  localeDescriptor,
  useLocale,
  useTranslate,
} from '#/lib/i18n'
import {
  loadOrganizationSettings,
  saveWorkspaceDefaults,
} from '../-server/settings'
import { formatDate, formatNumber } from '../-lib/format'
import { SettingsRow, SettingsSection } from '../-ui/settings-nav'
import {
  currencyOptions,
  dateFormatOptions,
  distanceOptions,
  roleLabel,
  timeZoneOptions,
  weekStartOptions,
} from './-lib/regional'

import type { Locale } from '#/lib/i18n'

const ROLE_TONE: Record<string, 'accent' | 'brand' | 'neutral'> = {
  owner: 'accent',
  admin: 'brand',
  member: 'neutral',
}

export const Route = createFileRoute('/_app/settings/organization')({
  loader: () => loadOrganizationSettings(),
  pendingComponent: OrganizationPending,
  errorComponent: OrganizationError,
  component: OrganizationPage,
})

function OrganizationError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <ErrorPanel error={error} title={t('settings.workspace.error')} />
}

/**
 * The workspace language, from the same twenty-three-tag registry the picker
 * reads — never a list of region-tagged values labelled in English.
 *
 * It stays a select rather than becoming a second chip grid: this is one row in
 * a column of six defaults, and the traveller-facing grid lives on its own
 * screen at `/settings/language`. Built from the composable `Select` parts rather
 * than `SimpleSelect` for one reason — every item needs its own `lang`, and for
 * Arabic its own `dir`. `src/styles/styles.css` re-orders the font stack under
 * `:lang(ja)`, `:lang(ko)` and `:lang(zh-Hant)`, and Hangul in particular cannot
 * be reached by stack order alone because Noto Sans SC and TC both claim 한, 국
 * and 어 in their served unicode-range. Without the attribute, 한국어 renders in
 * the Simplified Chinese face and a screen reader says it in an English voice.
 *
 * The trigger is given its label as children for the same reason `SimpleSelect`
 * does: Radix builds `Select.Content` in a layout effect, which never runs on the
 * server, so a portalled `ItemText` leaves a server-rendered trigger empty until
 * hydration.
 */
function WorkspaceLanguageSelect({
  value,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: Locale
  disabled: boolean
  ariaLabel: string
  onChange: (next: Locale) => void
}) {
  const selected = localeDescriptor(value)

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (isSupportedLocale(next)) onChange(next)
      }}
    >
      <SelectTrigger aria-label={ariaLabel}>
        <span
          lang={selected.tag}
          dir={selected.dir === 'rtl' ? 'rtl' : undefined}
        >
          <SelectValue>{selected.nativeName}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((descriptor) => (
          <SelectItem
            key={descriptor.tag}
            value={descriptor.tag}
            lang={descriptor.tag}
            dir={descriptor.dir === 'rtl' ? 'rtl' : undefined}
          >
            {descriptor.nativeName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function OrganizationPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const t = useTranslate()
  const locale = useLocale()

  const storedLocale: Locale = isSupportedLocale(data.defaults.locale)
    ? data.defaults.locale
    : DEFAULT_LOCALE

  const [saving, setSaving] = useState(false)
  const [currency, setCurrency] = useState(data.defaults.currency)
  const [workspaceLocale, setWorkspaceLocale] = useState<Locale>(storedLocale)
  const [timezone, setTimezone] = useState(data.defaults.timezone)
  const [dateFormat, setDateFormat] = useState(data.defaults.dateFormat)
  const [weekStartsOn, setWeekStartsOn] = useState(
    String(data.defaults.weekStartsOn),
  )
  const [distanceUnit, setDistanceUnit] = useState(data.defaults.distanceUnit)

  const dirty =
    currency !== data.defaults.currency ||
    workspaceLocale !== storedLocale ||
    timezone !== data.defaults.timezone ||
    dateFormat !== data.defaults.dateFormat ||
    weekStartsOn !== String(data.defaults.weekStartsOn) ||
    distanceUnit !== data.defaults.distanceUnit

  const seatRatio = data.seats.used / Math.max(data.seats.limit, 1)
  const seatsFull =
    data.seats.used + data.invitations.length >= data.seats.limit

  const memberCount = t('settings.workspace.members.count', {
    count: data.members.length,
    value: formatNumber(data.members.length, locale),
  })
  const invitationCount = t('settings.workspace.invitations.count', {
    count: data.invitations.length,
    value: formatNumber(data.invitations.length, locale),
  })

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await saveWorkspaceDefaults({
        data: {
          defaultCurrency: currency,
          locale: workspaceLocale,
          timezone,
          dateFormat,
          weekStartsOn: Number.parseInt(weekStartsOn, 10),
          distanceUnit,
        },
      })
      await router.invalidate()
      toast.success(t('settings.workspace.defaults.saved'))
    } catch {
      // Authored, not the server's own sentence: the only way this write fails
      // for a viewer the screen let near it is the role assertion in
      // `updateOrganizationSettings`, and that is what the copy explains.
      toast.error(t('settings.workspace.defaults.saveFailed'), {
        description: t('settings.workspace.defaults.saveFailedBody'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title={data.organization.name}
        description={t('settings.workspace.summary.description', {
          plan: planFromUnknown(data.plan)?.name ?? data.plan,
          date:
            formatDate(data.organization.createdAt, locale) ??
            t('settings.workspace.summary.createdRecently'),
        })}
        actions={
          <Button asChild variant="secondary" size="sm" shape="pill">
            <Link to="/settings/billing">
              {t('settings.workspace.summary.billingAction')}
            </Link>
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Progress
            value={data.seats.used}
            max={Math.max(data.seats.limit, 1)}
            size="sm"
            tone={seatRatio > 0.9 ? 'warning' : 'brand'}
            label={t('settings.workspace.seats.label')}
            valueText={t('settings.workspace.seats.value', {
              used: formatNumber(data.seats.used, locale),
              limit: formatNumber(data.seats.limit, locale),
            })}
          />
          <p className="text-caption text-ink-3">
            {t('settings.workspace.seats.note')}
          </p>
        </div>
      </SettingsSection>

      {seatsFull ? (
        <Alert
          tone="warning"
          title={t('settings.workspace.seatsFull.title')}
          actions={
            <Button asChild variant="secondary" size="sm" shape="pill">
              <Link to="/settings/billing">
                {t('settings.workspace.seatsFull.action')}
              </Link>
            </Button>
          }
        >
          {t('settings.workspace.seatsFull.body', {
            members: memberCount,
            invitations: invitationCount,
            limit: formatNumber(data.seats.limit, locale),
          })}
        </Alert>
      ) : null}

      <SettingsSection
        title={t('settings.workspace.members.title')}
        description={t('settings.workspace.members.description')}
        actions={
          <Badge tone="neutral" size="lg" icon={<Users />}>
            {memberCount}
          </Badge>
        }
      >
        <Table label={t('settings.workspace.members.tableLabel')} fixed>
          <TableHeader>
            <TableRow>
              <TableHead>{t('settings.workspace.members.person')}</TableHead>
              <TableHead className="w-28">
                {t('settings.workspace.members.role')}
              </TableHead>
              <TableHead className="w-32">
                {t('settings.workspace.members.joined')}
              </TableHead>
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
                    {roleLabel(t, member.role)}
                  </Badge>
                </TableCell>
                <TableCell muted>
                  {formatDate(member.joinedAt, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SettingsSection>

      <SettingsSection
        title={t('settings.workspace.invitations.title')}
        description={t('settings.workspace.invitations.description')}
      >
        {data.invitations.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<MailPlus />}
            title={t('settings.workspace.invitations.emptyTitle')}
            description={t('settings.workspace.invitations.emptyBody')}
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
                  {roleLabel(t, invitation.role)}
                </Badge>
                <span className="text-caption tabular-nums text-ink-4">
                  {t('settings.workspace.invitations.expires', {
                    date:
                      formatDate(invitation.expiresAt, locale) ??
                      t('settings.workspace.invitations.expiresSoon'),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection
        title={t('settings.workspace.defaults.title')}
        description={t('settings.workspace.defaults.description')}
        actions={
          data.canAdminister ? (
            <Button
              variant="primary"
              size="sm"
              shape="pill"
              disabled={!dirty}
              loading={saving}
              loadingLabel={t('settings.workspace.defaults.saving')}
              onClick={() => {
                void save()
              }}
            >
              <Save aria-hidden />
              {t('settings.action.save')}
            </Button>
          ) : (
            <Badge tone="outline" size="lg">
              {t('settings.workspace.defaults.readOnly')}
            </Badge>
          )
        }
      >
        <div className="flex flex-col">
          <SettingsRow
            label={t('settings.workspace.currency.label')}
            hint={t('settings.workspace.currency.hint')}
            control={
              <Field>
                <SimpleSelect
                  options={currencyOptions(t, data.defaults.currency)}
                  value={currency}
                  disabled={!data.canAdminister}
                  onValueChange={setCurrency}
                  ariaLabel={t('settings.workspace.currency.label')}
                />
              </Field>
            }
          />
          <SettingsRow
            label={t('settings.workspace.language.label')}
            hint={t('settings.workspace.language.hint')}
            control={
              <Field>
                <WorkspaceLanguageSelect
                  value={workspaceLocale}
                  disabled={!data.canAdminister}
                  ariaLabel={t('settings.workspace.language.label')}
                  onChange={setWorkspaceLocale}
                />
              </Field>
            }
          />
          <SettingsRow
            label={t('settings.workspace.timezone.label')}
            control={
              <Field>
                <SimpleSelect
                  options={timeZoneOptions(data.defaults.timezone)}
                  value={timezone}
                  disabled={!data.canAdminister}
                  onValueChange={setTimezone}
                  ariaLabel={t('settings.workspace.timezone.label')}
                />
              </Field>
            }
          />
          <SettingsRow
            label={t('settings.workspace.dateFormat.label')}
            control={
              <Field>
                <SimpleSelect
                  options={dateFormatOptions(locale, data.defaults.dateFormat)}
                  value={dateFormat}
                  disabled={!data.canAdminister}
                  onValueChange={setDateFormat}
                  ariaLabel={t('settings.workspace.dateFormat.label')}
                />
              </Field>
            }
          />
          <SettingsRow
            label={t('settings.workspace.weekStart.label')}
            control={
              <Field>
                <SimpleSelect
                  options={weekStartOptions(
                    locale,
                    String(data.defaults.weekStartsOn),
                  )}
                  value={weekStartsOn}
                  disabled={!data.canAdminister}
                  onValueChange={setWeekStartsOn}
                  ariaLabel={t('settings.workspace.weekStart.label')}
                />
              </Field>
            }
          />
          <SettingsRow
            label={t('settings.workspace.distance.label')}
            control={
              <Field>
                <SimpleSelect
                  options={distanceOptions(t)}
                  value={distanceUnit}
                  disabled={!data.canAdminister}
                  onValueChange={(next) => {
                    if (next === 'metric' || next === 'imperial') {
                      setDistanceUnit(next)
                    }
                  }}
                  ariaLabel={t('settings.workspace.distance.label')}
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
  const t = useTranslate()
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('ui.status.loading')}</span>
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
