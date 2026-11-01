/**
 * The billing screen's promotion-code wiring: what it sends, where a refusal lands, and the alerts
 * the redirect back raises. The field itself is `promotion-code.test.tsx`'s subject; this file mounts
 * the real page, with the router and the server functions stubbed, because the branches under test
 * live in `BillingPage` and nowhere else.
 */
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Ui from '#/lib/i18n/messages/en/ui'
import { setWorkspaceClaim } from '#/lib/workspace-claim-store'
import { PLANS } from '#/lib/plans'
import { Route } from '../../billing'

import type { PublicFailure } from '#/lib/errors'
import type { Catalogue } from '#/lib/i18n'
import type { QuotaKey } from '#/lib/plans'
import type { BillingPayload } from '../../../-server/billing'
import type { InvoiceSummary } from '#/server/billing/checkout'
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
vi.mock('../../../-server/local-billing', () => ({ loadLocalBilling: vi.fn() }))

const assign = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  setWorkspaceClaim('org_test')
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
    viewerId: 'viewer',
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
    [1, 2, '1 left', 'bg-brand'],
    [119, 150, '31 left', 'bg-brand'],
    [120, 150, '30 left', 'bg-warning'],
    [2, 2, 'The places allowance is used up', 'bg-danger'],
    [4, 2, 'Above the places limit by 2', 'bg-danger'],
    [0, 0, 'The places allowance is used up', 'bg-danger'],
  ])(
    'renders finite places usage %s / %s even on Crew',
    (used, limit, hint, tone) => {
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
      expect(bar.innerHTML).toContain(String(tone))
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

const REFERENCE = 'e6d9e6f2af034cd89c4f6efc9d5af2e6'

/** What the redaction middleware makes of a thrown value by the time it reaches the browser. */
function arrived(failure: PublicFailure): Error {
  return new Error(encodePublicFailure(failure))
}

const PAID_ORDER: InvoiceSummary = {
  id: 'ord_1',
  number: 'DESIGN4PRO-WOZUHKWCOF-0001',
  status: 'paid',
  createdAt: '2026-10-01T00:00:00.000Z',
  total: 0,
  currency: 'USD',
  invoiceGenerated: false,
}

/** The envelope, a status code, a request path or an id: none of it may be on the screen. */
const NEVER_SHOWN =
  /planned-travel\/failure|\{|Polar (GET|POST|PATCH)|\/v1\/|wrangler|ord_1/

async function openInvoiceFailing(cause: Error): Promise<HTMLElement> {
  server.downloadInvoice.mockRejectedValue(cause)
  renderPage(payload({ invoices: [PAID_ORDER] }))
  const user = userEvent.setup()
  const [pdf] = screen.getAllByRole('button', {
    name: 'Invoice DESIGN4PRO-WOZUHKWCOF-0001 as PDF',
  })
  await user.click(pdf as HTMLElement)
  return await screen.findByText('That invoice did not open')
}

describe('a failed billing action on the billing page', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockReturnValue(null)
  })

  it('explains an unexpected invoice failure in words and quotes the reference', async () => {
    const title = await openInvoiceFailing(
      arrived({ kind: 'unexpected', reference: REFERENCE }),
    )
    const alert = title.closest(
      '[role="alert"], [role="status"]',
    ) as HTMLElement

    expect(
      within(alert).getByText(
        `The billing provider rejected that request. Try again in a moment. Reference for support: ${REFERENCE}`,
      ),
    ).not.toBeNull()
    expect(alert.textContent).not.toMatch(NEVER_SHOWN)
  })

  it('says an order cannot be invoiced, with the next step, instead of a generic failure', async () => {
    const title = await openInvoiceFailing(
      arrived({
        kind: 'unexpected',
        code: 'BILLING_ORDER_NOT_INVOICEABLE',
        reference: REFERENCE,
      }),
    )
    const alert = title.closest(
      '[role="alert"], [role="status"]',
    ) as HTMLElement

    expect(alert.textContent).toContain(
      'Polar cannot issue an invoice for this order.',
    )
    expect(alert.textContent).toContain('add them in the billing portal')
    expect(alert.textContent).toContain(REFERENCE)
    expect(alert.textContent).not.toMatch(NEVER_SHOWN)
  })

  it('never prints a raw provider message that skipped the envelope', async () => {
    const title = await openInvoiceFailing(
      new Error('Polar GET /v1/orders/ord_1 failed with 500.'),
    )
    const alert = title.closest(
      '[role="alert"], [role="status"]',
    ) as HTMLElement

    expect(alert.textContent).not.toMatch(NEVER_SHOWN)
    expect(alert.textContent).toContain('The billing provider rejected')
  })

  it('shows the sentence of a refusal in English, marked as such', async () => {
    const title = await openInvoiceFailing(
      arrived({ kind: 'refusal', message: 'That invoice is not yours.' }),
    )
    const alert = title.closest(
      '[role="alert"], [role="status"]',
    ) as HTMLElement

    expect(
      within(alert).getByText('That invoice is not yours.').closest('[lang]'),
    ).toHaveProperty('lang', 'en')
  })

  it('reads the failure of the portal button the same way', async () => {
    server.openBillingPortal.mockRejectedValue(
      arrived({
        kind: 'unexpected',
        code: 'BILLING_RATE_LIMITED',
        reference: REFERENCE,
      }),
    )
    renderPage()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Manage billing' }))

    const message = await screen.findByText(/Polar is busy right now\./)
    expect(message.textContent).toContain(REFERENCE)
    expect(message.textContent).not.toMatch(NEVER_SHOWN)
  })

  it('reads a plan change failure the same way', async () => {
    server.startPlanChange.mockRejectedValue(
      arrived({
        kind: 'unexpected',
        code: 'BILLING_PROVIDER_REFUSED',
        reference: REFERENCE,
      }),
    )
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

    const user = userEvent.setup()
    const [choose] = screen.getAllByRole('button', { name: /^Upgrade to / })
    await user.click(choose as HTMLElement)

    const message = await screen.findByText(
      /Polar would not accept that change\./,
    )
    expect(message.textContent).toContain(REFERENCE)
    expect(message.textContent).not.toMatch(NEVER_SHOWN)
  })
})

describe('billing return handoff', () => {
  it.each(['checkout', 'applied', 'unchanged', 'discount_applied'])(
    'retains display selection only for a real %s handoff',
    async (surface) => {
      server.startPlanChange.mockResolvedValue({
        surface,
        url: '/billing-return',
      })
      renderPage(
        payload({
          entitlements: crewWorkspace({
            planId: 'free',
            status: 'none',
            interval: null,
          }),
        }),
      )
      const user = userEvent.setup()
      await user.click(
        screen.getAllByRole('button', {
          name: /^Upgrade to /,
        })[0] as HTMLElement,
      )
      expect(assign).toHaveBeenCalledWith('/billing-return')
      const stored = sessionStorage.getItem('billing-selection')
      if (surface === 'checkout' || surface === 'applied') {
        expect(JSON.parse(stored ?? 'null')).toMatchObject({
          organizationId: 'org_test',
          viewerId: 'viewer',
          planId: 'solo',
          interval: 'monthly',
          operation: surface === 'checkout' ? 'checkout' : 'plan',
        })
        expect(stored).not.toContain('checkout_id')
      } else expect(stored).toBeNull()
    },
  )
  it('renders forged checkout returns as an accessible generic status', () => {
    renderPage(payload(), {
      checkout: 'complete',
      checkout_id: 'foreign-checkout',
    })
    const notice = screen
      .getByText('Checking billing status')
      .closest('[role="status"]')
    expect(notice?.getAttribute('aria-live')).toBe('polite')
    expect(screen.queryByText('Payment received')).toBeNull()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('foreign-checkout')
  })
})
