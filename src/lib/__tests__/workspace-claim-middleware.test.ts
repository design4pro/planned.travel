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
  isWorkspaceChanged,
} from '../workspace-claim'
import {
  beginWorkspaceSwitch,
  endWorkspaceSwitch,
  waitForWorkspaceCalls,
  prepareWorkspaceResync,
  prepareWorkspaceDocument,
  takeWorkspaceDocumentFetch,
  workspaceResyncToken,
  workspaceSwitchFetch,
  dismissWorkspaceNotice,
  markWorkspaceStale,
  resetWorkspaceClaim,
  recoverWorkspaceClaim,
  setWorkspaceClaim,
  workspaceClaimState,
} from '../workspace-claim-store'
import { readWorkspaceShell } from '../room-refresh'

type ClientHandler = (ctx: {
  fetch?: typeof globalThis.fetch
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
  vi.unstubAllGlobals()
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

  it('cancels unrelated calls locally while switching, without a false stale notice', async () => {
    setWorkspaceClaim('org_a')
    beginWorkspaceSwitch()
    const next = vi.fn().mockResolvedValue('ok')

    await expect(middleware({ next })).rejects.toMatchObject({
      name: 'AbortError',
    })

    expect(next).not.toHaveBeenCalled()
    expect(workspaceClaimState().noticeOpen).toBe(false)
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

  it('ignores a delayed refusal after a newer navigation to the same workspace', async () => {
    setWorkspaceClaim('org_a')
    const next = vi.fn().mockImplementation(async () => {
      setWorkspaceClaim('org_a')
      throw refusal()
    })

    await expect(middleware({ next })).rejects.toThrow()
    expect(workspaceClaimState().stale).toBe(false)
  })

  it('hands the caller an error a form cannot mistake for authored copy', async () => {
    setWorkspaceClaim('org_a')
    const next = vi.fn().mockRejectedValue(refusal())

    const outcome = await middleware({ next }).catch((cause: unknown) => cause)

    expect(isWorkspaceChanged(outcome)).toBe(true)
    // A reader that only knows the redaction envelope sees a failure with no sentence of its own.
    expect(readPublicFailure(outcome)).toEqual({ kind: 'unexpected' })
  })

  it('stops a stale tab locally: no request, the same refusal, and the notice left as the reader set it', async () => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')
    dismissWorkspaceNotice()
    const next = vi.fn()

    const outcome = await middleware({ next }).catch((cause: unknown) => cause)

    expect(next).not.toHaveBeenCalled()
    expect(isWorkspaceChanged(outcome)).toBe(true)
    // A poll is not the reader asking: it must not pull the dialog back after "Not now".
    expect(workspaceClaimState().noticeOpen).toBe(false)
  })

  it('refuses ordinary calls during verification and still records refusals after recovery', async () => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')
    let reply: (value: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            reply = resolve
          }),
      ),
    )
    const recovery = recoverWorkspaceClaim()
    const next = vi.fn().mockResolvedValue('ok')
    await expect(middleware({ next })).rejects.toThrow(WORKSPACE_CHANGED_KEY)
    expect(next).not.toHaveBeenCalled()

    reply(Response.json({ organizationId: 'org_a' }))
    await expect(recovery).resolves.toBe(true)
    await expect(middleware({ next })).resolves.toBe('ok')
    expect(next).toHaveBeenCalledWith({
      headers: { [WORKSPACE_CLAIM_HEADER]: 'org_a' },
    })

    next.mockRejectedValue(refusal())
    await expect(middleware({ next })).rejects.toThrow(WORKSPACE_CHANGED_KEY)
    expect(workspaceClaimState().stale).toBe(true)
  })
})

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const shell = (id: string) => ({ session: { organization: { id } } })

describe('deliberate workspace transition concurrency', () => {
  it('keeps unrelated writes and polling unsent throughout creation and resync', async () => {
    setWorkspaceClaim('org_a')
    const token = beginWorkspaceSwitch()
    await waitForWorkspaceCalls(token)
    const activation = deferred<unknown>()
    const createTransport = vi.fn().mockReturnValue(activation.promise)
    const own = middleware({ fetch: token.fetch, next: createTransport })
    expect(createTransport).toHaveBeenCalledWith({
      headers: { [WORKSPACE_CLAIM_HEADER]: 'org_a' },
    })
    const unrelated = vi.fn()
    await expect(middleware({ next: unrelated })).rejects.toMatchObject({
      name: 'AbortError',
    })
    await expect(middleware({ next: unrelated })).rejects.toMatchObject({
      name: 'AbortError',
    })
    activation.resolve('activated')
    await own
    prepareWorkspaceResync(token, ['org_b'])
    const controller = new AbortController()
    const answer = deferred<ReturnType<typeof shell>>()
    const reading = readWorkspaceShell(controller, false, async (_, fetch) => {
      await middleware({ fetch, next: vi.fn().mockResolvedValue('shell') })
      return answer.promise
    })
    await expect(middleware({ next: unrelated })).rejects.toMatchObject({
      name: 'AbortError',
    })
    answer.resolve(shell('org_b'))
    await reading
    const dashboard = vi.fn().mockResolvedValue('dashboard')
    await middleware({
      fetch: workspaceSwitchFetch(workspaceResyncToken(controller)),
      next: dashboard,
    })
    expect(dashboard).toHaveBeenCalledWith({
      headers: { [WORKSPACE_CLAIM_HEADER]: 'org_b' },
    })
    await expect(middleware({ next: unrelated })).rejects.toMatchObject({
      name: 'AbortError',
    })
    endWorkspaceSwitch(token)
    expect(unrelated).not.toHaveBeenCalled()
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_b',
      stale: false,
      noticeOpen: false,
      switching: false,
    })
    // A completed router context cannot grant permission during a newer transition.
    const newer = beginWorkspaceSwitch()
    expect(workspaceSwitchFetch(token.id)).toBeUndefined()
    endWorkspaceSwitch(token)
    expect(workspaceClaimState().switching).toBe(true)
    endWorkspaceSwitch(newer)
  })

  it.each([false, true])(
    'drains an earlier write before activation and preserves its refusal (%s)',
    async (refused) => {
      setWorkspaceClaim('org_a')
      const answer = deferred<unknown>()
      const earlier = middleware({
        next: vi.fn().mockReturnValue(answer.promise),
      }).catch((error) => error)
      const token = beginWorkspaceSwitch()
      let ready = false
      const waiting = waitForWorkspaceCalls(token)
        .then(() => {
          ready = true
        })
        .catch((error) => error)
      await Promise.resolve()
      expect(ready).toBe(false)
      if (refused) answer.reject(refusal())
      else answer.resolve('saved in org_a')
      await earlier
      const outcome = await waiting
      expect(ready).toBe(!refused)
      expect(workspaceClaimState().stale).toBe(refused)
      if (refused) expect(isWorkspaceChanged(outcome)).toBe(true)
      endWorkspaceSwitch(token)
    },
  )

  it.each([false, true])(
    'cancels a stalled drain without replay and retains late real RPC refusals (%s)',
    async (refused) => {
      setWorkspaceClaim('org_a')
      const answer = deferred<unknown>()
      const transport = vi.fn().mockReturnValue(answer.promise)
      const earlier = middleware({ next: transport }).catch((error) => error)
      const token = beginWorkspaceSwitch()
      vi.useFakeTimers()
      try {
        const waiting = waitForWorkspaceCalls(token).catch((error) => error)
        await vi.advanceTimersByTimeAsync(10_000)
        expect(await waiting).toMatchObject({ name: 'AbortError' })
        endWorkspaceSwitch(token)
        const next = vi.fn().mockResolvedValue('still org_a')
        await middleware({ next })
        expect(next).toHaveBeenCalledWith({
          headers: { [WORKSPACE_CLAIM_HEADER]: 'org_a' },
        })
        const newer = beginWorkspaceSwitch()
        if (refused) answer.reject(refusal())
        else answer.resolve('saved in org_a')
        await earlier
        endWorkspaceSwitch(token)
        expect(transport).toHaveBeenCalledTimes(1)
        expect(workspaceClaimState()).toMatchObject({
          organizationId: 'org_a',
          switching: true,
          stale: refused,
          noticeOpen: refused,
        })
        if (refused)
          await expect(waitForWorkspaceCalls(newer)).rejects.toThrow(
            WORKSPACE_CHANGED_KEY,
          )
        else await expect(waitForWorkspaceCalls(newer)).resolves.toBeUndefined()
        endWorkspaceSwitch(newer)
      } finally {
        vi.useRealTimers()
      }
    },
  )

  it('expires the document capability after consumption, refusal or owner cleanup', async () => {
    setWorkspaceClaim('org_a')
    const token = beginWorkspaceSwitch()
    prepareWorkspaceResync(token, ['org_b'])
    expect(() => prepareWorkspaceDocument(token)).not.toThrow()
    expect(takeWorkspaceDocumentFetch()).toBeUndefined()
    setWorkspaceClaim('org_b')
    prepareWorkspaceDocument(token)
    expect(takeWorkspaceDocumentFetch()).toBe(token.fetch)
    expect(takeWorkspaceDocumentFetch()).toBeUndefined()
    prepareWorkspaceDocument(token)
    markWorkspaceStale('org_b')
    expect(takeWorkspaceDocumentFetch()).toBeUndefined()
    setWorkspaceClaim('org_b')
    prepareWorkspaceDocument(token)
    endWorkspaceSwitch(token)
    expect(takeWorkspaceDocumentFetch()).toBeUndefined()
  })

  it('never retargets creation when an earlier navigation updates the claim', async () => {
    setWorkspaceClaim('org_a')
    const token = beginWorkspaceSwitch()
    setWorkspaceClaim('org_c')
    await expect(waitForWorkspaceCalls(token)).rejects.toMatchObject({
      name: 'AbortError',
    })
    const next = vi.fn().mockResolvedValue('created')
    await middleware({ fetch: token.fetch, next })
    expect(next).toHaveBeenCalledWith({
      headers: { [WORKSPACE_CLAIM_HEADER]: 'org_a' },
    })
    endWorkspaceSwitch(token)
  })

  it('keeps the original create claim and exposes a competing-tab refusal', async () => {
    setWorkspaceClaim('org_a')
    const token = beginWorkspaceSwitch()
    await expect(
      middleware({
        fetch: token.fetch,
        next: vi.fn().mockRejectedValue(refusal()),
      }),
    ).rejects.toThrow(WORKSPACE_CHANGED_KEY)
    expect(workspaceClaimState()).toMatchObject({
      stale: true,
      noticeOpen: true,
    })
    expect(() => prepareWorkspaceResync(token, ['org_b'])).toThrow(
      WORKSPACE_CHANGED_KEY,
    )
    endWorkspaceSwitch(token)
  })

  it.each([
    { expected: ['org_b'], actual: 'org_b' },
    { expected: ['org_a'], actual: 'org_a' },
    { expected: ['org_a', 'org_b'], actual: 'org_a' },
  ])(
    'accepts only the confirmed or explicitly uncertain activation outcome: $actual / $expected',
    async ({ expected, actual }) => {
      setWorkspaceClaim('org_a')
      const token = beginWorkspaceSwitch()
      prepareWorkspaceResync(token, expected)
      await readWorkspaceShell(new AbortController(), false, async () =>
        shell(actual),
      )
      expect(workspaceClaimState()).toMatchObject({
        organizationId: actual,
        stale: false,
      })
      endWorkspaceSwitch(token)
    },
  )

  it('does not adopt a competing third workspace during its own resync', async () => {
    setWorkspaceClaim('org_a')
    const token = beginWorkspaceSwitch()
    prepareWorkspaceResync(token, ['org_b'])
    await expect(
      readWorkspaceShell(new AbortController(), false, async () =>
        shell('org_c'),
      ),
    ).rejects.toThrow(WORKSPACE_CHANGED_KEY)
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_a',
      stale: true,
      noticeOpen: true,
    })
    endWorkspaceSwitch(token)
  })

  it('does not clear a newer genuine refusal when its own shell response is delayed', async () => {
    setWorkspaceClaim('org_a')
    const token = beginWorkspaceSwitch()
    prepareWorkspaceResync(token, ['org_b'])
    const answer = deferred<ReturnType<typeof shell>>()
    const reading = readWorkspaceShell(
      new AbortController(),
      false,
      () => answer.promise,
    )
    markWorkspaceStale('org_a')
    answer.resolve(shell('org_b'))
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' })
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_a',
      stale: true,
      noticeOpen: true,
    })
    endWorkspaceSwitch(token)
  })

  it('rejects overlaps and ignores a superseded shell response and cleanup', async () => {
    setWorkspaceClaim('org_a')
    const first = beginWorkspaceSwitch()
    expect(() => beginWorkspaceSwitch()).toThrow()
    prepareWorkspaceResync(first, ['org_b'])
    const answer = deferred<ReturnType<typeof shell>>()
    const reading = readWorkspaceShell(
      new AbortController(),
      false,
      () => answer.promise,
    )
    endWorkspaceSwitch(first)
    const second = beginWorkspaceSwitch()
    prepareWorkspaceResync(second, ['org_c'])
    await readWorkspaceShell(new AbortController(), false, async () =>
      shell('org_c'),
    )
    answer.resolve(shell('org_b'))
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' })
    endWorkspaceSwitch(first)
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_c',
      switching: true,
    })
    endWorkspaceSwitch(second)
  })

  it('preserves expired-session and membership-removal outcomes', async () => {
    setWorkspaceClaim('org_a')
    const token = beginWorkspaceSwitch()
    prepareWorkspaceResync(token, ['org_b'])
    await expect(
      readWorkspaceShell(new AbortController(), false, async () => null),
    ).resolves.toBeNull()
    prepareWorkspaceResync(token, ['org_b'])
    await expect(
      readWorkspaceShell(new AbortController(), false, async () => {
        throw new Error('membership removed')
      }),
    ).rejects.toThrow('membership removed')
    endWorkspaceSwitch(token)
    expect(workspaceClaimState().switching).toBe(false)
  })
})
