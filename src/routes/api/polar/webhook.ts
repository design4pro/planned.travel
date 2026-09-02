import { createFileRoute } from '@tanstack/react-router'
// Loads the Start module augmentation that adds `server` to route options.
import type {} from '@tanstack/react-start'

import { handlePolarWebhook } from '#/server/billing/webhook'
import { billingRuntime } from '#/server/billing/runtime.cloudflare'

/**
 * `POST /api/polar/webhook` — the only unauthenticated write path in the app.
 *
 * The endpoint is deliberately thin; every property that matters is owned by
 * `src/server/billing/webhook.ts` and covered by its tests:
 *
 * - **Signatures.** The raw body is read once and verified as Standard
 *   Webhooks — HMAC-SHA256 over `{webhook-id}.{webhook-timestamp}.{body}` on
 *   WebCrypto, inside a 300 s tolerance. An unverified payload is answered 400
 *   and never reaches a handler, and an unset `POLAR_WEBHOOK_SECRET` refuses
 *   every delivery rather than skipping the check.
 * - **Redelivery.** Polar retries up to ten times, and retries overlap. The
 *   `webhook-id` header — the only id a Polar envelope has — is claimed in KV
 *   before any state changes and confirmed after, so a redelivery is a no-op.
 *   A handler that throws releases its claim so the next retry can succeed.
 * - **Latency.** Polar times a delivery out at ten seconds and asks for an
 *   answer in two. One D1 write happens inline, nothing calls Polar back, and
 *   every slow follow-up goes to the `TASKS` queue.
 *
 * There is no configuration guard around the runtime here on purpose. The Polar
 * client is built lazily and this path never touches it, and the signing secret
 * resolves to an empty string when unset — which the handler turns into a 400
 * with a logged reason instead of an exception.
 *
 * This route declares only `server`, so the Start plugin prunes it from the
 * client bundle and no billing credential goes near a browser.
 */
async function post({ request }: { request: Request }): Promise<Response> {
  return await handlePolarWebhook(
    billingRuntime({ component: 'worker' }),
    request,
  )
}

/** Any other verb is a misconfigured endpoint, not a Polar delivery. */
function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      allow: 'POST',
    },
  })
}

export const Route = createFileRoute('/api/polar/webhook')({
  server: {
    handlers: {
      POST: post,
      GET: methodNotAllowed,
      HEAD: methodNotAllowed,
    },
  },
})
