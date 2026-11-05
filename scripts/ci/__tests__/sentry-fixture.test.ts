import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { resolve as resolvePath } from 'node:path'
import { request } from 'node:http'
import { once } from 'node:events'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createFeedbackCollector,
  feedbackWebServers,
  FIXTURE_SENTRY_DSN,
  MAX_ENVELOPE_BYTES,
  REQUEST_TIMEOUT_MS,
} from '../sentry-fixture'

describe('CI feedback prerequisite', () => {
  it('configures reporting for the E2E build and passes its fixture identity to Playwright', () => {
    const action = readFileSync('.github/actions/e2e-env/action.yml', 'utf8')
    expect(action).toContain(
      'VITE_SENTRY_DSN="$fixture_dsn" pnpm exec vite build',
    )
    expect(action).toContain('E2E_SENTRY_DSN=%s')
    for (const file of ['deploy.yml', 'deploy-staging.yml']) {
      const deploy = readFileSync(`.github/workflows/${file}`, 'utf8')
      expect(deploy).toContain('VITE_SENTRY_DSN: ${{ vars.VITE_SENTRY_DSN }}')
      expect(deploy).not.toContain('E2E_SENTRY_DSN')
    }
  })
})

describe('required feedback journey', () => {
  it('keeps baseline shards separate and requires the SDK job in the aggregate', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
    const action = readFileSync('.github/actions/e2e-env/action.yml', 'utf8')
    const journey = readFileSync('e2e/day-detail.spec.ts', 'utf8')
    expect(action).toContain("if [ '${{ inputs.feedback }}' = 'true' ]")
    expect(action).toContain('VITE_SENTRY_DSN= pnpm exec vite build')
    expect(workflow).toContain('--grep-invert @feedback-sdk --shard=')
    expect(workflow).toContain('--project=chromium --grep @feedback-sdk')
    expect(workflow).toContain("feedback: 'true'")
    expect(workflow).toContain(
      'needs: [scope, e2e, e2e-feedback, verify, test]',
    )
    expect(workflow).toContain('[ "$FEEDBACK_RESULT" = success ]')
    expect(workflow).toContain('[ "$FEEDBACK_RESULT" = skipped ]')
    expect(journey).toContain('{ width: 720, height: 450 }')
    expect(journey).toContain('{ width: 360, height: 450 }')
    expect(journey).toContain(
      'request.postData()?.includes(\'"type":"feedback"\')',
    )
  })
})

describe('fixture activation', () => {
  it('leaves ordinary local and deployed-preview runs alone', () => {
    expect(feedbackWebServers(undefined, 'http://localhost:3030')).toEqual([])
    expect(
      feedbackWebServers(undefined, 'https://preview.example.com'),
    ).toEqual([])
  })
  it('owns a separate collector even with an externally started local app', () => {
    const [config] = feedbackWebServers(
      FIXTURE_SENTRY_DSN,
      'http://localhost:3030',
    )
    expect(config?.env).toEqual({
      E2E_SENTRY_DSN: FIXTURE_SENTRY_DSN,
      PLAYWRIGHT_BASE_URL: 'http://localhost:3030',
    })
    expect(config?.url).toBe(
      new URL('/health', FIXTURE_SENTRY_DSN.replace('public@', '')).href,
    )
    expect(config?.reuseExistingServer).toBe(false)
    expect(config?.gracefulShutdown).toEqual({
      signal: 'SIGTERM',
      timeout: 2000,
    })
  })
  it('refuses foreign DSNs and remote or credential-bearing fixture origins', () => {
    expect(() =>
      feedbackWebServers('https://key@example.com/1', 'http://localhost:3000'),
    ).toThrow()
    for (const origin of [
      'https://localhost:3000',
      'http://example.com:3000',
      'http://user@localhost:3000',
    ]) {
      expect(() => feedbackWebServers(FIXTURE_SENTRY_DSN, origin)).toThrow()
    }
  })
})

describe('discard-only collector boundary', () => {
  let server: ReturnType<typeof createFeedbackCollector>
  let url: string
  const origin = 'http://localhost:3000'
  beforeEach(async () => {
    server = createFeedbackCollector(origin)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string')
      throw new Error('Missing listener')
    expect(address.address).toBe('127.0.0.1')
    url = `http://127.0.0.1:${address.port}`
  })
  afterEach(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })
  it('accepts only a narrow preflight and discards opaque envelopes without echo', async () => {
    expect((await fetch(url + '/health')).status).toBe(200)
    const preflight = await fetch(url + '/api/1/envelope/?sentry_key=public', {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers':
          'content-type,x-pt-server-today,sentry-trace,baggage',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe(origin)
    expect(preflight.headers.has('access-control-allow-credentials')).toBe(
      false,
    )
    const response = await fetch(url + '/api/1/envelope/?sentry_key=public', {
      method: 'POST',
      headers: { origin },
      body: 'opaque data that must not be parsed or retained',
    })
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect((await fetch(url + '/api/1/envelope/')).status).toBe(405)
  })
  it.each([
    ['/api/2/envelope/', 'POST', { origin }, 404],
    ['/health', 'POST', { origin }, 404],
    ['/api/1/envelope/', 'PUT', { origin }, 405],
    ['/api/1/envelope/', 'POST', {}, 403],
    ['/api/1/envelope/', 'POST', { origin: 'https://foreign.example' }, 403],
    [
      '/api/1/envelope/',
      'OPTIONS',
      { origin, 'access-control-request-method': 'DELETE' },
      403,
    ],
    [
      '/api/1/envelope/',
      'OPTIONS',
      {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization',
      },
      403,
    ],
  ])(
    'rejects unsupported request %s %s %j',
    async (path, method, headers, expected) => {
      const response = await fetch(url + path, { method, headers })
      expect(response.status).toBe(expected)
      expect(await response.text()).toBe('')
    },
  )
  it('rejects a body beyond the bound', async () => {
    const response = await fetch(url + '/api/1/envelope/', {
      method: 'POST',
      headers: { origin },
      body: Buffer.alloc(MAX_ENVELOPE_BYTES + 1),
    })
    expect(response.status).toBe(413)
  })
  it('survives an aborted upload without exposing its contents', async () => {
    const upload = request(url + '/api/1/envelope/', {
      method: 'POST',
      headers: { origin },
    })
    upload.on('error', () => {})
    const received = once(server, 'request')
    upload.write('incomplete envelope')
    await received
    const closed = new Promise<void>((resolve) => upload.once('close', resolve))
    upload.destroy()
    await closed
    expect((await fetch(url + '/health')).status).toBe(200)
  })
  it('bounds an unfinished request lifetime', async () => {
    const start = Date.now()
    await new Promise<void>((resolve, reject) => {
      const upload = request(
        url + '/api/1/envelope/',
        { method: 'POST', headers: { origin } },
        (response) => {
          expect(response.statusCode).toBe(408)
          response.resume()
          resolve()
        },
      )
      upload.on('error', (error) => {
        if ('code' in error && error.code === 'ECONNRESET') resolve()
        else reject(error)
      })
      upload.write('never completed')
    })
    expect(Date.now() - start).toBeLessThan(REQUEST_TIMEOUT_MS + 2000)
    expect((await fetch(url + '/health')).status).toBe(200)
  }, 10000)
})

describe('collector process ownership', () => {
  it('shares the literal build DSN with the runner without exporting it to production', () => {
    expect(
      execFileSync(
        process.execPath,
        ['scripts/ci/sentry-fixture.ts', '--dsn'],
        { encoding: 'utf8', timeout: 10000 },
      ).trim(),
    ).toBe(FIXTURE_SENTRY_DSN)
    const action = readFileSync('.github/actions/e2e-env/action.yml', 'utf8')
    expect(action).toContain(
      'fixture_dsn=$(node scripts/ci/sentry-fixture.ts --dsn)',
    )
    expect(action).not.toContain('VITE_SENTRY_DSN=%s')
  })
  it('fails on an occupied collector port without disturbing its owner', async () => {
    const owner = createFeedbackCollector('http://localhost:3000')
    owner.listen(4318, '127.0.0.1')
    await once(owner, 'listening')
    try {
      const child = spawn(process.execPath, ['scripts/ci/sentry-fixture.ts'], {
        stdio: 'ignore',
        timeout: 10000,
        env: {
          ...process.env,
          E2E_SENTRY_DSN: FIXTURE_SENTRY_DSN,
          PLAYWRIGHT_BASE_URL: 'http://localhost:3000',
        },
      })
      const [code] = await once(child, 'exit')
      expect(code).toBe(1)
      expect((await fetch('http://127.0.0.1:4318/health')).status).toBe(200)
    } finally {
      owner.closeAllConnections()
      await new Promise<void>((resolve) => owner.close(() => resolve()))
    }
  })
  it.each(['success', 'failure', 'interruption'])(
    'Playwright releases its collector after %s',
    async (mode) => {
      mkdirSync('.ai/tmp', { recursive: true })
      const dir = mkdtempSync(resolvePath('.ai/tmp/sentry-lifecycle-'))
      const root = process.cwd()
      writeFileSync(
        dir + '/probe.spec.js',
        `import { test } from '@playwright/test'; test('collector lifecycle', async () => { if (process.env.FIXTURE_TEST_MODE === 'failure') throw new Error('Expected lifecycle failure'); if (process.env.FIXTURE_TEST_MODE === 'interruption') await new Promise(r => setTimeout(r, 30000)); });`,
      )
      writeFileSync(
        dir + '/playwright.config.ts',
        `import { feedbackWebServers, FIXTURE_SENTRY_DSN } from ${JSON.stringify(resolvePath('scripts/ci/sentry-fixture.ts'))}; export default { testDir: '.', retries: 0, workers: 1, reporter: 'line', outputDir: './results', webServer: feedbackWebServers(FIXTURE_SENTRY_DSN, 'http://localhost:3000').map(server => ({...server, cwd: ${JSON.stringify(root)}})) };`,
      )
      const child = spawn(
        process.execPath,
        [
          'node_modules/@playwright/test/cli.js',
          'test',
          '--config',
          dir + '/playwright.config.ts',
        ],
        {
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, FIXTURE_TEST_MODE: mode },
        },
      )
      let output = ''
      child.stdout.on('data', (bytes) => {
        output += bytes
      })
      child.stderr.on('data', (bytes) => {
        output += bytes
      })
      const exited = once(child, 'exit')
      try {
        if (mode === 'interruption') {
          let ready = false
          for (let attempt = 0; attempt < 100; attempt++) {
            try {
              ready = (await fetch('http://127.0.0.1:4318/health')).ok
            } catch {}
            if (ready) break
            await new Promise((resolve) => setTimeout(resolve, 50))
          }
          expect(ready, output).toBe(true)
          child.kill('SIGINT')
        }
        const [code] = await exited
        expect(code, output).toBe(
          mode === 'success' ? 0 : mode === 'failure' ? 1 : 130,
        )
        await expect(fetch('http://127.0.0.1:4318/health')).rejects.toThrow()
      } finally {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGTERM')
          await exited
        }
        rmSync(dir, { recursive: true, force: true })
      }
    },
    15000,
  )
})
