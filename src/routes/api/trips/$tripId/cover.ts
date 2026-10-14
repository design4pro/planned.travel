import { createFileRoute } from '@tanstack/react-router'
// Loads the Start module augmentation that adds `server` to route options.
import type {} from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { serveTripCover } from './-lib/serve-cover'

/**
 * `GET /api/trips/:tripId/cover` - a trip's cover image, to everyone who can read the trip.
 *
 * A shim over `-lib/serve-cover.ts`, which holds the authorisation decisions and is testable under
 * Node. GET only: the file is written through the upload server function and recorded as the cover by
 * the trip update, never through this URL. Declaring only `server` keeps the handler and the bucket
 * binding out of the client bundle.
 */
export const Route = createFileRoute('/api/trips/$tripId/cover')({
  server: {
    handlers: {
      GET: ({
        request,
        params,
      }: {
        request: Request
        params: { tripId: string }
      }) => serveTripCover(env.FILES, request, params.tripId),
    },
  },
})
