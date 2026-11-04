import '#/components/ui/__tests__/test-env'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import {
  resetWorkspaceClaim,
  setWorkspaceClaim,
} from '#/lib/workspace-claim-store'
import { CurrencyConverter } from '../currency-converter'
import type { ConverterState } from '../currency-converter'
import type { PublicRatesResult } from '#/server/rates/public-rates'

const read = vi.hoisted(() => vi.fn())
vi.mock('#/server/fns/public-rates', () => ({ getPublicRatesFn: read }))
const at = Date.parse('2026-11-03T18:00:00Z')
function available(): PublicRatesResult {
  return {
    status: 'available',
    freshness: 'fresh',
    reason: null,
    checkedAt: at,
    snapshot: {
      version: 1,
      provider: 'frankfurter-ecb',
      source: 'ECB',
      base: 'EUR',
      effectiveOn: '2026-11-03',
      fetchedAt: at,
      rates: { EUR: 1, USD: 1.25, JPY: 150 },
    },
  }
}
function Harness({
  initial = { amount: '100', from: 'EUR', to: 'USD' },
  shown = true,
}: {
  initial?: ConverterState
  shown?: boolean
}) {
  const [state, setState] = useState(initial)
  return (
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('shell', Shell),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      {shown ? <CurrencyConverter state={state} onChange={setState} /> : null}
    </I18nProvider>
  )
}
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(at)
  resetWorkspaceClaim()
  setWorkspaceClaim('workspace-a')
  read.mockReset()
  read.mockResolvedValue(available())
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.useRealTimers()
  resetWorkspaceClaim()
})
it('keeps amount edits local, rounds on blur and keeps the typed amount on swap', async () => {
  render(<Harness />)
  await screen.findByLabelText('Converted amount')
  const amount = screen.getByRole('textbox', { name: 'Amount' })
  fireEvent.change(amount, { target: { value: '1.005' } })
  expect(read).toHaveBeenCalledTimes(1)
  fireEvent.blur(amount)
  expect((amount as HTMLInputElement).value).toBe('1.01')
  fireEvent.click(screen.getByRole('button', { name: 'Swap currencies' }))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  expect((amount as HTMLInputElement).value).toBe('1.01')
})
it('recovers on a valid committed amount after reopening invalid input without fetching on keystrokes', async () => {
  const view = render(<Harness />)
  await screen.findByLabelText('Converted amount')
  fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '' },
  })
  view.rerender(<Harness shown={false} />)
  view.rerender(<Harness />)
  const amount = screen.getByRole('textbox', { name: 'Amount' })
  fireEvent.change(amount, { target: { value: '100' } })
  expect(read).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status').textContent).not.toContain('Loading')
  fireEvent.blur(amount)
  await screen.findByLabelText('Converted amount')
  expect(read).toHaveBeenCalledTimes(2)
})
it('revalidates on committing a corrected amount after the hourly read was suppressed', async () => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(at))
  render(<Harness />)
  await act(async () => {})
  const amount = screen.getByRole('textbox', { name: 'Amount' })
  fireEvent.change(amount, { target: { value: '' } })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3600000)
  })
  expect(read).toHaveBeenCalledTimes(1)
  fireEvent.change(amount, { target: { value: '2' } })
  expect(read).toHaveBeenCalledTimes(1)
  await act(async () => {
    fireEvent.blur(amount)
  })
  expect(read).toHaveBeenCalledTimes(2)
})
it('does not request rates or claim provenance for identity, including outside provider coverage', async () => {
  render(<Harness initial={{ amount: '1.234', from: 'KWD', to: 'KWD' }} />)
  expect(read).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Converted amount').textContent).toContain('KWD')
  expect(screen.queryByText(/ECB reference/)).toBeNull()
})
it('connects invalid input to its inline error without another read', async () => {
  render(<Harness />)
  await screen.findByLabelText('Converted amount')
  const amount = screen.getByRole('textbox', { name: 'Amount' })
  fireEvent.change(amount, { target: { value: '-1' } })
  expect(amount.getAttribute('aria-invalid')).toBe('true')
  expect(amount.getAttribute('aria-describedby')).toBeTruthy()
  expect(screen.queryByLabelText('Converted amount')).toBeNull()
  expect(read).toHaveBeenCalledTimes(1)
})
it('discards a pending completion after a pair changes to identity', async () => {
  let resolve: (value: PublicRatesResult) => void = () => {}
  read.mockReturnValue(
    new Promise<PublicRatesResult>((done) => {
      resolve = done
    }),
  )
  const view = render(<Harness />)
  view.rerender(
    <Harness
      key="identity"
      initial={{ amount: '2', from: 'EUR', to: 'EUR' }}
    />,
  )
  await act(async () => {
    resolve(available())
  })
  expect(screen.getByLabelText('Converted amount').textContent).toContain(
    '2.00',
  )
  expect(screen.queryByText(/ECB reference/)).toBeNull()
})
it('discards an old workspace completion', async () => {
  let resolve: (value: PublicRatesResult) => void = () => {}
  read
    .mockReturnValueOnce(
      new Promise<PublicRatesResult>((done) => {
        resolve = done
      }),
    )
    .mockResolvedValue({ status: 'unavailable', reason: 'provider-blocked' })
  render(<Harness />)
  await act(async () => {
    setWorkspaceClaim('workspace-b')
  })
  await screen.findByText('The rate service limit has been reached.')
  await act(async () => {
    resolve(available())
  })
  expect(screen.queryByLabelText('Converted amount')).toBeNull()
})
it.each([
  'provider-failed',
  'provider-blocked',
  'throttled',
  'cache-unavailable',
] as const)(
  'keeps eligible stale rates visible with %s and focused refresh recovery',
  async (reason) => {
    const result = available()
    if (result.status !== 'available') throw new Error('fixture')
    read.mockResolvedValue({
      ...result,
      freshness: 'stale',
      reason,
      retryAt: at + 300000,
    })
    render(<Harness />)
    await screen.findByLabelText('Converted amount')
    const refresh = screen.getByRole('button', { name: 'Refresh rates' })
    refresh.focus()
    fireEvent.click(refresh)
    expect(document.activeElement).toBe(refresh)
    expect(refresh.getAttribute('aria-disabled')).toBe('true')
    expect(read).toHaveBeenCalledTimes(1)
    expect(
      screen.getAllByText('These reference rates may be out of date.').length,
    ).toBeGreaterThan(0)
    expect(
      screen
        .getByRole('link', {
          name: 'ECB reference rates are freely available from the ECB.',
        })
        .getAttribute('href'),
    ).toContain('ecb.europa.eu')
  },
)
it('preserves unsupported selected codes and never invents a rate', async () => {
  render(<Harness initial={{ amount: '10', from: 'EUR', to: 'KWD' }} />)
  await screen.findByText('This currency pair is unavailable.')
  expect(screen.queryByLabelText('Converted amount')).toBeNull()
  expect(
    screen.getByRole('button', { name: 'To currency' }).textContent,
  ).toContain('KWD')
})

it('removes an expired observation at UTC midnight without a refresh', async () => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-03T23:59:59Z'))
  const result = available()
  if (result.status !== 'available') throw new Error('fixture')
  result.snapshot.effectiveOn = '2026-10-27'
  result.snapshot.fetchedAt = Date.now()
  result.freshness = 'stale'
  read.mockResolvedValue(result)
  render(<Harness />)
  await act(async () => {})
  expect(screen.getByLabelText('Converted amount').textContent).toContain('125')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(screen.queryByLabelText('Converted amount')).toBeNull()
  expect(read).toHaveBeenCalledTimes(1)
})
it('revalidates a visible widget once after an hour, with no per-keystroke request', async () => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(at))
  render(<Harness />)
  await act(async () => {})
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3600000)
  })
  expect(read).toHaveBeenCalledTimes(2)
})

it('announces settled results and committed amounts without speaking each keystroke', async () => {
  render(<Harness />)
  await screen.findByLabelText('Converted amount')
  const status = document.querySelector('[role="status"][aria-live="polite"]')
  expect(status?.textContent).toContain('125')
  const amount = screen.getByRole('textbox', { name: 'Amount' })
  fireEvent.change(amount, { target: { value: '2' } })
  expect(status?.textContent).toContain('125')
  fireEvent.blur(amount)
  expect(status?.textContent).toContain('2.50')
  expect(status?.closest('[aria-busy]')).toBeNull()
})
it.each(['fresh', 'blocked', 'failed'] as const)(
  'announces the %s retry deadline without moving focus or repeating it on amount edits',
  async (state) => {
    render(<Harness />)
    await screen.findByLabelText('Converted amount')
    const retryAt = at + 300000
    const result = available()
    if (result.status !== 'available') throw new Error('fixture')
    read.mockResolvedValue(
      state === 'failed'
        ? { status: 'unavailable', reason: 'provider-failed', retryAt }
        : {
            ...result,
            freshness: state === 'blocked' ? 'stale' : 'fresh',
            reason: state === 'blocked' ? 'provider-blocked' : null,
            retryAt,
          },
    )
    const refresh = screen.getByRole('button', { name: 'Refresh rates' })
    refresh.focus()
    fireEvent.click(refresh)
    const deadline = `Try again after ${new Intl.DateTimeFormat('en', {
      timeStyle: 'short',
    }).format(new Date(retryAt))}.`
    const status = document.querySelector('[role="status"][aria-live="polite"]')
    await waitFor(() => expect(status?.textContent).toContain(deadline))
    expect(document.activeElement).toBe(refresh)
    expect(refresh.getAttribute('aria-disabled')).toBe('true')
    expect(
      document.getElementById(refresh.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe(deadline)
    fireEvent.click(refresh)
    expect(read).toHaveBeenCalledTimes(2)
    const announcement = status?.textContent
    const mutations: MutationRecord[] = []
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    )
    observer.observe(status!, {
      subtree: true,
      childList: true,
      characterData: true,
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), {
      target: { value: '2' },
    })
    await act(async () => {})
    observer.disconnect()
    expect(status?.textContent).toBe(announcement)
    expect(mutations).toHaveLength(0)
    expect(read).toHaveBeenCalledTimes(2)
  },
)
it('preserves an eligible result when a refresh loses its connection', async () => {
  render(<Harness />)
  await screen.findByLabelText('Converted amount')
  read.mockRejectedValue(new Error('offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh rates' }))
  await screen.findByText('Rates could not be refreshed.')
  expect(screen.getByLabelText('Converted amount').textContent).toContain('125')
  expect(
    screen.getAllByText('These reference rates may be out of date.').length,
  ).toBeGreaterThan(0)
})

it('never announces an old numeric result for invalid current input', async () => {
  render(<Harness />)
  await screen.findByLabelText('Converted amount')
  fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '-1' },
  })
  expect(
    document.querySelector('[role="status"][aria-live="polite"]')?.textContent,
  ).not.toContain('125')
})
it('announces the current amount when a pending read finishes', async () => {
  let resolve: (value: PublicRatesResult) => void = () => {}
  read.mockReturnValue(
    new Promise<PublicRatesResult>((done) => {
      resolve = done
    }),
  )
  render(<Harness />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '2' },
  })
  await act(async () => {
    resolve(available())
  })
  expect(
    document.querySelector('[role="status"][aria-live="polite"]')?.textContent,
  ).toContain('2.50')
})
it('does not schedule a second-by-second loop for an invalid initial amount', async () => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(at))
  const timeout = vi.spyOn(window, 'setTimeout')
  render(<Harness initial={{ amount: '', from: 'EUR', to: 'USD' }} />)
  await act(async () => {})
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3600000)
  })
  expect(read).not.toHaveBeenCalled()
  expect(timeout.mock.calls.length).toBeLessThan(5)
})

it('announces the current amount after a pending refresh fails', async () => {
  render(<Harness />)
  await screen.findByLabelText('Converted amount')
  let reject: (cause: Error) => void = () => {}
  read.mockReturnValue(
    new Promise<PublicRatesResult>((_, fail) => {
      reject = fail
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Refresh rates' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '2' },
  })
  await act(async () => {
    reject(new Error('offline'))
  })
  expect(
    document.querySelector('[role="status"][aria-live="polite"]')?.textContent,
  ).toContain('2.50')
})

it('does not fetch during the fallback paint for a saved preference without the new widget', async () => {
  localStorage.setItem(
    'planned.dashboard-widgets',
    JSON.stringify({ shown: ['clock'], zones: [] }),
  )
  render(<Harness />)
  await act(async () => {})
  expect(read).not.toHaveBeenCalled()
})

it('shows loading before the first client read instead of claiming a failed request', () => {
  const html = renderToString(<Harness />)
  expect(html).toContain('Loading')
  expect(html).not.toContain('Rates could not be refreshed.')
  expect(read).not.toHaveBeenCalled()
})

it('hydrates without time-dependent hidden metadata when the browser clock differs', async () => {
  read.mockReturnValue(new Promise<PublicRatesResult>(() => {}))
  const container = document.createElement('div')
  container.innerHTML = renderToString(<Harness />)
  document.body.appendChild(container)
  vi.mocked(Date.now).mockReturnValue(at + 86_460_000)
  const onRecoverableError = vi.fn()
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    await act(async () => {
      root = hydrateRoot(container, <Harness />, { onRecoverableError })
    })
    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('2026')
  } finally {
    await act(async () => root?.unmount())
    container.remove()
  }
})

it('offers only reviewed codes until provider coverage is available', async () => {
  read.mockReturnValue(new Promise<PublicRatesResult>(() => {}))
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'From currency' }))
  await screen.findAllByRole('option')
  expect(screen.queryByRole('option', { name: /KWD/ })).toBeNull()
  expect(screen.getByRole('option', { name: /^CAD/ })).toBeTruthy()
})

it.each([true, false])(
  'can leave identity with a pending first read: %s',
  async (pending) => {
    const user = userEvent.setup()
    if (pending) read.mockReturnValue(new Promise<PublicRatesResult>(() => {}))
    render(<Harness />)
    if (!pending) await screen.findByLabelText('Converted amount')
    await user.click(screen.getByRole('button', { name: 'To currency' }))
    await user.click(screen.getByRole('option', { name: /^EUR/ }))
    expect(read).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Converted amount').textContent).toContain(
      'EUR',
    )
    await user.click(screen.getByRole('button', { name: 'To currency' }))
    expect(screen.queryByRole('option', { name: /^USD/ })).not.toBeNull()
    await user.click(screen.getByRole('option', { name: /^USD/ }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  },
)
