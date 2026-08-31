/**
 * The `AI` binding, asserted where it is actually declared.
 *
 * `src/server/ai/bindings.ts` is one line of `return env.AI`, and the `server` Vitest project
 * cannot import it: `cloudflare:workers` does not resolve there at all, which is the whole reason
 * every binding in this repository is reached through a seam module rather than inline. So the
 * accessor itself is out of reach of a test, and what is left is the thing that can actually go
 * wrong — the declaration it reads from.
 *
 * A binding lives in `wrangler.jsonc` and nowhere else, and a missing one is not a compile error:
 * `env.AI` typechecks against the ambient declaration in `../cloudflare-env.d.ts` whether or not
 * the Worker was ever given the binding, and fails at the first call in a deployed environment with
 * an undefined read. Nothing else in this repository reads that file, so this suite is the only
 * gate between "declared for production" and "declared for production and forgotten for staging" —
 * which is the shape the mistake takes, because wrangler does not inherit bindings into a named
 * environment. Every other binding in the file is declared twice for that reason, and this one is
 * held to the same rule.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CONFIG_PATH = join(process.cwd(), 'wrangler.jsonc')

/**
 * JSONC into a value, without a parser dependency and without importing wrangler.
 *
 * Reaching for `wrangler`'s own reader costs 192 MB of resident memory per Vitest worker — measured
 * — and this project isolates per file, so it would be paid again by every suite that ever asks a
 * question about the config. What is needed is smaller than that: strip comments and trailing
 * commas, then `JSON.parse`. The scan is string-aware in both directions, because `"https://…"`
 * contains a comment opener and a name could contain a brace. It is a reader for this one file and
 * not a JSONC implementation, so it is held to this one file: the control case below reads the
 * bindings that have been in the config for the life of the project back out of it, which a scan
 * that mangled the document could not do.
 */
function parseJsonc(source: string): unknown {
  let out = ''
  let inString = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    // `slice` rather than an index, so the last character of the file reads as `''` rather than as
    // an `undefined` TypeScript has been told is a `string`.
    const next = source.slice(i + 1, i + 2)

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
        out += char
      }
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }
    if (inString) {
      out += char
      if (char === '\\') {
        out += next
        i++
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      out += char
      continue
    }
    if (char === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }
    if (char === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }
    if (char === '}' || char === ']') {
      // A trailing comma is legal here and not in JSON. Walk back over the whitespace the
      // formatter left and drop the comma it was separating from nothing.
      let end = out.length
      while (end > 0 && /\s/.test(out[end - 1])) end--
      if (end > 0 && out[end - 1] === ',') {
        out = out.slice(0, end - 1) + out.slice(end)
      }
    }
    out += char
  }

  return JSON.parse(out)
}

/** The value at a key path, or `undefined` if any step of it is absent. */
function nodeAt(config: unknown, path: ReadonlyArray<string>): unknown {
  let node: unknown = config
  for (const key of path) {
    if (typeof node !== 'object' || node === null || !(key in node)) {
      return undefined
    }
    node = (node as Record<string, unknown>)[key]
  }
  return node
}

/** The binding name the `ai` block of one environment declares, or `undefined` for none. */
function aiBindingNameIn(
  config: unknown,
  path: ReadonlyArray<string>,
): unknown {
  return nodeAt(config, [...path, 'ai', 'binding'])
}

/** The `key` of every entry of a list of declarations, skipping anything that is not a string. */
function namesUnder(value: unknown, key: 'binding' | 'name'): Array<string> {
  if (!Array.isArray(value)) return []
  return (value as ReadonlyArray<unknown>).flatMap((entry) => {
    const name = nodeAt(entry, [key])
    return typeof name === 'string' ? [name] : []
  })
}

/**
 * Where a binding name lives, per resource kind.
 *
 * The config spells it two ways — `binding` for D1, KV, R2 and queue producers, `name` for a
 * Durable Object — under five different paths, which is why this is a table rather than one key.
 */
const BINDING_SOURCES: ReadonlyArray<{
  path: ReadonlyArray<string>
  key: 'binding' | 'name'
}> = [
  { path: ['d1_databases'], key: 'binding' },
  { path: ['kv_namespaces'], key: 'binding' },
  { path: ['r2_buckets'], key: 'binding' },
  { path: ['queues', 'producers'], key: 'binding' },
  { path: ['durable_objects', 'bindings'], key: 'name' },
]

/**
 * Every binding one environment declares, sorted.
 *
 * The `ai` block is a lone object rather than a list and so appears in none of the shapes above;
 * it is asserted on its own, by the cases that are the point of this suite.
 */
function bindingNamesIn(
  config: unknown,
  path: ReadonlyArray<string>,
): Array<string> {
  return BINDING_SOURCES.flatMap((source) =>
    namesUnder(nodeAt(config, [...path, ...source.path]), source.key),
  ).sort()
}

/** Both environments the repository deploys, named as they are in the file. */
const ENVIRONMENTS: ReadonlyArray<{
  name: string
  path: ReadonlyArray<string>
}> = [
  { name: 'production', path: [] },
  { name: 'staging', path: ['env', 'staging'] },
]

describe('the AI binding in wrangler.jsonc', () => {
  const config = parseJsonc(readFileSync(CONFIG_PATH, 'utf8'))

  it.each(ENVIRONMENTS)(
    'declares AI for $name, because a named environment inherits no binding',
    ({ path }) => {
      expect(aiBindingNameIn(config, path)).toBe('AI')
    },
  )

  it('reads the config the same way wrangler does — the parser control', () => {
    // Not a test of the config: a test of the reader above. These seven bindings and the worker
    // name have been in `wrangler.jsonc` since before this ticket and are asserted here only
    // because recovering all of them from both environments is something a comment-stripper with a
    // string bug cannot do — it would drop a key, swallow a brace, or fail to parse at all.
    expect(nodeAt(config, ['name'])).toBe('planned-travel')
    expect(bindingNamesIn(config, [])).toEqual([
      'DB',
      'FILES',
      'KV',
      'SESSIONS',
      'TASKS',
      'TILES',
      'TRIP_ROOM',
    ])
    expect(bindingNamesIn(config, ['env', 'staging'])).toEqual([
      'DB',
      'FILES',
      'KV',
      'SANDCASTLE_REGISTRY',
      'SESSIONS',
      'TASKS',
      'TILES',
      'TRIP_ROOM',
    ])
  })

  it('gives every environment the same binding name the code reads', () => {
    // `src/server/ai/bindings.ts` reads `env.AI` with no environment branch, and
    // `../cloudflare-env.d.ts` declares one member. A config that named it differently in one
    // environment would compile, deploy, and fail only there.
    const names = new Set(
      ENVIRONMENTS.map(({ path }) => aiBindingNameIn(config, path)),
    )

    expect([...names]).toEqual(['AI'])
  })
})
