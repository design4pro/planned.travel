import './prices.fixture'
import { expect, it, vi } from 'vitest'
import { processPolarDelivery } from '../webhook'
import {
  createHarness,
  polarSubscription,
  TEST_ORG_ID,
  TEST_SUBSCRIPTION_ID,
} from './harness'

const activation = vi.hoisted(() => ({ enabled: false }))
vi.mock('#/server/workspace-deletion/activation', () => ({
  workspaceDeletionActivated: () => activation.enabled,
}))

it('admits late-subscription follow-up only after activation, without a provider call or missing-tenant writes', async () => {
  for (const enabled of [false, true]) {
    activation.enabled = enabled
    const h = createHarness()
    h.runtime.subscriptions.workspaceDeletionPending = async () => false
    h.runtime.subscriptions.organizationExists = async () => false
    const request = vi.spyOn(h.runtime.polar, 'request')
    const outcome = await processPolarDelivery(h.runtime, {
      eventId: `event-${enabled}`,
      type: 'subscription.updated',
      sentAt: h.runtime.now(),
      data: polarSubscription(),
    })
    expect(outcome.result).toBe('ignored')
    expect(h.tasks.sent).toEqual(
      enabled
        ? [
            {
              kind: 'workspace-late-subscription',
              organizationId: TEST_ORG_ID,
              providerEventId: 'event-true',
              providerSubscriptionId: TEST_SUBSCRIPTION_ID,
            },
          ]
        : [],
    )
    expect(request).not.toHaveBeenCalled()
  }
})

it.each([
  { exists: false, ending: true },
  { exists: true, ending: false },
])(
  'does not enqueue for an ending subscription or a live workspace: %o',
  async ({ exists, ending }) => {
    activation.enabled = true
    const h = createHarness()
    h.runtime.subscriptions.workspaceDeletionPending = async () => false
    h.runtime.subscriptions.organizationExists = async () => exists
    await processPolarDelivery(h.runtime, {
      eventId: 'event',
      type: 'subscription.updated',
      sentAt: h.runtime.now(),
      data: polarSubscription({ cancel_at_period_end: ending }),
    })
    expect(
      h.tasks.sent.filter(
        (task) => task.kind === 'workspace-late-subscription',
      ),
    ).toEqual([])
  },
)
it('does not acknowledge lost continuation admission for a deleted workspace', async () => {
  activation.enabled = true
  const h = createHarness()
  h.runtime.subscriptions.organizationExists = async () => false
  h.runtime.tasks.send = async () => {
    throw new Error('queue unavailable')
  }
  await expect(
    processPolarDelivery(h.runtime, {
      eventId: 'event',
      type: 'subscription.updated',
      sentAt: h.runtime.now(),
      data: polarSubscription(),
    }),
  ).rejects.toThrow('queue unavailable')
})
