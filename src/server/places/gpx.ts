/** GPX 1.1 waypoints from the same portable projection and point rules as GeoJSON. */
import { placesGeoJson } from './geojson'

function xmlText(value: string): string {
  const legal = Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 0x20 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff)
      )
    })
    .join('')
  return legal
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/** GPX coordinates are xsd:decimal, which does not accept exponent notation. */
function decimal(value: number): string {
  const [digits, exponent] = Math.abs(value).toString().split('e-')
  if (exponent === undefined) return String(value)
  return `${value < 0 ? '-' : ''}0.${'0'.repeat(Number(exponent) - 1)}${digits.replace('.', '')}`
}

export function placesGpx(...input: Parameters<typeof placesGeoJson>): {
  readonly xml: string
  readonly omitted: number
} {
  let omitted = 0
  const waypoints = placesGeoJson(...input)
    .features.map(({ geometry, properties }) => {
      if (geometry === null) {
        omitted++
        return ''
      }
      const [lng, lat] = geometry.coordinates
      const { name, notes, description, website, category } = properties
      // GPX excludes +180; -180 is the same antimeridian point.
      const longitude = lng === 180 ? -180 : lng
      // wptType requires cmt before desc, link before type.
      return (
        `<wpt lat="${decimal(lat)}" lon="${decimal(longitude)}">` +
        `<name>${xmlText(name)}</name>` +
        (notes ? `<cmt>${xmlText(notes)}</cmt>` : '') +
        (description ? `<desc>${xmlText(description)}</desc>` : '') +
        (website ? `<link href="${xmlText(website)}"/>` : '') +
        (category ? `<type>${xmlText(category)}</type>` : '') +
        '</wpt>'
      )
    })
    .join('')
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?><gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="planned.travel">${waypoints}</gpx>`,
    omitted,
  }
}
