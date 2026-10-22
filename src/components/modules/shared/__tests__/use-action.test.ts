/**
 * What a reader is told when a write fails.
 *
 * `messageOf` is the client half of the redaction boundary `src/server/errors/middleware.ts` opens:
 * every server-function failure crosses the wire as an envelope, never as the thrown value, so a
 * caller that reads `error.message` directly renders `planned-travel/failure/1 {…}` at the reader.
 * That is the regression these cases exist to catch — three screens now depend on this function
 * being the only thing between an envelope and an `Alert`.
 */

import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { encodePublicFailure } from '#/lib/errors'
import { WORKSPACE_CHANGED_KEY } from '#/lib/workspace-claim'
import { messageOf, useAction } from '../use-action'

const router = vi.hoisted(() => ({ invalidate: vi.fn() }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))
vi.mock('#/components/ui', () => ({ toast: notify }))

const FALLBACK = 'Try again in a moment.'

describe('messageOf', () => {
  it('shows authored copy a refusal carries', () => {
    const cause = new Error(
      encodePublicFailure({
        kind: 'refusal',
        message: 'This account is suspended.',
      }),
    )

    expect(messageOf(cause, FALLBACK)).toBe('This account is suspended.')
  })

  it('shows the sentence a validation failure names the field with', () => {
    const cause = new Error(
      encodePublicFailure({
        kind: 'validation',
        message: 'The return date cannot be before the departure date.',
      }),
    )

    expect(messageOf(cause, FALLBACK)).toBe(
      'The return date cannot be before the departure date.',
    )
  })

  it('withholds a diagnostic, and never renders the envelope carrying it', () => {
    const cause = new Error(
      encodePublicFailure({ kind: 'unexpected', reference: 'evt_1a2b3c' }),
    )

    expect(messageOf(cause, FALLBACK)).toBe(FALLBACK)
    expect(messageOf(cause, FALLBACK)).not.toContain('planned-travel/failure')
  })

  it('keeps a client-side throw, which never crossed the boundary', () => {
    expect(messageOf(new Error('Pick a date first.'), FALLBACK)).toBe(
      'Pick a date first.',
    )
    expect(messageOf('Pick a date first.', FALLBACK)).toBe('Pick a date first.')
  })

  it('falls back on anything with nothing to say', () => {
    expect(messageOf(new Error(''), FALLBACK)).toBe(FALLBACK)
    expect(messageOf('', FALLBACK)).toBe(FALLBACK)
    expect(messageOf(undefined, FALLBACK)).toBe(FALLBACK)
    expect(messageOf({ message: 'not an Error' }, FALLBACK)).toBe(FALLBACK)
  })
})

describe("a call refused because the tab's workspace is not the session's", () => {
  const refusal = () =>
    new Error(
      encodePublicFailure({ kind: 'refusal', message: WORKSPACE_CHANGED_KEY }),
    )

  it('never prints the catalogue key', () => {
    expect(messageOf(refusal(), FALLBACK)).toBe(FALLBACK)
  })

  it('raises no "did not save" toast and no inline error, because the notice is the one surface', async () => {
    const onError = vi.fn()
    const fn = vi.fn().mockRejectedValue(refusal())
    const { result } = renderHook(() => useAction(fn, { onError }))

    let outcome: unknown
    await act(async () => {
      outcome = await result.current.run(undefined)
    })

    expect(outcome).toBeNull()
    expect(notify.error).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
    expect(result.current.pending).toBe(false)
  })

  it('still rolls an optimistic overlay back, and does not re-read the loaders', async () => {
    const onError = vi.fn()
    const fn = vi.fn().mockRejectedValue(refusal())
    const { result } = renderHook(() => useAction(fn, { onError }))

    await act(async () => {
      await result.current.run(undefined)
    })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(router.invalidate).not.toHaveBeenCalled()
  })

  it('keeps the toast for any other failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        new Error(encodePublicFailure({ kind: 'unexpected', reference: 'r1' })),
      )
    const { result } = renderHook(() => useAction(fn))

    await act(async () => {
      await result.current.run(undefined)
    })

    expect(notify.error).toHaveBeenCalledTimes(1)
  })
})
