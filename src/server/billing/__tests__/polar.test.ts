/**
 * The Polar transport, asserted where it can actually be wrong.
 *
 * Three things here are worth a test and the rest is plumbing: the origin
 * switch, because picking sandbox by accident bills nobody and picking
 * production by accident bills everybody; the retry budget, because retrying a
 * 4xx turns one rejected checkout into three; and the signature, because a
 * verifier that agrees with itself proves nothing.
 *
 * So the signature vector below is **hardcoded**. Its expected value was
 * computed out of band with
 *
 *   printf '%s' '<id>.<timestamp>.<body>' \
 *     | openssl dgst -sha256 -hmac '<secret>' -binary \
 *     | openssl base64 -A
 *
 * and pasted in as a literal. Nothing in `../polar` produced it, which is the
 * only way this suite can catch the verifier drifting away from Standard
 * Webhooks — the failure mode where our signer and our checker stay in
 * agreement while both disagree with Polar.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  POLAR_MAX_RETRIES,
  PolarApiError,
  WEBHOOK_TOLERANCE_SECONDS,
  createPolarClient,
  resolvePolarOrigin,
  verifyWebhookSignature,
} from '../polar'
import { BillingConfigError, WebhookVerificationError } from '../types'

import type { PolarFetch } from '../polar'
import type { PolarRequest } from '../types'

/* ---------------------------------------------------------------- the vector */

const VECTOR = {
  secret: 'polar_whs_TESTVECTOR_do_not_use',
  webhookId: 'evt_test_0001',
  timestamp: '1767225600',
  body: '{"type":"subscription.updated","timestamp":"2026-01-01T00:00:00Z","data":{"id":"sub_1"}}',
  /** openssl dgst -sha256 -hmac 'polar_whs_TESTVECTOR_do_not_use' */
  signature: '4M/s5GzbfqHpfQ0HNdriaAW8snooXCyvZmYQQAwKbcI=',
} as const

/**
 * The same content signed with a `whsec_`-prefixed secret, to pin that the key
 * is the raw stored bytes: the prefix is signed over, not stripped, and the
 * secret is never base64-decoded first.
 */
const PREFIXED_VECTOR = {
  secret: 'whsec_polar_TESTVECTOR_do_not_use',
  signature: 'SIDm5L/wm4Xb6JhlZhK+lK9bfwzm4dOB3hMfsXuG6hI=',
} as const

/** A structurally valid signature over a different body. Never matches. */
const OTHER_BODY_SIGNATURE = 'OqWBbP0GNSyVqpUaeh14pwnv1eSONxqcUTDKqTt2GFo='

/** The clock the vector's timestamp is fresh against. */
const VECTOR_NOW = new Date(Number(VECTOR.timestamp) * 1000)

function deliveryHeaders(signature: string, timestamp: string): Headers {
  return new Headers({
    'webhook-id': VECTOR.webhookId,
    'webhook-timestamp': timestamp,
    'webhook-signature': signature,
  })
}

function verifyVector(
  overrides: {
    secret?: string
    signature?: string
    payload?: string
    timestamp?: string
    now?: Date
  } = {},
) {
  return verifyWebhookSignature({
    secret: overrides.secret ?? VECTOR.secret,
    headers: deliveryHeaders(
      overrides.signature ?? `v1,${VECTOR.signature}`,
      overrides.timestamp ?? VECTOR.timestamp,
    ),
    payload: overrides.payload ?? VECTOR.body,
    now: overrides.now ?? VECTOR_NOW,
  })
}

/* ------------------------------------------------------------- fetch doubles */

const LIST_ORDERS: PolarRequest = { method: 'GET', path: '/v1/orders/' }

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

/** Answers with each queued response in turn and records every call. */
function scriptedFetch(responses: Array<Response | Error>): {
  fetch: PolarFetch
  calls: Array<{ url: string; init: RequestInit | undefined }>
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  let index = 0
  return {
    calls,
    fetch: (url, init) => {
      calls.push({ url, init })
      const next = responses[Math.min(index, responses.length - 1)]
      index += 1
      if (next instanceof Error) return Promise.reject(next)
      return Promise.resolve(next.clone())
    },
  }
}

function client(
  responses: Array<Response | Error>,
  options: { server?: string; sleep?: (ms: number) => Promise<void> } = {},
) {
  const scripted = scriptedFetch(responses)
  return {
    calls: scripted.calls,
    polar: createPolarClient({
      accessToken: 'polar_oat_test',
      server: options.server ?? 'sandbox',
      fetch: scripted.fetch,
      sleep: options.sleep ?? (() => Promise.resolve()),
    }),
  }
}

/* ------------------------------------------------------------------- origins */

describe('the API origin', () => {
  it('is production for `production` and sandbox for `sandbox`', () => {
    expect(resolvePolarOrigin('production')).toBe('https://api.polar.sh')
    expect(resolvePolarOrigin('sandbox')).toBe('https://sandbox-api.polar.sh')
  })

  it('refuses to guess when POLAR_SERVER is unset or misspelled', () => {
    for (const value of [undefined, '', 'Sandbox', 'prod', 'staging']) {
      expect(() => resolvePolarOrigin(value)).toThrow(BillingConfigError)
    }
    expect(() => resolvePolarOrigin(undefined)).toThrow(/wrangler secret put POLAR_SERVER/)
  })

  it('prefixes the path as given, since every path carries its own /v1', async () => {
    const { polar, calls } = client([jsonResponse(200, { items: [] })], {
      server: 'production',
    })

    await polar.request({
      method: 'GET',
      path: '/v1/orders/',
      query: { limit: 10, external_customer_id: 'org_1' },
    })

    expect(calls[0]?.url).toBe(
      'https://api.polar.sh/v1/orders/?limit=10&external_customer_id=org_1',
    )
  })
})

/* ----------------------------------------------------------- the access token */

describe('the access token', () => {
  it('fails loudly with the command that fixes it', () => {
    for (const token of ['', undefined]) {
      let caught: unknown
      try {
        createPolarClient({ accessToken: token, server: 'sandbox' })
      } catch (error) {
        caught = error
      }
      expect(caught).toBeInstanceOf(BillingConfigError)
      expect((caught as Error).message).toContain(
        'wrangler secret put POLAR_ACCESS_TOKEN',
      )
    }
  })

  it('is sent as a bearer credential and never in the URL', async () => {
    const { polar, calls } = client([jsonResponse(201, { id: 'co_1' })])

    await polar.request({
      method: 'POST',
      path: '/v1/checkouts/',
      body: { products: ['p_1'] },
    })

    const init = calls[0]?.init
    const headers = init?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer polar_oat_test')
    expect(headers['content-type']).toBe('application/json')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"products":["p_1"]}')
    expect(calls[0]?.url).not.toContain('polar_oat_test')
  })

  it('reads an empty 202 body as null rather than failing to parse it', async () => {
    const { polar } = client([new Response(null, { status: 202 })])
    await expect(
      polar.request({ method: 'POST', path: '/v1/orders/ord_1/invoice' }),
    ).resolves.toBeNull()
  })
})

/* --------------------------------------------------------------------- retry */

describe('the retry budget', () => {
  it('does not retry a 4xx', async () => {
    const { polar, calls } = client([jsonResponse(400, { detail: 'products is required' })])

    const failure = await polar
      .request({ method: 'POST', path: '/v1/checkouts/', body: {} })
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(PolarApiError)
    expect((failure as PolarApiError).status).toBe(400)
    expect((failure as PolarApiError).detail).toContain('products is required')
    expect(calls).toHaveLength(1)
  })

  it('retries a 503 and returns the eventual success', async () => {
    const { polar, calls } = client([
      new Response('upstream unavailable', { status: 503 }),
      jsonResponse(200, { items: [{ id: 'ord_1' }] }),
    ])

    await expect(polar.request(LIST_ORDERS)).resolves.toEqual({ items: [{ id: 'ord_1' }] })
    expect(calls).toHaveLength(2)
  })

  it('gives up after two retries and reports the last status', async () => {
    const { polar, calls } = client([new Response('boom', { status: 500 })])

    const failure = await polar.request(LIST_ORDERS).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(PolarApiError)
    expect((failure as PolarApiError).status).toBe(500)
    expect(calls).toHaveLength(POLAR_MAX_RETRIES + 1)
  })

  it('waits out a retry-after on a 429 instead of its own backoff', async () => {
    const sleep = vi.fn(() => Promise.resolve())
    const { polar } = client(
      [
        new Response('slow down', { status: 429, headers: { 'retry-after': '2' } }),
        jsonResponse(200, { ok: true }),
      ],
      { sleep },
    )

    await expect(polar.request(LIST_ORDERS)).resolves.toEqual({ ok: true })
    expect(sleep).toHaveBeenCalledExactlyOnceWith(2000)
  })

  it('caps a retry-after that would outlast the customer waiting on it', async () => {
    const sleep = vi.fn(() => Promise.resolve())
    const { polar } = client(
      [
        new Response('slow down', { status: 429, headers: { 'retry-after': '600' } }),
        jsonResponse(200, { ok: true }),
      ],
      { sleep },
    )

    await polar.request(LIST_ORDERS)
    expect(sleep).toHaveBeenCalledExactlyOnceWith(5000)
  })

  it('backs off exponentially when the response says nothing', async () => {
    const sleep = vi.fn(() => Promise.resolve())
    const { polar } = client([new Response('boom', { status: 502 })], { sleep })

    await polar.request(LIST_ORDERS).catch(() => undefined)

    expect(sleep.mock.calls).toEqual([[250], [500]])
  })

  it('retries a dropped connection and rethrows it once the budget is spent', async () => {
    const { polar, calls } = client([new Error('network error')])

    await expect(polar.request(LIST_ORDERS)).rejects.toThrow('network error')
    expect(calls).toHaveLength(POLAR_MAX_RETRIES + 1)
  })
})

/* ----------------------------------------------------------------- signature */

describe('verifyWebhookSignature', () => {
  it('accepts the hardcoded Standard Webhooks vector', async () => {
    await expect(verifyVector()).resolves.toEqual({
      webhookId: VECTOR.webhookId,
      sentAt: VECTOR_NOW,
    })
  })

  it('runs on WebCrypto alone, with no workerd-only helper', () => {
    // `crypto.subtle.timingSafeEqual()` is a Cloudflare extension and is absent
    // from the Node environment this project runs in. The test above passing
    // here is the proof that the verifier never reaches for it.
    expect(typeof crypto.subtle.importKey).toBe('function')
  })

  it('rejects the vector with one body byte changed', async () => {
    const mutated = VECTOR.body.replace('sub_1', 'sub_2')
    expect(mutated).not.toBe(VECTOR.body)

    await expect(verifyVector({ payload: mutated })).rejects.toBeInstanceOf(
      WebhookVerificationError,
    )
  })

  it('rejects the vector under a different secret', async () => {
    await expect(verifyVector({ secret: 'polar_whs_someone_elses' })).rejects.toThrow(
      /No `v1` signature/,
    )
  })

  it('signs the raw bytes of the secret, `whsec_` prefix and all', async () => {
    await expect(
      verifyVector({
        secret: PREFIXED_VECTOR.secret,
        signature: `v1,${PREFIXED_VECTOR.signature}`,
      }),
    ).resolves.toMatchObject({ webhookId: VECTOR.webhookId })

    // The same bytes base64-decoded would be a different key entirely.
    await expect(
      verifyVector({
        secret: btoa(PREFIXED_VECTOR.secret),
        signature: `v1,${PREFIXED_VECTOR.signature}`,
      }),
    ).rejects.toBeInstanceOf(WebhookVerificationError)
  })

  it('rejects a delivery 301 seconds either side of the window', async () => {
    const tooOld = new Date(VECTOR_NOW.getTime() + (WEBHOOK_TOLERANCE_SECONDS + 1) * 1000)
    const tooNew = new Date(VECTOR_NOW.getTime() - (WEBHOOK_TOLERANCE_SECONDS + 1) * 1000)

    await expect(verifyVector({ now: tooOld })).rejects.toThrow(/too old/)
    await expect(verifyVector({ now: tooNew })).rejects.toThrow(/in the future/)
  })

  it('accepts a delivery exactly on the tolerance boundary', async () => {
    const edge = new Date(VECTOR_NOW.getTime() + WEBHOOK_TOLERANCE_SECONDS * 1000)
    await expect(verifyVector({ now: edge })).resolves.toBeDefined()
  })

  it('verifies through a rotation, whichever of the two entries is current', async () => {
    await expect(
      verifyVector({ signature: `v1,${OTHER_BODY_SIGNATURE} v1,${VECTOR.signature}` }),
    ).resolves.toBeDefined()

    await expect(
      verifyVector({ signature: `v1,${VECTOR.signature} v1,${OTHER_BODY_SIGNATURE}` }),
    ).resolves.toBeDefined()
  })

  it('ignores an entry whose version is not v1', async () => {
    await expect(
      verifyVector({ signature: `v2,${VECTOR.signature}` }),
    ).rejects.toBeInstanceOf(WebhookVerificationError)

    // …but a v1 entry still counts when an unknown version travels beside it.
    await expect(
      verifyVector({ signature: `v2,${VECTOR.signature} v1,${VECTOR.signature}` }),
    ).resolves.toBeDefined()
  })

  it('rejects a delivery that is missing a header, or a timestamp that is not one', async () => {
    await expect(
      verifyWebhookSignature({
        secret: VECTOR.secret,
        headers: new Headers({ 'webhook-id': VECTOR.webhookId }),
        payload: VECTOR.body,
        now: VECTOR_NOW,
      }),
    ).rejects.toThrow(/webhook-timestamp/)

    await expect(verifyVector({ timestamp: 'yesterday' })).rejects.toThrow(
      /not a timestamp/,
    )
  })

  it('refuses to verify anything when the signing secret is unset', async () => {
    await expect(verifyVector({ secret: '' })).rejects.toThrow(/POLAR_WEBHOOK_SECRET/)
  })
})
