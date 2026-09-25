// .husky/pre-commit as a black box: inside a cezar run (CEZ_TASK_ID) it must exit before running
// anything, because the run is gated by validation.commands, not by lint-staged and the test suite.
import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const PRE_COMMIT = resolve(__dirname, '../../.husky/pre-commit')

// `/bin/sh`, not `sh`: with PATH=/nonexistent a bare `sh` is not found and status is null.
// no pnpm, no npx: a fall-through fails. The repo augments ProcessEnv with app variables.
const run = (env: Record<string, string>) =>
  spawnSync('/bin/sh', ['-e', PRE_COMMIT], {
    encoding: 'utf8',
    env: { PATH: '/nonexistent', ...env } as unknown as NodeJS.ProcessEnv,
    timeout: 15_000,
  })

// A commit made from a worktree runs this file with GIT_DIR pointing at that worktree's git
// directory. Inherited, it turns `git init` below into a re-init of the real repository, which
// sets `core.bare = true` in the shared config. The scratch repository gets none of it, and no
// CEZ_TASK_ID either: the case is about the hook outside a cezar run.
const localEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !name.startsWith('GIT_') && name !== 'CEZ_TASK_ID',
  ),
) as unknown as NodeJS.ProcessEnv
const git = (args: Array<string>, cwd: string) =>
  execFileSync('git', args, { cwd, env: localEnv })

describe('.husky/pre-commit', { timeout: 15_000 }, () => {
  it('exits at once, without running anything, inside a cezar run', () => {
    const r = run({ CEZ_TASK_ID: 'test' })
    expect(r.status).toBe(0)
    expect(r.stdout + r.stderr).toBe('')
  })

  it('still runs its gate outside a cezar run', () => {
    // The other half of the guard. Without this case an unconditional `exit 0` at the top of
    // the hook would keep the suite green while every developer commit skipped lint-staged,
    // typecheck and the tests.
    const r = run({})
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('npx')
  })

  it('runs the tests the staged change reaches, plus every test that reads the disk', () => {
    // ADR 0031. `npx` and `pnpm` are stubs that record their arguments, so the case pins what the
    // hook asks vitest for without running it. A test that only imports stays out; one that
    // reads the disk or starts a process is always in, whatever was staged.
    const root = mkdtempSync(join(tmpdir(), 'pre-commit-'))
    const bin = mkdtempSync(join(tmpdir(), 'pre-commit-bin-'))
    const log = join(bin, 'calls.log')
    try {
      for (const tool of ['npx', 'pnpm']) {
        writeFileSync(
          join(bin, tool),
          `#!/bin/sh\necho "${tool} $*" >> "${log}"\n`,
          { mode: 0o755 },
        )
      }
      git(['init', '-q'], root)
      mkdirSync(join(root, 'src/__tests__/support'), { recursive: true })
      const files = {
        'src/trip.ts': 'export const days = 1\n',
        'src/trip.test.ts': "import { days } from './trip'\n",
        'src/__tests__/copy-rules.test.ts': "readFileSync('src/trip.ts')\n",
        'src/__tests__/support/cli.ts': "spawnSync('git', ['status'])\n",
      }
      for (const [path, body] of Object.entries(files)) {
        writeFileSync(join(root, path), body)
      }
      git(['add', '.'], root)
      git(
        ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x'],
        root,
      )
      writeFileSync(join(root, 'src/trip.ts'), 'export const days = 2\n')
      git(['add', 'src/trip.ts'], root)

      const r = spawnSync('/bin/sh', ['-e', PRE_COMMIT], {
        cwd: root,
        encoding: 'utf8',
        env: { ...localEnv, PATH: `${bin}:${process.env.PATH ?? ''}` },
        timeout: 15_000,
      })
      expect(r.status).toBe(0)
      expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
        'npx lint-staged',
        'pnpm typecheck',
        'pnpm exec vitest related --run --passWithNoTests src/trip.ts src/__tests__/copy-rules.test.ts src/__tests__/support/cli.ts',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(bin, { recursive: true, force: true })
    }
  })
})
