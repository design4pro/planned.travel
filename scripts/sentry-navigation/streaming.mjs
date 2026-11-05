import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { chromium, webkit } from '@playwright/test'
import { build } from 'vite'
import { watchConsole } from '../../e2e/helpers/console.ts'
import { startCollector } from './collector.mjs'

const root = process.cwd()
const sdk = JSON.parse(
  await readFile(root + '/node_modules/@sentry/react/package.json', 'utf8'),
).version
assert.equal(
  sdk,
  '10.72.0',
  'Reassess streaming protocol for a different installed SDK',
)
const entry = root + '/scripts/__scratch_streaming_probe.mjs'
const report = { sdk: '10.72.0', trials: [], browsers: {}, failure: null }
const code = `import * as Sentry from '@sentry/react';
import {scrubTelemetry} from '${root}/src/lib/sentry-scrub.ts';
import {serializeEnvelope} from '${root}/node_modules/.pnpm/@sentry+core@10.72.0/node_modules/@sentry/core/build/esm/utils/envelope.js';
import {createMetadataReporter} from ${JSON.stringify(root + '/scripts/sentry-navigation/observe.mjs')};
const {record:emit,failures:diagnosticFailures} = createMetadataReporter(window.reportMetadata);
const members = envelope => envelope[1].filter(([header])=>header.type==='span').flatMap(([,value])=>value.items.map(span=>({trace:span.trace_id,span:span.span_id})));
Sentry.init({dsn:window.probeConfig.dsn,environment:'stream-candidate-diagnostic',sendDefaultPii:false,tracesSampleRate:1,
  traceLifecycle:'stream',integrations:[Sentry.spanStreamingIntegration()],beforeSendSpan:Sentry.withStreamedSpan(scrubTelemetry),
  transport:options=>{const oldDrop=options.recordDroppedEvent;const native=Sentry.makeFetchTransport({...options,recordDroppedEvent:(...args)=>{emit({kind:'drop',reason:args[0],category:args[1],quantity:args[2]??1});oldDrop(...args)}});
    return {...native,send:envelope=>{const ids=members(envelope);return native.send(envelope).then(result=>{emit({kind:'transport-response',members:ids,status:result?.statusCode??null});return result},error=>{emit({kind:'transport-rejection',members:ids,error:error.name});throw error})}}}
});
Sentry.getClient().on('beforeEnvelope',envelope=>{const serialized=serializeEnvelope(envelope);emit({kind:'envelope',members:members(envelope),types:envelope[1].map(([header])=>header.type),bytes:typeof serialized==='string'?new TextEncoder().encode(serialized).length:serialized.length})});
window.probe={make(mode){const root=Sentry.startInactiveSpan({name:'synthetic-stream-root',op:'diagnostic',parentSpan:null,forceTransaction:true});const ids=[{trace:root.spanContext().traceId,span:root.spanContext().spanId}];
 if(mode==='large')root.setAttribute('synthetic.padding','x'.repeat(65000));
 if(mode==='small')root.setAttribute('synthetic.padding','x'.repeat(256));
 if(mode==='many')for(let i=0;i<100;i++){const child=Sentry.startInactiveSpan({name:'synthetic-child',op:'diagnostic-child',parentSpan:root});child.setAttribute('synthetic.padding','x'.repeat(2000));ids.push({trace:child.spanContext().traceId,span:child.spanContext().spanId});child.end()}
 const sampled=(root.spanContext().traceFlags&1)===1;root.end();const result={kind:'created',members:ids,sampled,createdAt:Date.now(),diagnosticFailures:diagnosticFailures.slice()};emit(result);return result},flush:()=>Sentry.flush(4000)};
`
let bundle,
  fixture,
  collector,
  browser,
  config,
  documentStartedAt = 0
let active
const waitFor = async (fn, label, ms = 7000) => {
  const until = Date.now() + ms
  while (!fn()) {
    assert.ok(Date.now() < until, 'timeout: ' + label)
    await new Promise((done) => setTimeout(done, 20))
  }
}
try {
  const built = await build({
    root,
    configFile: false,
    envFile: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'scratch-stream-candidate',
        enforce: 'pre',
        resolveId(id) {
          if (id === entry) return id
        },
        load(id) {
          if (id === entry) return { code, moduleSideEffects: true }
        },
      },
    ],
    build: {
      write: false,
      minify: true,
      rollupOptions: { input: entry, output: { codeSplitting: false } },
    },
  })
  assert.ok(!Array.isArray(built) && 'output' in built)
  bundle = built.output.find(
    (file) => file.type === 'chunk' && file.isEntry,
  ).code
  fixture = createServer((request, response) => {
    response.setHeader(
      'Content-Type',
      request.url === '/probe.js' ? 'text/javascript' : 'text/html',
    )
    if (request.url === '/probe.js') return response.end(bundle)
    if (request.url?.startsWith('/destination')) {
      documentStartedAt = Date.now()
      const body = '<!doctype html><p>synthetic destination</p>'
      if (request.url.includes('hold'))
        setTimeout(() => response.end(body), 1200)
      else response.end(body)
      return
    }
    response.end(
      '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><script>window.probeConfig=' +
        JSON.stringify(config) +
        '</script><script type="module" src="/probe.js"></script><p>synthetic streaming probe</p>',
    )
  })
  await new Promise((done) => fixture.listen(0, '127.0.0.1', done))
  const origin = 'http://127.0.0.1:' + fixture.address().port
  for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
    browser = await launcher.launch({ headless: true })
    report.browsers[engine] = browser.version()
    for (const mode of ['small', 'large', 'many'])
      for (const timing of ['settled', 'provisional'])
        for (let trial = 1; trial <= 2; trial++) {
          collector = await startCollector({
            origin,
            maxBytes: 2_000_000,
            maxRequests: 32,
          })
          config = {
            dsn: collector.url
              .replace('http://', 'http://synthetic@')
              .replace('/api/1/envelope/', '/1'),
          }
          const collectorOrigin = new URL(collector.url).origin
          const context = await browser.newContext({
            serviceWorkers: 'block',
            viewport: { width: 1280, height: 720 },
          })
          let externalBlocked = 0
          await context.route(
            (url) => ![origin, collectorOrigin].includes(url.origin),
            (route) => {
              externalBlocked++
              return route.abort()
            },
          )
          const page = await context.newPage()
          page.setDefaultTimeout(7000)
          const consoleReport = watchConsole(page, {
            name: 'streaming-candidate',
            path: '/',
          })
          const events = [],
            network = []
          const current = {
            engine,
            mode,
            timing,
            trial,
            phase: 'loading',
            events,
            network,
            console: consoleReport(),
          }
          active = current
          report.trials.push(current)
          await page.exposeFunction('reportMetadata', (metadata) =>
            events.push(metadata),
          )
          page.on('request', (request) => {
            if (
              new URL(request.url()).origin !== collectorOrigin ||
              request.method() !== 'POST'
            )
              return
            const body = request.postDataBuffer()
            if (!body) {
              network.push({ kind: 'body-unavailable' })
              return
            }
            let ids = [],
              types = []
            try {
              const lines = body.toString().split('\n')
              for (let i = 1; i < lines.length; i += 2) {
                const item = JSON.parse(lines[i])
                types.push(item.type)
                if (item.type === 'span') {
                  const value = JSON.parse(lines[i + 1])
                  ids.push(
                    ...value.items.map((span) => ({
                      trace: span.trace_id,
                      span: span.span_id,
                    })),
                  )
                }
              }
            } catch {
              network.push({ kind: 'parse-failure' })
            }
            network.push({
              kind: 'attempt',
              members: ids,
              types,
              bytes: body.length,
              sha256: createHash('sha256').update(body).digest('hex'),
            })
          })
          page.on('requestfailed', (request) => {
            if (new URL(request.url()).origin === collectorOrigin)
              network.push({
                kind: 'failed',
                error: request.failure()?.errorText,
              })
          })
          await page.goto(origin)
          await page.waitForFunction(() => window.probe !== undefined)
          current.phase = 'sending'
          let created
          if (timing === 'settled') {
            created = await page.evaluate(
              (mode) => window.probe.make(mode),
              mode,
            )
            await waitFor(
              () =>
                events.some(
                  (event) =>
                    event.kind === 'transport-response' &&
                    event.members.some(
                      (member) => member.span === created.members[0].span,
                    ),
                ),
              'v2 response',
            )
            await page.goto(origin + '/destination')
          } else {
            await page.evaluate((mode) => {
              setTimeout(() => window.probe.make(mode), 100)
            }, mode)
            const navigation = page.goto(origin + '/destination?hold=1')
            await waitFor(
              () => events.some((event) => event.kind === 'created'),
              'created old-document spans',
            )
            created = events.find((event) => event.kind === 'created')
            await navigation
            current.documentStartedAt = documentStartedAt
            assert.ok(
              created.createdAt >= documentStartedAt,
              'provisional timing not established',
            )
          }
          await new Promise((done) => setTimeout(done, 750))
          current.phase = 'complete'
          current.created = created
          current.navigation =
            page.url().endsWith('/destination') ||
            page.url().includes('/destination?hold=1')
              ? 'complete'
              : 'failed'
          current.externalBlocked = externalBlocked
          current.collector = collector.records
          current.collectorRejections = collector.rejections
          const envelopes = events.filter(
            (event) => event.kind === 'envelope' && event.members.length,
          )
          current.envelopeReceipts = network
            .filter(
              (attempt) => attempt.kind === 'attempt' && attempt.members.length,
            )
            .map((attempt) => ({
              members: attempt.members,
              sha256: attempt.sha256,
              bytes: attempt.bytes,
              matchedReceiptCount: collector.records.filter(
                (record) =>
                  record.sha256 === attempt.sha256 && record.status === 204,
              ).length,
            }))
          current.responseMemberCount = new Set(
            events
              .filter(
                (event) =>
                  event.kind === 'transport-response' && event.status === 204,
              )
              .flatMap((event) => event.members.map((member) => member.span)),
          ).size
          current.emittedMemberCount = new Set(
            envelopes.flatMap((event) =>
              event.members.map((member) => member.span),
            ),
          ).size
          current.receivedMemberCount = new Set(
            current.envelopeReceipts
              .filter((item) => item.matchedReceiptCount === 1)
              .flatMap((item) => item.members.map((member) => member.span)),
          ).size
          process.stderr.write(
            JSON.stringify({
              engine,
              mode,
              timing,
              trial,
              created: created.members.length,
              emitted: current.emittedMemberCount,
              received: current.receivedMemberCount,
              fatal: current.console.fatal.length,
            }) + '\n',
          )
          await context.close()
          await collector.close()
          collector = null
        }
    await browser.close()
    browser = null
  }
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  if (active && collector) {
    active.collector = collector.records
    active.collectorRejections = collector.rejections
  }
  process.exitCode = 1
} finally {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  await browser?.close()
  await collector?.close()
  fixture?.closeAllConnections()
  if (fixture) await new Promise((done) => fixture.close(done))
}
