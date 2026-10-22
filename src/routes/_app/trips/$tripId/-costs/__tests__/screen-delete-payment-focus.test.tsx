// The dialogs mount Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Trips from '#/lib/i18n/messages/en/trips'
import Ui from '#/lib/i18n/messages/en/ui'
import { deletePaymentFn } from '#/server/fns/costs'
import { CostsScreen } from '../screen'

import type { Catalogue } from '#/lib/i18n'
import type { CostsPayload } from '#/server/fns/costs'

/**
 * Where keyboard focus lands when the delete-payment dialog closes (WCAG 2.4.3). The dialog's own
 * "Keep it" button takes focus on open, so the dialog cannot find its way back to the row's delete
 * button by itself: the screen names the place.
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

const DATA: CostsPayload = {
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
  settlements: [
    {
      id: 'pay-1',
      fromUserId: 'u-grace',
      toUserId: 'u-ada',
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
  departedPeople: [],
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

const openerButton = () =>
  screen.getByRole('button', { name: /^Delete the payment/ })

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  const opener = openerButton()
  await user.click(opener)
  await screen.findByRole('dialog')
  return opener
}

describe('focus after the delete-payment dialog closes', () => {
  it('returns to the delete button when the person keeps the payment', async () => {
    const user = userEvent.setup({ delay: null })
    mount()

    const opener = await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Keep it' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(opener)
    expect(deletePaymentFn).not.toHaveBeenCalled()
  })

  it('lands on the Payments list once the delete has taken the button away', async () => {
    const user = userEvent.setup({ delay: null })
    vi.mocked(deletePaymentFn).mockResolvedValue(undefined as never)
    mount()

    await openDialog(user)
    await user.click(
      screen.getByRole('button', { name: Costs['delete.payment.confirm'] }),
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(
      screen.getByRole('group', { name: Costs['payments.label'] }),
    )
  })

  it('lands on the Payments list when the click never focused the button (Safari, Firefox on macOS)', async () => {
    const user = userEvent.setup({ delay: null })
    mount()

    // `fireEvent.click` does not move focus, which is what those browsers do on a mouse click.
    fireEvent.click(openerButton())
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Keep it' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(
      screen.getByRole('group', { name: Costs['payments.label'] }),
    )
  })
})
