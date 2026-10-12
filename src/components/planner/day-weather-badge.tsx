import * as React from 'react'
import { Thermometer } from 'lucide-react'

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

import type { WeatherUnit } from '#/lib/weather'
import type { DayWeatherView } from './weather-model'

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

  const max = `${formatNumber(model.max, locale)}°`
  const min = `${formatNumber(model.min, locale)}°`
  const name =
    model.condition === null
      ? t('trips.plan.weather.badge.forecastNoCondition', {
          max: `${max}${model.unit}`,
          min: `${min}${model.unit}`,
        })
      : t('trips.plan.weather.badge.forecast', {
          condition: t(CONDITION_LABEL[model.condition]),
          max: `${max}${model.unit}`,
          min: `${min}${model.unit}`,
        })
  const Icon =
    model.condition === null ? Thermometer : CONDITION_ICON[model.condition]

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
            )}
          >
            <Icon
              size={15}
              strokeWidth={2}
              aria-hidden="true"
              className={cn(
                'shrink-0',
                model.condition === null ? 'text-ink-4' : 'text-info',
              )}
            />
            {/* One run, fixed left to right: the figures read "24°/18°C" in every direction. */}
            <span dir="ltr" className="whitespace-nowrap">
              <span className="font-semibold text-ink-2">{max}</span>
              <span className="text-ink-3">/{min}</span>
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
