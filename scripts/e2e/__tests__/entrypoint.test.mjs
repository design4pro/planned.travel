import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const directories = []
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true })
})

function run(args, nativeExit = '0', legacyExit = '0') {
  const root = mkdtempSync(join(tmpdir(), 'pt-e2e-entrypoint-'))
  directories.push(root)
  const bin = join(root, 'bin')
  // The canonical gate places TMPDIR inside this ESM repository. Own the fixture's module mode.
  writeFileSync(join(root, 'package.json'), '{"type":"commonjs"}\n')
  mkdirSync(bin)
  mkdirSync(join(root, '.ai/scripts'), { recursive: true })
  copyFileSync(
    new URL('../../../.ai/scripts/e2e.sh', import.meta.url),
    join(root, '.ai/scripts/e2e.sh'),
  )
  writeFileSync(join(root, '.ai/scripts/test-env-up.sh'), '#!/bin/sh\nexit 0\n')
  const tool = (name, body) => {
    const path = join(bin, name)
    writeFileSync(path, body)
    chmodSync(path, 0o700)
  }
  tool('git', '#!/bin/sh\nprintf "%s\\n" "$TEST_ROOT"\n')
  tool('jq', '#!/bin/sh\nprintf "%s\\n" "http://127.0.0.1:3037"\n')
  tool(
    'pnpm',
    `#!${process.execPath}\nconst fs = require('node:fs');\nfs.appendFileSync(process.env.CALLS, JSON.stringify({ args: process.argv.slice(2), nativeUrl: process.env.E2E_BASE_URL, legacyUrl: process.env.PLAYWRIGHT_BASE_URL }) + '\\n');\nprocess.exit(Number(process.argv[2] === 'e2e:native' ? process.env.NATIVE_EXIT : process.env.LEGACY_EXIT));\n`,
  )
  const log = join(root, 'calls.jsonl')
  writeFileSync(log, '')
  const result = spawnSync(
    'bash',
    [join(root, '.ai/scripts/e2e.sh'), ...args],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TEST_ROOT: root,
        CALLS: log,
        NATIVE_EXIT: nativeExit,
        LEGACY_EXIT: legacyExit,
      },
    },
  )
  const calls = readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  return { result, calls }
}

describe('the agent E2E entrypoint', () => {
  it('runs both against one owned origin and retains a native failure', () => {
    const { result, calls } = run([], '1')
    expect(result.status).toBe(1)
    expect(
      calls.map((call) => call.args),
      result.stderr,
    ).toEqual([
      ['e2e:native', '--target', 'chromium'],
      ['e2e:browser', '--target', 'chromium'],
    ])
    for (const call of calls) {
      expect(call.nativeUrl).toBe('http://127.0.0.1:3037')
      expect(call.legacyUrl).toBe(call.nativeUrl)
    }
  })
  it('routes a native file and line to the native runner', () => {
    const args = ['e2e/native/csrf.e2e.ts:10', '-g', 'origin proof']
    const { result, calls } = run(args)
    expect(result.status, result.stderr).toBe(0)
    expect(
      calls.map((call) => call.args),
      result.stderr,
    ).toEqual([
      [
        'e2e:native',
        '--target',
        'chromium',
        'e2e/native/csrf.e2e.ts:10',
        '--grep',
        'origin proof',
      ],
    ])
    const failed = run(args, '1')
    expect(failed.result.status).toBe(1)
    expect(failed.calls).toEqual(calls)
  })
  it('preserves browser filters and failure status', () => {
    // A consumed pattern names no file, even when it resembles a native selector.
    for (const flag of ['-g', '--grep', '--grep-invert']) {
      const pattern = 'e2e/native/csrf.e2e.ts'
      const { result, calls } = run([flag, pattern], '0', '1')
      expect(result.status).toBe(1)
      expect(calls.map((call) => call.args)).toEqual([
        [
          'e2e:browser',
          '--target',
          'chromium',
          flag === '-g' ? '--grep' : flag,
          pattern,
        ],
      ])
    }
  })
  it('refuses mixed runner selectors before starting any test', () => {
    const { result, calls } = run([
      'e2e/native/csrf.e2e.ts',
      'e2e/browser/trips-core.e2e.ts',
    ])
    expect(result.status).toBe(2)
    expect(calls).toEqual([])
  })
  it('is valid Bash', () => {
    expect(() =>
      execFileSync('bash', [
        '-n',
        new URL('../../../.ai/scripts/e2e.sh', import.meta.url).pathname,
      ]),
    ).not.toThrow()
  })
})
