/**
 * How the atlas and the map ask for their own words.
 *
 * `docs/SPEC.md` §8 fixes exactly ten namespaces, and the world tracker and the
 * map chrome share one of them: `atlas`. Both `src/components/atlas/**` and
 * `src/components/map/**` read their copy through this module, and it lives in
 * `map/` rather than in `atlas/` because that is the direction the dependency
 * already runs — the country overlay reaches into the map's context, and
 * nothing in the map module knows the atlas exists.
 *
 * **Why not `useTranslate()` directly.** A screen must throw outside a provider,
 * because a screen that quietly renders English is the failure §8.2 exists to
 * prevent. A *module component* has a second obligation: seventeen suites under
 * `src/components/atlas/__tests__` and `src/components/map/__tests__` render
 * these components bare, and the trip planner mounts half of them too. A
 * primitive that threw with no provider above it would make both untestable in
 * isolation. So the read is optional, exactly as `src/components/ui/copy.ts`
 * does it for the design system, and for the same reason.
 *
 * The no-provider branch renders the **source** catalogue — literally the same
 * `messages/en/atlas.ts` object the `en` locale loads, imported once, never a
 * second copy of the English words. That is not the runtime fallback §8.2 bans:
 * that rule is about a *locale* silently falling back, and it still holds here,
 * because wherever a provider exists its catalogue is the only thing consulted.
 * This branch is reachable only where there is no locale to be wrong about.
 */

import {
  DEFAULT_LOCALE,
  createTranslator,
  directionOf,
  useI18n,
} from '#/lib/i18n'
import source from '#/lib/i18n/messages/en/atlas'

import type { Catalogue, Direction, Locale, Translate } from '#/lib/i18n'

/** The `atlas` namespace as `t()` addresses it: `map.loading` → `atlas.map.loading`. */
const sourceCatalogue: Catalogue = Object.freeze(
  Object.fromEntries(
    Object.entries(source).map(([key, message]) => [`atlas.${key}`, message]),
  ),
)

const sourceTranslate = createTranslator(DEFAULT_LOCALE, sourceCatalogue)

/** Everything an atlas or map component may need to know about the reader. */
export interface AtlasI18n {
  /** The negotiated locale — hand it to `src/lib/format.ts`, never to `Intl`. */
  readonly locale: Locale
  /** The writing direction, for the transforms no logical property covers. */
  readonly dir: Direction
  /** The bound translator. Keys in these two directories are all `atlas.*`. */
  readonly t: Translate
}

const SOURCE: AtlasI18n = Object.freeze({
  locale: DEFAULT_LOCALE,
  dir: directionOf(DEFAULT_LOCALE),
  t: sourceTranslate,
})

/**
 * The locale, direction and translator. Falls back to the source locale only
 * where no provider is mounted at all — see the module note.
 */
export function useAtlasI18n(): AtlasI18n {
  try {
    return useI18n()
  } catch {
    return SOURCE
  }
}

/** The translator alone, for a component that only renders copy. */
export function useAtlasCopy(): Translate {
  return useAtlasI18n().t
}

/**
 * The marker a message carries where a rendered element goes rather than a
 * string — the emphasised count inside the coverage notice's sentence.
 *
 * A control character, so it can never collide with anything a translator
 * writes, and it travels through `interpolate()` as an ordinary parameter. The
 * alternative — two half-sentence keys with the element between them — takes
 * the word order away from the translator, which is the whole point of having
 * one sentence in the first place.
 */
export const COPY_SLOT = '\u0000'

/**
 * Splits a rendered message at its {@link COPY_SLOT} into the text before and
 * the text after, so a caller can put a real element between them.
 *
 * A message with no slot in it yields the whole string and an empty tail, which
 * is a translation that dropped the placeholder rendering as prose rather than
 * as a crash.
 */
export function splitSlot(text: string): readonly [string, string] {
  const at = text.indexOf(COPY_SLOT)
  return at === -1
    ? [text, '']
    : [text.slice(0, at), text.slice(at + COPY_SLOT.length)]
}
