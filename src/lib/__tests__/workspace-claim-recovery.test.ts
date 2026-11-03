import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  beginWorkspaceSwitch,
  dismissWorkspaceNotice,
  markWorkspaceStale,
  recoverWorkspaceClaim,
  resetWorkspaceClaim,
  resumeWorkspaceClaim,
  setWorkspaceClaim,
  workspaceClaimState,
} from '../workspace-claim-store'

afterEach(() => {
  resetWorkspaceClaim()
  vi.unstubAllGlobals()
})

function verifyWith(
  verify: (claim: string) => Promise<{ organizationId: string }>,
) {
  const request = vi.fn(async (_url: string, options: RequestInit) => {
    const result = await verify(
      new Headers(options.headers).get('x-planned-workspace') ?? '',
    )
    return Response.json(result)
  })
  vi.stubGlobal('fetch', request)
  return request
}

function stale() {
  setWorkspaceClaim('org_a')
  markWorkspaceStale('org_a')
}

function deferred() {
  let resolve: (value: { organizationId: string }) => void = () => {}
  const promise = new Promise<{ organizationId: string }>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('explicit workspace compatibility recovery', () => {
  it('retains the original claim and gate until verified, then closes only the notice', async () => {
    stale()
    const reply = deferred()
    const verify = vi.fn(() => reply.promise)
    const request = verifyWith(verify)
    const recovery = recoverWorkspaceClaim()
    expect(workspaceClaimState().stale).toBe(true)
    expect(verify).toHaveBeenCalledWith('org_a')
    expect(request).toHaveBeenCalledWith('/api/workspace-compatibility', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'x-planned-workspace': 'org_a' },
    })
    reply.resolve({ organizationId: 'org_a' })
    await expect(recovery).resolves.toBe(true)
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_a',
      stale: false,
      noticeOpen: false,
    })
  })

  it('never adopts a mismatching workspace', async () => {
    stale()
    verifyWith(async () => ({ organizationId: 'org_b' }))
    await expect(recoverWorkspaceClaim()).resolves.toBe(false)
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_a',
      stale: true,
    })
  })

  it('fails closed when verification is unavailable', async () => {
    stale()
    verifyWith(async () => {
      throw new Error('offline')
    })
    await expect(recoverWorkspaceClaim()).resolves.toBe(false)
    expect(workspaceClaimState().stale).toBe(true)
  })

  it.each([
    'navigation',
    'same workspace',
    'A-B-A',
    'switch',
    'new refusal',
    'superseding attempt',
    'dismissal',
  ])('ignores delayed verification after %s', async (event) => {
    stale()
    const reply = deferred()
    verifyWith(() => reply.promise)
    const recovery = recoverWorkspaceClaim()
    if (event === 'navigation') resumeWorkspaceClaim()
    if (event === 'same workspace') setWorkspaceClaim('org_a')
    if (event === 'A-B-A') {
      setWorkspaceClaim('org_b')
      setWorkspaceClaim('org_a')
    }
    if (event === 'switch') beginWorkspaceSwitch()
    if (event === 'dismissal') dismissWorkspaceNotice()
    if (event === 'new refusal') markWorkspaceStale('org_a')
    if (event === 'superseding attempt') {
      verifyWith(async () => ({ organizationId: 'org_b' }))
      await recoverWorkspaceClaim()
    }
    const before = workspaceClaimState()
    reply.resolve({ organizationId: 'org_a' })
    await expect(recovery).resolves.toBe(false)
    expect(workspaceClaimState()).toEqual(before)
  })

  it('does not send an absent, invalid or switching claim', async () => {
    const verify = verifyWith(vi.fn())
    await expect(recoverWorkspaceClaim()).resolves.toBe(false)
    setWorkspaceClaim('invalid claim')
    markWorkspaceStale('invalid claim')
    await expect(recoverWorkspaceClaim()).resolves.toBe(false)
    stale()
    beginWorkspaceSwitch()
    await expect(recoverWorkspaceClaim()).resolves.toBe(false)
    expect(verify).not.toHaveBeenCalled()
  })
})

it.each([
  new Response(null, { status: 403 }),
  Response.json({}),
  Response.json({ organizationId: 42 }),
  new Response('invalid json'),
])(
  'keeps the gate closed for a refused or malformed response',
  async (response) => {
    stale()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(recoverWorkspaceClaim()).resolves.toBe(false)
    expect(workspaceClaimState().stale).toBe(true)
  },
)
