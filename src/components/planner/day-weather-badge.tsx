import {
  Cloud,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Sun,
  Thermometer,
} from 'lucide-react'

import { cn } from '#/lib/cn'
import { Skeleton } from '#/components/ui'
import { formatNumber } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { CONDITION_LABEL, badgeModel } from './weather-model'

import type { LucideIcon } from 'lucide-react'
import type { WeatherUnit } from '#/lib/weather'
import type { DayWeatherView, WeatherCondition } from './weather-model'

const CONDITION_ICON: { readonly [K in WeatherCondition]: LucideIcon } = {
  clear: Sun,
  fair: CloudSun,
  partlyCloudy: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  heavyRain: CloudRainWind,
  sleet: CloudHail,
  snow: CloudSnow,
  thunder: CloudLightning,
}

/**
 * The box every state is drawn in.
 *
 * One class string for loading, a forecast, an unavailable day and a day with nothing to show, so
 * the row the badge sits in is the same width before the answer arrives and after it. A late
 * reading fills this box; it never makes the itinerary move.
 */
const BOX = 'flex h-7 w-20 shrink-0 items-center justify-end'

export interface DayWeatherBadgeProps {
  readonly weather: DayWeatherView
  /** The reader's unit; the reading itself is always metric. */
  readonly unit: WeatherUnit
}

/**
 * A day's weather at a glance: a condition icon and the high and low in the reader's own unit.
 *
 * It is a picture with a name, not a control - nothing here opens, so it is not a button and takes
 * no focus. The name starts with what the number is ("Forecast") because a traveller must never
 * pack for a figure believing it is something firmer than it is.
 *
 * An unavailable day is a muted dash with its own name, never a zero and never a blank that looks
 * like success; a day with nothing to show is the empty box and nothing else.
 */
export function DayWeatherBadge({ weather, unit }: DayWeatherBadgeProps) {
  const t = useTranslate()
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
      <span
        role="img"
        aria-label={name}
        className="inline-flex items-center gap-1 text-caption tabular-nums"
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
        <span className="font-semibold text-ink-2">{max}</span>
        <span className="text-ink-3">/{min}</span>
        <span className="text-ink-4">{model.unit}</span>
      </span>
    </div>
  )
}
