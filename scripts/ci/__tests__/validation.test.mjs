import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  executeGate,
  gateFingerprint,
  runGate,
  runValidationCommand,
} from '../validation.mjs'

const passed = { exitCode: 0, result: 'passed', durationMs: 1 }
const dirs = []
const localEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
)
const inheritedGitEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => name.startsWith('GIT_')),
)
beforeEach(() => {
  for (const name of Object.keys(inheritedGitEnv)) delete process.env[name]
})
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
  Object.assign(process.env, inheritedGitEnv)
})
const fixture = () => {
  const cwd = mkdtempSync(join(tmpdir(), 'pt-validation-'))
  dirs.push(cwd)
  const git = (...args) =>
    execFileSync('git', args, { cwd, stdio: 'pipe', env: localEnv })
  git('init')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  writeFileSync(join(cwd, '.gitignore'), '.ai/tmp/\nnode_modules/\n')
  writeFileSync(join(cwd, 'input'), 'original')
  git('add', '.')
  git('commit', '-m', 'fixture')
  return cwd
}

describe('configured validation execution', () => {
  it('runs the ordered configured gate and preserves original attestation command names', async () => {
    const calls = []
    const result = await executeGate(
      ['pnpm typecheck', 'pnpm test', 'pnpm build'],
      {
        run: async (command) => {
          calls.push(command)
          return passed
        },
      },
    )
    expect(calls).toEqual([
      'pnpm typecheck',
      'pnpm exec vitest run --project server',
      'pnpm exec vitest run --project tooling',
      ...[1, 2, 3, 4].map(
        (n) => `pnpm exec vitest run --project ui --shard=${n}/4`,
      ),
      'pnpm build',
    ])
    expect(result.commands.map((c) => c.command)).toEqual([
      'pnpm typecheck',
      'pnpm test',
      'pnpm build',
    ])
    expect(result.exitCode).toBe(0)
  })

  it('shards a timed-out project without omitting tests or repeating completed projects', async () => {
    const calls = []
    const result = await executeGate(['pnpm test'], {
      run: async (command) => {
        calls.push(command)
        return command === 'pnpm exec vitest run --project server'
          ? { exitCode: 124, result: 'timeout', durationMs: 1 }
          : passed
      },
    })
    expect(calls).toEqual([
      'pnpm exec vitest run --project server',
      ...[1, 2, 3, 4].map(
        (n) => `pnpm exec vitest run --project server --shard=${n}/4`,
      ),
      'pnpm exec vitest run --project tooling',
      ...[1, 2, 3, 4].map(
        (n) => `pnpm exec vitest run --project ui --shard=${n}/4`,
      ),
    ])
    expect(result.exitCode).toBe(0)
  })

  it('retries a failed shard on resume and never recursively shards a partial test selection', async () => {
    const calls = []
    const shard = 'pnpm exec vitest run --project ui --shard=1/4'
    const result = await executeGate(['pnpm test'], {
      previous: {
        'pnpm exec vitest run --project server': passed,
        'pnpm exec vitest run --project tooling': passed,
        [shard]: { exitCode: 124, result: 'timeout' },
      },
      run: async (command) => {
        calls.push(command)
        return { exitCode: 124, result: 'timeout' }
      },
    })
    expect(calls).toEqual([shard])
    expect(result.exitCode).toBe(124)
  })

  it('stops on an assertion failure and resumes only successful entries', async () => {
    const calls = []
    const result = await executeGate(['first', 'second', 'third'], {
      previous: { first: passed },
      run: async (command) => {
        calls.push(command)
        return { exitCode: 1, result: 'failed', durationMs: 1 }
      },
    })
    expect(calls).toEqual(['second'])
    expect(result.commands[0].steps[0].reused).toBe(true)
    expect(result.exitCode).toBe(1)
  })

  it('refuses empty and recursive gates', async () => {
    await expect(executeGate([], { run: async () => passed })).rejects.toThrow()
    await expect(
      executeGate(['node scripts/ci/validation.mjs'], {
        run: async () => passed,
      }),
    ).rejects.toThrow()
  })

  it('invalidates receipts after content, gate, environment or installed manifest changes', () => {
    const cwd = fixture()
    const before = gateFingerprint(cwd, ['first'])
    expect(gateFingerprint(cwd, ['second'])).not.toBe(before)
    writeFileSync(join(cwd, 'input'), 'changed')
    expect(gateFingerprint(cwd, ['first'])).not.toBe(before)
    writeFileSync(join(cwd, 'input'), 'original')
    mkdirSync(join(cwd, 'node_modules'))
    writeFileSync(join(cwd, 'node_modules/.modules.yaml'), 'new install')
    expect(gateFingerprint(cwd, ['first'])).not.toBe(before)
    process.env.PT_VALIDATION_TEST = 'changed'
    try {
      expect(gateFingerprint(cwd, ['first'])).not.toBe(before)
    } finally {
      delete process.env.PT_VALIDATION_TEST
    }
  })

  it('keeps full logs out of model output and distinguishes a real timeout', async () => {
    const cwd = fixture()
    const logPath = join(cwd, 'command.log')
    const green = await runValidationCommand('printf evidence', {
      cwd,
      logPath,
    })
    expect(green.result).toBe('passed')
    expect(readFileSync(logPath, 'utf8')).toBe('evidence')
    const timeout = await runValidationCommand('sleep 30', {
      cwd,
      logPath,
      timeoutMs: 50,
    })
    expect(timeout.result).toBe('timeout')
    expect(timeout.exitCode).toBe(124)
  })

  it.each([
    ['success', 'process.exit(0)', 0],
    ['failure', 'process.exit(1)', 1],
    ['timeout', 'setInterval(() => {}, 1000)', 124],
  ])(
    'isolates writable command temp files and cleans up after %s',
    async (_, ending, exitCode) => {
      const cwd = fixture()
      const logPath = join(cwd, 'command.log')
      const parentTemp = [process.env.TMPDIR, process.env.TMP, process.env.TEMP]
      const foreign = join(cwd, 'foreign-temp')
      mkdirSync(foreign)
      writeFileSync(join(foreign, 'keep'), 'unrelated')
      const script = `
      const fs = require("node:fs");
      const os = require("node:os");
      const path = require("node:path");
      fs.writeFileSync(path.join(os.tmpdir(), "probe"), "writable");
      process.stdout.write(JSON.stringify({ temp: os.tmpdir(), tmp: process.env.TMP, windowsTemp: process.env.TEMP, mode: fs.statSync(os.tmpdir()).mode & 0o777, home: process.env.HOME }));
      ${ending};
    `
      const result = await runValidationCommand(`node -e '${script}'`, {
        cwd,
        logPath,
        timeoutMs: 1000,
      })
      expect(result.exitCode).toBe(exitCode)
      const evidence = JSON.parse(readFileSync(logPath, 'utf8'))
      expect(evidence.home).toBe(process.env.HOME)
      expect([process.env.TMPDIR, process.env.TMP, process.env.TEMP]).toEqual(
        parentTemp,
      )
      expect(evidence.tmp).toBe(evidence.temp)
      expect(evidence.windowsTemp).toBe(evidence.temp)
      expect(evidence.mode).toBe(0o700)
      expect(readFileSync(join(foreign, 'keep'), 'utf8')).toBe('unrelated')
      expect(evidence.temp.startsWith(join(cwd, '.ai/tmp/validation/'))).toBe(
        true,
      )
      expect(existsSync(evidence.temp)).toBe(false)
    },
  )

  it('runs fresh by default even with a green receipt, then permits explicit local resume', async () => {
    const cwd = fixture()
    const commands = ['printf x >> .ai/tmp/calls']
    await runGate({ cwd, commands })
    await runGate({ cwd, commands })
    expect(readFileSync(join(cwd, '.ai/tmp/calls'), 'utf8')).toBe('xx')
    await runGate({ cwd, commands, resume: true })
    expect(readFileSync(join(cwd, '.ai/tmp/calls'), 'utf8')).toBe('xx')
  })
})
