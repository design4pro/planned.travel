import '#/components/ui/__tests__/test-env'
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DayDetail } from '../day-detail'
import { booking } from './plan-board-fixtures'
import type { DayDetailProps } from '../day-detail'

const messages = await loadCatalogue('en')
function setup(extra: Partial<DayDetailProps> = {}) {
  const props: DayDetailProps = {
    model: {
      day: {
        dayId: 'd1',
        dayNumber: 1,
        date: null,
        title: 'Tokyo',
        stays: [],
        stops: [],
      },
      stays: [],
      notes: [],
      reservations: [],
    },
    tripId: 't1',
    minimised: false,
    editable: true,
    loading: false,
    error: false,
    focusToken: 1,
    blockedEscape: false,
    panelRef: React.createRef(),
    addStayRef: React.createRef(),
    onMinimise: vi.fn(),
    onExpand: vi.fn(),
    onClose: vi.fn(),
    onAddStay: vi.fn(),
    onRetry: vi.fn(),
    ...extra,
  }
  const ui = (p: DayDetailProps) => (
    <I18nProvider locale="en" messages={messages}>
      <DayDetail {...p} />
      <button>Outside</button>
    </I18nProvider>
  )
  const view = render(ui(props))
  return {
    ...view,
    props,
    update: (patch: Partial<DayDetailProps>) =>
      view.rerender(ui({ ...props, ...patch })),
  }
}
it('focuses the heading, has empty states, allows Tab exit and dismisses only inside', async () => {
  const { props } = setup()
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2 }),
    ),
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByText('Dates not set')).toBeTruthy()
  expect(screen.getByText('No notes for this day')).toBeTruthy()
  expect(screen.getByText('No reservations for this day')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Add stay' }))
  expect(props.onAddStay).toHaveBeenCalledOnce()
  await userEvent.tab()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Outside' }),
  )
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(props.onClose).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('heading', { level: 2 }), {
    key: 'Escape',
  })
  expect(props.onClose).toHaveBeenCalledOnce()
})
it('keeps identity on minimising and removes body controls', async () => {
  const { update } = setup()
  update({ minimised: true })
  expect(screen.getByText('Day 1 · Tokyo')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Expand day details' }),
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Add stay' })).toBeNull()
})
it('shows read failure instead of empty reservations and offers Retry', async () => {
  const { props } = setup({ error: true, editable: false })
  expect(screen.queryByText('No reservations for this day')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Add stay' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(props.onRetry).toHaveBeenCalledOnce()
})
it('does not steal focus on background refresh or dismiss a modal or editor', async () => {
  const { props, update } = setup({ blockedEscape: true })
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2 }),
    ),
  )
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(props.onClose).not.toHaveBeenCalled()
  screen.getByRole('button', { name: 'Outside' }).focus()
  update({ loading: true })
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Outside' }),
  )
})

it('moves focus to the heading when a refreshed Stay removes the empty-state action', async () => {
  const { props, update } = setup()
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2 }),
    ),
  )
  screen.getByRole('button', { name: 'Add stay' }).focus()
  update({
    model: {
      ...props.model,
      stays: [
        {
          id: 'stay',
          name: 'Saved hotel',
          startDayId: 'd1',
          endDayId: 'd1',
          checkIn: null,
          checkOut: null,
          reservationId: 'r1',
          confirmation: 'REAL-42',
        },
      ],
    },
  })
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2 }),
    ),
  )
})

it('shows a textual Reservation status with its semantic tint and the Book link', () => {
  const { props, update } = setup()
  update({
    model: {
      ...props.model,
      reservations: [booking('r1', { title: 'Hotel', status: 'confirmed' })],
    },
  })
  expect(screen.getByText('Confirmed').classList.contains('text-success')).toBe(
    true,
  )
  expect(screen.getByRole('link', { name: 'Hotel' }).getAttribute('href')).toBe(
    '/trips/t1/book',
  )
})

it('lets read-only readers Tab into static content and out, and removes the target on minimise', async () => {
  const { update, props } = setup({ editable: false })
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2 }),
    ),
  )
  const body = screen.getByRole('group', { name: 'Day 1 · Tokyo' })
  expect(body.querySelector('button, a, input, textarea, select')).toBeNull()
  await userEvent.tab()
  await userEvent.tab()
  await userEvent.tab()
  expect(document.activeElement).toBe(body)
  await userEvent.tab()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Outside' }),
  )
  await userEvent.tab({ shift: true })
  expect(document.activeElement).toBe(body)
  await userEvent.keyboard('{Escape}')
  expect(props.onClose).toHaveBeenCalledOnce()
  update({ minimised: true })
  expect(screen.queryByRole('group', { name: 'Day 1 · Tokyo' })).toBeNull()
})
