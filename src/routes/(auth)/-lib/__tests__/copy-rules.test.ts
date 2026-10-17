import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import auth from '#/lib/i18n/messages/en/auth'

/**
 * Rules about the authentication screens' source that no type can express, so
 * they are read off the shipped files instead.
 *
 * These seven screens are the ones `docs/SPEC.md` §8.8 names first, and they are
 * the hardest to keep honest: half their copy only appears when something has
 * gone wrong, so an English literal in a validation message or a failure alert
 * can survive every screenshot and every click-through. Three of §8's
 * requirements are properties of the *source* rather than of any value a test
 * can call:
 *
 * - §8.6, no untranslated string reaches a screen. A copy-bearing prop written
 *   as a string literal and an English sentence in a JSX text node are both
 *   defects, and both are invisible to `tsc`.
 * - §8.4, layout uses logical properties. A `pr-11` on a password field puts the
 *   reveal control on the wrong side of an Arabic form, silently.
 * - §7.5, no placeholder copy. A key that exists and is never read is copy a
 *   translator will be asked to translate for nothing, and a key a screen reads
 *   that does not exist renders as the key itself.
 */

const AUTH_DIR = join(process.cwd(), 'src', 'routes', '(auth)')

interface Source {
  readonly path: string
  readonly text: string
}

/** Every shipped source of the seven screens: the routes, their ui and lib. */
function shippedSources(): ReadonlyArray<Source> {
  const files: Array<Source> = []

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        // This file's own home, whose regexes quote the patterns they ban.
        if (entry.name === '__tests__') continue
        walk(path)
        continue
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
      files.push({ path, text: readFileSync(path, 'utf8') })
    }
  }

  walk(AUTH_DIR)
  return files
}

const SOURCES = shippedSources()

const named = (source: Source): string => source.path.split('/').at(-1) ?? ''

/** Strips block and line comments, so prose in a doc comment is not copy. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('the authentication screens ship no English literal', () => {
  it('reads every source file it is meant to', () => {
    expect(SOURCES.map(named)).toEqual(
      expect.arrayContaining([
        'errors.ts',
        'redirect.ts',
        'schemas.ts',
        'config.ts',
        'invitation.ts',
        'auth-shell.tsx',
        'form.tsx',
        'accept-invitation.$invitationId.tsx',
        'forgot-password.tsx',
        'login.tsx',
        'register.tsx',
        'reset-password.tsx',
        'two-factor.tsx',
        'verify-email.tsx',
      ]),
    )
  })

  /**
   * The props a reader sees, or hears. `t()` returns a string, so every one of
   * these is `{t('auth.…')}` in a finished file; a quoted value is copy that no
   * catalogue carries.
   */
  const COPY_PROPS = [
    'title',
    'label',
    'showLabel',
    'hideLabel',
    'ariaLabel',
    'aria-label',
    'description',
    'hint',
    'placeholder',
    'loadingLabel',
    'eyebrow',
    'heading',
  ]

  /**
   * The one exception, and it is not copy: a picture of the characters a field
   * takes. `000000` and `xxxxx-xxxxx` are the same string in every language, and
   * a translation byte-identical to English is what the parity gate calls
   * untranslated - so they stay literal, exactly as an ISO currency code does.
   */
  const MASK = /^[0-9x\s-]+$/

  it.each(SOURCES.map((source) => [named(source), source] as const))(
    '%s writes no copy-bearing prop as a string literal',
    (_name, source) => {
      const pattern = new RegExp(`\\s(${COPY_PROPS.join('|')})="([^"]*)"`, 'g')
      const found = [...withoutComments(source.text).matchAll(pattern)]
        .filter((match) => !(match[1] === 'placeholder' && MASK.test(match[2])))
        .map((match) => match[0].trim())
      expect(found).toEqual([])
    },
  )

  /**
   * A JSX text node: a run of words between `>` and `<` that starts with a
   * capital and is not a placeholder glyph. Anything the screens render as prose
   * arrives as `{t('…')}` and so is inside braces, which this cannot match.
   */
  const JSX_TEXT = />\s*([A-Z][A-Za-z'’]*(?:[ ,.'’-]+[A-Za-z'’]+)+)\s*</g

  it.each(SOURCES.map((source) => [named(source), source] as const))(
    '%s renders no English sentence as a JSX text node',
    (_name, source) => {
      const found = [...withoutComments(source.text).matchAll(JSX_TEXT)].map(
        (match) => match[1],
      )
      expect(found).toEqual([])
    },
  )
})

describe('the screens read correctly in Arabic', () => {
  /** Physical direction utilities, each with the logical one that replaces it. */
  const PHYSICAL =
    /\b(?:m[lr]-|p[lr]-|text-(?:left|right)\b|border-[lr]\b|rounded-[lr]-|inset-x-|left-\d|right-\d|float-(?:left|right)|origin-(?:left|right))/g

  it.each(SOURCES.map((source) => [named(source), source] as const))(
    '%s uses logical direction utilities only',
    (_name, source) => {
      const found = [...withoutComments(source.text).matchAll(PHYSICAL)].map(
        (match) => match[0],
      )
      expect(found).toEqual([])
    },
  )

  it('mirrors every directional glyph it renders', () => {
    // The handed icons these screens use, per the contract in
    // `src/styles/styles.css`: each one means "the direction reading travels",
    // so each occurrence must carry the marker that flips it under `dir="rtl"`.
    const HANDED = /<(ArrowLeft|ArrowRight|Send)\b([^>]*)>/g
    const unmarked: Array<string> = []
    for (const source of SOURCES) {
      for (const match of withoutComments(source.text).matchAll(HANDED)) {
        if (!match[2].includes('data-mirror-rtl')) {
          unmarked.push(`${named(source)}: ${match[1]}`)
        }
      }
    }
    expect(unmarked).toEqual([])
  })
})

describe('the catalogue and its screen and email consumers agree', () => {
  const emailPath = join(process.cwd(), 'src', 'server', 'auth', 'email.ts')
  const consumers = [
    ...SOURCES,
    { path: emailPath, text: readFileSync(emailPath, 'utf8') },
  ]
  const used = new Set<string>()
  for (const source of consumers) {
    for (const match of source.text.matchAll(/'auth\.([\w.]+)'/g)) {
      used.add(match[1])
    }
  }

  it('finds the passkey notice keys read by the email message descriptor', () => {
    expect([...used]).toEqual(
      expect.arrayContaining([
        'passkeyNotice.added',
        'passkeyNotice.removed',
        'passkeyNotice.security',
        'passkeyNotice.action',
        'passkeyNotice.recovery',
      ]),
    )
  })

  it('finds the keys the screens read', () => {
    // A floor rather than an exact count: the two assertions below are what
    // matter, and this only proves the scan is looking at real call sites.
    expect(used.size).toBeGreaterThan(100)
  })

  it('has every key a consumer reads', () => {
    const missing = [...used].filter((key) => !(key in auth))
    expect(missing).toEqual([])
  })

  it('has no key no consumer reads', () => {
    const unused = Object.keys(auth).filter((key) => !used.has(key))
    expect(unused).toEqual([])
  })
})
