/**
 * What a trip's cover image is, said once for the browser and the server.
 *
 * Pure on purpose - no bindings, no session - so the picker's `accept` list, the form's pre-flight,
 * the update path that turns a file id into a cover, the route that serves it and the `trip-copy`
 * handler that duplicates it all read the same five types and build the same URL.
 */

/**
 * The only media types a cover may be. An allow-list, narrower than the file library's: SVG can carry
 * script and HEIC is not rendered by every browser, and a cover is shown to every reader of the trip.
 */
export const COVER_CONTENT_TYPES: ReadonlyArray<string> = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
]

/** The `accept` attribute for the cover picker. */
export const COVER_ACCEPT = COVER_CONTENT_TYPES.join(',')

/** Whether a media type, as the browser or the bucket reports it, is one a cover may be. */
export function isCoverContentType(contentType: string | null | undefined) {
  if (contentType === null || contentType === undefined) {
    return false
  }
  const normalised = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return COVER_CONTENT_TYPES.includes(normalised)
}

/** The bucket prefix every object of one trip lives under; `storageKeyFor` mints keys inside it. */
export function tripStoragePrefix(
  organizationId: string,
  tripId: string,
): string {
  return `trips/${organizationId}/${tripId}/`
}

/**
 * The URL a trip records as its cover: the app's own origin, the cover route, and the file's id.
 *
 * The id rides in `v` to bust caches when the cover changes and for nothing else - the route reads
 * the object key from the trip row and never looks anything up by this value. `origin` comes from the
 * configured app origin, never from the request, so a forged `Host` cannot write a URL.
 */
export function coverUrlFor(
  origin: string,
  tripId: string,
  fileId: string,
): string {
  return `${origin.replace(/\/+$/, '')}/api/trips/${encodeURIComponent(tripId)}/cover?v=${encodeURIComponent(fileId)}`
}

/** `newId()` mints 9 time characters and 16 random ones. */
const FILE_ID_LENGTH = 25

/**
 * The file id inside a storage key (`trips/<org>/<trip>/<fileId>-<filename>`), or `null` for a key
 * of another shape.
 *
 * Ids come from `nanoid`, whose alphabet contains `-`, so the id is the fixed-length head when a
 * dash follows it and only otherwise the text up to the first dash.
 */
export function fileIdOfStorageKey(key: string): string | null {
  const segments = key.split('/')
  const name = segments.at(3)
  if (segments.length !== 4 || name === undefined) {
    return null
  }
  if (name.charAt(FILE_ID_LENGTH) === '-') {
    return name.slice(0, FILE_ID_LENGTH)
  }
  const separator = name.indexOf('-')
  return separator > 0 ? name.slice(0, separator) : null
}
