/** The portable places file: explicit public fields, with no database identifiers. */
import type { Category, Place } from '#/server/db/types'

type PortablePlace = Pick<
  Place,
  | 'name'
  | 'description'
  | 'notes'
  | 'address'
  | 'city'
  | 'countryCode'
  | 'website'
  | 'phone'
  | 'categoryId'
  | 'isVisited'
  | 'lat'
  | 'lng'
>

export function placesGeoJson(
  places: ReadonlyArray<PortablePlace>,
  categories: ReadonlyArray<Pick<Category, 'id' | 'name'>>,
) {
  const names = new Map(
    categories.map((category) => [category.id, category.name]),
  )
  return {
    type: 'FeatureCollection' as const,
    features: places.map((place) => {
      const { lat, lng } = place
      const hasPoint =
        lat !== null &&
        lng !== null &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      return {
        type: 'Feature' as const,
        geometry: hasPoint
          ? {
              type: 'Point' as const,
              coordinates: [lng, lat],
            }
          : null,
        properties: {
          name: place.name,
          description: place.description,
          notes: place.notes,
          address: place.address,
          city: place.city,
          countryCode: place.countryCode,
          website: place.website,
          phone: place.phone,
          category: names.get(place.categoryId ?? '') ?? null,
          visited: place.isVisited,
        },
      }
    }),
  }
}
