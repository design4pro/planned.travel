import { createFileRoute } from '@tanstack/react-router'
// Loads the Start module augmentation that adds `server` to route options.
import type {} from '@tanstack/react-start'

import { handleStripeWebhook } from '#/server/billing/webhook'
import { billingRuntime } from '#/server/billing/runtime.cloudflare'
import { BillingConfigError } from '#/server/billing/types'

import type { BillingRuntime } from '#/server/billing/types'

/**
 * `POST /api/stripe/webhook` — the only unauthenticated write path in the app.
 *
 * The endpoint itself is deliberately thin; every property that matters is owned
 * by `src/server/billing/webhook.ts` and covered by its tests:
 *
 * - **Signatures** are verified with `constructEventAsync` against the endpoint
 *   signing secret. That async variant is not a stylistic choice: workerd has no
 *   Node `crypto`, so verification runs on WebCrypto, which is promise-based.
 *   An unverified payload is rejected with 400 and never reaches a handler.
 * - **Redelivery** is a no-op. Each event id is claimed in KV before any work
 *   starts and confirmed after it finishes, so Stripe's retries — which can
 *   overlap — cannot apply the same change twice. A handler that throws releases
 *   its claim so the next retry can still succeed.
 * - **Latency** stays low because only the D1 write happens inline. Receipts,
 *   dunning notices and every other slow follow-up are pushed onto the `TASKS`
 *   queue, so Stripe gets its 200 without waiting on them.
 *
 * This route declares only `server`, so the Start router plugin prunes it from
 * the client bundle and the Stripe secret key never gets near a browser.
 */
async function post({ request }: { request: Request }): Promise<Response> {
  let runtime: BillingRuntime
  try {
    runtime = billingRuntime({ component: 'worker' })
  } catch (cause) {
    // A deployment missing STRIPE_SECRET_KEY cannot verify anything. Answering
    // 500 is correct: Stripe retries, and the retry succeeds once the secret is
    // set, whereas a 400 would tell Stripe to give up on a real event.
    if (cause instanceof BillingConfigError) {
      return json({ error: 'Billing is not configured.' }, 500)
    }
    throw cause
  }

  return await handleStripeWebhook(runtime, request)
}

/** Any other verb is a misconfigured endpoint, not a Stripe delivery. */
function methodNotAllowed(): Response {
  return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' })
}

function json(
  body: Readonly<Record<string, unknown>>,
  status: number,
  extraHeaders: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: post,
      GET: methodNotAllowed,
      HEAD: methodNotAllowed,
    },
  },
})
