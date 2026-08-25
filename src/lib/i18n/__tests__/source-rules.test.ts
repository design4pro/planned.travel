import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Rules about this directory's source that no type and no runtime assertion can
 * express, so they are read off the shipped files instead.
 *
 * `Intl.DisplayNames` is the obvious way to label a language picker and it
 * disagrees with itself across runtimes: workerd returns CLDR's lower-case
 * `polski` and `čeština`, the WebKit that Safari ships title-cases eight of the
 * twenty-three, and neither set matches the capitalised names `docs/SPEC.md` §8
 * fixed. A name that differs between the server pass and the client pass is a
 * hydration error, which fails the quality bar outright.
 *
 * `Intl.Locale.prototype.textInfo` is the obvious way to ask whether a script
 * runs right to left, and it is `undefined` in workerd, in WebKit and in
 * Chromium — so the code that reaches for it renders Arabic left to right and
 * reports no error at all.
 *
 * Both answers live in the frozen table in `../locales`.
 */

/**
 * Resolved from the project root rather than from `import.meta.url`: this file
 * runs in the jsdom project, where `import.meta.url` is an `http:` URL and
 * `fileURLToPath` refuses it.
 */
const I18N_DIR = join(process.cwd(), 'src', 'lib', 'i18n')

const BANNED: ReadonlyArray<readonly [string, string]> = [
  [
    'Intl.DisplayNames',
    'language names differ between workerd and WebKit; use the frozen table in ../locales',
  ],
  [
    'textInfo',
    'Intl.Locale.prototype.textInfo is undefined in every runtime we deploy to; direction comes from ../locales',
  ],
]

/** The eight modules that make up the runtime. */
const MODULES: ReadonlyArray<string> = [
  'catalogue.ts',
  'index.ts',
  'interpolate.ts',
  'locales.ts',
  'negotiate.ts',
  'plural.ts',
  'provider.tsx',
  'types.ts',
]

/** A line that is entirely comment: `//`, `/*` or a `*` continuation. */
const COMMENT = /^\s*(\/\/|\/\*|\*)/

function shippedSources(directory: string): Array<string> {
  const files: Array<string> = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      // The tests themselves name the banned APIs, which is how they check.
      if (entry.name !== '__tests__') {
        files.push(...shippedSources(path))
      }
      continue
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(path)
    }
  }
  return files
}

/** Non-comment lines only: a doc comment may name what the code may not do. */
function codeLines(path: string): ReadonlyArray<string> {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !COMMENT.test(line))
}

describe('the shipped i18n source', () => {
  const sources = shippedSources(I18N_DIR)

  it('covers the whole module, so the greps below mean something', () => {
    const names = sources.map((path) =>
      path.slice(I18N_DIR.length + sep.length),
    )
    for (const module of MODULES) {
      expect(names).toContain(module)
    }
    // Catalogue files live under `messages/<locale>/` and are written by other
    // items, so the count grows; the eight above are what this item ships.
    expect(names.length).toBeGreaterThanOrEqual(MODULES.length)
  })

  for (const [api, reason] of BANNED) {
    it(`never calls ${api}`, () => {
      const offenders = sources.filter((path) =>
        codeLines(path).some((line) => line.includes(api)),
      )
      expect(offenders, reason).toEqual([])
    })
  }

  /**
   * A third ban, enforced here for the same reason: the failure is a build
   * failure rather than a test failure, so nothing else in the suite would ever
   * see it. `` import(`./messages/${locale}`) `` reads better than a glob and
   * does not survive the bundle — esbuild cannot tell which files it means, so
   * wrangler tries to emit the whole source directory and the deploy fails
   * outright. `import.meta.glob` has the same requirement for the same reason:
   * its pattern must be a literal.
   */
  it('never builds an import specifier from a variable', () => {
    const offenders = sources.filter((path) =>
      codeLines(path).some((line) => /import\s*\(\s*`/.test(line)),
    )
    expect(
      offenders,
      'a template-literal import() specifier breaks the wrangler bundle; aggregate with import.meta.glob over a literal pattern',
    ).toEqual([])
  })

  it('aggregates catalogues with the glob docs/SPEC.md §8 fixes', () => {
    // The layout and the pattern are one decision. A glob one level shallower
    // matches no namespace file at all, which is how round 2 shipped a parity
    // gate that reported green over a product rendering English.
    const catalogue = codeLines(join(I18N_DIR, 'catalogue.ts')).join('\n')
    expect(catalogue).toContain(
      "import.meta.glob<NamespaceModule>('./messages/*/*.ts')",
    )
  })
})
