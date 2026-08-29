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

const captureException = vi.hoisted(() => vi.fn(() => 'sentry-event-id'))
const logged = vi.hoisted(() => [] as Array<{ msg: string; cause: unknown }>)
const dsn = vi.hoisted(() => ({ configured: undefined as string | undefined }))

vi.mock('cloudflare:workers', () => ({ env: {} }))
vi.mock('@sentry/cloudflare', () => ({ captureException }))
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
