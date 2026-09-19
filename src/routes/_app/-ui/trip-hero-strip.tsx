/**
 * The prominent card's lower half (`01-S7`): the progress bar while the trip is under way, and the
 * strip of four figures — the countdown, nights, places and the people going.
 *
 * Every figure is the trip's own. The strip takes the trip, the server's `today` and the server's
 * elapsed fraction and nothing else, so a workspace-wide number cannot find its way back into it,
 * and nothing here reads a clock.
 */
import { Progress } from '#/components/ui'
import { useI18n } from '#/lib/i18n'
import {
  daysBetween,
  daysUntil,
  formatDateRange,
  formatNumber,
  formatPercent,
} from '../-lib/format'

import type { Locale, Translate } from '#/lib/i18n'
import type { TripCard } from '../-server/overview'

export function TripHeroStrip({
  trip,
  today,
  elapsed,
}: {
  trip: TripCard
  /** The server's date, as the dashboard payload carries it. */
  today: string
  /** How far through its dates the trip is, from the server; `null` without both dates. */
  elapsed: number | null
}) {
  const { t, locale } = useI18n()
  const startsIn = daysUntil(trip.startDate, today)
  const length = daysBetween(trip.startDate, trip.endDate)
  const nights = length === null ? null : Math.max(length - 1, 0)
  const range = formatDateRange(trip.startDate, trip.endDate, locale)
  /*
   * Only while the trip is under way: a percentage on a trip that has not started is noise, and
   * on one that has ended it is a full bar saying nothing. The fraction itself is the server's,
   * computed from its own date, so this reads no clock either.
   */
  const endsIn = daysUntil(trip.endDate, today)
  const underWay =
    elapsed !== null && elapsed > 0 && endsIn !== null && endsIn >= 0

  return (
    <>
      {underWay ? (
        <Progress
          data-part="hero-progress"
          aria-label={t('shell.dashboard.hero.progress')}
          value={Math.round(elapsed * 100)}
          size="sm"
          tone="brand"
          label={
            <span className="text-inverse-muted">
              {t('shell.dashboard.hero.progress')}
            </span>
          }
          // The primitive's own value text is drawn in the light-surface ink,
          // which disappears on the inverse card; the same figure in the
          // card's muted ink instead.
          valueText={
            <span className="text-inverse-muted">
              {formatPercent(elapsed, locale)}
            </span>
          }
          className="bg-inverse-edge"
        />
      ) : null}

      {/* The three figures the trip is made of — nights, places, the people going — beside the
        countdown the card already carried. The trip's own people, not the workspace's: the
        strip is about this trip and nothing else. */}
      <dl
        data-part="hero-strip"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-inverse-edge sm:grid-cols-4"
      >
        <HeroStat
          label={
            startsIn !== null && startsIn < 0
              ? t('shell.dashboard.hero.started')
              : t('shell.dashboard.hero.startsIn')
          }
          value={startsInValue(startsIn, locale, t)}
          hint={startsInHint(startsIn, t)}
        />
        <HeroStat
          label={t('shell.dashboard.hero.nights')}
          value={nights === null ? '—' : formatNumber(nights, locale)}
          hint={range ?? t('shell.dashboard.hero.datesMissing')}
        />
        <HeroStat
          label={t('shell.dashboard.hero.places')}
          value={formatNumber(trip.placeCount, locale)}
          hint={
            trip.placeCount === 0
              ? t('shell.dashboard.hero.placesNone')
              : t('shell.dashboard.hero.placesHint')
          }
        />
        <HeroStat
          label={t('shell.dashboard.hero.travellers')}
          value={formatNumber(trip.peopleCount, locale)}
          hint={t('shell.dashboard.hero.companionsHint')}
        />
      </dl>
    </>
  )
}

/** An em dash for "no date", `Today` for the day itself, otherwise the figure. */
function startsInValue(
  startsIn: number | null,
  locale: Locale,
  t: Translate,
): string {
  if (startsIn === null) return '—'
  if (startsIn === 0) return t('shell.dashboard.hero.today')
  return formatNumber(Math.abs(startsIn), locale)
}

/**
 * The unit under the countdown, agreeing with the figure above it.
 *
 * `count` selects the CLDR branch and is never printed — the reader is looking
 * at the numeral in the same tile. The two keys used to be the bare words
 * `days ago` and `days`, which read as `Starts in / 1 / days` in English and
 * gave a translator of Polish or Arabic no branch to inflect.
 */
function startsInHint(startsIn: number | null, t: Translate): string {
  if (startsIn === null) return t('shell.dashboard.hero.startUnknown')
  if (startsIn === 0) return t('shell.dashboard.hero.startToday')
  const count = Math.abs(startsIn)
  return startsIn < 0
    ? t('shell.dashboard.hero.startPast', { count })
    : t('shell.dashboard.hero.startFuture', { count })
}

function HeroStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="min-w-0 bg-inverse-surface px-4 py-4 text-center">
      <dt className="mb-2 truncate text-micro font-semibold tracking-label uppercase text-inverse-muted">
        {label}
      </dt>
      {/* No `data-numeric`. Every tile holds a grouped numeral, which is already
          an isolated run, and the countdown can hold the word `Today`, which is
          prose. `tabular-nums` is the part every tile actually wants, and it is a
          class rather than an attribute that also carries bidi meaning. */}
      <dd className="font-display text-display leading-none font-bold tracking-tighter tabular-nums text-inverse-on">
        {value}
      </dd>
      <p className="mt-1.5 truncate text-caption text-inverse-muted">{hint}</p>
    </div>
  )
}
