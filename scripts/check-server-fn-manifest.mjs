/**
 * Fails the build when a server function is called from inside another one's handler.
 *
 * The bug this exists for is invisible to every other gate. `createServerFn` compiles to two
 * different things depending on where the build can see it from: a module the *client* graph
 * reaches is split, and its handler is registered in the server-fn resolver manifest; a module only
 * the server graph reaches is compiled to a bare `createSsrRpc("<id>")` stub and registered
 * nowhere. A wrapper's handler is stripped on the client, so its imports are tree-shaken — which
 * means a `createServerFn` whose only caller is another `createServerFn` lands in the second case
 * and throws `Server function info not found for <id>` at `getServerFnById`, in the deployed Worker
 * and nowhere else. Typecheck, lint and vitest are all green on it; it shipped every console screen
 * broken on staging (Sentry PLANNED-TRAVEL-2/-3) and was found by reading the built chunks by hand.
 *
 * The rule that avoids it: `createServerFn` marks the client→server boundary and nothing else.
 * Anything a server function calls is ordinary code — a plain `async function`.
 *
 * This script re-reads that fact off the artifact rather than off the source, so it also catches
 * the day a plugin upgrade changes which modules get split. Two assertions, both cheap:
 *
 * 1. every id a `createSsrRpc` stub names is present in the manifest;
 * 2. every id a `createServerRpc` handler declares is present in the manifest.
 *
 * And two guards against passing vacuously, because both sides of those assertions read shapes
 * nobody here owns: the manifest's, and the two the Start plugin emits. Parsing zero ids out of the
 * resolver, or matching zero occurrences of either pattern across the whole build, is reported as a
 * broken check rather than as a clean one.
 *
 * Run by `pnpm build`, after `vite build`. Takes the directory to scan as an optional argument,
 * which is how its own test drives it.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Overridable so the script's own test can drive it over a fixture tree. `pnpm build` passes
// nothing and reads the real build.
const SERVER_DIR = process.argv[2] ?? 'dist/server'
const ID = '[0-9a-f]{64}'

/** Every `.js` in the server build, path and text. */
function serverChunks(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...serverChunks(path))
    else if (entry.name.endsWith('.js'))
      out.push({ path, text: readFileSync(path, 'utf8') })
  }
  return out
}

/**
 * The nearest `var`/`const` binding above an offset, for the error message.
 *
 * Best effort by design: it names the function when the emitted shape is the familiar
 * `var fooFn = createServerFn(…).handler(createSsrRpc("…"))`, and says nothing when it is not. The
 * id and the chunk are what actually locate the fault.
 */
function bindingBefore(text, offset) {
  const window = text.slice(Math.max(0, offset - 400), offset)
  const names = [
    ...window.matchAll(/(?:var|const|let)\s+([A-Za-z0-9_$]+)\s*=/g),
  ]
  return names.length > 0 ? names[names.length - 1][1] : null
}

const chunks = serverChunks(SERVER_DIR)

const resolver = chunks.find((chunk) =>
  /tanstack-start-server-fn-resolver/.test(chunk.path),
)
if (resolver === undefined) {
  console.error(
    `[server-fn-manifest] no server-fn resolver chunk under ${SERVER_DIR}/.\n` +
      'The build layout changed; this check is reading the wrong artifact and is not ' +
      'protecting anything. Fix the check, do not delete it.',
  )
  process.exit(1)
}

const registered = new Set(
  [...resolver.text.matchAll(new RegExp(`"(${ID})":`, 'g'))].map((m) => m[1]),
)
if (registered.size === 0) {
  console.error(
    `[server-fn-manifest] parsed 0 ids out of ${resolver.path}. The manifest shape changed; ` +
      'this check would pass on anything. Fix the check, do not delete it.',
  )
  process.exit(1)
}

const patterns = [
  {
    kind: 'nested server function (createSsrRpc stub)',
    regex: new RegExp(`createSsrRpc\\(\\s*"(${ID})"`, 'g'),
  },
  {
    kind: 'unroutable handler (createServerRpc)',
    // `id` is matched wherever it sits in the object literal rather than only as its first
    // property: the emitted order is the plugin's to change, and a pattern that survives only one
    // of the orders is a pattern that stops matching without saying so.
    regex: new RegExp(
      `createServerRpc\\(\\s*\\{[^}]*?\\bid:\\s*"(${ID})"`,
      'g',
    ),
  },
]

const unresolved = []
/** Per-pattern totals, matched or not, for the vacuous-pass guard below. */
const seen = new Map(patterns.map(({ kind }) => [kind, 0]))
for (const chunk of chunks) {
  if (chunk === resolver) continue
  for (const { kind, regex } of patterns) {
    for (const match of chunk.text.matchAll(regex)) {
      seen.set(kind, seen.get(kind) + 1)
      if (registered.has(match[1])) continue
      unresolved.push({
        kind,
        id: match[1],
        chunk: chunk.path,
        name: bindingBefore(chunk.text, match.index),
      })
    }
  }
}

/**
 * The detection side's half of the `registered.size === 0` guard above.
 *
 * Both patterns read an emitted call shape that belongs to the Start plugin, not to us. Rename
 * `createSsrRpc`, or move the id out of that object literal, and every pattern matches nothing,
 * `unresolved` stays empty, and this script prints success — a silent no-op for the exact failure
 * it exists to catch. A healthy build carries hundreds of each, so zero is never a build that is
 * merely clean.
 */
const blind = [...seen].filter(([, count]) => count === 0).map(([kind]) => kind)
if (blind.length > 0) {
  console.error(
    `[server-fn-manifest] matched 0 occurrences of: ${blind.join(', ')}.\n` +
      'The emitted call shape changed; this check would pass on anything. ' +
      'Fix the check, do not delete it.',
  )
  process.exit(1)
}

if (unresolved.length > 0) {
  console.error(
    `\n[server-fn-manifest] ${unresolved.length} server function(s) referenced but never ` +
      `registered in ${resolver.path}.\n` +
      'Each one throws "Server function info not found" at runtime, in the deployed Worker only.\n',
  )
  for (const item of unresolved) {
    console.error(`  ${item.name ?? '<unnamed>'}  (${item.kind})`)
    console.error(`    id:    ${item.id}`)
    console.error(`    chunk: ${item.chunk}`)
  }
  console.error(
    "\nAlmost always: a `createServerFn` is being called from inside another one's handler.\n" +
      '`createServerFn` is the client→server boundary; make the inner one a plain `async function`.\n',
  )
  process.exit(1)
}

console.log(
  `[server-fn-manifest] ${registered.size} server functions registered, ` +
    'every reference resolves.',
)
