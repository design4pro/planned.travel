import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { createExpenseFn, loadCosts, recordPaymentFn } from '#/server/fns/costs'
import { useCostsActions } from '../actions'

import type { ReactNode } from 'react'
import type { Catalogue } from '#/lib/i18n'
import type { ExpenseFormValue } from '#/components/costs'
import type { OrAbsent } from '#/lib/absence'
import type { CostsPayload } from '#/server/fns/costs'

/**
 * The shared write runner when the server refuses a save because the trip's budget currency
 * changed (`costs.refusal.tripCurrencyChanged`): it asks the server for the trip's current currency,
 * supplies the dialog currency without reloading, names the currency in the reader's language, and
 * still hands the refusal to the dialog.
 */
const EN: Catalogue = namespaceCatalogue('costs', Costs)

const refresh = vi.hoisted(() => ({
  invalidate: vi.fn<(options?: unknown) => Promise<void>>(),
}))

vi.mock('#/server/fns/costs', () => ({
  createExpenseFn: vi.fn(),
  loadCosts: vi.fn(),
  updateExpenseFn: vi.fn(),
  deleteExpenseFn: vi.fn(),
  recordPaymentFn: vi.fn(),
  setDisplayCurrencyFn: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: refresh.invalidate,
  }),
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const PAYLOAD: CostsPayload = {
  tripId: 'trip-1',
  currency: 'EUR',
  today: '2026-04-10',
  startDate: '2026-04-10',
  endDate: '2026-04-13',
  plannedMinor: 0,
  spentMinor: 0,
  budgetTargetMinor: null,
  expenseCount: 0,
  byCategory: [],
  expenses: [],
  balances: [],
  settlements: [],
  suggestions: [],
  people: [],
  departedPeople: [],
  viewerUserId: 'u-ada',
  displayCurrency: { mode: 'per-trip', code: 'EUR' },
  displayChoices: { workspaceCode: 'EUR', rateCodes: [] },
  unconverted: [],
  canWrite: true,
  suggestedRate: { GBP: { rate: 1.15, observedOn: '2026-04-10' } },
}

const EXPENSE: ExpenseFormValue = {
  title: 'Dinner',
  category: 'food',
  amountMinor: 4_000,
  currency: 'EUR',
  originalAmountMinor: null,
  originalCurrency: null,
  spentOn: '2026-04-10',
  paidBy: null,
  splitMethod: 'equal',
  notes: null,
  participants: [],
  shares: [],
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="en" messages={EN}>
      {children}
    </I18nProvider>
  )
}

async function refusedAdd(): Promise<unknown> {
  const { result } = renderHook(() => useCostsActions(PAYLOAD, 1), { wrapper })
  let thrown: unknown = null
  await act(async () => {
    await result.current.addExpense(EXPENSE).catch((cause: unknown) => {
      thrown = cause
    })
  })
  return thrown
}

describe('the costs write runner on a stale trip currency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refresh.invalidate.mockResolvedValue(undefined)
    vi.mocked(loadCosts).mockResolvedValue({
      ...PAYLOAD,
      found: true,
      currency: 'JPY',
    })
    vi.mocked(createExpenseFn).mockRejectedValue(
      new Error('costs.refusal.tripCurrencyChanged'),
    )
  })

  it('adopts the live currency without reloading an open dialog and rethrows the refusal', async () => {
    const thrown = await refusedAdd()

    expect(refresh.invalidate).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('now JPY'),
      expect.any(Object),
    )
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).toHaveProperty(
      'message',
      'costs.refusal.tripCurrencyChanged',
    )
  })

  it('leaves the screen alone when the server cannot say what the currency is now, so the open dialog keeps what was typed', async () => {
    vi.mocked(loadCosts).mockRejectedValue(new Error('offline'))

    const thrown = await refusedAdd()

    expect(refresh.invalidate).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      'That did not save',
      expect.any(Object),
    )
    expect(thrown).toHaveProperty(
      'message',
      'costs.refusal.tripCurrencyChanged',
    )
  })

  it('falls back to the plain toast when the currency is the one the save was made under', async () => {
    vi.mocked(loadCosts).mockResolvedValue({
      ...PAYLOAD,
      found: true,
      currency: 'EUR',
    })

    await refusedAdd()

    expect(toast.error).toHaveBeenCalledWith(
      'That did not save',
      expect.any(Object),
    )
  })

  it('keeps a committed write until close, then reconciles without turning reload failure into save failure', async () => {
    vi.mocked(createExpenseFn).mockResolvedValue({ expenseId: 'saved' })
    refresh.invalidate.mockRejectedValue(new Error('loader offline'))
    const { result, rerender } = renderHook(
      ({ session }: { session: number | null }) =>
        useCostsActions(PAYLOAD, session),
      { wrapper, initialProps: { session: 1 as number | null } },
    )
    await act(async () => {
      await result.current.addExpense(EXPENSE)
    })
    expect(refresh.invalidate).not.toHaveBeenCalled()
    expect(result.current.snapshot.expenses).toHaveLength(1)
    rerender({ session: null })
    await vi.waitFor(() => expect(refresh.invalidate).toHaveBeenCalledOnce())
    expect(refresh.invalidate).toHaveBeenCalledWith({ sync: true })
    expect(toast.error).not.toHaveBeenCalled()
    expect(createExpenseFn).toHaveBeenCalledOnce()
  })

  it('reconciles a write that finishes after the dialog was already closed', async () => {
    let finish: (value: { readonly expenseId: string }) => void = () => {}
    vi.mocked(createExpenseFn).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { result, rerender } = renderHook(
      ({ session }: { session: number | null }) =>
        useCostsActions(PAYLOAD, session),
      { wrapper, initialProps: { session: 1 as number | null } },
    )
    let pending = Promise.resolve()
    act(() => {
      pending = result.current.addExpense(EXPENSE)
    })
    rerender({ session: null })
    expect(refresh.invalidate).not.toHaveBeenCalled()
    await act(async () => {
      finish({ expenseId: 'saved' })
      await pending
    })
    await vi.waitFor(() => expect(refresh.invalidate).toHaveBeenCalledOnce())
    expect(createExpenseFn).toHaveBeenCalledOnce()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('uses the probed currency for the next explicit payment and reconciles a cancelled refusal', async () => {
    const { result, rerender } = renderHook(
      ({ session }: { session: number | null }) =>
        useCostsActions(PAYLOAD, session),
      { wrapper, initialProps: { session: 1 as number | null } },
    )
    await act(async () => {
      await result.current.addExpense(EXPENSE).catch(() => undefined)
    })
    expect(result.current.currency).toBe('JPY')
    expect(result.current.suggestedRate).toBeNull()
    vi.mocked(recordPaymentFn).mockResolvedValue({ settlementId: 'saved' })
    await act(async () => {
      await result.current.addPayment({
        fromUserId: 'u-ada',
        toUserId: 'u-bo',
        amountMinor: 4000,
        originalAmountMinor: null,
        originalCurrency: null,
        method: 'cash',
        settledOn: '2026-04-10',
        note: null,
      })
    })
    expect(result.current.snapshot.settlements).toHaveLength(0)
    expect(recordPaymentFn).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expectedTripCurrency: 'JPY',
        amountMinor: 4000,
      }),
    })
    expect(refresh.invalidate).not.toHaveBeenCalled()
    rerender({ session: null })
    await vi.waitFor(() => expect(refresh.invalidate).toHaveBeenCalledOnce())
  })

  it.each(['failed', 'unchanged'])(
    'reconciles a cancelled %s probe without adopting an invented currency',
    async (outcome) => {
      if (outcome === 'failed')
        vi.mocked(loadCosts).mockRejectedValue(new Error('offline'))
      else vi.mocked(loadCosts).mockResolvedValue({ ...PAYLOAD, found: true })
      const { result, rerender } = renderHook(
        ({ session }: { session: number | null }) =>
          useCostsActions(PAYLOAD, session),
        { wrapper, initialProps: { session: 1 as number | null } },
      )
      await act(async () => {
        await result.current.addExpense(EXPENSE).catch(() => undefined)
      })
      expect(result.current.currency).toBe('EUR')
      expect(refresh.invalidate).not.toHaveBeenCalled()
      rerender({ session: null })
      await vi.waitFor(() => expect(refresh.invalidate).toHaveBeenCalledOnce())
      expect(createExpenseFn).toHaveBeenCalledOnce()
    },
  )

  it('can refuse again when the currency changes a second time without retrying either write', async () => {
    const { result } = renderHook(() => useCostsActions(PAYLOAD, 1), {
      wrapper,
    })
    await act(async () => {
      await result.current.addExpense(EXPENSE).catch(() => undefined)
    })
    expect(result.current.currency).toBe('JPY')
    vi.mocked(loadCosts).mockResolvedValue({
      ...PAYLOAD,
      found: true,
      currency: 'USD',
    })
    await act(async () => {
      await result.current
        .addExpense({ ...EXPENSE, currency: 'JPY' })
        .catch(() => undefined)
    })
    expect(result.current.currency).toBe('USD')
    expect(createExpenseFn).toHaveBeenCalledTimes(2)
    expect(refresh.invalidate).not.toHaveBeenCalled()
  })

  it('ignores a probe that settles after a different dialog session opened', async () => {
    let answer: (payload: OrAbsent<CostsPayload>) => void = () => {}
    vi.mocked(loadCosts).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    const { result, rerender } = renderHook(
      ({ session }) => useCostsActions(PAYLOAD, session),
      { wrapper, initialProps: { session: 1 } },
    )
    let pending = Promise.resolve()
    act(() => {
      pending = result.current.addExpense(EXPENSE).catch(() => undefined)
    })
    await vi.waitFor(() => expect(loadCosts).toHaveBeenCalledOnce())
    rerender({ session: 2 })
    await act(async () => {
      answer({ ...PAYLOAD, found: true, currency: 'JPY' })
      await pending
    })
    expect(result.current.currency).toBe('EUR')
    expect(refresh.invalidate).not.toHaveBeenCalled()
  })

  it('does not show the refused row while the live currency is fetched', async () => {
    let answer: (payload: OrAbsent<CostsPayload>) => void = () => {}
    vi.mocked(loadCosts).mockReturnValue(
      new Promise<OrAbsent<CostsPayload>>((resolve) => {
        answer = resolve
      }),
    )
    const { result } = renderHook(() => useCostsActions(PAYLOAD, 1), {
      wrapper,
    })
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.addExpense(EXPENSE).catch(() => undefined)
    })
    await vi.waitFor(() => expect(loadCosts).toHaveBeenCalledOnce())

    expect(result.current.snapshot.expenses).toHaveLength(0)

    await act(async () => {
      answer({ ...PAYLOAD, found: true, currency: 'JPY' })
      await pending
    })
  })
})

describe('the costs write runner when a save fails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refresh.invalidate.mockResolvedValue(undefined)
  })

  it('shows the catalogue line, never the failure envelope, for an unexpected failure', async () => {
    vi.mocked(createExpenseFn).mockRejectedValue(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'evt_1a2b3c' }),
      ),
    )

    await refusedAdd()

    expect(toast.error).toHaveBeenCalledWith(Costs['write.addFailed'], {
      description: Costs['write.rolledBack'],
    })
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain(
      'planned-travel/failure',
    )
  })

  it('shows the sentence a validation failure names the field with', async () => {
    vi.mocked(createExpenseFn).mockRejectedValue(
      new Error(
        encodePublicFailure({
          kind: 'validation',
          message: 'The amount must be more than zero.',
        }),
      ),
    )

    await refusedAdd()

    expect(toast.error).toHaveBeenCalledWith(Costs['write.addFailed'], {
      description: 'The amount must be more than zero.',
    })
  })
})
