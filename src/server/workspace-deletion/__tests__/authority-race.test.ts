import { expect, it } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTrip, requireTrip } from '#/server/repos/trips'
import { upsertSubscription } from '#/server/repos/billing'
import { getOrganization } from '#/server/repos/members'
import { insertWorkspaceDeletion } from '#/server/catalog/workspace-deletions'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'
import { advanceWorkspaceDeletion } from '../driver'
import { createWorkspaceDeletionEffects } from '../effects'
import { createWorkspaceDeletionLedgerPorts } from '../ledger'
import type { WorkspaceDeletionPorts } from '../driver'

it.each(
  [false, true].flatMap((accepted) =>
    [false, true].map((final) => ({ accepted, final })),
  ),
)(
  'denies stale holder after replacement refusal (accepted=$accepted, final=$final)',
  async ({ accepted, final }) => {
    let finalPause = async () => {}
    const h = await createHarness({
      ddl: 'migrations',
      beforeStatement: async (query) => {
        if (final && query.startsWith('delete from "organization"'))
          await finalPause()
      },
    })
    let now = new Date()
    let providerUnavailable = false
    try {
      const a = await h.seedTenant('alpha')
      const b = await h.seedTenant('beta')
      const selected = await createTrip(a.scope, { title: 'Selected' })
      const neighbor = await createTrip(b.scope, { title: 'Neighbor' })
      const row = await insertWorkspaceDeletion(
        h.db,
        {
          organizationId: a.organizationId,
          initiator: 'owner',
          requestedBy: a.ownerUserId,
          receiptTo: 'private@example.com',
        },
        now,
      )
      if (final)
        h.sqlite
          .prepare(
            "update workspace_deletions set state = 'drained' where id = ?",
          )
          .run(row.id)
      let unblock!: () => void
      let entered!: () => void
      const waiting = new Promise<void>((resolve) => {
        entered = resolve
      })
      const barrier = new Promise<void>((resolve) => {
        unblock = resolve
      })
      finalPause = async () => {
        entered()
        await barrier
      }
      const ports: WorkspaceDeletionPorts = {
        now: () => now,
        ...createWorkspaceDeletionLedgerPorts(h.db),
        ...createWorkspaceDeletionEffects(h.db, {
          now: () => now,
          files: fakeBucket([]),
          polar: {
            request: async () => {
              if (providerUnavailable) throw new Error('Provider unavailable')
              return { items: [], pagination: { total_count: 0, max_page: 0 } }
            },
          },
          invalidatePlan: async () => {},
          closeRooms: async () => {
            if (!final) {
              entered()
              await barrier
            }
          },
          actorFor: async () => ({
            userId: a.ownerUserId,
            actorKind: 'human',
            role: 'user',
            tokenId: null,
          }),
          notifications: {
            receipt: async () => {},
            resumeErasure: async (request) => ({
              accepted: true,
              id: request.id,
            }),
            refusalNotice: async (request) => {
              if (!accepted) throw new Error('Notice rejected')
              return { accepted: true, id: request.id }
            },
          },
        }),
      }
      const stale = advanceWorkspaceDeletion(row.id, ports)
      await waiting
      now = new Date(now.getTime() + 300_001)
      // B uses the real billing/delete effects: only the remote provider response is controlled.
      if (final)
        await upsertSubscription(a.scope, {
          status: 'active',
          providerSubscriptionId: 'sub-race',
        })
      else providerUnavailable = true
      const replacement = ports
      if (accepted)
        expect(await advanceWorkspaceDeletion(row.id, replacement)).toBe(
          'advanced',
        )
      else
        await expect(
          advanceWorkspaceDeletion(row.id, replacement),
        ).rejects.toThrow('Notice rejected')
      // Restore eligibility before releasing A: member/subscription guards alone cannot hide B1.
      if (final) await upsertSubscription(a.scope, { status: 'canceled' })
      providerUnavailable = false
      const snapshot = () =>
        h.sqlite
          .prepare('select * from workspace_deletions where id = ?')
          .get(row.id)
      const before = snapshot()
      const beforeAudit = h.sqlite
        .prepare('select * from platform_audit_log')
        .all()
      expect(beforeAudit).toHaveLength(accepted ? 1 : 0)
      const childRows = () =>
        h.sqlite
          .prepare('select * from trip_members where trip_id = ?')
          .all(selected.id)
      const beforeChildren = childRows()
      expect(beforeChildren).toHaveLength(1)
      // Direct fixture insert models an already-in-flight tenant writer, bypassing admission fences.
      h.sqlite
        .prepare(
          'insert into trips (id, slug, organization_id, title, currency, created_by, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          'late-trip',
          'late-trip',
          a.organizationId,
          'Late',
          'EUR',
          a.ownerUserId,
          now.getTime(),
          now.getTime(),
        )
      unblock()
      expect(await stale).toBe('lost-lease')
      expect((await requireTrip(a.scope, selected.id)).id).toBe(selected.id)
      expect(
        h.sqlite.prepare('select id from trips where id = ?').get('late-trip'),
      ).toBeDefined()
      expect((await requireTrip(b.scope, neighbor.id)).id).toBe(neighbor.id)
      expect((await getOrganization(a.scope)).id).toBe(a.organizationId)
      expect(snapshot()).toEqual(before)
      expect(childRows()).toEqual(beforeChildren)
      expect(
        h.sqlite.prepare('select * from platform_audit_log').all(),
      ).toEqual(beforeAudit)
      expect(
        h.sqlite
          .prepare(
            "select action from platform_audit_log where action = 'platform.workspace.deleted'",
          )
          .all(),
      ).toEqual([])
    } finally {
      h.close()
    }
  },
)

const tables = [
  'trips',
  'audit_log',
  'notifications',
  'usage_records',
  'places',
  'collections',
  'journeys',
  'organization',
] as const
const losses = [
  'empty-select',
  'live',
  'clock-advanced',
  'token',
  'id',
  'tenant',
  'requester',
  'state',
  'intent',
  'terminal',
  'expired',
  'equal',
  'null-expiry',
  'null-clock',
  'missing',
] as const

it.each(tables.flatMap((table) => losses.map((loss) => ({ table, loss }))))(
  'fences $table DELETE at execution after $loss authority loss',
  async ({ table, loss }) => {
    let revoke = false
    let revoked = false
    let seed = () => {}
    let lose = () => {}
    const h = await createHarness({
      ddl: 'migrations',
      beforeStatement: async (query) => {
        if (!revoke) return
        if (query.startsWith('select ') && query.includes(`from "${table}"`)) {
          seed()
          if (loss === 'empty-select') {
            revoked = true
            revoke = false
            lose()
          }
        }
        if (query.startsWith(`delete from "${table}"`)) {
          revoked = true
          revoke = false
          lose()
        }
      },
    })
    const now = new Date()
    try {
      const a = await h.seedTenant('matrix')
      const b = await h.seedTenant('neighbor')
      await createTrip(b.scope, { title: 'Neighbor' })
      const row = await insertWorkspaceDeletion(
        h.db,
        {
          organizationId: a.organizationId,
          initiator: 'owner',
          requestedBy: a.ownerUserId,
          receiptTo: 'private@example.com',
        },
        now,
      )
      if (table === 'organization')
        h.sqlite
          .prepare(
            "update workspace_deletions set state = 'drained' where id = ?",
          )
          .run(row.id)
      const insert = (
        name: string,
        values: Record<string, string | number>,
      ) => {
        const columns = Object.keys(values)
        h.sqlite
          .prepare(
            `insert into "${name}" (${columns.join(',')}) values (${columns.map(() => '?').join(',')})`,
          )
          .run(...Object.values(values))
      }
      let seeded = false
      seed = () => {
        if (seeded || table === 'organization') return
        seeded = true
        const base = {
          id: 'retained',
          organization_id: a.organizationId,
          created_at: now.getTime(),
          updated_at: now.getTime(),
        }
        if (table === 'trips')
          insert(table, {
            ...base,
            title: 'Retained',
            slug: 'retained',
            created_by: a.ownerUserId,
          })
        if (table === 'audit_log') {
          const { updated_at: _updated, ...audit } = base
          insert(table, { ...audit, action: 'test' })
        }
        if (table === 'notifications')
          insert(table, {
            ...base,
            recipient_user_id: a.ownerUserId,
            title_key: 'test',
            body_key: 'test',
          })
        if (table === 'usage_records')
          insert(table, { ...base, metric: 'trips' })
        if (table === 'collections')
          insert(table, {
            ...base,
            owner_user_id: a.ownerUserId,
            name: 'Retained',
            slug: 'retained',
          })
        if (table === 'journeys')
          insert(table, {
            ...base,
            owner_user_id: a.ownerUserId,
            title: 'Retained',
            slug: 'retained',
          })
        if (table === 'places') {
          insert('trips', {
            ...base,
            id: 'late-parent',
            title: 'Late parent',
            slug: 'late-parent',
            created_by: a.ownerUserId,
          })
          insert(table, { ...base, trip_id: 'late-parent', name: 'Retained' })
        }
      }
      let after: unknown
      const read = () =>
        h.sqlite.prepare('select * from workspace_deletions').all()
      lose = () => {
        const updates: Record<string, [string, string | number | null]> = {
          token: ['lease_token', 'replacement'],
          id: ['id', 'replacement-id'],
          tenant: ['organization_id', b.organizationId],
          requester: ['requested_by', b.ownerUserId],
          state: ['state', table === 'organization' ? 'requested' : 'drained'],
          intent: ['refusal_reason', 'billing-unavailable'],
          terminal: ['state', 'refused'],
          expired: ['lease_until', now.getTime() - 1],
          equal: ['lease_until', now.getTime()],
          'null-expiry': ['lease_until', null],
        }
        if (loss === 'empty-select')
          h.sqlite
            .prepare(
              "update workspace_deletions set lease_token = 'replacement' where id = ?",
            )
            .run(row.id)
        else if (loss === 'live') {
        } else if (loss === 'clock-advanced')
          h.sqlite.function(
            'unixepoch',
            { varargs: true },
            () => (now.getTime() + 300_001) / 1000,
          )
        else if (loss === 'missing')
          h.sqlite
            .prepare('delete from workspace_deletions where id = ?')
            .run(row.id)
        else if (loss === 'null-clock')
          h.sqlite.function('unixepoch', { varargs: true }, () => null)
        else {
          const [column, value] = updates[loss]
          h.sqlite
            .prepare(
              `update workspace_deletions set ${column} = ? where id = ?`,
            )
            .run(value, row.id)
        }
        after = read()
      }
      const ports: WorkspaceDeletionPorts = {
        now: () => now,
        ...createWorkspaceDeletionLedgerPorts(h.db),
        ...createWorkspaceDeletionEffects(h.db, {
          now: () => now,
          files: fakeBucket([]),
          polar: {
            request: async () => ({
              items: [],
              pagination: { total_count: 0, max_page: 0 },
            }),
          },
          closeRooms: async () => {},
          invalidatePlan: async () => {
            if (loss !== 'live')
              throw new Error('Denied deletion cannot invalidate')
          },
          actorFor: async () => ({
            actorKind: 'human',
            userId: a.ownerUserId,
            role: 'user',
            tokenId: null,
          }),
          notifications: {
            receipt: async () => {},
            refusalNotice: async () => {
              throw new Error('Authority loss is not business refusal')
            },
            resumeErasure: async (request) => ({
              accepted: true,
              id: request.id,
            }),
          },
        }),
      }
      revoke = true
      expect(await advanceWorkspaceDeletion(row.id, ports)).toBe(
        loss === 'live' ? 'advanced' : 'lost-lease',
      )
      expect(revoked).toBe(true)
      if (table !== 'organization')
        expect(
          h.sqlite
            .prepare(`select id from "${table}" where id = 'retained'`)
            .get(),
        ).toEqual(loss === 'live' ? undefined : { id: 'retained' })
      expect(
        h.sqlite
          .prepare('select id from organization where id = ?')
          .get(a.organizationId),
      ).toEqual(
        loss === 'live' && table === 'organization'
          ? undefined
          : { id: a.organizationId },
      )
      expect(
        h.sqlite
          .prepare('select id from member where organization_id = ?')
          .all(a.organizationId),
      ).toHaveLength(loss === 'live' && table === 'organization' ? 0 : 1)
      expect(
        h.sqlite
          .prepare('select id from trips where organization_id = ?')
          .all(b.organizationId),
      ).toHaveLength(1)
      if (loss !== 'live') expect(read()).toEqual(after)
      expect(
        h.sqlite.prepare('select id from platform_audit_log').all(),
      ).toEqual([])
    } finally {
      h.close()
    }
  },
)
