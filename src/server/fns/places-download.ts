import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { tripPlacesResponse } from '#/server/places/download'
import { appScope } from './context'

export const downloadTripPlacesInput = z.object({
  tripId: z.string().trim().min(1).max(64),
})

export const downloadTripPlacesFn = createServerFn({ method: 'GET' })
  .validator(downloadTripPlacesInput)
  .handler(async ({ data }): Promise<Response> =>
    tripPlacesResponse(await appScope(), data.tripId),
  )
