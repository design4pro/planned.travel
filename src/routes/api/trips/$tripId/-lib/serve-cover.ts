import {
  getSession,
  isAuthRequirementError,
  requireOrg,
} from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { createScope, getTrip } from '#/server/repos'
import { isCoverContentType, tripStoragePrefix } from '#/lib/trip-cover'

import type { TenantContext } from '#/server/auth/session'

/**
 * The decisions behind `GET /api/trips/:tripId/cover` - the one door through which a trip's cover
 * bytes leave the bucket.
 *
 * An HTTP authorisation boundary over workspace data, so it answers in the fewest distinguishable
 * ways: no session is a 401, a caller with no workspace a 403, and *every other* refusal - a trip in
 * another workspace, a private trip the caller is not on, a trip that does not exist, one with no
 * cover, a stored key outside the trip's namespace, an object that is gone, a type the route does not
 * serve - is the same 404, so the status never says which trip ids exist.
 *
 * Three rules keep the bytes the trip's own:
 *
 * - **The key comes from the trip row, resolved in the caller's scope** (`getTrip` is the shipped
 *   read predicate), and from nowhere else. The `v` query parameter in the cover URL busts caches and
 *   is never read here, so no request can steer the lookup.
 * - **The key must sit under `trips/<organization>/<trip>/`** before the bucket is touched, so a row
 *   that ever carried a foreign key cannot make this route read another tenant's object.
 * - **Only the five image types are served**, judged on the type stored with the object. SVG can carry
 *   script and a browser sniffing HEIC or HTML as something else is the failure `nosniff` and the
 *   allow-list exist to remove; anything else is a 404.
 *
 * The bucket is a parameter, as in `src/server/storage/objects.ts`, so this module loads under plain
 * Node; the route file reads the binding. It writes no SQL: the trip comes through the repository.
 */

/** The verb this route needs from the `FILES` bucket; `R2Bucket` satisfies it as is. */
export interface CoverBucket {
  get: (key: string) => Promise<{
    body: ReadableStream | null
    size?: number
    httpMetadata?: { contentType?: string }
  } | null>
}

/**
 * How long a browser may keep a cover. `private`, never shared: the bytes are workspace data and a
 * shared cache could hand them to someone with no session. Short, because a member removed from the
 * trip is not told to forget what they already fetched; a changed cover is a new `v` and does not wait.
 */
const COVER_CACHE_CONTROL = 'private, max-age=600'

function refusal(status: 401 | 403 | 404, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

function notFound(): Response {
  return refusal(404, 'There is no cover for that trip.')
}

export async function serveTripCover(
  bucket: CoverBucket,
  _request: Request,
  tripId: string,
): Promise<Response> {
  const session = await getSession()
  if (session === null) {
    return refusal(401, 'Sign in to see this cover.')
  }

  // `requireOrg` throws rather than returning null, and a caller with no workspace must get a clean
  // status rather than a 500 - this is one of the places that failure is expected.
  let context: TenantContext
  try {
    context = await requireOrg()
  } catch (cause) {
    if (isAuthRequirementError(cause)) {
      return refusal(403, cause.message)
    }
    throw cause
  }

  if (tripId.length === 0 || tripId.length > 64) {
    return notFound()
  }

  const trip = await getTrip(createScope(getDb(), context), tripId)
  const key = trip?.coverImageKey
  if (
    trip === null ||
    key === null ||
    key === undefined ||
    !key.startsWith(tripStoragePrefix(context.organizationId, trip.id))
  ) {
    return notFound()
  }

  const object = await bucket.get(key)
  const contentType = object?.httpMetadata?.contentType
  if (
    object === null ||
    object.body === null ||
    !isCoverContentType(contentType)
  ) {
    return notFound()
  }

  const headers = new Headers({
    'content-type': contentType?.split(';')[0]?.trim().toLowerCase() ?? '',
    'content-disposition': 'inline',
    'x-content-type-options': 'nosniff',
    'cache-control': COVER_CACHE_CONTROL,
    // A cover opened as a document may not run anything, whatever it turns out to be.
    'content-security-policy': "default-src 'none'; sandbox",
  })
  if (object.size !== undefined) {
    headers.set('content-length', String(object.size))
  }
  return new Response(object.body, { headers })
}
