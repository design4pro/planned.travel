import { once } from 'node:events'
import { execFile, spawn } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Not kill(pid, 0) alone: a killed child nobody reaps stays a zombie, and that still succeeds on it.
import { live } from '../dev-server-process.mjs'

// Each case boots real child processes; bounded CLI waits must finish before Vitest times out.
vi.setConfig({ testTimeout: 15_000 })

const exec = promisify(execFile)
const scripts = resolve('.ai/scripts')
let root
const children = new Set()
const stub = (name, body) => {
  const path = join(root, 'bin', name)
  writeFileSync(path, `#!/bin/sh\n${body}\n`)
  chmodSync(path, 0o755)
}
const env = () => ({ PATH: `${root}/bin:${process.env.PATH}`, HOME: root })
const run = (...args) =>
  exec('sh', [join(root, '.ai/scripts/test-env-up.sh'), ...args], {
    cwd: root,
    env: env(),
    timeout: 15000,
  })
const pid = () =>
  Number(readFileSync(join(root, '.ai/qa/dev-server.pid'), 'utf8'))

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'test-env-lifecycle-'))
  for (const dir of [
    'bin',
    '.ai/scripts',
    '.ai/qa',
    'src',
    'scripts/worktree',
    'scripts/seed',
    'node_modules/vite/bin',
  ])
    mkdirSync(join(root, dir), { recursive: true })
  for (const name of readdirSync(scripts).filter(
    (name) => name.endsWith('.mjs') || name === 'test-env-up.sh',
  ))
    copyFileSync(join(scripts, name), join(root, '.ai/scripts', name))
  writeFileSync(join(root, '.ai/scripts/free-port.mjs'), 'console.log(3030)')
  writeFileSync(
    join(root, 'scripts/worktree/bootstrap.sh'),
    '#!/bin/sh\nexit 0\n',
  )
  writeFileSync(join(root, 'scripts/seed/seed.mjs'), '')
  writeFileSync(join(root, 'scripts/seed/verify.mjs'), '')
  writeFileSync(join(root, '.gitignore'), '.ai/qa/test-env.env\n')
  writeFileSync(
    join(root, 'node_modules/vite/bin/vite.js'),
    'setInterval(() => {}, 1000)',
  )
  stub('git', 'pwd')
  stub('curl', 'exit 0')
  stub(
    'pnpm',
    `if [ "$2" = vite ]; then shift 2; exec node "$PWD/node_modules/vite/bin/vite.js" "$@"; fi\necho "Version 1.62.1"`,
  )
})

afterEach(async () => {
  const path = join(root, '.ai/qa/dev-server.pid')
  if (existsSync(path)) children.add(Number(readFileSync(path, 'utf8')))
  for (const child of children) {
    try {
      process.kill(child, 'SIGTERM')
    } catch {}
  }
  children.clear()
  await sleep(50)
  rmSync(root, { recursive: true, force: true })
})

describe('test environment lifecycle', () => {
  it.each(['--force', '--force-rebuild'])(
    'replaces its predecessor under %s instead of leaking it',
    async (flag) => {
      await run()
      const previous = pid()
      children.add(previous)
      expect(live(previous)).toBe(true)
      await run(flag)
      expect(pid()).not.toBe(previous)
      expect(live(previous)).toBe(false)
    },
    15000,
  )

  it('reuses its healthy, identified server', async () => {
    await run()
    const previous = pid()
    const result = await run()
    expect(pid()).toBe(previous)
    expect(result.stdout).toContain('TEST_ENV_REUSED=1')
  })

  it('retires a recorded bootstrap server without a test descriptor', async () => {
    await run()
    const previous = pid()
    children.add(previous)
    rmSync(join(root, '.ai/qa/test-env.json'))
    await run('--force')
    expect(live(previous)).toBe(false)
  })

  it('does not reuse an old descriptor after bootstrap changed the owned port', async () => {
    await run()
    const previous = pid()
    children.add(previous)
    const recordPath = join(root, '.ai/qa/dev-server-process.json')
    const record = JSON.parse(readFileSync(recordPath, 'utf8'))
    writeFileSync(recordPath, JSON.stringify({ ...record, port: 3001 }))
    const result = await run()
    expect(result.stdout).toContain('TEST_ENV_REUSED=0')
    expect(pid()).not.toBe(previous)
    expect(live(previous)).toBe(false)
  })

  it('refuses a recycled PID whose process start time does not match', async () => {
    await run()
    const previous = pid()
    const recordPath = join(root, '.ai/qa/dev-server-process.json')
    const record = JSON.parse(readFileSync(recordPath, 'utf8'))
    writeFileSync(
      recordPath,
      JSON.stringify({ ...record, started: 'a different process' }),
    )
    await expect(run('--force')).rejects.toThrow()
    expect(live(previous)).toBe(true)
    expect(pid()).toBe(previous)
  })

  it('retires the verified Vite child of a legacy pnpm PID', async () => {
    const wrapperPath = join(root, 'bin/pnpm-wrapper.mjs')
    writeFileSync(
      wrapperPath,
      `import { spawn } from 'node:child_process';
      const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'dev'], { stdio: 'ignore' });
      console.log(child.pid); child.on('exit', () => process.exit(0));`,
    )
    const wrapper = spawn(
      process.execPath,
      [wrapperPath, 'exec', 'vite', 'dev'],
      { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] },
    )
    children.add(wrapper.pid)
    const [data] = await once(wrapper.stdout, 'data')
    const child = Number(data.toString().trim())
    children.add(child)
    writeFileSync(join(root, '.ai/qa/dev-server.pid'), `${wrapper.pid}\n`)
    await run('--force')
    expect(live(wrapper.pid)).toBe(false)
    expect(live(child)).toBe(false)
  })

  it('does not start a second server when its predecessor refuses SIGTERM', async () => {
    writeFileSync(
      join(root, 'node_modules/vite/bin/vite.js'),
      "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)",
    )
    await run()
    const previous = pid()
    try {
      await expect(run('--force')).rejects.toThrow('did not stop')
      expect(pid()).toBe(previous)
      expect(live(previous)).toBe(true)
    } finally {
      process.kill(previous, 'SIGKILL')
    }
  }, 15000)

  it('does not signal a foreign process named by a stale descriptor', async () => {
    const foreign = spawn(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      { cwd: tmpdir(), stdio: 'ignore' },
    )
    children.add(foreign.pid)
    writeFileSync(join(root, '.ai/qa/dev-server.pid'), `${foreign.pid}\n`)
    writeFileSync(
      join(root, '.ai/qa/test-env.json'),
      JSON.stringify({ status: 'running', app: { pid: foreign.pid } }),
    )
    await expect(run('--force')).rejects.toThrow()
    expect(live(foreign.pid)).toBe(true)
    expect(pid()).toBe(foreign.pid)
  })
})
