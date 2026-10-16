import { hashFeedSecret } from '#/server/calendar/secret'
import { buildCalendar } from '#/server/calendar/feed'
import {
  findLiveFeedByDigestUnscoped,
  openFeedScope,
  feedTripAccess,
  readFeedSource,
  touchFeed,
} from '#/server/repos/calendar-feeds'
import { spendPublicBudget } from './rate-limit'
import type { Database } from '#/server/db/types'
import type { RateCounterStore } from '#/server/metering/rate'

export interface CalendarFeedRuntime {
  readonly db: Database
  readonly store: RateCounterStore
  readonly baseUrl: string
  readonly waitUntil: (promise: Promise<unknown>) => void
  readonly now?: () => Date
  readonly log?: (
    event: 'served' | 'not-found' | 'limited' | 'resolution-failed',
    fields: {
      feedId?: string
      status: number
      scope?: 'trip' | 'workspace'
      reason?: 'unresolved' | 'rate-limited' | 'owner-gone'
      durationMs?: number
    },
  ) => void
}

const headers = {
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
}

/** No session, SQL or scope construction here. The resolved feed's owner is the only principal. */
export async function serveCalendarFeed(
  request: Request,
  runtime: CalendarFeedRuntime,
): Promise<Response> {
  const started = performance.now()
  function emit(
    event: Parameters<NonNullable<CalendarFeedRuntime['log']>>[0],
    fields: Parameters<NonNullable<CalendarFeedRuntime['log']>>[1],
  ) {
    try {
      runtime.log?.(event, {
        ...fields,
        durationMs: performance.now() - started,
      })
    } catch {
      /* A diagnostic sink never decides whether a credential may read content. */
    }
  }
  const head = request.method === 'HEAD'
  function response(
    status: number,
    body: string,
    extra: Record<string, string> = {},
  ) {
    return new Response(head ? null : body, {
      status,
      headers: {
        ...headers,
        'content-type': 'text/plain; charset=utf-8',
        ...extra,
      },
    })
  }
  if (request.method !== 'GET' && !head)
    return response(405, 'Method not allowed', { allow: 'GET, HEAD' })
  const now = runtime.now?.() ?? new Date()
  const matched = /^\/api\/feed\/([A-Za-z0-9_-]{32})\.ics$/.exec(
    new URL(request.url).pathname,
  )
  if (!matched) {
    emit('not-found', { status: 404, reason: 'unresolved' })
    return response(404, 'Not found')
  }
  async function refuse(
    reason: 'unresolved' | 'owner-gone' = 'unresolved',
    feedId?: string,
  ) {
    const retry = await spendPublicBudget(
      runtime.store,
      'miss',
      request.headers.get('cf-connecting-ip') ?? 'unknown',
      20,
      now,
    )
    if (retry !== null) {
      emit('limited', {
        status: 429,
        reason: 'rate-limited',
        ...(feedId ? { feedId } : {}),
      })
      return response(429, 'Too many requests', {
        'retry-after': String(retry),
      })
    }
    emit('not-found', { status: 404, reason, ...(feedId ? { feedId } : {}) })
    return response(404, 'Not found')
  }
  try {
    const found = await findLiveFeedByDigestUnscoped(
      runtime.db,
      await hashFeedSecret(matched[1]),
    )
    if (!found) return refuse()
    const scope = await openFeedScope(runtime.db, found, now)
    if (
      !scope ||
      found.scope !== 'trip' ||
      !found.tripId ||
      !(await feedTripAccess(scope, found))
    )
      return refuse('owner-gone', found.id)
    const source = await readFeedSource(scope, {
      kind: 'trips',
      tripIds: [found.tripId],
    })
    if (source.trips.length !== 1) return refuse('owner-gone', found.id)
    const retry = await spendPublicBudget(
      runtime.store,
      'feed',
      found.id,
      60,
      now,
    )
    if (retry !== null) {
      emit('limited', {
        feedId: found.id,
        scope: 'trip',
        status: 429,
        reason: 'rate-limited',
      })
      return response(429, 'Too many requests', {
        'retry-after': String(retry),
      })
    }
    const calendar = buildCalendar(source, {
      baseUrl: runtime.baseUrl,
      name: source.trips[0].title,
    })
    if (
      found.lastServedAt === null ||
      now.getTime() - found.lastServedAt.getTime() >= 3600000
    ) {
      runtime.waitUntil(touchFeed(scope, found.id, now).catch(() => undefined))
    }
    emit('served', { feedId: found.id, scope: 'trip', status: 200 })
    return response(200, calendar, {
      'content-type': 'text/calendar; charset=utf-8',
    })
  } catch {
    // Resolution errors never reach a sink with a request URL, secret or digest.
    return refuse()
  }
}
