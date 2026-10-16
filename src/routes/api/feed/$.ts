import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { env, waitUntil } from 'cloudflare:workers'
import { getDb } from '#/server/db/client'
import { appUrl } from '#/server/auth/env'
import { serveCalendarFeed } from '#/server/public/calendar-feed'
import { workerLogger } from '#/server/observability/sentry'

const handler = ({ request }: { request: Request }) =>
  serveCalendarFeed(request, {
    db: getDb(),
    store: env.KV,
    baseUrl: appUrl(),
    waitUntil,
    log: (event, fields) => {
      const log = workerLogger(env, { context: { component: 'calendar-feed' } })
      if (event === 'limited') log.warn('calendar_feed.refused', fields)
      else
        log.debug(
          event === 'served' ? 'calendar_feed.served' : 'calendar_feed.refused',
          fields,
        )
    },
  })

export const Route = createFileRoute('/api/feed/$')({
  server: { handlers: { GET: handler, HEAD: handler } },
})
