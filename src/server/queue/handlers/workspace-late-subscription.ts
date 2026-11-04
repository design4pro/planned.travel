import { drizzle } from 'drizzle-orm/d1'
import { createPolarClient, PolarApiError } from '#/server/billing/polar'
import type { PolarFetch } from '#/server/billing/polar'
import { createSubscriptionStore } from '#/server/billing/store'
import { BillingConfigError } from '#/server/billing/types'
import {
  deletionSubscriptionSchema,
  providerSubscriptionBlocksWorkspaceDeletion,
} from '#/server/billing/workspace-deletion'
import type { DatabaseFor } from './billing'
import {
  TaskConfigurationError,
  TaskPermanentError,
  TaskRetryableError,
  workspaceLateSubscriptionPayloadSchema,
} from '../types'
import type { TaskHandler } from '../types'

/** Inert until the later webhook producer release; always re-check current provider state. */
export function createWorkspaceLateSubscriptionHandler(
  databaseFor: DatabaseFor = (binding) => drizzle(binding),
  send: PolarFetch = (input, init) => fetch(input, init),
): TaskHandler<'workspace-late-subscription'> {
  return async (input, context) => {
    const payload = workspaceLateSubscriptionPayloadSchema.parse(input)
    if (payload.organizationId !== context.orgId) {
      throw new TaskPermanentError(
        'Late subscription tenant does not match the envelope',
      )
    }
    if (!context.env.DB)
      throw new TaskConfigurationError('DB is required for late subscriptions')
    const store = createSubscriptionStore(databaseFor(context.env.DB))
    if (await store.organizationExists(context.orgId))
      return { outcome: 'organization-exists' }

    const fields = {
      organizationId: context.orgId,
      providerSubscriptionId: payload.providerSubscriptionId,
    }
    try {
      const polar = createPolarClient({
        accessToken: context.env.POLAR_ACCESS_TOKEN,
        server: context.env.POLAR_SERVER,
        fetch: (url, init) =>
          context.callProvider(
            {
              provider: 'polar',
              operation: 'api.request',
              organizationId: context.orgId,
            },
            () => send(url, init),
          ),
      })
      const path = `/v1/subscriptions/${payload.providerSubscriptionId}`
      const subscription = deletionSubscriptionSchema.parse(
        await polar.request({ method: 'GET', path }),
      )
      if (
        subscription.id !== payload.providerSubscriptionId ||
        subscription.customer.external_id !== context.orgId
      ) {
        throw new TaskPermanentError(
          'Late subscription provider attribution does not match the workspace',
        )
      }
      if (!providerSubscriptionBlocksWorkspaceDeletion(subscription))
        return { outcome: 'not-live' }
      const updated = deletionSubscriptionSchema.parse(
        await polar.request({
          method: 'PATCH',
          path,
          body: { cancel_at_period_end: true },
        }),
      )
      if (
        updated.id !== payload.providerSubscriptionId ||
        updated.customer.external_id !== context.orgId ||
        providerSubscriptionBlocksWorkspaceDeletion(updated)
      ) {
        throw new TaskRetryableError(
          'Polar did not confirm period-end cancellation',
        )
      }
      context.logger.error('workspace-late-subscription', undefined, {
        ...fields,
        outcome: 'ending',
      })
      return { outcome: 'ending' }
    } catch (error) {
      // Provider errors may carry response bodies; log only our bounded diagnostic fields.
      context.logger.error('workspace-late-subscription', undefined, {
        ...fields,
        status: error instanceof PolarApiError ? error.status : null,
      })
      if (error instanceof PolarApiError) {
        if (error.status === 403 || error.status === 404)
          return { outcome: 'provider-gone' }
        if (
          error.status !== 409 &&
          error.status !== 429 &&
          error.status >= 400 &&
          error.status < 500
        ) {
          throw new TaskPermanentError(
            'Polar refused late subscription cancellation',
          )
        }
      }
      if (error instanceof BillingConfigError)
        throw new TaskConfigurationError(
          'Polar configuration is required for late subscriptions',
        )
      if (error instanceof TaskPermanentError) throw error
      throw new TaskRetryableError(
        'Late subscription reconciliation is unavailable',
      )
    }
  }
}

export const handleWorkspaceLateSubscription =
  createWorkspaceLateSubscriptionHandler()
