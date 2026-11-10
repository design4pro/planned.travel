import { expect, it } from 'vitest'
import {
  appendWorkspaceDeletionAudit,
  PLATFORM_SYSTEM_ACTOR,
  readPlatformAuditByEntity,
} from '../audit'
import {
  insertWorkspaceDeletion,
  leaseWorkspaceDeletion,
  transitionWorkspaceDeletion,
  recordWorkspaceDeletionRefusal,
  readLeasedWorkspaceDeletion,
} from '../workspace-deletions'
import { createPlatformTables } from './platform-tables'

const now = new Date('2026-11-09T00:00:00Z')
const actor = {
  userId: 'owner-alpha',
  actorKind: 'human' as const,
  role: 'admin',
  tokenId: null,
}

it('records one leased deletion audit under concurrent retries without receipt content', async () => {
  const h = await createPlatformTables()
  try {
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: 'alpha',
        initiator: 'owner',
        requestedBy: 'owner-alpha',
        receiptTo: 'private@example.com',
        receiptName: 'Private',
        snapshot: { plan: 'solo', trips: 3, fileRows: 4 },
      },
      now,
    )
    for (const [from, to] of [
      ['requested', 'drained'],
      ['drained', 'rows_deleted'],
    ] as const) {
      const lease = await leaseWorkspaceDeletion(h.db, row.id, now)
      if (!lease || lease === 'busy') throw new Error('Missing lease')
      expect(
        await transitionWorkspaceDeletion(
          h.db,
          row.id,
          lease.token,
          from,
          to,
          now,
        ),
      ).toBe(true)
    }
    const lease = await leaseWorkspaceDeletion(h.db, row.id, now)
    if (!lease || lease === 'busy') throw new Error('Missing lease')
    await Promise.all(
      [1, 2].map(() =>
        appendWorkspaceDeletionAudit(h.db, lease.row, actor, 'deleted', now),
      ),
    )
    const rows = await readPlatformAuditByEntity(h.db, {
      entityType: 'workspace',
      entityId: 'alpha',
      limit: 20,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.workspace.deleted',
      actorRole: 'admin',
      changes: {
        before: { plan: 'solo', trips: 3, fileRows: 4 },
        after: { initiator: 'owner', deletionId: row.id },
      },
    })
    expect(JSON.stringify(rows)).not.toContain('private@example.com')
    expect(JSON.stringify(rows)).not.toContain('Private')
    expect(
      await readPlatformAuditByEntity(h.db, {
        entityType: 'workspace',
        entityId: 'beta',
        limit: 20,
      }),
    ).toEqual([])
  } finally {
    h.close()
  }
})

it('requires durable erasure refusal intent and a system actor, and throws on unavailable audit storage', async () => {
  const h = await createPlatformTables()
  const row = await insertWorkspaceDeletion(
    h.db,
    { organizationId: 'alpha', initiator: 'erasure', erasureId: 'erase-alpha' },
    now,
  )
  const lease = await leaseWorkspaceDeletion(h.db, row.id, now)
  if (!lease || lease === 'busy') throw new Error('Missing lease')
  try {
    await expect(
      appendWorkspaceDeletionAudit(
        h.db,
        lease.row,
        actor,
        'deletion_refused',
        now,
      ),
    ).rejects.toThrow()
    await expect(
      appendWorkspaceDeletionAudit(
        h.db,
        lease.row,
        PLATFORM_SYSTEM_ACTOR,
        'deletion_refused',
        now,
      ),
    ).rejects.toThrow()
    expect(
      await recordWorkspaceDeletionRefusal(
        h.db,
        row.id,
        lease.token,
        'has-other-members',
        now,
      ),
    ).toBe(true)
    const refused = {
      ...lease.row,
      refusalReason: 'has-other-members' as const,
    }
    await appendWorkspaceDeletionAudit(
      h.db,
      refused,
      PLATFORM_SYSTEM_ACTOR,
      'deletion_refused',
      now,
    )
    const rows = await readPlatformAuditByEntity(h.db, {
      entityType: 'workspace',
      entityId: 'alpha',
      limit: 20,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      actorKind: 'system',
      actorUserId: null,
      actorRole: null,
    })
  } finally {
    h.close()
  }
  await expect(
    appendWorkspaceDeletionAudit(
      h.db,
      lease.row,
      PLATFORM_SYSTEM_ACTOR,
      'deletion_refused',
      now,
    ),
  ).rejects.toThrow()
})

it.each(['deleted', 'deletion_refused'] as const)(
  'rejects stale %s audit poisoning before the replacement wins',
  async (staleOutcome) => {
    const h = await createPlatformTables()
    try {
      const row = await insertWorkspaceDeletion(
        h.db,
        {
          organizationId: 'alpha',
          initiator: 'owner',
          requestedBy: 'owner-alpha',
        },
        now,
      )
      const stale = await leaseWorkspaceDeletion(h.db, row.id, now)
      const later = new Date(now.getTime() + 300_001)
      const current = await leaseWorkspaceDeletion(h.db, row.id, later)
      if (!stale || stale === 'busy' || !current || current === 'busy')
        throw new Error('Missing leases')
      await expect(
        appendWorkspaceDeletionAudit(
          h.db,
          { ...stale.row, refusalReason: 'has-other-members' },
          actor,
          staleOutcome,
          later,
        ),
      ).rejects.toThrow()
      expect(
        await recordWorkspaceDeletionRefusal(
          h.db,
          row.id,
          stale.token,
          'has-other-members',
          later,
        ),
      ).toBe(false)
      if (staleOutcome === 'deleted') {
        expect(
          await recordWorkspaceDeletionRefusal(
            h.db,
            row.id,
            current.token,
            'has-other-members',
            later,
          ),
        ).toBe(true)
        expect(
          await transitionWorkspaceDeletion(
            h.db,
            row.id,
            current.token,
            'requested',
            'drained',
            later,
          ),
        ).toBe(false)
        const refused = await readLeasedWorkspaceDeletion(
          h.db,
          row.id,
          current.token,
          later,
        )
        if (!refused) throw new Error('Missing refusal')
        await appendWorkspaceDeletionAudit(
          h.db,
          refused,
          actor,
          'deletion_refused',
          later,
        )
        expect(
          await transitionWorkspaceDeletion(
            h.db,
            row.id,
            current.token,
            'requested',
            'refused',
            later,
          ),
        ).toBe(true)
      } else {
        expect(
          await transitionWorkspaceDeletion(
            h.db,
            row.id,
            current.token,
            'requested',
            'drained',
            later,
          ),
        ).toBe(true)
        const drained = await leaseWorkspaceDeletion(h.db, row.id, later)
        if (!drained || drained === 'busy') throw new Error('Missing drained')
        expect(
          await transitionWorkspaceDeletion(
            h.db,
            row.id,
            drained.token,
            'drained',
            'rows_deleted',
            later,
          ),
        ).toBe(true)
        const deleted = await leaseWorkspaceDeletion(h.db, row.id, later)
        if (!deleted || deleted === 'busy') throw new Error('Missing deleted')
        expect(
          await recordWorkspaceDeletionRefusal(
            h.db,
            row.id,
            deleted.token,
            'has-other-members',
            later,
          ),
        ).toBe(false)
        await appendWorkspaceDeletionAudit(
          h.db,
          deleted.row,
          actor,
          'deleted',
          later,
        )
      }
      const audits = await readPlatformAuditByEntity(h.db, {
        entityType: 'workspace',
        entityId: 'alpha',
        limit: 20,
      })
      expect(audits).toHaveLength(1)
      expect(audits[0].action).toBe(
        staleOutcome === 'deleted'
          ? 'platform.workspace.deletion_refused'
          : 'platform.workspace.deleted',
      )
      await expect(
        appendWorkspaceDeletionAudit(
          h.db,
          stale.row,
          actor,
          staleOutcome,
          later,
        ),
      ).rejects.toThrow()
    } finally {
      h.close()
    }
  },
)
