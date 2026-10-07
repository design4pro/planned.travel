// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { bookImportsKey, readBookImports } from '../import-widget'
import { ImportBookingsDialog } from '../import-dialog'

import type { Catalogue } from '#/lib/i18n'
import type { BookingImportView } from '#/server/fns/booking-import'

/**
 * The three refusals this feature designed rather than surfaced are the three things worth
 * rendering: a format the import cannot read is named *at the boundary* with the list that works,
 * a confirm with nothing selected says why it is disabled instead of just being grey, and the drop
 * target is reachable without a mouse.
 *
 * The catalogue is the shipped English one. Stubbing it would defeat the point twice over: an
 * unresolved key and an un-interpolated placeholder both look like a pass when every message is
 * its own key.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

const stubs = vi.hoisted(() => ({
  view: vi.fn(),
  start: vi.fn(),
  confirm: vi.fn(),
  upload: vi.fn(),
  router: { invalidate: vi.fn() },
}))

/** The real module reads the Worker environment through the request scope, which jsdom has none of. */
vi.mock('#/server/fns/booking-import', () => ({
  getBookingImportFn: stubs.view,
  startBookingImportFn: stubs.start,
  confirmBookingImportFn: stubs.confirm,
}))
vi.mock('../../files/upload', () => ({ uploadFile: stubs.upload }))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => stubs.router,
  useNavigate: () => vi.fn(),
}))

/** The account every job in this file belongs to — the register is keyed by it. */
const USER = 'user-1'

function open(): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <ImportBookingsDialog
        tripId="trip-1"
        userId={USER}
        open
        onOpenChange={() => {}}
      />
    </I18nProvider>,
  )
}

function dropTarget(): HTMLElement {
  const target = document.querySelector('[data-part="import-drop"]')
  if (!(target instanceof HTMLElement)) {
    throw new Error('the import dialog rendered no drop target')
  }
  return target
}

function drop(...files: ReadonlyArray<File>): void {
  fireEvent.drop(dropTarget(), { dataTransfer: { files } })
}

/** One file read to two rows — at module scope because the refusal tests pair it with a refusal. */
const READY: BookingImportView = {
  status: 'ready',
  staged: {
    format: 'document',
    count: 2,
    written: [],
    drafts: [
      {
        index: 0,
        type: 'accommodation',
        title: 'Hotel Okura',
        location: 'Tokyo',
        reference: 'ABC123',
        startDate: '2026-04-02',
        startTime: '15:00',
        endDate: '2026-04-05',
        endTime: '11:00',
        priceMinor: 48_000,
        currency: 'JPY',
        needsReview: false,
      },
      {
        index: 1,
        type: 'transport',
        title: '',
        location: null,
        reference: null,
        startDate: '2026-04-02',
        startTime: null,
        endDate: null,
        endTime: null,
        priceMinor: null,
        currency: null,
        needsReview: true,
      },
    ],
  },
}

beforeEach(() => {
  window.localStorage.clear()
  stubs.view.mockReset()
  stubs.start.mockReset()
  stubs.confirm.mockReset()
  stubs.upload.mockReset()
  stubs.view.mockResolvedValue({
    status: 'working',
  } satisfies BookingImportView)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the import dialog at its boundary', () => {
  it('names the file it cannot read and lists the formats it can', () => {
    open()

    drop(
      new File(['x'], 'voucher.pkpass', { type: 'application/octet-stream' }),
    )

    const refusal = screen.getByText(/voucher\.pkpass/)
    expect(refusal.textContent).toContain('is not a file this import can read')
    expect(refusal.textContent).toContain('JSON export')
    // Refused at the boundary means refused before a byte leaves the machine.
    expect(stubs.upload).not.toHaveBeenCalled()
    expect(stubs.start).not.toHaveBeenCalled()
  })

  it('names the size of a file too large to read, and the limit', () => {
    open()

    const big = new File(['x'], 'scan.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 9 * 1024 * 1024 })
    drop(big)

    expect(screen.getByText(/scan\.pdf/).textContent).toContain(
      'An import reads files up to 5 MB',
    )
    expect(stubs.upload).not.toHaveBeenCalled()
  })

  it('refuses a file with no bytes in it rather than reading nothing', () => {
    open()

    drop(new File([], 'empty.ics', { type: 'text/calendar' }))

    expect(screen.getByText(/empty\.ics/).textContent).toContain(
      'is empty, so there is nothing to read',
    )
    expect(stubs.upload).not.toHaveBeenCalled()
  })

  it('says only five at a time and keeps the first five', async () => {
    stubs.upload.mockResolvedValue({ ok: true, file: { id: 'file-1' } })
    stubs.start.mockResolvedValue({ jobId: 'booking-import:trip-1:file-1' })
    open()

    drop(
      ...Array.from(
        { length: 6 },
        (_, index) =>
          new File(['x'], `booking-${index}.ics`, { type: 'text/calendar' }),
      ),
    )

    expect(
      screen.getByText('Only 5 files at a time. The rest were not added.'),
    ).toBeTruthy()
    await vi.waitFor(() => {
      expect(stubs.upload).toHaveBeenCalledTimes(5)
    })
  })

  it('keeps the jobs it already started when a later file fails to upload', async () => {
    stubs.upload
      .mockResolvedValueOnce({ ok: true, file: { id: 'file-1' } })
      .mockResolvedValueOnce({ ok: false })
    stubs.start.mockResolvedValue({ jobId: 'booking-import:trip-1:file-1' })
    open()

    drop(
      new File(['x'], 'first.ics', { type: 'text/calendar' }),
      new File(['x'], 'second.ics', { type: 'text/calendar' }),
    )

    expect(await screen.findByText('“second.ics” did not upload')).toBeTruthy()
    // The first file's reading is already enqueued and has spent the workspace's allowance. A
    // register written only after the whole drop succeeded would leave it running and unreachable.
    expect(readBookImports(USER)).toEqual([
      {
        jobId: 'booking-import:trip-1:file-1',
        tripId: 'trip-1',
        filename: 'first.ics',
        delayMs: 0,
      },
    ])
  })

  it('writes each file’s queue stagger into the register', async () => {
    stubs.upload
      .mockResolvedValueOnce({ ok: true, file: { id: 'file-1' } })
      .mockResolvedValueOnce({ ok: true, file: { id: 'file-2' } })
    // The delay is the server's to state: the dialog writes what the start answer says.
    stubs.start
      .mockResolvedValueOnce({
        jobId: 'booking-import:trip-1:file-1',
        delaySeconds: 0,
      })
      .mockResolvedValueOnce({
        jobId: 'booking-import:trip-1:file-2',
        delaySeconds: 20,
      })
    open()

    drop(
      new File(['x'], 'first.ics', { type: 'text/calendar' }),
      new File(['x'], 'second.ics', { type: 'text/calendar' }),
    )

    // Without this the widget counts its stall budget from the drop, and the second file — which
    // the queue is told to hold for twenty seconds — is called stalled before it can have started.
    await vi.waitFor(() => {
      expect(readBookImports(USER).map((job) => job.delayMs)).toEqual([
        0, 20_000,
      ])
    })
  })
})

describe('the import dialog’s controls', () => {
  it('disables the confirm with a reason while nothing is selected', () => {
    open()

    const confirm = screen.getByRole('button', {
      name: 'Select a booking to add',
    })
    expect(confirm).toHaveProperty('disabled', true)
    expect(confirm.getAttribute('title')).toBe('Select a booking to add')
  })

  it('makes the drop target a real button that opens the file input', () => {
    open()

    const target = dropTarget()
    expect(target.tagName).toBe('BUTTON')
    // Not `tabIndex="-1"`: the whole point of the button is that a reader who cannot drag can
    // still reach it, and Enter and Space on a button dispatch the click fired below.
    expect(target.getAttribute('tabindex')).toBeNull()

    const input = document.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('the import dialog rendered no file input')
    }
    expect(input.accept).toContain('.pdf')
    expect(input.multiple).toBe(true)

    const clicked = vi.spyOn(input, 'click')
    fireEvent.click(target)
    expect(clicked).toHaveBeenCalledTimes(1)
  })
})

describe('the import dialog on a staged answer', () => {
  beforeEach(() => {
    window.localStorage.setItem(
      bookImportsKey(USER),
      JSON.stringify([
        {
          jobId: 'booking-import:trip-1:file-1',
          tripId: 'trip-1',
          filename: 'confirmation.pdf',
        },
      ]),
    )
    stubs.view.mockResolvedValue(READY)
  })

  /*
   * The regression this guards: the poll stops asking about a job the moment it answers anything
   * but `working`, so a partial confirm left the review list rendering the answer from before it —
   * both rows still listed, both still ticked, the one just written among them. "Add the rest" then
   * re-sent an index the server had already written. It was deduped there, so nothing was written
   * twice; what the reader lost was any way to tell which row was actually still failing.
   */
  it('re-reads the staged rows after a partial confirm, so a written row stops being offered', async () => {
    stubs.view.mockResolvedValueOnce(READY).mockResolvedValue({
      ...READY,
      staged: { ...READY.staged!, written: [0] },
    } satisfies BookingImportView)
    stubs.confirm.mockResolvedValue({ written: 1, failed: 1, remaining: 1 })
    open()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Add 2 bookings' }),
    )

    // The partial alert, and then the list re-read behind it: one row left, and it is the one that
    // did not go in.
    expect(await screen.findByText('1 of 2 bookings were added')).toBeTruthy()
    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: /Hotel Okura/ })).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Add the rest' })).toBeTruthy()
  })

  it('offers every row selected, counted in the confirm', async () => {
    open()

    const confirm = await screen.findByRole('button', {
      name: 'Add 2 bookings',
    })
    expect(confirm).toHaveProperty('disabled', false)
  })

  it('takes a deselected row out of the count and nothing else out', async () => {
    open()
    await screen.findByRole('button', { name: 'Add 2 bookings' })

    fireEvent.click(screen.getByRole('checkbox', { name: /Hotel Okura/ }))

    expect(
      await screen.findByRole('button', { name: 'Add 1 booking' }),
    ).toBeTruthy()
    expect(screen.getByText('Untitled booking')).toBeTruthy()
  })

  it('marks a partially read row and a row with no price before it is written', async () => {
    open()
    await screen.findByRole('button', { name: 'Add 2 bookings' })

    expect(screen.getByText('Needs a look')).toBeTruthy()
    expect(screen.getByText('No price read')).toBeTruthy()
  })

  it('names the row the document left untitled rather than rendering a gap', async () => {
    open()

    expect(await screen.findByText('Untitled booking')).toBeTruthy()
  })

  it('gives every row of every file its own control, so one label ticks one row', async () => {
    window.localStorage.setItem(
      bookImportsKey(USER),
      JSON.stringify([
        {
          jobId: 'booking-import:trip-1:file-1',
          tripId: 'trip-1',
          filename: 'first.pdf',
        },
        {
          jobId: 'booking-import:trip-1:file-2',
          tripId: 'trip-1',
          filename: 'second.pdf',
        },
      ]),
    )
    open()
    await screen.findByRole('button', { name: 'Add 4 bookings' })

    // A reader can drop five files at once and every file numbers its rows from zero, so an id
    // built from the index alone repeats — and a `<label for>` then ticks the first row that
    // answers to it rather than the one under the pointer.
    const ids = [...document.querySelectorAll('[role="checkbox"]')].map(
      (control) => control.id,
    )
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)

    const labels = [...document.querySelectorAll('label[for]')].map((label) =>
      label.getAttribute('for'),
    )
    expect(new Set(labels)).toEqual(new Set(ids))
  })
})

describe('the import dialog on a refusal', () => {
  beforeEach(() => {
    window.localStorage.setItem(
      bookImportsKey(USER),
      JSON.stringify([
        {
          jobId: 'booking-import:trip-1:file-1',
          tripId: 'trip-1',
          filename: 'confirmation.pdf',
        },
      ]),
    )
  })

  it('words the ceiling as a spent allowance, with the number in the plan', async () => {
    stubs.view.mockResolvedValue({
      status: 'refused',
      refusal: { code: 'ceiling', ceiling: 200 },
    } satisfies BookingImportView)
    open()

    expect(
      await screen.findByText(
        'This workspace has read all its confirmations this month',
      ),
    ).toBeTruthy()
    expect(screen.getByText(/200 file readings a month/)).toBeTruthy()
  })

  it('words a plan with no allowance at all as a different thing', async () => {
    stubs.view.mockResolvedValue({
      status: 'refused',
      refusal: { code: 'ceiling', ceiling: 0 },
    } satisfies BookingImportView)
    open()

    expect(
      await screen.findByText(
        'Reading a confirmation file is not part of this workspace’s plan',
      ),
    ).toBeTruthy()
  })

  it('names the file a parse found nothing in, and offers another', async () => {
    stubs.view.mockResolvedValue({
      status: 'refused',
      refusal: { code: 'empty' },
    } satisfies BookingImportView)
    open()

    expect(
      await screen.findByText('We could not find a booking in that file'),
    ).toBeTruthy()
    expect(screen.getByText(/confirmation\.pdf/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Try another file' }),
    ).toBeTruthy()
  })

  it('takes only the refusal out of the register when a reader asks for another file', async () => {
    // The regression this guards: “Try another file” forgot every job that was not still
    // `working`, so a second file that had already been read — billed to the workspace, staged in
    // KV, waiting to be reviewed — lost the only handle there was on its id.
    window.localStorage.setItem(
      bookImportsKey(USER),
      JSON.stringify([
        {
          jobId: 'booking-import:trip-1:file-1',
          tripId: 'trip-1',
          filename: 'confirmation.pdf',
        },
        {
          jobId: 'booking-import:trip-1:file-2',
          tripId: 'trip-1',
          filename: 'second.pdf',
        },
      ]),
    )
    stubs.view.mockImplementation(
      ({ data }: { data: { jobId: string } }): Promise<BookingImportView> =>
        Promise.resolve(
          data.jobId.endsWith('file-1')
            ? { status: 'refused', refusal: { code: 'unreadable' } }
            : READY,
        ),
    )
    open()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Try another file' }),
    )

    expect(readBookImports(USER).map((job) => job.jobId)).toEqual([
      'booking-import:trip-1:file-2',
    ])
    // And the rows of the file that stayed are still ticked: nothing with rows in it was
    // forgotten, so there was nothing to clear — and no later answer to put them back.
    expect(screen.getByRole('button', { name: 'Add 2 bookings' })).toBeTruthy()
  })

  it('never forwards a server sentence for a file it could not read', async () => {
    stubs.view.mockResolvedValue({
      status: 'refused',
      refusal: { code: 'unreadable' },
    } satisfies BookingImportView)
    open()

    expect(
      await screen.findByText(/confirmation\.pdf” could not be read/),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'The file opened but nothing could be made of it. Try another file, or add the booking by hand.',
      ),
    ).toBeTruthy()
  })
})
