import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { env } from 'cloudflare:workers'
import { appScope } from './context'
import { requestOutboundRuntime } from '#/server/metering/bindings'
import { getPublicRates } from '#/server/rates/public-rates'

export const publicRatesInput = z.strictObject({
  refresh: z.boolean().optional(),
})

export const getPublicRatesFn = createServerFn({ method: 'POST' })
  .validator(publicRatesInput)
  .handler(async ({ data }) => {
    const scope = await appScope()
    return getPublicRates(
      {
        cache: env.KV,
        fetch,
        now: Date.now,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        outbound: requestOutboundRuntime(),
      },
      scope.ctx.organizationId,
      data.refresh,
    )
  })
