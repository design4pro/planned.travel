/**
 * The Stripe client for the Cloudflare Workers runtime.
 *
 * Two things matter here and nowhere else:
 *
 * 1. `Stripe.createFetchHttpClient()` — the Node `http` module does not exist on
 *    workerd, so the SDK is told explicitly to use `fetch`. This is set even though
 *    the package ships a `worker` export condition, because the SSR bundle may be
 *    resolved through the `default` condition.
 * 2. `Stripe.createSubtleCryptoProvider()` — webhook verification must run on
 *    WebCrypto, which is asynchronous, so signature checks use `constructEventAsync`.
 */

import Stripe from 'stripe'
import { BillingConfigError } from './types'

/**
 * Pinned API version. Bumping it is a deliberate migration: `Subscription`
 * period boundaries live on subscription *items* from this version onwards.
 */
export const STRIPE_API_VERSION = '2026-07-29.dahlia'

/** How far a webhook timestamp may drift from our clock, in seconds. */
export const WEBHOOK_TOLERANCE_SECONDS = 300

export function createStripeClient(secretKey: string): Stripe {
  if (secretKey === '') {
    throw new BillingConfigError(
      'STRIPE_SECRET_KEY is not set. Add it with `wrangler secret put STRIPE_SECRET_KEY`.',
    )
  }

  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 20_000,
    telemetry: false,
    appInfo: { name: 'planned.travel', url: 'https://planned.travel' },
  })
}

let subtleCryptoProvider: Stripe.CryptoProvider | null = null

/**
 * WebCrypto-backed signature verifier, memoised per isolate.
 * Pass this to `webhooks.constructEventAsync`.
 */
export function stripeWebhookCryptoProvider(): Stripe.CryptoProvider {
  subtleCryptoProvider ??= Stripe.createSubtleCryptoProvider()
  return subtleCryptoProvider
}

/** Stripe metadata is string-only; this is the shape we always write. */
export interface StripeBillingMetadata extends Record<string, string> {
  organizationId: string
  planId: string
  interval: string
  seats: string
}

/** Read our organization id back off any Stripe object that carries metadata. */
export function organizationIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): string | null {
  const value = metadata?.organizationId
  return typeof value === 'string' && value !== '' ? value : null
}

/** Unwrap a Stripe field that may be an id string or an expanded object. */
export function stripeIdOf(
  value: string | { id: string } | null | undefined,
): string | null {
  if (value == null) return null
  return typeof value === 'string' ? value : value.id
}

/** Convert a Stripe unix timestamp (seconds) to a `Date`, tolerating null. */
export function fromStripeTimestamp(seconds: number | null | undefined): Date | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null
}
