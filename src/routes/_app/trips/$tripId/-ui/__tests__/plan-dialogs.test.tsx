import '#/components/ui/__tests__/test-env'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import {
  emptyDraft,
  emptyTiming,
  PlaceDialog,
  TimingDialog,
} from '../plan-actions'

const messages = await loadCatalogue('pl')
afterEach(cleanup)
const place = { ...emptyDraft, name: 'Shrine' }
const days = [
  {
    dayId: 'day-1',
    dayNumber: 1,
    title: null,
    date: null,
    stops: [],
    stays: [],
  },
]
function local(ui: React.ReactNode) {
  return (
    <I18nProvider locale="pl" messages={messages}>
      {ui}
    </I18nProvider>
  )
}

// Consumer-controlled saving/error state mirrors a refused asynchronous write.
function RefusedSave({
  timing,
  failure,
  onAttempt,
}: {
  timing: boolean
  failure: Promise<never>
  onAttempt: () => void
}) {
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const submit = async () => {
    onAttempt()
    setSaving(true)
    setError(null)
    try {
      await failure
    } catch {
      setError('Odmowa zapisu')
    } finally {
      setSaving(false)
    }
  }
  const shared = {
    open: true,
    onOpenChange: () => {},
    saving,
    error,
    onSubmit: submit,
  }
  return timing ? (
    <TimingDialog
      {...shared}
      initial={emptyTiming}
      placeName="Shrine"
      dayLabel="Dzień 1"
    />
  ) : (
    <PlaceDialog
      {...shared}
      mode="edit"
      initial={place}
      categories={[]}
      days={[]}
    />
  )
}

describe('translated planner forms', () => {
  it.each(['create', 'edit'] as const)(
    'localises place %s and its options',
    async (mode) => {
      render(
        local(
          <PlaceDialog
            open
            onOpenChange={() => {}}
            mode={mode}
            initial={place}
            categories={[]}
            days={days}
            saving={false}
            error="Odmowa"
            onSubmit={() => {}}
          />,
        ),
      )
      expect(screen.getByRole('dialog').textContent).not.toMatch(
        /Add a place to this trip|Edit this place|Give it a name|Changes apply|Name|City|Category|Address|How long there|Worth it|Latitude|Longitude|Put it on a day|Already been|Cancel|Save changes|That did not save|No category/,
      )
      expect(screen.getByRole('alert').textContent).toContain(
        messages['modules.form.saveError'],
      )
      for (const select of screen.getAllByRole('combobox')) {
        await userEvent.click(select)
        expect(screen.getByRole('listbox').textContent).not.toMatch(
          /No fixed length|minutes|hour|Half a day|A full day|Not rated|skip it|if there is time|worth it|really good|do not miss|Leave it unplanned|Day 1|No category/,
        )
        await userEvent.keyboard('{Escape}')
      }
      expect(screen.getByLabelText(/Nazwa/)).toBeTruthy()
      expect(
        screen.getByPlaceholderText('np. Fushimi Inari Taisha'),
      ).toBeTruthy()
      expect(screen.getByPlaceholderText('np. Kioto')).toBeTruthy()
      expect(
        screen.getByPlaceholderText('np. 68 Fukakusa Yabunouchicho'),
      ).toBeTruthy()
    },
  )

  it('localises timing options, note hint and invalid time ordering', async () => {
    render(
      local(
        <TimingDialog
          open
          onOpenChange={() => {}}
          initial={{ ...emptyTiming, startTime: '12:00', endTime: '11:00' }}
          placeName="Shrine"
          dayLabel="Dzień 1"
          saving={false}
          error="Odmowa"
          onSubmit={() => {}}
        />,
      ),
    )
    expect(screen.getByRole('dialog').textContent).not.toMatch(
      /Arrive|Leave|Later than the arrival|How long there|Booking|Note for this stop|Cancel|Save|That did not save/,
    )
    expect(
      screen.getByRole('textbox').getAttribute('placeholder'),
    ).not.toContain('Go early')
    for (const select of screen.getAllByRole('combobox')) {
      await userEvent.click(select)
      expect(screen.getByRole('listbox').textContent).not.toMatch(
        /No fixed length|minutes|hour|Half a day|A full day|No booking needed|Still to book|Booked and confirmed|Been and done|Cancelled/,
      )
      await userEvent.keyboard('{Escape}')
    }
  })

  it.each([false, true])(
    'retains submit focus and one alert after rejection and permits retry (timing=%s)',
    async (timing) => {
      let refuse = () => {}
      const failure = new Promise<never>((_, reject) => {
        refuse = () => reject(new Error('refused'))
      })
      const attempt = vi.fn()
      render(
        local(
          <RefusedSave timing={timing} failure={failure} onAttempt={attempt} />,
        ),
      )
      const submit = screen.getByRole('button', {
        name: timing ? 'Zapisz' : 'Zapisz zmiany',
      })
      await userEvent.click(submit)
      expect(submit.getAttribute('aria-busy')).toBe('true')
      expect(document.activeElement).toBe(submit)
      refuse()
      await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))
      expect(document.activeElement).toBe(submit)
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      await userEvent.keyboard('{Enter}')
      expect(attempt).toHaveBeenCalledTimes(2)
      expect(document.activeElement).toBe(submit)
      expect(screen.getAllByRole('alert')).toHaveLength(1)
    },
  )

  it.each([
    ['', '', '', 'Miejsce musi mieć nazwę'],
    ['Shrine', '91', '0', 'Od -90 do 90'],
    ['Shrine', '0', '181', 'Od -180 do 180'],
    ['Shrine', '1', '', 'Położenie wymaga obu współrzędnych'],
  ])(
    'localises invalid place data (%s, %s, %s)',
    (name, lat, lng, expected) => {
      const onSubmit = vi.fn()
      render(
        local(
          <PlaceDialog
            open
            onOpenChange={() => {}}
            mode="create"
            initial={{ ...emptyDraft, name, lat, lng }}
            categories={[]}
            days={[]}
            saving={false}
            error={null}
            onSubmit={onSubmit}
          />,
        ),
      )
      const form = document.querySelector('form')
      if (!form) throw new Error('Missing form')
      fireEvent.submit(form)
      expect(screen.getByText(expected)).toBeTruthy()
      expect(
        document.querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.disabled,
      ).toBe(true)
      expect(onSubmit).not.toHaveBeenCalled()
    },
  )

  it.each([false, true])(
    'keeps a valid pending form focusable and guards direct submits (timing=%s)',
    (timing) => {
      const onSubmit = vi.fn()
      const shared = {
        open: true,
        onOpenChange: () => {},
        saving: true,
        error: null,
        onSubmit,
      }
      render(
        local(
          timing ? (
            <TimingDialog
              {...shared}
              initial={emptyTiming}
              placeName="Shrine"
              dayLabel="Dzień 1"
            />
          ) : (
            <PlaceDialog
              {...shared}
              mode="create"
              initial={place}
              categories={[]}
              days={[]}
            />
          ),
        ),
      )
      const button = document.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )
      expect(button?.disabled).toBe(false)
      expect(button?.getAttribute('aria-busy')).toBe('true')
      const form = document.querySelector('form')
      if (!form) throw new Error('Missing form')
      fireEvent.submit(form)
      expect(onSubmit).not.toHaveBeenCalled()
    },
  )
})
