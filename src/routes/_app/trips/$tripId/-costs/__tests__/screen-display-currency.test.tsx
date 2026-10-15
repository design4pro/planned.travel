// The dialogs mount Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Trips from '#/lib/i18n/messages/en/trips'
import Ui from '#/lib/i18n/messages/en/ui'
import { setDisplayCurrencyFn } from '#/server/fns/costs'
import { CostsScreen } from '../screen'

import type { Catalogue } from '#/lib/i18n'
import type { CostsPayload } from '#/server/fns/costs'

/**
 * The display-currency choice on the costs screen (#844): the control, the quiet converted figure
 * on a row, the "not converted" marker and the alert that names the pair and the date.
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

beforeEach(() => {
  vi.mocked(setDisplayCurrencyFn).mockReset()
  vi.mocked(setDisplayCurrencyFn).mockResolvedValue({ code: null })
})

const FIXED = { mode: 'fixed', code: 'GBP' } as const

function withRow(convertedMinor: number | null): Partial<CostsPayload> {
  const [row] = payload({}).expenses
  return { expenses: [{ ...row, convertedMinor }] }
}

function live(): Element | null {
  return document.querySelector('[data-part="display-currency-live"]')
}

function indicator(): Element | null {
  return document.querySelector('[data-part="display-currency-indicator"]')
}

const SETTLEMENT = {
  id: 's-1',
  fromUserId: 'u-grace',
  toUserId: 'u-ada',
  amountMinor: 1_000,
  currency: 'EUR',
  convertedMinor: 850,
  method: 'cash',
  settledOn: '2026-04-11',
  note: null,
}

describe('the display currency on the costs screen', () => {
  it('shows no converted figure and no alert while every trip is in its own currency', () => {
    mount(payload({ canWrite: true }))

    expect(indicator()?.textContent).toBe(Costs['display.indicator.perTrip'])
    expect(document.querySelector('[data-part="converted-figure"]')).toBeNull()
    expect(screen.queryByText(Costs['display.alert.title'])).toBeNull()
  })

  it('adds the converted figure, written with its code, beside the unchanged large amount', () => {
    mount(
      payload({
        canWrite: true,
        displayCurrency: FIXED,
        ...withRow(5_100),
      }),
    )

    expect(indicator()?.textContent).toBe('Also in GBP')
    const figure = document.querySelector('[data-part="converted-figure"]')
    expect(figure?.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      '≈ 51.00 GBP',
    )
    expect(figure?.querySelector('.sr-only')?.textContent).toBe(
      'About 51.00 GBP in your display currency',
    )
    expect(figure?.hasAttribute('aria-label')).toBe(false)
    expect(screen.getAllByText('€60.00').length).toBeGreaterThan(0)
  })

  it('marks a row no rate converted and names the pair and the date once, never as 1:1', () => {
    mount(
      payload({
        canWrite: true,
        displayCurrency: FIXED,
        unconverted: [{ from: 'EUR', to: 'GBP', on: '2026-04-10' }],
        ...withRow(null),
      }),
    )

    expect(screen.getByText(Costs['display.row.notConverted'])).toBeTruthy()
    expect(document.body.textContent).not.toContain('60.00 GBP')
    const alert = screen.getByText(Costs['display.alert.title']).closest('div')
    expect(alert?.textContent).toContain('EUR to GBP on')
  })

  it('names the control and writes the choice, null for each trip in its own currency', async () => {
    const user = userEvent.setup()
    mount(
      payload({
        canWrite: true,
        displayCurrency: FIXED,
        displayChoices: { workspaceCode: 'EUR', rateCodes: ['GBP'] },
        ...withRow(5_100),
      }),
    )

    await user.click(
      screen.getByRole('combobox', { name: Costs['display.label'] }),
    )
    await user.click(
      screen.getByRole('option', { name: /Each trip in its own currency/ }),
    )

    await waitFor(() =>
      expect(setDisplayCurrencyFn).toHaveBeenCalledWith({
        data: { code: null },
      }),
    )
  })

  it('lists every other curated code as disabled, with the reason in words', async () => {
    const user = userEvent.setup()
    mount(
      payload({
        canWrite: true,
        displayChoices: { workspaceCode: 'EUR', rateCodes: [] },
      }),
    )

    await user.click(
      screen.getByRole('combobox', { name: Costs['display.label'] }),
    )

    const usd = screen.getByRole('option', { name: /USD/ })
    expect(usd.getAttribute('aria-disabled')).toBe('true')
    expect(usd.textContent).toContain(Costs['display.menu.needsLiveRate'])
  })
  it('keeps the trigger focusable while the choice is saving and ignores a second pick', async () => {
    const user = userEvent.setup()
    let finish: (value: { code: string | null }) => void = () => undefined
    vi.mocked(setDisplayCurrencyFn).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    mount(
      payload({
        canWrite: true,
        displayChoices: { workspaceCode: 'EUR', rateCodes: ['GBP'] },
      }),
    )
    const trigger = () =>
      screen.getByRole('combobox', { name: Costs['display.label'] })

    await user.click(trigger())
    await user.click(screen.getByRole('option', { name: /GBP/ }))

    await waitFor(() =>
      expect(live()?.textContent).toBe(Costs['display.menu.saving']),
    )
    expect(trigger().hasAttribute('disabled')).toBe(false)
    // The visible saving state is the badge's dot; its text stays the indicator.
    expect(indicator()?.querySelector('span.rounded-full')).not.toBeNull()
    expect(indicator()?.textContent).toBe(Costs['display.indicator.perTrip'])
    await user.click(trigger())
    await user.click(screen.getByRole('option', { name: /workspace default/ }))
    expect(setDisplayCurrencyFn).toHaveBeenCalledTimes(1)

    finish({ code: 'GBP' })
    await waitFor(() =>
      expect(live()?.textContent).not.toBe(Costs['display.menu.saving']),
    )
    expect(indicator()?.querySelector('span.rounded-full')).toBeNull()
  })

  it('hands an option its reason as an accessible description', async () => {
    const user = userEvent.setup()
    mount(payload({ canWrite: true }))

    await user.click(
      screen.getByRole('combobox', { name: Costs['display.label'] }),
    )

    const usd = screen.getByRole('option', { name: /USD/ })
    const describedBy = usd.getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      Costs['display.menu.needsLiveRate'],
    )
  })

  it('keeps the control reachable on a trip that has payments and no expenses', () => {
    mount(
      payload({
        canWrite: true,
        displayCurrency: FIXED,
        expenses: [],
        expenseCount: 0,
        spentMinor: 0,
        settlements: [SETTLEMENT],
      }),
    )

    expect(
      screen.getByRole('combobox', { name: Costs['display.label'] }),
    ).toBeTruthy()
    expect(indicator()?.textContent).toBe('Also in GBP')
  })

  it('shows no converted figure on a payment still being recorded', () => {
    mount(
      payload({
        canWrite: true,
        displayCurrency: FIXED,
        settlements: [
          { ...SETTLEMENT, id: 'pending-s-1', convertedMinor: null },
        ],
      }),
    )

    expect(screen.queryByText(Costs['display.row.notConverted'])).toBeNull()
  })
})
