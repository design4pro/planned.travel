/**
 * What happens between a chip being clicked and the product speaking a new
 * language, as a value rather than as a component method.
 *
 * The click has three outcomes and only one of them is a success, so the screen
 * has to tell them apart before it opens its mouth. It is written here, away
 * from the route, for one reason: the branch that matters most is the one that
 * cannot be reached by clicking. `src/routes/**` is compiled into the `server`
 * vitest project, which has no DOM, so a route component's own logic is
 * unreachable from a test — and the round before this one answered that by
 * asserting the *source text* of `language.tsx` with regular expressions. Those
 * tests broke on a reformat and passed on a rewrite that meant the opposite. A
 * plain function with its four collaborators passed in is testable for what it
 * does instead of for how it is spelled.
 *
 * **The three outcomes.**
 *
 * - `rejected` — `saveLanguagePreference` threw, so `user_settings.locale` is
 *   untouched. The selection goes back to what D1 still holds and the reader is
 *   told, in the language they are still reading, that nothing changed.
 * - `switched` — the row was written, the screen re-loaded cleanly, and the
 *   catalogue for the incoming locale is in hand. Only here may the screen say
 *   the product now speaks it, and it says so with `speak` — a translator built
 *   for the locale that just arrived, because the one the render closed over
 *   belongs to the language being left.
 * - `stale` — the row was written and the turn behind it was not: the re-load
 *   put a match into its error boundary, or the incoming catalogue chunk failed
 *   to fetch. "Your language was not changed" would contradict both D1 and the
 *   chip the reader is looking at, so this outcome gets the saved-not-switched
 *   pair of sentences and a reload instead.
 *
 * **Why `refreshed` is a question and not a `catch`.** The obvious shape —
 * `try { await router.invalidate() } catch` — is dead code. TanStack routes a
 * loader rejection to the match's `errorComponent` and *resolves* the
 * invalidation, so the `catch` never fires and the screen was congratulating
 * the reader on a language change while rendering an error panel behind the
 * toast. The router publishes the answer as match state instead, so the caller
 * is asked for it.
 */

import type { Locale, Translate } from '#/lib/i18n'

/**
 * The traveller's own language, in the column's vocabulary: a tag, or `null`
 * while they follow the workspace.
 *
 * The picker has its own sentinel for the same state, because a radio group
 * needs a string per option. Translating between the two is the route's job:
 * this module speaks D1's language so it can be tested without mounting a
 * radio group, and so the `''`-clears-the-override wire rule lives in exactly
 * one place.
 */
export type LanguageOverride = Locale | null

/** Which of the two rows decides what the reader sees, once a choice is made. */
export function localeInForce(
  override: LanguageOverride,
  workspace: Locale,
): Locale {
  return override ?? workspace
}

export type LanguageCommit =
  | {
      readonly status: 'rejected'
      /** The override that is still in D1, and so is still the selection. */
      readonly restore: LanguageOverride
      /** The locale that is still being read, for naming it in its own script. */
      readonly inForce: Locale
    }
  | {
      readonly status: 'switched'
      readonly landed: LanguageOverride
      readonly inForce: Locale
      /** A translator for `inForce`, so the news is delivered in the news. */
      readonly speak: Translate
    }
  | {
      readonly status: 'stale'
      readonly landed: LanguageOverride
      readonly inForce: Locale
    }

export interface LanguageCommitDeps {
  /**
   * The write. `''` is the wire's clear-the-override sentinel, which the server
   * turns into a SQL `NULL`; the answer is what D1 now holds, which is not
   * always what was asked for — a legacy `en-GB` row is stored, and answered,
   * as `en`.
   */
  readonly save: (
    locale: Locale | '',
  ) => Promise<{ readonly locale: Locale | null }>
  /** Re-runs the loaders, so the document re-negotiates from the new row. */
  readonly refresh: () => Promise<void>
  /** `false` once any match is showing its error boundary instead of its data. */
  readonly refreshed: () => boolean
  /** The incoming locale's catalogue, wrapped as a translator. */
  readonly translatorFor: (locale: Locale) => Promise<Translate>
}

export interface LanguageCommitRequest {
  readonly next: LanguageOverride
  /** What was selected before the click, and what a rejection restores. */
  readonly previous: LanguageOverride
  /** The tag the workspace supplies to anyone without an override. */
  readonly workspace: Locale
}

export async function commitLanguage(
  request: LanguageCommitRequest,
  deps: LanguageCommitDeps,
): Promise<LanguageCommit> {
  let landed: LanguageOverride
  try {
    const saved = await deps.save(request.next ?? '')
    landed = saved.locale
  } catch {
    return {
      status: 'rejected',
      restore: request.previous,
      inForce: localeInForce(request.previous, request.workspace),
    }
  }

  const inForce = localeInForce(landed, request.workspace)
  try {
    await deps.refresh()
    if (!deps.refreshed()) return { status: 'stale', landed, inForce }
    return {
      status: 'switched',
      landed,
      inForce,
      speak: await deps.translatorFor(inForce),
    }
  } catch {
    return { status: 'stale', landed, inForce }
  }
}
