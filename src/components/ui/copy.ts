/**
 * How a primitive asks for its own words.
 *
 * `docs/SPEC.md` §8 gives the design system a namespace of its own — `ui` — and
 * `src/lib/i18n/messages/en/ui.ts` is where every string these components say
 * on their own behalf now lives. This module is the seam between the two, and
 * it exists because a primitive has two obligations a screen does not.
 *
 * **It must speak the reader's language.** `useUiI18n()` reads the locale, the
 * writing direction and the bound translator out of the `I18nProvider` that
 * `src/routes/__root.tsx` mounts above the whole document, so a `Dialog` closes
 * with `Zamknij` on a Polish account without the screen passing anything down.
 * The direction is published alongside, because several primitives here animate
 * along the inline axis — a switch thumb, a segmented tab pill, a progress fill
 * — and a transform cannot be expressed as a logical property.
 *
 * **It must still render with no provider above it.** Nineteen test files in
 * `__tests__/` render these components bare, and so do the module test suites in
 * `src/components/atlas` and `src/components/map`, which are owned by other
 * items and must keep passing. A primitive that threw without a provider would
 * make the design system untestable in isolation and would put an
 * `I18nProvider` in the way of every future harness.
 *
 * So the read is optional. `useI18n()` throws outside a provider rather than
 * degrading — deliberately, so a *screen* cannot quietly render English — and
 * the call below is wrapped to turn that throw into the absence it is. The
 * `useContext` inside runs on every render either way, before anything can
 * throw, so the hook order is identical in both branches; catching the result is
 * not catching a hook.
 *
 * The no-provider branch renders the **source** catalogue: literally the same
 * `messages/en/ui.ts` object the `en` locale loads, imported once, never a
 * second copy of the English words. That is not the runtime fallback §8.2 bans.
 * That rule is about a *locale* silently falling back — a Polish page rendering
 * an English sentence — and it still holds here: when a provider exists, its
 * catalogue is the only thing consulted, and a key it lacks renders as the key,
 * exactly as `createTranslator` promises. The source branch is reachable only
 * where there is no locale to be wrong about.
 */

import {
  DEFAULT_LOCALE,
  createTranslator,
  directionOf,
  useI18n,
} from '#/lib/i18n'
import source from '#/lib/i18n/messages/en/ui'

import type { Catalogue, Direction, Locale, Translate } from '#/lib/i18n'

/** The `ui` namespace as `t()` addresses it: `close` → `ui.close`. */
const sourceCatalogue: Catalogue = Object.freeze(
  Object.fromEntries(
    Object.entries(source).map(([key, message]) => [`ui.${key}`, message]),
  ),
)

const sourceTranslate = createTranslator(DEFAULT_LOCALE, sourceCatalogue)

/** Everything a primitive may need to know about the reader's language. */
export interface UiI18n {
  /** The negotiated locale — hand it to `src/lib/format.ts`, never to `Intl`. */
  readonly locale: Locale
  /** The writing direction, for the transforms no logical property covers. */
  readonly dir: Direction
  /** The bound translator. Keys in this directory are all `ui.*`. */
  readonly t: Translate
}

const SOURCE: UiI18n = Object.freeze({
  locale: DEFAULT_LOCALE,
  dir: directionOf(DEFAULT_LOCALE),
  t: sourceTranslate,
})

/**
 * The locale, direction and translator for a primitive. Falls back to the
 * source locale only where no provider is mounted at all — see the module note.
 */
export function useUiI18n(): UiI18n {
  try {
    return useI18n()
  } catch {
    return SOURCE
  }
}

/** The translator alone, for the common case of a component that only renders copy. */
export function useUiCopy(): Translate {
  return useUiI18n().t
}
