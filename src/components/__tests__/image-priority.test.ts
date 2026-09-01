import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Every `<img>` in the product says how it wants to be fetched.
 *
 * A missing `loading` attribute is not a compile error, not a runtime warning
 * and not visible on a fast connection — it is a card cover competing with the
 * hero for the same bandwidth on a phone, and it stays silent for as long as
 * whoever reviews it has a good laptop. Five of the eight images here had
 * drifted from the pattern the other three already followed.
 *
 * The rule is not *which* answer, because both are right in their own place: a
 * cover inside a grid card is below the fold and takes `loading="lazy"`, while
 * the one behind a page header is the Largest Contentful Paint and takes
 * `fetchPriority="high"` precisely so it is not queued behind the grid. What is
 * banned is saying nothing, because the browser then treats them as equals.
 *
 * The seed cannot exercise this: `SeedJourney` has no `coverImageUrl` field at
 * all, so every demo trip and journey renders the generated `CoverArt` instead
 * and not one of these elements reaches the DOM. That is exactly why the rule
 * is read off the source rather than asserted against a render.
 */

const ROOTS = ['components', 'routes'] as const

/** Every `.tsx` under the given roots, tests excluded. */
function sourceFiles(): ReadonlyArray<string> {
  const found: Array<string> = []

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') {
          walk(path)
        }
      } else if (entry.name.endsWith('.tsx')) {
        found.push(path)
      }
    }
  }

  for (const root of ROOTS) {
    walk(join(process.cwd(), 'src', root))
  }
  return found
}

/**
 * The text of each `<img …>` opening tag, which may span many lines. Scanning
 * to the first `>` is enough here: no `<img>` in this codebase carries a `>`
 * inside an attribute expression.
 *
 * Comments come out first. Two of the map files describe a pin as "an `<img>`,
 * a `<button>` and a hover card" in their own prose, and a rule that reads
 * those as elements reports a defect in a sentence.
 */
function imageTags(source: string): ReadonlyArray<string> {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  const tags: Array<string> = []
  let at = code.indexOf('<img')
  while (at !== -1) {
    const end = code.indexOf('>', at)
    tags.push(code.slice(at, end === -1 ? code.length : end + 1))
    at = code.indexOf('<img', at + 4)
  }
  return tags
}

describe('image fetch priority', () => {
  it('gives every image an explicit loading decision', () => {
    const silent: Array<string> = []

    for (const path of sourceFiles()) {
      const source = readFileSync(path, 'utf8')
      for (const tag of imageTags(source)) {
        const declared =
          tag.includes('loading=') || tag.includes('fetchPriority=')
        if (!declared) {
          const relative = path.slice(path.indexOf('/src/') + 1)
          silent.push(`${relative}: ${tag.split('\n')[1]?.trim() ?? tag}`)
        }
      }
    }

    expect(silent).toEqual([])
  })

  it('reads the images it is meant to be reading', () => {
    const total = sourceFiles().reduce(
      (count, path) => count + imageTags(readFileSync(path, 'utf8')).length,
      0,
    )
    // A rule that silently matches nothing passes for the wrong reason.
    expect(total).toBeGreaterThan(5)
  })
})
