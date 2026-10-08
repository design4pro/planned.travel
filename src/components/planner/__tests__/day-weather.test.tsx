// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render as mount, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DaySection } from '../day-section'
import { DayWeatherBadge } from '../day-weather-badge'

import type { DayWeather } from '#/lib/weather'
import type { PlannerDay } from '../types'

/**
 * The day weather badge, mounted for real under the `en` catalogue.
 *
 * What is checked is what only the DOM shows: that the badge's name begins with the word a reader
 * must hear first, that an unavailable day is not a number, that the same reading is drawn in the
 * reader's unit, and that the box a late answer fills is the box that was already there.
 */

const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      {ui}
    </I18nProvider>,
  )
}

const READING = {
  kind: 'forecast',
  source: 'met-norway',
  tempMinC: 4.2,
  tempMaxC: 11.6,
  symbol: 'rainshowers',
} as const

const FORECAST: DayWeather = { dayId: 'd1', status: 'ok', reading: READING }

function day(dateLabel: string | null): PlannerDay {
  return {
    dayId: 'd1',
    dayNumber: 1,
    title: 'Asakusa and the river',
    dateLabel,
    stays: [],
    rows: [],
    items: [],
  }
}

describe('DayWeatherBadge', () => {
  it('names a forecast with the word Forecast first, then the condition, high and low', () => {
    render(<DayWeatherBadge weather={FORECAST} unit="metric" />)

    expect(
      screen.getByRole('img', { name: 'Forecast: Rain, high 12°C, low 4°C' }),
    ).toBeDefined()
  })

  it('draws the same reading in Fahrenheit for an imperial reader', () => {
    render(<DayWeatherBadge weather={FORECAST} unit="imperial" />)

    expect(
      screen.getByRole('img', { name: 'Forecast: Rain, high 53°F, low 40°F' }),
    ).toBeDefined()
    expect(screen.getByText('53°')).toBeDefined()
  })

  it('says only the temperatures when the sky is unknown', () => {
    render(
      <DayWeatherBadge
        weather={{
          dayId: 'd1',
          status: 'ok',
          reading: { ...READING, symbol: null },
        }}
        unit="metric"
      />,
    )

    expect(
      screen.getByRole('img', { name: 'Forecast: high 12°C, low 4°C' }),
    ).toBeDefined()
  })

  it('shows an unavailable day as a muted dash named for what it is, never a number', () => {
    render(
      <DayWeatherBadge
        weather={{ dayId: 'd1', status: 'unavailable' }}
        unit="metric"
      />,
    )

    const badge = screen.getByRole('img', {
      name: 'Weather unavailable for this day',
    })
    expect(badge.textContent).toBe('—')
  })

  it('shows a skeleton while loading, named, with no numbers in it', () => {
    render(<DayWeatherBadge weather={{ status: 'loading' }} unit="metric" />)

    const badge = screen.getByRole('img', { name: 'Loading weather' })
    expect(badge.textContent).toBe('')
  })

  it('reserves the same box in every state, so a late answer shifts nothing', () => {
    const boxOf = (
      weather: React.ComponentProps<typeof DayWeatherBadge>['weather'],
    ) => {
      const { container, unmount } = render(
        <DayWeatherBadge weather={weather} unit="metric" />,
      )
      const box = container.querySelector('[data-part="day-weather"]')
      const classes = box?.className ?? ''
      unmount()
      return classes
    }

    const loading = boxOf({ status: 'loading' })
    expect(loading).not.toBe('')
    for (const weather of [
      FORECAST,
      { dayId: 'd1', status: 'unavailable' } as const,
      { dayId: 'd1', status: 'none' } as const,
    ]) {
      expect(boxOf(weather)).toBe(loading)
    }
  })

  it('leaves a day with nothing to show as empty space, named for nobody', () => {
    const { container } = render(
      <DayWeatherBadge
        weather={{ dayId: 'd1', status: 'none' }}
        unit="metric"
      />,
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.textContent).toBe('')
  })
})

describe('DaySection with weather', () => {
  function renderDay(
    dateLabel: string | null,
    weather?: React.ComponentProps<typeof DaySection>['weather'],
  ) {
    return render(
      <DndContext>
        <DaySection
          day={day(dateLabel)}
          categoryFor={() => undefined}
          weather={weather}
          weatherUnit="metric"
        />
      </DndContext>,
    )
  }

  it('puts the badge beside the header button, never inside it', () => {
    renderDay('Fri, 9 Oct', FORECAST)

    const badge = screen.getByRole('img', { name: /^Forecast/ })
    const header = screen.getByRole('button', { name: /Asakusa and the river/ })
    expect(header.contains(badge)).toBe(false)
    expect(header.parentElement).toBe(
      badge.closest('[data-part="day-weather"]')?.parentElement,
    )
  })

  it('leaves the header exactly as it was for a day without a date', () => {
    const { container } = renderDay(null, { dayId: 'd1', status: 'none' })

    expect(container.querySelector('[data-part="day-weather"]')).toBeNull()
  })

  it('draws no badge at all when the screen offers no weather', () => {
    const { container } = renderDay('Fri, 9 Oct')

    expect(container.querySelector('[data-part="day-weather"]')).toBeNull()
  })
})
