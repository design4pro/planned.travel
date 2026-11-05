import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

// Only side handlers observe: the receiver, arguments and returned promise stay native.
export function observeNativeFetch(nativeFetch, report, failures) {
  let sequence = 0
  const emit = (event) => {
    try {
      Promise.resolve(report(event)).catch(() =>
        failures.push('binding_rejected'),
      )
    } catch {
      failures.push('binding_threw')
    }
  }
  return function (...args) {
    const seq = ++sequence
    let metadata
    try {
      const body = args[1].body
      if (typeof body !== 'string') throw new Error('non-string synthetic body')
      const bytes = new TextEncoder().encode(body)
      metadata = {
        seq,
        id: JSON.parse(body.split('\n', 1)[0]).event_id,
        bytes: bytes.length,
        characters: body.length,
        keepalive: args[1].keepalive,
      }
      emit({ kind: 'attempt', ...metadata })
      crypto.subtle.digest('SHA-256', bytes).then(
        (digest) =>
          emit({
            kind: 'digest',
            ...metadata,
            sha256: Array.from(new Uint8Array(digest), (b) =>
              b.toString(16).padStart(2, '0'),
            ).join(''),
          }),
        () => failures.push('digest_rejected'),
      )
    } catch {
      failures.push('observation_threw')
    }
    const promise = Reflect.apply(nativeFetch, this, args)
    promise.then(
      (response) =>
        emit({
          kind: 'native-response',
          seq,
          id: metadata?.id,
          status: response.status,
        }),
      (error) =>
        emit({
          kind: 'native-rejection',
          seq,
          id: metadata?.id,
          error: error?.name,
        }),
    )
    return promise
  }
}

export function classifyTrial(trial) {
  return trial.ids.map((id) => {
    const attempt = trial.events.find(
      (e) => e.kind === 'attempt' && e.id === id,
    )
    const digest = trial.events.find((e) => e.kind === 'digest' && e.id === id)
    const receipt =
      digest &&
      trial.receipts.find(
        (r) =>
          r.id === id && r.sha256 === digest.sha256 && r.bytes === digest.bytes,
      )
    const response = trial.events.find(
      (e) => e.kind === 'sdk-response' && e.id === id,
    )
    const rejection = trial.events.find(
      (e) => e.kind === 'sdk-rejection' && e.id === id,
    )
    let delivery = 'unknown'
    if (receipt) delivery = 'received'
    else if (digest) delivery = 'no-matching-receipt-in-window'
    let responseState = 'unknown'
    if (response) responseState = 'observed'
    else if (rejection) responseState = 'rejected'
    return {
      id,
      attempt: attempt ?? null,
      receipt: receipt ?? null,
      sdkResponse: response?.status ?? null,
      sdkRejection: rejection?.error ?? null,
      delivery,
      response: responseState,
      terminalDiagnostics: 'unknown-after-replacement',
    }
  })
}

async function main() {
  const { chromium, webkit } = await import('@playwright/test')
  const { build } = await import('vite')
  const { watchConsole } = await import('../../e2e/helpers/console.ts')
  const engine = process.argv[2]
  assert.ok(
    ['chromium', 'webkit'].includes(engine),
    'Usage: pnpm exec tsx fetch-lifecycle.mjs chromium|webkit',
  )
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim()
  const sha = (value) => createHash('sha256').update(value).digest('hex')
  const refs = [
    '2e28a8e3c06fb394d29a40a8c9e51ec1b77900f8',
    '9ed0a446d2d5692e43fb6bdb1b0de65bca08c4fc',
  ]
  const files = [
    'package.json',
    'pnpm-lock.yaml',
    'src/client.tsx',
    'src/router.tsx',
    'src/lib/sentry-scrub.ts',
    'src/lib/sentry-replay.ts',
  ]
  const hashes = Object.fromEntries(
    files.map((file) => [
      file,
      refs.map((ref) => sha(execFileSync('git', ['show', `${ref}:${file}`]))),
    ]),
  )
  for (const values of Object.values(hashes)) assert.equal(values[0], values[1])
  assert.equal(
    JSON.parse(
      await readFile('node_modules/@sentry/react/package.json', 'utf8'),
    ).version,
    '10.72.0',
  )
  const report = {
    source: git('rev-parse', 'HEAD'),
    refs,
    hashes,
    sdk: '10.72.0',
    engine,
    trials: [],
    failure: null,
  }
  let browser,
    servers = [],
    active,
    config,
    bundle,
    origin,
    crossOrigin
  let receipts = [],
    guards = [],
    count = 0,
    documentStartedAt = 0
  const timers = new Set()
  const lifetime = setTimeout(() => {
    report.failure = {
      name: 'LifetimeLimit',
      message: '480-second listener lifetime exceeded',
    }
    void browser?.close()
    for (const server of servers) {
      server.closeAllConnections()
      server.close()
    }
  }, 480000)
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const until = async (predicate) => {
    const end = Date.now() + 5000
    while (!predicate()) {
      assert.ok(Date.now() < end, 'observation timeout')
      await wait(10)
    }
  }
  const handler = (req, res) => {
    if (++count > 2000) {
      guards.push('request-limit')
      res.writeHead(429).end()
      return
    }
    if (req.url === '/ingest') {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader(
        'Access-Control-Expose-Headers',
        'X-Sentry-Rate-Limits, Retry-After',
      )
      if (
        req.method !== 'POST' ||
        (req.headers.origin && req.headers.origin !== origin)
      ) {
        guards.push('method-or-origin')
        res.writeHead(403).end()
        return
      }
      const digest = createHash('sha256')
      let bytes = 0,
        header = '',
        id = null,
        parsed = false
      req.on('data', (chunk) => {
        bytes += chunk.length
        if (bytes > 140000) {
          guards.push('body-limit')
          req.destroy()
          return
        }
        digest.update(chunk)
        if (!parsed) {
          const newline = chunk.indexOf(10)
          header += chunk
            .subarray(0, newline < 0 ? chunk.length : newline)
            .toString()
          if (header.length > 1024) {
            parsed = true
            header = ''
          } else if (newline >= 0) {
            try {
              id = JSON.parse(header).event_id
            } catch {}
            parsed = true
            header = ''
          }
        }
      })
      req.on('error', () => res.destroy())
      req.on('end', () => {
        const record = {
          id,
          bytes,
          sha256: digest.digest('hex'),
          finished: false,
          status: 204,
        }
        receipts.push(record)
        res.once('finish', () => {
          record.finished = true
        })
        const timer = setTimeout(() => {
          timers.delete(timer)
          res.writeHead(204).end()
        }, 150)
        timers.add(timer)
      })
      return
    }
    if (req.url === '/probe.js') {
      res.setHeader('Content-Type', 'text/javascript')
      res.end(bundle)
      return
    }
    if (req.url?.startsWith('/destination')) {
      documentStartedAt = Date.now()
      const timer = setTimeout(
        () => {
          timers.delete(timer)
          res.end(
            '<!doctype html><link rel="icon" href="data:,"><p>destination</p>',
          )
        },
        req.url.includes('hold') ? 600 : 0,
      )
      timers.add(timer)
      return
    }
    if (req.url !== '/') {
      res.writeHead(404).end()
      return
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(
      '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><script>window.config=' +
        JSON.stringify(config) +
        '</script><script type="module" src="/probe.js"></script>',
    )
  }
  try {
    for (let i = 0; i < 2; i++) {
      const server = createServer(handler)
      servers.push(server)
      server.requestTimeout = 5000
      server.headersTimeout = 5000
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    }
    origin = 'http://127.0.0.1:' + servers[0].address().port
    crossOrigin = 'http://127.0.0.1:' + servers[1].address().port
    const entry = process.cwd() + '/scripts/__scratch_fetch_lifecycle.mjs'
    const code = `import {makeFetchTransport} from '@sentry/react';
const failures=[]; const documentId=crypto.randomUUID();
const emit=event=>{try{Promise.resolve(window.reportMetadata({...event,documentId})).catch(()=>failures.push('binding_rejected'))}catch{failures.push('binding_threw')}};
const observe=${observeNativeFetch.toString()};
const transport=makeFetchTransport({url:window.config.url,recordDroppedEvent:(reason,category)=>emit({kind:'drop',reason,category})},observe(window.fetch,emit,failures));
window.probe={snapshot:()=>({documentId,failures:failures.slice()}),send:(spec)=>{
  const ids=[];
  for(let i=0;i<spec.count;i++){
    const id=crypto.randomUUID().replaceAll('-','');ids.push(id);
    const envelope=[{event_id:id},[[{type:'transaction'},{type:'transaction',transaction:'synthetic',padding:''}]]];
    const base=JSON.stringify(envelope[0])+'\\n'+JSON.stringify(envelope[1][0][0])+'\\n'+JSON.stringify(envelope[1][0][1]);
    const character=spec.multibyte?'é':'x';
    envelope[1][0][1].padding=character.repeat(Math.floor((spec.bytes-new TextEncoder().encode(base).length)/(spec.multibyte?2:1)));
    const request=transport.send(envelope);
    request.then(result=>emit({kind:'sdk-response',id,status:result?.statusCode??null}),error=>emit({kind:'sdk-rejection',id,error:error?.name}));
  }
  emit({kind:'created',ids,createdAt:Date.now()});return ids;
}};`
    const built = await build({
      configFile: false,
      envFile: false,
      logLevel: 'silent',
      plugins: [
        {
          name: 'virtual-fetch-lifecycle',
          resolveId: (id) => (id === entry ? id : undefined),
          load: (id) => (id === entry ? code : undefined),
        },
      ],
      build: {
        write: false,
        minify: false,
        rollupOptions: { input: entry, output: { codeSplitting: false } },
      },
    })
    bundle = built.output.find(
      (file) => file.type === 'chunk' && file.isEntry,
    ).code
    report.bundleSha256 = sha(bundle)
    browser = await { chromium, webkit }[engine].launch({
      headless: true,
      timeout: 15000,
    })
    report.browser = browser.version()
    const profiles = [59999, 60000, 60001, 65535, 65536, 65537].map(
      (bytes) => ({
        name: 'ascii-' + bytes,
        bytes,
        count: 1,
        multibyte: false,
      }),
    )
    profiles.push(
      ...[65534, 65536, 65538].map((bytes) => ({
        name: 'utf8-' + bytes,
        bytes,
        count: 1,
        multibyte: true,
      })),
      { name: 'overlap-utf8', bytes: 32770, count: 2, multibyte: true },
    )
    for (const endpoint of ['same', 'cross'])
      for (const timing of ['early', 'settled', 'provisional'])
        for (const profile of profiles)
          for (let repetition = 1; repetition <= 2; repetition++) {
            receipts = []
            guards = []
            config = {
              url: (endpoint === 'same' ? origin : crossOrigin) + '/ingest',
            }
            const context = await browser.newContext({
              serviceWorkers: 'block',
            })
            const trial = {
              endpoint,
              timing,
              profile: profile.name,
              repetition,
              events: [],
              ids: [],
              navigation: 'not-started',
              externalBlocked: 0,
            }
            active = trial
            report.trials.push(trial)
            try {
              await context.route(
                (url) => ![origin, crossOrigin].includes(url.origin),
                (route) => {
                  trial.externalBlocked++
                  return route.abort()
                },
              )
              const page = await context.newPage()
              page.setDefaultTimeout(6000)
              page.setDefaultNavigationTimeout(7000)
              const consoleReport = watchConsole(page, {
                name: 'fetch-lifecycle',
                path: '/',
              })
              trial.console = consoleReport()
              await page.exposeFunction('reportMetadata', (event) =>
                trial.events.push(event),
              )
              await page.goto(origin)
              await page.waitForFunction(() => window.probe !== undefined)
              trial.beforeNavigation = await page.evaluate(() =>
                window.probe.snapshot(),
              )
              if (timing === 'provisional') {
                await page.evaluate((spec) => {
                  setTimeout(() => window.probe.send(spec), 100)
                }, profile)
                const navigation = page.goto(origin + '/destination?hold=1')
                await until(() =>
                  trial.events.some((e) => e.kind === 'created'),
                )
                const created = trial.events.find((e) => e.kind === 'created')
                trial.ids = created.ids
                trial.conditionEstablished =
                  created.createdAt >= documentStartedAt
                trial.documentStartedAt = documentStartedAt
                trial.createdAt = created.createdAt
                await navigation
              } else {
                trial.ids = await page.evaluate(
                  (spec) => window.probe.send(spec),
                  profile,
                )
                await until(
                  () =>
                    trial.events.filter((e) => e.kind === 'attempt').length ===
                    profile.count,
                )
                if (timing === 'settled')
                  await until(
                    () =>
                      trial.events.filter((e) =>
                        ['sdk-response', 'sdk-rejection'].includes(e.kind),
                      ).length === profile.count,
                  )
                trial.beforeNavigation = await page.evaluate(() =>
                  window.probe.snapshot(),
                )
                await page.goto(origin + '/destination')
                trial.conditionEstablished = true
              }
              trial.navigation = 'complete'
              await wait(220)
              trial.terminalDiagnostics = null
              trial.receipts = receipts.slice()
              trial.guards = guards.slice()
              trial.outcomes = classifyTrial(trial)
            } catch (error) {
              trial.failure = { name: error.name, message: error.message }
              trial.receipts = receipts.slice()
              trial.guards = guards.slice()
            } finally {
              await context.close()
            }
            process.stderr.write(
              JSON.stringify({
                engine,
                endpoint,
                timing,
                profile: profile.name,
                repetition,
                received: trial.outcomes?.filter((o) => o.receipt).length,
                fatal: trial.console?.fatal,
                failure: trial.failure,
              }) + '\n',
            )
          }
  } catch (error) {
    report.failure = { name: error.name, message: error.message }
    process.exitCode = 1
  } finally {
    clearTimeout(lifetime)
    report.completed = report.trials.filter((t) => !t.failure).length
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    await browser?.close()
    for (const timer of timers) clearTimeout(timer)
    for (const server of servers) {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main()
