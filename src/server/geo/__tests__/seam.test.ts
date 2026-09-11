/**
 * The binding seam, asserted by reading the directory rather than by importing it.
 *
 * `bindings.ts` cannot be imported here at all — `cloudflare:workers` does not resolve in the
 * `server` Vitest project, which is the whole reason every binding in this repository is reached
 * through one seam module. So what is checked is the property that makes the rest of this
 * directory's tests possible: the cache, the counters and the credential arrive as arguments.
 *
 * The second case is the one that rots, and it is stated the way round
 * `src/server/transit/__tests__/search.test.ts` states its own: the importers outside the directory
 * are named, so a new door into the binding seam turns up in a diff rather than in production. The
 * named list is also its own control — "nothing was found" passes just as well when the walk is
 * broken, which is why this case no longer asserts an empty one.
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

  it('is reached from the one module outside itself that has a door', () => {
    const importers = outsideThisDirectory()
      // Shipped modules only. A test that names `bindings.ts` names it in order to replace it —
      // the `server` project cannot load `cloudflare:workers` at all — so counting one as a door
      // into the seam is counting the opposite of what it is.
      .filter((file) => !file.includes(`${sep}__tests__${sep}`))
      .filter((file) => /from '#\/server\/geo\//.test(codeOf(file)))
      .map((file) => file.slice(SRC.length))
    // The proxy acquired its first door: a confirmation import geocodes the place it writes out of
    // a staged row, so a booking read from a document lands on the map like a hand-made one. A
    // second entry here is a second caller of the binding seam, which is what this case is for.
    expect(importers).toEqual(['server/fns/booking-import.ts'])
  })
})
