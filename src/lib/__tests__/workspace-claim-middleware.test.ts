/**
 * The browser half of the claim, called the way the Start runtime calls it.
 *
 * `createMiddleware` is replaced by a stub that hands `.client()` back its own function, so the
 * test drives the real handler with a `next` it controls. That is the seam the brief names: the
 * claim is present on a call made under the shell, which is the assertion that stops a client
 * regression from switching the guard off silently.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { encodePublicFailure, readPublicFailure } from '#/lib/errors'

import {
  WORKSPACE_CHANGED_KEY,
  WORKSPACE_CLAIM_HEADER,
} from '../workspace-claim'
import {
  beginWorkspaceSwitch,
  markWorkspaceStale,
  resetWorkspaceClaim,
  setWorkspaceClaim,
  workspaceClaimState,
} from '../workspace-claim-store'

type ClientHandler = (ctx: {
  next: (options?: { headers?: Record<string, string> }) => Promise<unknown>
}) => Promise<unknown>

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({ client: (handler: ClientHandler) => handler }),
}))

let middleware: ClientHandler
beforeEach(async () => {
  const module = await import('../workspace-claim-middleware')
  middleware = module.workspaceClaimMiddleware as unknown as ClientHandler
})
afterEach(() => {
  resetWorkspaceClaim()
})

const refusal = () =>
  new Error(
    encodePublicFailure({ kind: 'refusal', message: WORKSPACE_CHANGED_KEY }),
  )

describe('workspaceClaimMiddleware', () => {
  it('states the workspace the tab is showing on a call made under the shell', async () => {
    setWorkspaceClaim('org_a')
    const next = vi.fn().mockResolvedValue('ok')

    await expect(middleware({ next })).resolves.toBe('ok')

    expect(next).toHaveBeenCalledWith({
      headers: { [WORKSPACE_CLAIM_HEADER]: 'org_a' },
    })
  })

  it('sends no claim before the shell has loaded', async () => {
    const next = vi.fn().mockResolvedValue('ok')

    await middleware({ next })

    expect(next).toHaveBeenCalledWith()
  })

  it('sends no claim while the tab is switching workspace itself', async () => {
    setWorkspaceClaim('org_a')
    beginWorkspaceSwitch()
    const next = vi.fn().mockResolvedValue('ok')

    await middleware({ next })

    expect(next).toHaveBeenCalledWith()
  })

  it('marks the tab stale on a refusal and still throws it to the caller', async () => {
    setWorkspaceClaim('org_a')
    const next = vi.fn().mockRejectedValue(refusal())

    await expect(middleware({ next })).rejects.toThrow()

    expect(workspaceClaimState()).toMatchObject({
      stale: true,
      noticeOpen: true,
    })
  })

  it('leaves the tab alone when the call failed for another reason', async () => {
    setWorkspaceClaim('org_a')
    const next = vi
      .fn()
      .mockRejectedValue(
        new Error(encodePublicFailure({ kind: 'unexpected', reference: 'r1' })),
      )

    await expect(middleware({ next })).rejects.toThrow()

    expect(workspaceClaimState().stale).toBe(false)
  })

  it('ignores a refusal that arrives after the tab moved to another workspace', async () => {
    setWorkspaceClaim('org_a')
    const next = vi.fn().mockImplementation(async () => {
      setWorkspaceClaim('org_b')
      throw refusal()
    })

    await expect(middleware({ next })).rejects.toThrow()

    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_b',
      stale: false,
    })
  })

  it('stops a stale tab locally: no request, the same refusal, the notice again', async () => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')
    const next = vi.fn()

    const outcome = await middleware({ next }).catch((cause: unknown) => cause)

    expect(next).not.toHaveBeenCalled()
    expect(readPublicFailure(outcome)).toEqual({
      kind: 'refusal',
      message: WORKSPACE_CHANGED_KEY,
    })
    expect(workspaceClaimState().noticeOpen).toBe(true)
  })
})
