/**
 * The billing screen's promotion-code wiring: what it sends, where a refusal lands, and the alerts
 * the redirect back raises. The field itself is `promotion-code.test.tsx`'s subject; this file mounts
 * the real page, with the router and the server functions stubbed, because the branches under test
 * live in `BillingPage` and nowhere else.
 */
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Ui from '#/lib/i18n/messages/en/ui'
import { PLANS } from '#/lib/plans'
import { Route } from '../../billing'

import type { Catalogue } from '#/lib/i18n'
import type { QuotaKey } from '#/lib/plans'
import type { BillingPayload } from '../../../-server/billing'
import type { Entitlements, QuotaState } from '#/server/billing/types'
import type { ComponentType } from 'react'

const EN: Catalogue = {
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('ui', Ui),
}

/** What the stubbed route hands the page: the loader's payload and the search params. */
interface PageState {
  data: unknown
  search: Record<string, string | undefined>
}

const page = vi.hoisted((): PageState => ({ data: null, search: {} }))
const server = vi.hoisted(() => ({
  startPlanChange: vi.fn(),
  applyPromotionCode: vi.fn(),
  openBillingPortal: vi.fn(),
  downloadInvoice: vi.fn(),
  loadBilling: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useLoaderData: () => page.data,
    useSearch: () => page.search,
  }),
  useRouter: () => ({ invalidate: vi.fn() }),
}))
vi.mock('../../../-server/billing', () => server)

const assign = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  })
})
afterEach(cleanup)

function quota(key: QuotaKey, limit: number | null, used: number): QuotaState {
  return {
    key,
    limit,
    used,
    remaining: limit === null ? null : limit - used,
    ratio: limit === null || limit === 0 ? 0 : used / limit,
    exceeded: false,
  }
}

function crewWorkspace(overrides: Partial<Entitlements> = {}): Entitlements {
  const limits = PLANS.crew.limits
  return {
    organizationId: 'org_test',
    planId: 'crew',
    planName: 'Crew',
    status: 'active',
    interval: 'monthly',
    seats: 4,
    limits,
    usage: { seats: 2, trips: 1, storageBytes: 0 },
    quotas: {
      seats: quota('seats', limits.seats, 2),
      trips: quota('trips', limits.trips, 1),
      storageBytes: quota('storageBytes', limits.storageBytes, 0),
    },
    cancelAtPeriodEnd: false,
    currentPeriodEnd: '2026-10-01T00:00:00.000Z',
    trialEndsAt: null,
    trialing: false,
    hasProviderCustomer: true,
    pendingChange: null,
    ...overrides,
  }
}

function payload(overrides: Partial<BillingPayload> = {}): BillingPayload {
  return {
    entitlements: crewWorkspace(),
    places: { used: 0, limit: null },
    invoices: [],
    invoicesUnavailable: false,
    canManage: true,
    organizationName: 'Test workspace',
    ...overrides,
  }
}

function renderPage(
  data: BillingPayload = payload(),
  search: Record<string, string | undefined> = {},
) {
  page.data = data
  page.search = search
  const BillingPage = (
    Route as unknown as { options: { component: ComponentType } }
  ).options.component
  return render(
    <I18nProvider locale="en" messages={EN}>
      <BillingPage />
    </I18nProvider>,
  )
}

async function typeCode(
  code: string,
): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: 'Have a promotion code?' }),
  )
  await user.type(screen.getByLabelText('Promotion code'), code)
  return user
}

describe('the billing page with a promotion code', () => {
  it('offers no code field to a member who cannot manage billing', () => {
    renderPage(payload({ canManage: false }))
    expect(
      screen.queryByRole('button', { name: 'Have a promotion code?' }),
    ).toBeNull()
  })

  it('applies a code to the current plan by sending the code alone', async () => {
    server.applyPromotionCode.mockResolvedValue({
      url: '/settings/billing?discount=applied',
      surface: 'discount_applied',
    })
    renderPage()

    const user = await typeCode('SUMMER20')
    await user.click(
      screen.getByRole('button', { name: 'Apply to current plan' }),
    )

    expect(server.applyPromotionCode).toHaveBeenCalledWith({
      data: { discountCode: 'SUMMER20' },
    })
    expect(assign).toHaveBeenCalledWith('/settings/billing?discount=applied')
  })

  it('offers no Apply button without a live subscription', async () => {
    renderPage(
      payload({
        entitlements: crewWorkspace({
          planId: 'free',
          status: 'none',
          interval: null,
          hasProviderCustomer: false,
        }),
      }),
    )
    await typeCode('SUMMER20')
    expect(
      screen.queryByRole('button', { name: 'Apply to current plan' }),
    ).toBeNull()
  })

  it('keeps the page and puts a refusal under the field', async () => {
    server.applyPromotionCode.mockResolvedValue({
      surface: 'discount_rejected',
      reason: 'rate_limited',
    })
    renderPage()

    const user = await typeCode('SUMMER20')
    await user.click(
      screen.getByRole('button', { name: 'Apply to current plan' }),
    )

    expect(assign).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Too many codes tried. Try again in an hour.'),
    ).not.toBeNull()
    expect(document.activeElement).toBe(screen.getByLabelText('Promotion code'))
  })

  it('sends nothing at all for a code of the wrong shape', async () => {
    renderPage()

    const user = await typeCode('NO')
    await user.click(
      screen.getByRole('button', { name: 'Apply to current plan' }),
    )

    expect(server.applyPromotionCode).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Codes are 3 to 64 letters and digits.'),
    ).not.toBeNull()
  })

  it('says a code applied on its own takes effect at the next renewal', () => {
    renderPage(payload(), { discount: 'applied' })
    expect(screen.queryByText('Promotion code applied')).not.toBeNull()
    expect(
      screen.queryByText('Your promotion code applies from your next renewal.'),
    ).not.toBeNull()
  })

  it('adds the renewal sentence to the plan-updated alert only when a code went with it', () => {
    renderPage(payload(), { plan: 'changed', discount: 'applied' })
    expect(screen.queryByText('Promotion code applied')).toBeNull()
    expect(
      screen.queryByText(/applies from your next renewal\.$/),
    ).not.toBeNull()

    cleanup()
    renderPage(payload(), { plan: 'changed' })
    expect(screen.queryByText(/applies from your next renewal/)).toBeNull()
  })
})

describe('places usage on the billing page', () => {
  it.each([
    [1, 2, '1 left'],
    [2, 2, 'The places allowance is used up'],
    [4, 2, 'Above the places limit by 2'],
    [0, 0, 'The places allowance is used up'],
  ])(
    'renders finite places usage %s / %s even on Crew',
    (used, limit, hint) => {
      renderPage(
        payload({
          places: { used: Number(used), limit: Number(limit) },
          canManage: false,
        }),
      )
      const bar = screen.getByRole('progressbar', { name: 'Places used' })
      expect(bar.getAttribute('aria-valuenow')).toBe(
        Number(limit) === 0
          ? '100'
          : String(Math.min(100, (Number(used) / Number(limit)) * 100)),
      )
      expect(screen.getByText(hint)).toBeTruthy()
      if (Number(used) >= Number(limit))
        expect(bar.innerHTML).toContain('bg-danger')
      expect(
        screen.getByText('Across all trips in this workspace'),
      ).toBeTruthy()
    },
  )

  it('renders an unlimited places allowance as a filled track', () => {
    renderPage(payload({ places: { used: 17, limit: null } }))
    expect(screen.getByText('17')).toBeTruthy()
    expect(
      screen.queryByRole('progressbar', { name: 'Places used' }),
    ).toBeNull()
    expect(
      screen.getByText('Places').closest('[data-places-meter]')?.textContent,
    ).toContain('Unlimited')
  })
})
