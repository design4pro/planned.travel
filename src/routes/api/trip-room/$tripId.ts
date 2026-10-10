import { createFileRoute } from '@tanstack/react-router'
// Loads the Start module augmentation that adds `server` to route options.
import type {} from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { serveTripRoom } from './-lib/connect'

/**
 * `GET /api/trip-room/:tripId` — the WebSocket door into a trip's Durable Object.
 *
 * A shim over `-lib/connect.ts`, which holds the authorisation decisions and is testable under
 * node. This module exists to read the `TRIP_ROOM` binding, declared in `wrangler.jsonc` for every
 * environment, so it is always present: a deployment without it fails isolate startup long before
 * a request reaches here. Declaring only `server` keeps the handler, the session layer and the
 * Durable Object namespace out of the client bundle.
 */

export const Route = createFileRoute('/api/trip-room/$tripId')({
  server: {
    handlers: {
      GET: ({ request, params }: { request: Request; params: { tripId: string } }) =>
        serveTripRoom(env.TRIP_ROOM, request, params.tripId),
    },
  },
})
