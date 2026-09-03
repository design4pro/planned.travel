/**
 * The Worker's clock, driven the way the runtime drives it.
 *
 * `serverToday()` reads its pin through `getRequest()`, which resolves an
 * `AsyncLocalStorage` store that only the framework's own `requestHandler()`
 * installs. So these tests use that handler rather than mocking the module: the
 * "inside a request" cases run in a real request scope with real headers, and
 * the "no request" cases run outside one, where `getRequest()` genuinely throws.
 * A mock would have proved the arrangement of this file instead of the
 * behaviour of the cron trigger, the queue consumer and the Durable Object
 * alarm, which are exactly the callers with no request to read.
 *
 * The wall clock is faked rather than tolerated, because "returns today" is only
 * a real assertion if the test knows what today is.
 */
import { readFileSync } from 'node:fs'
import { requestHandler } from '@tanstack/react-start/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { serverToday } from '../clock'

/**
 * The wire name of the pin, duplicated on purpose.
 *
 * `src/server/clock.ts` keeps the literal inside its dev-only branch so the
 * production build drops it, and `playwright.config.ts` cannot import from
 * `src/` at all. Three copies of a string is the price of that; the last case in
 * this file is what stops them drifting apart in silence.
 */
const PIN_HEADER = 'x-pt-server-today'

/** A day far from any real one, so a leaked wall-clock read is unmistakable. */
const WALL_CLOCK_NOW = '2029-03-01T23:30:00.000Z'
const WALL_CLOCK_DAY = '2029-03-01'

/**
 * Run `read` inside a real request scope, with the given headers.
 *
 * `requestHandler()` is the same wrapper the Cloudflare entry point uses, so the
 * store the callback sees is the store production sees.
 */
async function duringRequest(
  headers: Record<string, string>,
  read: () => string,
): Promise<string> {
  let answer = ''
  const handle = requestHandler(() => {
    answer = read()
    return new Response(null, { status: 204 })
  })
  await handle(new Request('https://planned.travel/dashboard', { headers }), {})
  return answer
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(WALL_CLOCK_NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('serverToday', () => {
  it('runs the tests in a build where the pin is compiled in at all', () => {
    // The pin is guarded by `import.meta.env.DEV`, which Vite folds to a
    // literal. If that ever became `false` here, every assertion below about a
    // honoured pin would pass vacuously by falling through to the wall clock.
    expect(import.meta.env.DEV).toBe(true)
  })

  it('honours a pinned day sent on the request', async () => {
    await expect(
      duringRequest({ [PIN_HEADER]: '2026-08-20' }, serverToday),
    ).resolves.toBe('2026-08-20')
  })

  it('honours a pin on a day the wall clock is nowhere near', async () => {
    await expect(
      duringRequest({ [PIN_HEADER]: '2019-12-31' }, serverToday),
    ).resolves.toBe('2019-12-31')
  })

  it('reads the header case-insensitively, as HTTP requires', async () => {
    await expect(
      duringRequest({ 'X-PT-Server-Today': '2026-08-20' }, serverToday),
    ).resolves.toBe('2026-08-20')
  })

  it('falls back to the wall clock when the header is absent', async () => {
    await expect(duringRequest({}, serverToday)).resolves.toBe(WALL_CLOCK_DAY)
  })

  it('ignores a header that is not present but empty', async () => {
    await expect(
      duringRequest({ [PIN_HEADER]: '' }, serverToday),
    ).resolves.toBe(WALL_CLOCK_DAY)
  })

  it.each([
    ['a word', 'today'],
    ['a slashed date', '2026/08/20'],
    ['a day-first date', '20-08-2026'],
    ['an unpadded month', '2026-8-20'],
    ['a two-digit year', '26-08-20'],
    ['a full timestamp', '2026-08-20T00:00:00.000Z'],
    ['a value with an embedded space', '2026-08 20'],
    ['a month that does not exist', '2026-13-01'],
    ['a day that does not exist', '2026-02-30'],
    ['a leap day in a common year', '2026-02-29'],
    ['an injected second value', '2026-08-20,2026-08-21'],
  ])('ignores %s and falls back to the wall clock', async (_case, value) => {
    await expect(
      duringRequest({ [PIN_HEADER]: value }, serverToday),
    ).resolves.toBe(WALL_CLOCK_DAY)
  })

  it('accepts a real leap day', async () => {
    await expect(
      duringRequest({ [PIN_HEADER]: '2028-02-29' }, serverToday),
    ).resolves.toBe('2028-02-29')
  })

  it('returns the wall-clock day when no request is in scope', () => {
    // The cron trigger, the queue consumer and the `TripRoom` alarm all run
    // here: no caller, no headers, nothing to be pinned by.
    expect(serverToday()).toBe(WALL_CLOCK_DAY)
  })

  it('does not throw when no request is in scope, though getRequest does', async () => {
    const { getRequest } = await import('@tanstack/react-start/server')
    expect(() => getRequest()).toThrow()
    expect(() => serverToday()).not.toThrow()
  })

  it('reads the day in UTC, not in the runtime local zone', async () => {
    // 23:30Z on the 1st is already the 2nd east of Greenwich and still the 1st
    // west of it. The schema stores UTC days, so the answer must not move with
    // wherever the Worker happened to run.
    vi.setSystemTime(new Date('2029-03-01T23:30:00.000Z'))
    expect(serverToday()).toBe('2029-03-01')
    vi.setSystemTime(new Date('2029-03-02T00:30:00.000Z'))
    expect(serverToday()).toBe('2029-03-02')
    await expect(duringRequest({}, serverToday)).resolves.toBe('2029-03-02')
  })

  it('agrees with the header the e2e suite actually sends', () => {
    // `playwright.config.ts` writes the name and the day as literals because a
    // Playwright config cannot resolve the `#/` alias into `src/`. Two files, one
    // wire: this is what stops them drifting apart in silence, which they would
    // otherwise do as a green run reading the wrong day.
    //
    // There used to be a third copy in the e2e helpers, for a calendar
    // audit that measured the screenshot baselines against it. The baselines are
    // gone (ADR 0016) and so is the copy; the pin is not, because the fixture
    // drains without it.
    const read = (file: string): string =>
      readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8')
    const config = read('playwright.config.ts')
    expect(config).toContain(`const SERVER_TODAY_HEADER = '${PIN_HEADER}'`)

    const pinned = /const FIXTURE_DAY = '(\d{4}-\d{2}-\d{2})'/.exec(config)
    expect(pinned?.[1], 'playwright.config.ts pins no fixture day').toBeTypeOf(
      'string',
    )
  })
})
