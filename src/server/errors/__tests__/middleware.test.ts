/**
 * The boundary itself, exercised the way the runtime reaches it.
 *
 * This is the test for the report that started this work: a failing D1 statement put its SQL on the
 * screen, because the thrown message crossed to the browser intact and the error panel rendered it.
 * The assertion that matters is the negative one - the query is not in what crosses - so it is made
 * against the actual thrown value rather than against a classification.
 */

import { describe, expect, it, vi } from 'vitest'

import { readPublicFailure } from '#/lib/errors'
import { QuotaExceededError as BillingQuotaExceededError } from '#/server/billing/types'
import { QuotaExceededError } from '#/server/repos/context'

const captureException = vi.hoisted(() => vi.fn(() => 'sentry-event-id'))
const count = vi.hoisted(() => vi.fn())
const logged = vi.hoisted(() => [] as Array<{ msg: string; cause: unknown }>)
const dsn = vi.hoisted(() => ({ configured: undefined as string | undefined }))

vi.mock('cloudflare:workers', () => ({ env: {} }))
vi.mock('@sentry/cloudflare', () => ({ captureException, metrics: { count } }))
vi.mock('#/server/observability/sentry', () => ({
  sentryDsn: () => dsn.configured,
  workerLogger: () => ({
    error: (msg: string, cause: unknown) => logged.push({ msg, cause }),
  }),
}))

const { failureRedactionMiddleware } = await import('../middleware')

/** Runs the middleware over a `next` that throws, and returns what the caller would receive. */
async function throughBoundary(cause: unknown): Promise<unknown> {
  const server = failureRedactionMiddleware.options.server as (ctx: {
    next: () => Promise<unknown>
  }) => Promise<unknown>
  try {
    await server({
      next: () => Promise.reject(cause),
    })
  } catch (thrown) {
    return thrown
  }
  throw new Error('the middleware swallowed a failure instead of rethrowing it')
}

const D1_FAILURE = new Error(
  'D1_ERROR: no such column: trips.archived_at at offset 42: SELECT "trips"."id", "trips"."archived_at" FROM "trips" WHERE "trips"."organization_id" = ?',
)

describe('a diagnostic never crosses the boundary', () => {
  it('does not carry the SQL, the table names or the original text', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'
    const thrown = await throughBoundary(D1_FAILURE)
    const message = (thrown as Error).message

    expect(message).not.toContain('SELECT')
    expect(message).not.toContain('trips')
    expect(message).not.toContain('D1_ERROR')
    expect(message).not.toContain('archived_at')
  })

  it('carries a reference, and reports the real error under it', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'
    captureException.mockClear()
    logged.length = 0

    const failure = readPublicFailure(await throughBoundary(D1_FAILURE))

    expect(failure.kind).toBe('unexpected')
    expect(failure.message).toBeUndefined()
    expect(failure.reference).toBe('sentry-event-id')
    expect(captureException).toHaveBeenCalledWith(D1_FAILURE)
    // The full diagnostic still has to land somewhere a maintainer can read it.
    expect(logged).toHaveLength(1)
    expect(logged[0].cause).toBe(D1_FAILURE)
  })

  it('still offers a reference when Sentry is not configured', async () => {
    dsn.configured = undefined
    captureException.mockClear()

    const failure = readPublicFailure(await throughBoundary(D1_FAILURE))

    expect(captureException).not.toHaveBeenCalled()
    expect(failure.reference).toEqual(expect.any(String))
    expect(failure.reference).not.toBe('')
  })
})

describe('authored copy crosses intact', () => {
  it('passes a refusal through without reporting it as an incident', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'
    captureException.mockClear()
    logged.length = 0

    const refusal = new Error('This account is suspended.')
    refusal.name = 'ConsoleActionError'

    const failure = readPublicFailure(await throughBoundary(refusal))

    expect(failure).toEqual({
      kind: 'refusal',
      message: 'This account is suspended.',
    })
    expect(captureException).not.toHaveBeenCalled()
    expect(logged).toHaveLength(0)
  })

  /**
   * The half of #391 that `public.test.ts` cannot prove. Classification and reporting are two
   * different branches of this middleware, so "the sentence survives" and "nobody is paged for a
   * trip somebody archived on purpose" are two different assertions - and the second one is the
   * reason the issue was filed.
   */
  it('passes the two repository refusals through without paging anyone', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'

    for (const [name, message] of [
      [
        'TripArchivedError',
        'This trip is archived. Restore it before making changes.',
      ],
      [
        'TripRoleError',
        'A viewer may not change this trip; requires one of: owner, editor.',
      ],
    ]) {
      captureException.mockClear()
      logged.length = 0

      const refusal = new Error(message)
      refusal.name = name

      expect(readPublicFailure(await throughBoundary(refusal))).toEqual({
        kind: 'refusal',
        message,
      })
      expect(captureException).not.toHaveBeenCalled()
      expect(logged).toHaveLength(0)
    }
  })

  it('passes a shell state through, so the blocked-traveller screen still renders', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'
    captureException.mockClear()

    const failure = readPublicFailure(
      await throughBoundary(new Error('shell.session.noWorkspace')),
    )

    expect(failure.message).toBe('shell.session.noWorkspace')
    expect(captureException).not.toHaveBeenCalled()
  })
})

describe('a quota refusal keeps its code and nothing else', () => {
  const QUOTA_REFUSAL = new QuotaExceededError('places', 50, 49)

  it('lets the code cross together with the reference', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'

    expect(readPublicFailure(await throughBoundary(QUOTA_REFUSAL))).toEqual({
      kind: 'unexpected',
      code: 'QUOTA_EXCEEDED',
      reference: 'sentry-event-id',
    })
  })

  it('does not put the metric, the numbers or the message text on the wire', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'
    const billing = new BillingQuotaExceededError(
      {
        key: 'trips',
        planId: 'free',
        limit: 2,
        used: 2,
        requested: 1,
      },
      'The Free plan allows 2 trips and you are using 2. Upgrade to add more.',
    )

    for (const cause of [QUOTA_REFUSAL, billing]) {
      const wire = ((await throughBoundary(cause)) as Error).message

      for (const leak of [
        'places',
        'trips',
        'metric',
        'limit',
        'used',
        'current',
        'requested',
        'planId',
        'free',
        'Free',
        'Upgrade',
        'reached',
        '49',
        '50',
      ]) {
        expect(wire).not.toContain(leak)
      }
    }
  })

  it('is still reported and logged, as before', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'
    captureException.mockClear()
    logged.length = 0

    await throughBoundary(QUOTA_REFUSAL)

    expect(captureException).toHaveBeenCalledWith(QUOTA_REFUSAL)
    expect(logged).toHaveLength(1)
  })

  it('is counted as unexpected, as before', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'
    count.mockClear()

    await throughBoundary(QUOTA_REFUSAL)

    expect(count.mock.calls.map((call) => call[2]?.attributes?.kind)).toEqual([
      'unexpected',
    ])
  })
})

describe('the failure counter', () => {
  it('counts every failure by kind, refusals included', async () => {
    dsn.configured = 'https://k@o.ingest.sentry.io/1'
    count.mockClear()

    await throughBoundary(D1_FAILURE)
    const refusal = new Error('This account is suspended.')
    refusal.name = 'ConsoleActionError'
    await throughBoundary(refusal)

    expect(count.mock.calls.map((call) => call[2]?.attributes?.kind)).toEqual([
      'unexpected',
      'refusal',
    ])
  })
})

describe('a successful call is untouched', () => {
  it('returns what next() returned', async () => {
    const server = failureRedactionMiddleware.options.server as (ctx: {
      next: () => Promise<unknown>
    }) => Promise<unknown>

    await expect(
      server({ next: () => Promise.resolve({ ok: true }) }),
    ).resolves.toEqual({
      ok: true,
    })
  })
})
