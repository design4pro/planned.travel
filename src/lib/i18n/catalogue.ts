import { resolveMessage } from './interpolate'

import type { Locale } from './locales'
import type {
  Catalogue,
  Message,
  MessageKey,
  MessageParams,
  NamespaceMessages,
  Translate,
  TranslateArgs,
  TranslateStored,
} from './types'

/**
 * Loading one locale's messages, and reading keys out of them.
 *
 * **Why a glob.** `docs/SPEC.md` §8 fixes the layout as
 * `messages/<locale>/<namespace>.ts` and the aggregation as an
 * `import.meta.glob` over every file matching it, so that fifteen items can
 * each add their own namespace file without editing a shared index they would
 * all collide on. The pattern is a literal, which is the same requirement that
 * bans `` import(`./messages/${locale}`) ``: the bundler has to see which files
 * are meant, and a specifier built from a variable makes wrangler try to emit
 * the whole source tree.
 *
 * **Why it still code-splits.** The glob is lazy, so Vite compiles it to one
 * `() => import(…)` per matched file and emits one chunk per file, inlining
 * none of them into the entry. Measured on a 23 × 10 fixture with the pinned
 * Vite: 230 chunks in `assets/`, zero catalogue keys in the entry — the same
 * property round 1 measured for a hand-written per-locale importer, which is
 * what §8 requires the glob to keep. A request needs exactly one locale, and
 * behind these thunks V8 compiles and evaluates only that one, keeping the
 * other twenty-two out of a cold isolate's one-second startup budget
 * (`docs/ARCHITECTURE.md` §2.1).
 *
 * **Why keys are qualified.** A merged key is `<namespace>.<key in the file>`;
 * see `./types` for why that is the collision-proof shape rather than a
 * convention fifteen authors would have to hold in their heads.
 */

/** A namespace file: one flat object of keys, default-exported (§8). */
export interface NamespaceModule {
  readonly default: NamespaceMessages
}

/** How one namespace file is reached. Lazy, always. */
export type NamespaceImporter = () => Promise<NamespaceModule>

/**
 * Every catalogue file in the product, keyed by its path relative to this
 * module — `./messages/pl/shell.ts`. Files appear here as their items land, so
 * the map is empty until the first namespace file is written and grows without
 * anything else being edited.
 */
const NAMESPACE_MODULES: Readonly<Record<string, NamespaceImporter>> =
  import.meta.glob<NamespaceModule>('./messages/*/*.ts')

/** `./messages/pl/shell.ts` → `['pl', 'shell']`. */
function splitPath(path: string): readonly [locale: string, namespace: string] {
  const segments = path.split('/')
  const namespace = segments[segments.length - 1].replace(/\.ts$/, '')
  return [segments[segments.length - 2], namespace]
}

/**
 * Merges the namespace files of one locale into the flat, qualified-key bag a
 * screen reads.
 *
 * Nothing here demands that all eleven namespaces exist. The catalogue grows
 * monotonically as the content items land theirs, and a hole is the parity
 * gate's business (`__tests__/parity.test.ts`), not a reason to fail a render.
 */
async function mergeLocale(
  modules: Readonly<Record<string, NamespaceImporter>>,
  locale: Locale,
): Promise<Catalogue> {
  const wanted = Object.entries(modules).filter(
    ([path]) => splitPath(path)[0] === locale,
  )
  const loaded = await Promise.all(
    wanted.map(
      async ([path, load]): Promise<readonly [string, NamespaceMessages]> => [
        splitPath(path)[1],
        (await load()).default,
      ],
    ),
  )

  const merged: Record<string, Message> = {}
  for (const [namespace, messages] of loaded) {
    for (const [key, message] of Object.entries(messages)) {
      merged[`${namespace}.${key}`] = message
    }
  }
  return merged
}

/** Everything one catalogue cache offers. */
export interface CatalogueLoader {
  /** The messages for one locale. Evaluates that locale's files and no other. */
  readonly loadCatalogue: (locale: Locale) => Promise<Catalogue>
  /** A catalogue already loaded in this isolate, if there is one. */
  readonly peekCatalogue: (locale: Locale) => Catalogue | undefined
}

/**
 * Builds a loader over a set of namespace importers.
 *
 * The importers are a parameter so the cache and the merge can be exercised
 * against fixtures — including "loading `pl` evaluated `pl` and nothing else",
 * which is the whole point of the thunks and cannot be asserted by reading the
 * shipped catalogue. Production passes the glob.
 */
export function createCatalogueLoader(
  modules: Readonly<Record<string, NamespaceImporter>> = NAMESPACE_MODULES,
): CatalogueLoader {
  /**
   * Resolved catalogues, and the promises still in flight. The in-flight map
   * matters on the server: a burst of concurrent requests for the same locale
   * shares one module evaluation instead of racing.
   */
  const resolved = new Map<Locale, Catalogue>()
  const pending = new Map<Locale, Promise<Catalogue>>()

  return {
    async loadCatalogue(locale) {
      const ready = resolved.get(locale)
      if (ready !== undefined) {
        return ready
      }
      const inFlight = pending.get(locale)
      if (inFlight !== undefined) {
        return inFlight
      }
      const load = mergeLocale(modules, locale)
        .then((catalogue) => {
          resolved.set(locale, catalogue)
          return catalogue
        })
        .finally(() => {
          pending.delete(locale)
        })
      pending.set(locale, load)
      return load
    },
    peekCatalogue(locale) {
      return resolved.get(locale)
    },
  }
}

const shipped = createCatalogueLoader()

/** The messages for one locale. Evaluates that locale's files and no other. */
export const loadCatalogue = shipped.loadCatalogue

/** A catalogue already loaded in this isolate, if there is one. */
export const peekCatalogue = shipped.peekCatalogue

/**
 * `t()`'s public signature already proved the shape of the params object; this
 * narrows the erased rest-tuple element back to it without a cast.
 */
function isParams(value: unknown): value is MessageParams {
  return typeof value === 'object' && value !== null
}

/**
 * Binds a catalogue and a locale into a renderer for keys that only exist at
 * run time — the `titleKey` / `bodyKey` / `params` triple a notification row
 * carries in D1 (`src/server/repos/notifications.ts`). `null` when the
 * catalogue has no such key; see `TranslateStored` in `./types` for why that is
 * not an English fallback.
 *
 * This is also the whole runtime of `createTranslator` below, which is why it
 * is the function the tests drive: `t()` differs from it by its signature and
 * by nothing else.
 */
export function createStoredTranslator(
  locale: Locale,
  catalogue: Catalogue,
): TranslateStored {
  return (key, params) => {
    // Presence is decided by `Object.hasOwn` rather than by indexing: a merged
    // catalogue is a plain object literal, so `catalogue['constructor']`
    // answers with the `Object` constructor and `catalogue['__proto__']` with
    // `Object.prototype`. This function's key comes out of D1, where a
    // notification row's `titleKey` is a text column.
    const message: Message | undefined = Object.hasOwn(catalogue, key)
      ? catalogue[key]
      : undefined
    return message === undefined
      ? null
      : resolveMessage(message, locale, params)
  }
}

/**
 * Binds a catalogue and a locale into the `t()` a screen calls.
 *
 * There is no English fallback and no "return the English string" branch:
 * `MessageKey` is derived from the English namespace files, so a key that does
 * not exist is a compile error. §8.2 forbids the runtime fallback precisely
 * because it hides a hole instead of reporting one.
 *
 * A key that typechecks but is missing from *this* locale's files cannot
 * happen while the parity gate is green. If it ever does, the key itself is
 * rendered — visible damage a reviewer catches, rather than an English sentence
 * that looks finished, and never a thrown error that takes the page down.
 */
export function createTranslator(
  locale: Locale,
  catalogue: Catalogue,
): Translate {
  const render = createStoredTranslator(locale, catalogue)
  return <TKey extends MessageKey>(
    key: TKey,
    ...args: TranslateArgs<TKey>
  ): string => {
    const first: unknown = args[0]
    return render(key, isParams(first) ? first : undefined) ?? key
  }
}
