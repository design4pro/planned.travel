import { downloadTripPlacesFn } from '#/server/fns/places-download'
import { readPublicFailure } from '#/lib/errors'
import { saveBlob } from './download'

const FALLBACK_FILENAME = 'trip-places.geojson'

/** `filename*=UTF-8''<name>` out of a `content-disposition` value, decoded. */
function filenameFrom(disposition: string | null): string {
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? '')
  if (match?.[1] === undefined) {
    return FALLBACK_FILENAME
  }
  try {
    return decodeURIComponent(match[1])
  } catch {
    return FALLBACK_FILENAME
  }
}

/**
 * Saves the trip's places file to the reader's machine; throws when the file was not made.
 *
 * `unavailable` is the sentence a failure carries, in the reader's language: the caller owns the
 * copy, so a refusal that never crossed the server cannot reach a toast in English.
 */
export async function downloadTripPlaces(input: {
  readonly tripId: string
  readonly unavailable: string
}): Promise<{ readonly filename: string }> {
  try {
    const response = await downloadTripPlacesFn({
      data: { tripId: input.tripId },
    })
    if (!(response instanceof Response) || !response.ok) {
      throw new Error(input.unavailable)
    }
    const filename = filenameFrom(response.headers.get('content-disposition'))
    saveBlob(await response.blob(), filename)
    return { filename }
  } catch (error) {
    if (readPublicFailure(error).kind !== 'unexpected') throw error
    throw new Error(input.unavailable)
  }
}
