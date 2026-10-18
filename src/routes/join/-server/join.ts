/**
 * Reading a trip invite link for the page at `/join/<secret>`, and joining the trip it leads to.
 *
 * Both are POSTs so the secret never rides in the URL of the RPC. The decisions are `viewInvite` and
 * `joinInvite`, which take their bindings as arguments; this file is only the wiring that supplies
 * them. `loadInvite` has no auth middleware on purpose: an anonymous visitor is the main case, and a
 * session is read for its answer, never required. `joinTripFn` is the only write on this surface and
 * requires a session.
 */
import { createServerFn } from '@tanstack/react-start'
import {
  getRequest,
  getRequestHeader,
  setResponseHeader,
} from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { z } from 'zod'

import { trail } from '#/server/audit/trail'
import { authSecret } from '#/server/auth/env'
import { getSession } from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { scopeFor } from '#/server/fns/context'
import { workerLogger } from '#/server/observability/sentry'
import { noteBusy } from '../-lib/busy'
import { joinInvite, joinerOf } from '../-lib/join'
import { viewInvite } from '../-lib/view'

import type { JoinAnswer } from '../-lib/join'
import type { InviteView } from '../-lib/view'

/**
 * Cut to a length no secret reaches, so a longer one is answered as a miss and counted, rather
 * than refused before the budgets run.
 */
const inviteInput = z.strictObject({
  secret: z
    .string()
    .min(1)
    .transform((secret) => secret.slice(0, 256)),
})

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

export const joinTripFn = createServerFn({ method: 'POST' })
  .validator(inviteInput)
  .handler(async ({ data }): Promise<JoinAnswer> => {
    setResponseHeader('cache-control', 'private, no-store')
    const session = await getSession()
    return joinInvite(
      {
        db: getDb(),
        store: env.KV,
        key: authSecret(),
        // The IP the platform saw, and nothing the caller can set.
        ip: getRequestHeader('cf-connecting-ip') ?? 'unknown',
        user: joinerOf(session),
        audit: (context, input) => trail(scopeFor(context), input),
        log: (event, fields) => {
          const log = workerLogger(env, {
            context: { component: 'trip-invite' },
          })
          if (event === 'limited') log.warn('trip_invite.refused', fields)
          else log.info(`trip_invite.${event}`, fields)
        },
      },
      data.secret,
    )
  })
