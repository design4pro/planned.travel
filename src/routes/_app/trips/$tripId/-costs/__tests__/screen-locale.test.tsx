// The dialogs mount Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import CostsEn from '#/lib/i18n/messages/en/costs'
import CostsPl from '#/lib/i18n/messages/pl/costs'
import ModulesPl from '#/lib/i18n/messages/pl/modules'
import ShellPl from '#/lib/i18n/messages/pl/shell'
import TripsPl from '#/lib/i18n/messages/pl/trips'
import UiPl from '#/lib/i18n/messages/pl/ui'
import { CostsScreen } from '../screen'

import type { Catalogue } from '#/lib/i18n'
import type { CostsFilters } from '#/components/costs'
import type { CostsPayload } from '#/server/fns/costs'

/**
 * The costs screen in a locale that is not English (#1031).
 *
 * The English literals this change moved into the `costs` catalogue sat above an already translated
 * rail and read-only notice, so a Polish reader got a page in two languages, and a screen reader
 * switched voice mid-page (WCAG 2.2 3.1.2). The cases render the screen in `pl` and look for any
 * of the old English wording, in the text and in the accessible names.
 */
const PL: Catalogue = {
  ...namespaceCatalogue('costs', CostsPl),
  ...namespaceCatalogue('modules', ModulesPl),
  ...namespaceCatalogue('shell', ShellPl),
  ...namespaceCatalogue('trips', TripsPl),
  ...namespaceCatalogue('ui', UiPl),
}

vi.mock('#/server/fns/costs', () => ({
  createExpenseFn: vi.fn(),
  updateExpenseFn: vi.fn(),
  deleteExpenseFn: vi.fn(),
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

afterEach(cleanup)

const OWNER = { email: '', image: null, role: 'owner' }

const SHARES = [
  { userId: 'u-ada', shareMinor: 3_000, weight: 1, isSettled: false },
  { userId: 'u-grace', shareMinor: 3_000, weight: 1, isSettled: false },
]

const EXPENSE = {
  currency: 'EUR',
  originalAmountMinor: null,
  originalCurrency: null,
  exchangeRate: null,
  convertedMinor: 6_000,
  spentOn: '2026-04-10',
  splitMethod: 'equal',
  amountMinor: 6_000,
  shares: SHARES,
} as const

/** Everything the screen can say on its own behalf, with a row for each shape of line. */
function payload(overrides: Partial<CostsPayload> = {}): CostsPayload {
  return {
    tripId: 'trip-1',
    currency: 'EUR',
    today: '2026-04-10',
    startDate: '2026-04-10',
    endDate: '2026-04-13',
    plannedMinor: 0,
    spentMinor: 18_000,
    budgetTargetMinor: null,
    expenseCount: 3,
    byCategory: [
      { category: 'food', plannedMinor: 0, spentMinor: 6_000, expenseCount: 1 },
      {
        category: 'mystery',
        plannedMinor: 0,
        spentMinor: 6_000,
        expenseCount: 1,
      },
    ],
    expenses: [
      {
        ...EXPENSE,
        id: 'e-1',
        title: 'Dinner',
        category: 'food',
        paidBy: 'u-ada',
        notes: 'Shared the starters',
      },
      {
        ...EXPENSE,
        id: 'e-2',
        title: 'Souvenirs',
        category: 'mystery',
        paidBy: null,
        notes: null,
      },
      {
        ...EXPENSE,
        id: 'e-3',
        title: 'Taxi',
        category: 'transport',
        paidBy: 'u-gone',
        notes: null,
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
    ],
    settlements: [
      {
        id: 's-1',
        fromUserId: 'u-grace',
        toUserId: 'u-ada',
        amountMinor: 1_000,
        currency: 'EUR',
        convertedMinor: 1_000,
        method: 'bank_transfer',
        settledOn: '2026-04-11',
        note: null,
      },
      {
        id: 's-2',
        fromUserId: 'u-ada',
        toUserId: 'u-grace',
        amountMinor: 500,
        currency: 'EUR',
        convertedMinor: 500,
        method: 'barter',
        settledOn: '2026-04-11',
        note: null,
      },
    ],
    suggestions: [
      { fromUserId: 'u-grace', toUserId: 'u-ada', amountMinor: 2_000 },
    ],
    people: [
      { ...OWNER, userId: 'u-ada', name: 'Ada Lovelace' },
      { ...OWNER, userId: 'u-grace', name: 'Grace Hopper' },
    ],
    departedPeople: [],
    viewerUserId: 'u-grace',
    displayCurrency: { mode: 'per-trip', code: 'EUR' },
    displayChoices: { workspaceCode: 'EUR', rateCodes: [] },
    unconverted: [],
    canWrite: true,
    suggestedRate: null,
    ...overrides,
  }
}

const NO_FILTERS: CostsFilters = {
  q: undefined,
  category: undefined,
  day: undefined,
  view: 'all',
}

function mount(data: CostsPayload, filters: CostsFilters = NO_FILTERS) {
  return render(
    <I18nProvider locale="pl" messages={PL}>
      <CostsScreen
        data={data}
        filters={filters}
        onFiltersChange={() => undefined}
      />
    </I18nProvider>,
  )
}

/** The words a reader hears: visible text plus every accessible name. */
function spoken(container: HTMLElement): string {
  const names = [...container.querySelectorAll('[aria-label]')].map(
    (node) => node.getAttribute('aria-label') ?? '',
  )
  return [container.textContent ?? '', ...names].join('\n')
}

/** An English sentence the screen used to print on its own behalf. */
const OLD_ENGLISH: ReadonlyArray<string> = [
  'Export CSV',
  'Add expense',
  'Settle up',
  'Nothing spent yet',
  'You owe',
  "You're owed",
  'Outstanding',
  'Settle before you fly home',
  'Nothing owed to you',
  'Every expense has a payer',
  'with no payer yet',
  'No payer yet',
  'You paid',
  ' paid',
  'Removed traveller',
  'Someone',
  'not your share',
  ' yours',
  'Edit Dinner',
  'Delete Dinner',
  'Note on Dinner',
  'Accommodation',
  'Food & drink',
  'Other',
  'Bank transfer',
  'Something else',
  'spent',
  'expense',
]

describe('the costs screen in a locale that is not English', () => {
  it('says nothing on its own behalf in English', () => {
    const { container } = mount(payload())
    const heard = spoken(container)

    for (const phrase of OLD_ENGLISH) {
      expect(heard, phrase).not.toContain(phrase)
    }
  })

  it('translates the accessible names of the row actions and the note', () => {
    const { getByRole } = mount(payload())

    expect(
      getByRole('button', {
        name: CostsPl['row.edit'].replace('{title}', 'Dinner'),
      }),
    ).toBeTruthy()
    expect(
      getByRole('button', {
        name: CostsPl['row.delete'].replace('{title}', 'Dinner'),
      }),
    ).toBeTruthy()
    expect(
      getByRole('button', {
        name: CostsPl['row.noteOn'].replace('{title}', 'Dinner'),
      }),
    ).toBeTruthy()
  })

  it('names a category in the reader’s language and a retired one as "other"', () => {
    const { container } = mount(payload())
    const heard = spoken(container)

    expect(heard).toContain(CostsPl['category.food'])
    expect(heard).toContain(CostsPl['category.transport'])
    expect(heard).toContain(CostsPl['category.other'])
    expect(heard).not.toContain('mystery')
    expect(heard).not.toContain('category.')
  })

  it('names a payment method from the catalogue, an unknown one as "other"', () => {
    const { container } = mount(payload())
    const heard = spoken(container)

    expect(heard).toContain(CostsPl['payment.method.bankTransfer'])
    expect(heard).toContain(CostsPl['payment.method.other'])
    expect(heard).not.toContain('barter')
    expect(heard).not.toContain('Bank transfer')
  })

  it('describes a "paid by me" view without a message key or a lowercased label', () => {
    const { container } = mount(payload(), {
      ...NO_FILTERS,
      view: 'paid',
      q: 'taksówka',
    })
    const heard = spoken(container)

    expect(heard).toContain(CostsPl['toolbar.paidByMe'])
    expect(heard).toContain(
      CostsPl['toolbar.summary.search'].replace('{term}', 'taksówka'),
    )
    expect(heard).not.toMatch(/costs\.|shell\.|toolbar\./)
    expect(heard).not.toContain('Filtered')
  })

  it('names a filtered category with no rows left in the reader’s language, never as its stored token', () => {
    const { container } = mount(payload(), {
      ...NO_FILTERS,
      category: 'insurance',
    })
    const heard = spoken(container)

    expect(heard).toContain(CostsPl['category.insurance'])
    expect(heard).not.toMatch(/insurance/i)
  })

  it('names a filtered day with no rows left as a formatted date, not the stored one', () => {
    const { container } = mount(payload(), { ...NO_FILTERS, day: '2026-04-20' })

    expect(spoken(container)).not.toContain('2026-04-20')
  })

  it('picks the plural branch the locale needs for the expense count', () => {
    const one = mount(payload({ expenseCount: 1 }))
    expect(spoken(one.container)).toContain('1 wydatek')
    cleanup()

    const many = mount(payload({ expenseCount: 5 }))
    expect(spoken(many.container)).toContain('5 wydatków')
  })

  it('leaks no message key on the whole screen', () => {
    const { container } = mount(payload())

    expect(spoken(container)).not.toMatch(
      /\b(costs|shell|ui|trips|modules)\.[a-z]/,
    )
  })

  it('answers an empty ledger and an empty filter result in the reader’s language', () => {
    const empty = mount(
      payload({
        expenses: [],
        expenseCount: 0,
        spentMinor: 0,
        byCategory: [],
        balances: [],
        settlements: [],
        suggestions: [],
      }),
    )
    const heard = spoken(empty.container)

    expect(heard).toContain(CostsPl['screen.empty.title'])
    expect(heard).toContain(CostsPl['screen.addFirst'])
    expect(heard).not.toContain(CostsEn['screen.empty.title'])
    expect(heard).not.toContain(CostsEn['screen.addFirst'])
  })
})
