/**
 * The trip calendar download.
 *
 * Returns a `Response` rather than a value, like `downloadTripFileFn`: the bytes never enter the
 * serialisation layer and the media type and filename travel in the headers. The session decides
 * whose trip it is; nothing here takes a token, so there is no address to share.
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
} from '#/server/repos/calendar-feeds'
import { requireTrip } from '#/server/repos/trips'

export const downloadTripIcsFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId: z.string().trim().min(1).max(64) }))
  .handler(async ({ data }): Promise<Response> =>
    tripCalendarResponse(await appScope(), data.tripId, appUrl()),
  )

const tripInput = z.strictObject({ tripId: z.string().trim().min(1).max(64) })

export const loadCalendarFeedsFn = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }) => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    const feeds = await listFeeds(scope)
    return feeds.find((feed) => feed.tripId === data.tripId) ?? null
  })

export const enableCalendarFeedFn = createServerFn({ method: 'POST' })
  .validator(tripInput)
  .handler(async ({ data }) => {
    const feed = await enableFeed(await appScope(), {
      scope: 'trip',
      tripId: data.tripId,
    })
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
