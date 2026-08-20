/**
 * Finding a country by typing at it.
 *
 * The atlas is a map of 250 countries with a dozen of them on the traveller's
 * record, and the map itself is the worst possible way to reach one: a WebGL
 * canvas has no tab stops, small countries are a few pixels wide at world zoom,
 * and 75 of the codes we can list have no outline to click at all. Search is the
 * path that works for everybody, so it has to be a good one.
 *
 * Everything here is pure. The component in `src/components/atlas` renders it and
 * moves the camera; this module only ever answers "which countries did they mean,
 * and in what order", which is the half worth pinning with tests.
 *
 * Five decisions are load-bearing.
 *
 * **Diacritics fold, on both sides.** A reader typing `cote` must reach Côte
 * d'Ivoire, and a reader typing `Côte` must too. Names are folded once when the
 * index is built and the query is folded the same way on every keystroke, so the
 * two are always compared in the same alphabet. The curly apostrophe folds to the
 * straight one for the same reason: nobody types U+2019.
 *
 * **`localeCompare` is never called.** Ordering runs on plain code-unit
 * comparisons of the folded key. The atlas renders on the server first and then
 * hydrates in the reader's browser, and those two runtimes ship different ICU
 * builds: a list ordered by collation can legitimately come back in two
 * different orders, and a text node that differs between the passes is a
 * hydration error. Folding first is also what puts "Côte d'Ivoire" under C
 * instead of after Z.
 *
 * **Relevance outranks the record.** Results are tiered by *why* they matched —
 * an exact code, then a name prefix, then a word prefix, then anything
 * containing the query — and only inside a tier does a visited country outrank
 * an unvisited one. Sorting the other way round is tempting (the reader is
 * usually looking at their own record) and produces nonsense: typing `ni` would
 * put visited Tunisia above unvisited Niger. The record still wins every tie,
 * which is what the reader actually notices.
 *
 * **An exact two-letter code beats everything.** `us` is the United States, not
 * Australia, Austria, Belarus, Cyprus, Mauritius and Russia — all of which
 * contain the letters. A code is an unambiguous request and is answered as one.
 *
 * **A blank query is not a blank answer, and not a truncated one.** With nothing
 * typed the honest answer is the traveller's own record, name-ordered and
 * complete, so opening the field is already useful and the reader can arrow
 * straight into any country they have been to. The ten-row cap belongs to a
 * typed query, where a single letter can match half the planet; applying it to
 * the record instead drops countries the reader has actually visited, which no
 * wording underneath the list makes acceptable.
 *
 * The index covers every ISO 3166-1 alpha-2 code the product names, not only the
 * visited ones: a country you have never been to is still a thing you look up on
 * a world map, and the entry says plainly that it is not on the record yet.
 */

import { COUNTRY_NAMES, countryName } from './country-names'

/** One row of the traveller's record, as the atlas loader returns it. */
export interface CountrySearchVisit {
  /** ISO 3166-1 alpha-2, as stored on the row. */
  readonly countryCode: string
  readonly continent: string | null
  readonly firstVisitedOn: string | null
  readonly lastVisitedOn: string | null
  readonly visitCount: number
}

/**
 * One searchable country.
 *
 * `key` and `words` are the folded forms every comparison runs against, computed
 * once by {@link countrySearchEntries} rather than per keystroke: 250 countries
 * times a Unicode normalisation is not free, and a search box does this work on
 * every character typed.
 */
export interface CountrySearchEntry {
  /** Upper-case ISO 3166-1 alpha-2. */
  readonly code: string
  /** The name as it is printed. */
  readonly name: string
  /** The folded, upper-cased name — what prefix and substring tests read. */
  readonly key: string
  /** The folded name split on everything that is not a letter or a digit. */
  readonly words: ReadonlyArray<string>
  readonly visited: boolean
  /** The record row, or `null` for a country the traveller has not been to. */
  readonly visit: CountrySearchVisit | null
}

/**
 * Why an entry is in the answer, strongest first.
 *
 * - `code` — the query is exactly this country's ISO alpha-2 code.
 * - `name` — the name starts with the query.
 * - `word` — a word inside the name starts with the query (`zealand`, `korea`).
 * - `contains` — the name contains the query somewhere (`ustr` → Australia).
 * - `record` — nothing was typed, and this country is on the traveller's record.
 */
export type CountryMatchKind = 'code' | 'name' | 'word' | 'contains' | 'record'

export interface CountrySearchMatch {
  readonly entry: CountrySearchEntry
  readonly kind: CountryMatchKind
}

export interface CountrySearchOutcome {
  /** The folded query the answer was computed from. `''` when nothing was typed. */
  readonly query: string
  /** The matches, best first, capped at whichever cap applies. */
  readonly matches: ReadonlyArray<CountrySearchMatch>
  /** How many countries matched before the cap — what gets announced. */
  readonly total: number
}

export interface CountrySearchOptions {
  /**
   * Rows to hand back for a *typed* query. Defaults to
   * {@link COUNTRY_SEARCH_LIMIT}.
   */
  readonly limit?: number
  /**
   * Rows to hand back for a *blank* query — the traveller's own record.
   *
   * Uncapped by default, which is the only defensible answer: see
   * {@link COUNTRY_SEARCH_LIMIT}. A caller with a genuinely different surface
   * (a preview strip, say) can name a cap, and {@link CountrySearchOutcome.total}
   * still reports the full record so the shortfall can be stated out loud.
   */
  readonly recordLimit?: number
}

/**
 * How many rows a *typed* query answers with.
 *
 * A one-letter query matches dozens of countries and rendering all of them turns
 * a search into a scrollable atlas index: the reader is typing to *narrow*, and a
 * list they have to page through has failed at that. Ten is deep enough for the
 * answer to a question, and the count that did not fit is stated rather than
 * dropped in silence.
 *
 * A blank query is not the same act and does not share the cap. There the rows
 * *are* the traveller's record — a list they own, already in name order, bounded
 * by the number of countries they have been to — and hiding the eleventh of them
 * makes the field lie about the one thing it is most trusted on. Twelve rows in a
 * scrolling listbox with Home, End and a search box above them is not a paging
 * problem; a country you have visited and cannot find is.
 */
export const COUNTRY_SEARCH_LIMIT = 10

/** ISO alpha-2 is exactly two letters — the length that can be a code at all. */
const CODE_LENGTH = 2

/**
 * The one form of a string this module compares.
 *
 * Decomposes to strip diacritics, straightens the three apostrophes that turn up
 * in country names and on keyboards, upper-cases, and collapses runs of
 * whitespace so `new  zealand` still finds New Zealand.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[‘’ʼ]/gu, "'")
    .toUpperCase()
    .trim()
    .replace(/\s+/gu, ' ')
}

/** Trims and upper-cases a code, so a padded database column still matches. */
function normaliseCode(code: string): string {
  return code.trim().toUpperCase()
}

function splitWords(key: string): ReadonlyArray<string> {
  return key.split(/[^\p{Letter}\p{Number}]+/gu).filter((word) => word !== '')
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * The searchable world, with the traveller's record folded into it.
 *
 * Every code the product names is an entry, plus any code on the record that the
 * name table does not know — a retired or malformed column lists under its own
 * code rather than vanishing from a search that would otherwise be the only way
 * to find it.
 *
 * The first row wins if the record names a country twice: two rows for one
 * country is a repository problem, and quietly summing them here would hide it
 * behind a plausible number.
 */
export function countrySearchEntries(
  visits: ReadonlyArray<CountrySearchVisit>,
): ReadonlyArray<CountrySearchEntry> {
  const record = new Map<string, CountrySearchVisit>()
  for (const visit of visits) {
    const code = normaliseCode(visit.countryCode)
    if (code === '' || record.has(code)) continue
    record.set(code, visit)
  }

  const codes = new Set<string>(Object.keys(COUNTRY_NAMES))
  for (const code of record.keys()) codes.add(code)

  const entries: Array<CountrySearchEntry> = []
  for (const code of codes) {
    const name = countryName(code)
    const key = foldForSearch(name)
    entries.push({
      code,
      name,
      key,
      words: splitWords(key),
      visited: record.has(code),
      visit: record.get(code) ?? null,
    })
  }

  // Sorted by the folded name, so the blank-query answer and every tie inside a
  // tier are already in reading order and no caller has to re-sort.
  entries.sort(
    (left, right) =>
      compareText(left.key, right.key) || compareText(left.code, right.code),
  )
  return entries
}

const KIND_RANK: Readonly<Record<CountryMatchKind, number>> = {
  code: 0,
  name: 1,
  word: 2,
  contains: 3,
  record: 4,
}

/** The strongest reason this entry answers the query, or `null` for no match. */
function matchKind(
  entry: CountrySearchEntry,
  needle: string,
): CountryMatchKind | null {
  if (needle.length === CODE_LENGTH && entry.code === needle) return 'code'
  if (entry.key.startsWith(needle)) return 'name'
  if (entry.words.some((word) => word.startsWith(needle))) return 'word'
  if (entry.key.includes(needle)) return 'contains'
  return null
}

/**
 * The countries that answer `query`, best first.
 *
 * Ties break on the folded name and then the code, so any given index and query
 * have exactly one correct answer — no dependence on input order, and no two
 * renders of the same state that disagree.
 *
 * Two caps, because the two questions are different: a typed query is capped at
 * {@link COUNTRY_SEARCH_LIMIT} and states what did not fit, while a blank one
 * returns the whole record. `total` is the count before either cap, so a caller
 * always has both the number it is showing and the number there are.
 */
export function searchCountries(
  entries: ReadonlyArray<CountrySearchEntry>,
  query: string,
  options: CountrySearchOptions = {},
): CountrySearchOutcome {
  const needle = foldForSearch(query)
  const limit =
    needle === ''
      ? Math.max(0, options.recordLimit ?? Number.POSITIVE_INFINITY)
      : Math.max(0, options.limit ?? COUNTRY_SEARCH_LIMIT)

  const matches: Array<CountrySearchMatch> = []
  if (needle === '') {
    for (const entry of entries) {
      if (entry.visited) matches.push({ entry, kind: 'record' })
    }
  } else {
    for (const entry of entries) {
      const kind = matchKind(entry, needle)
      if (kind !== null) matches.push({ entry, kind })
    }
    matches.sort(
      (left, right) =>
        KIND_RANK[left.kind] - KIND_RANK[right.kind] ||
        Number(right.entry.visited) - Number(left.entry.visited) ||
        compareText(left.entry.key, right.entry.key) ||
        compareText(left.entry.code, right.entry.code),
    )
  }

  return {
    query: needle,
    matches: matches.slice(0, limit),
    total: matches.length,
  }
}
