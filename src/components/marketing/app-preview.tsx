import {
  Bell,
  Lock,
  MapPin,
  Moon,
  Plus,
  Ticket,
  TrainFront,
} from 'lucide-react'

import { Wordmark } from '#/components/layout/brand'
import {
  Avatar,
  Badge,
  Card,
  GlassPanel,
  SectionLabel,
  Sparkline,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatDateRange, formatWeekday } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { MiniMap } from './visuals'

import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import type { ReactNode } from 'react'

/* ------------------------------------------------------------ browser shell */

/** What the miniature depicts: eighteen places across four days. */
const PLACES = 18
const DAYS = 4

function BrowserChrome() {
  return (
    <div className="flex items-center gap-3 border-b border-edge-faint bg-surface-2 px-3 py-2.5">
      <span className="flex shrink-0 gap-1.5">
        <span className="size-2 rounded-full bg-edge-strong/45" />
        <span className="size-2 rounded-full bg-edge-strong/45" />
        <span className="size-2 rounded-full bg-edge-strong/45" />
      </span>
      <span className="mx-auto flex h-5.5 min-w-0 max-w-64 items-center gap-1.5 rounded-full bg-surface px-2.5 ring-1 ring-edge-faint ring-inset">
        <Lock className="size-2.5 shrink-0 text-success" />
        <span className="truncate text-micro font-medium tracking-normal text-ink-4">
          planned.travel/dashboard
        </span>
      </span>
      <span className="flex shrink-0 gap-1">
        <span className="h-2 w-4 rounded-sm bg-edge-strong/30" />
        <span className="h-2 w-2 rounded-sm bg-edge-strong/30" />
      </span>
    </div>
  )
}

/* --------------------------------------------------------------- app chrome */

/** The app's own navigation, so the picture and the product agree. */
const MINI_TABS: readonly [MessageKey, MessageKey, MessageKey, MessageKey] = [
  'shell.nav.trips',
  'shell.nav.vacay',
  'shell.nav.atlas',
  'shell.nav.journey',
]

function MiniTopNav() {
  const t = useTranslate()
  return (
    <div className="flex items-center gap-2 border-b border-edge-faint px-3 py-2.5 sm:px-4">
      <Wordmark size="sm" />

      <div className="mx-auto hidden items-center gap-0.5 rounded-full bg-track p-0.5 md:flex">
        {MINI_TABS.map((tab, index) => (
          <span
            key={tab}
            className={cn(
              'rounded-full px-2.5 py-1 text-micro font-semibold tracking-normal',
              index === 0
                ? 'bg-track-thumb text-ink shadow-card'
                : 'text-ink-3',
            )}
          >
            {t(tab)}
          </span>
        ))}
      </div>

      <div className="ms-auto flex items-center gap-1.5 md:ms-0">
        <span className="hidden items-center gap-1 rounded-full bg-accent px-2 py-1 text-micro font-semibold tracking-normal text-accent-on lg:inline-flex">
          <Plus className="size-2.5" strokeWidth={3} />
          {t('shell.nav.newTrip')}
        </span>
        <span className="grid size-5.5 place-items-center rounded-full text-ink-4 [&_svg]:size-3">
          <Moon />
        </span>
        <span className="relative grid size-5.5 place-items-center rounded-full text-ink-4 [&_svg]:size-3">
          <Bell />
          <span className="absolute top-0.5 end-0.5 size-1.5 rounded-full bg-brand" />
        </span>
        <Avatar name="Amelia Voss" size="sm" />
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- up next */

/** The illustrated trip, as the dashboard's own hero tiles would state it. */
const TRAVELLERS = 3
const STARTS_IN_DAYS = 26
const TRIP_FROM = '2026-04-12'
const TRIP_TO = '2026-04-24'

function heroFacts(
  t: Translate,
  locale: Locale,
): ReadonlyArray<{
  label: string
  value: string
  unit?: string
}> {
  return [
    {
      label: t('shell.dashboard.hero.travellers'),
      value: String(TRAVELLERS),
    },
    {
      label: t('shell.dashboard.hero.dates'),
      // The whole range in one slot: where the month sits relative to the days
      // is the locale's business, and the frozen table is what settles it.
      value: formatDateRange(TRIP_FROM, TRIP_TO, locale) ?? '',
    },
    {
      label: t('shell.dashboard.hero.startsIn'),
      value: String(STARTS_IN_DAYS),
      unit: t('shell.dashboard.hero.startFuture', { count: STARTS_IN_DAYS }),
    },
    { label: t('shell.dashboard.hero.places'), value: String(PLACES) },
  ]
}

function MiniTripHero() {
  const t = useTranslate()
  const locale = useLocale()
  return (
    <Card
      variant="inverse"
      padding="none"
      className="relative isolate overflow-hidden"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -end-16 size-56 rounded-full bg-brand/25 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge tone="inverse" size="sm" dot>
            {t('shell.dashboard.upNext')}
          </Badge>
          <span className="text-micro font-semibold uppercase tracking-label text-inverse-muted">
            Kyoto &amp; Osaka
          </span>
        </div>

        <p className="font-display text-title font-extrabold tracking-tighter text-inverse-on sm:text-display">
          Cherry blossom run
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-inverse-surface p-3 ring-1 ring-inverse-edge ring-inset sm:grid-cols-4">
          {heroFacts(t, locale).map((fact) => (
            <div key={fact.label} className="min-w-0">
              <p className="truncate text-micro font-semibold uppercase tracking-label text-inverse-muted">
                {fact.label}
              </p>
              <p className="mt-1 flex items-baseline gap-1">
                <span
                  className="font-display text-subtitle font-bold tracking-tight tabular-nums text-inverse-on"
                  data-numeric=""
                >
                  {fact.value}
                </span>
                {fact.unit === undefined ? null : (
                  <span className="text-micro font-medium tracking-normal text-inverse-muted">
                    {fact.unit}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ---------------------------------------------------------------- stat row */

type MiniStat = {
  label: string
  value: string
  unit?: string
  caption: string
  series?: Array<number>
  tone?: 'default' | 'inverse'
}

/** The figures the three tiles show, and the sentences built from them. */
const COUNTRIES_VISITED = 11
const COUNTRIES_TOTAL = 195
const MAP_PERCENT = 6
const TRIPS_TOTAL = 9
const PLACES_MAPPED = 142
const DAYS_TRAVELLED = 87

function miniStats(t: Translate): ReadonlyArray<MiniStat> {
  return [
    {
      label: t('shell.dashboard.stat.countries'),
      value: String(COUNTRIES_VISITED),
      unit: t('shell.dashboard.stat.countriesUnit', {
        total: COUNTRIES_TOTAL,
      }),
      caption: t('marketing.visual.mapFilled', { percent: MAP_PERCENT }),
      tone: 'inverse',
    },
    {
      label: t('shell.dashboard.stat.trips'),
      value: String(TRIPS_TOTAL),
      caption: t('marketing.visual.placesMapped', {
        count: PLACES_MAPPED,
        value: PLACES_MAPPED,
      }),
      series: [3, 4, 4, 6, 5, 7, 8, 9],
    },
    {
      label: t('marketing.visual.daysTravelled'),
      value: String(DAYS_TRAVELLED),
      unit: t('shell.dashboard.hero.startFuture', { count: DAYS_TRAVELLED }),
      caption: t('marketing.visual.acrossEveryTrip'),
      series: [8, 14, 18, 26, 34, 52, 68, 87],
    },
  ]
}

function MiniStatTile({ stat }: { stat: MiniStat }) {
  const inverse = stat.tone === 'inverse'

  return (
    <Card
      variant={inverse ? 'inverse' : 'default'}
      padding="none"
      className="flex min-w-0 flex-col justify-between gap-3 p-3 sm:p-4"
    >
      <SectionLabel className={inverse ? 'text-inverse-muted' : undefined}>
        {stat.label}
      </SectionLabel>
      <div className="relative">
        <p className="flex items-baseline gap-1.5 pe-14">
          <span
            className={cn(
              'font-display text-title font-extrabold tracking-tighter tabular-nums sm:text-display',
              inverse ? 'text-inverse-on' : 'text-ink',
            )}
            data-numeric=""
          >
            {stat.value}
          </span>
          {stat.unit === undefined ? null : (
            <span
              className={cn(
                'text-caption font-medium tabular-nums',
                inverse ? 'text-inverse-muted' : 'text-ink-3',
              )}
            >
              {stat.unit}
            </span>
          )}
        </p>
        {stat.series === undefined ? null : (
          <Sparkline
            data={stat.series}
            width={56}
            height={22}
            area
            showEndDot
            className="absolute end-0 bottom-1 text-ink-4"
          />
        )}
      </div>
      <p
        className={cn(
          'truncate text-micro tracking-normal',
          inverse ? 'text-inverse-muted' : 'text-ink-4',
        )}
      >
        {stat.caption}
      </p>
    </Card>
  )
}

/* ---------------------------------------------------------------- side rail */

function MiniMapCard() {
  const t = useTranslate()
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="relative h-28">
        <MiniMap className="absolute inset-0" />
        <GlassPanel
          radius="full"
          padding="none"
          floating={false}
          className="absolute bottom-2 start-2 flex items-center gap-1.5 px-2 py-1"
        >
          <MapPin aria-hidden className="size-2.5 text-brand" />
          <span className="text-micro font-semibold tabular-nums tracking-normal text-ink">
            {t('marketing.visual.places', { count: PLACES, value: PLACES })} ·{' '}
            {t('marketing.visual.days', { count: DAYS, value: DAYS })}
          </span>
        </GlassPanel>
      </div>
    </Card>
  )
}

const MINI_BOOKINGS: ReadonlyArray<{
  icon: typeof TrainFront
  title: string
  /** ISO plus the time the traveller typed, for the reason `visuals.tsx` gives. */
  date: string
  time: string
}> = [
  {
    icon: TrainFront,
    title: 'Bullet train to Tokyo',
    date: '2026-04-15',
    time: '08:12',
  },
  {
    icon: Ticket,
    title: 'Tea ceremony, two places',
    date: '2026-04-16',
    time: '14:00',
  },
]

function MiniBookings() {
  const t = useTranslate()
  const locale = useLocale()
  return (
    <Card padding="none" className="p-3 sm:p-4">
      <SectionLabel
        action={
          <span className="text-micro text-brand">
            {t('shell.trips.filter.all')}
          </span>
        }
      >
        {t('marketing.visual.upcoming')}
      </SectionLabel>
      <ul className="mt-3 flex flex-col gap-2.5">
        {MINI_BOOKINGS.map((booking) => (
          <li key={booking.title} className="flex items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-ink-2 [&_svg]:size-3.5">
              <booking.icon />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-caption font-semibold text-ink">
                {booking.title}
              </span>
              <span className="block truncate text-micro tabular-nums tracking-normal text-ink-4">
                {formatWeekday(booking.date, locale)} · {booking.time}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ----------------------------------------------------------------- preview */

export type AppPreviewProps = {
  className?: string
  /** Anything floated over the frame — a caption chip, a badge. */
  children?: ReactNode
}

/**
 * The product visual on the landing page.
 *
 * Deliberately **not** a screenshot: it is a miniature of the real dashboard,
 * composed from the same primitives and the same tokens as the product itself.
 * That means it is sharp at any pixel density, it inverts correctly in dark
 * mode, it costs no image request, it shifts no layout while it loads, and it
 * cannot drift out of date the way a captured PNG does.
 *
 * It carries no interactive elements, so the whole frame is hidden from the
 * accessibility tree behind one honest description.
 */
export function AppPreview({ className, children }: AppPreviewProps) {
  const t = useTranslate()
  return (
    <figure className={cn('relative', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'overflow-hidden rounded-lg border border-edge-faint bg-surface',
          'shadow-elevated sm:rounded-2xl sm:shadow-modal',
        )}
      >
        <BrowserChrome />
        <div className="bg-canvas">
          <MiniTopNav />
          <div className="grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
              <MiniTripHero />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {miniStats(t).map((stat, index) => (
                  <div
                    key={stat.label}
                    className={cn('min-w-0', index === 2 && 'hidden sm:block')}
                  >
                    <MiniStatTile stat={stat} />
                  </div>
                ))}
              </div>
            </div>
            <aside className="hidden min-w-0 flex-col gap-4 lg:flex">
              <MiniMapCard />
              <MiniBookings />
            </aside>
          </div>
        </div>
      </div>
      {children}
      <figcaption className="sr-only">
        {t('marketing.visual.previewSummary')}
      </figcaption>
    </figure>
  )
}
