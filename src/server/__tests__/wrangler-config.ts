/** Lightweight shared JSONC reader; no Wrangler runtime or app initialization. */
export function parseJsonc(source: string): unknown {
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
      out += ' '
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

  if (inBlockComment) throw new Error('Unterminated JSONC block comment')
  return JSON.parse(out)
}

/** The value at a key path, or `undefined` if any step of it is absent. */
export function nodeAt(config: unknown, path: ReadonlyArray<string>): unknown {
  let node: unknown = config
  for (const key of path) {
    if (typeof node !== 'object' || node === null || !(key in node)) {
      return undefined
    }
    node = (node as Record<string, unknown>)[key]
  }
  return node
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

/** Bindings declared explicitly in one environment, including singleton bindings. */
export function bindingNamesIn(
  config: unknown,
  path: ReadonlyArray<string>,
): Array<string> {
  const arrays = BINDING_SOURCES.flatMap((source) =>
    namesUnder(nodeAt(config, [...path, ...source.path]), source.key),
  )
  const objects = Object.values(
    (nodeAt(config, path) ?? {}) as Record<string, unknown>,
  ).flatMap((value) => {
    const name = nodeAt(value, ['binding'])
    return typeof name === 'string' ? [name] : []
  })
  return [...arrays, ...objects].sort()
}
