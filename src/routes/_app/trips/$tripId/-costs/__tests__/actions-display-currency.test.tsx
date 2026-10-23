import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { setDisplayCurrencyFn } from '#/server/fns/costs'
import { useCostsActions } from '../actions'

import type { ReactNode } from 'react'
import type { Catalogue } from '#/lib/i18n'
import type { CostsPayload } from '#/server/fns/costs'

/** Storing the display currency, and what the reader is told when only the reload after it fails. */
const EN: Catalogue = namespaceCatalogue('costs', Costs)

const refresh = vi.hoisted(() => ({
  invalidate: vi.fn<(options?: unknown) => Promise<void>>(),
}))

vi.mock('#/server/fns/costs', () => ({
  createExpenseFn: vi.fn(),
  loadCosts: vi.fn(),
  updateExpenseFn: vi.fn(),
  deleteExpenseFn: vi.fn(),
  deletePaymentFn: vi.fn(),
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
  suggestedRate: null,
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="en" messages={EN}>
      {children}
    </I18nProvider>
  )
}

describe('choosing the display currency on the costs screen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refresh.invalidate.mockResolvedValue(undefined)
    vi.mocked(setDisplayCurrencyFn).mockResolvedValue({ code: 'GBP' })
  })

  it('stores the choice, reloads the figures and stays quiet', async () => {
    const { result } = renderHook(() => useCostsActions(PAYLOAD), { wrapper })

    await act(async () => {
      await result.current.setDisplay('GBP')
    })

    expect(setDisplayCurrencyFn).toHaveBeenCalledWith({ data: { code: 'GBP' } })
    expect(refresh.invalidate).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(result.current.savingDisplay).toBe(false)
  })

  it('says the choice was not saved when the write fails, and does not reload', async () => {
    vi.mocked(setDisplayCurrencyFn).mockRejectedValue(new Error('refused'))
    const { result } = renderHook(() => useCostsActions(PAYLOAD), { wrapper })

    await act(async () => {
      await result.current.setDisplay('GBP')
    })

    expect(toast.error).toHaveBeenCalledWith(Costs['display.error.title'], {
      description: Costs['display.error.body'],
    })
    expect(refresh.invalidate).not.toHaveBeenCalled()
    expect(result.current.savingDisplay).toBe(false)
  })

  it('never says the choice was not saved when it was stored and only the reload fails', async () => {
    refresh.invalidate.mockRejectedValue(new Error('loader failed'))
    const { result } = renderHook(() => useCostsActions(PAYLOAD), { wrapper })

    await act(async () => {
      await result.current.setDisplay('GBP')
    })

    expect(setDisplayCurrencyFn).toHaveBeenCalledTimes(1)
    expect(refresh.invalidate).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(result.current.savingDisplay).toBe(false)
  })
})
