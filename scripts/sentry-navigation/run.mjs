import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, webkit } from '@playwright/test'
import { build } from 'vite'
import { watchConsole } from '../../e2e/helpers/console.ts'
import { startCollector } from './collector.mjs'

const root = process.cwd()
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
const revisions = process.argv.slice(2)
assert.equal(
  revisions.length,
  2,
  'Usage: pnpm exec tsx scripts/sentry-navigation/run.mjs <develop-sha> <affected-sha>',
)
for (const revision of revisions) assert.match(revision, /^[a-f0-9]{40}$/)
const files = [
  'src/client.tsx',
  'src/router.tsx',
  'src/lib/sentry-scrub.ts',
  'src/lib/sentry-replay.ts',
  'src/lib/query.ts',
  'src/lib/workspace-claim.ts',
  'src/lib/errors.ts',
]
const results = []
const controls = []
const sources = []
const browsers = {}
let failure = null
let currentTrial
let currentFirst = 0
let fixture
let collector
let browser
const waitFor = async (predicate, label) => {
  const deadline = Date.now() + 5000
  while (!predicate()) {
    assert.ok(Date.now() < deadline, `Timed out: ${label}`)
    await new Promise((done) => setTimeout(done, 20))
  }
}

try {
  let bundle = ''
  let pendingDocuments = 0
  let documentStartedAt = 0
  fixture = createServer((request, response) => {
    response.setHeader(
      'Content-Type',
      request.url === '/probe.js' ? 'text/javascript' : 'text/html',
    )
    const body =
      request.url === '/probe.js'
        ? bundle
        : '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module" src="/probe.js"></script></body></html>'
    if (request.url === '/destination?hold=1') {
      pendingDocuments++
      documentStartedAt = Date.now()
      setTimeout(() => response.end(body), 1500)
    } else response.end(body)
  })
  await new Promise((done) => fixture.listen(0, '127.0.0.1', done))
  const origin = `http://127.0.0.1:${fixture.address().port}`
  collector = await startCollector({ origin })
  const collectorOrigin = new URL(collector.url).origin
  const dsn = `${collectorOrigin.replace('http://', 'http://synthetic@')}/1`

  for (const revision of revisions) {
    const texts = new Map(
      files.map((file) => [
        resolve(root, file),
        git('show', `${revision}:${file}`),
      ]),
    )
    const lock = git('show', `${revision}:pnpm-lock.yaml`)
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
      'Pinned revision must use the installed SDK',
    )
    sources.push({
      revision,
      sdk,
      files: Object.fromEntries(
        [...texts].map(([file, text]) => [
          file.slice(root.length + 1),
          createHash('sha256').update(text).digest('hex'),
        ]),
      ),
    })
    const entry = resolve(root, 'scripts/sentry-navigation/entry.tsx')
    const clientPath = resolve(root, 'src/client.tsx')
    const client = texts.get(clientPath)
    assert.equal(
      client.split('\nhydrateRoot(').length,
      2,
      'Client entry shape changed; review fixture extraction',
    )
    // Replace only document hydration; keep the revision's entire SDK initialization and replay import.
    texts.set(
      clientPath,
      client
        .split('\nhydrateRoot(')[0]
        .replace(/^import \{ StartClient \} from .*\n/m, '')
        .replace(/^import \{ StrictMode \} from .*\n/m, '')
        .replace(/^import \{ hydrateRoot \} from .*\n/m, ''),
    )
    for (const environment of ['staging', 'production']) {
      const output = await build({
        configFile: false,
        envFile: false,
        logLevel: 'warn',
        resolve: { alias: { '#': resolve(root, 'src') } },
        define: {
          'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(dsn),
          'import.meta.env.VITE_ENVIRONMENT': JSON.stringify(environment),
          'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(revision),
          'import.meta.env.SSR': 'false',
        },
        plugins: [
          {
            name: 'revision-fixture',
            enforce: 'pre',
            resolveId(source) {
              if (source === entry || texts.has(source)) return source
              if (
                source.endsWith('routeTree.gen') ||
                source.endsWith('routeTree.gen.ts')
              )
                return '\0probe-routes'
            },
            load(id) {
              if (id === entry)
                return `import ${JSON.stringify(clientPath)}; import { probe } from './browser.mjs'; window.probe = probe;`
              if (texts.has(id))
                return { code: texts.get(id), moduleSideEffects: true }
              if (id === '\0probe-routes')
                return `import { createRootRoute, createRoute, Outlet } from '@tanstack/react-router';
              const root = createRootRoute({ component: Outlet });
              export const routeTree = root.addChildren(['/', '/destination'].map(path =>
                createRoute({ getParentRoute: () => root, path, component: () => path })));`
            },
          },
        ],
        build: {
          write: false,
          sourcemap: false,
          minify: true,
          rollupOptions: { input: entry, output: { codeSplitting: false } },
        },
      })
      assert.ok(!Array.isArray(output) && 'output' in output)
      bundle = output.output.find(
        (file) => file.type === 'chunk' && file.isEntry,
      ).code
      for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
        browser = await launcher.launch({ headless: true })
        browsers[engine] = browser.version()
        for (const size of [256, 65_000]) {
          for (const timing of [
            'early-spa',
            'early-document',
            'settled-document',
            'provisional-document',
          ]) {
            for (let trial = 1; trial <= 2; trial++) {
              const context = await browser.newContext({
                serviceWorkers: 'block',
              })
              const events = []
              const network = []
              let blocked = 0
              // Permit only the two owned loopback listeners, before any SDK can initialize.
              await context.route(
                (url) => ![origin, collectorOrigin].includes(url.origin),
                (route) => {
                  blocked++
                  return route.abort('blockedbyclient')
                },
              )
              const page = await context.newPage()
              const consoleReport = watchConsole(page, {
                name: 'synthetic-sentry',
                path: '/',
              })
              await page.exposeFunction('reportProbe', (metadata) => {
                events.push(metadata)
              })
              const requestIds = new WeakMap()
              page.on('request', (request) => {
                if (
                  new URL(request.url()).origin !== collectorOrigin ||
                  request.method() !== 'POST'
                )
                  return
                // Read only the envelope header into retained metadata; no payload or URL is recorded.
                let id = null
                try {
                  id =
                    JSON.parse(request.postData()?.split('\n', 1)[0] ?? '')
                      .event_id ?? null
                } catch {
                  network.push({ kind: 'correlation-failure', id: null })
                }
                requestIds.set(request, id)
                network.push({ kind: 'attempt', id })
              })
              page.on('response', (response) => {
                if (requestIds.has(response.request()))
                  network.push({
                    kind: 'response',
                    id: requestIds.get(response.request()),
                    status: response.status(),
                  })
              })
              page.on('requestfailed', (request) => {
                if (requestIds.has(request))
                  network.push({
                    kind: 'failed',
                    id: requestIds.get(request),
                    error: request.failure()?.errorText,
                  })
              })
              assert.equal(
                collector.expired,
                false,
                'Collector expired: not lifecycle evidence',
              )
              const first = collector.records.length
              currentFirst = first
              currentTrial = {
                revision,
                environment,
                engine,
                size,
                timing,
                trial,
                phase: 'initializing',
                network,
                sdkEvents: events,
                console: consoleReport(),
              }
              results.push(currentTrial)
              collector.policy.delay = 300
              await page.goto(origin)
              await page
                .waitForFunction(() => window.probe !== undefined, null, {
                  timeout: 5000,
                })
                .catch(async () => {
                  throw new Error(
                    JSON.stringify({
                      ...consoleReport(),
                      info: await page.evaluate(() => ({
                        scripts: [...document.scripts].map((s) => s.src),
                        text: document.body.textContent,
                        probe: typeof window.probe,
                      })),
                    }),
                  )
                })
              let provisional
              let span
              if (timing === 'provisional-document') {
                const previous = pendingDocuments
                await page.evaluate((padding) => {
                  setTimeout(() => {
                    void window.reportProbe({
                      kind: 'synthetic-span',
                      ...window.probe.transaction(padding),
                    })
                  }, 250)
                }, size)
                provisional = page.goto(`${origin}/destination?hold=1`).then(
                  () => 'complete',
                  () => 'failed',
                )
                await waitFor(
                  () => pendingDocuments > previous,
                  'provisional document request',
                )
                await waitFor(
                  () => events.some((event) => event.kind === 'synthetic-span'),
                  'old-document timer',
                )
                span = events.find((event) => event.kind === 'synthetic-span')
                Object.assign(currentTrial, {
                  documentStartedAt,
                  transactionCreatedAt: span.createdAt,
                })
                if (span.createdAt < documentStartedAt) {
                  Object.assign(currentTrial, {
                    phase: 'condition-not-established',
                    sampled: span.sampled,
                    trace: span.trace,
                  })
                  await provisional
                  await context.close()
                  continue
                }
              } else {
                span = await page.evaluate(
                  (padding) => window.probe.transaction(padding),
                  size,
                )
              }
              Object.assign(currentTrial, {
                phase: 'sending',
                sampled: span.sampled,
                trace: span.trace,
              })
              if (environment === 'staging') assert.equal(span.sampled, true)
              let envelope
              if (span.sampled) {
                await waitFor(
                  () =>
                    events.some(
                      (event) =>
                        event.kind === 'envelope' &&
                        event.trace === span.trace &&
                        event.op === 'diagnostic',
                    ),
                  'envelope',
                )
                envelope = events.find(
                  (event) =>
                    event.kind === 'envelope' &&
                    event.trace === span.trace &&
                    event.op === 'diagnostic',
                )
                if (timing === 'settled-document')
                  await waitFor(
                    () =>
                      events.some(
                        (event) =>
                          event.kind === 'sdk-response' &&
                          event.id === envelope.id,
                      ),
                    'SDK response',
                  )
              }
              let navigation = 'complete'
              try {
                if (provisional) navigation = await provisional
                else if (timing === 'early-spa')
                  await page.evaluate(() => window.probe.navigate())
                else await page.goto(`${origin}/destination`)
                await page.waitForFunction(() =>
                  document.body.textContent.includes('/destination'),
                )
              } catch {
                navigation = 'failed'
              }
              await new Promise((done) => setTimeout(done, 500))
              const id = envelope?.id
              Object.assign(currentTrial, {
                phase: 'complete',
                revision,
                environment,
                engine,
                size,
                timing,
                trial,
                sampled: span.sampled,
                id: id ?? null,
                navigation,
                blocked,
                network,
                correlationFailures: network.filter(
                  (event) => event.kind === 'correlation-failure',
                ),
                collector: collector.records
                  .slice(first)
                  .filter((record) => record.id === id),
                sdkResponse: events.filter(
                  (event) => event.kind === 'sdk-response' && event.id === id,
                ),
                console: consoleReport(),
              })
              process.stderr.write(
                JSON.stringify({
                  revision,
                  environment,
                  engine,
                  size,
                  timing,
                  trial,
                  phase: currentTrial.phase,
                  fatal: currentTrial.console.fatal.length,
                }) + '\n',
              )
              await context.close()
            }
          }
        }
        // Response, rate-limit and buffer controls use the real SDK transport without navigation.
        if (environment === 'staging') {
          for (const mode of ['success', 'rate-limit', 'buffer']) {
            const context = await browser.newContext({
              serviceWorkers: 'block',
            })
            await context.route(
              (url) => ![origin, collectorOrigin].includes(url.origin),
              (route) => route.abort(),
            )
            const page = await context.newPage()
            await page.exposeFunction('reportProbe', () => {})
            const report = watchConsole(page, {
              name: 'transport-control',
              path: '/',
            })
            collector.policy.delay = mode === 'buffer' ? 1000 : 0
            collector.policy.status = mode === 'rate-limit' ? 429 : 204
            collector.policy.rateLimit =
              mode === 'rate-limit' ? '60:transaction:organization' : ''
            await page.goto(origin)
            await page.waitForFunction(() => window.probe !== undefined)
            const outcome = await page.evaluate(
              ({ url, count }) => window.probe.control(url, count),
              { url: collector.url, count: mode === 'buffer' ? 41 : 1 },
            )
            if (mode === 'rate-limit') {
              assert.equal(
                outcome.dropped.filter(
                  (drop) => drop.reason === 'ratelimit_backoff',
                ).length,
                1,
              )
              assert.deepEqual(outcome.statuses, [429, null])
            }
            if (mode === 'buffer') {
              assert.equal(
                outcome.dropped.filter(
                  (drop) => drop.reason === 'queue_overflow',
                ).length,
                1,
              )
              assert.equal(
                outcome.statuses.filter((status) => status === 204).length,
                41,
              )
            }
            if (mode === 'success')
              assert.deepEqual(outcome.statuses, [204, 204])
            // An intentional HTTP 429 can produce a native resource error; retain it unfiltered.
            if (mode !== 'rate-limit') assert.deepEqual(report().fatal, [])
            controls.push({
              revision,
              engine,
              mode,
              ...outcome,
              console: report(),
            })
            await context.close()
            collector.policy.status = 204
            collector.policy.rateLimit = ''
          }
        }
        await browser.close()
        browser = null
      }
    }
  }
} catch (error) {
  failure = {
    name: error.name,
    message: error.message,
    collectorExpired: collector?.expired ?? false,
  }
  if (currentTrial?.phase !== 'complete' && currentTrial)
    currentTrial.collector = collector.records.slice(currentFirst)
  process.exitCode = 1
} finally {
  process.stdout.write(
    JSON.stringify(
      {
        sources,
        browsers,
        trials: results,
        controls,
        failure,
        collectorRecords: collector?.records ?? [],
        collectorRejections: collector?.rejections ?? [],
      },
      null,
      2,
    ) + '\n',
  )
  await browser?.close()
  await collector?.close()
  fixture?.closeAllConnections()
  if (fixture) await new Promise((done) => fixture.close(done))
}
