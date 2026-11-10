import { execFileSync, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  executeGate,
  gateFingerprint,
  runGate,
  runValidationCommand,
} from '../validation.mjs'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, spawn: vi.fn(actual.spawn) }
})

const passed = { exitCode: 0, result: 'passed', durationMs: 1 }
const dirs = []
const retainedDirs = new Set()
const localEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
)
const inheritedGitEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => name.startsWith('GIT_')),
)
beforeEach(async () => {
  const actual = await vi.importActual('node:child_process')
  vi.mocked(spawn).mockReset().mockImplementation(actual.spawn)
  for (const name of Object.keys(inheritedGitEnv)) delete process.env[name]
})
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    if (!retainedDirs.has(dir)) rmSync(dir, { recursive: true, force: true })
  }
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
  it('isolates concurrent command temp files from the inherited host directory and cleans every outcome', async () => {
    const cwd = fixture()
    const inherited = process.env.TMPDIR
    process.env.TMPDIR = join(cwd, 'unavailable')
    try {
      const commands = ['exit 0', 'exit 7', 'sleep 30']
      const logs = commands.map((_, index) => join(cwd, `${index}.log`))
      const results = await Promise.all(
        commands.map((command, index) =>
          runValidationCommand(
            `printf '%s' "$TMPDIR"; test "$TMPDIR" = "$TMP" && test "$TMPDIR" = "$TEMP" && touch "$TMPDIR/probe" || exit 9; ${command}`,
            { cwd, logPath: logs[index], timeoutMs: 500 },
          ),
        ),
      )
      for (const result of results) {
        if (result.terminationError) {
          retainedDirs.add(cwd)
          process.stdout.write(
            `${JSON.stringify({ event: 'unverified-termination', ...result })}\n`,
          )
        }
      }
      expect(results.map((result) => result.exitCode)).toEqual([0, 7, 124])
      const paths = logs.map((log) => readFileSync(log, 'utf8'))
      expect(new Set(paths).size).toBe(3)
      for (const path of paths) {
        expect(path.startsWith(join(cwd, '.ai/tmp/validation/'))).toBe(true)
        expect(existsSync(path)).toBe(false)
      }
    } finally {
      if (inherited === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = inherited
    }
  })

  it('persists timeout EPERM diagnostics through the gate without shards or subsequent jobs', async () => {
    const cwd = fixture()
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ scripts: { test: 'vitest run' } }),
    )
    writeFileSync(
      join(cwd, 'vitest.config.ts'),
      "[{name: 'server'}, {name: 'tooling'}, {name: 'ui'}]",
    )
    const child = new EventEmitter()
    child.pid = 987654323
    const signals = ['SIGINT', 'SIGTERM']
    const listeners = signals.map((signal) => process.listeners(signal))
    const inheritedTemp = [
      process.env.TMPDIR,
      process.env.TMP,
      process.env.TEMP,
    ]
    vi.mocked(spawn).mockImplementation(() => {
      if (vi.mocked(spawn).mock.calls.length !== 1)
        throw new Error('Unexpected shard or subsequent job')
      return child
    })
    const kill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (pid !== -child.pid) throw new Error('Foreign process group targeted')
      if (signal === 'SIGKILL')
        throw Object.assign(new Error('injected gate post-close EPERM'), {
          code: 'EPERM',
        })
      return true
    })
    vi.useFakeTimers()
    try {
      // Real runGate -> executeGate -> runValidationCommand; only spawn/signals are synthetic.
      const pending = runGate({ cwd, commands: ['pnpm test', 'sentinel'] })
      const temporary = vi.mocked(spawn).mock.calls[0][2].env.TMPDIR
      writeFileSync(join(temporary, 'diagnostic'), 'retained evidence')
      await vi.advanceTimersByTimeAsync(540_000)
      expect(() => child.emit('close', 0, null)).not.toThrow()
      const result = await pending
      expect(result.exitCode).toBe(1)
      expect(result.error).toBeUndefined()
      expect(result.commands.map(({ command }) => command)).toEqual([
        'pnpm test',
      ])
      expect(vi.mocked(spawn).mock.calls.map(([, args]) => args)).toEqual([
        ['-o', 'pipefail', '-c', 'pnpm exec vitest run --project server'],
      ])
      const expected = {
        exitCode: 1,
        result: 'infrastructure',
        priorResult: 'timeout',
        pid: child.pid,
        pgid: -child.pid,
        temporary,
        terminationError: {
          code: 'EPERM',
          message: 'injected gate post-close EPERM',
          signal: 'SIGKILL',
          phase: 'close',
        },
      }
      expect(result.commands[0].exitCode).toBe(1)
      expect(result.commands[0].steps).toHaveLength(1)
      const step = result.commands[0].steps[0]
      expect(step).toMatchObject(expected)
      const state = join(cwd, '.ai/tmp/validation')
      const receipt = JSON.parse(
        readFileSync(join(state, 'receipt.json'), 'utf8'),
      )
      expect(receipt.fingerprint).toBe(result.fingerprint)
      expect(Object.keys(receipt.entries)).toEqual([
        'pnpm exec vitest run --project server',
      ])
      const entry = receipt.entries['pnpm exec vitest run --project server']
      expect(entry).toMatchObject(expected)
      const { command, ...recordedStep } = step
      expect(command).toBe('pnpm exec vitest run --project server')
      expect(entry).toEqual(recordedStep)
      expect(readFileSync(join(temporary, 'diagnostic'), 'utf8')).toBe(
        'retained evidence',
      )
      expect(existsSync(join(state, 'lock'))).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
      expect(signals.map((signal) => process.listeners(signal))).toEqual(
        listeners,
      )
      expect([process.env.TMPDIR, process.env.TMP, process.env.TEMP]).toEqual(
        inheritedTemp,
      )
      expect(kill.mock.calls).toEqual([
        [-child.pid, 'SIGTERM'],
        [-child.pid, 'SIGKILL'],
      ])
    } finally {
      vi.useRealTimers()
      kill.mockRestore()
      for (const [index, signal] of signals.entries()) {
        for (const listener of process.listeners(signal)) {
          if (!listeners[index].includes(listener))
            process.removeListener(signal, listener)
        }
      }
      // Only this synthetic fixture is removed by afterEach; no real group or denial directory exists.
    }
  })

  it('settles post-close EPERM as infrastructure failure and releases caller cleanup', async () => {
    const cwd = fixture()
    const child = new EventEmitter()
    child.pid = 987654321
    const signals = ['SIGINT', 'SIGTERM']
    const listeners = signals.map((signal) => process.listeners(signal))
    const inherited = process.env.TMPDIR
    const kill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (pid !== -child.pid) throw new Error('Foreign process group targeted')
      if (signal === 'SIGKILL') {
        throw Object.assign(new Error('injected post-close EPERM'), {
          code: 'EPERM',
        })
      }
      return true
    })
    vi.mocked(spawn).mockReturnValueOnce(child)
    vi.useFakeTimers()
    process.env.TMPDIR = join(cwd, 'unavailable')
    try {
      const pending = runValidationCommand('synthetic owned command', {
        cwd,
        logPath: join(cwd, 'command.log'),
        timeoutMs: 500,
      }).finally(() => {
        if (inherited === undefined) delete process.env.TMPDIR
        else process.env.TMPDIR = inherited
      })
      await vi.advanceTimersByTimeAsync(500)
      expect(() => child.emit('close', 0, null)).not.toThrow()
      const result = await pending
      expect(result.result).toBe('infrastructure')
      expect(result.exitCode).toBe(1)
      expect(result.terminationError).toEqual({
        code: 'EPERM',
        message: 'injected post-close EPERM',
        signal: 'SIGKILL',
        phase: 'close',
      })
      expect(result.pgid).toBe(-child.pid)
      expect(result.pid).toBe(child.pid)
      expect(result.priorResult).toBe('timeout')
      expect(vi.getTimerCount()).toBe(0)
      expect(signals.map((signal) => process.listeners(signal))).toEqual(
        listeners,
      )
      expect(process.env.TMPDIR).toBe(inherited)
      expect(existsSync(vi.mocked(spawn).mock.calls.at(-1)[2].env.TMPDIR)).toBe(
        true,
      )
      expect(result.temporary).toBe(
        vi.mocked(spawn).mock.calls.at(-1)[2].env.TMPDIR,
      )
      expect(kill.mock.calls).toEqual([
        [-child.pid, 'SIGTERM'],
        [-child.pid, 'SIGKILL'],
      ])
      kill.mockRestore()
      expect(existsSync(fixture())).toBe(true)
    } finally {
      vi.useRealTimers()
      kill.mockRestore()
      if (inherited === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = inherited
      for (const signal of signals) {
        for (const listener of process.listeners(signal)) {
          if (!listeners[signals.indexOf(signal)].includes(listener))
            process.removeListener(signal, listener)
        }
      }
    }
  })

  it.each(['SIGTERM', 'force SIGKILL'])(
    'settles a termination exception from %s without waiting for close',
    async (phase) => {
      const cwd = fixture()
      const child = new EventEmitter()
      child.pid = 987654322
      const listeners = ['SIGINT', 'SIGTERM'].map((signal) =>
        process.listeners(signal),
      )
      vi.mocked(spawn).mockReturnValueOnce(child)
      const kill = vi
        .spyOn(process, 'kill')
        .mockImplementation((pid, signal) => {
          expect(pid).toBe(-child.pid)
          if (phase === 'SIGTERM' || signal === 'SIGKILL') {
            throw Object.assign(new Error('injected termination failure'), {
              code: 'EPERM',
            })
          }
          return true
        })
      vi.useFakeTimers()
      try {
        const pending = runValidationCommand('synthetic owned command', {
          cwd,
          logPath: join(cwd, 'command.log'),
          timeoutMs: 500,
        })
        await vi.advanceTimersByTimeAsync(phase === 'SIGTERM' ? 500 : 5500)
        const result = await pending
        expect(result.result).toBe('infrastructure')
        expect(result.exitCode).toBe(1)
        expect(result.terminationError.code).toBe('EPERM')
        expect(result.pgid).toBe(-child.pid)
        expect(result.priorResult).toBe('timeout')
        expect(result.terminationError.phase).toBe(
          phase === 'SIGTERM' ? 'initial' : 'force',
        )
        expect(result.temporary).toBe(
          vi.mocked(spawn).mock.calls.at(-1)[2].env.TMPDIR,
        )
        expect(vi.getTimerCount()).toBe(0)
        expect(
          ['SIGINT', 'SIGTERM'].map((signal) => process.listeners(signal)),
        ).toEqual(listeners)
        expect(
          existsSync(vi.mocked(spawn).mock.calls.at(-1)[2].env.TMPDIR),
        ).toBe(true)
      } finally {
        vi.useRealTimers()
        kill.mockRestore()
        for (const [index, signal] of ['SIGINT', 'SIGTERM'].entries()) {
          for (const listener of process.listeners(signal)) {
            if (!listeners[index].includes(listener))
              process.removeListener(signal, listener)
          }
        }
      }
    },
  )

  it('terminates real owned descendants and excludes a foreign process group', async () => {
    const cwd = fixture()
    const foreign = spawn(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      {
        detached: true,
        stdio: 'ignore',
        env: { PATH: process.env.PATH },
      },
    )
    const foreignEnded = new Promise((resolve) =>
      foreign.once('close', resolve),
    )
    const originalKill = process.kill.bind(process)
    const kill = vi.spyOn(process, 'kill')
    writeFileSync(
      join(cwd, 'owned.cjs'),
      `
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', env: { PATH: process.env.PATH } });
      process.on('SIGTERM', () => {});
      child.once('exit', () => process.exit(0));
      process.stdout.write(JSON.stringify({ parent: process.pid, child: child.pid }));
    `,
    )
    try {
      const logPath = join(cwd, 'command.log')
      const result = await runValidationCommand('exec node owned.cjs', {
        cwd,
        logPath,
        timeoutMs: 500,
      })
      const owned = JSON.parse(readFileSync(logPath, 'utf8'))
      process.stdout.write(
        `${JSON.stringify({ event: 'owned-fixture', ...owned, foreign: foreign.pid, result })}\n`,
      )
      expect(result.result).toBe('timeout')
      expect(result.exitCode).toBe(124)
      const targets = kill.mock.calls.map(([pid]) => pid)
      expect(targets.length).toBeGreaterThan(0)
      expect(targets.every((pid) => pid === -owned.parent)).toBe(true)
      expect(targets).not.toContain(-foreign.pid)
      kill.mockRestore()
      for (const pid of [owned.parent, owned.child]) {
        expect(() => originalKill(pid, 0)).toThrow(
          expect.objectContaining({ code: 'ESRCH' }),
        )
      }
      expect(originalKill(foreign.pid, 0)).toBe(true)
    } finally {
      kill.mockRestore()
      try {
        originalKill(-foreign.pid, 'SIGTERM')
      } catch (error) {
        if (error.code !== 'ESRCH') throw error
      } finally {
        await foreignEnded
      }
    }
  })

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
