/**
 * The claims in the Worker's Sentry wiring that are worth a failing test rather than a comment.
 *
 * That an absent DSN is an ordinary, supported state: a machine with no secret has to run this
 * same code and report nothing, or `pnpm dev` and every fork's CI stop working.
 *
 * And that the sink is selective. `withSentry` reports what escapes a handler; this sink reports
 * what the code caught and logged as an error, and only that - a `warn` is a thing the code
 * expected, and an issue for every one of them is how an issue stream stops being read.
 *
 * What leaves the Worker is scrubbed by `src/lib/sentry-scrub.ts`, which the browser shares and
 * which is tested there.
 */

import { describe, expect, it, vi } from 'vitest'

import { createMemorySink } from '../logger'
import {
  sentryDsn,
  sentryOptions,
  sentrySink,
  teeSink,
  workerSink,
} from '../sentry'

import type { LogRecord } from '../logger'

const captureMessage = vi.hoisted(() => vi.fn())

vi.mock('@sentry/cloudflare', () => ({ captureMessage }))

function record(level: LogRecord['level'], msg = 'boom'): LogRecord {
  return {
    ts: '2026-08-29T00:00:00.000Z',
    level,
    msg,
    service: 'planned-travel',
  }
}

describe('sentryOptions', () => {
  it('reports nothing when no DSN is configured', () => {
    expect(sentryDsn({})).toBeUndefined()
    expect(sentryOptions({}).dsn).toBeUndefined()
    // An empty string is what an unset key in `.dev.vars` actually produces.
    expect(sentryOptions({ SENTRY_DSN: '' }).dsn).toBeUndefined()
  })

  it('carries the environment, and the Cloudflare version as a tag rather than the release', () => {
    const options = sentryOptions({
      SENTRY_DSN: 'https://k@o.ingest.sentry.io/1',
      ENVIRONMENT: 'production',
      CF_VERSION_METADATA: { id: 'abc123' },
    })

    expect(options.environment).toBe('production')
    expect(options.sendDefaultPii).toBe(false)
    expect(options.initialScope).toEqual({ tags: { cf_version: 'abc123' } })
  })

  it('survives a missing or malformed version binding rather than throwing on boot', () => {
    const dsn = 'https://k@o.ingest.sentry.io/1'
    expect(sentryOptions({ SENTRY_DSN: dsn }).initialScope).toBeUndefined()
    expect(
      sentryOptions({ SENTRY_DSN: dsn, CF_VERSION_METADATA: 'nope' })
        .initialScope,
    ).toBeUndefined()
  })

  it('samples traces on production and keeps all of them on staging', () => {
    const dsn = 'https://k@o.ingest.sentry.io/1'
    expect(
      sentryOptions({ SENTRY_DSN: dsn, ENVIRONMENT: 'production' })
        .tracesSampleRate,
    ).toBe(0.1)
    expect(
      sentryOptions({ SENTRY_DSN: dsn, ENVIRONMENT: 'staging' })
        .tracesSampleRate,
    ).toBe(1)
  })
})

describe('sentrySink', () => {
  it('reports an error record', () => {
    captureMessage.mockClear()
    sentrySink().write(record('error', 'task dead-lettered'))

    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0][0]).toBe('task dead-lettered')
    expect(captureMessage.mock.calls[0][1]).toMatchObject({ level: 'error' })
  })

  it('ignores everything below error, so a handled warning is not an issue', () => {
    captureMessage.mockClear()
    const sink = sentrySink()
    sink.write(record('debug'))
    sink.write(record('info'))
    sink.write(record('warn'))

    expect(captureMessage).not.toHaveBeenCalled()
  })
})

describe('workerSink', () => {
  it('writes to every sink it was given', () => {
    const a = createMemorySink()
    const b = createMemorySink()
    teeSink(a, b).write(record('info'))

    expect(a.records).toHaveLength(1)
    expect(b.records).toHaveLength(1)
  })

  it('does not reach for Sentry when there is no DSN to reach it with', () => {
    captureMessage.mockClear()
    workerSink({}).write(record('error'))

    expect(captureMessage).not.toHaveBeenCalled()
  })
})
