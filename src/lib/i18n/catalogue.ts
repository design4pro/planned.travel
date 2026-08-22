import { resolveMessage } from './interpolate'

import type { Locale } from './locales'
import type {
  Catalogue,
  CatalogueModule,
  MessageParams,
  Translate,
  TranslateArgs,
  MessageKey,
} from './types'

/**
 * Loading one locale's messages, and reading keys out of them.
 *
 * **Why an explicit map of literal `import()` specifiers.** A template-literal
 * specifier — `` import(`./messages/${locale}`) `` — reads better and does not
 * survive the build: esbuild cannot see which files it means, so wrangler tries
 * to emit the whole source directory and the bundle fails outright. The map
 * below is twenty-three literal specifiers, which the bundler turns into
 * twenty-three separately loadable chunks, and `Record<Locale, …>` makes
 * forgetting one a compile error.
 *
 * **Why lazy at all.** The SSR bundle necessarily contains every catalogue, but
 * a request needs exactly one. Behind these thunks V8 compiles and evaluates
 * only the locale that was negotiated, which keeps the other twenty-two out of
 * a cold isolate's one-second startup budget (`docs/ARCHITECTURE.md` §2.1).
 */

type CatalogueLoader = () => Promise<CatalogueModule>

/** Twenty-three literal specifiers. Never build one from a variable. */
export const CATALOGUE_LOADERS: Readonly<Record<Locale, CatalogueLoader>> =
  Object.freeze({
    ar: () => import('./messages/ar'),
    ca: () => import('./messages/ca'),
    cs: () => import('./messages/cs'),
    de: () => import('./messages/de'),
    el: () => import('./messages/el'),
    en: () => import('./messages/en'),
    es: () => import('./messages/es'),
    fr: () => import('./messages/fr'),
    hu: () => import('./messages/hu'),
    id: () => import('./messages/id'),
    it: () => import('./messages/it'),
    ja: () => import('./messages/ja'),
    ko: () => import('./messages/ko'),
    nl: () => import('./messages/nl'),
    pl: () => import('./messages/pl'),
    'pt-BR': () => import('./messages/pt-BR'),
    ru: () => import('./messages/ru'),
    sv: () => import('./messages/sv'),
    tr: () => import('./messages/tr'),
    uk: () => import('./messages/uk'),
    vi: () => import('./messages/vi'),
    'zh-Hans': () => import('./messages/zh-Hans'),
    'zh-Hant': () => import('./messages/zh-Hant'),
  })

/**
 * Resolved catalogues, and the promises still in flight.
 *
 * The in-flight map matters on the server: a burst of concurrent requests for
 * the same locale shares one module evaluation instead of racing twenty-three.
 */
const resolved = new Map<Locale, Catalogue>()
const pending = new Map<Locale, Promise<Catalogue>>()

/** The messages for one locale. Evaluates that locale's module and no other. */
export async function loadCatalogue(locale: Locale): Promise<Catalogue> {
  const ready = resolved.get(locale)
  if (ready !== undefined) {
    return ready
  }
  const inFlight = pending.get(locale)
  if (inFlight !== undefined) {
    return inFlight
  }
  const load = CATALOGUE_LOADERS[locale]()
    .then((module) => {
      resolved.set(locale, module.messages)
      return module.messages
    })
    .finally(() => {
      pending.delete(locale)
    })
  pending.set(locale, load)
  return load
}

/** A catalogue already loaded in this isolate, if there is one. */
export function peekCatalogue(locale: Locale): Catalogue | undefined {
  return resolved.get(locale)
}

/**
 * `t()`'s public signature already proved the shape of the params object; this
 * narrows the erased rest-tuple element back to it without a cast.
 */
function isParams(value: unknown): value is MessageParams {
  return typeof value === 'object' && value !== null
}

/**
 * Binds a catalogue and a locale into the `t()` a screen calls.
 *
 * There is no English fallback and no "return the key" branch: `MessageKey` is
 * `keyof` the English catalogue and every catalogue `satisfies Catalogue`, so a
 * key that is missing anywhere is a compile error. §8.2 forbids the runtime
 * fallback precisely because it hides a hole instead of reporting one.
 */
export function createTranslator(
  locale: Locale,
  catalogue: Catalogue,
): Translate {
  return <TKey extends MessageKey>(
    key: TKey,
    ...args: TranslateArgs<TKey>
  ): string => {
    const first: unknown = args[0]
    return resolveMessage(
      catalogue[key],
      locale,
      isParams(first) ? first : undefined,
    )
  }
}
