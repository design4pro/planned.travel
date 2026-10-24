import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { deletePaymentFn, loadCosts } from '#/server/fns/costs'
import { useCostsActions } from '../actions'

import type { ReactNode } from 'react'
import type { Catalogue } from '#/lib/i18n'
import type { CostsPayload, CostsSettlement } from '#/server/fns/costs'

/** Deleting a recorded payment through the shared write runner. */
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

const PAYMENT: CostsSettlement = {
  id: 'pay-1',
  fromUserId: 'u-ada',
  toUserId: 'u-bob',
  amountMinor: 1_000,
  currency: 'EUR',
  convertedMinor: 1_000,
  method: 'cash',
  settledOn: '2026-04-11',
  note: null,
}

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
  settlements: [PAYMENT],
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

describe('removing a payment from the costs screen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refresh.invalidate.mockResolvedValue(undefined)
    vi.mocked(deletePaymentFn).mockResolvedValue({ settlementId: 'pay-1' })
  })

  it('sends the trip and the payment, reloads the screen and says so', async () => {
    const { result } = renderHook(() => useCostsActions(PAYLOAD), { wrapper })

    await act(async () => {
      await result.current.removePayment(PAYMENT)
    })

    expect(deletePaymentFn).toHaveBeenCalledWith({
      data: { tripId: 'trip-1', settlementId: 'pay-1' },
    })
    expect(refresh.invalidate).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith(
      Costs['write.paymentDeleted'],
      expect.anything(),
    )
    expect(result.current.snapshot.settlements).toEqual([PAYMENT])
  })

  it('puts the payment back, says it was not deleted and rethrows when the server refuses', async () => {
    vi.mocked(deletePaymentFn).mockRejectedValue(new Error('refused'))
    const { result } = renderHook(() => useCostsActions(PAYLOAD), { wrapper })

    let thrown: unknown = null
    await act(async () => {
      await result.current.removePayment(PAYMENT).catch((cause: unknown) => {
        thrown = cause
      })
    })

    expect(thrown).toBeInstanceOf(Error)
    expect(toast.error).toHaveBeenCalledWith(
      Costs['write.paymentDeleteFailed'],
      expect.anything(),
    )
    expect(result.current.snapshot.settlements).toEqual([PAYMENT])
  })

  describe('when the server refuses because the payment is not there any more', () => {
    it('reads the trip again and treats a payment that is gone as deleted, not as a failure to retry', async () => {
      vi.mocked(deletePaymentFn).mockRejectedValue(new Error('not found'))
      vi.mocked(loadCosts).mockResolvedValue({
        ...PAYLOAD,
        found: true,
        settlements: [],
      })
      const { result } = renderHook(() => useCostsActions(PAYLOAD), { wrapper })

      await act(async () => {
        await result.current.removePayment(PAYMENT)
      })

      expect(loadCosts).toHaveBeenCalledWith({ data: { tripId: 'trip-1' } })
      expect(toast.error).not.toHaveBeenCalled()
      expect(refresh.invalidate).toHaveBeenCalledTimes(1)
      expect(toast.success).toHaveBeenCalledWith(
        Costs['write.paymentDeleted'],
        expect.anything(),
      )
    })

    it('still reports the failure when the payment is there, or the trip cannot be read', async () => {
      vi.mocked(deletePaymentFn).mockRejectedValue(new Error('refused'))
      const { result } = renderHook(() => useCostsActions(PAYLOAD), { wrapper })

      vi.mocked(loadCosts).mockResolvedValueOnce({ ...PAYLOAD, found: true })
      await expect(
        act(() => result.current.removePayment(PAYMENT)),
      ).rejects.toThrow('refused')

      vi.mocked(loadCosts).mockRejectedValueOnce(new Error('offline'))
      await expect(
        act(() => result.current.removePayment(PAYMENT)),
      ).rejects.toThrow('refused')

      vi.mocked(loadCosts).mockResolvedValueOnce({ found: false })
      await expect(
        act(() => result.current.removePayment(PAYMENT)),
      ).rejects.toThrow('refused')

      expect(toast.error).toHaveBeenCalledTimes(3)
      expect(toast.success).not.toHaveBeenCalled()
    })
  })
})
