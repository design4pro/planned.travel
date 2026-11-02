import { downloadTripPlacesFn } from '#/server/fns/places-download'
import { readPublicFailure } from '#/lib/errors'
import { saveBlob } from './download'

/** `filename*=UTF-8''<name>` out of a `content-disposition` value, decoded. */
function filenameFrom(disposition: string | null, fallback: string): string {
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? '')
  if (match?.[1] === undefined) {
    return fallback
  }
  try {
    return decodeURIComponent(match[1])
  } catch {
    return fallback
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
  readonly format?: 'geojson' | 'gpx'
  readonly unavailable: string
}): Promise<{
  readonly filename: string
  readonly omitted?: number
  readonly total?: number
}> {
  try {
    const response = await downloadTripPlacesFn({
      data: {
        tripId: input.tripId,
        ...(input.format ? { format: input.format } : {}),
      },
    })
    if (!(response instanceof Response) || !response.ok) {
      throw new Error(input.unavailable)
    }
    let omitted: number | undefined
    let total: number | undefined
    if (input.format === 'gpx') {
      const counts = ['x-places-omitted', 'x-places-total'].map((header) => {
        const value = response.headers.get(header)
        if (
          value === null ||
          !/^\d+$/.test(value) ||
          !Number.isSafeInteger(Number(value))
        )
          throw new Error(input.unavailable)
        return Number(value)
      })
      ;[omitted, total] = counts
      if (omitted > total) throw new Error(input.unavailable)
    }
    const filename = filenameFrom(
      response.headers.get('content-disposition'),
      `trip-places.${input.format ?? 'geojson'}`,
    )
    saveBlob(await response.blob(), filename)
    return { filename, ...(omitted === undefined ? {} : { omitted, total }) }
  } catch (error) {
    if (readPublicFailure(error).kind !== 'unexpected') throw error
    throw new Error(input.unavailable)
  }
}
