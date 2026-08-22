import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Two platform APIs are banned in this directory, and prose in a doc comment is
 * not enforcement. This test reads the shipped source and fails on either.
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

describe('the shipped i18n source', () => {
  const sources = shippedSources(I18N_DIR)

  it('covers the whole module, so the grep below means something', () => {
    const names = sources.map((path) =>
      path.slice(I18N_DIR.length + sep.length),
    )
    expect(names).toContain('locales.ts')
    expect(names).toContain('negotiate.ts')
    expect(names).toContain('provider.tsx')
    // 8 modules at the root plus the 23 catalogues.
    expect(names.length).toBeGreaterThanOrEqual(31)
  })

  for (const [api, reason] of BANNED) {
    it(`never calls ${api}`, () => {
      const offenders = sources.filter((path) =>
        // Doc comments explain why these APIs are banned; only code counts.
        readFileSync(path, 'utf8')
          .split('\n')
          .some((line) => !COMMENT.test(line) && line.includes(api)),
      )
      expect(offenders, reason).toEqual([])
    })
  }
})
