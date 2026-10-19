import { describe, expect, it } from 'vitest'
import { placesGeoJson } from '../geojson'

const place = {
  name: 'Museum',
  description: 'Art',
  notes: 'Bring water',
  address: 'Street',
  city: 'Lisbon',
  countryCode: 'PT',
  website: 'https://example.test',
  phone: '123',
  categoryId: 'category-secret',
  isVisited: true,
  lat: 38.7,
  lng: -9.1,
  id: 'place-secret',
  tripId: 'trip-secret',
  organizationId: 'tenant-secret',
  externalId: 'external-secret',
  createdBy: 'creator-secret',
}

describe('placesGeoJson', () => {
  it('keeps input board order, uses longitude first and allowlists properties without ids', () => {
    const result = placesGeoJson(
      [place, { ...place, name: 'Park' }],
      [{ id: 'category-secret', name: 'Culture' }],
    )
    expect(result).toEqual({
      type: 'FeatureCollection',
      features: ['Museum', 'Park'].map((name) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-9.1, 38.7] },
        properties: {
          name,
          description: 'Art',
          notes: 'Bring water',
          address: 'Street',
          city: 'Lisbon',
          countryCode: 'PT',
          website: 'https://example.test',
          phone: '123',
          category: 'Culture',
          visited: true,
        },
      })),
    })
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it.each([
    [null, null],
    [null, 20],
    [10, null],
    [NaN, 20],
    [10, Infinity],
    [91, 20],
    [10, 181],
  ])('retains a place without a valid complete point (%s, %s)', (lat, lng) => {
    const result = placesGeoJson([{ ...place, lat, lng, categoryId: null }], [])
    expect(result.features).toHaveLength(1)
    expect(result.features[0]?.geometry).toBeNull()
    expect(result.features[0]?.properties.category).toBeNull()
  })
  it('keeps zero coordinates and missing categories', () => {
    expect(
      placesGeoJson([{ ...place, lat: 0, lng: 0 }], []).features[0],
    ).toMatchObject({
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { category: null },
    })
  })
  it('represents an empty trip', () => {
    expect(placesGeoJson([], [])).toEqual({
      type: 'FeatureCollection',
      features: [],
    })
  })
})
