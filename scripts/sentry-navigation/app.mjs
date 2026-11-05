import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { chromium, webkit } from '@playwright/test'
import { createBuilder, preview } from 'vite'
import { watchConsole } from '../../e2e/helpers/console.ts'
import { startCollector } from './collector.mjs'
import { diagnosticSnapshot } from './observe.mjs'

const [revision, phase, descriptorPath] = process.argv.slice(2)
assert.ok(
  ['prepare', 'probe', 'cleanup'].includes(phase),
  'Pass prepare, probe or cleanup and an artifact JSON path',
)
assert.ok(
  descriptorPath &&
    dirname(resolve(descriptorPath)) === resolve(tmpdir()) &&
    descriptorPath.endsWith('.json'),
  'Artifact metadata must be in TMPDIR',
)
const artifact =
  phase !== 'prepare'
    ? JSON.parse(await readFile(descriptorPath, 'utf8'))
    : null
if (artifact) assert.equal(artifact.revision, revision)
assert.match(revision ?? '', /^[a-f0-9]{40}$/, 'Pass one full source revision')
const origin =
  artifact?.origin ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3039'
assert.match(origin, /^http:\/\/127\.0\.0\.1:30(?:3[0-9]|40)$/)
const port = Number(new URL(origin).port)
const root = process.cwd()
const snapshot = resolve(
  artifact?.snapshot ?? (await mkdtemp(resolve(tmpdir(), 'sentry-app-'))),
)
assert.ok(
  dirname(snapshot) === resolve(tmpdir()) &&
    snapshot.startsWith(resolve(tmpdir(), 'sentry-app-')),
)
if (phase === 'cleanup') {
  await rm(snapshot, { recursive: true, force: true })
  await rm(descriptorPath, { force: true })
  process.stdout.write(
    JSON.stringify({ revision, phase, removed: true }) + '\n',
  )
  process.exit(0)
}
const output = {
  revision,
  phase,
  clientBuild: artifact?.clientBuild,
  kind: 'full-application-with-passive-transport-observation',
  trials: [],
  failure: null,
}
const waitFor = async (predicate) => {
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    assert.ok(
      Date.now() < deadline,
      'Timed out waiting for correlated observation',
    )
    await new Promise((done) => setTimeout(done, 20))
  }
}
// Same fiber predicate as settle.ts, inline because tsx adds unserializable name helpers there.
function hydratedMain() {
  const main = document.querySelector('main')
  const nodes = main?.querySelectorAll('*')
  return [main, nodes?.item(nodes.length - 1) ?? main].every(
    (node) =>
      node && Object.keys(node).some((key) => key.startsWith('__reactFiber$')),
  )
}
assert.equal(hydratedMain.toString().includes('__name'), false)
let collector
let server
let browser
let active
let first = 0
try {
  if (phase === 'prepare') {
    const archive = resolve(snapshot, 'source.tar')
    execFileSync(
      'git',
      [
        'archive',
        '-o',
        archive,
        revision,
        'src',
        'public',
        'drizzle',
        'package.json',
        'pnpm-lock.yaml',
        'tsconfig.json',
        'vite.config.ts',
        'wrangler.jsonc',
        'e2e/fixture-day.ts',
      ],
      { timeout: 30_000 },
    )
    execFileSync('tar', ['-xf', archive, '-C', snapshot], { timeout: 30_000 })
    await rm(archive)
    await symlink(
      resolve(root, 'node_modules'),
      resolve(snapshot, 'node_modules'),
      'dir',
    )
    await mkdir(resolve(snapshot, '.ai/qa'), { recursive: true })
    // The snapshot contains no copied credentials, users or browser state.
    await writeFile(
      resolve(snapshot, '.dev.vars'),
      `BETTER_AUTH_SECRET=synthetic-navigation-only-not-a-real-secret-1849\nENVIRONMENT=development\nAPP_URL=${origin}\n`,
    )
  }
  const lock = await readFile(resolve(snapshot, 'pnpm-lock.yaml'), 'utf8')
  assert.equal(
    lock,
    await readFile(resolve(root, 'pnpm-lock.yaml'), 'utf8'),
    'Rebuild requires the matching installed lockfile',
  )
  const sdk = JSON.parse(
    await readFile(
      resolve(root, 'node_modules/@sentry/react/package.json'),
      'utf8',
    ),
  ).version
  assert.ok(
    lock.includes(
      `'@sentry/react':\n        specifier: ^${sdk}\n        version: ${sdk}(`,
    ),
  )
  output.sdk = sdk
  output.sourceHashes = {}
  for (const file of [
    'src/client.tsx',
    'src/router.tsx',
    'src/lib/sentry-scrub.ts',
    'src/lib/sentry-replay.ts',
  ]) {
    output.sourceHashes[file] = createHash('sha256')
      .update(await readFile(resolve(snapshot, file)))
      .digest('hex')
  }
  // The reserved port is exclusive: preview's strictPort refuses an occupied listener.
  let collectorPort = artifact?.collectorPort
  if (!collectorPort) {
    const reservation = createServer()
    await new Promise((done) => reservation.listen(0, '127.0.0.1', done))
    collectorPort = reservation.address().port
    await new Promise((done) => reservation.close(done))
  }
  assert.ok(
    Number.isInteger(collectorPort) &&
      collectorPort > 0 &&
      collectorPort < 65536,
  )
  const collectorOrigin = `http://127.0.0.1:${collectorPort}`
  Object.assign(process.env, {
    E2E: '1',
    E2E_BUILD: '1',
    SENTRY_AUTH_TOKEN: '',
    CLOUDFLARE_API_TOKEN: '',
    WRANGLER_SEND_METRICS: 'false',
  })
  const config = {
    root: snapshot,
    configFile: resolve(snapshot, 'vite.config.ts'),
    envFile: false,
    logLevel: 'warn',
    define: {
      'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(
        `${collectorOrigin.replace('http://', 'http://synthetic@')}/1`,
      ),
      'import.meta.env.VITE_ENVIRONMENT': JSON.stringify('staging'),
      'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(revision),
    },
    plugins: [
      {
        name: 'read-only-diagnostic-exposure',
        enforce: 'pre',
        transform(code, id) {
          if (id === resolve(snapshot, 'src/client.tsx')) {
            assert.ok(code.includes('\nhydrateRoot('))
            const observer = resolve(
              root,
              'scripts/sentry-navigation/observe.mjs',
            )
            return code.replace(
              '\nhydrateRoot(',
              `
import { observeTransport } from ${JSON.stringify(observer)};
Object.assign(window, { __diagnosticSdk: Sentry, __diagnosticReport: observeTransport(Sentry, window.reportProbe) });
hydrateRoot(`,
            )
          }
          if (id === resolve(snapshot, 'src/router.tsx')) {
            assert.ok(code.includes('return router'))
            return code.replace(
              'return router',
              'if (!import.meta.env.SSR) Object.assign(window, { __diagnosticRouter: router });\nreturn router',
            )
          }
        },
      },
    ],
    preview: { host: '127.0.0.1', port, strictPort: true },
  }
  // Vite/Cloudflare resolve their local-only runtime state relative to this disposable snapshot.
  process.chdir(snapshot)
  if (phase === 'prepare') {
    execFileSync(
      process.execPath,
      [
        resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
        'd1',
        'migrations',
        'apply',
        'planned-travel-db',
        '--local',
      ],
      { cwd: snapshot, timeout: 300_000, stdio: 'pipe' },
    )
    await (await createBuilder(config)).buildApp()
    const { readdir } = await import('node:fs/promises')
    const assets = await readdir(resolve(snapshot, 'dist/client/assets'))
    const digest = createHash('sha256')
    for (const file of assets.sort()) {
      if (file.endsWith('.js'))
        digest
          .update(file)
          .update(await readFile(resolve(snapshot, 'dist/client/assets', file)))
    }
    output.clientBuild = {
      assetCount: assets.filter((file) => file.endsWith('.js')).length,
      sha256: digest.digest('hex'),
    }
    await writeFile(
      descriptorPath,
      JSON.stringify(
        {
          revision,
          snapshot,
          origin,
          collectorPort,
          sdk: output.sdk,
          sourceHashes: output.sourceHashes,
          clientBuild: output.clientBuild,
        },
        null,
        2,
      ),
    )
    output.prepared = true
    output.artifact = descriptorPath
  } else {
    // Bind before any browser opens. A port taken during the build refuses without sending data.
    collector = await startCollector({
      origin,
      port: collectorPort,
      maxBytes: 21_000_000,
      maxRequests: 256,
    })
    server = await preview(config)
    output.browsers = {}
    for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
      browser = await launcher.launch({ headless: true })
      output.browsers[engine] = browser.version()
      for (const timing of [
        'early-spa',
        'settled-spa',
        'early-document',
        'settled-document',
      ]) {
        for (let trial = 1; trial <= 2; trial++) {
          assert.equal(
            collector.expired,
            false,
            'Collector expired, not lifecycle evidence',
          )
          const context = await browser.newContext({ serviceWorkers: 'block' })
          const events = []
          const network = []
          let blocked = 0
          // Font presentation is outside this telemetry experiment; no external request is forwarded.
          await context.route(
            (url) => ![origin, collectorOrigin].includes(url.origin),
            (route) => {
              if (
                route
                  .request()
                  .url()
                  .startsWith('https://fonts.googleapis.com/')
              )
                return route.fulfill({ contentType: 'text/css', body: '' })
              blocked++
              return route.abort()
            },
          )
          const page = await context.newPage()
          const report = watchConsole(page, {
            name: 'full-app-sentry',
            path: '/',
          })
          await page.exposeFunction('reportProbe', (metadata) => {
            events.push(metadata)
          })
          const ids = new WeakMap()
          page.on('request', (request) => {
            if (
              new URL(request.url()).origin !== collectorOrigin ||
              request.method() !== 'POST'
            )
              return
            let id = null
            try {
              id =
                JSON.parse(request.postData()?.split('\n', 1)[0] ?? '')
                  .event_id ?? null
            } catch {
              network.push({ kind: 'correlation-failure', id: null })
            }
            ids.set(request, id)
            network.push({ kind: 'attempt', id })
          })
          page.on('response', (response) => {
            if (ids.has(response.request()))
              network.push({
                kind: 'response',
                id: ids.get(response.request()),
                status: response.status(),
              })
          })
          page.on('requestfailed', (request) => {
            if (ids.has(request))
              network.push({
                kind: 'failed',
                id: ids.get(request),
                error: request.failure()?.errorText,
              })
          })
          first = collector.records.length
          active = {
            engine,
            timing,
            trial,
            phase: 'loading',
            network,
            events,
            console: report(),
          }
          output.trials.push(active)
          collector.policy.delay = 300
          const response = await page.goto(origin)
          active.initialStatus = response.status()
          assert.equal(response.status(), 200)
          await page.waitForFunction(
            () => window.__diagnosticSdk && window.__diagnosticRouter,
            null,
            { timeout: 30_000 },
          )
          await page.waitForFunction(hydratedMain, null, { timeout: 30_000 })
          const span = await page.evaluate(() => {
            const sdk = window.__diagnosticSdk
            const span = sdk.startInactiveSpan({
              name: 'synthetic-full-app',
              op: 'diagnostic',
              parentSpan: null,
              forceTransaction: true,
            })
            const result = {
              trace: span.spanContext().traceId,
              sampled: (span.spanContext().traceFlags & 1) === 1,
            }
            span.end()
            return result
          })
          Object.assign(active, { phase: 'sending', ...span })
          assert.equal(span.sampled, true)
          await waitFor(() =>
            events.some(
              (event) =>
                event.kind === 'envelope' &&
                event.trace === span.trace &&
                event.op === 'diagnostic',
            ),
          )
          const envelope = events.find(
            (event) =>
              event.kind === 'envelope' &&
              event.trace === span.trace &&
              event.op === 'diagnostic',
          )
          active.id = envelope.id
          if (timing.startsWith('settled'))
            await waitFor(() =>
              events.some(
                (event) =>
                  event.kind === 'sdk-response' && event.id === envelope.id,
              ),
            )
          const originalDocumentId = envelope.documentId
          active.diagnosticFailures = {
            beforeNavigation: await page.evaluate(
              diagnosticSnapshot,
              originalDocumentId,
            ),
            terminal: null,
          }
          active.phase = 'navigating'
          if (timing.endsWith('spa'))
            await page.evaluate(() =>
              window.__diagnosticRouter.navigate({ to: '/pricing' }),
            )
          else
            assert.equal((await page.goto(`${origin}/pricing`)).status(), 200)
          await page.waitForFunction(
            () =>
              location.pathname === '/pricing' &&
              document.querySelector('main')?.textContent.length > 40,
          )
          await page.waitForFunction(hydratedMain, null, { timeout: 30_000 })
          await new Promise((done) => setTimeout(done, 500))
          Object.assign(active, {
            phase: 'complete',
            navigation: 'complete',
            blocked,
            collector: collector.records
              .slice(first)
              .filter((record) => record.id === envelope.id),
            sdkResponse: events.filter(
              (event) =>
                event.kind === 'sdk-response' && event.id === envelope.id,
            ),
          })
          process.stderr.write(
            JSON.stringify({
              engine,
              timing,
              trial,
              phase: active.phase,
              fatal: active.console.fatal.length,
            }) + '\n',
          )
          active.diagnosticFailures.terminal = await page.evaluate(
            diagnosticSnapshot,
            originalDocumentId,
          )
          await context.close()
        }
      }
      await browser.close()
      browser = null
    }
  }
} catch (error) {
  output.failure = { name: error.name, message: error.message }
  if (active) active.collector = collector.records.slice(first)
  process.exitCode = 1
} finally {
  process.stdout.write(
    '\nSENTRY_APP_RESULT=' +
      JSON.stringify({
        ...output,
        collectorRecords: collector?.records ?? [],
        collectorRejections: collector?.rejections ?? [],
      }) +
      '\n',
  )
  await browser?.close()
  await server?.close()
  await collector?.close()
  process.chdir(root)
  if (phase === 'prepare' && !output.prepared)
    await rm(snapshot, { recursive: true, force: true })
}
