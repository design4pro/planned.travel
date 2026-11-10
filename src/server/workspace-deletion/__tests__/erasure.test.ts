import {
  appendWorkspaceDeletionAudit,
  PLATFORM_SYSTEM_ACTOR,
} from '#/server/catalog/audit'
import { expect, it } from 'vitest'
import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import {
  insertWorkspaceDeletion,
  recordWorkspaceDeletionRefusal,
  readLeasedWorkspaceDeletion,
  acquireDeletionLease,
  transitionWorkspaceDeletion,
  consumeWorkspaceDeletionErasure,
} from '#/server/catalog/workspace-deletions'
import { enterWorkspaceDeletionErasure } from '../erasure'

it('parks beyond five deliveries, recovers a consumed winner after a crash and rejects a stale resume', async () => {
  const h = await createPlatformTables()
  const now = new Date('2026-11-09T00:00:00Z')
  try {
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: 'alpha',
        initiator: 'erasure',
        erasureId: 'erase-alpha',
      },
      now,
    )
    for (let hop = 0; hop < 12; hop += 1)
      expect(
        await enterWorkspaceDeletionErasure(
          h.db,
          row.id,
          'erase-alpha',
          `park-${hop}`,
        ),
      ).toEqual({ outcome: 'parked' })
    for (const [from, to] of [
      ['requested', 'drained'],
      ['drained', 'rows_deleted'],
    ] as const) {
      const token = await acquireDeletionLease(h.db, row.id, now)
      if (!token) throw new Error('Missing lease')
      expect(
        await transitionWorkspaceDeletion(h.db, row.id, token, from, to, now),
      ).toBe(true)
    }
    // The winner crashes after the atomic consume, before it can re-read the state or do erasure work.
    expect(
      await consumeWorkspaceDeletionErasure(
        h.db,
        row.id,
        'erase-alpha',
        'winner',
      ),
    ).toBe(true)
    expect(
      await enterWorkspaceDeletionErasure(
        h.db,
        row.id,
        'erase-alpha',
        'winner',
      ),
    ).toEqual({ outcome: 'ready' })
    expect(
      await enterWorkspaceDeletionErasure(
        h.db,
        row.id,
        'erase-alpha',
        'resume',
      ),
    ).toEqual({ outcome: 'stale' })
    expect(
      await enterWorkspaceDeletionErasure(h.db, row.id, 'erase-beta', 'winner'),
    ).toEqual({ outcome: 'stale' })
  } finally {
    h.close()
  }
})

it('returns an incomplete-erasure refusal only to the winning envelope', async () => {
  const h = await createPlatformTables()
  const now = new Date('2026-11-09T00:00:00Z')
  try {
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: 'alpha',
        initiator: 'erasure',
        erasureId: 'erase-alpha',
      },
      now,
    )
    const token = await acquireDeletionLease(h.db, row.id, now)
    if (!token) throw new Error('Missing lease')
    await recordWorkspaceDeletionRefusal(
      h.db,
      row.id,
      token,
      'has-other-members',
      now,
    )
    const intent = await readLeasedWorkspaceDeletion(h.db, row.id, token, now)
    if (!intent) throw new Error('Missing intent')
    await appendWorkspaceDeletionAudit(
      h.db,
      intent,
      PLATFORM_SYSTEM_ACTOR,
      'deletion_refused',
      now,
    )
    await transitionWorkspaceDeletion(
      h.db,
      row.id,
      token,
      'requested',
      'refused',
      now,
      { lastError: 'has-other-members' },
    )
    expect(
      await enterWorkspaceDeletionErasure(
        h.db,
        row.id,
        'erase-alpha',
        'resume',
      ),
    ).toEqual({
      outcome: 'refused',
      reason: `workspace-refused:${row.id}`,
    })
    expect(
      await enterWorkspaceDeletionErasure(h.db, row.id, 'erase-alpha', 'other'),
    ).toEqual({ outcome: 'stale' })
    expect(
      await enterWorkspaceDeletionErasure(
        h.db,
        'missing',
        'erase-alpha',
        'other',
      ),
    ).toEqual({ outcome: 'stale' })
  } finally {
    h.close()
  }
})
