// The dialogs mount Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
vi.mock('#/server/fns/trip-currency', () => ({
  previewCurrencyChangeFn: vi.fn(),
  changeTripCurrencyFn: vi.fn(),
}))
const trip = vi.hoisted(() => ({ archived: false }))
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
      isArchived: trip.archived,
    },
  }),
  useRouter: () => ({ invalidate: async () => undefined }),
}))

afterEach(() => {
  cleanup()
  trip.archived = false
})

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
    departedPeople: [],
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

/**
 * The owner-only "Change budget currency" button on the Costs tab (#841): present for the owner of
 * a live trip after the other header actions, absent for everyone else, and it opens the dialog.
 */
const HOOK = '[data-part="trip-currency-change"]'

function hook(): HTMLElement | null {
  return document.querySelector<HTMLElement>(HOOK)
}

describe('the budget currency button', () => {
  it("is offered to the owner, after the screen's other header actions", () => {
    mount(payload({ canWrite: true, viewerUserId: 'u-ada' }))

    const button = hook()
    expect(button).not.toBeNull()
    const names = Array.from(
      button?.parentElement?.querySelectorAll('button') ?? [],
    ).map((control) => control.textContent)
    expect(names).toEqual([
      'Export CSV',
      'Settle up',
      'Add expense',
      'Change budget currency',
    ])
  })

  it('takes its own row on a narrow screen and shrinks to its label on a wide one', () => {
    mount(payload({ canWrite: true, viewerUserId: 'u-ada' }))

    expect(hook()?.className).toContain('basis-full')
    expect(hook()?.className).toContain('sm:basis-auto')
  })

  it('is absent for an editor and for a viewer', () => {
    mount(
      payload({
        canWrite: true,
        viewerUserId: 'u-grace',
        people: [
          { ...OWNER, userId: 'u-ada', name: 'Ada Lovelace' },
          { ...OWNER, userId: 'u-grace', name: 'Grace Hopper', role: 'editor' },
        ],
      }),
    )
    expect(hook()).toBeNull()
    cleanup()

    mount(payload({ canWrite: false, viewerUserId: 'u-grace' }))
    expect(hook()).toBeNull()
  })

  it('is absent from an archived trip, which the server would refuse', () => {
    trip.archived = true
    mount(payload({ canWrite: true, viewerUserId: 'u-ada' }))

    expect(hook()).toBeNull()
  })

  it('opens the dialog', async () => {
    mount(payload({ canWrite: true, viewerUserId: 'u-ada' }))

    await userEvent.setup().click(hook() as HTMLElement)

    expect(
      await screen.findByRole('dialog', { name: Costs['rebase.title'] }),
    ).toBeTruthy()
  })
})
