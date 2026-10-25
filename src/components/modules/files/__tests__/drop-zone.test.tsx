// The library mounts Radix-backed primitives, which need the pointer-capture and scroll stubs jsdom
// does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import type { FileData } from '../types'
import { FileLibrary } from '../file-library'

import type { Catalogue } from '#/lib/i18n'

/**
 * The drop zone is what a traveller sees react while a drag is in flight, so the tests drive it the
 * way a browser does: `dragenter` on the zone, then on a child as the pointer crosses onto it, then
 * `dragleave` with a child as its target. The catalogue is the shipped English one, so the text the
 * zone shows is the text a traveller reads.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

const stubs = vi.hoisted(() => ({
  router: { invalidate: vi.fn() },
  upload: vi.fn(),
}))

/** The real module reads the Worker environment through the request scope, which jsdom has none of. */
vi.mock('#/server/fns/files', () => ({ deleteTripFileFn: vi.fn() }))
vi.mock('../download', () => ({ downloadTripFile: vi.fn() }))
vi.mock('../upload', () => ({ uploadFile: stubs.upload }))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => stubs.router,
  useNavigate: () => vi.fn(),
}))

const FILES_DRAG = { dataTransfer: { types: ['Files'], files: [] } }
const TEXT_DRAG = { dataTransfer: { types: ['text/plain'], files: [] } }

function renderLibrary(
  canWrite = true,
  files: ReadonlyArray<FileData> = [],
  archived = false,
): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <FileLibrary
        canWrite={canWrite}
        archived={archived}
        tripId="trip-1"
        files={files}
        people={[]}
        workspaceBytes={0}
        limitBytes={1_000_000_000}
        pickRequestedAt={0}
      />
    </I18nProvider>,
  )
}

function open(): HTMLElement {
  renderLibrary()
  const zone = document.querySelector('[data-part="file-drop"]')
  if (!(zone instanceof HTMLElement)) {
    throw new Error('the files screen rendered no drop zone')
  }
  return zone
}

function stateOf(zone: HTMLElement): string | null {
  return zone.getAttribute('data-state')
}

function overlayOf(zone: HTMLElement): Element {
  const overlay = zone.querySelector('[data-part="file-drop-overlay"]')
  if (overlay === null) {
    throw new Error('the drop zone rendered no overlay')
  }
  return overlay
}

afterEach(cleanup)

describe('the drop zone', () => {
  it('rests idle, with its overlay hidden from assistive technology and from the pointer', () => {
    const zone = open()

    expect(stateOf(zone)).toBe('idle')
    const overlay = overlayOf(zone)
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    expect(overlay.classList.contains('pointer-events-none')).toBe(true)
    expect(overlay.classList.contains('opacity-0')).toBe(true)
  })

  it('stays idle for a drag of selected text', () => {
    const zone = open()

    fireEvent.dragEnter(zone, TEXT_DRAG)
    fireEvent.dragOver(zone, TEXT_DRAG)
    fireEvent.dragLeave(zone, TEXT_DRAG)

    expect(stateOf(zone)).toBe('idle')
    expect(screen.queryByText('Drop to upload')).toBeNull()
  })

  it('turns active for a drag that carries files, and says so', () => {
    const zone = open()

    fireEvent.dragEnter(zone, FILES_DRAG)

    expect(stateOf(zone)).toBe('active')
    expect(screen.getByText('Drop to upload')).toBeTruthy()
    expect(overlayOf(zone).classList.contains('opacity-100')).toBe(true)
  })

  it('stays active while the pointer crosses onto a child element', () => {
    const zone = open()
    const button = screen.getByRole('button', { name: 'Choose files' })

    // What a browser sends when the pointer moves from the zone onto its button: the button is
    // entered first, then the zone is left, and the leave names the zone as its target.
    fireEvent.dragEnter(zone, FILES_DRAG)
    fireEvent.dragEnter(button, FILES_DRAG)
    fireEvent.dragLeave(zone, FILES_DRAG)
    expect(stateOf(zone)).toBe('active')

    // The pointer moves back off the button onto the zone: the zone is entered, then the button is
    // left, and the leave names the child as its target. Ends on the leave, so the zone is active
    // only because the count did not reach zero.
    fireEvent.dragEnter(zone, FILES_DRAG)
    fireEvent.dragLeave(button, FILES_DRAG)
    expect(stateOf(zone)).toBe('active')
  })

  it('goes idle when the drag leaves the zone altogether', () => {
    const zone = open()
    const button = screen.getByRole('button', { name: 'Choose files' })

    fireEvent.dragEnter(zone, FILES_DRAG)
    fireEvent.dragEnter(button, FILES_DRAG)
    fireEvent.dragLeave(zone, FILES_DRAG)
    fireEvent.dragLeave(button, FILES_DRAG)

    expect(stateOf(zone)).toBe('idle')
  })

  it('clears on drop, even when the pointer was over a child', () => {
    const zone = open()
    const button = screen.getByRole('button', { name: 'Choose files' })

    fireEvent.dragEnter(zone, FILES_DRAG)
    fireEvent.dragEnter(button, FILES_DRAG)
    fireEvent.drop(button, FILES_DRAG)

    expect(stateOf(zone)).toBe('idle')

    // A later drag starts from nothing, not from the depth the last one left behind.
    fireEvent.dragEnter(zone, FILES_DRAG)
    fireEvent.dragLeave(zone, FILES_DRAG)
    expect(stateOf(zone)).toBe('idle')
  })
})

it('says the trip is archived, not that the role is short, to a reader of an archived trip', () => {
  renderLibrary(false, [], true)
  expect(
    screen.getByText(
      'This trip is archived, so its files are read-only. You can still download them. Restore the trip to change them.',
    ),
  ).toBeTruthy()
  expect(screen.queryByText(/Only trip owners and editors/)).toBeNull()
  expect(document.querySelector('[data-part="file-drop"]')).toBeNull()
})

it('a reader has no upload surface or paste listener', () => {
  renderLibrary(false)
  expect(document.querySelector('[data-part="file-drop"]')).toBeNull()
  expect(document.querySelector('input[type="file"]')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Choose files' })).toBeNull()
  expect(
    screen.getByText(
      'Only trip owners and editors can upload, rename or delete files. You can still download them.',
    ),
  ).toBeTruthy()
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      items: [
        {
          kind: 'file',
          getAsFile: () =>
            new File(['bytes'], 'ticket.pdf', { type: 'application/pdf' }),
        },
      ],
    },
  })
  fireEvent(document, event)
  expect(event.defaultPrevented).toBe(false)
  expect(stubs.upload).not.toHaveBeenCalled()
})

it.each([false, true])(
  'file actions follow write permission %s and retain download',
  async (canWrite) => {
    renderLibrary(canWrite, [
      {
        id: 'file-1',
        filename: 'ticket.pdf',
        contentType: 'application/pdf',
        sizeBytes: 5,
        kind: 'ticket',
        description: null,
        uploadedBy: 'owner',
        createdAt: '2026-10-19T00:00:00Z',
      },
    ])
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Actions for ticket.pdf' }),
      { button: 0, ctrlKey: false, pointerType: 'mouse' },
    )
    expect(
      await screen.findByRole('menuitem', { name: /Download/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /Rename/ }) !== null).toBe(
      canWrite,
    )
    expect(screen.queryByRole('menuitem', { name: /Remove/ }) !== null).toBe(
      canWrite,
    )
  },
)
