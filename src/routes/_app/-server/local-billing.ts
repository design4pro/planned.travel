import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { entitlements } from '#/server/billing/entitlements'
import { billingRuntime } from '#/server/billing/runtime.cloudflare'
import { billingContext } from '#/server/billing/types'
import { appScope } from './context'

/** Authenticated local state only: polling never constructs or calls the provider client. */
export const loadLocalBilling = createServerFn({ method: 'GET' })
  .validator(z.object({}))
  .handler(async () => {
    const scope = await appScope()
    const runtime = billingRuntime({ scope })
    return {
      viewerId: scope.ctx.userId,
      entitlements: await entitlements(
        billingContext(runtime, scope.ctx.organizationId),
      ),
    }
  })
