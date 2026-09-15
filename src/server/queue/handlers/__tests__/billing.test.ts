/**
 * The `billing.*` handlers, driven the way the consumer drives them.
 *
 * Everything below the handler is real: a fully migrated SQLite database from the Drizzle schema,
 * two real tenants, the real repositories, the real `dispatch()` and the real catalogue. The one
 * seam that is not real is the D1 handle — {@link createBillingHandlers} is built over the
 * harness's database instead of over a binding.
 *
 * The regression these cover is #304: before the handlers existed both kinds fell through
 * `runHandler` to `unhandled()` and dead-lettered on first delivery, so a plan change and a paid
 * invoice produced one error log and no follow-up at all.
 */
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { member } from '#/server/db/auth-schema'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import { listForEntity, setPreference } from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { taskHandlers } from '../../consumer'
import { TaskConfigurationError, TaskPermanentError } from '../../types'
import { createBillingHandlers } from '../billing'

import type { Notification } from '#/server/db/types'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TaskBindings, TaskContext } from '../../types'

/* -------------------------------------------------------------------- setup */

const NOW = Date.parse('2026-09-14T09:00:00.000Z')

/** A Polar `webhook-id`: a UUID, which is what makes it fit the notification's `entityId`. */
const PROVIDER_EVENT_ID = '6f1f1e3a-2c9b-4f0d-9a3e-71b0c5d2a8e4'

/** A binding surface with nothing on it a follow-up can reach for by accident. */
function fakeEnv(overrides: Partial<TaskBindings> = {}): TaskBindings {
  return {
    KV: {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    },
    FILES: {
      get: async () => null,
      put: async () => undefined,
      head: async () => null,
      delete: async () => undefined,
      list: async () => ({ objects: [], truncated: false }),
    },
    TASKS: { send: async () => undefined, sendBatch: async () => undefined },
    // Present but never dereferenced: the handlers build their Drizzle handle through the injected
    // seam, so only the configuration guard reads this.
    DB: {} as TaskBindings['DB'],
    ...overrides,
  }
}

function context(orgId: string, env: TaskBindings = fakeEnv()): TaskContext {
  return {
    env,
    logger: createLogger({ level: 'error', sink: createMemorySink() }),
    now: () => NOW,
    attempt: 1,
    taskId: 'task-under-test',
    orgId,
    callProvider: (_label, send) => send(),
  }
}

let harness: Harness
let alpha: SeededTenant
let beta: SeededTenant

/** The shipped handlers, over the harness database rather than a D1 binding. */
const handlers = () => createBillingHandlers(() => harness.db)

beforeEach(async () => {
  harness = await createHarness()
  alpha = await harness.seedTenant('alpha')
  beta = await harness.seedTenant('beta')
})

afterEach(() => {
  harness.close()
})

const subscriptionChanged = (status: string = 'active') => ({
  kind: 'billing.subscription.changed' as const,
  organizationId: alpha.organizationId,
  providerEventId: PROVIDER_EVENT_ID,
  planId: 'crew' as const,
  previousPlanId: 'free' as const,
  status: status as 'active',
})

const invoicePaid = () => ({
  kind: 'billing.invoice.paid' as const,
  organizationId: alpha.organizationId,
  providerEventId: PROVIDER_EVENT_ID,
  providerOrderId: 'ord_9f2c',
  amountPaid: 1200,
  currency: 'EUR',
})

/** Who an entity's rows were written for, sorted so the assertion does not depend on insert order. */
function recipientsOf(rows: ReadonlyArray<Notification>): Array<string> {
  return rows.map((row) => row.recipientUserId).sort()
}

/* -------------------------------------------------------------------- tests */

describe('billing follow-ups', () => {
  it('is registered for both kinds the billing webhook enqueues', () => {
    // The whole of #304: a `case` without a registry entry dead-letters on first delivery.
    expect(taskHandlers['billing.subscription.changed']).toBeDefined()
    expect(taskHandlers['billing.invoice.paid']).toBeDefined()
  })

  it('tells a workspace’s owners and admins that the plan changed, and nobody else', async () => {
    const adminId = await alpha.addUser('Admin alpha', 'admin')
    const memberId = await alpha.addUser('Member alpha')

    const metrics = await handlers().subscriptionChanged(
      subscriptionChanged(),
      context(alpha.organizationId),
    )

    const rows = await listForEntity(
      alpha.scope,
      'subscription',
      PROVIDER_EVENT_ID,
    )
    expect(recipientsOf(rows)).toEqual([alpha.ownerUserId, adminId].sort())
    expect(recipientsOf(rows)).not.toContain(memberId)
    expect(metrics).toMatchObject({ event: 'billing.plan_changed' })
  })

  it('renders the plan change through the shipped catalogue key and its params', async () => {
    await handlers().subscriptionChanged(
      subscriptionChanged(),
      context(alpha.organizationId),
    )

    const row = (
      await listForEntity(alpha.scope, 'subscription', PROVIDER_EVENT_ID)
    )[0]
    expect(row).toMatchObject({
      scope: 'organization',
      titleKey: 'billing.plan_changed',
      bodyKey: 'billing.plan_changed',
      actionUrl: '/settings/billing',
    })
    // The workspace's own name and the catalogue plan's — both substituted, neither hardcoded.
    expect(row.titleParams).toEqual({
      organizationName: 'Workspace alpha',
      plan: 'Crew',
    })
  })

  it('calls a past-due move a failed payment rather than a plan change', async () => {
    // The webhook's dunning path enqueues `billing.subscription.changed` with `past_due`, which is
    // the only shape a failed payment has — telling that customer "you are now on Crew" is wrong.
    await handlers().subscriptionChanged(
      subscriptionChanged('past_due'),
      context(alpha.organizationId),
    )

    const row = (
      await listForEntity(alpha.scope, 'subscription', PROVIDER_EVENT_ID)
    )[0]
    expect(row.titleKey).toBe('billing.payment_failed')
    expect(row.titleParams).toEqual({ organizationName: 'Workspace alpha' })
  })

  it('writes a receipt for a paid invoice', async () => {
    const adminId = await alpha.addUser('Admin alpha', 'admin')

    await handlers().invoicePaid(invoicePaid(), context(alpha.organizationId))

    const rows = await listForEntity(alpha.scope, 'invoice', PROVIDER_EVENT_ID)
    expect(recipientsOf(rows)).toEqual([alpha.ownerUserId, adminId].sort())
    expect(rows[0]).toMatchObject({
      scope: 'organization',
      titleKey: 'billing.invoice_paid',
    })
  })

  it('honours a recipient who switched the event off', async () => {
    const adminId = await alpha.addUser('Admin alpha', 'admin')
    await setPreference(alpha.scopeFor(adminId), {
      userId: adminId,
      eventType: 'billing.invoice_paid',
      channel: 'in_app',
      isEnabled: false,
    })

    await handlers().invoicePaid(invoicePaid(), context(alpha.organizationId))

    const rows = await listForEntity(alpha.scope, 'invoice', PROVIDER_EVENT_ID)
    expect(recipientsOf(rows)).toEqual([alpha.ownerUserId])
  })

  it('writes nothing another tenant can read', async () => {
    await handlers().subscriptionChanged(
      subscriptionChanged(),
      context(alpha.organizationId),
    )

    expect(
      await listForEntity(beta.scope, 'subscription', PROVIDER_EVENT_ID),
    ).toEqual([])
  })

  it('fails permanently when the workspace has no owner to speak for it', async () => {
    // Not reachable through a sanctioned write path — `removeMember` and `changeMemberRole` both
    // refuse to take the last owner — so the row is broken directly. Five retries against a
    // membership that is not coming back would be five dead-letter records instead of one.
    await harness.db
      .update(member)
      .set({ role: 'member' })
      .where(eq(member.userId, alpha.ownerUserId))

    await expect(
      handlers().subscriptionChanged(
        subscriptionChanged(),
        context(alpha.organizationId),
      ),
    ).rejects.toBeInstanceOf(TaskPermanentError)
  })

  it('refuses to run without a database binding', async () => {
    await expect(
      handlers().invoicePaid(
        invoicePaid(),
        context(alpha.organizationId, fakeEnv({ DB: undefined })),
      ),
    ).rejects.toBeInstanceOf(TaskConfigurationError)
  })
})
