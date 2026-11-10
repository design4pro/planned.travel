import { expect, it } from 'vitest'
import { createWorkspaceDeletionScope } from '../scope'
import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  deleteWorkspace,
  drainWorkspace,
  getOrganization,
} from '#/server/repos/members'
import {
  insertWorkspaceDeletion,
  leaseWorkspaceDeletion,
  transitionWorkspaceDeletion,
} from '#/server/catalog/workspace-deletions'

it('derives its sole workspace and departing owner from a current leased row', async () => {
  const db = await createPlatformTables()
  const now = new Date()
  try {
    const row = await insertWorkspaceDeletion(
      db.db,
      {
        organizationId: 'alpha',
        initiator: 'owner',
        requestedBy: 'owner-alpha',
      },
      now,
    )
    const lease = await leaseWorkspaceDeletion(db.db, row.id, now)
    if (!lease || lease === 'busy') throw new Error('Missing lease')
    const result = createWorkspaceDeletionScope(db.db, lease, now)
    expect(result.scope.ctx).toEqual({
      organizationId: 'alpha',
      userId: 'system:workspace-deletion',
      role: 'owner',
      impersonatedBy: null,
    })
    expect(result.departingUserId).toBe('owner-alpha')
    expect(() =>
      createWorkspaceDeletionScope(db.db, { ...lease, token: 'foreign' }, now),
    ).toThrow()
    expect(() =>
      createWorkspaceDeletionScope(
        db.db,
        lease,
        new Date(now.getTime() + 300_000),
      ),
    ).toThrow()
  } finally {
    db.close()
  }
})

it('preserves a second tenant when the driver scope drains and deletes the owner workspace', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  const now = new Date()
  try {
    const a = await h.seedTenant('alpha')
    const b = await h.seedTenant('beta')
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: a.organizationId,
        initiator: 'owner',
        requestedBy: a.ownerUserId,
      },
      now,
    )
    const lease = await leaseWorkspaceDeletion(h.db, row.id, now)
    if (!lease || lease === 'busy') throw new Error('Missing lease')
    const { scope, departingUserId, authority } = createWorkspaceDeletionScope(
      h.db,
      lease,
      now,
    )
    await expect(
      drainWorkspace(scope, { departingUserId }, async () => {}),
    ).rejects.toThrow('Workspace deletion authority lost')
    expect(
      (
        await drainWorkspace(
          scope,
          { departingUserId },
          async () => {},
          authority,
        )
      ).drained,
    ).toBe(true)
    expect(
      await transitionWorkspaceDeletion(
        h.db,
        row.id,
        lease.token,
        'requested',
        'drained',
        now,
      ),
    ).toBe(true)
    const next = await leaseWorkspaceDeletion(h.db, row.id, now)
    if (!next || next === 'busy') throw new Error('Missing delete lease')
    const final = createWorkspaceDeletionScope(h.db, next, now)
    await deleteWorkspace(final.scope, { departingUserId }, final.authority)
    await expect(getOrganization(a.scope)).rejects.toThrow()
    expect((await getOrganization(b.scope)).id).toBe(b.organizationId)
    const erasure = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: b.organizationId,
        initiator: 'erasure',
        erasureId: 'erase-beta',
      },
      now,
    )
    const erasureLease = await leaseWorkspaceDeletion(h.db, erasure.id, now)
    if (!erasureLease || erasureLease === 'busy')
      throw new Error('Missing lease')
    const erased = createWorkspaceDeletionScope(h.db, erasureLease, now)
    expect(erased.departingUserId).toBeUndefined()
    await expect(
      drainWorkspace(erased.scope, {}, async () => {}, erased.authority),
    ).rejects.toThrow()
    expect((await getOrganization(b.scope)).id).toBe(b.organizationId)
  } finally {
    h.close()
  }
})
