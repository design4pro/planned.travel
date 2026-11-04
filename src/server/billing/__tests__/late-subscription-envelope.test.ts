import { expect, it, vi } from 'vitest'
import { createBillingTaskQueue, billingTaskId } from '../runtime.cloudflare'
import { taskEnvelopeSchema } from '#/server/queue/types'
import { createCapturingLogger, TEST_SUBSCRIPTION_ID } from './harness'
import type { BillingTask } from '../types'

vi.mock('cloudflare:workers', () => ({ env: {} }))
vi.mock('#/server/db/client', () => ({ getDb: () => undefined }))
vi.mock('#/server/metering/bindings', () => ({
  requestOutboundRuntime: () => undefined,
}))

it('maps a future late-subscription task to the registered envelope without a producer', async () => {
  const task: BillingTask = {
    kind: 'workspace-late-subscription',
    organizationId: 'gone',
    providerEventId: 'event',
    providerSubscriptionId: TEST_SUBSCRIPTION_ID,
  }
  const send = vi.fn<Queue<unknown>['send']>()
  await createBillingTaskQueue(
    { send, sendBatch: vi.fn(), metrics: vi.fn() },
    createCapturingLogger().logger,
  ).send(task)
  expect(taskEnvelopeSchema.parse(send.mock.calls[0]?.[0])).toMatchObject({
    id: billingTaskId(task),
    kind: task.kind,
    orgId: task.organizationId,
    payload: task,
  })
})
