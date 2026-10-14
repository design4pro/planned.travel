/**
 * The refusals a change of a trip's budget currency can answer with, as message keys.
 *
 * A refusal travels as a key rather than as a sentence, for the reason `SHELL_STATE_KEYS` does
 * (`src/components/layout/session.ts`): the request that fails cannot know which language the reader
 * is reading, but the screen that catches it does, and an `Error.message` is the one field that
 * survives the server-function boundary. `docs/SPEC.md` §9 rule 10 closes the list of authored
 * error classes, so a refusal that wants its own wording joins this list instead of that one.
 *
 * The list is closed on purpose and pinned by `src/server/errors/__tests__/public.test.ts`:
 * `classifyFailure` lets a message through as authored copy only when it is exactly one of these,
 * so adding a key here is a decision a test makes the author look at.
 *
 * Framework-free, like the module it is modelled on: it imports no React, no router and nothing
 * from `src/server`, so the server and a component can both read it.
 */

import { readPublicFailure } from '#/lib/errors'

import type { MessageKey } from '#/lib/i18n'

export const CURRENCY_REFUSAL_KEYS = [
  'shell.editTrip.currencyLocked',
  'costs.refusal.tripCurrencyChanged',
  'costs.refusal.rebaseChanged',
] as const satisfies ReadonlyArray<MessageKey>

/** One of the keys above, so a thrower cannot invent another. */
export type CurrencyRefusalKey = (typeof CURRENCY_REFUSAL_KEYS)[number]

/** The key a thrown currency refusal carries, or `null` for anything else. */
export function currencyRefusalOf(error: unknown): CurrencyRefusalKey | null {
  // Read the redaction envelope first - that is how an authored refusal reaches the browser from a
  // server function - and fall back to the raw message for one thrown on the client itself.
  const message =
    readPublicFailure(error).message ??
    (error instanceof Error ? error.message : error)
  return CURRENCY_REFUSAL_KEYS.find((key) => key === message) ?? null
}
