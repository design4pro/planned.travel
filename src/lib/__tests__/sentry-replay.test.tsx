/**
 * The recorder and a trip invite link. A replay stores the DOM, and a link on a join page holds the
 * secret in its `href` where no text mask reaches, so the only safe recording of a join location is
 * none - the page, and a sign-in page whose `redirect` or `callbackURL` carries it, at any encoding
 * depth, whether the recorder would have been sending or only buffering for an error.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const secret = 'Zk3-Join_Secret42'

const sentry = vi.hoisted(() => ({
  addIntegration: vi.fn(),
  replayIntegration: vi.fn((options: unknown) => ({
    name: 'Replay',
    options,
    stop: vi.fn(async () => {}),
  })),
}))

vi.mock('@sentry/react', () => sentry)

const originalPush = window.history.pushState
const originalReplace = window.history.replaceState

async function start(path: string) {
  window.history.replaceState(null, '', path)
  const { startSessionReplay } = await import('../sentry-replay')
  startSessionReplay()
  return sentry.replayIntegration.mock.results[0]?.value as {
    options: { beforeAddRecordingEvent: (event: unknown) => unknown }
    stop: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  vi.resetModules()
  sentry.addIntegration.mockClear()
  sentry.replayIntegration.mockClear()
})

afterEach(() => {
  window.history.pushState = originalPush
  window.history.replaceState = originalReplace
  window.history.replaceState(null, '', '/')
})

describe('startSessionReplay', () => {
  it('records an ordinary page', async () => {
    await start('/trips')
    expect(sentry.addIntegration).toHaveBeenCalledOnce()
  })

  it.each([
    ['the join page', `/join/${secret}`],
    [
      'a sign-in page carrying it in redirect',
      `/login?redirect=${encodeURIComponent(`/join/${secret}`)}`,
    ],
    [
      'one carrying it in callbackURL',
      `/register?callbackURL=${encodeURIComponent(`/join/${secret}`)}`,
    ],
    [
      'one encoded twice',
      `/login?redirect=${encodeURIComponent(encodeURIComponent(`/join/${secret}`))}`,
    ],
    [
      'one encoded three times',
      `/login?redirect=${encodeURIComponent(encodeURIComponent(encodeURIComponent(`/join/${secret}`)))}`,
    ],
  ])('never starts on %s', async (_label, path) => {
    await start(path)
    expect(sentry.addIntegration).not.toHaveBeenCalled()
  })

  it('stops the recorder, and drops what it had buffered, when a navigation reaches a join location', async () => {
    const replay = await start('/trips')
    window.history.pushState(null, '', `/join/${secret}`)
    expect(replay.stop).toHaveBeenCalledWith({ flush: false })
  })

  it('stops on a sign-in page that carries the link, reached by navigation', async () => {
    const replay = await start('/trips')
    window.history.pushState(
      null,
      '',
      `/login?redirect=${encodeURIComponent(`/join/${secret}`)}`,
    )
    expect(replay.stop).toHaveBeenCalledOnce()
  })

  it('does not start again when the visitor navigates away from a join location', async () => {
    await start(`/join/${secret}`)
    window.history.pushState(null, '', '/trips')
    expect(sentry.addIntegration).not.toHaveBeenCalled()
  })

  it('drops every recording event while the address holds a join path, and scrubs the rest', async () => {
    const replay = await start('/trips')
    const event = { data: { href: `https://planned.travel/join/${secret}` } }
    expect(
      JSON.stringify(replay.options.beforeAddRecordingEvent(event)),
    ).not.toContain(secret)
    window.history.pushState(null, '', `/join/${secret}`)
    expect(replay.options.beforeAddRecordingEvent(event)).toBeNull()
  })
})
