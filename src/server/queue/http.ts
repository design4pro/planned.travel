/**
 * Shared upstream-call helpers for queue handlers.
 *
 * The retry/permanent split is the important part: a 4xx from an upstream is a
 * bug or a bad payload and must not be retried 5 times before dead-lettering,
 * while a 429 or 5xx is exactly what backoff exists for.
 */

import { TaskPermanentError, TaskRetryableError } from './types'

const MAX_ERROR_BODY = 512

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) return undefined
  const seconds = Number.parseInt(value, 10)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const at = Date.parse(value)
  if (Number.isFinite(at)) return Math.max(0, Math.round((at - Date.now()) / 1000))
  return undefined
}

/** Throws the right error class for a non-2xx upstream response. */
export async function assertUpstreamOk(response: Response, what: string): Promise<void> {
  if (response.ok) return
  let detail = ''
  try {
    detail = (await response.text()).slice(0, MAX_ERROR_BODY)
  } catch {
    detail = '<unreadable body>'
  }
  const message = `${what} failed with ${response.status}: ${detail}`
  if (response.status === 429 || response.status >= 500) {
    throw new TaskRetryableError(message, {
      retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
    })
  }
  throw new TaskPermanentError(message)
}

/** Cloudflare REST API envelope. */
export interface CloudflareApiResponse<T> {
  success: boolean
  errors: Array<{ code?: number; message: string }>
  result: T
}

export async function readCloudflareApi<T>(response: Response, what: string): Promise<T> {
  await assertUpstreamOk(response, what)
  const body = await response.json<CloudflareApiResponse<T>>()
  if (!body.success) {
    const detail = body.errors.map((error) => error.message).join('; ')
    throw new TaskRetryableError(`${what} returned success=false: ${detail}`)
  }
  return body.result
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** `fetch` init extended with Cloudflare's image transform options. */
export interface ImageTransformInit extends RequestInit {
  cf?: {
    image: {
      width?: number
      height?: number
      fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
      format?: 'webp' | 'avif' | 'json'
      quality?: number
      metadata?: 'keep' | 'copyright' | 'none'
    }
    cacheTtl?: number
  }
}
