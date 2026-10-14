// The currency list is a Radix popover, which needs the pointer-capture and scroll stubs jsdom lacks.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import {
  TripFormFields,
  applyTripFormChange,
  tripFormPayload,
  useTripForm,
} from '../trip-form'

import type { Catalogue } from '#/lib/i18n'
import type { TripFormFieldsProps, TripFormValues } from '../trip-form'

const EN: Catalogue = {
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

const EMPTY: TripFormValues = {
  title: 'Lisbon',
  summary: '',
  destination: '',
  startDate: '',
  endDate: '',
  duration: '',
  currency: 'EUR',
  reminderDays: 3,
}

afterEach(cleanup)

function Harness({
  initial = EMPTY,
  ...props
}: { initial?: TripFormValues } & Omit<TripFormFieldsProps, 'form'>) {
  const form = useTripForm(initial, false)
  return (
    <>
      <TripFormFields form={form} {...props} />
      <output data-testid="payload">
        {JSON.stringify(
          tripFormPayload(form, { creating: true, owner: props.owner ?? true }),
        )}
      </output>
    </>
  )
}

function mount(props: Parameters<typeof Harness>[0] = {}) {
  render(
    <I18nProvider locale="en" messages={EN}>
      <Harness {...props} />
    </I18nProvider>,
  )
}

function payload(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId('payload').textContent) as Record<
    string,
    unknown
  >
}

describe('applyTripFormChange: dates and duration are one fact', () => {
  const dated = {
    ...EMPTY,
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    duration: '7',
  }

  it('derives the duration when the second date arrives', () => {
    const half = { ...EMPTY, startDate: '2026-06-01' }
    expect(applyTripFormChange(half, 'endDate', '2026-06-04').duration).toBe(
      '4',
    )
  })

  it('moving the start preserves the duration: the end follows', () => {
    const moved = applyTripFormChange(dated, 'startDate', '2026-06-10')
    expect(moved.endDate).toBe('2026-06-16')
    expect(moved.duration).toBe('7')
  })

  it('moving the end changes the duration and leaves the start', () => {
    const moved = applyTripFormChange(dated, 'endDate', '2026-06-03')
    expect(moved.startDate).toBe('2026-06-01')
    expect(moved.duration).toBe('3')
  })

  it('keeps an inverted range as typed, for the inline refusal', () => {
    const moved = applyTripFormChange(dated, 'endDate', '2026-05-30')
    expect(moved.endDate).toBe('2026-05-30')
    expect(moved.duration).toBe('7')
  })

  it('holds a typed duration to whole days within the creatable range', () => {
    expect(applyTripFormChange(EMPTY, 'duration', '12abc').duration).toBe('12')
    expect(applyTripFormChange(EMPTY, 'duration', '0').duration).toBe('')
    expect(applyTripFormChange(EMPTY, 'duration', '9999').duration).toBe('365')
  })
})

describe('the field set', () => {
  it('shows an editable duration with no dates and makes it a read-out with both', async () => {
    const user = userEvent.setup()
    mount()

    const duration = screen.getByLabelText<HTMLInputElement>('Duration in days')
    expect(duration.readOnly).toBe(false)
    await user.type(duration, '5')
    expect(payload()).toMatchObject({ dayCount: 5, startDate: '', endDate: '' })

    await user.type(screen.getByLabelText('Departure'), '2026-06-01')
    await user.type(screen.getByLabelText('Return'), '2026-06-04')
    const derived = screen.getByLabelText<HTMLInputElement>('Duration in days')
    expect(derived.readOnly).toBe(true)
    expect(derived.value).toBe('4')
  })

  it('never submits a duration and a range together', async () => {
    const user = userEvent.setup()
    mount()

    await user.type(screen.getByLabelText('Duration in days'), '5')
    await user.type(screen.getByLabelText('Departure'), '2026-06-01')
    expect(payload()).not.toHaveProperty('dayCount')
    expect(payload()).toMatchObject({ startDate: '2026-06-01' })

    await user.type(screen.getByLabelText('Return'), '2026-06-04')
    expect(payload()).not.toHaveProperty('dayCount')
  })

  it('names an inverted range inline and refuses to save it', async () => {
    const user = userEvent.setup()
    mount({ initial: { ...EMPTY, startDate: '2026-06-10' } })

    await user.type(screen.getByLabelText('Return'), '2026-06-01')
    expect(
      screen.getByText('The return date is before departure.'),
    ).toBeTruthy()
  })

  it('hides a stand-alone duration where it could do nothing, but not once a date is set', () => {
    mount({ undatedDays: false })
    expect(screen.queryByLabelText('Duration in days')).toBeNull()
    cleanup()
    mount({
      undatedDays: false,
      initial: { ...EMPTY, startDate: '2026-06-01', endDate: '2026-06-03' },
    })
    expect(
      screen.getByLabelText<HTMLInputElement>('Duration in days').value,
    ).toBe('')
  })

  it('renders the owner-only reminder only to an owner', () => {
    mount({ owner: false })
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Add a cover image' }),
    ).toBeNull()
    expect(payload()).not.toHaveProperty('reminderDays')
    cleanup()
    mount()
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    expect(payload()).toMatchObject({ reminderDays: 3 })
  })

  it('resolves the reminder to an absolute date beneath the control', async () => {
    const user = userEvent.setup()
    mount({ initial: { ...EMPTY, startDate: '2026-06-10' } })

    expect(screen.getByText(/Reminder on/).textContent).toContain('7 Jun 2026')
    await user.click(screen.getByRole('radio', { name: 'Custom' }))
    expect(payload()).toMatchObject({ reminderDays: 7 })
    expect(screen.getByLabelText('Days before departure')).toBeTruthy()
  })
})

describe('the currency control', () => {
  it('lists the favourites first and finds a currency by code or by name', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(screen.getByRole('button', { name: 'Budget currency' }))
    const first = screen.getAllByRole('option').at(0)
    expect(first?.textContent).toContain('EUR')

    await user.type(screen.getByRole('combobox'), 'polish')
    expect(screen.getByRole('option', { name: /PLN/ })).toBeTruthy()
    // NOK is outside the catalogue's nine: its name is the platform's, and it is searchable all the same.
    await user.clear(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'norwegian')
    expect(screen.getByRole('option', { name: /NOK/ })).toBeTruthy()
    await user.clear(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'sek')
    expect(screen.getByRole('option', { name: /SEK/ })).toBeTruthy()
  })
})
