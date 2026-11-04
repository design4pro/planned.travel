// Configure the product catalogue before any import evaluates it.
import './prices.fixture'

import { describe, expect, it, vi } from 'vitest'
import { SUBSCRIPTION_STATUSES } from '#/lib/plans'
import { subscriptionBlocksWorkspaceDeletion } from '../workspace-deletion-rule'
import { checkWorkspaceDeletionBilling } from '../workspace-deletion'
import { billingContext } from '../types'
import {
  createHarness,
  subscriptionRecord,
  TEST_ORG_ID,
  polarSubscription,
} from './harness'

const blocking = ['trialing', 'active', 'past_due', 'paused']

describe('subscriptionBlocksWorkspaceDeletion', () => {
  it.each(SUBSCRIPTION_STATUSES)(
    'handles %s with and without a provider id or scheduled ending',
    (status) => {
      for (const providerSubscriptionId of [null, 'subscription']) {
        for (const cancelAtPeriodEnd of [false, true]) {
          expect(
            subscriptionBlocksWorkspaceDeletion({
              status,
              providerSubscriptionId,
              cancelAtPeriodEnd,
            }),
          ).toBe(
            providerSubscriptionId !== null &&
              !cancelAtPeriodEnd &&
              blocking.includes(status),
          )
        }
      }
      expect(subscriptionBlocksWorkspaceDeletion(null)).toBe(false)
    },
  )
})

const page = (items: Array<unknown>, total = items.length, max = 1) => ({
  items,
  pagination: { total_count: total, max_page: max },
})

function gate(response: unknown) {
  const h = createHarness()
  const request = vi.fn().mockResolvedValue(response)
  const runtime = { ...h.runtime, polar: { request } }
  return {
    h,
    request,
    run: () =>
      checkWorkspaceDeletionBilling(billingContext(runtime, TEST_ORG_ID)),
  }
}

describe('authoritative workspace deletion billing gate', () => {
  it.each(SUBSCRIPTION_STATUSES)(
    'checks current provider status %s',
    async (status) => {
      const { run, request } = gate(page([polarSubscription({ status })]))
      expect(await run()).toBe(
        blocking.includes(status) ? 'live-subscription' : 'allowed',
      )
      expect(request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/subscriptions/',
        query: {
          external_customer_id: TEST_ORG_ID,
          page: 1,
          limit: 100,
        },
      })
    },
  )

  it('refuses on a live mirror even when Polar would be empty', async () => {
    const { h, run, request } = gate(page([]))
    h.store.seed(subscriptionRecord())
    expect(await run()).toBe('live-subscription')
    expect(request).not.toHaveBeenCalled()
  })

  it('allows an ending subscription and an empty provider list', async () => {
    expect(
      await gate(
        page([polarSubscription({ cancel_at_period_end: true })]),
      ).run(),
    ).toBe('allowed')
    expect(await gate(page([], 0, 0)).run()).toBe('allowed')
  })

  it('finds a blocker after the first page', async () => {
    const { run, request } = gate(null)
    request
      .mockResolvedValueOnce(
        page([polarSubscription({ status: 'canceled' })], 2, 2),
      )
      .mockResolvedValueOnce(page([polarSubscription({ id: 'second' })], 2, 2))
    expect(await run()).toBe('live-subscription')
    expect(request.mock.calls[1]?.[0].query.page).toBe(2)
  })

  it('accepts all pages when every subscription is ending', async () => {
    const { run, request } = gate(null)
    request
      .mockResolvedValueOnce(
        page([polarSubscription({ status: 'canceled' })], 2, 2),
      )
      .mockResolvedValueOnce(
        page(
          [polarSubscription({ id: 'second', cancel_at_period_end: true })],
          2,
          2,
        ),
      )
    expect(await run()).toBe('allowed')
  })

  it.each([
    null,
    {},
    { items: [] },
    page([{}]),
    page([{ ...polarSubscription(), status: 'unknown' }]),
    page([
      polarSubscription({ customer: { id: 'foreign', external_id: 'other' } }),
    ]),
    page([], 1, 1),
    page([], 1, 2),
    page([], 0, 101),
  ])(
    'fails closed on malformed or incomplete provider data %j',
    async (response) => {
      expect(await gate(response).run()).toBe('billing-unavailable')
    },
  )

  it('fails closed on duplicate pages', async () => {
    const { run, request } = gate(
      page([polarSubscription({ status: 'canceled' })], 2, 2),
    )
    expect(await run()).toBe('billing-unavailable')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('fails closed on provider or mirror errors', async () => {
    const { run, request, h } = gate(null)
    request.mockRejectedValue(new Error('offline'))
    expect(await run()).toBe('billing-unavailable')
    h.store.findByOrganization = async () => {
      throw new Error('D1 unavailable')
    }
    expect(await run()).toBe('billing-unavailable')
  })
})
