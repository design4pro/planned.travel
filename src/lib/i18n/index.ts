/**
 * The in-house message layer — the only definition of the twenty-three locales
 * this product ships (`docs/SPEC.md` §8).
 *
 * Import from here, never from a file inside the directory, so the registry
 * stays a single table and a screen cannot quietly grow a twenty-fourth
 * language or a second opinion about what `pl` is called.
 *
 * The shape of a request:
 *
 * ```ts
 * const locale = negotiate({ user, workspace, acceptLanguage })
 * const messages = await loadCatalogue(locale)
 * // …render inside <I18nProvider locale={locale} messages={messages}>
 * ```
 *
 * Copy lives in `messages/<locale>/<namespace>.ts` across the eleven namespaces
 * §9 fixes — `shell`, `auth`, `trips`, `modules`, `costs`, `atlas`, `journal`,
 * `marketing`, `settings`, `console`, `ui` — and a key is
 * `<namespace>.<key in the file>`,
 * so a screen calls `t('shell.nav.trips')` for the `'nav.trips'` written in
 * `messages/en/shell.ts`. English is the schema: a key that does not exist
 * there is a compile error, never a runtime fallback to English.
 *
 * Two platform APIs are banned in here and a unit test enforces it:
 * `Intl.DisplayNames`, whose language names differ between workerd and WebKit
 * and are not the forms §8 fixed, and `Intl.Locale.prototype.textInfo`, which
 * is `undefined` in every runtime we deploy to. Native names and writing
 * direction come from the frozen table in `./locales`.
 */

export {
  DEFAULT_LOCALE,
  LOCALE_TAGS,
  SUPPORTED_LOCALES,
  directionOf,
  isSupportedLocale,
  localeDescriptor,
  nativeNameOf,
} from './locales'
export type { Direction, Locale, LocaleDescriptor } from './locales'

export { negotiate, parseAcceptLanguage, resolveLocaleTag } from './negotiate'
export type { LocalePreferences } from './negotiate'

export { plural, pluralCategories } from './plural'
export { interpolate, resolveMessage } from './interpolate'

export {
  createCatalogueLoader,
  createStoredTranslator,
  createTranslator,
  loadCatalogue,
  peekCatalogue,
} from './catalogue'
export type {
  CatalogueLoader,
  NamespaceImporter,
  NamespaceModule,
} from './catalogue'

export {
  I18nProvider,
  useDirection,
  useI18n,
  useLocale,
  useStoredTranslate,
  useTranslate,
} from './provider'
export type { I18nContextValue, I18nProviderProps } from './provider'

export { NAMESPACES } from './types'
export type {
  Catalogue,
  Message,
  MessageKey,
  MessageParamValue,
  MessageParams,
  Namespace,
  NamespaceMessages,
  PluralMessage,
  Translate,
  TranslateArgs,
  TranslateStored,
  TranslationOf,
} from './types'

export { RECOVERY_CATALOGUES } from './recovery-catalogues'
