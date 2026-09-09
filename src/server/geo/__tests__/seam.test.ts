/**
 * The binding seam, asserted by reading the directory rather than by importing it.
 *
 * `bindings.ts` cannot be imported here at all — `cloudflare:workers` does not resolve in the
 * `server` Vitest project, which is the whole reason every binding in this repository is reached
 * through one seam module. So what is checked is the property that makes the rest of this
 * directory's tests possible: the cache, the counters and the credential arrive as arguments.
 *
 * The second case is the one that rots, and it is stated the opposite way round from
 * `src/server/transit/__tests__/search.test.ts`'s. Transit can assert that its vendor module has no
 * importers outside the directory *and* that its proxy has several — the second is the control that
 * proves the scan works, since "nothing was found" passes just as well when the walk is broken.
 * This module has no caller at all yet, by design, so the control has to come from a module that
 * does have importers: `#/server/metering/rate`, which three directories reach for.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

describe('the geo directory keeps its bindings in one file', () => {
  const DIRECTORY = fileURLToPath(new URL('../', import.meta.url))
  const SRC = fileURLToPath(new URL('../../../', import.meta.url))

  /** Written as a value so this file can look for the specifier without containing an import. */
  const WORKER_ENV = `from 'cloudflare:workers'`

  const codeOf = (file: string): string => readFileSync(file, 'utf8')

  /** Every `.ts`/`.tsx` file under `root`, tests included. */
  function sourceFiles(root: string): Array<string> {
    const found: Array<string> = []
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory)) {
        const full = join(directory, entry)
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        if (/\.tsx?$/.test(entry)) found.push(full)
      }
    }
    walk(root)
    return found
  }

  const outsideThisDirectory = (): Array<string> =>
    sourceFiles(SRC).filter((file) => !file.startsWith(DIRECTORY))

  it('reaches the Worker environment from `bindings.ts` and nowhere else', () => {
    const offenders = sourceFiles(DIRECTORY)
      // This file is not shipped, and it names the specifier in order to look for it.
      .filter((file) => !file.includes(`${sep}__tests__${sep}`))
      .filter((file) => codeOf(file).includes(WORKER_ENV))
      .map((file) => file.slice(DIRECTORY.length))
    expect(offenders).toEqual(['bindings.ts'])
  })

  it('is reached from nowhere outside itself, which is the state this stage ships in', () => {
    const importers = outsideThisDirectory().filter((file) =>
      /from '#\/server\/geo\//.test(codeOf(file)),
    )
    // Not an aspiration: the first caller is the place form's own server module, one stage later.
    // When it lands, this case is the one that has to be rewritten, and rewriting it is how the
    // reviewer of that stage is told the proxy acquired a door.
    expect(importers).toEqual([])

    // The control, because an assertion that nothing was found passes just as well when the scan is
    // broken. Transit uses its own proxy for this; nothing imports ours yet, so the control is the
    // meter three directories share — found by the same walk over the same files.
    const metered = outsideThisDirectory().filter((file) =>
      /from '#\/server\/metering\/rate'/.test(codeOf(file)),
    )
    expect(metered.length).toBeGreaterThan(0)
  })
})
