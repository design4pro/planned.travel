/**
 * Reading a trip invite link for the page at `/join/<secret>`.
 *
 * A POST so the secret never rides in the URL of the RPC. The decision is `viewInvite`, which takes
 * its bindings as arguments; this file is only the wiring that supplies them. It has no auth
 * middleware on purpose: an anonymous visitor is the main case, and a session is read for its
 * answer, never required.
 */
import { createServerFn } from '@tanstack/react-start'
import {
  getRequest,
  getRequestHeader,
  setResponseHeader,
} from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { z } from 'zod'

import { authSecret } from '#/server/auth/env'
import { getSession } from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { workerLogger } from '#/server/observability/sentry'
import { noteBusy } from '../-lib/busy'
import { viewInvite } from '../-lib/view'

import type { InviteView } from '../-lib/view'

/**
 * Longer than any secret, so a malformed one is answered as a miss and counted, rather than
 * refused before the budgets run.
 */
const inviteInput = z.strictObject({ secret: z.string().min(1).max(256) })

export const loadInvite = createServerFn({ method: 'POST' })
  .validator(inviteInput)
  .handler(async ({ data }): Promise<InviteView> => {
    setResponseHeader('cache-control', 'private, no-store')
    const session = await getSession()
    const view = await viewInvite(
      {
        db: getDb(),
        store: env.KV,
        key: authSecret(),
        // The IP the platform saw, and nothing the caller can set.
        ip: getRequestHeader('cf-connecting-ip') ?? 'unknown',
        session: session && {
          id: session.user.id,
          email: session.user.email,
          banned: session.user.banned,
          activeOrganizationId: session.session.activeOrganizationId,
        },
        log: (event, fields) => {
          const log = workerLogger(env, {
            context: { component: 'trip-invite' },
          })
          if (event === 'limited') log.warn('trip_invite.refused', fields)
          else log.debug(`trip_invite.${event}`, fields)
        },
      },
      data.secret,
    )
    // The status stays 200: the client's server-function fetcher throws on a non-ok answer, which
    // would turn a budget refusal into the error card. The route's middleware answers the
    // document with 429 from this note (see `-lib/busy.ts`).
    if (view.state === 'busy') noteBusy(getRequest(), view.retryAfter)
    return view
  })
