/**
 * The one refusal a role change throws, as a message key.
 *
 * A role change from an impersonated session is refused outright (`docs/ACCESS.md` §6.4), and the
 * server function throws it as an `AuthRequirementError` - an authored class, so its `message`
 * reaches the browser untouched. The message is a key rather than an English sentence for the reason
 * `CURRENCY_REFUSAL_KEYS` is (`src/lib/currency-refusals.ts`): the request cannot know the reader's
 * language, the screen that catches it does, and `docs/SPEC.md` §9 rule 10 closes the list of
 * classes that may speak English.
 *
 * Framework-free: it imports no React, no router and nothing from `src/server`, so the server
 * function and the Workspace console can both read it.
 */

import { readPublicFailure } from '#/lib/errors'

import type { MessageKey } from '#/lib/i18n'

export const MEMBER_ROLE_IMPERSONATED_KEY =
  'shell.admin.members.role.impersonated' as const satisfies MessageKey

/** True when a thrown value is the impersonation refusal of a role change. */
export function isMemberRoleImpersonation(error: unknown): boolean {
  const message =
    readPublicFailure(error).message ??
    (error instanceof Error ? error.message : error)
  return message === MEMBER_ROLE_IMPERSONATED_KEY
}
