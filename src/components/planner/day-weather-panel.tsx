import { cn } from '#/lib/cn'
import { formatNumber, formatPercent } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { CONDITION_ICON } from './weather-icons'
import { CONDITION_LABEL, SLOT_LABEL, panelModel } from './weather-model'

import type { ReactNode } from 'react'
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
 * The fuller reading of a forecast day: the high and low, what falls and how likely it is, the
 * wind, the day's sunrise and sunset, and a strip of the day's six-hour slots, with the provider's
 * credit underneath.
 *
 * It is a unit with no popover in it - the badge puts it in one today, and the day detail screen
 * will mount it in its weather region without the badge's popover around it. Whatever the provider
 * did not state is a row left out, never a zero; a reading with no slots has no strip at all, never
 * empty columns and never a value worked out from the high and low.
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

  return (
    <div
      data-part="day-weather-panel"
      className={cn('flex flex-col gap-3', className)}
    >
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-caption">
        <Row label={t('trips.plan.weather.panel.temperature')}>
          {`${formatNumber(model.max, locale)}° / ${formatNumber(model.min, locale)}°${model.unit}`}
        </Row>
        {precipitation.length === 0 ? null : (
          <Row label={t('trips.plan.weather.panel.precipitation')}>
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
          className="grid auto-cols-fr grid-flow-col gap-1 border-t border-edge pt-3"
        >
          {model.slots.map((slot) => {
            const Icon =
              slot.condition === null ? null : CONDITION_ICON[slot.condition]
            return (
              <li
                key={slot.name}
                className="flex flex-col items-center gap-1 text-caption tabular-nums"
              >
                <span className="max-w-full text-center hyphens-auto wrap-anywhere text-ink-3">
                  {t(SLOT_LABEL[slot.name])}
                </span>
                {Icon === null || slot.condition === null ? (
                  <span aria-hidden="true" className="size-4" />
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

      <p className="text-caption text-ink-4">
        {t('trips.plan.weather.attribution.metNorway')}
      </p>
    </div>
  )
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
