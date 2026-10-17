/**
 * Trip calendar downloads and owner-bound live feed management.
 *
 * Downloads return a Response so calendar bytes bypass serialization. Management reads return
 * status only; enabling or rotating returns the new credential once and later reads omit it.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { appUrl } from '#/server/auth/env'
import { tripCalendarResponse } from '#/server/calendar/download'
import { appScope } from './context'
import {
  enableFeed,
  listFeeds,
  revokeFeed,
  rotateFeed,
} from '#/server/repos/calendar-feeds'
import { requireTrip } from '#/server/repos/trips'

export const downloadTripIcsFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId: z.string().trim().min(1).max(64) }))
  .handler(async ({ data }): Promise<Response> =>
    tripCalendarResponse(await appScope(), data.tripId, appUrl()),
  )

const tripInput = z.strictObject({
  tripId: z.string().trim().min(1).max(64),
  scope: z.enum(['trip', 'workspace']).optional(),
})

export const loadCalendarFeedsFn = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }) => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    const feeds = await listFeeds(
      scope,
      data.scope === 'workspace'
        ? { scope: 'workspace' }
        : { tripId: data.tripId },
    )
    return feeds.at(0) ?? null
  })

export const enableCalendarFeedFn = createServerFn({ method: 'POST' })
  .validator(tripInput)
  .handler(async ({ data }) => {
    const feed = await enableFeed(
      await appScope(),
      data.scope === 'workspace'
        ? { scope: 'workspace' }
        : {
            scope: 'trip',
            tripId: data.tripId,
          },
    )
    const url = `${appUrl()}/api/feed/${feed.secret}.ics`
    return {
      feedId: feed.feedId,
      url,
      webcalUrl: url.replace(/^https?:/, 'webcal:'),
      tripTitle: feed.tripTitle,
    }
  })

export const rotateCalendarFeedFn = createServerFn({ method: 'POST' })
  .validator(z.strictObject({ feedId: z.string().trim().min(1).max(64) }))
  .handler(async ({ data }) => {
    const feed = await rotateFeed(await appScope(), data.feedId)
    const url = `${appUrl()}/api/feed/${feed.secret}.ics`
    return {
      feedId: feed.feedId,
      url,
      webcalUrl: url.replace(/^https?:/, 'webcal:'),
      tripTitle: feed.tripTitle,
    }
  })

export const revokeCalendarFeedFn = createServerFn({ method: 'POST' })
  .validator(z.strictObject({ feedId: z.string().trim().min(1).max(64) }))
  .handler(async ({ data }) => {
    await revokeFeed(await appScope(), data.feedId)
    return { revoked: true }
  })
