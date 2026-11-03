import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthRequirementError } from '#/server/auth/tenant'
import { serveWorkspaceCompatibility } from '../workspace-compatibility'

const verify = vi.hoisted(() => vi.fn())
vi.mock('#/server/auth/session', async () => {
  const { isAuthRequirementError } = await import('#/server/auth/tenant')
  return { verifyWorkspaceCompatibility: verify, isAuthRequirementError }
})

beforeEach(() => {
  verify.mockReset()
})

describe('workspace compatibility GET', () => {
  it('returns only the verified workspace and cannot be cached', async () => {
    verify.mockResolvedValue({ organizationId: 'org_a' })
    const response = await serveWorkspaceCompatibility()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ organizationId: 'org_a' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it.each(['unauthenticated', 'not-a-member', 'unavailable'] as const)(
    'keeps verification failures private and uncacheable (%s)',
    async (kind) => {
      const error =
        kind === 'unavailable'
          ? new Error('database unavailable')
          : new AuthRequirementError(kind, 'private detail')
      verify.mockRejectedValue(error)
      const response = await serveWorkspaceCompatibility()
      expect(response.status).toBe(
        { unauthenticated: 401, 'not-a-member': 403, unavailable: 503 }[kind],
      )
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.text()).toBe('')
    },
  )
})
