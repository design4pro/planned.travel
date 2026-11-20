/**
 * What a reader is told when a write fails.
 *
 * `messageOf` is the client half of the redaction boundary `src/server/errors/middleware.ts` opens:
 * every server-function failure crosses the wire as an envelope, never as the thrown value, so a
 * caller that reads `error.message` directly renders `planned-travel/failure/1 {…}` at the reader.
 * That is the regression these cases exist to catch — three screens now depend on this function
 * being the only thing between an envelope and an `Alert`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { encodePublicFailure, LocalizedActionError } from '#/lib/errors'
import { WORKSPACE_CHANGED_KEY } from '#/lib/workspace-claim'
import {
  dismissWorkspaceNotice,
  markWorkspaceStale,
  resetWorkspaceClaim,
  setWorkspaceClaim,
  workspaceClaimState,
} from '#/lib/workspace-claim-store'
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

  it.each([
    new Error('Unexpected detail'),
    new TypeError('Failed to fetch'),
    new Error('<html>Service unavailable</html>'),
    'Unexpected detail',
    new Error('planned-travel/failure/1 {invalid'),
    new Error(encodePublicFailure({ kind: 'unexpected' })),
  ])('uses fallback for an unrecognised failure (%s)', (cause) => {
    expect(messageOf(cause, FALLBACK)).toBe(FALLBACK)
  })

  it('preserves local catalogue copy', () => {
    const copy = 'Najpierw wybierz datę.'
    expect(messageOf(new LocalizedActionError(copy), FALLBACK)).toBe(copy)
  })

  it('falls back on anything with nothing to say', () => {
    expect(messageOf(new LocalizedActionError(''), FALLBACK)).toBe(FALLBACK)
    expect(messageOf(new Error(''), FALLBACK)).toBe(FALLBACK)
    expect(messageOf('', FALLBACK)).toBe(FALLBACK)
    expect(messageOf(undefined, FALLBACK)).toBe(FALLBACK)
    expect(messageOf({ message: 'not an Error' }, FALLBACK)).toBe(FALLBACK)
  })
})

describe('useAction failure copy', () => {
  beforeEach(() => notify.error.mockClear())
  afterEach(() => notify.error.mockClear())

  it.each([
    { cause: new TypeError('Failed to fetch'), expected: 'Spróbuj za chwilę.' },
    {
      cause: new LocalizedActionError('Najpierw wybierz datę.'),
      expected: 'Najpierw wybierz datę.',
    },
  ])(
    'puts the same safe copy in the toast and inline error ($cause)',
    async ({ cause, expected }) => {
      const fn = vi.fn().mockRejectedValue(cause)
      const onError = vi.fn()
      const fallback = 'Spróbuj za chwilę.'
      const { result } = renderHook(() => useAction(fn, { fallback, onError }))

      await act(async () => {
        await result.current.run(undefined)
      })

      expect(result.current.error).toBe(expected)
      expect(notify.error).toHaveBeenCalledWith(expect.any(String), {
        description: expected,
      })
      expect(onError).toHaveBeenCalledWith(cause)
    },
  )
})

describe("a call refused because the tab's workspace is not the session's", () => {
  afterEach(() => {
    resetWorkspaceClaim()
  })

  const refusal = () =>
    new Error(
      encodePublicFailure({ kind: 'refusal', message: WORKSPACE_CHANGED_KEY }),
    )

  it('never prints the catalogue key', () => {
    expect(messageOf(refusal(), FALLBACK)).toBe(FALLBACK)
  })

  it('brings the notice back for a form that reads the failure itself, as the new-trip dialog does', () => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')
    dismissWorkspaceNotice()

    // The stale tab's local refusal: a plain Error carrying the key, not the server's envelope.
    expect(messageOf(new Error(WORKSPACE_CHANGED_KEY), FALLBACK)).toBe(FALLBACK)
    expect(workspaceClaimState().noticeOpen).toBe(true)
  })

  it('leaves the notice alone for any other failure', () => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')
    dismissWorkspaceNotice()

    messageOf(new Error('boom'), FALLBACK)
    expect(workspaceClaimState().noticeOpen).toBe(false)
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

  it('brings the notice back when the reader acted after closing it', async () => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')
    dismissWorkspaceNotice()
    const fn = vi.fn().mockRejectedValue(refusal())
    const { result } = renderHook(() => useAction(fn))

    await act(async () => {
      await result.current.run(undefined)
    })

    expect(workspaceClaimState().noticeOpen).toBe(true)
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

describe('a refusal the caller has a sentence for', () => {
  beforeEach(() => {
    notify.error.mockClear()
  })

  const GONE = 'modules.transports.refusal.gone'
  const refusal = () =>
    new Error(encodePublicFailure({ kind: 'refusal', message: GONE }))
  const sentence = (cause: unknown): string | null =>
    cause instanceof Error && cause.message.includes(GONE)
      ? 'Ten przejazd już nie istnieje'
      : null

  it('puts the sentence in the inline error, never the key, and raises no toast over the state it names', async () => {
    const fn = vi.fn().mockRejectedValue(refusal())
    const { result } = renderHook(() =>
      useAction(fn, { refusal: sentence, failure: 'Not updated' }),
    )

    await act(async () => {
      await result.current.run(undefined)
    })

    expect(result.current.error).toBe('Ten przejazd już nie istnieje')
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('reads any other failure the usual way', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        new Error(encodePublicFailure({ kind: 'unexpected', reference: 'r1' })),
      )
    const { result } = renderHook(() =>
      useAction(fn, { refusal: sentence, fallback: 'Spróbuj za chwilę.' }),
    )

    await act(async () => {
      await result.current.run(undefined)
    })

    expect(result.current.error).toBe('Spróbuj za chwilę.')
    expect(notify.error).toHaveBeenCalledTimes(1)
  })
})
