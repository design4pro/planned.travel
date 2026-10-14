import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { createExpenseFn, loadCosts } from '#/server/fns/costs'
import { useCostsActions } from '../actions'

import type { ReactNode } from 'react'
import type { Catalogue } from '#/lib/i18n'
import type { ExpenseFormValue } from '#/components/costs'
import type { CostsPayload } from '#/server/fns/costs'

/**
 * The shared write runner when the server refuses a save because the trip's budget currency
 * changed (`costs.refusal.tripCurrencyChanged`): it asks the server for the trip's current currency,
 * refreshes the screen only when that answers, names the currency in the reader's language, and
 * still hands the refusal to the dialog.
 */
const EN: Catalogue = namespaceCatalogue('costs', Costs)

const refresh = vi.hoisted(() => ({
  invalidate: vi.fn<() => Promise<void>>(),
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
  viewerUserId: 'u-ada',
  displayCurrency: { mode: 'per-trip', code: 'EUR' },
  displayChoices: { workspaceCode: 'EUR', rateCodes: [] },
  unconverted: [],
  canWrite: true,
  suggestedRate: null,
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
  const { result } = renderHook(() => useCostsActions(PAYLOAD), { wrapper })
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
    vi.mocked(loadCosts).mockResolvedValue({ ...PAYLOAD, currency: 'JPY' })
    vi.mocked(createExpenseFn).mockRejectedValue(
      new Error('costs.refusal.tripCurrencyChanged'),
    )
  })

  it('refreshes the screen synchronously, names the live currency in the toast and rethrows the refusal', async () => {
    const thrown = await refusedAdd()

    expect(refresh.invalidate).toHaveBeenCalledWith({
      sync: true,
      filter: expect.any(Function),
    })
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('now JPY'))
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
    expect(toast.error).toHaveBeenCalledWith('That did not save')
    expect(thrown).toHaveProperty(
      'message',
      'costs.refusal.tripCurrencyChanged',
    )
  })

  it('falls back to the plain toast when the currency is the one the save was made under', async () => {
    vi.mocked(loadCosts).mockResolvedValue({ ...PAYLOAD, currency: 'EUR' })

    await refusedAdd()

    expect(toast.error).toHaveBeenCalledWith('That did not save')
  })

  it('does not show the refused row while the live currency is fetched', async () => {
    let answer: (payload: CostsPayload) => void = () => {}
    vi.mocked(loadCosts).mockReturnValue(
      new Promise<CostsPayload>((resolve) => {
        answer = resolve
      }),
    )
    const { result } = renderHook(() => useCostsActions(PAYLOAD), { wrapper })
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.addExpense(EXPENSE).catch(() => undefined)
    })
    await vi.waitFor(() => expect(loadCosts).toHaveBeenCalledOnce())

    expect(result.current.snapshot.expenses).toHaveLength(0)

    await act(async () => {
      answer({ ...PAYLOAD, currency: 'JPY' })
      await pending
    })
  })
})
