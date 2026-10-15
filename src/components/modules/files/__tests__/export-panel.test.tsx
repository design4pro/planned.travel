import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'

import type { Catalogue } from '#/lib/i18n'
import type { TripExportList } from '#/server/fns/exports'

// The panel's modules import the server functions, which reach `cloudflare:workers`; the panel is
// tested at the module boundary, with the two functions it calls replaced.
const listTripExportsFn = vi.fn()
const downloadTripExportFn = vi.fn()
vi.mock('#/server/fns/exports', () => ({
  listTripExportsFn: (...args: Array<unknown>) => listTripExportsFn(...args),
  downloadTripExportFn: (...args: Array<unknown>) =>
    downloadTripExportFn(...args),
}))

const toastError = vi.fn()
vi.mock('#/components/ui', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  toast: { error: (...args: Array<unknown>) => toastError(...args) },
}))

const { ExportPanel } = await import('../export-panel')

const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}

const NOW = Date.parse('2026-10-15T12:00:00.000Z')

const TWO: TripExportList = {
  canRequest: true,
  artifacts: [
    {
      taskId: 'task-new',
      format: 'pdf',
      sizeBytes: 2048,
      createdAt: NOW - 60_000,
    },
    {
      taskId: 'task-old',
      format: 'html',
      sizeBytes: 512,
      createdAt: NOW - 86_400_000,
    },
  ],
}

function mount() {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <ExportPanel tripId="trip-1" />
    </I18nProvider>,
  )
}

function file(
  status: number,
  body: BodyInit | null,
  headers: HeadersInit = {},
) {
  return new Response(body, { status, headers })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:export'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  listTripExportsFn.mockReset()
  downloadTripExportFn.mockReset()
  toastError.mockReset()
})

describe('the export panel', () => {
  it('shows a skeleton while the list loads, then one row per export', async () => {
    let settle: (list: TripExportList) => void = () => {}
    listTripExportsFn.mockReturnValue(
      new Promise<TripExportList>((resolve) => {
        settle = resolve
      }),
    )

    mount()
    expect(screen.getByTestId('export-skeleton')).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)

    settle(TWO)
    const rows = await screen.findAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(screen.queryByTestId('export-skeleton')).toBeNull()
    expect(listTripExportsFn).toHaveBeenCalledWith({
      data: { tripId: 'trip-1' },
    })
    expect(rows[0]?.textContent).toContain('PDF file')
    expect(rows[0]?.textContent).toContain('2 KB')
    expect(rows[1]?.textContent).toContain('Printable page')
  })

  it('names each Download control after the artifact and its time', async () => {
    listTripExportsFn.mockResolvedValue(TWO)
    mount()
    await screen.findAllByRole('listitem')

    const [pdf, page] = screen.getAllByRole('button', { name: /^Download/u })

    expect(pdf?.getAttribute('aria-label')).toMatch(/^Download the PDF made /u)
    expect(page?.getAttribute('aria-label')).toMatch(
      /^Download the printable page made /u,
    )
    expect(pdf?.getAttribute('aria-label')).not.toBe(
      page?.getAttribute('aria-label'),
    )
  })

  it('tells two exports of the same format made on the same day apart by their time', async () => {
    listTripExportsFn.mockResolvedValue({
      canRequest: true,
      artifacts: [
        {
          taskId: 'task-b',
          format: 'pdf',
          sizeBytes: 10,
          createdAt: NOW - 60_000,
        },
        {
          taskId: 'task-a',
          format: 'pdf',
          sizeBytes: 10,
          createdAt: NOW - 3 * 60 * 60_000,
        },
      ],
    })
    mount()
    await screen.findAllByRole('listitem')

    const [later, earlier] = screen
      .getAllByRole('button', { name: /^Download/u })
      .map((button) => button.getAttribute('aria-label'))

    expect(later).not.toBe(earlier)
  })

  it('says there are no exports, and offers no request control', async () => {
    listTripExportsFn.mockResolvedValue({ artifacts: [], canRequest: true })
    mount()

    expect(await screen.findByText('No exports yet')).toBeTruthy()
    expect(screen.getByText(/Make a printable copy of the trip/u)).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('tells a viewer who can make one, not to make one', async () => {
    listTripExportsFn.mockResolvedValue({ artifacts: [], canRequest: false })
    mount()

    expect(
      await screen.findByText('An owner or editor of this trip can make one.'),
    ).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('says the list failed and retries from the button', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockRejectedValueOnce(new Error('boom'))
    mount()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('The list of exports did not load.')

    listTripExportsFn.mockResolvedValueOnce(TWO)
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('moves focus to the panel heading when the retry control goes away', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockRejectedValueOnce(new Error('boom'))
    mount()
    const retry = await screen.findByRole('button', { name: 'Try again' })
    listTripExportsFn.mockResolvedValue(TWO)
    await user.click(retry)

    await screen.findAllByRole('listitem')

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Export the trip' }),
    )
  })

  it('keeps one polite status region, empty until something is said', async () => {
    listTripExportsFn.mockResolvedValue(TWO)
    mount()
    await screen.findAllByRole('listitem')

    const regions = screen.getAllByRole('status')
    expect(regions).toHaveLength(1)
    expect(regions[0]?.getAttribute('aria-live')).toBe('polite')
    expect(regions[0]?.textContent).toBe('')
  })

  it('saves the file, re-typed so the markup never gets an object URL of its own type', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValue(TWO)
    downloadTripExportFn.mockResolvedValue(
      file(200, '<p>page</p>', {
        'content-type': 'text/html; charset=utf-8',
        'content-disposition':
          "attachment; filename*=UTF-8''Lisbon%20in%20spring-2026-10-14.html",
      }),
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('Lisbon in spring-2026-10-14.html')
      })
    mount()
    await screen.findAllByRole('listitem')

    await user.click(
      screen.getByRole('button', { name: /Download the printable page/u }),
    )

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(downloadTripExportFn).toHaveBeenCalledWith({
      data: { tripId: 'trip-1', taskId: 'task-old' },
    })
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0]
    expect(blob).toBeInstanceOf(Blob)
    expect((blob as Blob).type).toBe('application/octet-stream')
  })

  it('returns focus to the control that started the download', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValue(TWO)
    let finish: (response: Response) => void = () => {}
    downloadTripExportFn.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
    )
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mount()
    await screen.findAllByRole('listitem')
    const control = screen.getByRole('button', { name: /Download the PDF/u })

    await user.click(control)
    // Browsers drop focus from a control that turns disabled; jsdom does not (blur() on a disabled
    // button is a no-op), so park focus on a throwaway element and remove it.
    const parked = document.createElement('div')
    parked.tabIndex = -1
    document.body.appendChild(parked)
    parked.focus()
    parked.remove()
    expect(document.activeElement).toBe(document.body)
    finish(file(200, '%PDF'))

    await waitFor(() => expect(document.activeElement).toBe(control))
  })

  it('says a download has started in the status region, and clears it once saved', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValue(TWO)
    let finish: (response: Response) => void = () => {}
    downloadTripExportFn.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
    )
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mount()
    await screen.findAllByRole('listitem')

    await user.click(screen.getByRole('button', { name: /Download the PDF/u }))
    expect(screen.getByRole('status').textContent).toMatch(
      /^Downloading Trip export, 15 Oct 2026/u,
    )

    finish(file(200, '%PDF'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''))
  })

  it('shows only the title when the request itself fails', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValue(TWO)
    downloadTripExportFn.mockRejectedValue(new TypeError('Failed to fetch'))
    mount()
    await screen.findAllByRole('listitem')

    await user.click(screen.getByRole('button', { name: /Download the PDF/u }))

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    expect(toastError).toHaveBeenCalledWith(
      'The download did not start',
      undefined,
    )
  })

  it('shows a refusal the server authored', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValue(TWO)
    downloadTripExportFn.mockRejectedValue(
      new Error(
        encodePublicFailure({ kind: 'refusal', message: 'Sign in again.' }),
      ),
    )
    mount()
    await screen.findAllByRole('listitem')

    await user.click(screen.getByRole('button', { name: /Download the PDF/u }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('The download did not start', {
        description: 'Sign in again.',
      }),
    )
  })

  it('leaves focus where the reader moved it during the download', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValue(TWO)
    let finish: (response: Response) => void = () => {}
    downloadTripExportFn.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
    )
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mount()
    await screen.findAllByRole('listitem')

    await user.click(screen.getByRole('button', { name: /Download the PDF/u }))
    // The other row's control is disabled while the download is in flight, so the reader moves on
    // to something outside the panel.
    const elsewhere = document.createElement('div')
    elsewhere.tabIndex = -1
    document.body.appendChild(elsewhere)
    elsewhere.focus()
    finish(file(200, '%PDF'))

    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: /Download the PDF/u })
          .hasAttribute('disabled'),
      ).toBe(false),
    )
    expect(document.activeElement).toBe(elsewhere)
    elsewhere.remove()
  })

  it('says the export is gone on a 404, in the status region, and reads the list again', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValueOnce(TWO)
    downloadTripExportFn.mockResolvedValue(
      file(404, '{"error":"missing"}', { 'content-type': 'application/json' }),
    )
    mount()
    await screen.findAllByRole('listitem')
    listTripExportsFn.mockResolvedValueOnce({
      canRequest: true,
      artifacts: [TWO.artifacts[1]],
    })

    await user.click(screen.getByRole('button', { name: /Download the PDF/u }))

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'That export is no longer kept. Export the trip again.',
      ),
    )
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
    expect(listTripExportsFn).toHaveBeenCalledTimes(2)
  })

  it('puts focus on the heading when the export that was downloaded is gone from the list', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValueOnce(TWO)
    downloadTripExportFn.mockResolvedValue(file(404, '{"error":"missing"}'))
    mount()
    await screen.findAllByRole('listitem')
    listTripExportsFn.mockResolvedValueOnce({
      canRequest: true,
      artifacts: [TWO.artifacts[1]],
    })
    const control = screen.getByRole('button', { name: /Download the PDF/u })

    await user.click(control)
    control.blur()

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Export the trip' }),
      ),
    )
  })

  it('keeps the rows it has when the re-read after a 404 fails', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValueOnce(TWO)
    downloadTripExportFn.mockResolvedValue(file(404, '{"error":"missing"}'))
    mount()
    await screen.findAllByRole('listitem')
    listTripExportsFn.mockRejectedValueOnce(new Error('offline'))

    await user.click(screen.getByRole('button', { name: /Download the PDF/u }))

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'no longer kept',
      ),
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('words the 404 for a viewer without telling them to export again', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValue({ ...TWO, canRequest: false })
    downloadTripExportFn.mockResolvedValue(file(404, '{"error":"missing"}'))
    mount()
    await screen.findAllByRole('listitem')

    await user.click(screen.getByRole('button', { name: /Download the PDF/u }))

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'That export is no longer kept.',
      ),
    )
  })

  it('disables the control while its download is in flight', async () => {
    const user = userEvent.setup()
    listTripExportsFn.mockResolvedValue(TWO)
    let finish: (response: Response) => void = () => {}
    downloadTripExportFn.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
    )
    mount()
    await screen.findAllByRole('listitem')
    const control = screen.getByRole('button', { name: /Download the PDF/u })

    await user.click(control)
    expect((control as HTMLButtonElement).disabled).toBe(true)

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    finish(file(200, '%PDF'))
    await waitFor(() =>
      expect((control as HTMLButtonElement).disabled).toBe(false),
    )
  })
})
