import { expect, it } from 'vitest'
import { taskEnvelopeSchema } from '../types'

it('accepts a workspace deletion selected only by its ledger id and rejects extra authority', () => {
  const envelope = {
    id: 'workspace-deletion:deletion-alpha:1',
    kind: 'workspace-deletion',
    orgId: 'system',
    enqueuedAt: Date.parse('2026-11-09T00:00:00Z'),
    payload: { deletionId: 'deletion-alpha' },
  }

  expect(taskEnvelopeSchema.safeParse(envelope).success).toBe(true)
  for (const authority of [
    { organizationId: 'beta' },
    { departingUserId: 'owner-beta' },
    { requestedBy: 'owner-beta' },
  ]) {
    expect(
      taskEnvelopeSchema.safeParse({
        ...envelope,
        payload: { ...envelope.payload, ...authority },
      }).success,
    ).toBe(false)
  }
})
