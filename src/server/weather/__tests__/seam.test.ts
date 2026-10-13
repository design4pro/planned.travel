/**
 * The binding seam and the tenant-free surface, asserted by reading the directory.
 *
 * `bindings.ts` cannot be imported here at all - `cloudflare:workers` does not resolve in the
 * `server` Vitest project, which is the whole reason every binding in this repository is reached
 * through one seam module. So what is checked is the property that makes the rest of this
 * directory's tests possible: the cache, the counters and the provider arrive as arguments.
 *
 * The named list of importers is its own control: "nothing was found" passes just as well when the
 * walk is broken, which is why the case asserts the one door by name rather than an empty set.
 *
 * The last two cases are the isolation rule for a cache that every workspace shares: it is keyed on
 * a kind, a coordinate and a date, and nothing exported here can be handed anything else.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as weather from '../weather'

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

describe('the weather directory keeps its bindings in one file', () => {
  it('reaches the Worker environment from `bindings.ts` and nowhere else', () => {
    const offenders = sourceFiles(DIRECTORY)
      // This file is not shipped, and it names the specifier in order to look for it.
      .filter((file) => !file.includes(`${sep}__tests__${sep}`))
      .filter((file) => codeOf(file).includes(WORKER_ENV))
      .map((file) => file.slice(DIRECTORY.length))
    expect(offenders).toEqual(['bindings.ts'])
  })

  it('is reached from the two modules outside itself that have a door', () => {
    const importers = sourceFiles(SRC)
      .filter((file) => !file.startsWith(DIRECTORY))
      // Shipped modules only. A test that names `bindings.ts` names it in order to replace it.
      .filter((file) => !file.includes(`${sep}__tests__${sep}`))
      .filter((file) => /from '#\/server\/weather\//.test(codeOf(file)))
      .map((file) => file.slice(SRC.length))
    // The second door is the development seed, which writes the cache entries the policy reads and
    // so must build their keys with the policy's own functions rather than copy the format. It is
    // reached only from `/api/dev/seed`, which the production build folds away.
    expect(importers).toEqual([
      'routes/_app/trips/$tripId/-server/weather.ts',
      'routes/api/dev/-seed/weather-cache.ts',
    ])
  })
})

describe('a cache every workspace shares holds nothing about one of them', () => {
  it('builds a key from a kind and a coordinate, and nothing else', () => {
    expect(weather.forecastCacheKey.length).toBe(2)
    expect(weather.forecastCacheKey(59.9139, 10.7522)).toBe(
      'wx:v2:forecast:59.9139:10.7522',
    )
    expect(weather.forecastCacheKey(-33.868_82, 151.209_3)).toBe(
      'wx:v2:forecast:-33.8688:151.2093',
    )
  })

  it('builds a recorded key from a coordinate cut to one decimal and a date, and nothing else', () => {
    expect(weather.recordedCacheKey.length).toBe(3)
    expect(weather.recordedCacheKey(59.9139, 10.7522, '2026-10-01')).toBe(
      'wx:v2:recorded:59.9:10.8:2026-10-01',
    )
    // Two places in one grid cell share an entry.
    expect(weather.recordedCacheKey(59.9412, 10.7501, '2026-10-01')).toBe(
      weather.recordedCacheKey(59.9139, 10.7522, '2026-10-01'),
    )
  })

  it('builds a failure key from a provider and a coordinate, and nothing else', () => {
    expect(weather.failureCacheKey.length).toBe(3)
    expect(weather.failureCacheKey('met-norway', 59.9139, 10.7522)).toBe(
      'wx:v2:fail:met-norway:59.9139:10.7522',
    )
    expect(weather.failureCacheKey('nasa-power', 59.9139, 10.7522)).toBe(
      'wx:v2:fail:nasa-power:59.9139:10.7522',
    )
  })

  it('exports no function that can be handed a trip, a place, a member or a day', () => {
    const identifiers = /\b(trip|place|member|user|day|organization|stay)Id\b/i
    const offenders = Object.entries(weather)
      .filter(([, value]) => typeof value === 'function')
      .filter(([, value]) => identifiers.test(String(value)))
      .map(([name]) => name)
    expect(offenders).toEqual([])
  })
})
