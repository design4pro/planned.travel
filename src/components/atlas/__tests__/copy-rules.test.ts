import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import atlas from '#/lib/i18n/messages/en/atlas'

/**
 * Rules about the atlas's source that no type can express, so they are read off
 * the shipped files instead.
 *
 * Three of `docs/SPEC.md` §8's requirements are properties of the *source*
 * rather than of any value a test can call:
 *
 * - §8.6, no untranslated string reaches a screen. Every visible word on this
 *   screen has to come out of the catalogue through `t()`, so a copy-bearing
 *   prop written as a string literal and an English sentence sitting in a JSX
 *   text node are both defects — and both are invisible to `tsc`.
 * - §8.4, layout uses logical properties and directional icons mirror. A
 *   `text-left` reads correctly until the document turns Arabic, at which point
 *   it is a silent defect rather than an error, and an unmarked `ArrowLeft`
 *   points out of the sentence instead of along it.
 * - §8.5, no locale-dependent name is taken from the platform.
 *   `Intl.DisplayNames` gives one spelling in workerd and another in WebKit, and
 *   the atlas is where that divergence was first caught: country names come
 *   from the frozen table in `#/lib/atlas/country-names` and nowhere else.
 *
 * The last group is about the catalogue rather than the screens: a key read
 * through a variable — the four sort orders, the six continents, the two engine
 * failures — is checked against `MessageKey` at compile time, but a key that
 * exists and is never used is dead copy a translator will still be asked to
 * translate.
 */

const ROOT = process.cwd()

interface Source {
  readonly name: string
  readonly path: string
  readonly text: string
}

/**
 * Everything this item owns and ships: both component modules, the route and
 * the two screen files it renders.
 */
function shippedSources(): ReadonlyArray<Source> {
  const files: Array<Source> = []

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        // `__tests__` is this file's own home, and its patterns quote the very
        // strings they ban.
        if (entry.name === '__tests__') continue
        walk(path)
        continue
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
      files.push({
        name: entry.name,
        path,
        text: readFileSync(path, 'utf8'),
      })
    }
  }

  walk(join(ROOT, 'src', 'components', 'atlas'))
  walk(join(ROOT, 'src', 'components', 'map'))
  for (const path of [
    join(ROOT, 'src', 'routes', '_app', 'atlas.tsx'),
    join(ROOT, 'src', 'routes', '_app', '-ui', 'atlas-screen.tsx'),
  ]) {
    files.push({
      name: path.split('/').at(-1) ?? path,
      path,
      text: readFileSync(path, 'utf8'),
    })
  }
  return files
}

const SOURCES = shippedSources()
const CASES = SOURCES.map((source) => [source.name, source] as const)

/** Strips block and line comments, so prose in a doc comment is not copy. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('the atlas ships no English literal', () => {
  it('reads every source file it is meant to', () => {
    expect(SOURCES.map((source) => source.name)).toEqual(
      expect.arrayContaining([
        'atlas-legend.tsx',
        'atlas-panel.tsx',
        'countries-list.tsx',
        'country-actions.tsx',
        'country-card.tsx',
        'country-overlay.tsx',
        'country-record.tsx',
        'country-search.tsx',
        'basemap-notice.tsx',
        'category-filter-bar.tsx',
        'coverage-notice.tsx',
        'map-attribution.tsx',
        'map-canvas.tsx',
        'map-controls.tsx',
        'map-legend.tsx',
        'marker-popover.tsx',
        'pins.tsx',
        'atlas.tsx',
        'atlas-screen.tsx',
        'world-map.tsx',
      ]),
    )
  })

  /**
   * The props a reader sees or hears. `t()` returns a string, so every one of
   * these is `{t('atlas.…')}` in a finished file; a quoted value is copy that
   * no catalogue carries.
   */
  const COPY_PROPS = [
    'title',
    'label',
    'ariaLabel',
    'aria-label',
    'description',
    'hint',
    'placeholder',
    'searchPlaceholder',
    'loadingLabel',
    'confirmLabel',
    'caption',
    'valueText',
    'eyebrow',
  ]

  it.each(CASES)(
    '%s writes no copy-bearing prop as a string literal',
    (_name, source) => {
      // `="` followed by a character: an explicitly empty `label=""` is a
      // drawing declaring itself decoration, not a sentence nobody translated.
      const pattern = new RegExp(`\\s(?:${COPY_PROPS.join('|')})="[^"]`, 'g')
      const found = [...withoutComments(source.text).matchAll(pattern)].map(
        (match) => match[0].trim(),
      )
      expect(found).toEqual([])
    },
  )

  /**
   * A JSX text node: a run of words between `>` and `<` that starts with a
   * capital. Anything the screen renders as prose arrives as `{t('…')}` and so
   * is inside braces, which this cannot match.
   */
  const JSX_TEXT = />\s*([A-Z][A-Za-z'’]*(?:[ ,.'’-]+[A-Za-z'’]+)+)\s*</g

  it.each(CASES)(
    '%s renders no English sentence as a JSX text node',
    (_name, source) => {
      const found = [...withoutComments(source.text).matchAll(JSX_TEXT)].map(
        (match) => match[1],
      )
      expect(found).toEqual([])
    },
  )
})

describe('no name is taken from the platform', () => {
  /**
   * The two APIs `docs/SPEC.md` §8.5 forbids outright, plus the constructor
   * that would name a month or a weekday. `src/lib/format.ts` is the single
   * formatter and it is frozen; a second one here is the September hydration
   * error this screen already shipped once.
   */
  const PLATFORM = /Intl\.(?:DisplayNames|DateTimeFormat|RelativeTimeFormat)/g

  it.each(CASES)('%s asks the platform to name nothing', (_name, source) => {
    const found = [...withoutComments(source.text).matchAll(PLATFORM)].map(
      (match) => match[0],
    )
    expect(found).toEqual([])
  })

  it('leaves country names in the frozen table', () => {
    // Two hundred and forty-nine names, deliberately not translated: §8 asks
    // for twenty-three locales of *our* copy, and a country name resolved from
    // the platform disagrees with itself between workerd and WebKit.
    const values = Object.values(atlas).flatMap((message) =>
      typeof message === 'string' ? [message] : Object.values(message),
    )
    for (const name of ['France', 'Japan', 'Portugal', 'United Kingdom']) {
      expect(values).not.toContain(name)
    }
  })
})

describe('the atlas reads correctly in Arabic', () => {
  /**
   * The five files that draw in *map* space rather than in reading order.
   *
   * A pin's day badge, a hover card's pointer and the anchor a country panel is
   * translated to are positioned against a projected coordinate, not against a
   * sentence: mirroring them would put the pointer on the wrong side of the
   * shape it points at. The MapLibre canvas itself is never mirrored either —
   * §8.4 asks for a designed RTL layout, and a mirrored world is not one — so
   * every floating element states its own side instead of inheriting a flip.
   * Everything outside this list is page chrome and mirrors.
   */
  const MAP_SPACE = new Set([
    'country-overlay.tsx',
    'country-card.tsx',
    'marker-popover.tsx',
    'place-marker.tsx',
    'pins.tsx',
  ])

  /**
   * A physical inset with a real offset on it. `left-1/2` is excluded by the
   * lookahead because a half is a centring value paired with a translate, and
   * that is direction-neutral.
   */
  const PHYSICAL_INSET =
    /\b-?(?:left|right)-(?:auto|px|full|\[|\(|\d+(?![\d/]))/g

  /**
   * Physical box utilities. Margin, padding and text alignment are properties
   * of a sentence and have a logical form on every element, so these are banned
   * everywhere — a pin's badge still wants `me-`, not `mr-`.
   */
  const PHYSICAL_BOX =
    /\b(?:m[lr]-|p[lr]-|text-(?:left|right)\b|float-(?:left|right)|origin-(?:left|right))/g

  /**
   * A physical edge. Banned in page chrome and allowed in map space, where two
   * of a rotated square's four borders draw a pointer at a projected
   * coordinate: mirroring those would put the tip on the wrong side.
   */
  const PHYSICAL_EDGE = /\b(?:border-[lr]\b|border-[lr]-|rounded-[lr]-)/g

  it.each(CASES)('%s uses logical box utilities only', (_name, source) => {
    const found = [...withoutComments(source.text).matchAll(PHYSICAL_BOX)].map(
      (match) => match[0],
    )
    expect(found).toEqual([])
  })

  const CHROME = CASES.filter(([name]) => !MAP_SPACE.has(name))

  it.each(CHROME)(
    '%s places its chrome with logical insets',
    (_name, source) => {
      const found = [
        ...withoutComments(source.text).matchAll(PHYSICAL_INSET),
      ].map((match) => match[0])
      // `left-px`/`right-px` in a matched pair is a symmetric overhang: the
      // drawing hangs a pixel past both clipped edges of the slice.
      expect(
        found.filter((value) => value !== 'left-px' && value !== 'right-px'),
      ).toEqual([])
    },
  )

  it.each(CHROME)('%s draws its edges logically', (_name, source) => {
    const found = [...withoutComments(source.text).matchAll(PHYSICAL_EDGE)].map(
      (match) => match[0],
    )
    expect(found).toEqual([])
  })

  /**
   * The glyphs whose meaning is "the direction reading travels".
   *
   * `src/styles/styles.css` declares the mirror once, as
   * `[dir='rtl'] [data-mirror-rtl] { scale: -1 1 }`, and states the contract:
   * the attribute is valueless and it sits on the glyph itself. It belongs on
   * an icon that points the way a sentence runs, never on one whose direction
   * is physical — a compass rose, a map pin, a chevron that opens a panel.
   */
  const HANDED_GLYPHS = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUpRight',
    'ArrowDownLeft',
    'ChevronLeft',
    'ChevronRight',
    'ChevronsLeft',
    'ChevronsRight',
    'CornerDownLeft',
    'ExternalLink',
    'Forward',
    'LogIn',
    'LogOut',
    'MoveLeft',
    'MoveRight',
    'PanelLeft',
    'PanelRight',
    'Redo2',
    'Reply',
    'Send',
    'SendHorizontal',
    'SkipBack',
    'SkipForward',
    'Undo2',
  ]

  it.each(CASES)('%s mirrors every handed icon it renders', (_name, source) => {
    const pattern = new RegExp(`<(?:${HANDED_GLYPHS.join('|')})\\b[^>]*>`, 'g')
    const unmarked = [...withoutComments(source.text).matchAll(pattern)].filter(
      (match) => !match[0].includes('data-mirror-rtl'),
    )
    expect(unmarked.map((match) => match[0])).toEqual([])
  })
})

describe('the catalogue and the screens agree', () => {
  const used = new Set<string>()
  for (const source of SOURCES) {
    for (const match of source.text.matchAll(/'atlas\.([\w.]+)'/g)) {
      used.add(match[1])
    }
  }

  it('finds the keys the screens read', () => {
    // A floor rather than an exact count: the two assertions below are what
    // matter, and this only proves the scan is looking at real call sites.
    expect(used.size).toBeGreaterThan(100)
  })

  it('has every key a screen reads', () => {
    expect([...used].filter((key) => !(key in atlas))).toEqual([])
  })

  it('has no key no screen reads', () => {
    expect(Object.keys(atlas).filter((key) => !used.has(key))).toEqual([])
  })
})
