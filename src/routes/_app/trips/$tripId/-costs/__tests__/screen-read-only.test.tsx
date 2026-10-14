// The dialogs mount Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

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
 * The costs screen as a reader meets it (#837). The server refuses a viewer's writes; this is the
 * other half, the screen that stops offering them - a costs write is optimistic, so a control left
 * on screen would add an expense that then vanishes behind an error toast.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('ui', Ui),
}

// The optimistic actions import the write server functions, which reach `cloudflare:workers`; a
// reader's screen calls none of them.
vi.mock('#/server/fns/costs', () => ({
  createExpenseFn: vi.fn(),
  updateExpenseFn: vi.fn(),
  deleteExpenseFn: vi.fn(),
  recordPaymentFn: vi.fn(),
  setDisplayCurrencyFn: vi.fn(),
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

afterEach(cleanup)

const OWNER = { email: '', image: null, role: 'owner' }

function payload(overrides: Partial<CostsPayload>): CostsPayload {
  return {
    tripId: 'trip-1',
    currency: 'EUR',
    today: '2026-04-10',
    startDate: '2026-04-10',
    endDate: '2026-04-13',
    plannedMinor: 0,
    spentMinor: 6_000,
    budgetTargetMinor: null,
    expenseCount: 1,
    byCategory: [],
    expenses: [
      {
        id: 'e-1',
        title: 'Dinner',
        category: 'food',
        amountMinor: 6_000,
        currency: 'EUR',
        originalAmountMinor: null,
        originalCurrency: null,
        exchangeRate: null,
        convertedMinor: 6_000,
        spentOn: '2026-04-10',
        paidBy: 'u-ada',
        splitMethod: 'equal',
        notes: null,
        shares: [
          { userId: 'u-ada', shareMinor: 3_000, weight: 1, isSettled: false },
          { userId: 'u-grace', shareMinor: 3_000, weight: 1, isSettled: false },
        ],
      },
    ],
    balances: [
      {
        userId: 'u-ada',
        paidMinor: 6_000,
        shareMinor: 3_000,
        settledOutMinor: 0,
        settledInMinor: 0,
        balanceMinor: 3_000,
      },
      {
        userId: 'u-grace',
        paidMinor: 0,
        shareMinor: 3_000,
        settledOutMinor: 0,
        settledInMinor: 0,
        balanceMinor: -3_000,
      },
    ],
    settlements: [],
    suggestions: [
      { fromUserId: 'u-grace', toUserId: 'u-ada', amountMinor: 3_000 },
    ],
    people: [
      { ...OWNER, userId: 'u-ada', name: 'Ada Lovelace' },
      { ...OWNER, userId: 'u-grace', name: 'Grace Hopper', role: 'viewer' },
    ],
    departedPeople: [],
    viewerUserId: 'u-grace',
    displayCurrency: { mode: 'per-trip', code: 'EUR' },
    displayChoices: { workspaceCode: 'EUR', rateCodes: [] },
    unconverted: [],
    canWrite: false,
    suggestedRate: null,
    ...overrides,
  }
}

function mount(data: CostsPayload): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <CostsScreen
        data={data}
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

describe('the costs screen for someone who can write', () => {
  it('offers every write control and no read-only notice', () => {
    mount(payload({ canWrite: true }))

    expect(screen.getByRole('button', { name: 'Add expense' })).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Settle up' }),
    ).not.toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Edit Dinner' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete Dinner' })).toBeTruthy()
    expect(screen.queryByText(Costs['readOnly.title'])).toBeNull()
  })
})

describe('the costs screen for a reader', () => {
  it('shows the ledger and says, once, why it cannot be changed', () => {
    mount(payload({ canWrite: false }))

    expect(screen.getByText('Dinner')).toBeTruthy()
    const notice = screen.getByRole('status')
    expect(notice.textContent).toContain(Costs['readOnly.title'])
    expect(notice.textContent).toContain(Costs['readOnly.body'])
  })

  it('offers no way to add, edit, delete or settle, and keeps the export', () => {
    mount(payload({ canWrite: false }))

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull()
    expect(screen.queryByRole('button', { name: /settle/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /payment/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy()
  })

  it('shows an empty ledger with no call to add the first expense', () => {
    mount(
      payload({
        canWrite: false,
        expenses: [],
        expenseCount: 0,
        spentMinor: 0,
        balances: [],
        suggestions: [],
      }),
    )

    expect(screen.getByText(Costs['readOnly.empty'])).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Add the first expense' }),
    ).toBeNull()
  })

  it('does not tell a reader with nothing to settle to log an expense', () => {
    mount(payload({ canWrite: false, suggestions: [] }))

    expect(screen.getByText(Costs['readOnly.settleEmpty'])).toBeTruthy()
    expect(screen.queryByText(Costs['settle.empty.body'])).toBeNull()
  })
})
