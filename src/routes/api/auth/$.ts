import { createFileRoute } from '@tanstack/react-router'
// Loads the Start module augmentation that adds `server` to route options.
import type {} from '@tanstack/react-start'
import { getAuth } from '#/server/auth'

/**
 * Every Better Auth endpoint, mounted under `/api/auth/*`.
 *
 * This route declares only `server`, so the TanStack Start router plugin prunes
 * it from the client bundle and the auth configuration never reaches a browser.
 */
const handler = ({ request }: { request: Request }): Promise<Response> =>
  getAuth().handler(request)

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
      OPTIONS: handler,
      HEAD: handler,
    },
  },
})
