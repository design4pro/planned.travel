// The dialogs mount Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Trips from '#/lib/i18n/messages/en/trips'
import Ui from '#/lib/i18n/messages/en/ui'
import { CostsScreen } from '../screen'

import type { Catalogue } from '#/lib/i18n'
import type { CostsPayload } from '#/server/fns/costs'

/**
 * A traveller who has left the trip is named the same way everywhere the costs screen names a
 * person (#1257): the balances rail, the payer column and both delete-confirm lists read the
 * payload's `departedPeople`, and fall back to the catalogue only when the workspace has no name.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('ui', Ui),
}

vi.mock('#/server/fns/costs', () => ({
  createExpenseFn: vi.fn(),
  updateExpenseFn: vi.fn(),
  deleteExpenseFn: vi.fn(),
  deletePaymentFn: vi.fn(),
  loadCosts: vi.fn(),
  recordPaymentFn: vi.fn(),
  setDisplayCurrencyFn: vi.fn(),
}))
vi.mock('#/server/fns/trip-currency', () => ({
  previewCurrencyChangeFn: vi.fn(),
  changeTripCurrencyFn: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => ({
    today: '2026-04-10',
    dayCount: 3,
    people: [],
    trip: {
      id: 'trip-1',
      title: 'Lisbon',
      slug: 'lisbon',
      summary: null,
      description: null,
      destination: null,
      status: 'booked',
      visibility: 'organization',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      timezone: null,
      currency: 'EUR',
      countryCodes: [],
      coverImageUrl: null,
      accentColour: null,
      budgetTargetMinor: null,
      isArchived: false,
    },
  }),
  useRouter: () => ({ invalidate: async () => undefined }),
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const MEMBER = { email: '', image: null, role: 'editor' }

const SHARE = { weight: 1, isSettled: false }

const DATA: CostsPayload = {
  tripId: 'trip-1',
  currency: 'EUR',
  today: '2026-04-10',
  startDate: '2026-04-10',
  endDate: '2026-04-13',
  plannedMinor: 0,
  spentMinor: 7_000,
  budgetTargetMinor: null,
  expenseCount: 2,
  byCategory: [],
  expenses: [
    {
      id: 'e-ferry',
      title: 'Ferry',
      category: 'transport',
      amountMinor: 4_000,
      currency: 'EUR',
      originalAmountMinor: null,
      originalCurrency: null,
      exchangeRate: null,
      convertedMinor: 4_000,
      spentOn: '2026-04-11',
      // Paid by someone who has left and holds no share: only the payer column names them.
      paidBy: 'u-pia',
      splitMethod: 'equal',
      notes: null,
      shares: [
        { userId: 'u-ada', shareMinor: 2_000, ...SHARE },
        { userId: 'u-grace', shareMinor: 2_000, ...SHARE },
      ],
    },
    {
      id: 'e-museum',
      title: 'Museum',
      category: 'activities',
      amountMinor: 3_000,
      currency: 'EUR',
      originalAmountMinor: null,
      originalCurrency: null,
      exchangeRate: null,
      convertedMinor: 3_000,
      spentOn: '2026-04-12',
      paidBy: 'u-ada',
      splitMethod: 'equal',
      notes: null,
      shares: [
        { userId: 'u-ada', shareMinor: 1_500, ...SHARE },
        { userId: 'u-otto', shareMinor: 1_500, ...SHARE },
      ],
    },
  ],
  balances: [
    {
      userId: 'u-pia',
      paidMinor: 4_000,
      shareMinor: 0,
      settledOutMinor: 0,
      settledInMinor: 0,
      balanceMinor: 4_000,
    },
    {
      userId: 'u-ghost',
      paidMinor: 0,
      shareMinor: 500,
      settledOutMinor: 0,
      settledInMinor: 0,
      balanceMinor: -500,
    },
  ],
  settlements: [
    {
      id: 'pay-1',
      fromUserId: 'u-grace',
      toUserId: 'u-otto',
      amountMinor: 3_000,
      currency: 'EUR',
      convertedMinor: 3_000,
      method: 'cash',
      settledOn: '2026-04-11',
      note: null,
    },
  ],
  suggestions: [],
  people: [
    { ...MEMBER, userId: 'u-ada', name: 'Ada Lovelace' },
    { ...MEMBER, userId: 'u-grace', name: 'Grace Hopper' },
  ],
  departedPeople: [
    { userId: 'u-pia', name: 'Pia Payer', image: null },
    { userId: 'u-otto', name: 'Otto Owed', image: null },
    { userId: 'u-ghost', name: null, image: null },
  ],
  viewerUserId: 'u-ada',
  displayCurrency: { mode: 'per-trip', code: 'EUR' },
  displayChoices: { workspaceCode: 'EUR', rateCodes: [] },
  unconverted: [],
  canWrite: true,
  suggestedRate: null,
}

function mount(): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <CostsScreen
        data={DATA}
        filters={{
          q: undefined,
          category: undefined,
          day: undefined,
          view: 'all',
        }}
        onFiltersChange={() => undefined}
      />
    </I18nProvider>,
  )
}

describe('a departed traveller on the costs screen', () => {
  it('is named in the payer column of an expense they paid but hold no share of', () => {
    mount()

    const row = screen.getByText('Ferry').closest('li')
    expect(row?.textContent).toContain('Pia Payer')
    expect(row?.textContent).not.toContain('Removed traveller')
  })

  it('is named in the balances, and worded from the catalogue only when the workspace has no name', () => {
    mount()

    const balances = screen
      .getByRole('heading', { level: 2, name: Costs['balances.label'] })
      .closest('div.min-w-0.flex-col')
    expect(balances?.textContent).toContain('Pia Payer')
    expect(balances?.textContent).toContain('Removed traveller')
  })

  it('is named in the delete-payment confirm, title and list', async () => {
    const user = userEvent.setup({ delay: null })
    mount()

    await user.click(
      screen.getByRole('button', { name: /^Delete the payment/ }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Otto Owed')
    expect(dialog.textContent).not.toContain('removed traveller')
  })

  it('is named in the delete-expense confirm list', async () => {
    const user = userEvent.setup({ delay: null })
    mount()

    await user.click(screen.getByRole('button', { name: 'Delete Museum' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Otto Owed/)).toBeTruthy()
    expect(dialog.textContent).not.toContain('removed traveller')
  })
})
