/** Authenticated, inline snapshot of every place a trip's reader may see. */
import { listCategories } from '#/server/repos/categories'
import { listTripPlaces } from '#/server/repos/places'
import { requireTrip } from '#/server/repos/trips'
import { slugify } from '#/server/repos/validation'
import { contentDispositionFor } from '#/server/fns/file-policy'
import { placesGeoJson } from './geojson'
import type { TenantScope } from '#/server/repos/base'

export async function tripPlacesResponse(
  scope: TenantScope,
  tripId: string,
): Promise<Response> {
  const trip = await requireTrip(scope, tripId)
  // Omitting limit returns every row, in board order, including trips with over 500 places.
  const [places, categories] = await Promise.all([
    listTripPlaces(scope, { tripId: trip.id }),
    listCategories(scope),
  ])
  return new Response(JSON.stringify(placesGeoJson(places, categories)), {
    headers: {
      'content-type': 'application/geo+json; charset=utf-8',
      'content-disposition': contentDispositionFor(
        `${slugify(trip.title, 'trip')}-places.geojson`,
      ),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}
