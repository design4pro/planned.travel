/**
 * The message format, and the types that make `t()` safe.
 *
 * There is no i18n package here and none is coming (`docs/SPEC.md` §3, §8.1),
 * so the format is deliberately the smallest thing that covers the product:
 *
 * - a message is a string with `{name}` placeholders, or
 * - a plural message: an object keyed by CLDR plural category, whose branch is
 *   chosen by `Intl.PluralRules` from the `count` parameter.
 *
 * The English catalogue is the schema. `MessageKey` is `keyof` it, so a key
 * that does not exist is a compile error rather than a runtime fallback to
 * English — §8.2 forbids the silent fallback outright. The parameter names are
 * read straight out of the English string's literal type, so calling
 * `t('language.current')` without a `name` is a compile error too.
 */

import type { EnCatalogue } from './messages/en'

/** What may be substituted into a placeholder. */
export type MessageParamValue = string | number

/**
 * A message with one branch per CLDR plural category. `other` is mandatory
 * because every locale has it; the rest are present only where the locale's
 * rules produce them (`ar` uses all six, `ja` only `other`).
 */
export interface PluralMessage {
  readonly zero?: string
  readonly one?: string
  readonly two?: string
  readonly few?: string
  readonly many?: string
  readonly other: string
}

/** Either shape a catalogue entry may take. */
export type Message = string | PluralMessage

/** Every key the product can translate, taken from the English source. */
export type MessageKey = keyof EnCatalogue & string

/**
 * A catalogue for one locale: the same keys as English, with that locale's
 * strings. `satisfies Catalogue` in a catalogue file turns both a missing key
 * and an orphan key into a TypeScript error.
 */
export type Catalogue = {
  readonly [K in MessageKey]: Message
}

/** The module shape every catalogue file exports. */
export interface CatalogueModule {
  readonly messages: Catalogue
}

/** Pulls `name` out of `'Current language: {name}'`. */
type PlaceholdersIn<TTemplate extends string> =
  TTemplate extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PlaceholdersIn<Rest>
    : never

/**
 * The parameters a message needs: its placeholders, plus `count` whenever the
 * message is plural, since that is what selects the branch.
 */
type ParamNamesOf<TMessage> = TMessage extends string
  ? PlaceholdersIn<TMessage>
  : TMessage extends PluralMessage
    ? 'count' | PlaceholdersIn<Extract<TMessage[keyof TMessage], string>>
    : never

/** `count` is always a number; everything else may be a number or a string. */
type ParamsObject<TNames extends string> = {
  readonly [Name in TNames]: Name extends 'count' ? number : MessageParamValue
}

/**
 * The tail of a `t()` call: empty for a message with no placeholders, a single
 * required params object otherwise.
 */
export type TranslateArgs<TKey extends MessageKey> = [
  ParamNamesOf<EnCatalogue[TKey]>,
] extends [never]
  ? []
  : [params: ParamsObject<ParamNamesOf<EnCatalogue[TKey]>>]

/** The translator handed to components. */
export interface Translate {
  <TKey extends MessageKey>(key: TKey, ...args: TranslateArgs<TKey>): string
}

/**
 * The parameter bag as the runtime sees it, once `t()`'s signature has done the
 * checking. Values are optional because a bag reaching `interpolate` may have
 * been built for a different catalogue's version of the same key.
 */
export type MessageParams = Readonly<
  Record<string, MessageParamValue | undefined>
>
