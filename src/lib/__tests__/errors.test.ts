/**
 * The envelope is a wire format between the two halves of one deploy, and the property that matters
 * is which way it fails.
 *
 * `readPublicFailure` is reached with whatever arrived - a rolling deploy briefly runs an old server
 * beside a new client, a client-side throw never passes the middleware at all, and a bug could hand
 * it anything. Every one of those has to come out as `unexpected`, because `unexpected` is the state
 * that shows the reader a generic sentence instead of a diagnostic. Failing open here would put the
 * database back on the screen, which is the whole thing this exists to stop.
 */

import { describe, expect, it } from 'vitest'

import { encodePublicFailure, readPublicFailure } from '../errors'

describe('readPublicFailure', () => {
  it('round-trips an authored refusal', () => {
    const encoded = encodePublicFailure({
      kind: 'refusal',
      message: 'This account is suspended.',
    })

    expect(readPublicFailure(new Error(encoded))).toEqual({
      kind: 'refusal',
      message: 'This account is suspended.',
    })
  })

  it('round-trips a diagnostic as a reference and nothing else', () => {
    const encoded = encodePublicFailure({
      kind: 'unexpected',
      reference: 'abc123',
    })

    expect(readPublicFailure(new Error(encoded))).toEqual({
      kind: 'unexpected',
      reference: 'abc123',
    })
  })

  it('treats anything that is not an envelope as unexpected, carrying no message', () => {
    for (const cause of [
      new Error('D1_ERROR: no such table: trips'),
      new Error(''),
      'shell.session.noWorkspace',
      undefined,
      null,
      42,
      {},
    ]) {
      expect(readPublicFailure(cause)).toEqual({ kind: 'unexpected' })
    }
  })

  it('treats a malformed or unknown-version envelope as unexpected', () => {
    expect(
      readPublicFailure(new Error('planned-travel/failure/1 {not json')),
    ).toEqual({
      kind: 'unexpected',
    })
    expect(
      readPublicFailure(new Error('planned-travel/failure/1 "a string"')),
    ).toEqual({
      kind: 'unexpected',
    })
    expect(
      readPublicFailure(
        new Error('planned-travel/failure/1 {"kind":"invented"}'),
      ),
    ).toEqual({
      kind: 'unexpected',
    })
    expect(
      readPublicFailure(
        new Error('planned-travel/failure/99 {"kind":"refusal"}'),
      ),
    ).toEqual({
      kind: 'unexpected',
    })
  })

  it('round-trips the quota code alongside the reference', () => {
    const encoded = encodePublicFailure({
      kind: 'unexpected',
      code: 'QUOTA_EXCEEDED',
      reference: 'abc123',
    })

    expect(readPublicFailure(new Error(encoded))).toEqual({
      kind: 'unexpected',
      code: 'QUOTA_EXCEEDED',
      reference: 'abc123',
    })
  })

  it.each([
    'BILLING_FORBIDDEN',
    'BILLING_PROVIDER_REFUSED',
    'BILLING_RATE_LIMITED',
    'BILLING_NOT_CONNECTED',
    'BILLING_ORDER_NOT_INVOICEABLE',
  ] as const)('round-trips the %s code alongside the reference', (code) => {
    const encoded = encodePublicFailure({
      kind: 'unexpected',
      code,
      reference: 'abc123',
    })

    expect(readPublicFailure(new Error(encoded))).toEqual({
      kind: 'unexpected',
      code,
      reference: 'abc123',
    })
  })

  it('drops a code that is not the allow-listed literal, however the envelope is dressed', () => {
    // The code is the one thing besides a message the UI branches on, so a hostile or newer-server
    // value must not reach a screen: every other repository code, a near-miss and a wrong type.
    for (const code of [
      'NOT_FOUND',
      'FORBIDDEN',
      'TENANT_ISOLATION',
      'quota_exceeded',
      'QUOTA_EXCEEDED ',
      'BILLING_FORBIDDEN ',
      'billing_rate_limited',
      'BILLING_STATUS_422',
      42,
      null,
      { QUOTA_EXCEEDED: true },
    ]) {
      const envelope = `planned-travel/failure/1 ${JSON.stringify({
        kind: 'unexpected',
        code,
        reference: 'abc123',
      })}`

      expect(readPublicFailure(new Error(envelope))).toEqual({
        kind: 'unexpected',
        reference: 'abc123',
      })
    }
  })

  it('never returns a message for an unexpected failure, however the envelope is dressed', () => {
    // A hostile or buggy envelope must not be able to talk the UI into rendering a diagnostic.
    const smuggled =
      'planned-travel/failure/1 {"kind":"unexpected","message":"D1_ERROR: select *"}'

    expect(readPublicFailure(new Error(smuggled)).message).toBeUndefined()
  })
})
