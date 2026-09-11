import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  MEDIA_LG_UP,
  MEDIA_MD_DOWN,
  MEDIA_MD_UP,
  MEDIA_SM_UP,
} from '../breakpoints'

/**
 * The one statement of the repo's breakpoint idiom, and therefore the one place a
 * `px` revert can still happen.
 *
 * Every paired `matchMedia` call site imports from this module, so the mutation
 * this is aimed at — `1024px` for `64rem`, the form that is only correct at a 16px
 * root font size — is caught here once for all of them. The figures are Tailwind's
 * defaults, which `src/styles/styles.css` leaves unoverridden: a theme that
 * started declaring `--breakpoint-*` would have to change both files, and this
 * test is what says so out loud.
 */
describe('the Tailwind breakpoints, as queries', () => {
  const QUERIES = {
    MEDIA_SM_UP,
    MEDIA_MD_UP,
    MEDIA_MD_DOWN,
    MEDIA_LG_UP,
  }

  it('names Tailwind’s own figures, in `rem`', () => {
    expect(MEDIA_SM_UP).toBe('(width >= 40rem)')
    expect(MEDIA_MD_UP).toBe('(width >= 48rem)')
    expect(MEDIA_MD_DOWN).toBe('(width < 48rem)')
    expect(MEDIA_LG_UP).toBe('(width >= 64rem)')
  })

  it('never answers in `px`, whichever boundary it is', () => {
    for (const [name, query] of Object.entries(QUERIES)) {
      expect(query, `${name} must not be a pixel query`).not.toContain('px')
      expect(query, `${name} must be a rem query`).toContain('rem')
    }
  })

  it('uses the range syntax Tailwind’s own variants compile to', () => {
    // A `min-width`/`max-width` pair leaves a 0.02px gap between the two halves
    // of a decision; `width >=` and `width <` meet exactly.
    for (const [name, query] of Object.entries(QUERIES)) {
      expect(query, `${name} must use the range syntax`).toMatch(
        /^\(width [<>]=? \d+(?:\.\d+)?rem\)$/,
      )
    }
  })

  it('states `md` once, so its two directions cannot drift apart', () => {
    expect(MEDIA_MD_DOWN).toBe(MEDIA_MD_UP.replace('width >=', 'width <'))
  })
})

/**
 * The rule, enforced rather than merely written down.
 *
 * Six call sites pair a `matchMedia` query with a Tailwind variant, and asserting
 * each one separately would still say nothing about the seventh. This reads the
 * source instead: a viewport media query measured in `px` anywhere under `src/`
 * cannot agree with the `rem` breakpoint it complements except at the default root
 * font size, so there is no such query to allow and a flat ban is the honest rule.
 * It is also what catches the next call site, which is the one nobody will think to
 * write a test for.
 *
 * Test files are exempt: a mock answers whatever query it is handed, and one that
 * spells a boundary out is simulating a browser rather than asking it anything.
 */
describe('the repo’s paired media queries', () => {
  /**
   * Resolved from the project root rather than from `import.meta.url`: this file
   * runs in the jsdom project, where `import.meta.url` is an `http:` URL and
   * `fileURLToPath` refuses it.
   */
  const SRC = join(process.cwd(), 'src')

  /** A parenthesised viewport query with a pixel figure in it, in either syntax. */
  const PIXEL_VIEWPORT_QUERY =
    /\((?:(?:min|max)-width:\s*[\d.]+px|width\s*[<>]=?\s*[\d.]+px)\)/

  function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return entry.name === '__tests__' ? [] : sourceFiles(path)
      }
      if (!/\.tsx?$/.test(entry.name)) return []
      if (/\.test\.tsx?$/.test(entry.name)) return []
      return [path]
    })
  }

  it('never measures a viewport in `px`', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => PIXEL_VIEWPORT_QUERY.test(readFileSync(path, 'utf8')))
      .map((path) => `src/${relative(SRC, path)}`)

    expect(
      offenders,
      'a viewport query must use one of the `MEDIA_*` constants in `src/lib/breakpoints.ts`, ' +
        'because a `px` query agrees with its Tailwind variant only at a 16px root font size',
    ).toEqual([])
  })
})
