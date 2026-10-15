/**
 * A trip's calendar as the file a browser saves.
 *
 * The one place the read (`readFeedSource`), the builder (`buildCalendar`) and the response meet.
 * It takes the scope and the app's origin as arguments so it can run without the Worker's bindings
 * (a module that reaches `cloudflare:workers` cannot be loaded by the Node test project); the
 * server function in `fns/calendar.ts` supplies both.
 */
import { readFeedSource, requireTrip } from '#/server/repos'
import { contentDispositionFor } from '#/server/fns/file-policy'
import { buildCalendar } from './feed'
import type { TenantScope } from '#/server/repos'

/** The media type of an iCalendar object (RFC 5545 §8.1). */
export const CALENDAR_CONTENT_TYPE = 'text/calendar; charset=utf-8'

/**
 * The `.ics` of one trip the acting user may read. A trip they may not read is a `NotFoundError`
 * from {@link requireTrip}, the same answer as for a trip that does not exist.
 *
 * A snapshot: nothing here is kept, and the headers say so — the response is private to the
 * reader and never cached.
 */
export async function tripCalendarResponse(
  scope: TenantScope,
  tripId: string,
  baseUrl: string,
): Promise<Response> {
  const trip = await requireTrip(scope, tripId)
  const source = await readFeedSource(scope, {
    kind: 'trips',
    tripIds: [trip.id],
  })
  const body = buildCalendar(source, { name: trip.title, baseUrl })
  return new Response(body, {
    headers: {
      'content-type': CALENDAR_CONTENT_TYPE,
      'content-disposition': contentDispositionFor(`${trip.slug}.ics`),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}
