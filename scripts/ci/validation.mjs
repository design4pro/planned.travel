#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  rmdirSync,
  rmSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const git = (cwd, args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }).trim()

/** Preserve command order; a timed-out test project retries as four complete shards. */
export async function executeGate(
  commands,
  { run, previous = {}, record = () => {} },
) {
  if (
    !Array.isArray(commands) ||
    !commands.length ||
    commands.some(
      (c) =>
        typeof c !== 'string' ||
        !c.trim() ||
        /scripts\/ci\/(validation|attestation)\.mjs/.test(c),
    )
  )
    throw new Error('Gate must contain non-recursive validation commands')
  const entries = { ...previous }
  const results = []
  async function execute(command) {
    if (entries[command]?.exitCode === 0)
      return { command, ...entries[command], reused: true }
    const result = await run(command)
    entries[command] = result
    record(entries)
    return { command, ...result }
  }
  for (const command of commands) {
    const started = Date.now()
    const steps = []
    const jobs =
      command === 'pnpm test'
        ? [
            'pnpm exec vitest run --project server',
            'pnpm exec vitest run --project tooling',
            // The complete UI project exceeded this host's nine-minute budget; all four shards cover it.
            ...[1, 2, 3, 4].map(
              (n) => `pnpm exec vitest run --project ui --shard=${n}/4`,
            ),
          ]
        : [command]
    for (const job of jobs) {
      let result = entries[job]
      if (
        job.includes(' --shard=') ||
        !['timeout', 'killed'].includes(result?.result)
      )
        result = await execute(job)
      if (
        command === 'pnpm test' &&
        !job.includes(' --shard=') &&
        ['timeout', 'killed'].includes(result.result)
      ) {
        for (let shard = 1; shard <= 4; shard++) {
          result = await execute(`${job} --shard=${shard}/4`)
          steps.push(result)
          if (result.exitCode !== 0) break
        }
      } else steps.push(result)
      if (result.exitCode !== 0) break
    }
    const exitCode = steps.find((s) => s.exitCode !== 0)?.exitCode ?? 0
    results.push({
      command,
      exitCode,
      durationMs: Date.now() - started,
      steps,
    })
    if (exitCode !== 0) return { exitCode, commands: results }
  }
  return { exitCode: 0, commands: results }
}

/** Secret files are never opened. Environment values only enter this opaque local digest. */
export function gateFingerprint(cwd, commands) {
  const hash = createHash('sha256')
  const environment = Object.entries(process.env).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  for (const value of [
    cwd,
    git(cwd, ['rev-parse', 'HEAD^{tree}']),
    git(cwd, ['diff', 'HEAD', '--binary']),
    JSON.stringify(commands),
    JSON.stringify(process.versions),
    process.platform,
    process.arch,
    JSON.stringify(environment),
  ])
    hash.update(value).update('\0')
  const modules = join(cwd, 'node_modules/.modules.yaml')
  if (existsSync(modules)) hash.update(readFileSync(modules))
  return hash.digest('hex')
}

/** Own the process group so the timeout also stops child workers. */
export function runValidationCommand(
  command,
  { cwd, logPath, timeoutMs = 540_000 },
) {
  return new Promise((done, fail) => {
    const started = Date.now()
    // Keep command caches off the shared, inode-limited system temporary filesystem.
    const tempRoot = resolve(cwd, '.ai/tmp/validation')
    mkdirSync(tempRoot, { recursive: true, mode: 0o700 })
    const temp = mkdtempSync(join(tempRoot, 'tmp-'))
    const fd = openSync(logPath, 'w', 0o600)
    const child = spawn('bash', ['-o', 'pipefail', '-c', command], {
      cwd,
      env: { ...process.env, TMPDIR: temp, TMP: temp, TEMP: temp },
      detached: process.platform !== 'win32',
      stdio: ['ignore', fd, fd],
    })
    closeSync(fd)
    let timedOut = false
    let interrupted = false
    let force
    let finished = false
    const stop = (signal) => {
      if (!child.pid) return
      try {
        process.kill(
          process.platform === 'win32' ? child.pid : -child.pid,
          signal,
        )
      } catch (error) {
        if (error.code !== 'ESRCH') throw error
      }
    }
    const terminate = () => {
      stop('SIGTERM')
      force = setTimeout(() => stop('SIGKILL'), 5000)
    }
    const interrupt = () => {
      interrupted = true
      terminate()
    }
    process.once('SIGINT', interrupt)
    process.once('SIGTERM', interrupt)
    const timer = setTimeout(() => {
      timedOut = true
      terminate()
    }, timeoutMs)
    const finish = (code, signal) => {
      if (finished) return
      finished = true
      if (timedOut || interrupted) stop('SIGKILL')
      clearTimeout(timer)
      clearTimeout(force)
      process.removeListener('SIGINT', interrupt)
      process.removeListener('SIGTERM', interrupt)
      let result = code === 0 ? 'passed' : 'failed'
      let exitCode = code ?? 1
      if (code === 126 || code === 127) result = 'infrastructure'
      if (signal === 'SIGKILL' || code === 137) {
        result = 'killed'
        exitCode = 137
      }
      if (timedOut) {
        result = 'timeout'
        exitCode = 124
      }
      if (interrupted) {
        result = 'interrupted'
        exitCode = 130
      }
      try {
        rmSync(temp, { recursive: true })
      } catch (error) {
        fail(error)
        return
      }
      done({ exitCode, result, durationMs: Date.now() - started, logPath })
    }
    child.once('error', () => finish(127, null))
    child.once('close', finish)
  })
}

export async function runGate({
  cwd = process.cwd(),
  resume = false,
  commands,
} = {}) {
  const configured =
    commands ??
    JSON.parse(readFileSync(join(cwd, '.ai/agentic.config.json'), 'utf8'))
      .validation.commands
  if (configured.includes('pnpm test')) {
    const config = readFileSync(join(cwd, 'vitest.config.ts'), 'utf8')
    const projects = [...config.matchAll(/name:\s*['"]([^'"]+)['"]/g)]
      .map((m) => m[1])
      .sort()
    const test = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
      .scripts.test
    if (
      JSON.stringify(projects) !==
        JSON.stringify(['server', 'tooling', 'ui']) ||
      test !== 'vitest run'
    )
      throw new Error(
        'Test command/projects changed: update validation expansion before running',
      )
  }
  const state = join(cwd, '.ai/tmp/validation')
  mkdirSync(state, { recursive: true, mode: 0o700 })
  const lock = join(state, 'lock')
  try {
    mkdirSync(lock)
  } catch {
    const pid = Number(readFileSync(join(lock, 'pid'), 'utf8'))
    if (!Number.isSafeInteger(pid) || pid <= 0)
      throw new Error('Invalid validation lock')
    try {
      process.kill(pid, 0)
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
      unlinkSync(join(lock, 'pid'))
      rmdirSync(lock)
      mkdirSync(lock)
    }
    if (existsSync(join(lock, 'pid')))
      throw new Error('Validation already running in this worktree')
  }
  writeFileSync(join(lock, 'pid'), String(process.pid))
  try {
    const fingerprint = gateFingerprint(cwd, configured)
    const receiptPath = join(state, 'receipt.json')
    let previous = {}
    // shortcut: ignored fixtures/services are not fingerprinted; resume is local convenience, never CI evidence.
    if (resume && git(cwd, ['ls-files', '--others', '--exclude-standard']))
      throw new Error('Stage untracked files before resuming validation')
    if (resume && existsSync(receiptPath)) {
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
      if (receipt.fingerprint === fingerprint) previous = receipt.entries
    }
    const logs = mkdtempSync(join(state, 'run-'))
    let index = 0
    const result = await executeGate(configured, {
      previous,
      run: (command) =>
        runValidationCommand(command, {
          cwd,
          logPath: join(logs, `${++index}.log`),
        }),
      record: (entries) =>
        writeFileSync(receiptPath, JSON.stringify({ fingerprint, entries }), {
          mode: 0o600,
        }),
    })
    if (gateFingerprint(cwd, configured) !== fingerprint) {
      result.exitCode = 1
      result.error =
        'Validation inputs changed while the gate was running; run fresh'
      if (existsSync(receiptPath)) unlinkSync(receiptPath)
    }
    return {
      ...result,
      fingerprint,
      evidence: 'local-only; attestation always runs fresh',
      logs,
    }
  } finally {
    unlinkSync(join(lock, 'pid'))
    rmdirSync(lock)
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2)
  if (args.some((a) => a !== '--resume') || args.length > 1) {
    console.error('Usage: validation.mjs [--resume]')
    process.exitCode = 2
  } else
    runGate({ resume: args.includes('--resume') })
      .then((result) => {
        process.stdout.write(`${JSON.stringify(result)}\n`)
        process.exitCode = result.exitCode === 0 ? 0 : 1
      })
      .catch((error) => {
        console.error(`validation: ${error.message}`)
        process.exitCode = 1
      })
}
