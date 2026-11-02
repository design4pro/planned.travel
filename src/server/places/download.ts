/** Authenticated, inline snapshot of every place a trip's reader may see. */
import { listCategories } from '#/server/repos/categories'
import { listTripPlaces } from '#/server/repos/places'
import { requireTrip } from '#/server/repos/trips'
import { slugify } from '#/server/repos/validation'
import { contentDispositionFor } from '#/server/fns/file-policy'
import { placesGeoJson } from './geojson'
import { placesGpx } from './gpx'
import type { TenantScope } from '#/server/repos/base'

export async function tripPlacesResponse(
  scope: TenantScope,
  tripId: string,
  format: 'geojson' | 'gpx' = 'geojson',
): Promise<Response> {
  const trip = await requireTrip(scope, tripId)
  // Omitting limit returns every row, in board order, including trips with over 500 places.
  const [places, categories] = await Promise.all([
    listTripPlaces(scope, { tripId: trip.id }),
    listCategories(scope),
  ])
  const gpx = format === 'gpx' ? placesGpx(places, categories) : null
  return new Response(
    gpx?.xml ?? JSON.stringify(placesGeoJson(places, categories)),
    {
      headers: {
        'content-type': gpx
          ? 'application/gpx+xml; charset=utf-8'
          : 'application/geo+json; charset=utf-8',
        ...(gpx
          ? {
              'x-places-omitted': String(gpx.omitted),
              'x-places-total': String(places.length),
            }
          : {}),
        'content-disposition': contentDispositionFor(
          `${slugify(trip.title, 'trip')}-places.${format}`,
        ),
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    },
  )
}
