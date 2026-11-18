import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const execute = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))
const enginePath = fileURLToPath(
  new URL('../../e2e/driver/engine.ts', import.meta.url),
)
const directories = []
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

describe('the public browser engine cannot report a false green result', () => {
  for (const mode of ['assertion', 'timeout', 'teardown', 'profile']) {
    it(
      `verifies ${mode} through the real e2e CLI`,
      {
        timeout: 70000,
        skip:
          mode === 'profile' &&
          Boolean(process.env.CI && !['0', 'false'].includes(process.env.CI)) &&
          process.env.E2E_WEBKIT !== '1',
      },
      async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pt-engine-probe-'))
        directories.push(directory)
        const server = createServer((_req, res) => res.end('probe'))
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
        const origin = `http://127.0.0.1:${server.address().port}`
        const config = join(directory, 'e2e.config.ts')
        const testFile = join(directory, 'probe.e2e.ts')
        // Resolve public packages from this checkout while leaving all probe output disposable.
        const e2ePath = fileURLToPath(import.meta.resolve('e2e'))
        const pwPath = fileURLToPath(import.meta.resolve('@playwright/test'))
        await writeFile(
          config,
          `import { browserJourneyEngine } from ${JSON.stringify(enginePath)}\nconst engine = browserJourneyEngine('${mode === 'profile' ? 'webkit' : 'chromium'}')\nexport default { tests: 'probe.e2e.ts', targets: [{name: '${mode === 'profile' ? 'mobile-safari' : 'chromium'}', engine, app: { url: ${JSON.stringify(origin)} }}], output: ${JSON.stringify(join(directory, 'output'))}, workers: 1, retries: 0, timeout: 10000, cleanupTimeout: 10000, reporters: ['list'], trace: 'retain-on-failure' }\n`,
        )
        await writeFile(
          testFile,
          `import { test as core } from ${JSON.stringify(e2ePath)}\nimport { expect } from ${JSON.stringify(pwPath)}\nconst test = core.extend()\n${mode === 'teardown' ? "test.afterEach(async () => { throw new Error('probe teardown failed') })" : ''}\n${mode === 'timeout' ? "test.describe('serial cancellation', { serial: true }, () => {" : ''}\ntest('probe', { timeout: ${mode === 'timeout' ? 2000 : 10000} }, async ({ journey }) => {\n const driver = await journey.prepare({})\n await journey.run('probe', async () => {\n  await driver.page.setContent('<body style="background:white">wrong page</body>')\n  const failurePage = await driver.context.newPage()\n  await failurePage.setContent('<body style="background:red"><h1>actual failure page</h1><input type="password" value="hidden"></body>')\n  await failurePage.screenshot({path: driver.runInfo.outputPath('expected.png'), mask: [failurePage.locator('input[type="password"]')]})\n  ${
            mode === 'profile'
              ? `const other = await driver.browser.newContext()
 const otherPage = await other.newPage()
 await otherPage.goto('/')
 expect(otherPage.viewportSize()).toEqual({ width: 393, height: 659 })
 expect(await otherPage.evaluate(() => ({ touch: 'ontouchstart' in window, coarse: matchMedia('(pointer: coarse)').matches, scale: devicePixelRatio, locale: navigator.language, zone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({touch: true, coarse: true, scale: 3, locale: 'en-GB', zone: 'UTC'})
 await driver.context.addCookies([{name: 'isolation', value: 'owner', url: driver.baseURL}])
 expect(await other.cookies()).toEqual([])
 const client = await driver.playwright.request.newContext()
 expect((await client.get('/')).ok()).toBe(true)
 expect(await otherPage.evaluate(() => navigator.userAgent)).toContain('iPhone')`
              : mode === 'assertion'
                ? "expect(await failurePage.locator('h1').textContent()).toBe('intentional mismatch')"
                : mode === 'timeout'
                  ? 'await failurePage.waitForTimeout(20000)'
                  : "expect(await failurePage.locator('h1').textContent()).toBe('actual failure page')"
          }\n })\n})\n${mode === 'timeout' ? '})' : ''}\n`,
        )
        let exit = 0
        let diagnostics = ''
        try {
          await execute('pnpm', ['exec', 'e2e', 'run', '--config', config], {
            cwd: root,
            env: { ...process.env, CI: 'true' },
            timeout: 60000,
            maxBuffer: 1024 * 1024,
          })
        } catch (error) {
          exit = error.code
          diagnostics = `${error.stdout}\n${error.stderr}`
        } finally {
          await new Promise((resolve) => server.close(resolve))
        }
        assert.equal(exit, mode === 'profile' ? 0 : 1, diagnostics)
        const report = JSON.parse(
          await readFile(join(directory, 'output/report.json'), 'utf8'),
        )
        assert.equal(report.run.summary.failed, mode === 'profile' ? 0 : 1)
        assert.equal(report.run.summary.passed, mode === 'profile' ? 1 : 0)
        if (mode === 'teardown')
          assert.match(JSON.stringify(report), /probe teardown failed/)
        if (mode === 'assertion' || mode === 'timeout') {
          const { readdir } = await import('node:fs/promises')
          const files = await readdir(join(directory, 'output/results'), {
            recursive: true,
          })
          const expected = files.find((file) => file.endsWith('/expected.png'))
          const screenshot = files.find((file) =>
            /screenshots\/\d+-browser.png$/.test(file),
          )
          assert.ok(
            screenshot,
            'the failure must retain its actual active page',
          )
          assert.deepEqual(
            await readFile(join(directory, 'output/results', screenshot)),
            await readFile(join(directory, 'output/results', expected)),
          )
        }
      },
    )
  }
})
