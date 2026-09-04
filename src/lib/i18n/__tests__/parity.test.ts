import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, LOCALE_TAGS, isSupportedLocale } from '../locales'
import { pluralCategories } from '../plural'
import { NAMESPACES } from '../types'

import type { NamespaceModule } from '../catalogue'
import type { Locale } from '../locales'
import type { Catalogue, Message } from '../types'

/**
 * The parity gate `docs/SPEC.md` §8.2 requires.
 *
 * **The glob is the gate.** Round 2 shipped this test globbing
 * `messages/*.ts`, which does not match `messages/de/settings.ts`, so it
 * reported green over a product that rendered English. The pattern below ends
 * in the layout §8 fixed, and the first test proves that it does by running the
 * same tail over fixtures that carry both shapes side by side — the new
 * `de/settings.ts` and the old flat `de.ts`.
 *
 * **What a type cannot see.** Every English namespace file is the schema for
 * its key set, but the twenty-two translations are separate files owned by
 * separate items, and nothing in the type system relates them. This test is
 * that relation: a catalogue file that was never added, a key that exists only
 * in one language, a placeholder renamed in translation, a plural message
 * missing a branch its locale actually needs, and — above all — an English
 * sentence sitting in a non-English catalogue. §8.6 calls that last one
 * untranslated copy on a screen and §7.5 calls it placeholder copy; either way
 * it is not done.
 *
 * **It grows with the catalogue.** The eleven `en` namespace files and
 * the twenty-two translated directories are written by fifteen other items. Until
 * one lands, there is nothing of its to check, and this file must not invent
 * something. What is checked unconditionally is the machinery itself, against
 * fixtures, so the gate is provably live rather than vacuously green.
 */

const modules = import.meta.glob<NamespaceModule>('../messages/*/*.ts', {
  eager: true,
})

const fixtures = import.meta.glob<NamespaceModule>(
  './fixtures/messages/*/*.ts',
  { eager: true },
)

/**
 * Keys whose value is a proper noun, and so is legitimately word-for-word
 * identical in a locale to its English one — a product name, a brand, a
 * currency code. The list is explicit so that adding to it is a visible
 * decision rather than a quiet weakening of the check.
 *
 * A value with no *words* in it needs no entry here: see `isUntranslatable`.
 *
 * Everything below is a placeholder example naming a real company or
 * restaurant, with no translatable word in it — five in the booking dialog, two
 * in the poll dialog. Everything built *around* them still has to be translated:
 * "Dinner at Den" and "Ghibli Museum, 10:00 entry" are not on this list. An
 * entry permits identity, it does not require it — cs names a different Tokyo
 * restaurant, because "Den" happens to be the Czech word for "day".
 */
const PROPER_NOUNS: ReadonlyArray<string> = [
  'modules.book.example.accommodationProvider',
  'modules.book.example.restaurantProvider',
  'modules.book.example.activityProvider',
  'modules.book.example.tourProvider',
  'modules.book.example.transportProvider',
  'modules.collab.poll.example.first',
  'modules.collab.poll.example.second',
  'shell.newTrip.destinationPlaceholder',
]

/**
 * Keys a *particular* locale writes exactly as English writes them, because the
 * word was borrowed unchanged — "Taxi" in German is Taxi, "Metro" in Italian is
 * Metro, "Ferry" in French is Ferry.
 *
 * This is not `PROPER_NOUNS`: these are ordinary common nouns, and the same key
 * is properly translated in most other locales, so an exemption that applied to
 * every language at once would be far too loose. Hence locale by locale, key by
 * key — and, like the list above, an addition here is a visible decision. The
 * alternative was to invent a second word a native speaker would not use, which
 * makes the catalogue worse in order to make the check pass.
 *
 * A shared root counts too, not only a borrowing: French writes "Question" the
 * way English does because both took it from Latin, and there is no second
 * French word for it that a form label could use instead.
 */
const LOANWORDS: Partial<Record<Locale, ReadonlyArray<string>>> = {
  ca: [
    'modules.files.kind.document',
    'modules.transports.mode.metro',
    'modules.transports.mode.taxi',
    'modules.transports.status.idea',
    'settings.billing.orders.document',
  ],
  cs: ['modules.transports.mode.metro', 'modules.transports.mode.taxi'],
  de: [
    'marketing.legal.badge.version',
    'modules.files.kind.ticket',
    'modules.transports.mode.bus',
    'modules.transports.mode.taxi',
  ],
  es: [
    'modules.transports.mode.metro',
    'modules.transports.mode.taxi',
    'modules.transports.status.idea',
  ],
  fr: [
    'costs.field.date',
    'costs.payment.note',
    'costs.split.method.exact',
    'marketing.legal.badge.version',
    'modules.collab.poll.field.question',
    'modules.files.field.description',
    'modules.files.kind.document',
    'modules.files.kind.photo',
    'modules.transports.mode.bus',
    'modules.transports.mode.ferry',
    'modules.transports.mode.taxi',
    'modules.transports.mode.train',
    'settings.billing.orders.document',
    'shell.newTrip.destination',
  ],
  hu: ['modules.transports.mode.taxi'],
  id: ['modules.transports.mode.bus'],
  it: [
    'modules.files.column.file',
    'modules.transports.mode.metro',
    'modules.transports.mode.taxi',
    'modules.transports.mode.tram',
    'modules.transports.status.idea',
  ],
  nl: [
    'costs.split.method.exact',
    'modules.files.kind.document',
    'modules.transports.mode.bus',
    'modules.transports.mode.metro',
    'modules.transports.mode.taxi',
    'modules.transports.mode.tram',
    'settings.billing.orders.document',
  ],
  pl: ['modules.transports.mode.metro'],
  sv: ['marketing.legal.badge.version', 'modules.transports.mode.taxi'],
  tr: ['modules.transports.mode.metro'],
  vi: ['modules.transports.mode.taxi'],
}

const TOKEN = /\{([A-Za-z0-9_]+)\}/g

/** Any letter in any script — Latin, Greek, Cyrillic, Arabic, Han, Hangul. */
const LETTER = /\p{L}/u

/**
 * Whether a message has nothing in it that *can* be translated: every branch,
 * once its `{placeholders}` are removed, is punctuation, digits and spacing
 * with not one letter of any script in it.
 *
 * This exists because the untranslated check below was, for one round, the only
 * rule in the repository that a conscientious translator could not obey.
 * `badge.overflow` is `'{max}+'` and `avatar.more` is `'+{hidden}'`: an affixed
 * sign around a number that arrives already formatted. German, Polish, Greek
 * and ten more locales write those exactly as English does, because a plus sign
 * is a plus sign. With byte-identity treated as laziness, thirteen separate
 * translators independently reached for the only escape available and moved the
 * sign to the other side of the number — shipping `+99` where every product in
 * every one of those languages shows `99+`. Thirteen people making the same
 * wrong move is a defect in the rule, not in the people.
 *
 * So the exemption is structural rather than a list: a value has to earn it by
 * containing no word, which no amount of English prose can fake. A locale that
 * genuinely needs a different mark still writes one — `ja` ships the fullwidth
 * `＋` and `ko` a real Korean phrase, and both pass either way.
 */
function isUntranslatable(message: Message): boolean {
  return !branchesOf(message).some((branch) =>
    LETTER.test(branch.replace(TOKEN, '')),
  )
}

/** `../messages/pl/shell.ts` → `['pl', 'shell']`. */
function splitPath(path: string): readonly [string, string] {
  const segments = path.split('/')
  return [
    segments[segments.length - 2],
    segments[segments.length - 1].replace(/\.ts$/, ''),
  ]
}

function tokensOf(message: Message): ReadonlyArray<string> {
  const tokens = new Set<string>()
  for (const branch of branchesOf(message)) {
    for (const match of branch.matchAll(TOKEN)) {
      tokens.add(match[1])
    }
  }
  return [...tokens].sort()
}

function branchesOf(message: Message): ReadonlyArray<string> {
  if (typeof message === 'string') {
    return [message]
  }
  return Object.values(message).filter(
    (branch): branch is string => branch !== undefined,
  )
}

/** Everything one locale can be wrong about, relative to English. */
interface ParityReport {
  readonly missing: ReadonlyArray<string>
  readonly orphans: ReadonlyArray<string>
  readonly shapeDrift: ReadonlyArray<string>
  readonly tokenDrift: ReadonlyArray<string>
  readonly pluralGaps: ReadonlyArray<string>
  readonly untranslated: ReadonlyArray<string>
  readonly blanks: ReadonlyArray<string>
}

function compare(
  source: Catalogue,
  target: Catalogue,
  locale: Locale,
  properNouns: ReadonlyArray<string> = PROPER_NOUNS,
): ParityReport {
  const sourceKeys = Object.keys(source).sort()
  const shared = sourceKeys.filter((key) => key in target)
  const categories = pluralCategories(locale)

  const pluralGaps: Array<string> = []
  for (const key of shared) {
    const message = target[key]
    if (typeof message === 'string') {
      continue
    }
    for (const category of categories) {
      if (message[category] === undefined) {
        pluralGaps.push(`${key}.${category}`)
      }
    }
  }

  return {
    missing: sourceKeys.filter((key) => !(key in target)),
    orphans: Object.keys(target)
      .sort()
      .filter((key) => !(key in source)),
    shapeDrift: shared.filter(
      (key) => typeof target[key] !== typeof source[key],
    ),
    tokenDrift: shared.filter(
      (key) =>
        tokensOf(source[key]).join(',') !== tokensOf(target[key]).join(','),
    ),
    pluralGaps,
    untranslated:
      locale === DEFAULT_LOCALE
        ? []
        : shared
            .filter((key) => !properNouns.includes(key))
            .filter((key) => !isUntranslatable(source[key]))
            .filter(
              (key) =>
                branchesOf(source[key]).join('\u0000') ===
                branchesOf(target[key]).join('\u0000'),
            ),
    blanks: shared.filter((key) =>
      branchesOf(target[key]).some((branch) => branch.trim().length === 0),
    ),
  }
}

/** Merges one glob result into a catalogue per locale, keys namespace-first. */
function collect(
  found: Readonly<Record<string, NamespaceModule>>,
): ReadonlyMap<string, Catalogue> {
  const byLocale = new Map<string, Record<string, Message>>()
  for (const [path, module] of Object.entries(found)) {
    const [locale, namespace] = splitPath(path)
    const catalogue = byLocale.get(locale) ?? {}
    for (const [key, message] of Object.entries(module.default)) {
      catalogue[`${namespace}.${key}`] = message
    }
    byLocale.set(locale, catalogue)
  }
  return byLocale
}

const catalogues = collect(modules)
const source = catalogues.get(DEFAULT_LOCALE) ?? {}

describe('the glob this gate runs on', () => {
  it('matches a namespace file and not the flat layout round 2 rejected', () => {
    const paths = Object.keys(fixtures).sort()
    expect(paths).toContain('./fixtures/messages/de/settings.ts')
    expect(paths).toContain('./fixtures/messages/de/shell.ts')
    expect(paths).not.toContain('./fixtures/messages/de.ts')
  })

  it('reads a locale and a namespace out of every path it matches', () => {
    expect(splitPath('./fixtures/messages/de/settings.ts')).toEqual([
      'de',
      'settings',
    ])
    expect(collect(fixtures).get('de')).toEqual({
      'settings.language.label': 'Sprache',
      'shell.nav.trips': 'Reisen',
    })
  })
})

/**
 * The comparison is checked against fixtures rather than only against the
 * shipped catalogues, because the shipped catalogues are empty until fifteen
 * other items write them and a gate nobody has seen fail is not a gate.
 */
describe('the comparison this gate makes', () => {
  const english: Catalogue = {
    'shell.nav.trips': 'Trips',
    'shell.greeting': 'Hello {name}',
    'shell.unread': { one: '{count} unread', other: '{count} unread' },
  }

  it('passes a faithful translation', () => {
    expect(
      compare(
        english,
        {
          'shell.nav.trips': 'Wyjazdy',
          'shell.greeting': 'Cześć {name}',
          'shell.unread': {
            one: '{count} nieprzeczytana',
            few: '{count} nieprzeczytane',
            many: '{count} nieprzeczytanych',
            other: '{count} nieprzeczytanych',
          },
        },
        'pl',
      ),
    ).toEqual({
      missing: [],
      orphans: [],
      shapeDrift: [],
      tokenDrift: [],
      pluralGaps: [],
      untranslated: [],
      blanks: [],
    })
  })

  it('reports a key English carries and the translation does not', () => {
    const report = compare(english, { 'shell.nav.trips': 'Reisen' }, 'de')
    expect(report.missing).toEqual(['shell.greeting', 'shell.unread'])
  })

  it('reports a key that exists only outside English', () => {
    const report = compare(
      { 'shell.nav.trips': 'Trips' },
      { 'shell.nav.trips': 'Reisen', 'shell.invented': 'Erfunden' },
      'de',
    )
    expect(report.orphans).toEqual(['shell.invented'])
  })

  it('reports a value left byte-identical to English', () => {
    const report = compare(
      { 'shell.nav.trips': 'Trips' },
      { 'shell.nav.trips': 'Trips' },
      'de',
    )
    expect(report.untranslated).toEqual(['shell.nav.trips'])
  })

  it('does not report English for looking like itself', () => {
    expect(compare(english, english, 'en').untranslated).toEqual([])
  })

  it('does not report a value that has no word in it to translate', () => {
    // `ui.badge.overflow` and `ui.avatar.more`: a sign affixed to a number that
    // arrives already formatted. Thirteen locales write these exactly as
    // English does, and must be able to.
    const signs: Catalogue = {
      'ui.badge.overflow': '{max}+',
      'ui.avatar.more': '+{hidden}',
      'ui.range': '{from} – {to}',
    }
    expect(compare(signs, signs, 'de').untranslated).toEqual([])
  })

  it('still reports a lone English word, however short', () => {
    const report = compare({ 'ui.ok': 'OK' }, { 'ui.ok': 'OK' }, 'de')
    expect(report.untranslated).toEqual(['ui.ok'])
  })

  it('exempts a proper noun only when it is named on the allow-list', () => {
    const brand: Catalogue = { 'shell.brand': 'planned.travel' }
    expect(compare(brand, brand, 'de').untranslated).toEqual(['shell.brand'])
    expect(compare(brand, brand, 'de', ['shell.brand']).untranslated).toEqual(
      [],
    )
  })

  it('reads every branch of a plural before exempting it', () => {
    const report = compare(
      { 'ui.left': { one: '{count}+', other: 'more than {count}' } },
      { 'ui.left': { one: '{count}+', other: 'more than {count}' } },
      'de',
    )
    expect(report.untranslated).toEqual(['ui.left'])
  })

  it('reports a renamed placeholder and a changed message shape', () => {
    const report = compare(
      english,
      {
        'shell.nav.trips': 'Reisen',
        'shell.greeting': 'Hallo {vorname}',
        'shell.unread': '{count} ungelesen',
      },
      'de',
    )
    expect(report.tokenDrift).toEqual(['shell.greeting'])
    expect(report.shapeDrift).toEqual(['shell.unread'])
  })

  it('reports a plural branch the locale actually needs', () => {
    const report = compare(
      english,
      {
        'shell.nav.trips': 'Wyjazdy',
        'shell.greeting': 'Cześć {name}',
        'shell.unread': { one: '{count} nieprzeczytana', other: '{count} nie' },
      },
      'pl',
    )
    expect(report.pluralGaps).toEqual(['shell.unread.few', 'shell.unread.many'])
  })

  it('reports an empty message', () => {
    const report = compare(
      { 'shell.nav.trips': 'Trips' },
      { 'shell.nav.trips': '   ' },
      'de',
    )
    expect(report.blanks).toEqual(['shell.nav.trips'])
  })
})

describe('the shipped catalogues', () => {
  it('live under a shipped locale tag and one of the eleven namespaces', () => {
    const strayLocales = new Set<string>()
    const strayNamespaces = new Set<string>()
    for (const path of Object.keys(modules)) {
      const [locale, namespace] = splitPath(path)
      if (!isSupportedLocale(locale)) {
        strayLocales.add(locale)
      }
      if (!NAMESPACES.some((known) => known === namespace)) {
        strayNamespaces.add(namespace)
      }
    }
    expect(
      [...strayLocales],
      'a directory under messages/ that is not one of the twenty-three tags in docs/SPEC.md §9',
    ).toEqual([])
    expect(
      [...strayNamespaces],
      'a namespace outside the eleven docs/SPEC.md §9 fixes — adding one is a contract change',
    ).toEqual([])
  })

  it('carries a file for every locale, once English carries any key', () => {
    if (Object.keys(source).length === 0) {
      // Nothing authored yet: the nine content items own `messages/en/*`, and
      // a translation of copy that does not exist would be copy nobody wrote
      // an English source for.
      expect(
        [...catalogues.keys()].sort(),
        'a translated catalogue exists for a locale while English has no keys at all',
      ).toEqual([])
      return
    }
    expect([...catalogues.keys()].sort()).toEqual([...LOCALE_TAGS].sort())
  })

  for (const tag of LOCALE_TAGS) {
    describe(tag, () => {
      const catalogue = catalogues.get(tag) ?? {}
      const report = compare(source, catalogue, tag, [
        ...PROPER_NOUNS,
        ...(LOANWORDS[tag] ?? []),
      ])

      it('carries every key English carries', () => {
        expect(report.missing).toEqual([])
      })

      it('carries no key English does not', () => {
        expect(report.orphans).toEqual([])
      })

      it('agrees with English on which keys are plural', () => {
        expect(report.shapeDrift).toEqual([])
      })

      it('agrees with English on every placeholder', () => {
        expect(report.tokenDrift).toEqual([])
      })

      it('covers every plural category this locale needs', () => {
        expect(report.pluralGaps).toEqual([])
      })

      it('leaves no untranslated English on a screen', () => {
        expect(report.untranslated).toEqual([])
      })

      it('leaves no message empty', () => {
        expect(report.blanks).toEqual([])
      })
    })
  }
})
