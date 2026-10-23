/**
 * The refusal a save of a Transport answers with when the transport is no longer there, as a
 * message key.
 *
 * A transport can be deleted in another tab, or by another member, while a dialog is open on it.
 * The save is then refused rather than written back (`saveTransport` with the `edit` intent), and
 * that refusal is the product working, not a failure: it needs its own wording in the reader's
 * language and no incident behind it. It travels as a key for the reason `CURRENCY_REFUSAL_KEYS`
 * does (`src/lib/currency-refusals.ts`): the request cannot know which language the reader is
 * reading, the dialog that catches it does, and `docs/SPEC.md` §9 rule 10 closes the list of error
 * classes that may speak English.
 *
 * The list is closed on purpose and pinned by `src/server/errors/__tests__/public.test.ts`:
 * `classifyFailure` lets a message through as authored copy only when it is exactly one of these.
 * It holds the one state a reader can act on - the row is gone - and nothing else about a
 * transport: a transport of another workspace or another trip stays an ordinary `NotFoundError`.
 *
 * Framework-free, like the module it is modelled on: it imports no React, no router and nothing
 * from `src/server`, so the server and a component can both read it.
 */

import { readPublicFailure } from '#/lib/errors'

import type { MessageKey } from '#/lib/i18n'

export const TRANSPORT_REFUSAL_KEYS = [
  'modules.transports.refusal.gone',
] as const satisfies ReadonlyArray<MessageKey>

/** One of the keys above, so a thrower cannot invent another. */
export type TransportRefusalKey = (typeof TRANSPORT_REFUSAL_KEYS)[number]

/** The key a thrown transport refusal carries, or `null` for anything else. */
export function transportRefusalOf(error: unknown): TransportRefusalKey | null {
  // Read the redaction envelope first - that is how an authored refusal reaches the browser from a
  // server function - and fall back to the raw message for one thrown on the client itself.
  const message =
    readPublicFailure(error).message ??
    (error instanceof Error ? error.message : error)
  return TRANSPORT_REFUSAL_KEYS.find((key) => key === message) ?? null
}
