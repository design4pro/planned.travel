/**
 * The Polar REST client and the Standard Webhooks verifier.
 *
 * Two constraints shape this file, and they are the reason it is hand-rolled:
 *
 * 1. It runs on workerd. There is no Node `http`, no `node:crypto` in the hot
 *    path and no room for a vendor SDK inside the Worker size budget, so the
 *    client is `fetch` and the verifier is WebCrypto. Both are also present in
 *    plain Node, which is what lets the unit tests run in the `server` project
 *    without a Workers pool.
 * 2. Polar's own retry policy is generous — up to ten webhook deliveries with
 *    exponential backoff — but *our* outbound calls sit inside a request the
 *    customer is waiting on. So the budget here is deliberately small: two
 *    retries, twenty seconds an attempt, and only for the statuses where a
 *    retry can plausibly succeed.
 *
 * Nothing in here knows what a checkout or an order is. Callers own their
 * request bodies and validate their responses with Zod at the boundary; this
 * module owns the origin, the credential, the retry policy and the signature.
 */

import { BillingConfigError, WebhookVerificationError } from './types'
import type { PolarClient, PolarRequest } from './types'

/* -------------------------------------------------------------------- origin */

/**
 * The two origins Polar publishes. Every path we call already carries `/v1`,
 * so `POLAR_SERVER` selects the origin and nothing else.
 */
const API_ORIGINS = {
  production: 'https://api.polar.sh',
  sandbox: 'https://sandbox-api.polar.sh',
} as const

export type PolarServer = keyof typeof API_ORIGINS

function isPolarServer(value: string): value is PolarServer {
  return Object.prototype.hasOwnProperty.call(API_ORIGINS, value)
}

/**
 * Resolve the API origin from `POLAR_SERVER`.
 *
 * There is no default. A deployment that forgot the variable would otherwise
 * take real money against the sandbox — or, worse, run test cards against
 * production — and discover it from a customer rather than from a deploy.
 */
export function resolvePolarOrigin(server: string | undefined): string {
  if (typeof server === 'string' && isPolarServer(server)) {
    return API_ORIGINS[server]
  }
  throw new BillingConfigError(
    "POLAR_SERVER must be either 'sandbox' or 'production'. " +
      'Set it with `wrangler secret put POLAR_SERVER`.',
  )
}

/* --------------------------------------------------------------- retry policy */

/** Attempts after the first. Three calls at the very most. */
export const POLAR_MAX_RETRIES = 2

/** Per-attempt ceiling. The whole call can still cost three of these. */
export const POLAR_TIMEOUT_MS = 20_000

/** First backoff step; doubled on the second retry. */
const RETRY_BASE_DELAY_MS = 250

/**
 * Upper bound on a `retry-after` we will actually wait out. Polar may ask for a
 * minute; a customer waiting on a checkout redirect will not, so past this we
 * fail fast and let the caller show its own error.
 */
const RETRY_AFTER_CEILING_MS = 5_000

/** Longest error body we keep on a `PolarApiError`. */
const MAX_ERROR_DETAIL = 512

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

/** `retry-after` is either delta-seconds or an HTTP date. Both are honoured. */
function retryAfterMs(value: string | null): number | null {
  if (value === null) return null
  const seconds = Number.parseInt(value, 10)
  if (Number.isFinite(seconds) && seconds >= 0 && String(seconds) === value.trim()) {
    return seconds * 1000
  }
  const at = Date.parse(value)
  if (Number.isFinite(at)) return Math.max(0, at - Date.now())
  return null
}

function backoffMs(attempt: number, response: Response | null): number {
  const asked = response === null ? null : retryAfterMs(response.headers.get('retry-after'))
  if (asked !== null) return Math.min(asked, RETRY_AFTER_CEILING_MS)
  return RETRY_BASE_DELAY_MS * 2 ** attempt
}

/* --------------------------------------------------------------------- errors */

/** A Polar response we did not ask for. `status` is what callers branch on. */
export class PolarApiError extends Error {
  override readonly name = 'PolarApiError'
  readonly status: number
  /** The response body, truncated. Never contains our credential. */
  readonly detail: string

  constructor(status: number, detail: string, message: string) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

/* --------------------------------------------------------------------- client */

/**
 * The client this module builds is the adapter behind the `PolarClient` port in
 * `./types`: one `request()` method, paths on the call site, responses as
 * `unknown`. The port is declared there rather than here so the billing logic
 * can be tested against a fake without importing the transport.
 */
export type PolarFetch = (input: string, init?: RequestInit) => Promise<Response>

export interface PolarClientOptions {
  /** Organization Access Token. Never reaches the browser. */
  readonly accessToken: string | undefined
  /** Raw `POLAR_SERVER`; validated here rather than at the call site. */
  readonly server: string | undefined
  /** Injected in tests so no unit test can reach the network. */
  readonly fetch?: PolarFetch
  /** Injected in tests so the backoff can be asserted without waiting it out. */
  readonly sleep?: (ms: number) => Promise<void>
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function buildUrl(
  baseUrl: string,
  path: string,
  query: PolarRequest['query'],
): string {
  if (query === undefined) return `${baseUrl}${path}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    params.append(key, String(value))
  }
  const search = params.toString()
  return search === '' ? `${baseUrl}${path}` : `${baseUrl}${path}?${search}`
}

async function readDetail(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, MAX_ERROR_DETAIL)
  } catch {
    return '<unreadable body>'
  }
}

/**
 * Parse a success body. `POST /v1/orders/{id}/invoice` answers 202 with nothing
 * at all, so an empty body is `null` rather than a JSON parse failure.
 */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (text.trim() === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new PolarApiError(
      response.status,
      text.slice(0, MAX_ERROR_DETAIL),
      `Polar returned a ${response.status} that is not JSON.`,
    )
  }
}

/**
 * Build the client.
 *
 * Constructing it is what validates the configuration, which is why the
 * runtime keeps it behind a lazy getter: a deployment with no token must still
 * be able to render the billing screen from its own database.
 */
export function createPolarClient(options: PolarClientOptions): PolarClient {
  const accessToken = options.accessToken ?? ''
  if (accessToken === '') {
    throw new BillingConfigError(
      'POLAR_ACCESS_TOKEN is not set. Add it with `wrangler secret put POLAR_ACCESS_TOKEN`.',
    )
  }

  const baseUrl = resolvePolarOrigin(options.server)
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init))
  const sleep = options.sleep ?? defaultSleep

  async function request(spec: PolarRequest): Promise<unknown> {
    const url = buildUrl(baseUrl, spec.path, spec.query)
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    }
    if (spec.body !== undefined) headers['content-type'] = 'application/json'

    for (let attempt = 0; ; attempt += 1) {
      let response: Response
      try {
        response = await doFetch(url, {
          method: spec.method,
          headers,
          body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
          signal: AbortSignal.timeout(POLAR_TIMEOUT_MS),
        })
      } catch (cause) {
        // A timeout or a dropped connection is exactly what the budget exists
        // for; anything past it is the caller's problem, unchanged.
        if (attempt >= POLAR_MAX_RETRIES) throw cause
        await sleep(backoffMs(attempt, null))
        continue
      }

      if (response.ok) return await readBody(response)

      // Read the body before branching: it is what the error carries, and
      // draining it is also what releases the connection before a retry.
      const detail = await readDetail(response)

      if (isRetryableStatus(response.status) && attempt < POLAR_MAX_RETRIES) {
        await sleep(backoffMs(attempt, response))
        continue
      }

      throw new PolarApiError(
        response.status,
        detail,
        `Polar ${spec.method} ${spec.path} failed with ${response.status}: ${detail}`,
      )
    }
  }

  return { request }
}

/* ------------------------------------------------------------------- webhooks */

/** How far a delivery timestamp may drift from our clock, in either direction. */
export const WEBHOOK_TOLERANCE_SECONDS = 300

/** Just enough of `Headers` to verify a delivery; a plain fake satisfies it. */
export interface WebhookHeaderReader {
  get: (name: string) => string | null
}

export interface WebhookVerificationInput {
  /**
   * `POLAR_WEBHOOK_SECRET` exactly as stored. The HMAC key is its raw UTF-8
   * bytes — the value is **not** base64-decoded, and a `whsec_` prefix is part
   * of the key rather than something to strip. Polar's own SDK base64-encodes
   * the plain secret only to hand it to a library that decodes it again, so the
   * net key is the bytes you set with `wrangler secret put`.
   */
  readonly secret: string
  readonly headers: WebhookHeaderReader
  /** The raw request body, byte for byte. Re-serialised JSON will not verify. */
  readonly payload: string
  /** Injected clock, so the tolerance window is testable. */
  readonly now?: Date
}

export interface VerifiedWebhook {
  /** The `webhook-id` header — Polar's event id, and our idempotency key. */
  readonly webhookId: string
  /** The `webhook-timestamp` header, as a date. */
  readonly sentAt: Date
}

function requireHeader(headers: WebhookHeaderReader, name: string): string {
  const value = headers.get(name)
  if (value === null || value === '') {
    throw new WebhookVerificationError(`The delivery is missing its \`${name}\` header.`)
  }
  return value
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function signContent(secret: string, content: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(content))
  return toBase64(new Uint8Array(signature))
}

/**
 * Length-independent comparison.
 *
 * `crypto.subtle.timingSafeEqual()` is a workerd extension and is absent from
 * Node, where these tests run, so the loop is ours. It walks the longer of the
 * two strings and folds the length difference into the accumulator, so neither
 * the loop count nor an early return depends on where the first mismatch is.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let index = 0; index < length; index += 1) {
    const left = index < a.length ? a.charCodeAt(index) : 0
    const right = index < b.length ? b.charCodeAt(index) : 0
    diff |= left ^ right
  }
  return diff === 0
}

/**
 * Verify one Standard Webhooks delivery.
 *
 * Signed content is `${webhook-id}.${webhook-timestamp}.${raw body}`, HMAC
 * SHA-256, standard base64 with padding. `webhook-signature` carries one or
 * more space-delimited `<version>,<signature>` entries — that is how a secret
 * rotation is delivered — and anything that is not `v1` is skipped rather than
 * rejected, so a future version does not break a working endpoint.
 *
 * Throws `WebhookVerificationError` on every failure, which is what lets the
 * endpoint answer 400 instead of 500.
 */
export async function verifyWebhookSignature(
  input: WebhookVerificationInput,
): Promise<VerifiedWebhook> {
  if (input.secret === '') {
    throw new WebhookVerificationError(
      'POLAR_WEBHOOK_SECRET is not set, so no delivery can be verified.',
    )
  }

  const webhookId = requireHeader(input.headers, 'webhook-id')
  const timestamp = requireHeader(input.headers, 'webhook-timestamp')
  const signatureHeader = requireHeader(input.headers, 'webhook-signature')

  const sentAtSeconds = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(sentAtSeconds)) {
    throw new WebhookVerificationError('The `webhook-timestamp` header is not a timestamp.')
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const drift = nowSeconds - sentAtSeconds
  if (drift > WEBHOOK_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError('The delivery timestamp is too old.')
  }
  if (drift < -WEBHOOK_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError('The delivery timestamp is in the future.')
  }

  const expected = await signContent(
    input.secret,
    `${webhookId}.${timestamp}.${input.payload}`,
  )

  for (const entry of signatureHeader.split(' ')) {
    const separator = entry.indexOf(',')
    if (separator === -1) continue
    if (entry.slice(0, separator) !== 'v1') continue
    if (constantTimeEqual(entry.slice(separator + 1), expected)) {
      return { webhookId, sentAt: new Date(sentAtSeconds * 1000) }
    }
  }

  throw new WebhookVerificationError('No `v1` signature on the delivery matched.')
}
