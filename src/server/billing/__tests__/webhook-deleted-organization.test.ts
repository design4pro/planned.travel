/**
 * A delivery for a workspace that has been deleted (#1057): accepted, and nothing is written.
 *
 * Deleting a workspace does not cancel its provider subscription - it refuses while one is live, but
 * a cancellation set for the end of the period passes - so Polar sends the cancellation, a final
 * invoice and a checkout update for an organization that is gone. The assertions run over the real
 * store and a database with foreign keys on, because a fake store cannot fail the way the
 * `organization_id` foreign key does, and a 500 here is retried until the endpoint is disabled.
 */

// Must come first: it configures the product ids `#/lib/plans` reads at import.
import { TEST_PRODUCT_IDS } from './prices.fixture'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createHarness as createDbHarness } from '#/server/repos/__tests__/harness'
import { deleteWorkspace } from '#/server/repos'
import { subscriptions } from '#/server/db/schema'
import { handlePolarWebhook } from '../webhook'
import { createSubscriptionStore } from '../store'
import {
  TEST_CHECKOUT_ID,
  TEST_CHECKOUT_URL,
  TEST_CUSTOMER_ID,
  TEST_SUBSCRIPTION_ID,
  createHarness,
  polarOrder,
  polarSubscription,
  signPolarWebhook,
  webhookRequest,
} from './harness'

import type {
  Harness as DbHarness,
  SeededTenant,
} from '#/server/repos/__tests__/harness'
import type { BillingRuntime } from '../types'
import type { Harness } from './harness'

const NOW = new Date('2026-08-19T12:00:00.000Z')

let db: DbHarness
let gone: SeededTenant
let live: SeededTenant
let runtime: BillingRuntime
let tasks: Harness['tasks']
let cache: Harness['cache']
let logs: Harness['logs']

beforeEach(async () => {
  db = await createDbHarness({ ddl: 'migrations' })
  gone = await db.seedTenant('gone')
  live = await db.seedTenant('live')
  await deleteWorkspace(gone.scope, { departingUserId: gone.ownerUserId })
  const h = createHarness({ now: NOW })
  runtime = { ...h.runtime, subscriptions: createSubscriptionStore(db.db) }
  tasks = h.tasks
  cache = h.cache
  logs = h.logs
})
afterEach(() => db.close())

async function deliver(type: string, data: unknown, webhookId: string) {
  const body = JSON.stringify({ type, timestamp: NOW.toISOString(), data })
  const headers = await signPolarWebhook(body, {
    timestampSeconds: Math.floor(NOW.getTime() / 1000),
    webhookId,
  })
  return handlePolarWebhook(runtime, webhookRequest(body, headers))
}

function subscriptionRows() {
  return db.db.select().from(subscriptions)
}

function forOrganization(organizationId: string) {
  return {
    customer: {
      id: TEST_CUSTOMER_ID,
      external_id: organizationId,
      email: 'owner@example.com',
    },
    metadata: { organizationId },
  }
}

describe('a billing webhook for a deleted organization', () => {
  it.each([
    'subscription.active',
    'subscription.canceled',
    'subscription.revoked',
    'subscription.updated',
  ])('accepts %s and creates no subscription row', async (type) => {
    const response = await deliver(
      type,
      polarSubscription(forOrganization(gone.organizationId)),
      `msg_${type}`,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(await subscriptionRows()).toEqual([])
    expect(tasks.sent).toEqual([])
    expect(cache.entries.has(`plan-state:${gone.organizationId}`)).toBe(false)
  })

  it('leaves a warning, the only trace that the provider may still be charging for it', async () => {
    await deliver(
      'subscription.active',
      polarSubscription(forOrganization(gone.organizationId)),
      'msg_warn',
    )

    expect(logs).toContainEqual({
      level: 'warn',
      message: 'billing.webhook.organization_gone',
      fields: {
        eventType: 'subscription.active',
        organizationId: gone.organizationId,
      },
    })
  })

  it('accepts a successful checkout and attaches no customer', async () => {
    const response = await deliver(
      'checkout.updated',
      {
        id: TEST_CHECKOUT_ID,
        status: 'succeeded',
        url: TEST_CHECKOUT_URL,
        product_id: TEST_PRODUCT_IDS.crewMonthly,
        subscription_id: TEST_SUBSCRIPTION_ID,
        external_customer_id: gone.organizationId,
        customer_id: TEST_CUSTOMER_ID,
        seats: 4,
        metadata: { organizationId: gone.organizationId },
      },
      'msg_checkout',
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(await subscriptionRows()).toEqual([])
  })

  it('accepts an order for it, which has no row to move', async () => {
    const response = await deliver(
      'order.paid',
      polarOrder(forOrganization(gone.organizationId)),
      'msg_order',
    )

    expect(response.status).toBe(200)
    expect(await subscriptionRows()).toEqual([])
    expect(tasks.sent).toEqual([])
  })

  it('still writes the row of a workspace that exists', async () => {
    const response = await deliver(
      'subscription.active',
      polarSubscription(forOrganization(live.organizationId)),
      'msg_live',
    )

    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'processed',
    })
    const rows = await subscriptionRows()
    expect(rows.map((row) => row.organizationId)).toEqual([live.organizationId])
  })
})
