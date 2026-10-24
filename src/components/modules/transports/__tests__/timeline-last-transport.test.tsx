import '#/components/ui/__tests__/test-env'
import { useRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { TransportsTimeline } from '../transports-timeline'
import type { TransportData } from '../types'

// The dialog is replaced by one that remembers which instance it is: the draft and the gone state
// live in the real one, so what must hold is that the same instance survives the list going empty.
const mounts = vi.hoisted(() => ({ next: 0 }))
vi.mock('#/server/fns/transports', () => ({
  loadTransportDeskFn: vi.fn(),
  deleteTransportFn: vi.fn(),
  setTransportStatusFn: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))
vi.mock('../leg-dialog', () => ({
  TransportDialog: ({
    open,
    transport,
    onOpenChange,
  }: {
    open: boolean
    transport?: TransportData
    onOpenChange: (open: boolean) => void
  }) => {
    const instance = useRef(++mounts.next)
    return open ? (
      <div role="dialog" data-instance={instance.current}>
        Editing {transport?.title ?? 'nothing'}
        <button onClick={() => onOpenChange(false)}>Close dialog</button>
      </div>
    ) : null
  },
}))

afterEach(cleanup)
const messages = await loadCatalogue('en')
const transport: TransportData = {
  id: 'train',
  title: 'Osaka to Tokyo',
  mode: 'train',
  status: 'confirmed',
  carrier: null,
  serviceNumber: null,
  bookingCode: null,
  seat: null,
  departureDayId: null,
  arrivalDayId: null,
  departureName: 'Osaka',
  departureCode: null,
  departureDate: null,
  departureTime: null,
  arrivalName: 'Tokyo',
  arrivalCode: null,
  arrivalDate: null,
  arrivalTime: null,
  distanceMetres: null,
  priceMinor: null,
  currency: null,
  notes: null,
  legs: [],
}

function timeline(transports: ReadonlyArray<TransportData>) {
  return (
    <I18nProvider locale="en" messages={messages}>
      <TransportsTimeline
        tripId="trip"
        transports={transports}
        days={[]}
        currency="JPY"
        maskCodes={false}
        canSearchConnections={true}
        canWrite={true}
        isArchived={false}
        newTransportOpen={false}
        onNewTransportOpenChange={vi.fn()}
      />
    </I18nProvider>
  )
}

function openEditor(): void {
  const trigger = screen.getByRole('button', {
    name: 'Actions for Osaka to Tokyo',
  })
  fireEvent.keyDown(trigger, { key: 'Enter' })
  fireEvent.click(screen.getByRole('menuitem', { name: /Edit transport/ }))
}

it('keeps the edit dialog, and its state, when the transport under it was the last one and is gone', () => {
  const view = render(timeline([transport]))
  openEditor()
  const before = screen.getByRole('dialog').getAttribute('data-instance')

  // The loaders re-run after the refusal and the list comes back empty.
  view.rerender(timeline([]))

  const dialog = screen.getByRole('dialog')
  expect(dialog.getAttribute('data-instance')).toBe(before)
  expect(dialog.textContent).toContain('Editing Osaka to Tokyo')
  // Nothing behind it claims a filter hides the transports.
  expect(screen.queryByText(/Show all/i)).toBeNull()
})

it('shows the empty state once the dialog is closed, and does not reopen the edit on a later transport', () => {
  const view = render(timeline([transport]))
  openEditor()
  view.rerender(timeline([]))

  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
  expect(screen.queryByRole('dialog')).toBeNull()

  view.rerender(timeline([{ ...transport, id: 'another', title: 'Another' }]))
  expect(screen.queryByRole('dialog')).toBeNull()
})
