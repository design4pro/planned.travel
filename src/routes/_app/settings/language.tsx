import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Languages } from 'lucide-react'
import { toast } from 'sonner'

import { ErrorPanel } from '#/components/layout/error-state'
import {
  FOLLOW_WORKSPACE,
  LanguagePicker,
  LanguagePickerSkeleton,
} from '#/components/settings'
import { Card, Skeleton } from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatDate, formatMoneyMinor, formatNumber } from '#/lib/format'
import { localeDescriptor, useLocale, useTranslate } from '#/lib/i18n'
import { loadProfile, saveLanguagePreference } from '../-server/settings'
import { SettingsSection } from '../-ui/settings-nav'

import type { LocaleChoice } from '#/components/settings'
import type { Locale } from '#/lib/i18n'

/**
 * The language screen: twenty-three languages, each written in its own script.
 *
 * **Why it is a route of its own.** `docs/SPEC.md` §8.7 puts the picker "in
 * settings" and no further. It cannot live in a `SettingsRow`, whose control
 * column is a fixed `sm:w-64` so that a column of selects lands on one edge
 * rather than four — a twenty-four-option wrapped grid in 256px is a list of
 * truncated names. And it cannot live beside a select of the same column: two
 * controls writing `user_settings.locale` is exactly the defect this screen
 * retires, where `/settings` offered eight region-tagged values labelled in
 * English (`en-GB` as "English (United Kingdom)") against five more on
 * `/settings/organization`. So the picker gets the full width of a section, the
 * traveller's choice lives here, and the workspace default — a different column,
 * written by a different role — stays under Workspace.
 *
 * **Why the write is `saveLanguagePreference` and not `saveRegionalSettings`.**
 * The regional form's input requires all six of its fields and reads `''` on any
 * of them as "clear this override", so a locale-only click sent through it blanks
 * the traveller's time zone, currency, date format and distance unit on the way
 * past. `saveLanguagePreference` exists for this click and for nothing else:
 * `updateUserSettings` passes its parsed patch through `definedOnly`, so `locale`
 * is the only column in the `SET` clause. Both share the `''` sentinel that
 * `overrideOrNull` turns into the SQL `NULL` which makes `getEffectiveSettings`
 * fall back to the workspace row.
 *
 * **Why `router.invalidate()` and not a client-side catalogue swap.** §8.3 has
 * the locale negotiated on the server, once, before first paint, with
 * `<html lang>` and `<html dir>` server-rendered. Invalidating re-runs the root
 * loader, which re-negotiates from the row this write just changed and hands
 * down a new catalogue — so the document's language attribute, its direction,
 * its font stack and every string on every open screen change together, in
 * place, from one source. A local swap would have to reproduce that and would
 * disagree with the next full load.
 */
export const Route = createFileRoute('/_app/settings/language')({
  loader: () => loadProfile(),
  pendingComponent: LanguagePending,
  errorComponent: LanguageError,
  component: LanguagePage,
})

function LanguageError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <ErrorPanel error={error} title={t('settings.language.error')} />
}

/** The day and the amounts the preview is written with — never a real "now". */
const SAMPLE_DATE = '2026-06-23'
const SAMPLE_NUMBER = 1_234_567
const SAMPLE_MINOR = 249_900

function LanguagePage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const t = useTranslate()
  const locale = useLocale()

  const workspaceDefault = data.workspaceDefaults.locale
  const [choice, setChoice] = useState<LocaleChoice>(
    data.overrides.locale ?? FOLLOW_WORKSPACE,
  )
  const [pending, setPending] = useState<LocaleChoice | null>(null)

  /** The locale a choice actually resolves to, for naming it in its own script. */
  function resolve(value: LocaleChoice): Locale {
    return value === FOLLOW_WORKSPACE ? workspaceDefault : value
  }

  async function choose(next: LocaleChoice): Promise<void> {
    const previous = choice
    setPending(next)
    setChoice(next)
    try {
      const saved = await saveLanguagePreference({
        data: { locale: next === FOLLOW_WORKSPACE ? '' : next },
      })
      // What D1 now holds, not what the click hoped for: `en-GB` is stored, and
      // answered, as `en`.
      setChoice(saved.locale ?? FOLLOW_WORKSPACE)
      await router.invalidate()
      toast.success(
        t('settings.language.saved', {
          language: localeDescriptor(resolve(saved.locale ?? FOLLOW_WORKSPACE))
            .nativeName,
        }),
      )
    } catch {
      // Back to the value that is still in D1, and an authored sentence — never
      // a server error message, which is written for an operator's log rather
      // than for a traveller who has just been told their language did change.
      setChoice(previous)
      toast.error(t('settings.language.saveFailed'), {
        description: t('settings.language.saveFailedBody', {
          language: localeDescriptor(resolve(previous)).nativeName,
        }),
      })
    } finally {
      setPending(null)
    }
  }

  const following = choice === FOLLOW_WORKSPACE
  const inForce = localeDescriptor(resolve(choice))

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title={t('settings.language.section.title')}
        description={t('settings.language.section.description')}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <div className={STATE_SHELL}>
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand"
            >
              <Languages className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-micro font-semibold tracking-label uppercase text-ink-4">
                {following
                  ? t('settings.language.state.workspace')
                  : t('settings.language.state.yours')}
              </span>
              <span
                lang={inForce.tag}
                dir={inForce.dir === 'rtl' ? 'rtl' : undefined}
                className="block truncate text-label font-semibold text-ink"
              >
                {inForce.nativeName}
              </span>
            </span>
          </div>

          <LanguagePicker
            value={choice}
            workspaceDefault={workspaceDefault}
            pending={pending}
            onSelect={(next) => {
              void choose(next)
            }}
            label={t('settings.language.label')}
            followWorkspaceLabel={t('settings.language.followWorkspace')}
          />

          <div className="flex flex-col gap-1.5 text-caption leading-relaxed text-ink-3">
            <p>
              {following
                ? t('settings.language.state.hint.workspace')
                : t('settings.language.state.hint.override')}
            </p>
            <p>{t('settings.language.legal')}</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('settings.language.sample.title')}
        description={t('settings.language.sample.description')}
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <Sample
            label={t('settings.language.sample.date')}
            value={formatDate(SAMPLE_DATE, locale) ?? SAMPLE_DATE}
          />
          <Sample
            label={t('settings.language.sample.number')}
            value={formatNumber(SAMPLE_NUMBER, locale)}
          />
          <Sample
            label={t('settings.language.sample.money')}
            value={formatMoneyMinor(
              SAMPLE_MINOR,
              data.effective.currency,
              locale,
            )}
          />
        </dl>
      </SettingsSection>
    </div>
  )
}

/**
 * One preview figure. `tabular-nums` because every one of these three changes
 * the moment a chip is clicked, and a proportional comma jitters the row.
 */
function Sample({ label, value }: { label: string; value: string }) {
  return (
    <div className={SAMPLE_SHELL}>
      <dt className="mb-1 text-micro font-semibold tracking-label uppercase text-ink-4">
        {label}
      </dt>
      <dd className="truncate text-label font-medium tabular-nums text-ink">
        {value}
      </dd>
    </div>
  )
}

/**
 * The two boxes this screen adds to the picker, and the line boxes inside them.
 *
 * Written once and shared with the pending state below, which is the only way a
 * skeleton stays the height of the thing it replaces. Measured before they were
 * shared: a hand-guessed `h-14` stood in for a 62px panel and `h-16` for a
 * 61.375px figure, so the loading shape was 8.6px short over the two of them and
 * the content it was holding space for jumped on arrival — which is worse than
 * no skeleton, because it converts one movement into two.
 *
 * The line boxes are the type tokens themselves rather than a rounded pixel
 * count, so they survive a change to the scale and follow the `:lang(ar)`
 * re-leading in `src/styles/styles.css` the same way the real text does.
 */
const STATE_SHELL =
  'flex min-w-0 items-center gap-3 rounded-lg border border-edge-faint bg-surface-2 px-4 py-3'
const SAMPLE_SHELL =
  'min-w-0 rounded-md border border-edge-faint bg-surface-2 px-3.5 py-3'
const MICRO_LINE = 'h-[calc(var(--text-micro)*var(--text-micro--line-height))]'
const LABEL_LINE = 'h-[calc(var(--text-label)*var(--text-label--line-height))]'

/** A skeleton bar centred in the line box the loaded text will occupy. */
function BarInLine({ box, width }: { box: string; width: string }) {
  return (
    <div className={cn('flex items-center', box)}>
      <Skeleton className={cn('h-2', width)} radius="sm" />
    </div>
  )
}

function LanguagePending() {
  const t = useTranslate()
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('ui.status.loading')}</span>
      <Card className="space-y-5">
        <div className={STATE_SHELL}>
          <Skeleton className="size-9 shrink-0" radius="full" />
          <div className="min-w-0 flex-1">
            <BarInLine box={MICRO_LINE} width="w-32" />
            <BarInLine box={LABEL_LINE} width="w-20" />
          </div>
        </div>
        <LanguagePickerSkeleton />
      </Card>
      <Card className="space-y-4">
        <Skeleton className="h-4 w-48" radius="sm" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={SAMPLE_SHELL}>
              <div className="mb-1">
                <BarInLine box={MICRO_LINE} width="w-16" />
              </div>
              <BarInLine box={LABEL_LINE} width="w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
