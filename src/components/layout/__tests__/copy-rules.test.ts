import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import shell from '#/lib/i18n/messages/en/shell'
import ui from '#/lib/i18n/messages/en/ui'

/**
 * Rules about the app shell's source that no type can express, so they are read
 * off the shipped files instead.
 *
 * The shell frames every authenticated screen, which makes it the first place a
 * missed string shows in all twenty-two non-English locales — and three of
 * `docs/SPEC.md` §8's requirements are properties of the *source* rather than of
 * any value a test can call:
 *
 * - §8.6, no untranslated string reaches a screen. A copy-bearing prop written
 *   as a string literal and an English sentence in a JSX text node are both
 *   defects, and both are invisible to `tsc`.
 * - §8.4, layout uses logical properties. A `ml-auto` reads correctly until the
 *   document turns Arabic, at which point the account cluster and the wordmark
 *   land on top of each other — a silent defect rather than an error.
 * - §8.4 again, directional icons mirror. The mirror is an attribute
 *   (`data-mirror-rtl`, contracted in `src/styles/styles.css`), so a back
 *   chevron without it points the wrong way and nothing complains.
 *
 * The last group is about the catalogue rather than the sources: a key read
 * through a variable — the four nav items, the seven trip tabs, the three theme
 * modes, the closed status enumerations — is checked against `MessageKey` at
 * compile time, but a key that exists and is never read is dead copy a
 * translator will still be asked to translate.
 */

const LAYOUT_DIR = join(process.cwd(), 'src', 'components', 'layout')
const APP_DIR = join(process.cwd(), 'src', 'routes', '_app')

/** The shell's own screens and helpers, which live under `src/routes/_app`. */
const APP_FILES = [
  'route.tsx',
  'dashboard.tsx',
  'notifications.tsx',
  'admin.tsx',
  join('-ui', 'scaffold.tsx'),
  join('-server', 'shell.ts'),
  join('-server', 'context.ts'),
  join('-server', 'overview.ts'),
]

interface Source {
  readonly name: string
  readonly text: string
}

function shippedSources(): ReadonlyArray<Source> {
  const files: Array<Source> = []

  for (const entry of readdirSync(LAYOUT_DIR, { withFileTypes: true })) {
    // `__tests__` is this file's own home, and its regexes quote the very
    // patterns they ban.
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
    files.push({
      name: entry.name,
      text: readFileSync(join(LAYOUT_DIR, entry.name), 'utf8'),
    })
  }

  for (const relative of APP_FILES) {
    files.push({
      name: relative,
      text: readFileSync(join(APP_DIR, relative), 'utf8'),
    })
  }

  return files
}

const SOURCES = shippedSources()

/** Strips block and line comments, so prose in a doc comment is not copy. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const CASES = SOURCES.map((source) => [source.name, source] as const)

describe('the app shell ships no English literal', () => {
  it('reads every source it is meant to', () => {
    const names = SOURCES.map((source) => source.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'top-nav.tsx',
        'mobile-nav.tsx',
        'nav-model.ts',
        'pill-nav.tsx',
        'trip-sub-nav.tsx',
        'user-menu.tsx',
        'theme-toggle.tsx',
        'notification-bell.tsx',
        'error-state.tsx',
        'not-found.tsx',
        'route-fallback.tsx',
        'kit.tsx',
        'menu.tsx',
        'dashboard.tsx',
        'notifications.tsx',
        'admin.tsx',
      ]),
    )
  })

  /**
   * The props a reader sees. `t()` returns a string, so every one of these is
   * `{t('shell.…')}` in a finished file; a quoted value is copy that no
   * catalogue carries.
   */
  const COPY_PROPS = [
    'title',
    'label',
    'ariaLabel',
    'aria-label',
    'description',
    'hint',
    'placeholder',
    'loadingLabel',
    'valueText',
    'eyebrow',
    'unit',
    'caption',
  ]

  it.each(CASES)(
    '%s writes no copy-bearing prop as a string literal',
    (_name, source) => {
      const pattern = new RegExp(`\\s(?:${COPY_PROPS.join('|')})="`, 'g')
      const found = [...withoutComments(source.text).matchAll(pattern)].map(
        (match) => match[0].trim(),
      )
      expect(found).toEqual([])
    },
  )

  /**
   * A JSX text node: a run of words between `>` and `<` that starts with a
   * capital. Anything the shell renders as prose arrives as `{t('…')}` and so is
   * inside braces, which this cannot match. The single-word form is checked too,
   * because the chrome's copy is mostly single words — `Trips`, `Admin`, `Share`.
   */
  const JSX_PHRASE = />\s*([A-Z][A-Za-z'’]*(?:[ ,.'’-]+[A-Za-z'’]+)+)\s*</g
  const JSX_WORD = />\s*([A-Z][a-z]{2,})\s*</g

  it.each(CASES)('%s renders no English in a JSX text node', (_name, source) => {
    const text = withoutComments(source.text)
    const found = [
      ...[...text.matchAll(JSX_PHRASE)].map((match) => match[1]),
      ...[...text.matchAll(JSX_WORD)].map((match) => match[1]),
    ]
    expect(found).toEqual([])
  })
})

describe('the shell reads correctly in Arabic', () => {
  /** Physical direction utilities, each with the logical one that replaces it. */
  const PHYSICAL =
    /\b(?:m[lr]-|p[lr]-|text-(?:left|right)\b|border-[lr]\b|rounded-[lr]-|inset-x-|left-\d|right-\d|float-(?:left|right)|origin-(?:left|right))/g

  it.each(CASES)('%s uses logical direction utilities only', (_name, source) => {
    const found = [...withoutComments(source.text).matchAll(PHYSICAL)].map(
      (match) => match[0],
    )
    expect(found).toEqual([])
  })

  /**
   * Every glyph whose meaning is "the direction reading travels" carries the
   * mirror attribute. The list is the subset of `src/styles/styles.css`'s
   * contract that the shell actually renders; a chevron used only to mean
   * "expand" (`ChevronDown`) is deliberately not on it.
   */
  const HANDED = ['ChevronLeft', 'ChevronRight', 'ArrowUpRight', 'LogOut']

  it.each(CASES)('%s mirrors every directional icon', (_name, source) => {
    const text = withoutComments(source.text)
    const unmirrored = HANDED.flatMap((icon) =>
      [...text.matchAll(new RegExp(`<${icon}\\b([^>]*)>`, 'g'))]
        .filter((match) => !match[1].includes('data-mirror-rtl'))
        .map(() => icon),
    )
    expect(unmirrored).toEqual([])
  })
})

/**
 * The composed prefix in `notifications.tsx`. A stored row's key is a text
 * column in D1, so these are the only keys in the namespace that no literal
 * names — the source holds the prefix and appends the column's value.
 */
const STORED_PREFIX = 'notification.'

/**
 * Every event a stored row may carry, spelled out so adding one is a deliberate
 * act rather than a side effect. The set is the vocabulary the inbox has always
 * understood: a template removed from it makes rows already in D1 fall to the
 * fallback line, which is why it is wider than the events today's code emits.
 */
const STORED_EVENTS = [
  'trip.invited',
  'trip.updated',
  'trip.member_added',
  'trip.member_removed',
  'trip.starting_soon',
  'reservation.reminder',
  'reservation.confirmed',
  'expense.added',
  'expense.settled',
  'list.assigned',
  'collab.message',
  'collab.poll',
  'organization.invited',
  'journey.published',
  'billing.plan_changed',
]

describe('the catalogue and the shell agree', () => {
  const used = new Set<string>()
  for (const source of SOURCES) {
    for (const match of source.text.matchAll(/'shell\.([\w.]+)'/g)) {
      used.add(match[1])
    }
  }
  // The prefix is not a key; it is the first half of one.
  const composesStoredKeys = used.delete(STORED_PREFIX)

  it('finds the keys the shell reads', () => {
    // A floor rather than an exact count: the assertions below are what matter,
    // and this only proves the scan is looking at real call sites.
    expect(used.size).toBeGreaterThan(100)
  })

  it('has every key the shell reads', () => {
    const missing = [...used].filter((key) => !(key in shell))
    expect(missing).toEqual([])
  })

  it('has no key the shell never reads', () => {
    const unused = Object.keys(shell).filter(
      (key) => !used.has(key) && !key.startsWith(STORED_PREFIX),
    )
    expect(unused).toEqual([])
  })

  it('resolves a stored key through the catalogue rather than a second table', () => {
    expect(composesStoredKeys).toBe(true)
  })

  it('carries both halves of every stored event, and nothing else', () => {
    const expected = STORED_EVENTS.flatMap((event) => [
      `${STORED_PREFIX}${event}.title`,
      `${STORED_PREFIX}${event}.body`,
    ]).sort()
    const shipped = Object.keys(shell)
      .filter(
        (key) =>
          key.startsWith(STORED_PREFIX) &&
          !key.startsWith(`${STORED_PREFIX}fallback.`),
      )
      .sort()
    expect(shipped).toEqual(expected)
  })

  it('reads the fallback pair directly, so a renamed event still says something', () => {
    expect(used.has(`${STORED_PREFIX}fallback.title`)).toBe(true)
    expect(used.has(`${STORED_PREFIX}fallback.body`)).toBe(true)
  })

  it('reads the primitive catalogue rather than duplicating it', () => {
    // "Loading" belongs to `ui`, and the shell's four skeletons read it from
    // there. A `shell.*` key with the same value would be the second copy of a
    // string twenty-two translators have to keep in step.
    const values = (bag: Record<string, unknown>): ReadonlyArray<string> =>
      Object.values(bag).flatMap((message) =>
        typeof message === 'string'
          ? [message]
          : Object.values(message as Record<string, string>),
      )
    const uiValues = values(ui)
    expect(values(shell).filter((value) => uiValues.includes(value))).toEqual([])
  })
})
