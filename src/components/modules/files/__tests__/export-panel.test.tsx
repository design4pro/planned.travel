import { EXPORT_KEEP_COUNT } from '#/server/storage/export-artifacts'
import '#/components/ui/__tests__/test-env'

import { Profiler } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  fireEvent,
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
import ArabicModules from '#/lib/i18n/messages/ar/modules'

import type { Catalogue } from '#/lib/i18n'
import type { TripExportList } from '#/server/fns/exports'

// The panel's modules import the server functions, which reach `cloudflare:workers`; the panel is
// tested at the module boundary, with the two functions it calls replaced.
const requestTripExportFn = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))
const listTripExportsFn = vi.fn()
const downloadTripExportFn = vi.fn()
vi.mock('#/server/fns/exports', () => ({
  requestTripExportFn: (...args: Array<unknown>) =>
    requestTripExportFn(...args),
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
  allowance: { used: 0, limit: 3, month: '2026-10', resetsOn: '2026-11-01' },
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

function mount(onCommit: () => void = () => {}, exportId?: string) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <Profiler id="export-panel" onRender={onCommit}>
        <ExportPanel tripId="trip-1" exportId={exportId} />
      </Profiler>
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
  window.sessionStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
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
  requestTripExportFn.mockReset()
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

  it('offers exactly one request control and the confirmation option in the empty state', async () => {
    listTripExportsFn.mockResolvedValue({ artifacts: [], canRequest: true })
    mount()

    expect(await screen.findByText('No exports yet')).toBeTruthy()
    expect(screen.getByText(/Make a printable copy of the trip/u)).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Export the trip' }),
    ).toHaveLength(1)
    expect(
      screen
        .getByRole('checkbox', { name: 'Include confirmation codes' })
        .getAttribute('aria-checked'),
    ).toBe('false')
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

describe('requesting an export', () => {
  it('sends options, focuses the pending row and keeps one live region', async () => {
    listTripExportsFn.mockResolvedValue(TWO)
    requestTripExportFn.mockResolvedValue({
      ok: true,
      taskId: 'pending-1',
      queuedAt: NOW,
    })
    mount()
    const button = await screen.findByRole('button', {
      name: 'Export the trip',
    })
    const user = userEvent.setup()
    const checkbox = screen.getByRole('checkbox', {
      name: 'Include confirmation codes',
    })
    checkbox.focus()
    await user.keyboard(' ')
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
    await user.click(button)
    expect(requestTripExportFn).toHaveBeenCalledWith({
      data: { tripId: 'trip-1', notify: false, includeReferences: true },
    })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(document.activeElement?.textContent).toContain(
      'Preparing your export',
    )
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })
  it('returns quota refusal as an alert without a pending row', async () => {
    listTripExportsFn.mockResolvedValue(TWO)
    requestTripExportFn.mockResolvedValue({
      ok: false,
      reason: 'quota',
      used: 3,
      limit: 3,
      resetsOn: '2026-11-01',
    })
    mount()
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Export the trip' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      '3 exports',
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('following the queue result', () => {
  async function start(onCommit?: () => void) {
    listTripExportsFn.mockResolvedValue(TWO)
    requestTripExportFn.mockResolvedValue({
      ok: true,
      taskId: 'pending-1',
      queuedAt: NOW,
    })
    mount(onCommit)
    const button = await screen.findByRole('button', {
      name: 'Export the trip',
    })
    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(button)
    })
    return { button }
  }

  it('keeps rows on a failed poll and settles once with focus restored', async () => {
    const committedCounts: Array<number> = []
    const { button } = await start(() =>
      committedCounts.push(screen.queryAllByRole('listitem').length),
    )
    listTripExportsFn.mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(button.hasAttribute('disabled')).toBe(true)
    listTripExportsFn.mockResolvedValue({
      ...TWO,
      artifacts: [
        { taskId: 'pending-1', format: 'html', sizeBytes: 100, createdAt: NOW },
        ...TWO.artifacts,
      ],
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(screen.getByRole('status').textContent).toBe('Your export is ready')
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(document.activeElement).toBe(button)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(committedCounts).not.toContain(4)
    const calls = listTripExportsFn.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000)
    })
    expect(listTripExportsFn).toHaveBeenCalledTimes(calls)
  })

  it('pauses hidden tabs, resumes a fresh window, then enables another request', async () => {
    const { button } = await start()
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    visibility.mockReturnValue('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    const calls = listTripExportsFn.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100_000)
    })
    expect(listTripExportsFn).toHaveBeenCalledTimes(calls)
    visibility.mockReturnValue('visible')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(89_999)
    })
    expect(button.hasAttribute('disabled')).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('status').textContent).toContain(
      'longer than usual',
    )
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
    expect(document.activeElement).toBe(button)
    const stopped = listTripExportsFn.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(listTripExportsFn).toHaveBeenCalledTimes(stopped)
    visibility.mockRestore()
  })

  it('preserves focus when the traveller moved elsewhere and shows request failures', async () => {
    const { button } = await start()
    const checkbox = screen.getByRole('checkbox', {
      name: 'Include confirmation codes',
    })
    checkbox.focus()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000)
    })
    expect(document.activeElement).toBe(checkbox)
    requestTripExportFn.mockRejectedValue(new Error('unavailable'))
    await act(async () => {
      fireEvent.click(button)
    })
    expect(toastError).toHaveBeenCalledWith(
      'The export was not started',
      expect.anything(),
    )
    expect(button.hasAttribute('disabled')).toBe(false)
  })
})

it('restores focus after a request rejects once the native button has re-enabled', async () => {
  listTripExportsFn.mockResolvedValue(TWO)
  let reject: (cause: Error) => void = () => {}
  requestTripExportFn.mockReturnValue(
    new Promise((_resolve, no) => {
      reject = no
    }),
  )
  mount()
  const button = await screen.findByRole('button', { name: 'Export the trip' })
  await userEvent.setup().click(button)
  expect(button.hasAttribute('disabled')).toBe(true)
  // Chromium moves focus to body when the native request control becomes disabled.
  document.body.tabIndex = -1
  document.body.focus()
  await act(async () => {
    reject(new Error('offline'))
  })
  expect(button.hasAttribute('disabled')).toBe(false)
  expect(document.activeElement).toBe(button)
  document.body.removeAttribute('tabindex')
})

it('links the exhausted allowance to the disabled button without an alert', async () => {
  listTripExportsFn.mockResolvedValue({
    ...TWO,
    allowance: { ...TWO.allowance, used: 3 },
  })
  mount()
  const button = await screen.findByRole('button', { name: 'Export the trip' })
  expect(button.hasAttribute('disabled')).toBe(true)
  const description = document.getElementById(
    button.getAttribute('aria-describedby') ?? '',
  )
  expect(description?.textContent).toContain('starts again')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByText('3 of 3 exports used this month')).toBeTruthy()
})

it('shows the viewer explanation only with artifacts and hides request options', async () => {
  listTripExportsFn.mockResolvedValue({ ...TWO, canRequest: false })
  mount()
  expect(
    await screen.findByText(/Only owners and editors can create an export/),
  ).toBeTruthy()
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  expect(screen.queryByRole('button', { name: 'Export the trip' })).toBeNull()
})

it('marks and announces only the matching linked export', async () => {
  listTripExportsFn.mockResolvedValue(TWO)
  mount(() => {}, 'task-old')
  const badge = await screen.findByText('From your link')
  expect(badge.closest('[role="listitem"]')?.getAttribute('aria-current')).toBe(
    'true',
  )
  expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1)
  expect(screen.getByRole('status').textContent).toContain('Trip export,')
  expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
    behavior: 'instant',
    block: 'start',
  })
})

it('announces a missing link only after a successful load using viewer copy', async () => {
  listTripExportsFn.mockRejectedValueOnce(new Error('offline'))
  mount(() => {}, 'unknown')
  await screen.findByRole('alert')
  expect(screen.getByRole('status').textContent).toBe('')
  listTripExportsFn.mockResolvedValue({ ...TWO, canRequest: false })
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      'That export is no longer kept.',
    ),
  )
})

it('sends the notify checkbox value when toggled with Space', async () => {
  listTripExportsFn.mockResolvedValue(TWO)
  requestTripExportFn.mockResolvedValue({
    ok: true,
    taskId: 'queued',
    queuedAt: NOW,
  })
  mount()
  const checkbox = await screen.findByRole('checkbox', {
    name: 'Email me when it is ready',
  })
  checkbox.focus()
  const user = userEvent.setup()
  await user.keyboard('[Space]')
  await user.click(screen.getByRole('button', { name: 'Export the trip' }))
  expect(requestTripExportFn).toHaveBeenCalledWith({
    data: { tripId: 'trip-1', notify: true, includeReferences: false },
  })
})

it('restores a pending request after remount and keeps the request disabled', async () => {
  window.sessionStorage.setItem(
    'trip-export-pending:trip-1',
    JSON.stringify({ taskId: 'pending-1', queuedAt: NOW - 1000 }),
  )
  listTripExportsFn.mockResolvedValue(TWO)
  mount()
  const button = await screen.findByRole('button', { name: 'Export the trip' })
  expect(button.hasAttribute('disabled')).toBe(true)
  expect(document.querySelector('[data-state="pending"]')).toBeTruthy()
})

it('drops an expired persisted pending request on mount', async () => {
  window.sessionStorage.setItem(
    'trip-export-pending:trip-1',
    JSON.stringify({ taskId: 'expired', queuedAt: NOW - 90_000 }),
  )
  listTripExportsFn.mockResolvedValue(TWO)
  mount()
  const button = await screen.findByRole('button', { name: 'Export the trip' })
  expect(button.hasAttribute('disabled')).toBe(false)
  expect(document.querySelector('[data-state="pending"]')).toBeNull()
  expect(window.sessionStorage.getItem('trip-export-pending:trip-1')).toBeNull()
})

it('uses only the remaining polling window for a restored request', async () => {
  window.sessionStorage.setItem(
    'trip-export-pending:trip-1',
    JSON.stringify({ taskId: 'restored', queuedAt: NOW - 89_000 }),
  )
  listTripExportsFn.mockResolvedValue(TWO)
  vi.useFakeTimers()
  await act(async () => {
    mount()
  })
  const button = screen.getByRole('button', { name: 'Export the trip' })
  expect(button.hasAttribute('disabled')).toBe(true)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(button.hasAttribute('disabled')).toBe(false)
})

it('renders viewer copy from the Arabic catalogue', async () => {
  listTripExportsFn.mockResolvedValue({
    ...TWO,
    canRequest: false,
    allowance: { ...TWO.allowance, limit: null },
  })
  render(
    <I18nProvider
      locale="ar"
      messages={namespaceCatalogue('modules', ArabicModules)}
    >
      <ExportPanel tripId="trip-ar" exportId="unknown" />
    </I18nProvider>,
  )
  await screen.findAllByRole('listitem')
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      ArabicModules['files.export.linkGoneViewer'],
    ),
  )
  expect(screen.getByText(ArabicModules['files.export.viewer'])).toBeTruthy()
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
})

it('shows exports used without a ceiling for an unlimited allowance', async () => {
  listTripExportsFn.mockResolvedValue({
    ...TWO,
    allowance: { ...TWO.allowance, used: 1, limit: null },
  })
  mount()
  expect(await screen.findByText('1 export this month')).toBeTruthy()
  expect(
    screen
      .getByRole('button', { name: 'Export the trip' })
      .hasAttribute('disabled'),
  ).toBe(false)
})

it('does not show an earlier editing request after the traveller becomes a viewer', async () => {
  window.sessionStorage.setItem(
    'trip-export-pending:trip-1',
    JSON.stringify({ taskId: 'old-request', queuedAt: NOW - 1000 }),
  )
  listTripExportsFn.mockResolvedValue({ ...TWO, canRequest: false })
  mount()
  await screen.findByText(
    'Only owners and editors can create an export. You can download the ones that exist.',
  )
  expect(document.querySelector('[data-state="pending"]')).toBeNull()
})

it.each([
  ['owner', true],
  ['editor', true],
  ['viewer', false],
])('states the shared export limit for %s', async (_role, canRequest) => {
  listTripExportsFn.mockResolvedValue({ ...TWO, canRequest })
  mount()
  await screen.findByText(
    canRequest ? 'Export the trip' : Modules['files.export.viewer'],
  )
  expect(
    screen.getByText(`A trip keeps its ${EXPORT_KEEP_COUNT} newest exports.`, {
      exact: false,
    }),
  ).toBeTruthy()
})
