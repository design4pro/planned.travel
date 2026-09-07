// .husky/pre-commit as a black box: inside a cezar run (CEZ_TASK_ID) it must exit before running
// anything, because the run is gated by validation.commands, not by lint-staged and the test suite.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const PRE_COMMIT = resolve(__dirname, '../../../.husky/pre-commit')

describe('.husky/pre-commit', () => {
  it('exits at once, without running anything, inside a cezar run', () => {
    // `/bin/sh`, not `sh`: with PATH=/nonexistent a bare `sh` is not found and status is null.
    const r = spawnSync('/bin/sh', ['-e', PRE_COMMIT], {
      encoding: 'utf8',
      // no pnpm, no npx: a fall-through fails. The repo augments ProcessEnv with app variables.
      env: {
        PATH: '/nonexistent',
        CEZ_TASK_ID: 'test',
      } as unknown as NodeJS.ProcessEnv,
      timeout: 5_000,
    })
    expect(r.status).toBe(0)
    expect(r.stdout + r.stderr).toBe('')
  })
})
