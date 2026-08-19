/**
 * Browser-side uploads with a progress bar that means something.
 *
 * A server function called the ordinary way is a `fetch`, and `fetch` cannot
 * report how much of a request body has left the machine — so a "progress" bar
 * built on it is an animation, not a measurement. `XMLHttpRequest` can, through
 * `upload.onprogress`, so this posts the same `FormData` to the same server
 * function by its own URL and reports real bytes.
 *
 * The handler answers with a plain JSON `Response` (rather than a serialised
 * value) precisely so this path can read it without re-implementing the
 * framework's wire format.
 */
import { uploadTripFileFn } from '#/server/fns/files'

import type { FileKind } from '#/server/fns/file-policy'
import type { UploadFailure, UploadResult } from '#/server/fns/files'

export type UploadAnswer = UploadResult | UploadFailure

export interface UploadInput {
  readonly file: File
  readonly tripId: string
  readonly kind?: FileKind
  readonly description?: string
  /** `0`–`1`. Called with `1` only once the request body is fully sent. */
  readonly onProgress?: (fraction: number) => void
  readonly signal?: AbortSignal
}

/** Turned into an `UploadFailure` so callers have one shape to render. */
function failure(code: string, message: string): UploadFailure {
  return { ok: false, code, message }
}

function isAnswer(value: unknown): value is UploadAnswer {
  return typeof value === 'object' && value !== null && 'ok' in value
}

/**
 * Posts one file and resolves with the server's answer.
 *
 * Never rejects: a network fault, an abort and a refusal are all outcomes the
 * queue has to render side by side, so they all come back as `ok: false`.
 */
export function uploadFile(input: UploadInput): Promise<UploadAnswer> {
  return new Promise<UploadAnswer>((resolve) => {
    if (input.signal?.aborted === true) {
      resolve(failure('aborted', 'Upload cancelled.'))
      return
    }

    const body = new FormData()
    body.set('tripId', input.tripId)
    body.set('kind', input.kind ?? '')
    body.set('description', input.description ?? '')
    body.set('file', input.file, input.file.name)

    const request = new XMLHttpRequest()
    request.open('POST', uploadTripFileFn.url, true)
    // Tells the framework's handler that this is a server-function call, so it
    // hands our `Response` back untouched rather than re-serialising it.
    request.setRequestHeader('x-tsr-serverFn', 'true')
    request.responseType = 'text'

    const settle = (answer: UploadAnswer): void => {
      input.signal?.removeEventListener('abort', onAbort)
      resolve(answer)
    }

    function onAbort(): void {
      request.abort()
    }

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        // Held just under 1 until the response lands: a bar that reads 100%
        // while the row still says "uploading" is the bar lying again.
        input.onProgress?.(Math.min(event.loaded / event.total, 0.99))
      }
    })

    request.addEventListener('load', () => {
      let parsed: unknown = null
      try {
        parsed = JSON.parse(request.responseText) as unknown
      } catch {
        parsed = null
      }
      if (isAnswer(parsed)) {
        input.onProgress?.(1)
        settle(parsed)
        return
      }
      settle(
        failure(
          'unreadable',
          request.status >= 400
            ? `The server refused the upload (${request.status}).`
            : 'The server sent an answer this browser could not read.',
        ),
      )
    })

    request.addEventListener('error', () => {
      settle(
        failure(
          'network',
          'The connection dropped while uploading. Check your network and try again.',
        ),
      )
    })

    request.addEventListener('abort', () => {
      settle(failure('aborted', 'Upload cancelled.'))
    })

    request.addEventListener('timeout', () => {
      settle(failure('timeout', 'The upload timed out. Try again.'))
    })

    input.signal?.addEventListener('abort', onAbort, { once: true })
    request.send(body)
  })
}
