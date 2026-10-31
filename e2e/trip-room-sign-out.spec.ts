import { randomUUID } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from '@playwright/test'
import { watchConsole } from './helpers/console'
import { DEMO_PASSWORD, signIn } from './helpers/session'
import { settle } from './helpers/settle'

// This journey creates undated data; the fixture clock header must not reach font/telemetry origins.
test.use({ extraHTTPHeaders: {}, actionTimeout: 30_000 })

/** This fixture owns its account and trip: signing out cannot evict another journey's sockets. */
test('signing out on one device reconnects the other without losing its draft @chromium-only', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000)
  const email = `room-sign-out-${randomUUID()}@example.test`
  const name = 'Room sign-out traveller'
  const deviceA = await browser.newContext({ baseURL })
  const deviceB = await browser.newContext({ baseURL })
  try {
    // Telemetry ingestion is outside this journey and throttles repeated local runs.
    for (const device of [deviceA, deviceB]) {
      await device.route(
        /^https:\/\/[^/]+\.ingest(?:\.[^/]+)?\.sentry\.io\/api\/\d+\/envelope\//,
        (route) => route.fulfill({ status: 204 }),
      )
    }
    const a = await deviceA.newPage()
    const signup = await a.request.post('/api/auth/sign-up/email', {
      headers: { origin: baseURL ?? '' },
      data: { email, name, password: DEMO_PASSWORD },
    })
    expect(signup.status()).toBe(200)
    // The local fixture has no inbox; verify only the account this journey just created.
    const db = localFixtureDb()
    try {
      const verified = db
        .prepare('update user set email_verified = 1 where email = ?')
        .run(email)
      expect(verified.changes).toBe(1)
    } finally {
      db.close()
    }
    await deviceA.clearCookies()
    expect(await signIn(a, baseURL, email)).toBe(true)
    const b = await deviceB.newPage()
    expect(await signIn(b, baseURL, email)).toBe(true)

    await a.goto('/trips', { waitUntil: 'domcontentloaded' })
    await settle(a, { name: 'trips', path: '/trips', ready: 'main' })
    await a
      .getByRole('button', { name: 'New trip', exact: true })
      .first()
      .click()
    const dialog = a.getByRole('dialog')
    await dialog.getByLabel('Trip name').fill('Two-device room fixture')
    await dialog
      .getByRole('button', { name: 'Create trip', exact: true })
      .click()
    await expect(a).toHaveURL(/\/trips\/[^/]+\/plan(?:\?|$)/)
    const path = new URL(a.url()).pathname.replace(/\/plan$/, '/collab')
    // Release the setup page's renderer; only device B needs the trip open during sign-out.
    await a.goto('about:blank')
    const route = {
      name: 'trip-room-sign-out',
      path,
      ready: 'main',
    }
    const consoleReport = watchConsole(b, route)
    const connections: Array<{ closed: boolean; welcomed: boolean }> = []
    b.on('websocket', (socket) => {
      if (!socket.url().includes('/api/trip-room/')) return
      const connection = { closed: false, welcomed: false }
      connections.push(connection)
      socket.on('close', () => {
        connection.closed = true
      })
      socket.on('framereceived', ({ payload }) => {
        const message: unknown = JSON.parse(payload.toString())
        if (
          typeof message === 'object' &&
          message !== null &&
          't' in message &&
          message.t === 'welcome'
        ) {
          connection.welcomed = true
        }
      })
    })
    await b.goto(path, { waitUntil: 'domcontentloaded' })
    await settle(b, route)
    const live = b.getByRole('status').filter({ hasText: /^Live$/ })
    await expect(live).toBeVisible({ timeout: 30_000 })
    const original = connections.find(
      (connection) => connection.welcomed && !connection.closed,
    )
    expect(original, 'device B joined a real TripRoom socket').toBeDefined()
    const draft = b.getByRole('textbox', {
      name: 'Message the trip',
      exact: true,
    })
    const text = 'Keep this unsent draft while the other device signs out.'
    await draft.fill(text)
    const beforeSignout = connections.length

    const signout = await a.request.post('/api/auth/sign-out', {
      headers: { origin: baseURL ?? '' },
      data: {},
    })
    expect(signout.status()).toBe(200)
    // The queue batches for five seconds. Observe the real close and new welcome, not fleeting copy.
    await expect
      .poll(
        () =>
          original?.closed === true &&
          connections
            .slice(beforeSignout)
            .some((connection) => connection.welcomed && !connection.closed),
        { timeout: 30_000 },
      )
      .toBe(true)
    await expect(live).toBeVisible({ timeout: 30_000 })
    await expect(draft).toHaveValue(text)
    expect(consoleReport().fatal, 'device B has no console errors').toEqual([])
  } finally {
    await deviceA.close()
    await deviceB.close()
  }
})

/** Same local D1 fixture seam as workspace-departure.spec.ts; never a remote database. */
function localFixtureDb(): DatabaseSync {
  const directory = join(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
  )
  const filename = readdirSync(directory).find(
    (entry) => entry !== 'metadata.sqlite' && entry.endsWith('.sqlite'),
  )
  if (!filename) throw new Error('Local D1 fixture has not been provisioned')
  const db = new DatabaseSync(join(directory, filename))
  db.exec('PRAGMA busy_timeout = 5000')
  return db
}
