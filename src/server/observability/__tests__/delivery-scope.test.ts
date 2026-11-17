import { describe, expect, it } from 'vitest'
import { deriveTransactionDeliveryScope } from '../delivery-scope'

const session = {
  user: { id: 'person-a' },
  session: { id: 'session-a', impersonatedBy: null },
}
const workspace = { userId: 'person-a', organizationId: 'workspace-a' }
describe('server-confirmed transaction recovery partitions', () => {
  it('distinguishes confirmed anonymous from unknown or mismatched authenticated scope', async () => {
    expect(await deriveTransactionDeliveryScope(null, null)).toBe('anonymous')
    expect(await deriveTransactionDeliveryScope(session, null)).toBeNull()
    expect(
      await deriveTransactionDeliveryScope(session, {
        ...workspace,
        userId: 'person-b',
      }),
    ).toBeNull()
  })
  it('partitions by actual session, effective workspace, user and impersonator without exposing their values', async () => {
    const original = await deriveTransactionDeliveryScope(session, workspace)
    expect(original).toMatch(/^[a-f0-9]{64}$/)
    expect(original).not.toContain('person-a')
    expect(
      await deriveTransactionDeliveryScope(session, {
        ...workspace,
        organizationId: 'workspace-b',
      }),
    ).not.toBe(original)
    expect(
      await deriveTransactionDeliveryScope(
        { ...session, session: { ...session.session, id: 'session-b' } },
        workspace,
      ),
    ).not.toBe(original)
    expect(
      await deriveTransactionDeliveryScope(
        {
          ...session,
          session: { ...session.session, impersonatedBy: 'operator' },
        },
        workspace,
      ),
    ).not.toBe(original)
    const credentialBearing = {
      ...session,
      session: { ...session.session, token: 'must-never-cross-the-wire' },
    }
    expect(
      await deriveTransactionDeliveryScope(credentialBearing, workspace),
    ).toBe(original)
  })
})
