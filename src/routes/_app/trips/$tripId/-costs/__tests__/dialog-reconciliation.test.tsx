import '#/components/ui/__tests__/test-env'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { ExpenseDialog } from '#/components/costs'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Ui from '#/lib/i18n/messages/en/ui'
import Modules from '#/lib/i18n/messages/en/modules'
import { createExpenseFn, loadCosts } from '#/server/fns/costs'
import { useCostsActions } from '../actions'
import type { CostsPayload } from '#/server/fns/costs'

vi.mock('#/server/fns/costs', () => ({
  createExpenseFn: vi.fn(),
  loadCosts: vi.fn(),
  updateExpenseFn: vi.fn(),
  deleteExpenseFn: vi.fn(),
  recordPaymentFn: vi.fn(),
  deletePaymentFn: vi.fn(),
  setDisplayCurrencyFn: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
afterEach(cleanup)
vi.setConfig({ testTimeout: 20000 })

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

function Editor() {
  const [open, setOpen] = useState(true)
  const actions = useCostsActions(PAYLOAD, open ? 1 : null)
  return (
    <ExpenseDialog
      open={open}
      onOpenChange={setOpen}
      expense={null}
      people={[
        { userId: 'u-ada', name: 'Ada', email: '', image: null, role: 'owner' },
        { userId: 'u-bo', name: 'Bo', email: '', image: null, role: 'editor' },
      ]}
      viewerUserId="u-ada"
      tripCurrency={actions.currency}
      categories={[{ value: 'food', label: 'Food', icon: null }]}
      defaultCategory="food"
      today={PAYLOAD.today}
      suggestedRate={null}
      onSubmit={actions.addExpense}
    />
  )
}

describe('money dialog with real router loader failures', () => {
  it.each(['costs', 'header', 'guard'] as const)(
    'preserves the draft before closing even when the next %s reload fails',
    async (failure) => {
      let fail = false
      const check = (name: string) => {
        if (fail && failure === name) throw new Error('reload offline')
      }
      const root = createRootRoute({ component: Outlet })
      const app = createRoute({
        getParentRoute: () => root,
        id: 'app',
        beforeLoad: () => check('guard'),
        component: Outlet,
        errorComponent: () => <p>Reload failed</p>,
      })
      const header = createRoute({
        getParentRoute: () => app,
        id: 'header',
        loader: () => check('header'),
        component: Outlet,
        errorComponent: () => <p>Reload failed</p>,
      })
      const costs = createRoute({
        getParentRoute: () => header,
        path: '/',
        loader: () => check('costs'),
        component: Editor,
        errorComponent: () => <p>Reload failed</p>,
      })
      const router = createRouter({
        routeTree: root.addChildren([
          app.addChildren([header.addChildren([costs])]),
        ]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
        defaultPendingMinMs: 0,
      })
      await router.load()
      render(
        <I18nProvider
          locale="en"
          messages={{
            ...namespaceCatalogue('costs', Costs),
            ...namespaceCatalogue('ui', Ui),
            ...namespaceCatalogue('modules', Modules),
          }}
        >
          <RouterProvider router={router} />
        </I18nProvider>,
      )
      const originalInvalidate = router.invalidate.bind(router)
      let openDuringRefresh: boolean | null = null
      const invalidate = vi
        .spyOn(router, 'invalidate')
        .mockImplementation((options) => {
          openDuringRefresh =
            document.querySelector('[role="dialog"][data-state="open"]') !==
            null
          return originalInvalidate(options)
        })
      vi.mocked(createExpenseFn)
        .mockRejectedValueOnce(new Error('costs.refusal.tripCurrencyChanged'))
        .mockResolvedValue({ expenseId: 'saved' })
      vi.mocked(loadCosts).mockResolvedValue({
        ...PAYLOAD,
        found: true,
        currency: 'JPY',
      })
      const user = userEvent.setup()
      await user.type(
        await screen.findByLabelText(/^What was it for/),
        'Dinner draft',
      )
      await user.type(screen.getByLabelText(/^Amount/), '4000')
      fail = true
      await user.click(screen.getByRole('button', { name: 'Add expense' }))
      await screen.findByText(/budget currency of this trip is now JPY/)
      const amount = screen.getByLabelText(/^Amount/)
      expect(amount).toHaveProperty('value', '4000')
      await vi.waitFor(() => expect(document.activeElement).toBe(amount))
      expect(
        screen.getByRole('button', { name: 'Add expense' }),
      ).toHaveProperty('disabled', true)
      expect(invalidate).not.toHaveBeenCalled()
      expect(screen.queryByText('Reload failed')).toBeNull()
      await user.clear(amount)
      await user.type(amount, '4000')
      await user.click(screen.getByRole('button', { name: 'Add expense' }))
      await screen.findByText('Reload failed')
      expect(createExpenseFn).toHaveBeenLastCalledWith({
        data: {
          tripId: PAYLOAD.tripId,
          expense: expect.objectContaining({
            currency: 'JPY',
            amountMinor: 4000,
          }),
        },
      })
      expect(createExpenseFn).toHaveBeenCalledTimes(2)
      expect(invalidate).toHaveBeenCalledOnce()
      expect(openDuringRefresh).toBe(false)
      expect(screen.queryByRole('dialog')).toBeNull()
      // TanStack resolves loader errors: a rejected mocked invalidation would miss this case.
      await act(async () => {
        await expect(invalidate.mock.results[0]?.value).resolves.toBeUndefined()
      })
      vi.clearAllMocks()
    },
  )
})
