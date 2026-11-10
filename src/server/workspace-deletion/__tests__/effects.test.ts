import { expect, it } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTrip } from '#/server/repos/trips'
import { getOrganization } from '#/server/repos/members'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'
import {
  insertWorkspaceDeletion,
  leaseWorkspaceDeletion,
} from '#/server/catalog/workspace-deletions'
import { readPlatformAuditByEntity } from '#/server/catalog/audit'
import { planStateCacheKey } from '#/server/billing/entitlements'
import { advanceWorkspaceDeletion } from '../driver'
import { createWorkspaceDeletionEffects } from '../effects'
import { createWorkspaceDeletionLedgerPorts } from '../ledger'
import type { WorkspaceDeletionPorts } from '../driver'

it('resumes real row deletion and two R2 sweeps without touching a second workspace', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  let now = new Date()
  try {
    const a = await h.seedTenant('alpha')
    const b = await h.seedTenant('beta')
    const trip = await createTrip(a.scope, { title: 'Trip', currency: 'EUR' })
    const bucket = fakeBucket([
      `trips/${a.organizationId}/file`,
      `trips/${b.organizationId}/file`,
    ])
    const closed: Array<string> = []
    const invalidated: Array<string> = []
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: a.organizationId,
        initiator: 'owner',
        requestedBy: a.ownerUserId,
      },
      now,
    )
    const beta = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: b.organizationId,
        initiator: 'owner',
        requestedBy: b.ownerUserId,
      },
      now,
    )
    const ports: WorkspaceDeletionPorts = {
      now: () => now,
      ...createWorkspaceDeletionLedgerPorts(h.db),
      ...createWorkspaceDeletionEffects(h.db, {
        now: () => now,
        files: bucket,
        invalidatePlan: async (key) => {
          invalidated.push(key)
        },
        closeRooms: async (_row, ids) => {
          closed.push(...ids)
        },
        polar: {
          request: async () => ({
            items: [],
            pagination: { total_count: 0, max_page: 0 },
          }),
        },
        actorFor: async () => ({
          userId: a.ownerUserId,
          actorKind: 'human' as const,
          role: 'user',
          tokenId: null,
        }),
        notifications: {
          refusalNotice: async () => {
            throw new Error('Unexpected refusal')
          },
          receipt: async () => {
            throw new Error('No receipt requested')
          },
          resumeErasure: async () => {
            throw new Error('Not erasure')
          },
        },
      }),
    }
    const save = ports.checkpoint
    let lostDeleteCheckpoint = true
    ports.checkpoint = async (...args) => {
      if (args[2] === 'rows_deleted' && lostDeleteCheckpoint) {
        lostDeleteCheckpoint = false
        return false
      }
      return save(...args)
    }
    expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('advanced')
    // The destructive write completed but its ledger checkpoint was lost.
    expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('lost-lease')
    await expect(getOrganization(a.scope)).rejects.toThrow()
    now = new Date(now.getTime() + 300_001)
    for (let step = 0; step < 3; step += 1)
      expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('advanced')
    expect(closed).toEqual([trip.id])
    expect(invalidated).toEqual([
      planStateCacheKey(a.organizationId),
      planStateCacheKey(a.organizationId),
    ])
    await expect(getOrganization(a.scope)).rejects.toThrow()
    expect((await getOrganization(b.scope)).id).toBe(b.organizationId)
    expect(bucket.remaining.has(`trips/${b.organizationId}/file`)).toBe(true)
    expect(bucket.remaining.has(`trips/${a.organizationId}/file`)).toBe(false)
    await bucket.put(
      `trips/${a.organizationId}/late-upload`,
      new Response('late bytes').body as ReadableStream,
    )
    expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('pending')
    expect(bucket.remaining.has(`trips/${a.organizationId}/late-upload`)).toBe(
      true,
    )
    now = new Date(now.getTime() + 900_000)
    expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('advanced')
    expect(bucket.remaining.has(`trips/${a.organizationId}/late-upload`)).toBe(
      false,
    )
    expect(await advanceWorkspaceDeletion(row.id, ports)).toBe('terminal')
    expect(
      await readPlatformAuditByEntity(h.db, {
        entityType: 'workspace',
        entityId: a.organizationId,
        limit: 10,
      }),
    ).toHaveLength(1)
    const untouched = await leaseWorkspaceDeletion(h.db, beta.id, now)
    if (!untouched || untouched === 'busy') throw new Error('Missing beta row')
    expect(untouched.row.state).toBe('requested')
  } finally {
    h.close()
  }
})
