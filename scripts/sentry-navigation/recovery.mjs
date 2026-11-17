import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, webkit } from '@playwright/test'
import { build } from 'vite'
import { watchConsole } from '../../e2e/helpers/console.ts'
import { startCollector } from './collector.mjs'
import { deliveryBootstrapScript } from '../../src/lib/sentry-delivery/control.ts'

const engine = process.argv[2]
assert.ok(['chromium', 'webkit'].includes(engine))
const root = process.cwd()
const report = {
  engine,
  kind: 'real-sdk-working-tree-transaction-recovery',
  trials: [],
  controls: [],
  failure: null,
}
const timers = new Set()
let server,
  collector,
  browser,
  bundle = '',
  assets = new Map(),
  scope = 'anonymous',
  workerDelay = 0
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const until = async (predicate) => {
  const end = Date.now() + 15000
  while (!(await predicate())) {
    assert.ok(Date.now() < end, 'correlated receipt timeout')
    await wait(20)
  }
}
const lifetime = setTimeout(() => {
  void browser?.close()
  server?.closeAllConnections()
}, 240000)
try {
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname
    if (path === '/probe.js') {
      res.setHeader('Content-Type', 'text/javascript')
      res.end(bundle)
      return
    }
    if (assets.has(path)) {
      res.setHeader('Content-Type', 'text/javascript')
      res.setHeader('Service-Worker-Allowed', '/assets/')
      const timer = setTimeout(() => {
        timers.delete(timer)
        res.end(assets.get(path))
      }, workerDelay)
      timers.add(timer)
      return
    }
    const targetScope = req.url.includes('changed=1') ? 'f'.repeat(64) : scope
    const html =
      '<!doctype html><meta charset="utf-8"><meta name="sentry-delivery-scope" class="sentry-block" data-sentry-block content="' +
      targetScope +
      '"><link rel="icon" href="data:,"><script>' +
      deliveryBootstrapScript +
      '</script><script type="module" src="/probe.js"></script><p>synthetic recovery fixture</p>'
    const timer = setTimeout(
      () => {
        timers.delete(timer)
        res.end(html)
      },
      req.url.includes('hold=1') ? 600 : 0,
    )
    timers.add(timer)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  collector = await startCollector({
    origin,
    maxBytes: 1048576,
    maxRequests: 1024,
    delay: 150,
  })
  const collectorOrigin = new URL(collector.url).origin
  const dsn = collectorOrigin.replace('http://', 'http://synthetic@') + '/1'
  const entry = resolve(root, 'scripts/sentry-navigation/__recovery_entry.ts')
  const client = resolve(root, 'src/client.tsx')
  const source = await readFile(client, 'utf8')
  assert.equal(source.split('\nhydrateRoot(').length, 2)
  const trimmed = source
    .split('\nhydrateRoot(')[0]
    .replace(/^import \{ StartClient \} from .*\n/m, '')
    .replace(/^import \{ StrictMode \} from .*\n/m, '')
    .replace(/^import \{ hydrateRoot \} from .*\n/m, '')
  const code = `import ${JSON.stringify(client)};
import * as Sentry from '@sentry/react';
const sdk=Sentry.getClient();
if(!sdk) throw new Error("Real SDK initialization was not retained");
window.probe={
  flush:()=>sdk.flush(10000),
  send(size,navigate){
    const id=crypto.randomUUID().replaceAll('-','');
    const envelope=[{event_id:id,sent_at:new Date().toISOString()},[[{type:'transaction'},{type:'transaction',event_id:id,transaction:'synthetic-recovery',extra:{padding:'x'.repeat(size)}}]]];
    const pending=sdk.getTransport().send(envelope);
    pending.then(result=>window.reportRecovery({kind:'sdk-response',id,status:result.statusCode??null}),()=>window.reportRecovery({kind:'sdk-rejection',id})).catch(()=>{});
    const raw=sessionStorage.getItem('planned.sentry.transactions.v1');
    const entry=raw?JSON.parse(raw).entries.find(item=>item.id===id):null;
    if(entry){const bytes=new TextEncoder().encode(entry.body);crypto.subtle.digest('SHA-256',bytes).then(hash=>window.reportRecovery({kind:'admission-digest',id,bytes:bytes.length,sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')})).catch(()=>{})}
    const metadata={kind:'admitted',id,admitted:Boolean(entry),bytes:entry?new TextEncoder().encode(entry.body).length:null,leaving:window.__plannedDeliveryLeaving===true,at:Date.now()};
    window.reportRecovery(metadata).catch(()=>{});
    if(navigate) location.assign(navigate);
    return metadata;
  },
  retained:()=>{const raw=sessionStorage.getItem('planned.sentry.transactions.v1');return raw?JSON.parse(raw).entries.length:0}
};`
  const output = await build({
    configFile: false,
    envFile: false,
    logLevel: 'silent',
    resolve: { alias: { '#': resolve(root, 'src') } },
    define: {
      'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(dsn),
      'import.meta.env.VITE_ENVIRONMENT': JSON.stringify('staging'),
      'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(
        'recovery-diagnostic',
      ),
      'import.meta.env.SSR': 'false',
    },
    plugins: [
      {
        name: 'real-client-recovery-fixture',
        enforce: 'pre',
        resolveId: (id) => (id === entry ? id : undefined),
        load: (id) => (id === entry ? code : undefined),
        transform: (code, id) =>
          id === client
            ? { code: trimmed, moduleSideEffects: true }
            : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      rolldownOptions: { input: entry, output: { codeSplitting: false } },
    },
  })
  bundle = output.output.find(
    (item) => item.type === 'chunk' && item.isEntry,
  ).code
  report.bundleSha256 = createHash('sha256').update(bundle).digest('hex')
  for (const asset of output.output) {
    if (asset.type === 'asset') assets.set('/' + asset.fileName, asset.source)
  }
  report.assets = [...assets.keys()]
  browser = await { chromium, webkit }[engine].launch({ timeout: 15000 })
  report.browser = browser.version()
  for (const timing of [
    'cold',
    'provisional',
    'settled',
    'scope-changed',
    'sensitive',
    'accept-invitation',
    'accept-invitation-cold',
    'mixed-auth-cold',
    'mixed-auth-arrival',
    'mixed-auth-spa',
    'cancelled-beforeunload',
    'cancelled-beforeunload-warm',
  ].filter((timing) => !process.argv[3] || timing === process.argv[3]))
    for (let repetition = 1; repetition <= 2; repetition++) {
      workerDelay = timing === 'cancelled-beforeunload' ? 2000 : 800
      const context = await browser.newContext({ serviceWorkers: 'allow' })
      const events = []
      const trial = {
        timing,
        repetition,
        events,
        navigation: 'not-started',
        externalBlocked: 0,
      }
      report.trials.push(trial)
      const first = collector.records.length
      const coldAuthEntry = [
        'accept-invitation-cold',
        'mixed-auth-cold',
      ].includes(timing)
      try {
        await context.route(
          (url) => ![origin, collectorOrigin].includes(url.origin),
          (route) => {
            trial.externalBlocked++
            return route.abort()
          },
        )
        const page = await context.newPage()
        page.setDefaultTimeout(15000)
        page.setDefaultNavigationTimeout(15000)
        const observe = watchConsole(page, {
          name: 'transaction-recovery',
          path: '/',
        })
        trial.console = observe()
        await page.exposeFunction('reportRecovery', (event) =>
          events.push(event),
        )
        await page.addInitScript(() => {
          const nativeRegister = navigator.serviceWorker.register
          navigator.serviceWorker.register = function (...args) {
            window
              .reportRecovery({
                kind: 'register',
                leaving: window.__plannedDeliveryLeaving === true,
              })
              .catch(() => {})
            return nativeRegister.apply(this, args)
          }
          const raw = sessionStorage.getItem('planned.sentry.transactions.v1')
          if (!raw) return
          for (const entry of JSON.parse(raw).entries) {
            const bytes = new TextEncoder().encode(entry.body)
            crypto.subtle
              .digest('SHA-256', bytes)
              .then((hash) =>
                window.reportRecovery({
                  kind: 'stored-digest',
                  id: entry.id,
                  bytes: bytes.length,
                  sha256: Array.from(new Uint8Array(hash), (b) =>
                    b.toString(16).padStart(2, '0'),
                  ).join(''),
                }),
              )
              .catch(() => {})
          }
        })
        await page.goto(
          coldAuthEntry
            ? origin +
                (timing === 'mixed-auth-cold'
                  ? '/LOGIN'
                  : '/accept-invitation/synthetic')
            : origin,
        )
        await page.waitForFunction(() => window.probe !== undefined)
        if (coldAuthEntry) {
          trial.selected = await page.evaluate(() => window.probe.send(100))
          assert.equal(trial.selected.admitted, false)
        } else if (timing === 'mixed-auth-spa') {
          trial.selected = await page.evaluate(() => {
            const selected = window.probe.send(235000)
            history.pushState({}, '', '/Accept-Invitation/synthetic')
            return selected
          })
        } else if (timing === 'provisional') {
          await page.evaluate(() =>
            setTimeout(() => window.probe.send(235000), 100),
          )
          await page.goto(origin + '/destination?hold=1')
          await until(() => events.some((event) => event.kind === 'admitted'))
          trial.selected = events.find((event) => event.kind === 'admitted')
          assert.equal(trial.selected.leaving, true)
        } else if (timing.startsWith('cancelled-beforeunload')) {
          if (timing.endsWith('-warm'))
            await until(() =>
              page.evaluate(() =>
                navigator.serviceWorker
                  .getRegistrations()
                  .then((registrations) =>
                    registrations.some(
                      (registration) =>
                        registration.active?.state === 'activated',
                    ),
                  ),
              ),
            )
          trial.workerActiveAtPrompt = await page.evaluate(() =>
            navigator.serviceWorker
              .getRegistrations()
              .then((registrations) =>
                registrations.some(
                  (registration) => registration.active?.state === 'activated',
                ),
              ),
          )
          assert.equal(trial.workerActiveAtPrompt, timing.endsWith('-warm'))
          await page.evaluate(() => {
            window.addEventListener('beforeunload', (event) => {
              event.preventDefault()
              event.returnValue = ''
            })
            const button = document.createElement('button')
            button.textContent = 'Leave synthetic fixture'
            button.onclick = () => location.assign('/destination')
            document.body.appendChild(button)
          })
          page.once('dialog', (dialog) => {
            trial.cancelledDialog = dialog.type()
            void dialog.dismiss()
          })
          await page
            .getByRole('button', { name: 'Leave synthetic fixture' })
            .click()
          assert.equal(trial.cancelledDialog, 'beforeunload')
          assert.equal(page.url(), origin + '/')
          trial.selected = await page.evaluate(() => window.probe.send(235000))
        } else if (timing === 'settled') {
          trial.selected = await page.evaluate(() => window.probe.send(235000))
          await until(() =>
            events.some(
              (event) =>
                event.kind === 'sdk-response' &&
                event.id === trial.selected.id &&
                event.status === 204,
            ),
          )
          await page.goto(origin + '/destination')
        } else {
          let destination = '/destination'
          if (timing === 'scope-changed') destination += '?changed=1'
          if (timing === 'accept-invitation')
            destination = '/accept-invitation/synthetic'
          if (timing === 'mixed-auth-arrival')
            destination = '/Accept-Invitation/synthetic'
          if (timing === 'sensitive')
            destination = '/join/synthetic?token=synthetic'
          trial.selected = await page.evaluate(
            (destination) => window.probe.send(235000, destination),
            destination,
          )
          await page.waitForURL(origin + destination)
        }
        trial.navigation = 'complete'
        assert.equal(trial.selected.admitted, !coldAuthEntry)
        await page.waitForFunction(() => window.probe !== undefined)
        if (coldAuthEntry) {
          assert.equal(await page.evaluate(() => window.probe.retained()), 0)
          assert.equal(
            events.filter((event) => event.kind === 'register').length,
            0,
          )
        } else if (
          [
            'scope-changed',
            'sensitive',
            'accept-invitation',
            'mixed-auth-arrival',
            'mixed-auth-spa',
          ].includes(timing)
        ) {
          await wait(1500)
          assert.equal(await page.evaluate(() => window.probe.retained()), 0)
          assert.equal(
            collector.records
              .slice(first)
              .some((record) => record.id === trial.selected.id),
            false,
          )
        } else {
          await until(() =>
            collector.records
              .slice(first)
              .some(
                (record) => record.id === trial.selected.id && record.finished,
              ),
          )
          await page.waitForFunction(() => window.probe.retained() === 0)
          await until(() =>
            events.some(
              (event) =>
                ['stored-digest', 'admission-digest'].includes(event.kind) &&
                event.id === trial.selected.id,
            ),
          )
          const digest = events.find(
            (event) =>
              ['stored-digest', 'admission-digest'].includes(event.kind) &&
              event.id === trial.selected.id,
          )
          const receipt = collector.records
            .slice(first)
            .find(
              (record) =>
                record.id === trial.selected.id &&
                record.sha256 === digest.sha256 &&
                record.bytes === digest.bytes,
            )
          assert.ok(
            receipt,
            'Receipt must match actual persisted bytes and SHA-256',
          )
          trial.matchedDigest = digest.sha256
        }
        trial.receipts = collector.records
          .slice(first)
          .filter((record) => record.id === trial.selected.id)
        trial.console = observe()
        trial.registrations = events.filter(
          (event) => event.kind === 'register',
        )
        assert.ok(
          trial.registrations.every((event) => event.leaving === false),
          'No registration may start after departure',
        )
        assert.deepEqual(trial.console.fatal, [])
        trial.phase = 'passed'
      } catch (error) {
        trial.failure = { name: error.name, message: error.message }
        trial.receipts = collector.records
          .slice(first)
          .filter((record) => record.id === trial.selected?.id)
        process.exitCode = 1
      } finally {
        await context.close()
      }
      process.stderr.write(
        JSON.stringify({
          engine,
          timing,
          repetition,
          phase: trial.phase,
          receipts: trial.receipts.length,
          failure: trial.failure,
        }) + '\n',
      )
    }
  for (const mode of ['204', '413', '429', '503', 'buffer']) {
    workerDelay = 0
    collector.policy.status = 204
    collector.policy.delay = mode === 'buffer' ? 500 : 10
    collector.policy.rateLimit = ''
    const context = await browser.newContext({ serviceWorkers: 'allow' })
    const events = []
    const control = { mode, events, phase: 'started' }
    report.controls.push(control)
    const first = collector.records.length
    try {
      await context.route(
        (url) => ![origin, collectorOrigin].includes(url.origin),
        (route) => route.abort(),
      )
      const page = await context.newPage()
      const observe = watchConsole(page, {
        name: 'recovery-response-control',
        path: '/',
      })
      await page.exposeFunction('reportRecovery', (event) => events.push(event))
      await page.goto(origin)
      await page.waitForFunction(() => window.probe !== undefined)
      // Let the real client's automatic pageload finish before measuring forty controlled sends.
      await wait(2000)
      await page.evaluate(() => window.probe.flush())
      collector.policy.status = mode === 'buffer' ? 204 : Number(mode)
      collector.policy.rateLimit =
        mode === '429' ? '60:transaction:organization' : ''
      if (mode === 'buffer') {
        const selected = await page.evaluate(() =>
          Array.from({ length: 41 }, () => window.probe.send(100)),
        )
        assert.equal(selected.filter((entry) => entry.admitted).length, 40)
        await until(
          () =>
            events.filter(
              (event) =>
                event.kind === 'sdk-response' &&
                event.status === 204 &&
                selected.some((entry) => entry.id === event.id),
            ).length === 40,
        )
        await until(() =>
          events.some(
            (event) =>
              event.kind === 'sdk-response' &&
              event.id === selected[40].id &&
              event.status === null,
          ),
        )
        await page.waitForFunction(() => window.probe.retained() === 0)
        control.accepted = 40
        control.overflow = 1
      } else {
        const selected = await page.evaluate(() => window.probe.send(100))
        await until(() =>
          events.some(
            (event) =>
              event.kind === 'sdk-response' &&
              event.id === selected.id &&
              event.status === Number(mode),
          ),
        )
        await page.waitForFunction(() => window.probe.retained() === 0)
        if (mode === '429') {
          const second = await page.evaluate(() => window.probe.send(100))
          assert.equal(second.admitted, false)
          await until(() =>
            events.some(
              (event) =>
                event.kind === 'sdk-response' &&
                event.id === second.id &&
                event.status === null,
            ),
          )
          assert.equal(
            collector.records
              .slice(first)
              .some((record) => record.id === second.id),
            false,
          )
          control.backoffFiltered = true
        }
      }
      control.receipts = collector.records.slice(first)
      control.console = observe()
      control.phase = 'passed'
    } catch (error) {
      control.failure = { name: error.name, message: error.message }
      process.exitCode = 1
    } finally {
      await context.close()
    }
  }
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  process.exitCode = 1
} finally {
  clearTimeout(lifetime)
  await browser?.close()
  await collector?.close()
  for (const timer of timers) clearTimeout(timer)
  server?.closeAllConnections()
  if (server) await new Promise((resolve) => server.close(resolve))
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}
