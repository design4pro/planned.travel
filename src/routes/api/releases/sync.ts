import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { getAuth } from '#/server/auth'
import { getSession } from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { runReleaseOperation } from '#/server/content/publication'
import { serveReleaseSync } from './-lib/sync'

/** No deployed Git/write adapter is authorized. This transport never enables production sync. */
export const Route = createFileRoute('/api/releases/sync')({
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) =>
        serveReleaseSync(request, async (input) => {
          const session = await getSession()
          const { adapter } = await getAuth().$context
          return runReleaseOperation(
            {
              db: getDb(),
              authority: { session, adapter },
              git: null,
              writeAuthorization: null,
            },
            input,
          )
        }),
    },
  },
})
