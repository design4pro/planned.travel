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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Not kill(pid, 0) alone: a killed child nobody reaps stays a zombie, and that still succeeds on it.
import { live, processInfo } from '../dev-server-process.mjs'

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
      process.kill(child, 'SIGCONT')
      process.kill(child, 'SIGTERM')
    } catch {}
  }
  await vi.waitFor(() =>
    expect([...children].every((child) => !live(child))).toBe(true),
  )
  children.clear()
  rmSync(root, { recursive: true, force: true })
})

describe('test environment lifecycle', () => {
  it.each(['test environment', 'bootstrap'])(
    '%s waits for the launched process to exec Vite before recording it',
    async (caller) => {
      if (caller === 'bootstrap') {
        copyFileSync(
          resolve('scripts/worktree/bootstrap.sh'),
          join(root, 'scripts/worktree/bootstrap.sh'),
        )
        mkdirSync(join(root, 'node_modules/.bin'), { recursive: true })
        const d1 = join(
          root,
          '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
        )
        mkdirSync(d1, { recursive: true })
        writeFileSync(join(d1, 'local.sqlite'), 'fixture')
        stub('sqlite3', 'echo 1')
      }
      writeFileSync(
        join(root, 'observe-wait.cjs'),
        `
      const timers = require('node:timers/promises');
      const original = timers.setTimeout;
      timers.setTimeout = (...args) => { require('node:fs').writeFileSync('record-waiting', ''); return original(...args) };
      require('node:module').syncBuiltinESMExports();
    `,
      )
      stub(
        'node',
        `if [ "$1" = node_modules/vite/bin/vite.js ]; then exec /bin/sh -c 'echo $$ > "$PWD/launch-pid"; kill -STOP $$; exec "$@"' wrapper "${process.execPath}" "$@"; fi
if [ "$2" = record ]; then NODE_OPTIONS="--require $PWD/observe-wait.cjs"; export NODE_OPTIONS; fi
exec "${process.execPath}" "$@"`,
      )
      let failure
      const result = (
        caller === 'bootstrap'
          ? exec(
              'bash',
              [join(root, 'scripts/worktree/bootstrap.sh'), '--port', '0'],
              {
                cwd: root,
                env: env(),
                timeout: 15000,
              },
            )
          : run()
      ).catch((error) => {
        failure = error
      })
      await vi.waitFor(() => {
        expect(existsSync(join(root, 'launch-pid'))).toBe(true)
      })
      const launched = Number(readFileSync(join(root, 'launch-pid'), 'utf8'))
      children.add(launched)
      try {
        await vi.waitFor(() => {
          if (failure) throw failure
          expect(existsSync(join(root, 'record-waiting'))).toBe(true)
        })
        process.kill(launched, 'SIGCONT')
        await result
        if (failure) throw failure
        expect(pid()).toBe(launched)
      } finally {
        process.kill(launched, 'SIGCONT')
      }
    },
  )

  it('rejects a launched process that never becomes identifiable without signalling it', async () => {
    stub(
      'node',
      `if [ "$1" = node_modules/vite/bin/vite.js ]; then exec "${process.execPath}" -e 'setInterval(() => {}, 1000)' /tmp/vite.js dev; fi
exec "${process.execPath}" "$@"`,
    )
    await expect(run()).rejects.toThrow('Cannot identify started Vite pid')
    const launched = pid()
    children.add(launched)
    expect(live(launched)).toBe(true)
    expect(existsSync(join(root, '.ai/qa/dev-server-process.json'))).toBe(false)
  })

  it('records and stops a Vite process whose script path contains spaces', async () => {
    const directory = join(root, 'path with spaces')
    mkdirSync(directory)
    const script = join(directory, 'vite.js')
    writeFileSync(script, 'setInterval(() => {}, 1000)')
    const child = spawn(process.execPath, [script, 'dev'], {
      cwd: root,
      stdio: 'ignore',
    })
    children.add(child.pid)
    await vi.waitFor(() =>
      expect(processInfo(child.pid).command).toContain('vite.js dev'),
    )
    const record = exec(
      process.execPath,
      [
        join(root, '.ai/scripts/dev-server-process.mjs'),
        'record',
        String(child.pid),
        '3030',
      ],
      { cwd: root },
    )
    if (process.platform !== 'linux') {
      await expect(record).rejects.toThrow('Cannot identify started Vite pid')
      expect(live(child.pid)).toBe(true)
      expect(existsSync(join(root, '.ai/qa/dev-server-process.json'))).toBe(
        false,
      )
      return
    }
    await record
    await exec(
      process.execPath,
      [join(root, '.ai/scripts/dev-server-process.mjs'), 'stop'],
      { cwd: root },
    )
    expect(live(child.pid)).toBe(false)
  })
  it.each([0, 1])(
    'aligns the selected origin before boot when provisioning check returns %s',
    async (checkStatus) => {
      writeFileSync(join(root, 'fixture-origin'), 'http://localhost:3001')
      writeFileSync(
        join(root, 'scripts/worktree/bootstrap.sh'),
        `#!/bin/sh
if [ "$1" = --check ]; then exit ${checkStatus}; fi
while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) shift 2 ;;
    --no-seed) shift ;;
    --port) port="$2"; shift 2 ;;
    --host) host="$2"; shift 2 ;;
    *) exit 2 ;;
  esac
done
[ -n "$host" ] && [ -n "$port" ] || exit 2
printf 'http://%s:%s' "$host" "$port" > fixture-origin
`,
      )
      writeFileSync(
        join(root, 'node_modules/vite/bin/vite.js'),
        "const fs = require('node:fs'); fs.copyFileSync('fixture-origin', 'boot-origin'); setInterval(() => {}, 1000)",
      )
      await run()
      const descriptor = JSON.parse(
        readFileSync(join(root, '.ai/qa/test-env.json'), 'utf8'),
      )
      expect(descriptor.baseUrl).toBe('http://127.0.0.1:3030')
      await expect.poll(() => existsSync(join(root, 'boot-origin'))).toBe(true)
      expect(readFileSync(join(root, 'boot-origin'), 'utf8')).toBe(
        descriptor.baseUrl,
      )
    },
  )

  it('does not start or seed when provisioning refuses the selected origin', async () => {
    writeFileSync(
      join(root, 'scripts/worktree/bootstrap.sh'),
      '#!/bin/sh\nexit 1\n',
    )
    writeFileSync(
      join(root, 'scripts/seed/seed.mjs'),
      "import { writeFileSync } from 'node:fs'; writeFileSync('seed-ran', '')",
    )
    await expect(run()).rejects.toThrow()
    expect(existsSync(join(root, '.ai/qa/dev-server.pid'))).toBe(false)
    expect(existsSync(join(root, 'seed-ran'))).toBe(false)
    expect(existsSync(join(root, '.ai/qa/test-env.json'))).toBe(false)
  })

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

  it('refuses a legacy pnpm PID and leaves its Vite child alive', async () => {
    mkdirSync(join(root, 'node_modules/.bin'))
    writeFileSync(join(root, 'package.json'), '{}')
    const executable = join(root, 'node_modules/.bin/vite')
    writeFileSync(
      executable,
      '#!/bin/sh\nexec node node_modules/vite/bin/vite.js "$@"\n',
    )
    chmodSync(executable, 0o755)
    writeFileSync(
      join(root, 'node_modules/vite/bin/vite.js'),
      'console.log(process.pid); setInterval(() => {}, 1000)',
    )
    const wrapper = spawn('pnpm', ['exec', 'vite', 'dev'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    children.add(wrapper.pid)
    const [data] = await once(wrapper.stdout, 'data')
    const child = Number(data.toString().trim())
    children.add(child)
    writeFileSync(join(root, '.ai/qa/dev-server.pid'), `${wrapper.pid}\n`)
    await expect(run('--force')).rejects.toThrow(
      'Refusing to signal unverified pid',
    )
    expect(live(wrapper.pid)).toBe(true)
    expect(live(child)).toBe(true)
  })

  it('refuses a legacy PID matching Vite in this checkout', async () => {
    const child = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', 'dev'],
      { cwd: root, stdio: 'ignore' },
    )
    children.add(child.pid)
    await vi.waitFor(() =>
      expect(processInfo(child.pid).command).toContain('vite.js dev'),
    )
    writeFileSync(join(root, '.ai/qa/dev-server.pid'), `${child.pid}\n`)
    await expect(run('--force')).rejects.toThrow(
      'Refusing to signal unverified pid',
    )
    expect(live(child.pid)).toBe(true)
  })

  it('does not signal a foreign process that imitates a pnpm wrapper and its Vite child', async () => {
    const wrapper = spawn(
      process.execPath,
      [
        '-e',
        `
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'dev'], { stdio: 'ignore' });
      console.log(child.pid); child.on('exit', () => process.exit(0));
    `,
        'pnpm',
        'exec',
        'vite',
        'dev',
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] },
    )
    children.add(wrapper.pid)
    const [data] = await once(wrapper.stdout, 'data')
    const child = Number(data.toString().trim())
    children.add(child)
    await vi.waitFor(() =>
      expect(processInfo(child).command).toContain('vite.js dev'),
    )
    writeFileSync(join(root, '.ai/qa/dev-server.pid'), `${wrapper.pid}\n`)
    await expect(run('--force')).rejects.toThrow(
      'Refusing to signal unverified pid',
    )
    expect(live(wrapper.pid)).toBe(true)
    expect(live(child)).toBe(true)
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
