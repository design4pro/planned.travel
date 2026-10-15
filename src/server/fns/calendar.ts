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

export const downloadTripIcsFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId: z.string().trim().min(1).max(64) }))
  .handler(async ({ data }): Promise<Response> =>
    tripCalendarResponse(await appScope(), data.tripId, appUrl()),
  )
