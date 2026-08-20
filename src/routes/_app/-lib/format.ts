/**
 * The app shell's formatter surface.
 *
 * Every formatter in the product now lives in `#/lib/format`, which is where
 * `docs/SPEC.md` §6 puts isomorphic helpers - `src/routes` is file-based routes
 * only. This module stays because thirty route modules already import from it,
 * and because it owns the one formatter that cannot move: `countryName`.
 *
 * Nothing is re-implemented here. In particular the frozen CLDR en-GB month and
 * weekday tables - the fix for workerd rendering `6 Sept 2024` where WebKit
 * rendered `6 Sep 2024`, which threw a React hydration error on every September
 * date - live in `#/lib/format` and are the product's only date formatter. Do
 * not add a second one anywhere, and do not "correct" `Sept`.
 *
 * `countryName` is kept out of `#/lib/format` on purpose. `Intl.DisplayNames`
 * resolves region names out of the runtime's own ICU, and workerd and WebKit
 * disagree on several of them (FK, PS, CD, MM, HK, MO) - the same class of bug
 * as the month abbreviation. `#/lib/atlas/country-names` is the frozen table that
 * answers it, and the atlas uses that. Leaving the `Intl` version in this module
 * rather than the shared one keeps `new Intl.DisplayNames` out of every component
 * chunk that only wanted to format a date.
 */

export * from '#/lib/format'

const LOCALE = 'en-GB'

const regionNames = new Intl.DisplayNames([LOCALE], { type: 'region' })

/**
 * `JP` → `Japan`. Falls back to the code itself for anything unrecognised.
 *
 * Runtime-ICU dependent, and therefore unfit for anything server-rendered whose
 * hydration pass has to match character for character. Screens that print a
 * country name next to data - the atlas and its components - use
 * `countryName` from `#/lib/atlas/country-names` instead.
 */
export function countryName(code: string): string {
  const upper = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) {
    return code
  }
  return regionNames.of(upper) ?? upper
}
