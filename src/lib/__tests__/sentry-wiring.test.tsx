/**
 * That each browser-side Sentry channel is routed through the redaction, and not just the one that
 * was wired first. The Worker's half is pinned in `src/server/observability/__tests__/sentry.test.ts`.
 *
 * What it pins is the wiring, not the patterns: `sentry-scrub.test.ts` owns what is redacted.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Event } from '@sentry/react'

const secret = 'Zk3-Join_Secret42'
const url = `https://planned.travel/join/${secret}`

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  addIntegration: vi.fn(),
  replayIntegration: vi.fn((options: unknown) => ({ name: 'Replay', options })),
  addEventProcessor: vi.fn(),
}))

vi.mock('@sentry/react', () => ({
  ...sentry,
  getClient: () => ({ addEventProcessor: sentry.addEventProcessor }),
}))
vi.mock('@tanstack/react-start/client', () => ({ StartClient: () => null }))
vi.mock('react-dom/client', () => ({ hydrateRoot: vi.fn() }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock('#/lib/sentry-replay')
  vi.resetModules()
  for (const fn of Object.values(sentry)) fn.mockClear()
})

describe('the browser entry', () => {
  it('routes events, transactions, spans, logs and breadcrumbs through the redaction', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@o.ingest.sentry.io/1')
    vi.doMock('#/lib/sentry-replay', () => ({ startSessionReplay: vi.fn() }))
    await import('../../client')

    const options = sentry.init.mock.calls[0][0]
    const results = [
      options.beforeSend({
        request: { url, headers: { Referer: url } },
      }),
      options.beforeSendTransaction({
        transaction: `/join/${secret}`,
        request: { headers: { Referer: url } },
      }),
      options.beforeSendSpan({ description: `GET ${url}` }),
      options.beforeSendLog({ message: url }),
      options.beforeBreadcrumb({ category: 'navigation', data: { to: url } }),
    ]
    for (const result of results) {
      expect(JSON.stringify(result)).not.toContain(secret)
      expect(JSON.stringify(result)).not.toContain('eferer')
    }
  })
})

describe('session replay', () => {
  async function start() {
    const replay = await import('../sentry-replay')
    replay.startSessionReplay()
    return {
      options: sentry.replayIntegration.mock.calls[0][0] as {
        beforeAddRecordingEvent: (event: unknown) => unknown
        networkDetailDenyUrls: Array<RegExp>
      },
      processor: sentry.addEventProcessor.mock.calls[0][0] as (
        event: Event,
      ) => Event,
    }
  }

  it('redacts navigation and network recording events', async () => {
    const { options } = await start()
    const event = {
      type: 5,
      timestamp: 1,
      data: {
        tag: 'performanceSpan',
        payload: { op: 'navigation.push', description: url },
      },
    }

    const scrubbed = options.beforeAddRecordingEvent(event)

    expect(JSON.stringify(scrubbed)).not.toContain(secret)
    expect(JSON.stringify(scrubbed)).toContain('/join/[redacted]')
  })

  it('redacts the replay event envelope the SDK builds around a recording', async () => {
    const { processor } = await start()

    const scrubbed = processor({
      type: 'replay_event',
      urls: [url],
      request: { url, headers: { Referer: url } },
    } as unknown as Event)

    expect(JSON.stringify(scrubbed)).not.toContain(secret)
    expect(JSON.stringify(scrubbed)).not.toContain('eferer')
  })

  it('leaves every other event type to its own hooks', async () => {
    const { processor } = await start()
    const event = { type: undefined, message: 'boom' } as Event

    expect(processor(event)).toBe(event)
  })

  it('never captures network details for a join url', async () => {
    const { options } = await start()

    expect(options.networkDetailDenyUrls.some((p) => p.test(url))).toBe(true)
    expect(
      options.networkDetailDenyUrls.some((p) =>
        p.test('https://planned.travel/api/trips'),
      ),
    ).toBe(false)
  })

  it('keeps the existing masking', async () => {
    const { options } = await start()

    expect(options).toMatchObject({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    })
  })
})
