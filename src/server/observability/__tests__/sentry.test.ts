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

const sentryLogger = vi.hoisted(() => ({
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
}))
const distribution = vi.hoisted(() => vi.fn())

vi.mock('@sentry/cloudflare', () => ({
  logger: sentryLogger,
  metrics: { distribution },
}))

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

it('redacts calendar credentials in each independently wired Sentry channel', async () => {
  const options = sentryOptions({})
  const secret = 'A'.repeat(32)
  const url = `https://planned.travel/api/feed/${secret}.ics`
  const event = await options.beforeSend?.(
    { type: undefined, request: { url } },
    {},
  )
  const transaction = await options.beforeSendTransaction?.(
    { type: 'transaction', transaction: url },
    {},
  )
  const span = options.beforeSendSpan?.({
    trace_id: '1'.repeat(32),
    span_id: '2'.repeat(16),
    start_timestamp: 0,
    timestamp: 1,
    description: url,
    data: { url },
  })
  const log = options.beforeSendLog?.({
    level: 'info',
    message: url,
    attributes: { url },
  })
  for (const result of [event, transaction, span, log]) {
    expect(result).toBeDefined()
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).toContain('[redacted]')
  }
})

describe('sentrySink', () => {
  it('mirrors a record into Sentry at its own level', () => {
    sentryLogger.error.mockClear()
    sentrySink().write(record('error', 'task dead-lettered'))

    expect(sentryLogger.error).toHaveBeenCalledTimes(1)
    expect(sentryLogger.error.mock.calls[0][0]).toBe('task dead-lettered')
  })

  it('mirrors every level, because context is the point of a log stream', () => {
    for (const fn of Object.values(sentryLogger)) fn.mockClear()
    const sink = sentrySink()
    sink.write(record('debug'))
    sink.write(record('info'))
    sink.write(record('warn'))

    expect(sentryLogger.debug).toHaveBeenCalledTimes(1)
    expect(sentryLogger.info).toHaveBeenCalledTimes(1)
    expect(sentryLogger.warn).toHaveBeenCalledTimes(1)
  })

  it('raises no issue of its own', () => {
    // Issues come from `captureException` at the point an error is caught, and from nowhere else.
    // Reporting here as well made one server-function failure look like two unrelated problems.
    const sentry = sentryLogger as unknown as Record<string, unknown>
    expect(sentry.captureMessage).toBeUndefined()
    expect(sentry.captureException).toBeUndefined()
  })

  it('records a timed operation as a distribution, from data the record already carries', () => {
    distribution.mockClear()
    sentrySink().write({
      ...record('info', 'pdf export'),
      durationMs: 412,
      outcome: 'ok',
    })

    expect(distribution).toHaveBeenCalledTimes(1)
    const [name, value, options] = distribution.mock.calls[0]
    expect(name).toBe('operation.duration')
    expect(value).toBe(412)
    expect(options).toMatchObject({
      unit: 'millisecond',
      attributes: { operation: 'pdf export', outcome: 'ok' },
    })
  })

  it('records nothing for a line that timed nothing', () => {
    distribution.mockClear()
    sentrySink().write(record('info'))

    expect(distribution).not.toHaveBeenCalled()
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
    sentryLogger.error.mockClear()
    workerSink({}).write(record('error'))

    expect(sentryLogger.error).not.toHaveBeenCalled()
  })
})
