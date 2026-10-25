// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DaySection } from '../day-section'
import { DayWeatherBadge } from '../day-weather-badge'
import { DayWeatherPanel } from '../day-weather-panel'

import type { SunTimes } from '#/lib/sun'
import type {
  DayReading,
  DayWeather,
  EstimateReading,
  RecordedReading,
} from '#/lib/weather'
import type { PlannerDay } from '../types'
import type { DayWeatherView } from '../weather-model'

/**
 * The day weather badge and the fuller reading behind it, mounted for real under the `en`
 * catalogue.
 *
 * What is checked is what only the DOM shows: that the badge's name begins with the word a reader
 * must hear first, that an unavailable day is not a number, that the same reading is drawn in the
 * reader's unit, that the box a late answer fills is the box that was already there, and that the
 * panel opens and closes from the keyboard with focus handed back to where it came from.
 */

const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      {ui}
    </I18nProvider>,
  )
}

const READING: DayReading = {
  kind: 'forecast',
  source: 'met-norway',
  tempMinC: 4.2,
  tempMaxC: 11.6,
  symbol: 'rainshowers',
  precipitationMm: 5.1,
  precipitationProbability: 70,
  windMs: 5,
  slots: [
    { from: '00:00', symbol: 'cloudy', tempC: 5.4 },
    { from: '06:00', symbol: 'rain', tempC: 6.2 },
    { from: '12:00', symbol: 'partlycloudy', tempC: 11.6 },
    { from: '18:00', symbol: 'clearsky', tempC: 8.1 },
  ],
}

const RECORDED: RecordedReading = {
  kind: 'recorded',
  source: 'nasa-power',
  tempMinC: 1.9,
  tempMaxC: 8.4,
  precipitationMm: 0.2,
  windMs: 0.9,
}

const recorded = (reading: RecordedReading = RECORDED): DayWeather => ({
  dayId: 'd1',
  status: 'ok',
  reading,
})

const ESTIMATE: EstimateReading = {
  kind: 'estimate',
  source: 'nasa-power',
  tempMinC: 1.9,
  tempMaxC: 8.4,
  precipitationMm: 2.5,
  windMs: null,
}

const estimate = (reading: EstimateReading = ESTIMATE): DayWeather => ({
  dayId: 'd1',
  status: 'ok',
  reading,
})

const NOT_YET: DayWeather = { dayId: 'd1', status: 'not-yet-recorded' }

const DATE_LABEL = 'Fri, 9 Oct'

const forecast = (reading: DayReading = READING): DayWeather => ({
  dayId: 'd1',
  status: 'ok',
  reading,
})

const FORECAST = forecast()

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

function badge(
  weather: React.ComponentProps<typeof DayWeatherBadge>['weather'],
  unit: React.ComponentProps<typeof DayWeatherBadge>['unit'] = 'metric',
) {
  return render(
    <DayWeatherBadge weather={weather} unit={unit} dateLabel={DATE_LABEL} />,
  )
}

describe('DayWeatherBadge', () => {
  it('names a forecast with the word Forecast first, then the condition, high and low', () => {
    badge(FORECAST)

    expect(
      screen.getByRole('button', {
        name: 'Forecast: Rain, high 12°C, low 4°C',
      }),
    ).toBeDefined()
  })

  it('draws the same reading in Fahrenheit for an imperial reader', () => {
    badge(FORECAST, 'imperial')

    expect(
      screen.getByRole('button', {
        name: 'Forecast: Rain, high 53°F, low 40°F',
      }),
    ).toBeDefined()
    expect(screen.getByText('53°')).toBeDefined()
  })

  it('says only the temperatures when the sky is unknown', () => {
    badge(forecast({ ...READING, symbol: null }))

    expect(
      screen.getByRole('button', { name: 'Forecast: high 12°C, low 4°C' }),
    ).toBeDefined()
  })

  it('shows an unavailable day as a muted dash named for what it is, never a number', () => {
    badge({ dayId: 'd1', status: 'unavailable' })

    const dash = screen.getByRole('img', {
      name: 'Weather unavailable for this day',
    })
    expect(dash.textContent).toBe('—')
    // There is nothing to open, so it is not a control.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a skeleton while loading, named, with no numbers in it', () => {
    badge({ status: 'loading' })

    const skeleton = screen.getByRole('img', { name: 'Loading weather' })
    expect(skeleton.textContent).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('names a recorded day with the word Recorded first, then the high and low', () => {
    badge(recorded())

    expect(
      screen.getByRole('button', { name: 'Recorded: high 8°C, low 2°C' }),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: /^Forecast/ })).toBeNull()
  })

  it('draws a recorded day in Fahrenheit for an imperial reader', () => {
    badge(recorded(), 'imperial')

    expect(
      screen.getByRole('button', { name: 'Recorded: high 47°F, low 35°F' }),
    ).toBeDefined()
  })

  it('names the one temperature a recorded day has, and never draws the other as a zero', () => {
    badge(recorded({ ...RECORDED, tempMinC: null }))

    const button = screen.getByRole('button', { name: 'Recorded: high 8°C' })
    expect(button.textContent).toBe('8°C')
  })

  it('draws a recorded day with neither temperature as the unavailable dash, never as a zero', () => {
    badge(recorded({ ...RECORDED, tempMinC: null, tempMaxC: null }))

    const dash = screen.getByRole('img', {
      name: 'Weather unavailable for this day',
    })
    expect(dash.textContent).toBe('—')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('names an estimate with the word Estimate first, then the typical high and low', () => {
    badge(estimate())

    expect(
      screen.getByRole('button', {
        name: 'Estimate: typical high 8°C, low 2°C',
      }),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: /^Forecast/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Recorded/ })).toBeNull()
  })

  it('draws an estimate in Fahrenheit for an imperial reader', () => {
    badge(estimate(), 'imperial')

    expect(
      screen.getByRole('button', {
        name: 'Estimate: typical high 47°F, low 35°F',
      }),
    ).toBeDefined()
  })

  it('marks an estimate with an approximately sign and a dashed outline in the informational colour', () => {
    const first = badge(estimate())

    const button = screen.getByRole('button', { name: /^Estimate/ })
    const sign = within(button).getByText('≈')
    expect(sign.getAttribute('aria-hidden')).toBe('true')
    expect(button.textContent?.startsWith('≈')).toBe(true)
    expect(button.className).toContain('border-dashed')
    expect(button.className).toContain('border-info')
    first.unmount()
    // A forecast and a recorded day carry neither the sign nor the outline.
    for (const other of [FORECAST, recorded()]) {
      const { unmount } = badge(other)
      const control = screen.getByRole('button')
      expect(control.textContent).not.toContain('≈')
      expect(control.className).not.toContain('border-dashed')
      unmount()
    }
  })

  it('names the one temperature an estimate has, and never draws the other as a zero', () => {
    badge(estimate({ ...ESTIMATE, tempMinC: null }))

    const button = screen.getByRole('button', {
      name: 'Estimate: typical high 8°C',
    })
    expect(button.textContent).toBe('≈8°C')
  })

  it('draws an estimate with neither temperature as the unavailable dash, never as a zero', () => {
    badge(estimate({ ...ESTIMATE, tempMinC: null, tempMaxC: null }))

    expect(
      screen.getByRole('img', { name: 'Weather unavailable for this day' }),
    ).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a not-yet-recorded day as its own picture, with no control and no number', () => {
    badge(NOT_YET)

    const picture = screen.getByRole('img', { name: 'Not yet recorded' })
    expect(picture.textContent).toBe('')
    expect(picture.getAttribute('title')).toBe('Not yet recorded')
    expect(screen.queryByRole('button')).toBeNull()
    // It is not the unavailable dash.
    expect(
      screen.queryByRole('img', { name: 'Weather unavailable for this day' }),
    ).toBeNull()
  })

  it('reserves the same box in every state, so a late answer shifts nothing', () => {
    const boxOf = (
      weather: React.ComponentProps<typeof DayWeatherBadge>['weather'],
    ) => {
      const { container, unmount } = badge(weather)
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
      recorded(),
      estimate(),
      NOT_YET,
    ]) {
      expect(boxOf(weather)).toBe(loading)
    }
  })

  it('replaces the loading picture when the answer is not-yet-recorded, never reuses its element', () => {
    // The browser reports a layout shift for an element that persists and moves. React keeps an
    // element of the same type in the same place, so a clock drawn over the skeleton's span would
    // be the skeleton's span with a new left edge: a measured shift the traveller cannot see.
    const view = (weather: DayWeatherView) => (
      <I18nProvider locale="en" messages={MESSAGES}>
        <DayWeatherBadge
          weather={weather}
          unit="metric"
          dateLabel={DATE_LABEL}
        />
      </I18nProvider>
    )
    const { rerender } = mount(view({ status: 'loading' }))
    const loadingPicture = screen.getByRole('img', { name: 'Loading weather' })

    rerender(view(NOT_YET))

    const clock = screen.getByRole('img', { name: 'Not yet recorded' })
    expect(loadingPicture.isConnected).toBe(false)
    expect(clock).not.toBe(loadingPicture)
  })

  it('leaves a day with nothing to show as empty space, named for nobody', () => {
    const { container } = badge({ dayId: 'd1', status: 'none' })

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.textContent).toBe('')
  })
})

describe('the fuller forecast behind the badge', () => {
  const open = async () => {
    const user = userEvent.setup()
    badge(FORECAST)
    await user.click(screen.getByRole('button', { name: /^Forecast/ }))
    return { user, dialog: await screen.findByRole('dialog') }
  }

  it('opens a dialog named for the day, from the badge', async () => {
    const { dialog } = await open()

    expect(dialog.getAttribute('aria-labelledby')).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Weather for Fri, 9 Oct' })).toBe(
      dialog,
    )
    const trigger = screen.getByRole('button', { name: /^Forecast/ })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('shows the high and low, precipitation with its chance, and the wind', async () => {
    const { dialog } = await open()
    const panel = within(dialog)

    expect(panel.getByText('High / low')).toBeDefined()
    expect(panel.getByText('12° / 4°C')).toBeDefined()
    expect(panel.getByText('Precipitation')).toBeDefined()
    expect(panel.getByText('5.1 mm · 70% chance')).toBeDefined()
    expect(panel.getByText('Wind')).toBeDefined()
    expect(panel.getByText('18 km/h')).toBeDefined()
  })

  it('shows four six-hour slots, each with its name, condition and temperature', async () => {
    const { dialog } = await open()

    const slots = within(
      within(dialog).getByRole('list', { name: 'Through the day' }),
    ).getAllByRole('listitem')
    expect(slots.map((slot) => slot.textContent)).toEqual([
      'NightCloudy5°',
      'MorningRain6°',
      'AfternoonPartly cloudy12°',
      'EveningClear8°',
    ])
  })

  it('names MET Norway and its licence', async () => {
    const { dialog } = await open()

    expect(
      within(dialog).getByText('Forecast data: MET Norway, CC BY 4.0'),
    ).toBeDefined()
  })

  it('opens on Enter and on Space, closes on Escape, and hands focus back to the badge', async () => {
    const user = userEvent.setup()
    badge(FORECAST)
    const trigger = screen.getByRole('button', { name: /^Forecast/ })

    await user.tab()
    expect(document.activeElement).toBe(trigger)

    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog')).toBeDefined()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)

    await user.keyboard(' ')
    expect(await screen.findByRole('dialog')).toBeDefined()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('draws every figure in the reader’s unit', async () => {
    const user = userEvent.setup()
    badge(FORECAST, 'imperial')
    await user.click(screen.getByRole('button', { name: /^Forecast/ }))
    const panel = within(await screen.findByRole('dialog'))

    expect(panel.getByText('53° / 40°F')).toBeDefined()
    expect(panel.getByText('0.2 in · 70% chance')).toBeDefined()
    expect(panel.getByText('11 mph')).toBeDefined()
  })
})

describe('the fuller reading of a recorded day', () => {
  const open = async () => {
    const user = userEvent.setup()
    badge(recorded())
    await user.click(screen.getByRole('button', { name: /^Recorded/ }))
    return { user, dialog: await screen.findByRole('dialog') }
  }

  it('has no slots region and no chance of rain', async () => {
    const { dialog } = await open()

    expect(within(dialog).queryByRole('list')).toBeNull()
    expect(within(dialog).queryByText('Through the day')).toBeNull()
    expect(within(dialog).queryByText(/chance/)).toBeNull()
    expect(within(dialog).getByText('8° / 2°C')).toBeDefined()
  })

  it('says the values were measured and credits NASA POWER, not MET Norway', async () => {
    const { dialog } = await open()

    expect(
      within(dialog).getByText('Measured values for this day.'),
    ).toBeDefined()
    expect(
      within(dialog).getByText(
        'Data: NASA Langley Research Center POWER Project',
      ),
    ).toBeDefined()
    expect(within(dialog).queryByText(/MET Norway/)).toBeNull()
  })

  it('labels the lone figure of a day that has only one temperature', () => {
    render(
      <DayWeatherPanel
        reading={{ ...RECORDED, tempMaxC: null }}
        unit="metric"
      />,
    )

    expect(screen.getByText('Low')).toBeDefined()
    expect(screen.getByText('2°C')).toBeDefined()
    expect(screen.queryByText('High / low')).toBeNull()
  })
})

describe('the fuller reading of an estimated day', () => {
  const open = async (unit: 'metric' | 'imperial' = 'metric') => {
    const user = userEvent.setup()
    badge(estimate(), unit)
    await user.click(screen.getByRole('button', { name: /^Estimate/ }))
    return { user, dialog: await screen.findByRole('dialog') }
  }

  it('labels the row as typical, so it does not read as a prediction', async () => {
    const { dialog } = await open()

    expect(within(dialog).getByText('Typical high / low')).toBeDefined()
    expect(within(dialog).queryByText('High / low')).toBeNull()
    expect(within(dialog).getByText('8° / 2°C')).toBeDefined()
  })

  it('says it is a long-term average and not a forecast', async () => {
    const { dialog } = await open()

    expect(
      within(dialog).getByText(
        'A long-term average for this month, not a forecast.',
      ),
    ).toBeDefined()
  })

  it('credits NASA POWER, not MET Norway', async () => {
    const { dialog } = await open()

    expect(
      within(dialog).getByText(
        'Data: NASA Langley Research Center POWER Project',
      ),
    ).toBeDefined()
    expect(within(dialog).queryByText(/MET Norway/)).toBeNull()
  })

  it('has no wind, no slots region and no chance of rain', async () => {
    const { dialog } = await open()

    expect(within(dialog).queryByText('Wind')).toBeNull()
    expect(within(dialog).queryByRole('list')).toBeNull()
    expect(within(dialog).queryByText(/chance/)).toBeNull()
  })

  it('labels the rain as a typical figure per day, not as a day’s total', async () => {
    const { dialog } = await open()

    expect(
      within(dialog).getByText('Typical precipitation per day'),
    ).toBeDefined()
    expect(within(dialog).queryByText('Precipitation')).toBeNull()
  })

  it('draws the figures in the reader’s unit', async () => {
    const { dialog } = await open('imperial')

    expect(within(dialog).getByText('47° / 35°F')).toBeDefined()
  })
})

describe('DayWeatherPanel', () => {
  it('omits the slots region entirely for a reading with no slots', () => {
    render(
      <DayWeatherPanel reading={{ ...READING, slots: null }} unit="metric" />,
    )

    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByText('Through the day')).toBeNull()
    expect(screen.queryByText('Night')).toBeNull()
    // The rest of the reading is still there.
    expect(screen.getByText('12° / 4°C')).toBeDefined()
  })

  it('draws only the slots a reading has, and nothing in place of the others', () => {
    render(
      <DayWeatherPanel
        reading={{
          ...READING,
          slots: [
            { from: '12:00', symbol: 'cloudy', tempC: 10 },
            { from: '18:00', symbol: null, tempC: 8 },
          ],
        }}
        unit="metric"
      />,
    )

    expect(
      screen.getAllByRole('listitem').map((slot) => slot.textContent),
    ).toEqual(['AfternoonCloudy10°', 'Evening8°'])
  })

  it('leaves out a row the provider gave nothing for, rather than writing a zero', () => {
    render(
      <DayWeatherPanel
        reading={{
          ...READING,
          precipitationMm: null,
          precipitationProbability: null,
          windMs: null,
        }}
        unit="metric"
      />,
    )

    expect(screen.queryByText('Precipitation')).toBeNull()
    expect(screen.queryByText('Wind')).toBeNull()
    expect(screen.getByText('High / low')).toBeDefined()
  })

  it('says the amount alone when the provider states no chance', () => {
    render(
      <DayWeatherPanel
        reading={{ ...READING, precipitationProbability: null }}
        unit="metric"
      />,
    )

    expect(screen.getByText('5.1 mm')).toBeDefined()
  })

  it.each([
    ['metric', 0.04, '<0.1 mm'],
    ['imperial', 0.1, '<0.01 in'],
    ['metric', 0, '0 mm'],
    ['imperial', 0, '0 in'],
  ] as const)(
    'reads %s %s mm of rain as %s: a trace is a lower bound, only a true zero is zero',
    (unit, precipitationMm, text) => {
      render(
        <DayWeatherPanel
          reading={{
            ...READING,
            precipitationMm,
            precipitationProbability: null,
          }}
          unit={unit}
        />,
      )

      expect(screen.getByText(text)).toBeDefined()
    },
  )
})

describe('sunrise and sunset in the fuller forecast', () => {
  const openWith = async (sun: SunTimes) => {
    const user = userEvent.setup()
    badge({ dayId: 'd1', status: 'ok', reading: READING, sun })
    await user.click(screen.getByRole('button', { name: /^Forecast/ }))
    return within(await screen.findByRole('dialog'))
  }

  it('shows both as clock times in the trip’s zone', async () => {
    const panel = await openWith({ sunrise: '06:12', sunset: '17:36' })

    expect(panel.getByText('Sunrise')).toBeDefined()
    expect(panel.getByText('06:12')).toBeDefined()
    expect(panel.getByText('Sunset')).toBeDefined()
    expect(panel.getByText('17:36')).toBeDefined()
  })

  it('shows a dash named for each side in polar night, never a time', async () => {
    const panel = await openWith({ sunrise: null, sunset: null })

    expect(panel.getByRole('img', { name: 'No sunrise' }).textContent).toBe('—')
    expect(panel.getByRole('img', { name: 'No sunset' }).textContent).toBe('—')
    expect(panel.queryByText('00:00')).toBeNull()
  })

  it('names only the side that is missing', () => {
    render(
      <DayWeatherPanel
        reading={READING}
        sun={{ sunrise: '03:54', sunset: null }}
        unit="metric"
      />,
    )

    expect(screen.getByText('03:54')).toBeDefined()
    expect(screen.queryByRole('img', { name: 'No sunrise' })).toBeNull()
    expect(screen.getByRole('img', { name: 'No sunset' })).toBeDefined()
  })

  it('shows them on a recorded day as well, which has a popover of its own', async () => {
    const user = userEvent.setup()
    badge({
      dayId: 'd1',
      status: 'ok',
      reading: RECORDED,
      sun: { sunrise: '07:22', sunset: '18:50' },
    })
    await user.click(screen.getByRole('button', { name: /^Recorded/ }))
    const panel = within(await screen.findByRole('dialog'))

    expect(panel.getByText('07:22')).toBeDefined()
    expect(panel.getByText('18:50')).toBeDefined()
  })

  it('leaves both rows out when the answer carried no sun times', () => {
    render(<DayWeatherPanel reading={READING} unit="metric" />)

    expect(screen.queryByText('Sunrise')).toBeNull()
    expect(screen.queryByText('Sunset')).toBeNull()
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
    renderDay(DATE_LABEL, FORECAST)

    const badgeButton = screen.getByRole('button', { name: /^Forecast/ })
    const header = screen.getByRole('button', {
      name: /Asakusa and the river/,
    })
    expect(header.contains(badgeButton)).toBe(false)
    expect(badgeButton.contains(header)).toBe(false)
    expect(header.parentElement).toBe(
      badgeButton.closest('[data-part="day-weather"]')?.parentElement,
    )
  })

  it('leaves the header button as wide as the row allows, narrowed only by the badge', () => {
    renderDay(DATE_LABEL, FORECAST)

    const header = screen.getByRole('button', {
      name: /Asakusa and the river/,
    })
    expect(header.className).toContain('flex-1')
    expect(header.className).toContain('min-w-0')
  })

  it('opens the fuller forecast from the day’s own badge, naming the day’s date', async () => {
    const user = userEvent.setup()
    renderDay(DATE_LABEL, FORECAST)

    await user.click(screen.getByRole('button', { name: /^Forecast/ }))

    expect(
      await screen.findByRole('dialog', { name: 'Weather for Fri, 9 Oct' }),
    ).toBeDefined()
  })

  it('leaves the header exactly as it was for a day without a date', () => {
    const { container } = renderDay(null, { dayId: 'd1', status: 'none' })

    expect(container.querySelector('[data-part="day-weather"]')).toBeNull()
  })

  it('draws no badge at all when the screen offers no weather', () => {
    const { container } = renderDay(DATE_LABEL)

    expect(container.querySelector('[data-part="day-weather"]')).toBeNull()
  })
})

describe('a popover whose day stops being a forecast', () => {
  const tree = (
    weather: React.ComponentProps<typeof DaySection>['weather'],
    onFocusDay?: () => void,
  ) => (
    <I18nProvider locale="en" messages={MESSAGES}>
      <button type="button">Elsewhere</button>
      <DndContext>
        <DaySection
          day={day(DATE_LABEL)}
          categoryFor={() => undefined}
          weather={weather}
          weatherUnit="metric"
          onFocusDay={onFocusDay}
        />
      </DndContext>
    </I18nProvider>
  )
  const header = () =>
    screen.getByRole('button', { name: /Asakusa and the river/ })

  it.each([
    ['loading', { status: 'loading' }],
    ['unavailable', { dayId: 'd1', status: 'unavailable' }],
    ['none', { dayId: 'd1', status: 'none' }],
    ['not supplied at all', undefined],
  ] as const)(
    'closes it and hands focus to the day’s header button when the day turns %s',
    async (_name, next) => {
      const user = userEvent.setup()
      const onFocusDay = vi.fn()
      const { rerender } = mount(tree(FORECAST, onFocusDay))
      await user.click(screen.getByRole('button', { name: /^Forecast/ }))
      const dialog = await screen.findByRole('dialog')
      expect(dialog.contains(document.activeElement)).toBe(true)

      rerender(tree(next, onFocusDay))

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(header())
      // Focus is moved, not pressed: the day is not selected by the weather going away.
      expect(onFocusDay).not.toHaveBeenCalled()
      expect(header().getAttribute('aria-pressed')).toBe('false')
    },
  )

  it('hands focus over from the badge itself when the popover was already closed', async () => {
    const user = userEvent.setup()
    const { rerender } = mount(tree(FORECAST))
    await user.tab()
    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /^Forecast/ }),
    )

    rerender(tree({ dayId: 'd1', status: 'unavailable' }))

    expect(document.activeElement).toBe(header())
  })

  it('leaves focus alone when it was somewhere else', async () => {
    const user = userEvent.setup()
    const { rerender } = mount(tree(FORECAST))
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    await user.click(elsewhere)

    rerender(tree({ dayId: 'd1', status: 'none' }))

    expect(document.activeElement).toBe(elsewhere)
  })
})
