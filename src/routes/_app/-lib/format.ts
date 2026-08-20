/**
 * The app shell's formatter surface, and nothing but a surface.
 *
 * Every formatter in the product lives in `#/lib/format`, which is where
 * `docs/SPEC.md` §6 puts isomorphic helpers - `src/routes` is file-based routes
 * only. This module stays because thirty route modules already import from it,
 * and it re-exports rather than re-implements: there is no second date formatter
 * here, no second number formatter, and now no second country-name table either.
 *
 * The frozen CLDR en-GB month and weekday tables - the fix for workerd rendering
 * `6 Sept 2024` where WebKit rendered `6 Sep 2024`, which threw a React
 * hydration error on every September date - are in `#/lib/format` and are the
 * product's only date formatter. Do not add another, and do not "correct" `Sept`.
 *
 * `countryName` used to be the one thing this module owned, built on
 * `Intl.DisplayNames`. That is the same class of bug as the month abbreviation:
 * region names come out of whichever ICU the runtime was built against, and
 * workerd and WebKit disagree on several of them - `FK`, `PS`, `CD`, `MM`, `HK`,
 * `MO` - so a server-rendered country name could differ from the one hydration
 * produced. The atlas already answered that with a frozen table covering all 249
 * assigned alpha-2 codes, and having a second, runtime-dependent source of the
 * same strings on the same product was a divergence waiting for a page that
 * printed both. So this re-exports that table's `countryName`: one spelling of
 * every country, everywhere, and `new Intl.DisplayNames` is gone from the bundle
 * along with the module-scope construction that dragged it into every chunk that
 * only wanted to format a date.
 */

export * from '#/lib/format'
export { countryName } from '#/lib/atlas/country-names'
