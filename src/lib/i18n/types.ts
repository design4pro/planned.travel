/**
 * The message format, the eleven namespaces, and the types that make `t()` safe.
 *
 * There is no i18n package here and none is coming (`docs/SPEC.md` §3, §8.1),
 * so the format is deliberately the smallest thing that covers the product:
 *
 * - a message is a string with `{name}` placeholders, or
 * - a plural message: an object keyed by CLDR plural category, whose branch is
 *   chosen by `Intl.PluralRules` from the `count` parameter.
 *
 * **English is the schema.** §8 fixes the catalogue layout as
 * `messages/<locale>/<namespace>.ts` over eleven namespaces, and this module
 * derives the key union from `import type` of the eleven **`en`** files —
 * nothing else decides what a key is. A key that does not exist is a compile error
 * rather than a runtime fallback to English, which §8.2 forbids outright, and
 * the parameter names are read straight out of the English string's literal
 * type, so a message with a `{name}` cannot be rendered without one.
 *
 * **A key is `<namespace>.<key in the file>`.** Eleven namespace files are
 * written by different items in parallel, so two of them will eventually both want
 * `title` or `empty.body`; unprefixed, the second one to merge would silently
 * win and one screen would render another screen's copy. Qualifying the key
 * with its namespace makes that collision impossible by construction rather
 * than detectable by a test, and it tells a reader which file a key lives in.
 * An author writes `'nav.trips'` in `messages/en/shell.ts` and a screen calls
 * `t('shell.nav.trips')`.
 *
 * Authoring an English namespace file:
 *
 * ```ts
 * const messages = {
 *   'nav.trips': 'Trips',
 *   'unread': { one: '{count} unread', other: '{count} unread' },
 * } as const satisfies NamespaceMessages
 * export default messages
 * ```
 *
 * `as const` is load-bearing: it keeps each value a string literal type, and
 * that literal is what the placeholder names are read out of. Translating one:
 *
 * ```ts
 * import type En from '../en/shell'
 * const messages = { 'nav.trips': 'Wyjazdy', … } satisfies TranslationOf<typeof En>
 * export default messages
 * ```
 */

import type Atlas from './messages/en/atlas'
import type Auth from './messages/en/auth'
import type Console from './messages/en/console'
import type Costs from './messages/en/costs'
import type Journal from './messages/en/journal'
import type Marketing from './messages/en/marketing'
import type Modules from './messages/en/modules'
import type Settings from './messages/en/settings'
import type Shell from './messages/en/shell'
import type Trips from './messages/en/trips'
import type Ui from './messages/en/ui'

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

/** What one `messages/<locale>/<namespace>.ts` file default-exports. */
export type NamespaceMessages = Readonly<Record<string, Message>>

/**
 * A translated namespace file, checked against the English one it was made
 * from: same keys, no more and no fewer, each free to say something different.
 */
export type TranslationOf<TSource extends NamespaceMessages> = {
  readonly [K in keyof TSource]: Message
}

/**
 * The eleven `en` namespace files. Adding a twelfth is a change to
 * `docs/SPEC.md` §9, not an edit to this interface.
 */
interface EnNamespaces {
  readonly shell: typeof Shell
  readonly auth: typeof Auth
  readonly trips: typeof Trips
  readonly modules: typeof Modules
  readonly costs: typeof Costs
  readonly atlas: typeof Atlas
  readonly journal: typeof Journal
  readonly marketing: typeof Marketing
  readonly settings: typeof Settings
  readonly console: typeof Console
  readonly ui: typeof Ui
}

/** One of the eleven namespaces §9 fixes. */
export type Namespace = keyof EnNamespaces

/**
 * The same eleven, as data, for the loader and the parity gate. Declared against
 * `Namespace`, so a typo here is a compile error and a namespace that exists
 * only in this list is caught by `__tests__/types.test.ts`.
 */
export const NAMESPACES: ReadonlyArray<Namespace> = Object.freeze([
  'shell',
  'auth',
  'trips',
  'modules',
  'costs',
  'atlas',
  'journal',
  'marketing',
  'settings',
  'console',
  'ui',
])

/**
 * Every key the product can translate: each namespace's own keys, qualified by
 * the namespace they were authored in.
 *
 * A namespace whose English file has not landed yet contributes `never`, so the
 * union grows as the catalogue does and is never wider than what exists.
 */
export type MessageKey = {
  [N in Namespace]: `${N}.${Extract<keyof EnNamespaces[N], string>}`
}[Namespace]

/** The English message a qualified key points at, with its literal type intact. */
type MessageAt<TKey extends MessageKey> = {
  [N in Namespace]: TKey extends `${N}.${infer Rest}`
    ? Rest extends keyof EnNamespaces[N]
      ? EnNamespaces[N][Rest]
      : never
    : never
}[Namespace]

/**
 * One locale's messages, merged across its namespace files and keyed the way
 * `t()` asks for them.
 *
 * Deliberately a string-keyed bag rather than `Record<MessageKey, Message>`:
 * a catalogue is assembled at run time from `import.meta.glob`, never written
 * as a literal, and a record built by a loop is not assignable to a record of
 * required literal keys without a cast. The key guarantee lives where it can be
 * enforced honestly — in `MessageKey` at the `t()` boundary, and in
 * `__tests__/parity.test.ts` for the twenty-two catalogues English cannot type.
 */
export type Catalogue = Readonly<Record<string, Message>>

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
 *
 * The first branch is what makes a mistyped key readable. When the key argument
 * fails the `MessageKey` constraint, TypeScript keeps going with the constraint
 * itself in place of the inferred literal — and the whole union needs
 * parameters, so the call was reported as `Expected 2 arguments, but got 1`,
 * which says nothing about the key that was actually wrong. Measured against
 * the pinned compiler: making that case take an optional, loosely-typed bag
 * lets the arity agree at nought parameters and at one, so the error that
 * survives is the one on the argument that is actually wrong — `Argument of
 * type '"shell.nope"' is not assignable to parameter of type 'MessageKey'`.
 * Fifteen items are about to write these calls; they get to read the key they
 * typed.
 *
 * That branch is also reached honestly, by a caller holding a value typed as
 * the whole `MessageKey` union rather than as one literal. No signature can
 * check the parameters of a key that is not known yet, so it takes the bag.
 */
export type TranslateArgs<TKey extends MessageKey> = MessageKey extends TKey
  ? [params?: MessageParams]
  : [ParamNamesOf<MessageAt<TKey>>] extends [never]
    ? []
    : [params: ParamsObject<ParamNamesOf<MessageAt<TKey>>>]

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

/**
 * Renders a key that is only known at run time, with a parameter bag no
 * signature can check — a stored notification row, whose `titleKey`, `bodyKey`
 * and `params` are columns in D1 (`src/server/repos/notifications.ts`).
 *
 * `null` for a key this catalogue does not carry, so the caller decides what to
 * show. It must not be English: §8.2 bans the silent fallback, and a row
 * written against a key that has since been deleted is a data problem, not a
 * reason to switch language mid-page.
 */
export type TranslateStored = (
  key: string,
  params?: MessageParams,
) => string | null
