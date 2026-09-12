// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render as mount, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { TransportRow } from '../transport-row'

import type { PlannerTransport } from '../types'

/**
 * The journey row, mounted for real.
 *
 * `useSortable` needs a `DndContext` above it and `useTranslate` throws rather than quietly
 * rendering English, so every case here sits under both — which means these assertions are on
 * the shipped words, not on a key.
 */
const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      <DndContext>
        <ul>{ui}</ul>
      </DndContext>
    </I18nProvider>,
  )
}

const departing: PlannerTransport = {
  itemId: 'leg:transport:d1:t1',
  kind: 'transport',
  id: 't1',
  dayId: 'd1',
  part: 'departing',
  phase: 'trips.plan.transport.phase.flight.departing',
  mode: 'flight',
  status: 'confirmed',
  serviceNumber: 'NH 111',
  fromName: 'Tokyo',
  toName: 'Kyoto',
  time: '09:00',
  price: '¥13,320',
  position: 1.5,
}

describe('a journey row', () => {
  it('gives the departing row a drag handle named after the journey', () => {
    render(<TransportRow transport={departing} position={0} draggable />)

    expect(
      screen.getByRole('button', { name: 'Tokyo to Kyoto' }),
    ).toBeTruthy()
  })

  it('gives the travelling row no handle, and its phase in words', () => {
    render(
      <TransportRow
        transport={{
          ...departing,
          itemId: 'leg:transport:d2:t1',
          dayId: 'd2',
          part: 'travelling',
          phase: 'trips.plan.transport.phase.flight.travelling',
          time: null,
        }}
        position={0}
        draggable
      />,
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('In the air')).toBeTruthy()
    expect(screen.getByText('Tokyo to Kyoto')).toBeTruthy()
  })

  it('shows no handle on a trip nobody may write to', () => {
    render(<TransportRow transport={departing} position={0} />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the clock, the service number, the status and the fare', () => {
    render(<TransportRow transport={departing} position={0} draggable />)

    expect(screen.getByText('09:00')).toBeTruthy()
    expect(screen.getByText('NH 111')).toBeTruthy()
    expect(screen.getByText('Confirmed')).toBeTruthy()
    expect(screen.getByText('¥13,320')).toBeTruthy()
  })

  it('leaves a journey nobody has booked yet without a status pill', () => {
    render(
      <TransportRow
        transport={{ ...departing, status: 'idea', phase: null }}
        position={0}
        draggable
      />,
    )

    expect(screen.queryByText('Idea')).toBeNull()
  })

  it('names a journey with one endpoint by that endpoint, and one with none by its mode', () => {
    const { unmount } = render(
      <TransportRow
        transport={{ ...departing, toName: null }}
        position={0}
        draggable
      />,
    )
    expect(screen.getByRole('button', { name: 'Tokyo' })).toBeTruthy()
    unmount()

    render(
      <TransportRow
        transport={{ ...departing, fromName: null, toName: null }}
        position={0}
        draggable
      />,
    )
    expect(screen.getByRole('button', { name: 'Flight' })).toBeTruthy()
  })

  it('marks itself for the screen and for the board', () => {
    const { container } = render(
      <TransportRow transport={departing} position={0} draggable />,
    )
    const row = container.querySelector('[data-part="planner-transport-row"]')

    expect(row).not.toBeNull()
    expect(row?.getAttribute('data-planner-item')).toBe('leg:transport:d1:t1')
  })
})
