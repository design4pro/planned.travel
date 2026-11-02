/**
 * Getting a file back out.
 *
 * The download server function answers with a raw `Response` streamed straight
 * from R2, so the bytes never pass through the serialisation layer. The browser
 * cannot be navigated to that URL directly — it is a POST-shaped RPC endpoint
 * behind the session — so the response is turned into a blob and handed to a
 * synthetic link, which is what makes the browser save it under its real name.
 */
import { downloadTripFileFn } from '#/server/fns/files'

/**
 * Stored types that must be neutralized before creating a download URL.
 *
 * A blob URL is same-origin, and the app sets no Content-Security-Policy header, so opening one
 * typed as markup would run it with the app's authority. Saving the bytes does not need the type.
 * SVG previews expose rasterized pixels; native image navigation must never reach SVG markup.
 */
const MARKUP_TYPES: ReadonlySet<string> = new Set([
  'text/html',
  'image/svg+xml',
  'application/gpx+xml',
])

const GENERIC_BINARY = 'application/octet-stream'

/** How long the object URL is kept alive after the click that consumed it. */
const REVOKE_DELAY_MS = 60_000

async function reasonFor(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error
    }
  } catch {
    // A non-JSON body is not worth surfacing verbatim.
  }
  return `The download failed (${response.status}).`
}

/**
 * Hands a blob to the browser as a download under `filename`.
 *
 * Shared by every download on these screens (an attachment, a calendar file), so the markup guard
 * and the delayed revoke are written once.
 */
export function saveBlob(stored: Blob, filename: string): void {
  const storedType = stored.type.split(';')[0]?.trim().toLowerCase() ?? ''
  const blob = MARKUP_TYPES.has(storedType)
    ? new Blob([stored], { type: GENERIC_BINARY })
    : stored
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  // `appendChild` rather than `append`: the Workers type surface this project
  // also compiles against declares its own `Element.append`, and the DOM node is
  // not one of the shapes it accepts.
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Not revoked immediately: some browsers read the blob asynchronously after the
  // click, and revoking too early cancels the save.
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

/** Fetches authenticated bytes without saving or changing their MIME type. */
export async function fetchTripFileBytes(input: {
  readonly tripId: string
  readonly fileId: string
}): Promise<Blob> {
  const response = await downloadTripFileFn({
    data: { tripId: input.tripId, fileId: input.fileId },
  })
  if (!(response instanceof Response)) {
    throw new Error('The download did not come back in a form we could save.')
  }
  if (!response.ok) {
    throw Object.assign(new Error(await reasonFor(response)), {
      status: response.status,
    })
  }
  return response.blob()
}

/** Saves one attachment under its real name; failures go through the caller's useAction. */
export async function downloadTripFile(input: {
  readonly tripId: string
  readonly fileId: string
  readonly filename: string
}): Promise<{ readonly filename: string }> {
  saveBlob(await fetchTripFileBytes(input), input.filename)
  return { filename: input.filename }
}
