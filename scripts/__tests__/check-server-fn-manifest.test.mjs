/**
 * The build gate's own regression test, and it exists for the same reason the gate does: the thing
 * being guarded fails silently.
 *
 * `check-server-fn-manifest.mjs` reads two call shapes the TanStack Start plugin emits and one
 * shape its resolver chunk has. None of the three is ours. Rename `createSsrRpc`, move `id` out of
 * the front of `createServerRpc`'s object literal, or change how the manifest is keyed, and the
 * script keeps exiting 0 over a build with a broken server function in it — which is exactly the
 * state it shipped to staging to prevent. So the guards against a vacuous pass are asserted here as
 * behaviour, by driving the real script over fixture chunks rather than by reading its source.
 *
 * The fixtures are the emitted shapes copied off a real `dist/server`, minified out of the picture:
 * what matters is the text the regexes see.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'check-server-fn-manifest.mjs',
)

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
const ID_MISSING = 'c'.repeat(64)

const scratchDirs = []
afterEach(() => {
  for (const dir of scratchDirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

/** The resolver chunk, keyed the way the built one is. Its filename is what the script finds it by. */
function resolverChunk(ids) {
  const entries = ids.map((id) => `"${id}": () => import("./x.js")`).join(',\n')
  return `const resolver = {\n${entries}\n};\nexport { resolver };\n`
}

/** A server chunk in the emitted shape: the SSR stub, then the registered handler. */
function serverChunk(id, { idFirst = true } = {}) {
  const literal = idFirst
    ? `{\n\tid: "${id}",\n\tname: "someFn",\n\tfilename: "src/server/fns/x.ts"\n}`
    : `{\n\tname: "someFn",\n\tfilename: "src/server/fns/x.ts",\n\tid: "${id}"\n}`
  return [
    `var someFn_createServerFn_handler = createServerRpc(${literal}, (opts) => someFn.__executeServer(opts));`,
    `var someFn = createServerFn({ method: "GET" }).handler(createSsrRpc("${id}"));`,
    '',
  ].join('\n')
}

/**
 * A `dist/server` in miniature: the resolver under `assets/`, where the build puts it, and whatever
 * chunks the case needs beside it.
 */
function buildDir(chunks) {
  const dir = mkdtempSync(join(tmpdir(), 'server-fn-manifest-'))
  scratchDirs.push(dir)
  for (const [name, text] of Object.entries(chunks)) {
    const path = join(dir, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }
  return dir
}

function check(dir) {
  const run = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' })
  return {
    status: run.status,
    output: `${run.stdout}${run.stderr}`,
  }
}

/** A build in which everything resolves — the green path every case below is a mutation of. */
function healthyBuild() {
  return {
    'assets/__23tanstack-start-server-fn-resolver-AAAA.js': resolverChunk([
      ID_A,
      ID_B,
    ]),
    'assets/costs-AAAA.js': serverChunk(ID_A),
    'index.js': serverChunk(ID_B),
  }
}

describe('the green path', () => {
  it('passes a build in which every reference is registered', () => {
    const run = check(buildDir(healthyBuild()))

    expect(run.status).toBe(0)
    expect(run.output).toContain('2 server functions registered')
  })

  it('matches the handler whatever order the object literal is written in', () => {
    // The emitted literal puts `id` first today, and that is the plugin's choice to revisit. A
    // pattern that reads only that order stops matching without failing, which is the one outcome
    // this file exists to make impossible.
    const build = healthyBuild()
    build['index.js'] = serverChunk(ID_B, { idFirst: false })
    expect(check(buildDir(build)).status).toBe(0)

    const broken = healthyBuild()
    broken['assets/__23tanstack-start-server-fn-resolver-AAAA.js'] =
      resolverChunk([ID_A])
    broken['index.js'] = serverChunk(ID_MISSING, { idFirst: false }).replace(
      `createSsrRpc("${ID_MISSING}")`,
      'null',
    )
    const run = check(buildDir(broken))
    expect(run.status).toBe(1)
    expect(run.output).toContain('unroutable handler')
  })
})

describe('a build with a nested server function in it', () => {
  it('names the unregistered id, its chunk and its binding', () => {
    const build = healthyBuild()
    build['assets/nested-AAAA.js'] =
      `var listSessionsFn = createServerFn({ method: "GET" }).handler(createSsrRpc("${ID_MISSING}"));\n`

    const run = check(buildDir(build))

    expect(run.status).toBe(1)
    expect(run.output).toContain(ID_MISSING)
    expect(run.output).toContain('listSessionsFn')
    expect(run.output).toContain('nested-AAAA.js')
    expect(run.output).toContain('nested server function')
    // The fix, spelled out, because the reader of this message is looking at a green typecheck.
    expect(run.output).toContain('plain `async function`')
  })
})

describe('the guards against passing vacuously', () => {
  it('refuses a build with no resolver chunk at all', () => {
    const build = healthyBuild()
    delete build['assets/__23tanstack-start-server-fn-resolver-AAAA.js']

    const run = check(buildDir(build))

    expect(run.status).toBe(1)
    expect(run.output).toContain('no server-fn resolver chunk')
    expect(run.output).toContain('Fix the check, do not delete it')
  })

  it('refuses a resolver whose keys it could not parse', () => {
    const build = healthyBuild()
    build['assets/__23tanstack-start-server-fn-resolver-AAAA.js'] =
      'const resolver = new Map([[shortId, () => import("./x.js")]]);\n'

    const run = check(buildDir(build))

    expect(run.status).toBe(1)
    expect(run.output).toContain('parsed 0 ids')
    expect(run.output).toContain('Fix the check, do not delete it')
  })

  it.each([
    ['createSsrRpc', 'nested server function (createSsrRpc stub)'],
    ['createServerRpc', 'unroutable handler (createServerRpc)'],
  ])('refuses a build in which %s matches nothing', (emitted, kind) => {
    // The renamed-by-an-upgrade case. Every id still resolves, so the assertions themselves are
    // silent; only the count of what was looked at says the check went blind.
    const build = healthyBuild()
    for (const name of ['assets/costs-AAAA.js', 'index.js'])
      build[name] = build[name].replaceAll(emitted, `${emitted}Renamed`)

    const run = check(buildDir(build))

    expect(run.status).toBe(1)
    expect(run.output).toContain('matched 0 occurrences of')
    expect(run.output).toContain(kind)
    expect(run.output).toContain('Fix the check, do not delete it')
  })
})
