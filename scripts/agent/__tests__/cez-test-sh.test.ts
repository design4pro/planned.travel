/**
 * `cez-test.sh` is the only way an agent step may reach vitest: the workflow allowlists it, and
 * `git-guardrails.sh` blocks `pnpm exec|run` for exactly that reason. So its argument rule is not
 * a convenience - it decides what an agent can and cannot verify at all.
 *
 * Run c9ac1079 is why the root-level case exists. Ticket #98 asked for `vite.config.test.ts`, the
 * script refused every path without a `src/` `server/` `scripts/` prefix, the agent fell back to
 * `pnpm exec vitest run vite.config.test.ts`, and the hook blocked that too - leaving the full
 * 5000-test suite as the only way to see one assertion.
 *
 * The script is driven for real against a `pnpm` stub, so what is asserted is the argument vector
 * vitest would have been given, never the script's text.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ghWorld } from './helpers/gh-world'

import type { World } from './helpers/gh-world'

// Each case is a bash process plus a scratch git repo from the harness. Comfortably fast alone and
// past vitest's 5 s default when the whole suite runs it alongside everything else.
vi.setConfig({ testTimeout: 60_000 })

const N = 42
let w: World
let argv: string

beforeEach(() => {
  w = ghWorld(N)
  w.setIssue({ labels: ['status: in-progress', 'type: bug'] })
  argv = join(w.clone, 'pnpm-argv')
  const stub = join(w.bin, 'pnpm')
  writeFileSync(stub, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" > "${argv}"\n`)
  chmodSync(stub, 0o755)
})

/** Creates `rel` inside the clone so a rejection is the path rule, never a missing file. */
const touch = (rel: string) => {
  const path = join(w.clone, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, 'it("x", () => {})\n')
  return path
}

describe('cez-test.sh', () => {
  it('runs a root-level spec, which is what #98 asked for and could not get', () => {
    touch('vite.config.test.ts')
    const { status } = w.run('cez-test.sh', ['vite.config.test.ts'])
    expect(status).toBe(0)
    expect(readFileSync(argv, 'utf8').trim()).toBe(
      'exec vitest run vite.config.test.ts',
    )
  })

  it('still runs the test roots, one call for several files', () => {
    touch('src/a.test.ts')
    touch('scripts/b.test.ts')
    const { status } = w.run('cez-test.sh', [
      'src/a.test.ts',
      'scripts/b.test.ts',
    ])
    expect(status).toBe(0)
    expect(readFileSync(argv, 'utf8').trim()).toBe(
      'exec vitest run src/a.test.ts scripts/b.test.ts',
    )
  })

  it.each([
    ['a directory outside the roots, test name and all', 'docs/a.test.ts'],
    ['a root file that is not a spec', 'package.json'],
    ['a traversal', '../a.test.ts'],
  ])('refuses %s and runs nothing', (_, arg) => {
    if (!arg.startsWith('..')) touch(arg)
    const { status } = w.run('cez-test.sh', [arg])
    expect(status).not.toBe(0)
    expect(existsSync(argv)).toBe(false)
  })

  it('refuses flags, so the closed argument space stays closed', () => {
    const { status } = w.run('cez-test.sh', ['--reporter=json'])
    expect(status).not.toBe(0)
    expect(existsSync(argv)).toBe(false)
  })

  it('refuses an empty argument list', () => {
    expect(w.run('cez-test.sh', []).status).not.toBe(0)
  })
})
