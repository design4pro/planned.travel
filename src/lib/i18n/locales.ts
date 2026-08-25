/**
 * The locale registry: the one place in the product that knows which languages
 * exist, what each one calls itself, and which way its script runs.
 *
 * **Every native name here is a frozen literal, and that is deliberate.**
 * `Intl.DisplayNames(tag, { type: 'language' })` looks like the obvious source
 * and is the wrong one twice over. First, the runtimes disagree: workerd
 * returns the CLDR lower-case forms (`polski`, `čeština`, `русский`) while the
 * WebKit that Safari ships title-cases eight of the twenty-three, so a chip
 * rendered on the server and hydrated in Safari is a text-node mismatch — the
 * same class of hydration error that put the frozen tables into
 * `src/lib/format.ts` and `src/lib/atlas/country-names.ts`. Second, the CLDR
 * forms are not the forms this product ships: `docs/SPEC.md` §8 fixes `Polski`
 * and `Español`, capitalised, and that table is the contract.
 *
 * `Intl.Locale.prototype.textInfo` is equally unusable: it is `undefined` in
 * workerd, in WebKit and in Chromium, so code that asks it for a direction gets
 * `undefined` and renders Arabic left-to-right. The direction is a column here.
 *
 * Nothing in `src/lib/i18n` may call either API. A unit test greps this
 * directory and fails if one appears.
 */

/** Writing direction of a locale's script, as it goes onto `<html dir>`. */
export type Direction = 'ltr' | 'rtl'

/**
 * The 23 shipped locales, transcribed from `docs/SPEC.md` §8 and ordered by
 * tag. The tags are canonical BCP-47 — `pt-BR` rather than `br`, `el` rather
 * than `gr`, and Chinese split by script rather than by region.
 */
const LOCALE_TABLE = [
  { tag: 'ar', nativeName: 'العربية', dir: 'rtl' },
  { tag: 'ca', nativeName: 'Català', dir: 'ltr' },
  { tag: 'cs', nativeName: 'Čeština', dir: 'ltr' },
  { tag: 'de', nativeName: 'Deutsch', dir: 'ltr' },
  { tag: 'el', nativeName: 'Ελληνικά', dir: 'ltr' },
  { tag: 'en', nativeName: 'English', dir: 'ltr' },
  { tag: 'es', nativeName: 'Español', dir: 'ltr' },
  { tag: 'fr', nativeName: 'Français', dir: 'ltr' },
  { tag: 'hu', nativeName: 'Magyar', dir: 'ltr' },
  { tag: 'id', nativeName: 'Bahasa Indonesia', dir: 'ltr' },
  { tag: 'it', nativeName: 'Italiano', dir: 'ltr' },
  { tag: 'ja', nativeName: '日本語', dir: 'ltr' },
  { tag: 'ko', nativeName: '한국어', dir: 'ltr' },
  { tag: 'nl', nativeName: 'Nederlands', dir: 'ltr' },
  { tag: 'pl', nativeName: 'Polski', dir: 'ltr' },
  { tag: 'pt-BR', nativeName: 'Português (Brasil)', dir: 'ltr' },
  { tag: 'ru', nativeName: 'Русский', dir: 'ltr' },
  { tag: 'sv', nativeName: 'Svenska', dir: 'ltr' },
  { tag: 'tr', nativeName: 'Türkçe', dir: 'ltr' },
  { tag: 'uk', nativeName: 'Українська', dir: 'ltr' },
  { tag: 'vi', nativeName: 'Tiếng Việt', dir: 'ltr' },
  { tag: 'zh-Hans', nativeName: '简体中文', dir: 'ltr' },
  { tag: 'zh-Hant', nativeName: '繁體中文', dir: 'ltr' },
] as const satisfies ReadonlyArray<{
  tag: string
  nativeName: string
  dir: Direction
}>

/** A tag the product actually ships. Anything else is negotiated away. */
export type Locale = (typeof LOCALE_TABLE)[number]['tag']

/** One row of the registry. */
export interface LocaleDescriptor {
  /** Canonical BCP-47 tag, exactly as it is stored and served. */
  readonly tag: Locale
  /** The language's name in its own language and its own script. */
  readonly nativeName: string
  /** Writing direction of that script. */
  readonly dir: Direction
}

/**
 * The registry, frozen at both levels so no caller can teach the product a
 * twenty-fourth language at runtime.
 */
export const SUPPORTED_LOCALES: ReadonlyArray<LocaleDescriptor> = Object.freeze(
  LOCALE_TABLE.map((entry) => Object.freeze({ ...entry })),
)

/** Just the tags, in registry order. */
export const LOCALE_TAGS: ReadonlyArray<Locale> = Object.freeze(
  SUPPORTED_LOCALES.map((entry) => entry.tag),
)

/** The source locale. Every key is authored here first (`docs/SPEC.md` §8.2). */
export const DEFAULT_LOCALE: Locale = 'en'

const BY_TAG = new Map<string, LocaleDescriptor>(
  SUPPORTED_LOCALES.map((entry) => [entry.tag, entry]),
)

/** Narrows an unknown value — a database column, a form field — to a `Locale`. */
export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && BY_TAG.has(value)
}

/** The registry row for a shipped locale. */
export function localeDescriptor(locale: Locale): LocaleDescriptor {
  const descriptor = BY_TAG.get(locale)
  if (descriptor === undefined) {
    // Unreachable while `Locale` is derived from the table above; kept so a
    // future hand-written tag cannot silently return `undefined`.
    throw new Error(`Unknown locale: ${locale}`)
  }
  return descriptor
}

/** The name a language calls itself, for the picker and for `<option>` text. */
export function nativeNameOf(locale: Locale): string {
  return localeDescriptor(locale).nativeName
}

/** The value for `<html dir>` once this locale has been negotiated. */
export function directionOf(locale: Locale): Direction {
  return localeDescriptor(locale).dir
}
