import * as React from 'react'
import { Clock, Thermometer } from 'lucide-react'

import { cn } from '#/lib/cn'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Skeleton,
  focusRing,
  transitionBase,
} from '#/components/ui'
import { formatNumber } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { DayWeatherPanel } from './day-weather-panel'
import { CONDITION_ICON } from './weather-icons'
import { CONDITION_LABEL, badgeModel } from './weather-model'

import type { LucideIcon } from 'lucide-react'
import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import type { WeatherUnit } from '#/lib/weather'
import type { DayWeatherView, WeatherBadgeModel } from './weather-model'

/**
 * The box every state is drawn in.
 *
 * One class string for loading, a forecast, an unavailable day and a day with nothing to show, so
 * the row the badge sits in is the same width before the answer arrives and after it. A late
 * reading fills this box; it never makes the itinerary move. The width is a floor, not a fixed
 * size: the usual reading fits inside it, and the rare wide one (two signed digits each, or a
 * three-digit Fahrenheit high) widens the box instead of painting over the day's header button.
 */
const BOX = 'flex h-7 min-w-20 shrink-0 items-center justify-end'

/**
 * What a reading that is only temperatures is called, by what it is and by which of its two
 * figures it has. The word it starts with is what a reader hears first, so it is never shared.
 */
const TEMPERATURE_NAME: {
  readonly [K in 'recorded' | 'estimate']: {
    readonly both: MessageKey
    readonly high: MessageKey
    readonly low: MessageKey
  }
} = {
  recorded: {
    both: 'trips.plan.weather.badge.recorded',
    high: 'trips.plan.weather.badge.recordedHigh',
    low: 'trips.plan.weather.badge.recordedLow',
  },
  estimate: {
    both: 'trips.plan.weather.badge.estimate',
    high: 'trips.plan.weather.badge.estimateHigh',
    low: 'trips.plan.weather.badge.estimateLow',
  },
}

export interface DayWeatherBadgeProps {
  readonly weather: DayWeatherView
  /** The reader's unit; the reading itself is always metric. */
  readonly unit: WeatherUnit
  /** The day's date as the header writes it, for the fuller reading's title. */
  readonly dateLabel: string
}

/**
 * A day's weather at a glance: a condition icon and the high and low in the reader's own unit.
 *
 * A forecast is a button that opens the fuller reading in a popover, and it sits beside the day's
 * header button, never inside it - a button inside a button is invalid, and opening the weather is
 * not a way to focus the day. The name starts with what the number is ("Forecast") because a
 * traveller must never pack for a figure believing it is something firmer than it is.
 *
 * An unavailable day is a muted dash with its own name, never a zero and never a blank that looks
 * like success; there is nothing behind it to open, so it is a picture and not a control. A day
 * with nothing to show is the empty box and nothing else.
 */
export function DayWeatherBadge({
  weather,
  unit,
  dateLabel,
}: DayWeatherBadgeProps) {
  const t = useTranslate()
  const titleId = React.useId()
  const locale = useLocale()
  const model = badgeModel(weather, unit)

  if (model === null) {
    return <div data-part="day-weather" aria-hidden="true" className={BOX} />
  }

  if (model.kind === 'loading') {
    return (
      <div data-part="day-weather" className={BOX}>
        <span role="img" aria-label={t('trips.plan.weather.badge.loading')}>
          <Skeleton radius="sm" className="h-4 w-16" />
        </span>
      </div>
    )
  }

  if (model.kind === 'unavailable') {
    return <UnavailableBadge />
  }

  if (model.kind === 'notYetRecorded') {
    return (
      <div data-part="day-weather" className={BOX}>
        <span
          role="img"
          aria-label={t('trips.plan.weather.badge.notYetRecorded')}
          title={t('trips.plan.weather.badge.notYetRecorded')}
          className="text-ink-4"
        >
          <Clock size={15} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
    )
  }

  const face = readingFace(model, t, locale)
  if (face === null) {
    return <UnavailableBadge />
  }
  const { name, Icon, muted, lead, trail } = face
  const approximate = model.kind === 'estimate'

  return (
    <div data-part="day-weather" className={BOX}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={name}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-md px-1 text-caption tabular-nums',
              transitionBase,
              focusRing,
              'hover:bg-hover active:bg-active data-[state=open]:bg-hover',
              // An estimate is outlined, so it is not mistaken for a forecast at a glance.
              approximate && 'border border-dashed border-info',
            )}
          >
            <Icon
              size={15}
              strokeWidth={2}
              aria-hidden="true"
              className={cn('shrink-0', muted ? 'text-ink-4' : 'text-info')}
            />
            {/* One run, fixed left to right: the figures read "24°/18°C" in every direction. */}
            <span dir="ltr" className="whitespace-nowrap">
              {approximate ? (
                <span aria-hidden="true" className="text-info">
                  ≈
                </span>
              ) : null}
              <span className="font-semibold text-ink-2">{lead}</span>
              {trail === null ? null : (
                <span className="text-ink-3">/{trail}</span>
              )}
              <span className="text-ink-4">{model.unit}</span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" aria-labelledby={titleId}>
          <PopoverHeader>
            <h2 id={titleId} className="text-label font-semibold">
              {t('trips.plan.weather.panel.title', { date: dateLabel })}
            </h2>
          </PopoverHeader>
          <DayWeatherPanel
            reading={model.reading}
            sun={model.sun}
            unit={unit}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** A day that should have a reading and has none: a dash with a name, never a figure. */
function UnavailableBadge() {
  const t = useTranslate()
  return (
    <div data-part="day-weather" className={BOX}>
      <span
        role="img"
        aria-label={t('trips.plan.weather.badge.unavailable')}
        className="text-caption text-ink-4"
      >
        —
      </span>
    </div>
  )
}

type ReadingModel = Extract<
  WeatherBadgeModel,
  { readonly kind: 'forecast' | 'recorded' | 'estimate' }
>

/**
 * How a reading is drawn and named. A forecast is the condition icon and "high/low"; a recorded day
 * is the thermometer, and its name begins "Recorded" so nobody takes a measurement for a forecast
 * or the reverse. An estimate is the same picture under a name that begins "Estimate"; the sign
 * and the outline that set it apart are the badge's. A day of either that lacks one temperature
 * draws the one it has, and its name says which it is, and one with neither has no face.
 */
function readingFace(
  model: ReadingModel,
  t: Translate,
  locale: Locale,
): {
  readonly name: string
  readonly Icon: LucideIcon
  readonly muted: boolean
  readonly lead: string
  readonly trail: string | null
} | null {
  const figure = (value: number) => `${formatNumber(value, locale)}°`
  if (model.kind === 'forecast') {
    const max = figure(model.max)
    const min = figure(model.min)
    const figures = { max: `${max}${model.unit}`, min: `${min}${model.unit}` }
    return {
      name:
        model.condition === null
          ? t('trips.plan.weather.badge.forecastNoCondition', figures)
          : t('trips.plan.weather.badge.forecast', {
              condition: t(CONDITION_LABEL[model.condition]),
              ...figures,
            }),
      Icon:
        model.condition === null
          ? Thermometer
          : CONDITION_ICON[model.condition],
      muted: model.condition === null,
      lead: max,
      trail: min,
    }
  }
  const { max, min } = model
  const names = TEMPERATURE_NAME[model.kind]
  const withUnit = (value: number) => `${figure(value)}${model.unit}`
  if (max !== null && min !== null) {
    return {
      name: t(names.both, {
        max: withUnit(max),
        min: withUnit(min),
      }),
      Icon: Thermometer,
      muted: true,
      lead: figure(max),
      trail: figure(min),
    }
  }
  if (max !== null) {
    return {
      name: t(names.high, { max: withUnit(max) }),
      Icon: Thermometer,
      muted: true,
      lead: figure(max),
      trail: null,
    }
  }
  // Such a reading always has one of the two, but the type cannot say so, and a missing
  // figure is not drawn as a zero.
  if (min === null) {
    return null
  }
  return {
    name: t(names.low, { min: withUnit(min) }),
    Icon: Thermometer,
    muted: true,
    lead: figure(min),
    trail: null,
  }
}
