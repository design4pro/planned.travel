import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { createExpenseFn } from '#/server/fns/costs'
import { useCostsActions } from '../actions'

import type { ReactNode } from 'react'
import type { Catalogue } from '#/lib/i18n'
import type { ExpenseFormValue } from '#/components/costs'
import type { CostsPayload } from '#/server/fns/costs'

/**
 * The shared write runner when the server refuses a save because the trip's budget currency
 * changed (`costs.refusal.tripCurrencyChanged`): it refreshes the screen first, names the currency
 * the loader delivered in the reader's language, and still hands the refusal to the dialog.
 */
const EN: Catalogue = namespaceCatalogue('costs', Costs)

const refresh = vi.hoisted(() => ({
  invalidate: vi.fn<() => Promise<void>>(),
  matches: [] as Array<{ loaderData: unknown }>,
}))

vi.mock('#/server/fns/costs', () => ({
  createExpenseFn: vi.fn(),
  updateExpenseFn: vi.fn(),
  deleteExpenseFn: vi.fn(),
  recordPaymentFn: vi.fn(),
  setDisplayCurrencyFn: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: refresh.invalidate,
    state: {
      get matches() {
        return refresh.matches
      },
    },
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
    refresh.matches = []
    vi.mocked(createExpenseFn).mockRejectedValue(
      new Error('costs.refusal.tripCurrencyChanged'),
    )
  })

  it('refreshes the screen, names the live currency in the toast and rethrows the refusal', async () => {
    refresh.matches = [
      { loaderData: { tripId: 'trip-1', currency: 'JPY' } },
      { loaderData: { trip: { id: 'trip-1', currency: 'USD' } } },
    ]

    const thrown = await refusedAdd()

    expect(refresh.invalidate).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('The expense was not added', {
      description: expect.stringContaining('JPY'),
    })
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).toHaveProperty(
      'message',
      'costs.refusal.tripCurrencyChanged',
    )
  })

  it('falls back to the plain toast when the loader delivered no currency for the trip', async () => {
    refresh.matches = [
      { loaderData: { tripId: 'another-trip', currency: 'JPY' } },
    ]

    await refusedAdd()

    expect(toast.error).toHaveBeenCalledWith('The expense was not added')
  })

  it('keeps the refusal as it was when the refresh itself fails', async () => {
    refresh.invalidate.mockRejectedValueOnce(new Error('offline'))

    const thrown = await refusedAdd()

    expect(thrown).toHaveProperty(
      'message',
      'costs.refusal.tripCurrencyChanged',
    )
  })
})
