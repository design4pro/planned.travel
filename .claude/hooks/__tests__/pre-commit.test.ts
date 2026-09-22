// .husky/pre-commit as a black box: inside a cezar run (CEZ_TASK_ID) it must exit before running
// anything, because the run is gated by validation.commands, not by lint-staged and the test suite.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const PRE_COMMIT = resolve(__dirname, '../../../.husky/pre-commit')

// `/bin/sh`, not `sh`: with PATH=/nonexistent a bare `sh` is not found and status is null.
// no pnpm, no npx: a fall-through fails. The repo augments ProcessEnv with app variables.
const run = (env: Record<string, string>) =>
  spawnSync('/bin/sh', ['-e', PRE_COMMIT], {
    encoding: 'utf8',
    env: { PATH: '/nonexistent', ...env } as unknown as NodeJS.ProcessEnv,
    timeout: 15_000,
  })

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
})
