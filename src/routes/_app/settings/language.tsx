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
import { Skeleton } from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatDate, formatMoneyMinor, formatNumber } from '#/lib/format'
import {
  createTranslator,
  loadCatalogue,
  localeDescriptor,
  useLocale,
  useTranslate,
} from '#/lib/i18n'
import { saveLanguagePreference } from '../-server/settings'
import { SettingsSection } from '../-ui/settings-nav'
import { loadLanguageSettings } from './-server/preferences'

import type { LocaleChoice } from '#/components/settings'
import type { Locale } from '#/lib/i18n'
import type { ReactNode } from 'react'

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
 *
 * **Why the loader is `loadLanguageSettings` and not `loadProfile`.** This
 * screen draws three values, and `loadProfile` pays six D1 reads for eleven —
 * one of them `listMemberProfiles`, an unbounded `member INNER JOIN user` over
 * the tenant. Scanning a member table to print a sample date is the read-path
 * posture `docs/ARCHITECTURE.md` §6 rules out; the loader in
 * `./-server/preferences` reads the two rows this screen is about.
 */
export const Route = createFileRoute('/_app/settings/language')({
  loader: () => loadLanguageSettings(),
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

  const workspaceDefault = data.workspace
  const [choice, setChoice] = useState<LocaleChoice>(
    data.override ?? FOLLOW_WORKSPACE,
  )
  const [pending, setPending] = useState<LocaleChoice | null>(null)

  /** The locale a choice actually resolves to, for naming it in its own script. */
  function resolve(value: LocaleChoice): Locale {
    return value === FOLLOW_WORKSPACE ? workspaceDefault : value
  }

  /**
   * The click, in two halves that fail differently.
   *
   * Only the first half can be rolled back. Once `saveLanguagePreference`
   * resolves, `user_settings.locale` holds the new tag and `<html lang>` is one
   * `invalidate()` away from agreeing with it — so a rejection *after* that
   * point is not "the save failed", and answering it by putting the chip back
   * and saying "you are still reading English" leaves both the control and the
   * sentence contradicting the row and the document. The two halves therefore
   * get one `try` each: the write may be undone, and what follows it may only
   * be reported.
   */
  async function choose(next: LocaleChoice): Promise<void> {
    const previous = choice
    setPending(next)
    setChoice(next)

    let landed: LocaleChoice
    try {
      const saved = await saveLanguagePreference({
        data: { locale: next === FOLLOW_WORKSPACE ? '' : next },
      })
      // What D1 now holds, not what the click hoped for: `en-GB` is stored, and
      // answered, as `en`.
      landed = saved.locale ?? FOLLOW_WORKSPACE
    } catch {
      // Nothing was written, so back to the value that is still in D1, and an
      // authored sentence — never a server error message, which is written for
      // an operator's log rather than for a traveller who has just been told
      // their language did change.
      setChoice(previous)
      setPending(null)
      toast.error(t('settings.language.saveFailed'), {
        description: t('settings.language.saveFailedBody', {
          language: localeDescriptor(resolve(previous)).nativeName,
        }),
      })
      return
    }

    setChoice(landed)
    const inForceNow = resolve(landed)
    try {
      await router.invalidate()
      // Announced in the language that was just switched on, not the one being
      // left. `t` is the translator this render closed over, so a traveller
      // moving to German was told so in English — the one sentence on the
      // screen that must prove the change took effect, printed in the proof's
      // own contradiction. The root loader has already resolved this locale's
      // catalogue by the time `invalidate()` settles, so the load below is a
      // cache read (`peekCatalogue`'s map, filled by `loadCatalogue`) rather
      // than a second fetch.
      //
      // A locale whose catalogue is still empty renders the key, deliberately:
      // `createTranslator` has no English branch, because `docs/SPEC.md` §8.2
      // bans the silent fallback that hides a hole. Until the translation items
      // land, this toast says what every other string on the page says — and it
      // is the same sentence in every locale the moment they do.
      const spoken = createTranslator(
        inForceNow,
        await loadCatalogue(inForceNow),
      )
      toast.success(
        spoken('settings.language.saved', {
          language: localeDescriptor(inForceNow).nativeName,
        }),
      )
    } catch {
      // The row was written and the chip is right; a loader on this screen or
      // the catalogue chunk for the new language was not. Said in the language
      // the reader is still looking at, because the switch is exactly what did
      // not finish — and the selection stays where D1 put it.
      toast.warning(t('settings.language.reload.title'), {
        description: t('settings.language.reload.body', {
          language: localeDescriptor(inForceNow).nativeName,
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
              <span className={cn('block truncate', MICRO_TEXT)}>
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
            className={PICKER_COLUMNS}
            value={choice}
            workspaceDefault={workspaceDefault}
            pending={pending}
            onSelect={(next) => {
              void choose(next)
            }}
            label={t('settings.language.label')}
            followWorkspaceLabel={t('settings.language.followWorkspace')}
          />

          <Hints state={following ? 'workspace' : 'yours'} />
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
            value={formatMoneyMinor(SAMPLE_MINOR, data.currency, locale)}
          />
        </dl>
      </SettingsSection>
    </div>
  )
}

/**
 * The two sentences under the grid, stacked into one grid cell.
 *
 * Only one of them is true at a time and they are different lengths, so a block
 * that renders just the applicable one is one height in each state — and a
 * third height in the loading shape, which knows neither which sentence applies
 * nor how many lines it takes at this width. Stacking both in the same cell
 * makes the block as tall as the longer of the two always: in either state, in
 * the pending shape, and in a language whose sentences run half again as long.
 * A reserved `min-h` cannot promise that — it would need a line count per
 * breakpoint per language, and would be wrong the first time a translator wrote
 * a longer sentence.
 *
 * `invisible` is `visibility: hidden`, which keeps the box (that is the whole
 * point) and takes the words out of the accessibility tree, so a screen reader
 * hears the one sentence that applies rather than both.
 */
function Hints({ state }: { state: 'yours' | 'workspace' | 'pending' }) {
  const t = useTranslate()
  return (
    <div className="flex flex-col gap-1.5 text-caption leading-relaxed text-ink-3">
      <div className="grid">
        <p className={cn(HINT_CELL, state !== 'yours' && 'invisible')}>
          {t('settings.language.state.hint.override')}
        </p>
        <p className={cn(HINT_CELL, state !== 'workspace' && 'invisible')}>
          {t('settings.language.state.hint.workspace')}
        </p>
        {state === 'pending' ? (
          <Skeleton className={cn(HINT_CELL, 'my-1')} radius="sm" />
        ) : null}
      </div>
      {/* Static copy, so the loading shape shows it rather than shimmering it. */}
      <p>{t('settings.language.legal')}</p>
    </div>
  )
}

/**
 * One preview figure. `tabular-nums` because every one of these three changes
 * the moment a chip is clicked, and a proportional comma jitters the row.
 *
 * `value` is a node rather than a string so the loading shape is this same
 * component with a bar in it, which is the only way the box, its padding and
 * its two line heights cannot drift apart between the two states.
 */
function Sample({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={SAMPLE_SHELL}>
      <dt className={cn('mb-1 truncate', MICRO_TEXT)}>{label}</dt>
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

/**
 * The eyebrow above a value, and why it is always `truncate`d.
 *
 * A single line box is only worth reserving if the text can never take two, and
 * "Supplied by the workspace" in an 11px uppercase face tracked at 0.08em is
 * 200px of ink against the 206px this panel's text column measures at 360px —
 * so the German or Ukrainian for it would have wrapped, and the loading shape
 * that reserved one line would have been a line short of the thing it was
 * holding space for. `truncate` makes the box one line by construction in all
 * twenty-three languages, which is the same reason the name beneath it carries
 * one.
 */
const MICRO_TEXT =
  'text-micro font-semibold tracking-label uppercase text-ink-4'

/** Both hint sentences occupy this one cell, so the taller of them sizes it. */
const HINT_CELL = 'col-start-1 row-start-1'

/**
 * Two columns of chips on a phone, instead of twenty-three stacked rows.
 *
 * The picker's own track floor is 10.5rem, measured so that the widest native
 * name never truncates at the width a settings panel gives it on a laptop. Two
 * of those tracks and their 8px gap need 344px, and this card's body measures
 * 319px on the reference phone — 393 less the app frame's 2 × 16px inset, the
 * card's own 2 × 20px padding and its hairline — so `auto-fill` fell to a single
 * column and the whole affordance became a list the reader scrolls 1,100px past.
 * That is the "squeezed desktop" `docs/SPEC.md` §2 rules out for mobile, and it
 * is the one width where this screen has to be a designed layout rather than the
 * same layout narrower.
 *
 * Two changes, both measured in Chromium *and* WebKit at 393px, because the
 * mobile baseline is recorded in WebKit and the two engines round text metrics
 * differently:
 *
 * - The track floor drops to 9.5rem below `sm`. That changes the column *count*
 *   and nothing else — the tracks are `1fr`, so two of them still share the
 *   whole row at 155.5px each.
 * - The chips' inline padding drops from 12px to 8px at the same width. Without
 *   it the two columns are 2px too mean for their own copy: both engines put
 *   `Português (Brasil)` at 108px against a 106px box and `Bahasa Indonesia` at
 *   107px, so the grid gained a column by cropping the two longest names, and a
 *   picker that ellipsises the language you are looking for is worse than one
 *   extra row of scrolling. 8px returns 112px of name box against that 108px,
 *   and lands on the 4px grid where the alternatives (10px, a 6px gap) do not.
 *
 * Below ~384px there is no honest second column left, and `auto-fill` returns to
 * one — the right answer at 360px rather than a cropped name.
 *
 * **Why it is written here.** `GRID` and the chip live in
 * `src/components/settings/language-picker.tsx`, which belongs to another item;
 * this screen is the picker's host and owns how wide its own card is, so the
 * rule travels through the `className` that component publishes for it rather
 * than through an edit to a file this item does not own. `> div:last-child` is
 * the grid in both the loaded picker (a `SectionLabel` div, then the radiogroup)
 * and in `LanguagePickerSkeleton` (a label line box, then the same grid), which
 * is how one selector holds the two to the same shape — and it has to, because
 * the skeleton's whole contract is being the height of the thing it replaces.
 * The padding rule finds no `[role=radio]` in the skeleton, whose chips are
 * fixed-height bars with no padding to change, so that contract survives it.
 */
const PICKER_COLUMNS = [
  'max-sm:[&>div:last-child]:grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))]',
  'max-sm:[&_[role=radio]]:px-2',
].join(' ')

/** A skeleton bar centred in the line box the loaded text will occupy. */
function BarInLine({ box, width }: { box: string; width: string }) {
  return (
    <div className={cn('flex items-center', box)}>
      <Skeleton className={cn('h-2', width)} radius="sm" />
    </div>
  )
}

/**
 * The loading shape, which is the loaded screen with three values missing.
 *
 * It is built from the same `SettingsSection` and the same two headings, not
 * from a bare `Card`. Measured before it was: a `Card` takes its own default
 * `p-5` and draws no header band, so the pending screen stood 241.75px short of
 * the one it was holding space for at 1440px and 296.81px short at 393px, and
 * the 8px of inner width that `px-6` gives back at `sm` also turned the chip
 * grid from five columns into six — the loader settling therefore removed a
 * whole row of chips *and* moved everything below it, which is the layout shift
 * `docs/SPEC.md` §2 rules out and worse than shipping no skeleton at all.
 *
 * A section's title and its description are not data: they are catalogue copy
 * this component can read as well as the loaded one can. Rendering them for
 * real is what makes the two header bands the same height at every width and in
 * every language — a skeleton bar standing in for a heading that wraps to two
 * lines at 393px is the same defect one card smaller. What shimmers is exactly
 * what the loader knows and this component does not: the locale in force, which
 * chip is selected, which of the two hints applies, and the three sample
 * figures.
 */
function LanguagePending() {
  const t = useTranslate()
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('ui.status.loading')}</span>
      <SettingsSection
        title={t('settings.language.section.title')}
        description={t('settings.language.section.description')}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <div className={STATE_SHELL}>
            <Skeleton className="size-9 shrink-0" radius="full" />
            <div className="min-w-0 flex-1">
              <BarInLine box={MICRO_LINE} width="w-32" />
              <BarInLine box={LABEL_LINE} width="w-20" />
            </div>
          </div>
          <LanguagePickerSkeleton className={PICKER_COLUMNS} />
          <Hints state="pending" />
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('settings.language.sample.title')}
        description={t('settings.language.sample.description')}
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <Sample
            label={t('settings.language.sample.date')}
            value={<BarInLine box={LABEL_LINE} width="w-24" />}
          />
          <Sample
            label={t('settings.language.sample.number')}
            value={<BarInLine box={LABEL_LINE} width="w-20" />}
          />
          <Sample
            label={t('settings.language.sample.money')}
            value={<BarInLine box={LABEL_LINE} width="w-16" />}
          />
        </dl>
      </SettingsSection>
    </div>
  )
}
