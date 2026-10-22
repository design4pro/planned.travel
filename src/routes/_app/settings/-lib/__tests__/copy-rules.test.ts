import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import settings from '#/lib/i18n/messages/en/settings'
import { LOCALE_TAGS } from '#/lib/i18n/locales'

/**
 * Rules about the settings module's source that no type can express, so they are
 * read off the shipped files instead.
 *
 * Three of `docs/SPEC.md` §8's requirements are properties of the *source* rather
 * than of any value a test can call:
 *
 * - §8.6, no untranslated string reaches a screen. Every visible word in this
 *   module has to come out of the catalogue through `t()`, so a copy-bearing
 *   prop written as a string literal and an English sentence sitting in a JSX
 *   text node are both defects — and both are invisible to `tsc`.
 * - §8, a locale is named in its own language and its own script. This module
 *   shipped two contradictory `LOCALES` lists, eight region-tagged values against
 *   five, every label an English exonym, both writing the same column. The tags
 *   are what give that away: `en-GB` and `pl-PL` are not tags the product ships.
 * - §8.4, layout uses logical properties. A `text-left` reads correctly until the
 *   document turns Arabic, at which point it is a silent defect rather than an
 *   error.
 *
 * The fourth check is about the catalogue rather than the screens: a key read
 * through a variable — the nav index, the theme cards, the nine notification
 * events — is checked against `MessageKey` at compile time, but a key that
 * exists and is never used is dead copy a translator will still be asked to
 * translate.
 */

const SETTINGS_DIR = join(process.cwd(), 'src', 'routes', '_app', 'settings')
const NAV_FILE = join(
  process.cwd(),
  'src',
  'routes',
  '_app',
  '-ui',
  'settings-nav.tsx',
)
/**
 * The plan copy table, which lives in `src/lib/` rather than in `-lib/`.
 *
 * It moved there when the pricing page started reading it: a component importing
 * from a route's private `-lib/` inverts the dependency, and plan copy now has
 * two consumers rather than one. The orphan check below is what noticed — with
 * the table outside the walk, twenty-one `settings.billing.*` keys read only by
 * it looked like dead copy. It is still this module's copy, so the gate follows
 * it, the same way it reaches out for the nav.
 */
const PLAN_COPY_FILE = join(process.cwd(), 'src', 'lib', 'plan-copy.ts')
/** Workspace invitation copy is also consumed by the shared console panel. */
const WORKSPACE_INVITATIONS_FILE = join(
  process.cwd(),
  'src',
  'components',
  'layout',
  'workspace-invitations.tsx',
)
/**
 * The basemap picker, which sits beside the nav in `_app/-ui/` for the same
 * reason the nav does: it is mounted by a settings screen but is not a route.
 *
 * The gate follows it exactly as it follows the nav and the plan copy table.
 * Without it the ten `settings.appearance.map.*` keys the picker reads look like
 * dead copy to the orphan check below — which is how this entry got written, on
 * the commit that moved the Map style row out of `appearance.tsx`.
 */
const BASEMAP_PICKER_FILE = join(
  process.cwd(),
  'src',
  'routes',
  '_app',
  '-ui',
  'basemap-picker.tsx',
)

/**
 * The currency names, which left `regional.ts` for `_app/-lib/` when the costs dialogs started
 * reading them. They are still this module's copy (`settings.regional.currency.*`), so the gate
 * follows them, or the nine keys look like dead copy to the orphan check below.
 */
const CURRENCY_NAMES_FILE = join(
  process.cwd(),
  'src',
  'routes',
  '_app',
  '-lib',
  'currency-names.ts',
)

/**
 * The passkeys screen (09-S1a) lives in `_app/` rather than under settings, and so do the
 * modules that hold its copy; 09-S1b adds the rename field and 09-S1c the delete dialog and the
 * Sign in again action it shares with the manager. `passkey-errors.ts` is the one that
 * matters most: it is the only reader of `add.exists`, `error.rateLimited`, `error.generic` and the
 * stale keys, so without it they look like dead copy to the orphan check below.
 */
const PASSKEY_FILES = [
  ['passkeys.tsx'],
  ['-ui', 'passkey-manager.tsx'],
  ['-ui', 'passkey-rename-field.tsx'],
  ['-ui', 'passkey-delete-dialog.tsx'],
  ['-ui', 'passkey-sign-in-again.tsx'],
  ['-lib', 'passkey-errors.ts'],
].map((segments) => join(process.cwd(), 'src', 'routes', '_app', ...segments))

interface Source {
  readonly path: string
  readonly text: string
}

/** Every shipped source of the module — the routes, their helpers, and the nav. */
function shippedSources(): ReadonlyArray<Source> {
  const files: Array<Source> = []

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        // `-lib/__tests__` is this file's own home, and its regexes quote the
        // very patterns they ban.
        if (entry.name === '__tests__') continue
        walk(path)
        continue
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
      files.push({ path, text: readFileSync(path, 'utf8') })
    }
  }

  walk(SETTINGS_DIR)
  files.push({
    path: WORKSPACE_INVITATIONS_FILE,
    text: readFileSync(WORKSPACE_INVITATIONS_FILE, 'utf8'),
  })
  files.push({ path: NAV_FILE, text: readFileSync(NAV_FILE, 'utf8') })
  files.push({
    path: BASEMAP_PICKER_FILE,
    text: readFileSync(BASEMAP_PICKER_FILE, 'utf8'),
  })
  files.push({
    path: CURRENCY_NAMES_FILE,
    text: readFileSync(CURRENCY_NAMES_FILE, 'utf8'),
  })
  for (const path of PASSKEY_FILES) {
    files.push({ path, text: readFileSync(path, 'utf8') })
  }
  files.push({
    path: PLAN_COPY_FILE,
    text: readFileSync(PLAN_COPY_FILE, 'utf8'),
  })
  for (const name of [
    'member-departure-control.tsx',
    'use-member-departure.ts',
  ]) {
    const path = join(process.cwd(), 'src/components/layout', name)
    files.push({ path, text: readFileSync(path, 'utf8') })
  }
  return files
}

const SOURCES = shippedSources()

/**
 * Every source in the module is read for English. There is no exemption.
 *
 * `billing.tsx` used to be one. It was localised on `develop` against Stripe's invoice model, phase
 * A replaced that provider with Polar, and the merge had two versions of the screen: the localised
 * one no longer compiled against `InvoiceSummary`, and the one that compiled was English. The
 * English one shipped, and this gate skipped it by name while 101 `billing.*` keys sat translated
 * into twenty-three languages with no screen asking for them.
 *
 * That is done. The screen reads the catalogue, the Polar order states Stripe had no equivalent for
 * — `pending`, `refunded`, `partially_refunded` — are `billing.order.*`, and the trial sentences
 * were rewritten in every language because Stripe's "no card needed until then" is false of a
 * provider that takes the card at checkout.
 */

/** Strips block and line comments, so prose in a doc comment is not copy. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('the settings module ships no English literal', () => {
  it('reads every source file it is meant to', () => {
    const names = SOURCES.map((source) => source.path.split('/').at(-1))
    expect(names).toEqual(
      expect.arrayContaining([
        'regional.ts',
        'route.tsx',
        'index.tsx',
        'language.tsx',
        'appearance.tsx',
        'security.tsx',
        'notifications.tsx',
        'organization.tsx',
        'billing.tsx',
        'settings-nav.tsx',
        'basemap-picker.tsx',
        'passkeys.tsx',
        'passkey-manager.tsx',
        'passkey-rename-field.tsx',
        'passkey-delete-dialog.tsx',
        'passkey-sign-in-again.tsx',
        'passkey-errors.ts',
        'plan-copy.ts',
      ]),
    )
  })

  /**
   * The props a reader sees. `t()` returns a string, so every one of these is
   * `{t('settings.…')}` in a finished file; a quoted value is copy that no
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
  ]

  it.each(SOURCES.map((source) => [source.path.split('/').at(-1), source]))(
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
   * capital and is not a placeholder glyph. Anything the module renders as
   * prose arrives as `{t('…')}` and so is inside braces, which this cannot
   * match.
   */
  const JSX_TEXT = />\s*([A-Z][A-Za-z'’]*(?:[ ,.'’-]+[A-Za-z'’]+)+)\s*</g

  it.each(SOURCES.map((source) => [source.path.split('/').at(-1), source]))(
    '%s renders no English sentence as a JSX text node',
    (_name, source) => {
      const found = [...withoutComments(source.text).matchAll(JSX_TEXT)].map(
        (match) => match[1],
      )
      expect(found).toEqual([])
    },
  )
})

describe('no locale is named in English', () => {
  /**
   * A region-tagged locale literal. `resolveLocaleTag` collapses `en-GB` and
   * `en-US` to `en`, so a control offering them stores a value it cannot name —
   * which is what left the old Language select's trigger blank.
   */
  const REGION_TAGGED = /'[a-z]{2}-[A-Z]{2}'/g

  it.each(SOURCES.map((source) => [source.path.split('/').at(-1), source]))(
    '%s offers no region-tagged locale value',
    (_name, source) => {
      const found = [
        ...withoutComments(source.text).matchAll(REGION_TAGGED),
      ].map((match) => match[0])
      // `pt-BR` is a tag the product ships; nothing else of this shape is.
      expect(found.filter((tag) => tag !== "'pt-BR'")).toEqual([])
    },
  )

  it('carries no language name in the catalogue', () => {
    // The twenty-three names live in the frozen registry, and every screen that
    // shows one reads it from there. A catalogue value that equals a tag would
    // mean a second, unfrozen source of the same fact.
    const values = Object.values(settings).flatMap((message) =>
      typeof message === 'string' ? [message] : Object.values(message),
    )
    for (const tag of LOCALE_TAGS) {
      expect(values).not.toContain(tag)
    }
  })
})

describe('the module reads correctly in Arabic', () => {
  /** Physical direction utilities, each with the logical one that replaces it. */
  const PHYSICAL =
    /\b(?:m[lr]-|p[lr]-|text-(?:left|right)\b|border-[lr]\b|rounded-[lr]-|inset-x-|left-\d|right-\d|float-(?:left|right)|origin-(?:left|right))/g

  it.each(SOURCES.map((source) => [source.path.split('/').at(-1), source]))(
    '%s uses logical direction utilities only',
    (_name, source) => {
      const found = [...withoutComments(source.text).matchAll(PHYSICAL)].map(
        (match) => match[0],
      )
      expect(found).toEqual([])
    },
  )

  /**
   * The glyphs whose meaning is "the direction reading travels".
   *
   * `src/styles/styles.css` declares the mirror once, as
   * `[dir='rtl'] [data-mirror-rtl] { scale: -1 1 }`, and states the contract:
   * the attribute is valueless, it sits on the glyph itself, and it belongs on
   * an icon that points the way a sentence runs — never on one whose direction
   * is physical (a clock, a compass, a play triangle), never on
   * ChevronDown/ChevronUp, which have no handedness, and never on
   * ArrowRightLeft, which would flip into itself.
   *
   * This module carried four of them unmarked — the `ChevronRight` on the
   * profile screen's link to this section, the `ArrowUpRight` on every plan
   * card's call to action, the `ExternalLink` on an invoice, and the `LogOut`
   * on the sign-out button — so each one pointed out of the sentence in Arabic
   * instead of along it. The utility check above cannot see that: an icon is a
   * component, not a class. `lucide-react` names them consistently enough to
   * read off the source, which is the only place this rule is checkable at
   * all — the attribute's absence is silent in every runtime that is not RTL.
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
    'IndentIncrease',
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

  it.each(SOURCES.map((source) => [source.path.split('/').at(-1), source]))(
    '%s mirrors every handed icon it renders',
    (_name, source) => {
      const pattern = new RegExp(
        `<(?:${HANDED_GLYPHS.join('|')})\\b[^>]*>`,
        'g',
      )
      const unmarked = [
        ...withoutComments(source.text).matchAll(pattern),
      ].filter((match) => !match[0].includes('data-mirror-rtl'))
      expect(unmarked.map((match) => match[0])).toEqual([])
    },
  )
})

describe('the catalogue and the screens agree', () => {
  const used = new Set<string>()
  for (const source of SOURCES) {
    for (const match of source.text.matchAll(/'settings\.([\w.]+)'/g)) {
      used.add(match[1])
    }
  }

  it('finds the keys the screens read', () => {
    // A floor rather than an exact count: the assertion below is what matters,
    // and this only proves the scan is looking at real call sites.
    expect(used.size).toBeGreaterThan(100)
  })

  it('has every key a screen reads', () => {
    const missing = [...used].filter((key) => !(key in settings))
    expect(missing).toEqual([])
  })

  it('has no key no screen reads', () => {
    const unused = Object.keys(settings).filter((key) => !used.has(key))
    expect(unused).toEqual([])
  })
})
