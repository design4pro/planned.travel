import { describe, expect, it } from 'vitest'
import { placesGpx } from '../gpx'
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

describe('placesGpx', () => {
  it('maps portable fields in GPX schema order and preserves board order without ids', () => {
    const { xml, omitted } = placesGpx(
      [place, { ...place, name: 'Park' }],
      [{ id: 'category-secret', name: 'Culture' }],
    )
    expect(omitted).toBe(0)
    expect(xml).toContain(
      '<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="planned.travel">',
    )
    expect(xml).toContain(
      '<wpt lat="38.7" lon="-9.1"><name>Museum</name><cmt>Bring water</cmt><desc>Art</desc><link href="https://example.test"/><type>Culture</type></wpt>',
    )
    expect(xml.indexOf('<name>Museum')).toBeLessThan(xml.indexOf('<name>Park'))
    expect(xml).not.toContain('secret')
  })
  it('escapes all user-controlled fields, removes illegal XML characters and preserves Unicode', () => {
    const text = `Tokyo 東京 🗺 <>&"'\u0000\u0001\u000b\ufffe\uffff\ud800`
    const escaped = 'Tokyo 東京 🗺 &lt;&gt;&amp;&quot;&apos;'
    const { xml } = placesGpx(
      [{ ...place, name: text, description: text, notes: text, website: text }],
      [{ id: place.categoryId, name: text }],
    )
    for (const tag of ['name', 'cmt', 'desc', 'type'])
      expect(xml).toContain(`<${tag}>${escaped}</${tag}>`)
    expect(xml).toContain(`<link href="${escaped}"/>`)
    expect(xml).not.toContain('<!DOCTYPE')
  })
  it.each([
    [null, null],
    [null, 20],
    [10, null],
    [NaN, 20],
    [10, Infinity],
    [-Infinity, 0],
    [91, 20],
    [-91, 0],
    [10, 181],
    [0, -181],
  ])('omits and counts invalid points (%s, %s)', (lat, lng) => {
    const { xml, omitted } = placesGpx([{ ...place, lat, lng }], [])
    expect(omitted).toBe(1)
    expect(xml).not.toContain('<wpt')
    expect(xml).toContain('</gpx>')
  })
  it.each([
    [0, 0],
    [-90, -180],
    [90, 180],
    [1e-7, -1e-8],
  ])('keeps valid points in decimal degrees (%s, %s)', (lat, lng) => {
    const { xml, omitted } = placesGpx(
      [
        {
          ...place,
          lat,
          lng,
          description: null,
          notes: null,
          website: null,
          categoryId: null,
        },
      ],
      [],
    )
    expect(omitted).toBe(0)
    expect(xml).not.toMatch(/e-\d/)
    const point = /<wpt lat="([^"]+)" lon="([^"]+)">/.exec(xml)
    expect(Number(point?.[1])).toBe(lat)
    expect(Number(point?.[2])).toBe(lng === 180 ? -180 : lng)
    expect(xml).not.toMatch(/<(?:desc|cmt|type|link)\b/)
  })
  it('returns a valid empty document', () => {
    expect(placesGpx([], [])).toEqual({
      xml: '<?xml version="1.0" encoding="UTF-8"?><gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="planned.travel"></gpx>',
      omitted: 0,
    })
  })
})

it('retains the antimeridian waypoint within GPX longitude limits without changing GeoJSON', () => {
  const antimeridian = { ...place, lng: 180 }
  expect(placesGpx([antimeridian], [])).toMatchObject({ omitted: 0 })
  expect(placesGpx([antimeridian], []).xml).toContain('lon="-180"')
  expect(
    placesGeoJson([antimeridian], []).features[0]?.geometry?.coordinates,
  ).toEqual([180, place.lat])
})
