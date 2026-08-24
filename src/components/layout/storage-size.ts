/**
 * A byte count, in the reader's own punctuation.
 *
 * The dashboard's storage meter and the admin console's quota bars both print a
 * size, and both used to print it through `formatStorage` in `src/lib/plans.ts`
 * — which builds its string with a template literal, so `5.2 GB` stayed `5.2 GB`
 * in the twelve locales that write the decimal as a comma and `2560 TB` stayed
 * ungrouped in all twenty-three. §8's rule on numbers is that any figure a reader
 * *sees* goes through the locale-aware formatter and arrives already grouped; a
 * size is a figure like any other.
 *
 * **Why the unit is not a catalogue key.** `MB` and `GB` are IEC symbols rather
 * than English words, and this is exactly how `formatDistance` and `formatWeight`
 * in `src/lib/format.ts` already compose `km`, `mi`, `g` and `kg`: the number is
 * localised, the symbol is data. A `'{size} MB'` message would also be
 * byte-identical in twenty-two catalogues, which the parity test in
 * `src/lib/i18n/__tests__` reads as untranslated copy and fails on. Cyrillic
 * locales do write `МБ`, so a per-locale symbol table belongs beside the
 * `km`/`mi` one it would join — in `src/lib/format.ts`, which this item does not
 * own.
 *
 * **Why it lives here.** `src/lib/format.ts` is where `docs/SPEC.md` §6 puts a
 * formatter and where this function should end up, next to `formatDistance`, as
 * the single storage formatter for the whole product. That file belongs to
 * another item, so this is a module beside the chrome that renders it — the same
 * reasoning `notification-copy.ts` records for sitting here: pure, no fetching,
 * no `src/server` import, testable without a request.
 */

import { formatNumber } from '#/lib/format'

import type { Locale } from '#/lib/i18n'

/**
 * Binary steps, because R2 bills in them and because a 1 GB plan allowance is a
 * gibibyte on every screen that spends it.
 */
const STEP = 1024

/** IEC symbols, smallest first. The last one is also the ceiling. */
const SYMBOLS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * An ordinary space between figure and symbol, and it is load-bearing.
 *
 * `formatDistance` writes `12 km` the same way, and `StatCard` in
 * `src/components/ui` peels a short trailing abbreviation off a value with
 * `/^(.*?[\d\u2013\u2014\-.,]) ?([A-Za-z]{1,3})$/` so it can set `MB` in the UI face
 * instead of leaving it as ornament at 40px in the display face. That pattern
 * matches U+0020 and not U+00A0, so a no-break space here would silently cost
 * the admin console's storage tile its typographic split.
 */
const GAP = ' '

/**
 * One decimal below a hundred, none at or above it, and none at all for bytes.
 *
 * `842 MB` and `5.2 GB` are both four glyphs of number; `5.24 GB` and `842.3 MB`
 * are noise in a 36px display numeral, and a fractional byte does not exist.
 */
function roundedFor(value: number, step: number): number {
  if (step === 0 || value >= 100) {
    return Math.round(value)
  }
  return Math.round(value * 10) / 10
}

/** `104857600` → `100 MB`, `5583457484` → `5,2 GB` in `de`. */
export function formatStorageSize(bytes: number, locale: Locale): string {
  let value = Math.max(bytes, 0)
  let step = 0
  while (value >= STEP && step < SYMBOLS.length - 1) {
    value /= STEP
    step += 1
  }
  return `${formatNumber(roundedFor(value, step), locale)}${GAP}${SYMBOLS[step]}`
}
