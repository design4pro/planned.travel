import { expect, it, vi } from 'vitest'
import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import {
  recordWorkspaceDeletionRefusal,
  insertWorkspaceDeletion,
  leaseWorkspaceDeletion,
} from '#/server/catalog/workspace-deletions'
import {
  PLATFORM_SYSTEM_ACTOR,
  appendWorkspaceDeletionAudit,
  readPlatformAuditByEntity,
} from '#/server/catalog/audit'
import { advanceWorkspaceDeletion } from '../driver'
import { createWorkspaceDeletionLedgerPorts } from '../ledger'
import type { WorkspaceDeletionPorts } from '../driver'

it.each(['has-other-members', 'live-subscription'] as const)(
  'freezes %s before a failed notice and never re-enters destructive work',
  async (reason) => {
    const h = await createPlatformTables()
    let now = new Date('2026-11-09T00:00:00Z')
    try {
      const row = await insertWorkspaceDeletion(
        h.db,
        {
          organizationId: 'alpha',
          initiator: 'owner',
          requestedBy: 'owner',
          receiptTo: 'private@example.com',
          receiptName: 'Private',
        },
        now,
      )
      let refuse = true
      const notice = vi.fn(async (request: { readonly id: string }) => {
        if (refuse) throw new Error('delivery failed')
        return { accepted: true as const, id: request.id }
      })
      const drain = vi.fn(async () => (refuse ? reason : ('drained' as const)))
      const deletion = vi.fn(async () => 'deleted' as const)
      const actor = {
        actorKind: 'human' as const,
        userId: 'owner',
        role: null,
        tokenId: null,
      }
      const ports: WorkspaceDeletionPorts = {
        now: () => now,
        ...createWorkspaceDeletionLedgerPorts(h.db),
        billing: async () => 'allowed',
        drain,
        deleteRows: deletion,
        refuse: (leased) =>
          appendWorkspaceDeletionAudit(
            h.db,
            leased,
            actor,
            'deletion_refused',
            now,
          ),
        refusalNotice: notice,
        resumeErasure: async () => {
          throw new Error('Owner must not wake erasure')
        },
        invalidatePlan: async () => {},
        audit: async () => {},
        receipt: async () => {},
        reconcileBilling: async () => {},
        sweep: async () => ({ drained: true, deleted: 0 }),
      }
      await expect(advanceWorkspaceDeletion(row.id, ports)).rejects.toThrow(
        'delivery failed',
      )
      const held = await leaseWorkspaceDeletion(h.db, row.id, now)
      if (!held || held === 'busy') throw new Error('Missing refusal retry')
      expect(held.row).toMatchObject({
        state: 'requested',
        refusalReason: reason,
        receiptTo: 'private@example.com',
        receiptName: 'Private',
      })
      expect(
        await readPlatformAuditByEntity(h.db, {
          entityType: 'workspace',
          entityId: 'alpha',
          limit: 10,
        }),
      ).toEqual([])
      refuse = false // membership/billing premise has changed; the first durable refusal still wins.
      now = new Date(now.getTime() + 300_001)
      expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('advanced')
      expect(drain).toHaveBeenCalledTimes(1)
      expect(deletion).not.toHaveBeenCalled()
      expect(notice).toHaveBeenCalledTimes(2)
      expect(await leaseWorkspaceDeletion(h.db, row.id, now)).toBeNull()
      const audits = await readPlatformAuditByEntity(h.db, {
        entityType: 'workspace',
        entityId: 'alpha',
        limit: 10,
      })
      expect(audits).toHaveLength(1)
      expect(audits[0].action).toBe('platform.workspace.deletion_refused')
      const saved = h.sqlite
        .prepare(
          'select state, refusal_reason, receipt_to, receipt_name from workspace_deletions where id = ?',
        )
        .get(row.id)
      expect(saved).toMatchObject({
        state: 'refused',
        refusal_reason: reason,
        receipt_to: null,
        receipt_name: null,
      })
    } finally {
      h.close()
    }
  },
)

it('recovers crashes after intent, notice acceptance, audit acceptance and terminal lease loss', async () => {
  const h = await createPlatformTables()
  let now = new Date('2026-11-09T00:00:00Z')
  try {
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: 'alpha',
        initiator: 'owner',
        requestedBy: 'owner',
        receiptTo: 'private@example.com',
      },
      now,
    )
    const first = await leaseWorkspaceDeletion(h.db, row.id, now)
    if (!first || first === 'busy') throw new Error('Missing initial lease')
    // Simulate death immediately after intent persistence, before any notice/audit/checkpoint.
    expect(
      await recordWorkspaceDeletionRefusal(
        h.db,
        row.id,
        first.token,
        'has-other-members',
        now,
      ),
    ).toBe(true)
    now = new Date(now.getTime() + 300_001)
    const notice = vi.fn(async (request: { readonly id: string }) => ({
      accepted: true as const,
      id: request.id,
    }))
    const destructive = vi.fn(async () => 'drained' as const)
    const actor = {
      actorKind: 'human' as const,
      userId: 'owner',
      role: null,
      tokenId: null,
    }
    let failAudit = true
    let loseTerminal = true
    const ledger = createWorkspaceDeletionLedgerPorts(h.db)
    const ports: WorkspaceDeletionPorts = {
      now: () => now,
      ...ledger,
      billing: async () => {
        throw new Error('Must not recheck billing')
      },
      drain: destructive,
      refusalNotice: notice,
      resumeErasure: async () => {
        throw new Error('Not erasure')
      },
      refuse: async (leased) => {
        if (failAudit) throw new Error('Audit unavailable')
        await appendWorkspaceDeletionAudit(
          h.db,
          leased,
          actor,
          'deletion_refused',
          now,
        )
      },
      checkpoint: async (...args) => {
        if (args[2] === 'refused' && loseTerminal) {
          now = new Date(now.getTime() + 300_001)
          await leaseWorkspaceDeletion(h.db, row.id, now)
        }
        return ledger.checkpoint(...args)
      },
      deleteRows: async () => {
        throw new Error('Must not delete')
      },
      invalidatePlan: async () => {},
      audit: async () => {},
      receipt: async () => {},
      reconcileBilling: async () => {},
      sweep: async () => ({ drained: true, deleted: 0 }),
    }
    await expect(advanceWorkspaceDeletion(row.id, ports)).rejects.toThrow(
      'Audit unavailable',
    )
    expect(
      h.sqlite
        .prepare(
          'select state, receipt_to, refusal_reason from workspace_deletions where id = ?',
        )
        .get(row.id),
    ).toMatchObject({
      state: 'requested',
      receipt_to: 'private@example.com',
      refusal_reason: 'has-other-members',
    })
    failAudit = false
    expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('lost-lease')
    expect(
      h.sqlite
        .prepare(
          'select state, receipt_to from workspace_deletions where id = ?',
        )
        .get(row.id),
    ).toMatchObject({ state: 'requested', receipt_to: 'private@example.com' })
    loseTerminal = false
    now = new Date(now.getTime() + 300_001)
    expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('advanced')
    expect(notice).toHaveBeenCalledTimes(3)
    expect(new Set(notice.mock.calls.map(([request]) => request.id))).toEqual(
      new Set([`workspace-deletion:${row.id}:refused`]),
    )
    expect(destructive).not.toHaveBeenCalled()
    expect(
      await readPlatformAuditByEntity(h.db, {
        entityType: 'workspace',
        entityId: 'alpha',
        limit: 10,
      }),
    ).toHaveLength(1)
    expect(
      h.sqlite
        .prepare(
          'select state, receipt_to from workspace_deletions where id = ?',
        )
        .get(row.id),
    ).toMatchObject({ state: 'refused', receipt_to: null })
  } finally {
    h.close()
  }
})

it('resumes an erasure refusal before auditing without an owner notice or receipt fields', async () => {
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
    let rejected = true
    const notice = vi.fn(async (request: { readonly id: string }) => ({
      accepted: true as const,
      id: request.id,
    }))
    const wake = vi.fn(async (request: { readonly id: string }) => {
      if (rejected) throw new Error('Wake rejected')
      return { accepted: true as const, id: request.id }
    })
    const ports: WorkspaceDeletionPorts = {
      now: () => now,
      ...createWorkspaceDeletionLedgerPorts(h.db),
      billing: async () => 'allowed',
      drain: async () => 'has-other-members',
      refusalNotice: notice,
      resumeErasure: wake,
      refuse: (leased) =>
        appendWorkspaceDeletionAudit(
          h.db,
          leased,
          PLATFORM_SYSTEM_ACTOR,
          'deletion_refused',
          now,
        ),
      deleteRows: async () => {
        throw new Error('Must not delete')
      },
      invalidatePlan: async () => {},
      audit: async () => {},
      receipt: async () => {},
      reconcileBilling: async () => {},
      sweep: async () => ({ drained: true, deleted: 0 }),
    }
    await expect(advanceWorkspaceDeletion(row.id, ports)).rejects.toThrow(
      'Wake rejected',
    )
    expect(
      await readPlatformAuditByEntity(h.db, {
        entityType: 'workspace',
        entityId: 'alpha',
        limit: 10,
      }),
    ).toEqual([])
    rejected = false
    expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('advanced')
    expect(wake).toHaveBeenCalledTimes(2)
    expect(notice).not.toHaveBeenCalled()
    expect(
      h.sqlite
        .prepare(
          'select state, receipt_to, receipt_name from workspace_deletions where id = ?',
        )
        .get(row.id),
    ).toMatchObject({ state: 'refused', receipt_to: null, receipt_name: null })
  } finally {
    h.close()
  }
})
