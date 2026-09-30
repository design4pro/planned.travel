// scripts/worktree/bootstrap.sh as a black box. Its failure mode is silence: a wrong branch leaves a
// checkout that looks fine and quietly lacks something (HUSKY=0 once reached every human install,
// so no commit of theirs ever ran the pre-commit gate). The script is run for real in a scratch
// repository, with `pnpm` and `sqlite3` stubbed on PATH to record what they were asked to do. Its
// source is never asserted on: that goes red on a reformat and stays green on a behaviour change.
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
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

const BOOTSTRAP = resolve(__dirname, '../bootstrap.sh')

let scratch: string
let calls: string

// No inherited environment: this suite may itself run inside a cezar task (CEZ_TASK_ID), a
// Claude session (CLAUDE_PROJECT_DIR) or a git hook (GIT_DIR), and each would steer the script.
const baseEnv = () => ({
  PATH: `${join(scratch, 'bin')}:${process.env.PATH}`,
  HOME: scratch,
})

const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: baseEnv() as unknown as NodeJS.ProcessEnv,
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
}

const stub = (name: string, body: string) => {
  const file = join(scratch, 'bin', name)
  writeFileSync(file, `#!/bin/sh\n${body}\n`)
  chmodSync(file, 0o755)
}

// Everything but `node_modules` already on disk, so the run reaches the install decision and then
// skips every later step instead of migrating, loading airports or fetching a basemap.
const provision = (dir: string, { deps }: { deps: boolean }) => {
  const d1 = join(dir, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject')
  mkdirSync(d1, { recursive: true })
  writeFileSync(join(d1, 'local.sqlite'), 'stub')
  const blobs = join(dir, '.wrangler/state/v3/r2/planned-travel-tiles/blobs')
  mkdirSync(blobs, { recursive: true })
  writeFileSync(join(blobs, 'basemap'), 'stub')
  if (deps) mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true })
}

const bootstrap = (
  dir: string,
  args: string[] = [],
  env: Record<string, string> = {},
) => {
  const r = spawnSync('bash', [BOOTSTRAP, '--no-seed', ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...baseEnv(),
      CLAUDE_PROJECT_DIR: dir,
      ...env,
    } as unknown as NodeJS.ProcessEnv,
    timeout: 30_000,
  })
  expect(r.status, r.stderr).toBe(0)
  return r
}

const pnpmCalls = () =>
  existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n') : []
const installs = () => pnpmCalls().filter((line) => line.startsWith('install '))
const servedPort = (stdout: string) =>
  Number(/vite dev --port (\d+)/.exec(stdout)?.[1])

let main: string

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'bootstrap-test-'))
  calls = join(scratch, 'pnpm.calls')
  mkdirSync(join(scratch, 'bin'))
  stub('pnpm', `printf '%s HUSKY=%s\\n' "$*" "\${HUSKY-unset}" >> '${calls}'`)
  // Answers "yes" to the schema and airport-catalogue probes against the stub database file.
  stub('sqlite3', 'echo 1')
  main = join(scratch, 'main')
  mkdirSync(main)
  git(main, 'init', '-q')
  git(
    main,
    '-c',
    'user.name=test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'init',
  )
})

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('scripts/worktree/bootstrap.sh', { timeout: 15_000 }, () => {
  describe('dependency install', () => {
    it('passes HUSKY=0 to pnpm install inside a cezar run', () => {
      provision(main, { deps: false })
      bootstrap(main, [], { CEZ_TASK_ID: 'test' })
      expect(installs()).toEqual(['install --frozen-lockfile HUSKY=0'])
    })

    it('leaves HUSKY unset outside a cezar run, so husky installs the git hooks', () => {
      // The regression behind #299: a human's first bootstrap skipped `prepare: husky` and their
      // commits never ran lint-staged, typecheck or the tests.
      provision(main, { deps: false })
      bootstrap(main)
      expect(installs()).toEqual(['install --frozen-lockfile HUSKY=unset'])
    })

    it('skips the install when node_modules/.bin is already there', () => {
      provision(main, { deps: true })
      const r = bootstrap(main)
      expect(installs()).toEqual([])
      expect(r.stdout).toContain('dependencies present')
    })

    // The regression behind the TypeScript 6.0.3 checkout: `node_modules/.bin` was there, the
    // lockfile had moved on to TypeScript 7, and the script reported "dependencies present".
    // pnpm keeps the lockfile it last installed from at node_modules/.pnpm/lock.yaml.
    const lockfiles = (dir: string, wanted: string, installed: string) => {
      writeFileSync(join(dir, 'pnpm-lock.yaml'), wanted)
      mkdirSync(join(dir, 'node_modules/.pnpm'), { recursive: true })
      writeFileSync(join(dir, 'node_modules/.pnpm/lock.yaml'), installed)
    }

    it('skips the install when node_modules was installed from the current lockfile', () => {
      provision(main, { deps: true })
      lockfiles(main, 'typescript: 7.0.2\n', 'typescript: 7.0.2\n')
      const r = bootstrap(main)
      expect(installs()).toEqual([])
      expect(r.stdout).toContain('dependencies present')
    })

    it('reinstalls when node_modules was installed from an older lockfile', () => {
      provision(main, { deps: true })
      lockfiles(main, 'typescript: 7.0.2\n', 'typescript: 6.0.3\n')
      bootstrap(main)
      expect(installs()).toEqual(['install --frozen-lockfile HUSKY=unset'])
    })

    it('reports a stale node_modules under --check', () => {
      provision(main, { deps: true })
      lockfiles(main, 'typescript: 7.0.2\n', 'typescript: 6.0.3\n')
      const r = spawnSync('bash', [BOOTSTRAP, '--check'], {
        cwd: main,
        encoding: 'utf8',
        env: {
          ...baseEnv(),
          CLAUDE_PROJECT_DIR: main,
        } as unknown as NodeJS.ProcessEnv,
      })
      expect(r.status).toBe(1)
      expect(r.stderr).toContain('node_modules')
    })

    it('installs anyway under --force', () => {
      provision(main, { deps: true })
      bootstrap(main, ['--force'])
      expect(installs()).toEqual(['install --frozen-lockfile HUSKY=unset'])
    })
  })

  describe('port', () => {
    it('serves the main checkout on 3000', () => {
      provision(main, { deps: true })
      const r = bootstrap(main)
      expect(servedPort(r.stdout)).toBe(3000)
      expect(readFileSync(join(main, '.dev.vars'), 'utf8')).toContain(
        'APP_URL=http://localhost:3000\n',
      )
    })

    it('serves a linked worktree on 3001-3009, never on the developer port', () => {
      const wt = join(scratch, 'wt')
      git(main, 'worktree', 'add', '-q', '--detach', wt)
      provision(wt, { deps: true })
      const r = bootstrap(wt)
      const port = servedPort(r.stdout)
      // Which one depends on what else listens on this machine; the range is the contract.
      expect(port).toBeGreaterThanOrEqual(3001)
      expect(port).toBeLessThanOrEqual(3009)
      expect(readFileSync(join(wt, '.dev.vars'), 'utf8')).toContain(
        `APP_URL=http://localhost:${port}\n`,
      )
    })

    it('serves a linked worktree on 3000 under --profile cloud', () => {
      const wt = join(scratch, 'wt')
      git(main, 'worktree', 'add', '-q', '--detach', wt)
      provision(wt, { deps: true })
      const r = bootstrap(wt, ['--profile', 'cloud'])
      expect(servedPort(r.stdout)).toBe(3000)
    })
  })
})
