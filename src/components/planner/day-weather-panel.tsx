import { cn } from '#/lib/cn'
import { formatNumber, formatPercent } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { CONDITION_ICON } from './weather-icons'
import { CONDITION_LABEL, SLOT_LABEL, panelModel } from './weather-model'

import type { DayReading, WeatherUnit } from '#/lib/weather'

export interface DayWeatherPanelProps {
  readonly reading: DayReading
  /** The reader's unit; the reading itself is always metric. */
  readonly unit: WeatherUnit
  readonly className?: string
}

/**
 * The fuller reading of a forecast day: the high and low, what falls and how likely it is, the
 * wind, and a strip of the day's six-hour slots, with the provider's credit underneath.
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
                <span className="text-ink-3">{t(SLOT_LABEL[slot.name])}</span>
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
  readonly children: string
}) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd
        dir="ltr"
        className="m-0 text-end font-semibold tabular-nums text-ink-2"
      >
        {children}
      </dd>
    </>
  )
}
