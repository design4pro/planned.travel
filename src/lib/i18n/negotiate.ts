import { DEFAULT_LOCALE, LOCALE_TAGS } from './locales'

import type { Locale } from './locales'

/**
 * Locale negotiation, exactly as `docs/SPEC.md` §8.3 orders it:
 *
 *   user setting → workspace setting → `Accept-Language` → `en`
 *
 * **This module is pure.** It reads no request, no cookie, no `navigator`. The
 * caller passes the three inputs in and gets one tag back, which is what lets
 * the same function run in the Worker before first paint and in a unit test
 * without a fake request. It also sidesteps a trap: `navigator.language` exists
 * in workerd and is hard-coded to `'en'`, so isomorphic code that consults it
 * answers differently on the two sides of the wire and every non-English
 * visitor gets a hydration mismatch on the whole document.
 *
 * **Stored tags are normalised, not trusted.** `organization_settings.locale`
 * defaults to `en-GB`, which is not one of the twenty-three, and a traveller's
 * override was writable as free text before the picker existed. A plain
 * membership test would answer "unsupported" for every workspace created so
 * far and drop them all to `Accept-Language`. So a tag is matched
 * case-insensitively, then through an explicit alias table, then by BCP-47
 * truncation: `en-GB` → `en`, `pl-PL` → `pl`, `zh-Hant-TW` → `zh-Hant`. What
 * truncation cannot reach is unsupported, and unsupported means the next step
 * of the chain — never a guess.
 */

const CANONICAL_BY_LOWER = new Map<string, Locale>(
  LOCALE_TAGS.map((tag) => [tag.toLowerCase(), tag]),
)

/**
 * Tags that resolve to a shipped locale but do not truncate to one.
 *
 * Every entry is a deliberate editorial decision, not a fuzzy match:
 * - `pt` and `pt-PT` map to `pt-BR` because Brazilian Portuguese is the only
 *   Portuguese the product ships, and it reads far better to a Lisbon traveller
 *   than English does.
 * - unscripted and regional Chinese is split the way the writing system is:
 *   the mainland, Singapore and Malaysia read Simplified; Taiwan, Hong Kong and
 *   Macao read Traditional. Bare `zh` follows the larger population.
 * - `in` is the pre-1989 ISO code for Indonesian and is still what some Java
 *   and Android clients send.
 *
 * A tag that is absent here and does not truncate falls through to `en`.
 *
 * Both lookup tables are `Map`s rather than object literals, and that is not a
 * style choice. An object literal inherits `Object.prototype`, so indexing one
 * with `constructor` answers with the `Object` constructor and with `__proto__`
 * answers with `Object.prototype` — neither of which `?? null` reads as a miss.
 * Both names arrive freely in an `Accept-Language` header and both are
 * persistable through the settings columns, so the object form left
 * `negotiate()` handing back a function where every caller had been promised a
 * `Locale`. A `Map` has no inherited entries and no such shape to exploit.
 */
const ALIASES = new Map<string, Locale>([
  ['in', 'id'],
  ['pt', 'pt-BR'],
  ['pt-pt', 'pt-BR'],
  ['zh', 'zh-Hans'],
  ['zh-chs', 'zh-Hans'],
  ['zh-cn', 'zh-Hans'],
  ['zh-my', 'zh-Hans'],
  ['zh-sg', 'zh-Hans'],
  ['zh-cht', 'zh-Hant'],
  ['zh-hk', 'zh-Hant'],
  ['zh-mo', 'zh-Hant'],
  ['zh-tw', 'zh-Hant'],
])

function lookup(candidate: string): Locale | null {
  return CANONICAL_BY_LOWER.get(candidate) ?? ALIASES.get(candidate) ?? null
}

/**
 * Longest input `resolveLocaleTag` will even look at.
 *
 * RFC 5646 caps a registered language tag well below this; the bound is here
 * because truncation walks one subtag at a time and this function runs on the
 * request path for every visitor. Without it a single 16 KB `Accept-Language`
 * entry of nothing but hyphens costs the Worker a measurable slice of its CPU
 * budget for a tag that could never have matched.
 */
const MAX_TAG_LENGTH = 64

/**
 * Canonicalises one tag to a shipped locale, or returns `null` if the product
 * has nothing to offer it.
 */
export function resolveLocaleTag(
  tag: string | null | undefined,
): Locale | null {
  if (typeof tag !== 'string') {
    return null
  }
  const lower = tag.trim().toLowerCase()
  if (lower === '' || lower === '*' || lower.length > MAX_TAG_LENGTH) {
    return null
  }
  // `en-gb` → `en`, `zh-hant-tw` → `zh-hant` → …, dropping one subtag per pass.
  for (let end = lower.length; end > 0; end = lower.lastIndexOf('-', end - 1)) {
    const hit = lookup(lower.slice(0, end))
    if (hit !== null) {
      return hit
    }
  }
  return null
}

const QUALITY = /^\s*q\s*=\s*(\S*)\s*$/i

/**
 * The `q=` weight of one header entry. An absent `q` means 1, as the RFC says;
 * a `q` that is present but not a number means 0, because a client that sent
 * gibberish has told us nothing and should not outrank one that was clear.
 */
function qualityOf(parameters: ReadonlyArray<string>): number {
  for (const parameter of parameters) {
    const match = QUALITY.exec(parameter)
    if (match !== null) {
      const parsed = Number.parseFloat(match[1])
      return Number.isFinite(parsed) ? parsed : 0
    }
  }
  return 1
}

/**
 * The tags in an `Accept-Language` header, best first.
 *
 * Quality values order the list and `q=0` means "explicitly not this", per
 * RFC 9110 §12.4.2. Ties keep the order they were sent in, which is what the
 * header means by listing them.
 */
export function parseAcceptLanguage(
  header: string | null | undefined,
): ReadonlyArray<string> {
  if (typeof header !== 'string' || header.trim() === '') {
    return []
  }
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag, ...parameters] = part.split(';')
      return { tag: tag.trim(), index, weight: qualityOf(parameters) }
    })
    .filter((entry) => entry.tag !== '' && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)

  return ranked.map((entry) => entry.tag)
}

/** The three inputs §8.3 negotiates between, in the order it consults them. */
export interface LocalePreferences {
  /** `user_settings.locale` — the traveller's own override. May be absent. */
  readonly user?: string | null
  /** `organization_settings.locale` — the workspace default. */
  readonly workspace?: string | null
  /** The raw request header. Never a normalised or cached copy of it. */
  readonly acceptLanguage?: string | null
}

/**
 * Resolves the locale for one request. Always returns a shipped tag, so the
 * caller never has to decide what to do with a miss.
 */
export function negotiate(preferences: LocalePreferences): Locale {
  const stored =
    resolveLocaleTag(preferences.user) ??
    resolveLocaleTag(preferences.workspace)
  if (stored !== null) {
    return stored
  }
  for (const tag of parseAcceptLanguage(preferences.acceptLanguage)) {
    const offered = resolveLocaleTag(tag)
    if (offered !== null) {
      return offered
    }
  }
  return DEFAULT_LOCALE
}
