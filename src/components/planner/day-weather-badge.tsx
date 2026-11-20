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

// Reserve the same slot through loading, empty and settled states. Size it with
// the caption font, but limit its share of the row so the day header keeps room.
const BOX =
  'flex min-h-[max(1.75rem,calc(2lh+0.375rem))] w-[max(6.5rem,14ch)] max-w-[45%] shrink-0 items-center justify-end text-caption leading-tight tabular-nums'

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
  /**
   * The day's header button. When the day stops being a forecast with the popover (or its trigger)
   * holding focus, focus lands here instead of falling to the page.
   */
  readonly headerRef?: React.RefObject<HTMLElement | null>
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
  headerRef,
}: DayWeatherBadgeProps) {
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
          <Skeleton radius="sm" className="h-4 w-16 max-w-full" />
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
        {/* A key of its own: without it React turns the skeleton's span into this one, and the
            browser reports the span's new left edge as a layout shift when the answer arrives. */}
        <span
          key="not-yet-recorded"
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
  return (
    <div data-part="day-weather" className={BOX}>
      <ForecastPopover
        model={model}
        face={face}
        unit={unit}
        dateLabel={dateLabel}
        headerRef={headerRef}
      />
    </div>
  )
}

/**
 * The forecast button and the popover it opens.
 *
 * Its own component because it is what unmounts when the day stops being a forecast (loading,
 * unavailable, nothing, or no weather passed at all): the trigger and the open dialog go with it,
 * and focus inside either would fall to the page. The cleanup runs before the DOM is removed, so
 * it can still see where focus is, and hands it to the day's header button when it was here.
 */
function ForecastPopover({
  model,
  face,
  unit,
  dateLabel,
  headerRef,
}: {
  readonly model: ReadingModel
  readonly face: NonNullable<ReturnType<typeof readingFace>>
  readonly unit: WeatherUnit
  readonly dateLabel: string
  readonly headerRef: DayWeatherBadgeProps['headerRef']
}) {
  const t = useTranslate()
  const titleId = React.useId()
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const { name, Icon, muted, lead, trail, temperatureLabel } = face
  const recorded = model.kind === 'recorded'
  const approximate = model.kind === 'estimate'

  React.useLayoutEffect(
    () => () => {
      const focused = document.activeElement
      const hadFocus =
        focused !== null &&
        (triggerRef.current?.contains(focused) === true ||
          contentRef.current?.contains(focused) === true)
      if (hadFocus && headerRef?.current?.isConnected === true) {
        headerRef.current.focus()
      }
    },
    [headerRef],
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={name}
          className={cn(
            'inline-flex min-h-7 max-w-full items-center gap-1 rounded-md px-1 py-0.5 wrap-anywhere',
            transitionBase,
            focusRing,
            'hover:bg-hover active:bg-active data-[state=open]:bg-hover',
            // An estimate is outlined, so it is not mistaken for a forecast at a glance.
            approximate && 'border border-dashed border-info',
            recorded && 'flex-col justify-center gap-0',
          )}
        >
          {recorded ? (
            <span className="min-w-0 text-ink-3">
              {t('trips.plan.weather.badge.recordedLabel')}
            </span>
          ) : (
            <Icon
              size={15}
              strokeWidth={2}
              aria-hidden="true"
              className={cn('shrink-0', muted ? 'text-ink-4' : 'text-info')}
            />
          )}
          <span
            className={cn(
              'inline-flex min-w-0',
              temperatureLabel !== null && !recorded
                ? 'flex-col items-start'
                : 'items-baseline gap-1',
            )}
          >
            {temperatureLabel === null ? null : (
              <span className="text-ink-3">{t(temperatureLabel)}</span>
            )}
            {/* One run, fixed left to right: the figures read "24°/18°C" in every direction. */}
            <span dir="ltr">
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
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent ref={contentRef} align="end" aria-labelledby={titleId}>
        <PopoverHeader>
          <h2 id={titleId} className="text-label font-semibold">
            {t('trips.plan.weather.panel.title', { date: dateLabel })}
          </h2>
        </PopoverHeader>
        <DayWeatherPanel reading={model.reading} sun={model.sun} unit={unit} />
      </PopoverContent>
    </Popover>
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
 * A forecast uses its condition icon and a high/low pair. Recorded readings carry a visible
 * "Recorded" label. Estimates use a thermometer with an approximation sign and dashed outline.
 * A lone temperature carries a high or low label. Each accessible name starts with the reading kind.
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
  readonly temperatureLabel: MessageKey | null
} | null {
  const figure = (value: number) => `${formatNumber(value, locale)}°`
  if (model.kind === 'forecast') {
    const max = figure(model.max)
    const min = figure(model.min)
    // `figures` is the visible run (WCAG 2.5.3 Label in Name): built here once, from the same
    // strings the spans below render, so the name contains the visible text as one string.
    const figures = {
      figures: `${max}/${min}${model.unit}`,
      max: `${max}${model.unit}`,
      min: `${min}${model.unit}`,
    }
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
      temperatureLabel: null,
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
      temperatureLabel: null,
    }
  }
  if (max !== null) {
    return {
      name: t(names.high, { max: withUnit(max) }),
      Icon: Thermometer,
      muted: true,
      lead: figure(max),
      trail: null,
      temperatureLabel: 'trips.plan.weather.panel.high',
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
    temperatureLabel: 'trips.plan.weather.panel.low',
  }
}
