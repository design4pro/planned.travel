/**
 * Getting a trip's calendar file out.
 *
 * Same route as an attachment (see `download.ts`): the server function answers with a raw
 * `Response` and the browser saves it from a blob. The name comes from the response's own
 * `content-disposition`, so the file is called what the server named it.
 */
import { downloadTripIcsFn } from '#/server/fns/calendar'
import { saveBlob } from './download'

const FALLBACK_FILENAME = 'trip.ics'

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

/** Saves the trip's calendar to the reader's machine; throws when the file was not made. */
export async function downloadTripCalendar(input: {
  readonly tripId: string
}): Promise<{ readonly filename: string }> {
  const response = await downloadTripIcsFn({ data: { tripId: input.tripId } })

  if (!(response instanceof Response) || !response.ok) {
    throw new Error('The calendar file could not be prepared.')
  }

  const filename = filenameFrom(response.headers.get('content-disposition'))
  saveBlob(await response.blob(), filename)
  return { filename }
}
