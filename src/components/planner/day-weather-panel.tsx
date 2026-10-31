import { Thermometer } from 'lucide-react'

import { cn } from '#/lib/cn'
import { formatNumber, formatPercent } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { slotIcon } from './weather-icons'
import { CONDITION_LABEL, SLOT_LABEL, panelModel } from './weather-model'

import type { ReactNode } from 'react'
import type { Locale, MessageKey } from '#/lib/i18n'
import type { SunTimes } from '#/lib/sun'
import type { DayReading, WeatherUnit } from '#/lib/weather'

export interface DayWeatherPanelProps {
  readonly reading: DayReading
  /** Sunrise and sunset for the day; `null` or absent leaves the two rows out. */
  readonly sun?: SunTimes | null
  /** The reader's unit; the reading itself is always metric. */
  readonly unit: WeatherUnit
  readonly className?: string
}

/**
 * The fuller reading of a day: the high and low, what falls and how likely it is, the
 * wind, the day's sunrise and sunset, and a strip of the day's six-hour slots, with the provider's
 * credit underneath.
 *
 * It is a unit with no popover in it - the badge puts it in one today, and the day detail screen
 * will mount it in its weather region without the badge's popover around it. Whatever the provider
 * did not state is a row left out, never a zero; a reading with no slots has no strip at all, never
 * empty columns and never a value worked out from the high and low. A recorded day is a
 * measurement: it has no slots and no chance of rain, and it says so in a line of its own, above
 * the figures, and credits NASA POWER instead of MET Norway. An estimate is a long-term average: it
 * has neither of those and no wind either, and its line, also above the figures, says it is not a
 * forecast.
 *
 * Figures are fixed left to right inside their own run, so "12° / 4°C" reads the same in every
 * direction of text.
 */
export function DayWeatherPanel({
  reading,
  sun = null,
  unit,
  className,
}: DayWeatherPanelProps) {
  const t = useTranslate()
  const locale = useLocale()
  const model = panelModel(reading, unit)

  const precipitation = [
    model.precipitation === null
      ? null
      : `${formatNumber(model.precipitation.value, locale)} ${model.precipitation.unit}`,
    model.probability === null
      ? null
      : t('trips.plan.weather.panel.probability', {
          percent: formatPercent(model.probability / 100, locale),
        }),
  ].filter((part): part is string => part !== null)

  const temperature = temperatureText(model.max, model.min, model.unit, locale)

  return (
    <div
      data-part="day-weather-panel"
      className={cn('flex flex-col gap-3', className)}
    >
      {model.kind === 'forecast' ? null : (
        <p className="text-caption text-ink-3">{t(NOTE[model.kind])}</p>
      )}
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-caption">
        {temperature === null ? null : (
          <Row label={t(temperatureLabel(model.kind, model.max, model.min))}>
            {temperature}
          </Row>
        )}
        {precipitation.length === 0 ? null : (
          <Row label={t(PRECIPITATION[model.kind])}>
            {precipitation.join(' · ')}
          </Row>
        )}
        {model.wind === null ? null : (
          <Row label={t('trips.plan.weather.panel.wind')}>
            {`${formatNumber(model.wind.value, locale)} ${model.wind.unit}`}
          </Row>
        )}
        {sun === null ? null : (
          <>
            <SunRow
              label={t('trips.plan.weather.panel.sunrise')}
              missing={t('trips.plan.weather.panel.noSunrise')}
              time={sun.sunrise}
            />
            <SunRow
              label={t('trips.plan.weather.panel.sunset')}
              missing={t('trips.plan.weather.panel.noSunset')}
              time={sun.sunset}
            />
          </>
        )}
      </dl>

      {model.slots === null ? null : (
        <ul
          role="list"
          aria-label={t('trips.plan.weather.panel.slots')}
          // Three shared rows (label, icon, temperature): a label that wraps pushes only its own
          // row down, so the icons and temperatures stay level across the strip.
          className="grid auto-cols-fr grid-flow-col grid-rows-[auto_auto_auto] gap-1 border-t border-edge pt-3"
        >
          {model.slots.map((slot) => {
            const Icon =
              slot.condition === null
                ? null
                : slotIcon(slot.name, slot.condition)
            return (
              <li
                key={slot.name}
                className="row-span-3 grid grid-rows-subgrid justify-items-center text-caption tabular-nums"
              >
                <span className="max-w-full text-center hyphens-auto wrap-anywhere text-ink-3">
                  {t(SLOT_LABEL[slot.name])}
                </span>
                {Icon === null || slot.condition === null ? (
                  // The badge's "no sky" mark, so the temperatures stay aligned.
                  <Thermometer
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="text-ink-4"
                  />
                ) : (
                  <>
                    <Icon
                      size={16}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="text-info"
                    />
                    <span className="sr-only">
                      {t(CONDITION_LABEL[slot.condition])}
                    </span>
                  </>
                )}
                <span dir="ltr" className="font-semibold text-ink-2">
                  {`${formatNumber(slot.temp, locale)}°`}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-caption text-ink-4">{t(ATTRIBUTION[model.kind])}</p>
    </div>
  )
}

/** The one line over a reading that is not a forecast, saying what the figures are before they are read. */
const NOTE = {
  recorded: 'trips.plan.weather.panel.recordedNote',
  estimate: 'trips.plan.weather.panel.estimateNote',
} as const satisfies { readonly [K in 'recorded' | 'estimate']: MessageKey }

const ATTRIBUTION = {
  forecast: 'trips.plan.weather.attribution.metNorway',
  recorded: 'trips.plan.weather.attribution.nasaPower',
  estimate: 'trips.plan.weather.attribution.nasaPower',
} as const satisfies { readonly [K in DayReading['kind']]: MessageKey }

/**
 * An estimate's rainfall is the mean per day over the month, not a day's total, so its row says so:
 * "Precipitation 2.5 mm" under an average would read as a monthly total and a dry month.
 */
const PRECIPITATION = {
  forecast: 'trips.plan.weather.panel.precipitation',
  recorded: 'trips.plan.weather.panel.precipitation',
  estimate: 'trips.plan.weather.panel.precipitationTypical',
} as const satisfies { readonly [K in DayReading['kind']]: MessageKey }

/**
 * A day lacking one of its temperatures says which it has, instead of a bare number. An estimate's
 * figures, one or two, are "typical", because a row labelled "High" or "High / low" over an average
 * would read as a prediction.
 */
function temperatureLabel(
  kind: DayReading['kind'],
  max: number | null,
  min: number | null,
): MessageKey {
  const typical = kind === 'estimate'
  if (max === null) {
    return typical
      ? 'trips.plan.weather.panel.typicalLow'
      : 'trips.plan.weather.panel.low'
  }
  if (min === null) {
    return typical
      ? 'trips.plan.weather.panel.typicalHigh'
      : 'trips.plan.weather.panel.high'
  }
  return typical
    ? 'trips.plan.weather.panel.temperatureTypical'
    : 'trips.plan.weather.panel.temperature'
}

/** The figures of a day, or `null` when it has neither: a missing figure is never drawn as a zero. */
function temperatureText(
  max: number | null,
  min: number | null,
  unit: 'C' | 'F',
  locale: Locale,
): string | null {
  const figure = (value: number) => `${formatNumber(value, locale)}°`
  if (max === null || min === null) {
    const only = max ?? min
    return only === null ? null : `${figure(only)}${unit}`
  }
  return `${figure(max)} / ${figure(min)}${unit}`
}

function Row({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="m-0 text-end font-semibold tabular-nums text-ink-2">
        <bdi dir="ltr">{children}</bdi>
      </dd>
    </>
  )
}

/**
 * Sunrise or sunset as the clock time in the trip's zone. A side the day does not have - polar
 * night, midnight sun - is a dash that names what is missing, never a blank and never `00:00`.
 */
function SunRow({
  label,
  missing,
  time,
}: {
  readonly label: string
  readonly missing: string
  readonly time: string | null
}) {
  return (
    <Row label={label}>
      {time === null ? (
        <span role="img" aria-label={missing} className="text-ink-4">
          —
        </span>
      ) : (
        time
      )}
    </Row>
  )
}
