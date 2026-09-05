/**
 * The single binding seam of `src/server/ai/**`.
 *
 * Everything in this directory that reaches the Worker environment does it here and nowhere else,
 * the same arrangement `src/server/metering/bindings.ts` and `src/server/fns/console/bindings.ts`
 * have and for the same reason their headers give: `cloudflare:workers` cannot be imported in the
 * `server` Vitest project at all, so a module that reaches for a binding itself cannot be driven
 * with a fake one. Keeping the seam to one file is what lets whatever runs the model be tested as
 * itself, against a stub.
 *
 * Nothing here decides anything. It hands back the binding; every rule about when a call is made,
 * what it is allowed to cost and what happens to the answer lives elsewhere — the ceiling in
 * `src/server/billing/limits.ts` (`extraction_calls_per_month`), the tally that measures against it
 * in KV, and the extraction itself in the stage that first calls a model
 * (`docs/plans/03-reservations-and-transport.md`, `03-S7`).
 *
 * **There is no caller yet, and that is the ticket.** `wrangler.jsonc` is a shared path no feature
 * stage may claim, so the binding and its accessor land ahead of the code that spends them —
 * declared, typed and asserted, so the stage that arrives finds a seam rather than a decision.
 */

import { env } from 'cloudflare:workers'

/**
 * The Workers AI binding.
 *
 * Every call made through it is metered and billed to us rather than to the tenant it is made for
 * (`docs/adr/0012-workers-ai-for-confirmation-extraction.md`), so a caller checks the plan's
 * `extraction_calls_per_month` ceiling *before* reaching for this and never after.
 */
export function aiBinding(): Ai {
  return env.AI
}
