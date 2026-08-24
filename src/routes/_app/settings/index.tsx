import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  BadgeCheck,
  Building2,
  ChevronRight,
  Save,
  TriangleAlert,
} from 'lucide-react'
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
import { localeDescriptor, useLocale, useTranslate } from '#/lib/i18n'
import { loadProfile } from '../-server/settings'
import { formatDate } from '../-lib/format'
import { SettingsRow, SettingsSection } from '../-ui/settings-nav'
import { saveRegionalOverrides } from './-server/preferences'
import {
  FOLLOW_DEFAULT,
  currencyLabel,
  currencyOptions,
  dateFormatLabel,
  dateFormatOptions,
  distanceLabel,
  distanceOptions,
  roleLabel,
  timeZoneLabel,
  timeZoneOptions,
  weekStartLabel,
  weekStartOptions,
  withWorkspaceDefault,
} from './-lib/regional'

/**
 * The traveller's own profile, and the five regional overrides that follow the
 * workspace until they are set.
 *
 * **There is no language select here any more.** There used to be one, offering
 * eight region-tagged values with English labels — `en-GB` shown as "English
 * (United Kingdom)" — none of which is a tag the product ships and every one of
 * which broke §8's rule that a language is named in its own language and script.
 * It also wrote the same `user_settings.locale` column the picker writes, and
 * `resolveLocaleTag` collapses `en-GB` to `en`, so choosing "English (United
 * Kingdom)" stored a value the select could not name and left the trigger blank
 * on the next load. The language row below is a signpost to `/settings/language`,
 * where the twenty-three native names have room to be read.
 *
 * **And this form no longer writes that column.** It saves through
 * `saveRegionalOverrides`, whose input does not declare `locale`, so the tag
 * this screen read at load time can never be written back over one the language
 * screen set in another tab. One column, one writer.
 */
export const Route = createFileRoute('/_app/settings/')({
  loader: () => loadProfile(),
  pendingComponent: ProfilePending,
  errorComponent: ProfileError,
  component: ProfilePage,
})

function ProfileError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <ErrorPanel error={error} title={t('settings.profile.error')} />
}

function ProfilePage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const t = useTranslate()
  const locale = useLocale()

  const [saving, setSaving] = useState(false)
  const [timezone, setTimezone] = useState(
    data.overrides.timezone ?? FOLLOW_DEFAULT,
  )
  const [currency, setCurrency] = useState(
    data.overrides.currency ?? FOLLOW_DEFAULT,
  )
  const [dateFormat, setDateFormat] = useState(
    data.overrides.dateFormat ?? FOLLOW_DEFAULT,
  )
  const [weekStartsOn, setWeekStartsOn] = useState(
    data.overrides.weekStartsOn === null
      ? FOLLOW_DEFAULT
      : String(data.overrides.weekStartsOn),
  )
  const [distanceUnit, setDistanceUnit] = useState(
    data.overrides.distanceUnit ?? FOLLOW_DEFAULT,
  )

  const dirty =
    timezone !== (data.overrides.timezone ?? FOLLOW_DEFAULT) ||
    currency !== (data.overrides.currency ?? FOLLOW_DEFAULT) ||
    dateFormat !== (data.overrides.dateFormat ?? FOLLOW_DEFAULT) ||
    weekStartsOn !==
      (data.overrides.weekStartsOn === null
        ? FOLLOW_DEFAULT
        : String(data.overrides.weekStartsOn)) ||
    distanceUnit !== (data.overrides.distanceUnit ?? FOLLOW_DEFAULT)

  const languageInForce = localeDescriptor(
    data.overrides.locale ?? data.workspaceDefaults.locale,
  )

  async function save(): Promise<void> {
    setSaving(true)
    try {
      // Five fields, and no `locale`. The write this form used to make carried
      // the tag its loader data was rendered with, so a second tab left open
      // while the traveller changed language in the first put the stale one
      // back on Save changes. `saveRegionalOverrides` cannot reach that column:
      // its input does not declare it, so it is not in the `SET` clause.
      await saveRegionalOverrides({
        data: {
          timezone: timezone === FOLLOW_DEFAULT ? '' : timezone,
          currency: currency === FOLLOW_DEFAULT ? '' : currency,
          dateFormat: dateFormat === FOLLOW_DEFAULT ? '' : dateFormat,
          weekStartsOn:
            weekStartsOn === FOLLOW_DEFAULT
              ? null
              : Number.parseInt(weekStartsOn, 10),
          distanceUnit:
            distanceUnit === 'metric' || distanceUnit === 'imperial'
              ? distanceUnit
              : '',
        },
      })
      await router.invalidate()
      toast.success(t('settings.profile.regional.saved'))
    } catch {
      toast.error(t('settings.profile.regional.saveFailed'), {
        description: t('settings.error.retryBody'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title={t('settings.profile.account.title')}
        description={t('settings.profile.account.description')}
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
                  ? t('settings.profile.email.verified')
                  : t('settings.profile.email.unverified')}
              </Badge>
              <Badge tone="brand" size="sm">
                {roleLabel(t, data.membership.role)}
              </Badge>
              {data.user.twoFactorEnabled ? (
                <Badge tone="success" size="sm">
                  {t('settings.profile.twoFactor.on')}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-edge-faint pt-5 sm:grid-cols-3">
          <Figure
            label={t('settings.profile.figure.workspace')}
            value={data.membership.organizationName}
            icon
          />
          <Figure
            label={t('settings.profile.figure.role')}
            value={roleLabel(t, data.membership.role)}
          />
          <Figure
            label={t('settings.profile.figure.joined')}
            value={
              formatDate(data.membership.joinedAt, locale) ??
              t('settings.profile.figure.joinedUnknown')
            }
          />
        </dl>
      </SettingsSection>

      <SettingsSection
        title={t('settings.profile.regional.title')}
        description={t('settings.profile.regional.description')}
        actions={
          <Button
            variant="primary"
            size="sm"
            shape="pill"
            disabled={!dirty}
            loading={saving}
            loadingLabel={t('settings.profile.regional.saving')}
            onClick={() => {
              void save()
            }}
          >
            <Save aria-hidden />
            {t('settings.action.save')}
          </Button>
        }
      >
        <div className="flex flex-col">
          <SettingsRow
            label={t('settings.profile.language.label')}
            hint={
              <>
                <span
                  lang={languageInForce.tag}
                  dir={languageInForce.dir === 'rtl' ? 'rtl' : undefined}
                  className="font-medium text-ink-2"
                >
                  {languageInForce.nativeName}
                </span>
                {' · '}
                {t('settings.profile.language.hint')}
              </>
            }
            control={
              <div className="flex sm:justify-end">
                <Button asChild variant="secondary" size="sm" shape="pill">
                  <Link to="/settings/language">
                    {t('settings.profile.language.action')}
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </div>
            }
          />
          <SettingsRow
            label={t('settings.profile.timezone.label')}
            hint={t('settings.profile.timezone.hint')}
            control={
              <Field>
                <SimpleSelect
                  options={withWorkspaceDefault(
                    t,
                    timeZoneOptions(data.overrides.timezone ?? ''),
                    timeZoneLabel(data.workspaceDefaults.timezone),
                  )}
                  value={timezone}
                  onValueChange={setTimezone}
                  ariaLabel={t('settings.profile.timezone.label')}
                />
              </Field>
            }
          />
          <SettingsRow
            label={t('settings.profile.currency.label')}
            hint={t('settings.profile.currency.hint')}
            control={
              <Field>
                <SimpleSelect
                  options={withWorkspaceDefault(
                    t,
                    currencyOptions(t, data.overrides.currency ?? ''),
                    currencyLabel(t, data.workspaceDefaults.currency),
                  )}
                  value={currency}
                  onValueChange={setCurrency}
                  ariaLabel={t('settings.profile.currency.label')}
                />
              </Field>
            }
          />
          <SettingsRow
            label={t('settings.profile.dateFormat.label')}
            control={
              <Field>
                <SimpleSelect
                  options={withWorkspaceDefault(
                    t,
                    dateFormatOptions(locale, data.overrides.dateFormat ?? ''),
                    dateFormatLabel(data.workspaceDefaults.dateFormat, locale),
                  )}
                  value={dateFormat}
                  onValueChange={setDateFormat}
                  ariaLabel={t('settings.profile.dateFormat.label')}
                />
              </Field>
            }
          />
          <SettingsRow
            label={t('settings.profile.weekStart.label')}
            hint={t('settings.profile.weekStart.hint')}
            control={
              <Field>
                <SimpleSelect
                  options={withWorkspaceDefault(
                    t,
                    weekStartOptions(
                      locale,
                      data.overrides.weekStartsOn === null
                        ? ''
                        : String(data.overrides.weekStartsOn),
                    ),
                    weekStartLabel(data.workspaceDefaults.weekStartsOn, locale),
                  )}
                  value={weekStartsOn}
                  onValueChange={setWeekStartsOn}
                  ariaLabel={t('settings.profile.weekStart.label')}
                />
              </Field>
            }
          />
          <SettingsRow
            label={t('settings.profile.distance.label')}
            control={
              <Field>
                <SimpleSelect
                  options={withWorkspaceDefault(
                    t,
                    distanceOptions(t),
                    distanceLabel(t, data.workspaceDefaults.distanceUnit),
                  )}
                  value={distanceUnit}
                  onValueChange={setDistanceUnit}
                  ariaLabel={t('settings.profile.distance.label')}
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
  const t = useTranslate()
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('ui.status.loading')}</span>
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
