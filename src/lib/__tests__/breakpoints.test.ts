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
 * this is aimed at — `1024px` for `64rem`, the form that is only correct at the
 * default 16px font size — is caught here once for all of them. The figures are
 * Tailwind's defaults, which `src/styles/styles.css` leaves unoverridden: a theme
 * that started declaring `--breakpoint-*` would have to change both files, and
 * this test is what says so out loud.
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
 * Six call sites pair a media query with a Tailwind variant, and asserting each
 * one separately would still say nothing about the seventh — which is the one
 * nobody thinks to write a test for. So these two read the source instead, and
 * they cover both halves of the rule: the unit a boundary is measured in, and
 * whether the two halves of a pairing actually name the same one.
 *
 * The stylesheet is read alongside the modules. `styles.css` hand-writes its own
 * `@media (width >= 64rem)` twice, and a `px` one added beside them would have
 * exactly the defect this file exists to prevent, on the other side of the same
 * decision.
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

  /**
   * Viewport boundaries that are genuinely measured in `px`, each with its reason.
   *
   * The module's own rule allows one: a query that complements no Tailwind variant
   * is an independent boundary, and an independent boundary may legitimately be a
   * pixel figure. Empty today — every viewport query in the repo pairs with a
   * variant — but the escape has to exist, because `CODE_REVIEW.md` makes a
   * suppression a blocker and a rule with no honest way out gets one anyway.
   */
  const PIXEL_BY_DESIGN: Readonly<Record<string, string>> = {}

  /**
   * A parenthesised viewport query with a pixel figure in it, in any of the three
   * syntaxes: `min-width:`/`max-width:`, the one-sided range form, and the
   * two-sided one — which is the likeliest shape of a future breach, since the
   * range syntax is the one this repo has settled on.
   */
  const PIXEL_VIEWPORT_QUERY =
    /\((?:(?:min|max)-width:\s*[\d.]+px|width\s*[<>]=?\s*[\d.]+px|[\d.]+px\s*[<>]=?\s*width)/i

  /** Each exported constant beside the Tailwind variant prefix it complements. */
  const PAIRINGS: ReadonlyArray<readonly [string, string]> = [
    ['MEDIA_SM_UP', 'sm:'],
    ['MEDIA_MD_UP', 'md:'],
    ['MEDIA_MD_DOWN', 'md:'],
    ['MEDIA_LG_UP', 'lg:'],
  ]

  interface Source {
    readonly path: string
    readonly text: string
  }

  function sources(directory: string): Array<Source> {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return entry.name === '__tests__' ? [] : sources(path)
      }
      if (!/\.(?:tsx?|css)$/.test(entry.name)) return []
      if (/\.test\.tsx?$/.test(entry.name)) return []
      return [
        {
          path: `src/${relative(SRC, path)}`,
          text: readFileSync(path, 'utf8'),
        },
      ]
    })
  }

  const SOURCES = sources(SRC)

  it('never measures a viewport in `px`', () => {
    const offenders = SOURCES.filter(
      (source) =>
        !(source.path in PIXEL_BY_DESIGN) &&
        PIXEL_VIEWPORT_QUERY.test(source.text),
    ).map((source) => source.path)

    expect(
      offenders,
      'a viewport query that complements a Tailwind variant must use one of the `MEDIA_*` ' +
        'constants in `src/lib/breakpoints.ts`, because a `px` query agrees with a `rem` ' +
        'breakpoint only at the default 16px font size; an independent boundary that is ' +
        'deliberately in `px` belongs in `PIXEL_BY_DESIGN` with its reason',
    ).toEqual([])
  })

  /**
   * The other half of the pairing, and the one the `px` ban says nothing about:
   * a call site can name the right unit and still name the wrong boundary.
   *
   * `plan-workspace.tsx` switched to `MEDIA_MD_UP` would mount its rails from `48rem`
   * while `hidden lg:flex` keeps them invisible to `64rem` — no rails and no phone
   * bar across the whole band, which is the defect this ticket is about, reached
   * without a single `px` anywhere. So a file that reaches for a constant must
   * also carry the variant that constant complements.
   */
  it('reaches for the constant whose variant the same file uses', () => {
    const unpaired: Array<string> = []

    for (const source of SOURCES) {
      if (source.path === 'src/lib/breakpoints.ts') continue
      for (const [constant, variant] of PAIRINGS) {
        if (!source.text.includes(constant)) continue
        if (!source.text.includes(variant)) {
          unpaired.push(
            `${source.path}: ${constant} without any \`${variant}\``,
          )
        }
      }
    }

    expect(
      unpaired,
      'a `MEDIA_*` constant names the Tailwind variant it is the complement of; ' +
        'a file that uses one without using that variant has the two halves of its ' +
        'decision on different boundaries',
    ).toEqual([])
  })
})
