/**
 * Saving one trip export to the reader's machine.
 *
 * The download server function answers with a raw `Response` streamed from R2. `download.ts` turns a
 * file's response into a blob and a synthetic link; an export differs in two ways: a miss is a normal
 * outcome the panel words itself (an export is pruned after seven days), and the printable page is
 * markup that must never reach an object URL under its own type, so the blob is re-typed before it is
 * saved.
 */
import { downloadTripExportFn } from '#/server/fns/exports'

/** What a download came to; the panel decides the words. */
export type ExportDownloadResult =
  | { readonly kind: 'saved' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'failed'; readonly status: number }
  | { readonly kind: 'shape' }

const GENERIC_BINARY = 'application/octet-stream'

/** How long the object URL is kept alive after the click that consumed it. */
const REVOKE_DELAY_MS = 60_000

/** The file name the server chose, from `content-disposition: attachment; filename*=UTF-8''…`. */
function filenameOf(response: Response, format: string): string {
  const fallback = `trip-export.${format}`
  const header = response.headers.get('content-disposition') ?? ''
  const encoded = /filename\*=UTF-8''([^;]+)/iu.exec(header)?.[1]
  if (encoded === undefined) {
    return fallback
  }
  try {
    return decodeURIComponent(encoded)
  } catch {
    return fallback
  }
}

export async function downloadTripExport(input: {
  readonly tripId: string
  readonly taskId: string
  readonly format: 'pdf' | 'html'
}): Promise<ExportDownloadResult> {
  const response = await downloadTripExportFn({
    data: { tripId: input.tripId, taskId: input.taskId },
  })

  if (!(response instanceof Response)) {
    return { kind: 'shape' }
  }
  if (response.status === 404) {
    return { kind: 'missing' }
  }
  if (!response.ok) {
    return { kind: 'failed', status: response.status }
  }

  const blob = new Blob([await response.blob()], { type: GENERIC_BINARY })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filenameOf(response, input.format)
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)

  return { kind: 'saved' }
}
