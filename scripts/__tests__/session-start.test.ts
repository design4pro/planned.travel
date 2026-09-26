// scripts/cloud/session-start.sh as a black box: inside a cezar run (CEZ_TASK_ID) it installs
// missing dependencies and stops there, because the workflow provisions the app itself; outside
// one it hands the whole session to bootstrap.sh. `pnpm` and bootstrap.sh are stubs that record
// how they were called, so no case installs or starts anything.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SESSION_START = resolve(__dirname, '../cloud/session-start.sh')

let project: string
let bin: string
let log: string

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'session-start-'))
  bin = mkdtempSync(join(tmpdir(), 'session-start-bin-'))
  log = join(bin, 'calls.log')
  writeFileSync(
    join(bin, 'pnpm'),
    `#!/bin/sh\necho "HUSKY=\${HUSKY-} pnpm $*" >> "${log}"\n`,
    { mode: 0o755 },
  )
  mkdirSync(join(project, 'scripts/worktree'), { recursive: true })
  writeFileSync(
    join(project, 'scripts/worktree/bootstrap.sh'),
    `echo "bootstrap.sh $*" >> "${log}"\n`,
  )
})

afterEach(() => {
  rmSync(project, { recursive: true, force: true })
  rmSync(bin, { recursive: true, force: true })
})

// Only what the script reads: the stubs first on PATH, and none of the session's own
// CEZ_TASK_ID or CLAUDE_CODE_REMOTE. The repo augments ProcessEnv with app variables.
const run = (env: Record<string, string>) => {
  const r = spawnSync('/bin/bash', [SESSION_START], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      CLAUDE_PROJECT_DIR: project,
      ...env,
    } as unknown as NodeJS.ProcessEnv,
    timeout: 15_000,
  })
  const calls = existsSync(log)
    ? readFileSync(log, 'utf8').trim().split('\n')
    : []
  return { status: r.status, calls }
}

describe('scripts/cloud/session-start.sh', { timeout: 15_000 }, () => {
  it('does nothing in a cezar run whose worktree already has dependencies', () => {
    mkdirSync(join(project, 'node_modules/.bin'), { recursive: true })
    expect(run({ CEZ_TASK_ID: 'test' })).toEqual({ status: 0, calls: [] })
  })

  it('installs missing dependencies in a cezar run, and nothing else', () => {
    // implement-ticket, lessons, triage, architecture-review and spec-to-tickets have no
    // bootstrap step of their own; this install is the only one they get.
    expect(run({ CEZ_TASK_ID: 'test' })).toEqual({
      status: 0,
      calls: ['HUSKY=0 pnpm install --frozen-lockfile --prefer-offline'],
    })
  })

  it('still hands a session outside a cezar run to bootstrap.sh', () => {
    // The other half of the guard. Without this case an unconditional `exit 0` would keep the
    // suite green while every local and cloud session silently lost its bootstrap.
    mkdirSync(join(project, 'node_modules/.bin'), { recursive: true })
    expect(run({})).toEqual({
      status: 0,
      calls: ['bootstrap.sh --profile worktree --if-needed'],
    })
    rmSync(log)
    expect(run({ CLAUDE_CODE_REMOTE: 'true' })).toEqual({
      status: 0,
      calls: ['bootstrap.sh --profile cloud'],
    })
  })
})
