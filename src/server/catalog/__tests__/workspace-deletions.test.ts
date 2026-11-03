import { afterEach, beforeEach, expect, it } from 'vitest'
import { createPlatformTables } from './platform-tables'
import {
  insertWorkspaceDeletion,
  workspaceDeletionPending,
  acquireDeletionLease,
  transitionWorkspaceDeletion,
  listStaleWorkspaceDeletions,
  pruneWorkspaceDeletions,
} from '../workspace-deletions'
import type { PlatformTables } from './platform-tables'

let h: PlatformTables
const now = new Date('2026-11-03T00:00:00Z')
const request = {
  organizationId: 'alpha',
  initiator: 'owner' as const,
  requestedBy: 'owner',
  receiptTo: 'owner@example.com',
  receiptName: 'Alpha',
}
beforeEach(async () => {
  h = await createPlatformTables()
})
afterEach(() => h.close())
it('inserts once concurrently and fences only the named workspace', async () => {
  const [a, b] = await Promise.all([
    insertWorkspaceDeletion(h.db, request, now),
    insertWorkspaceDeletion(h.db, request, now),
  ])
  expect(a.id).toBe(b.id)
  expect(await workspaceDeletionPending(h.db, 'alpha')).toBe(true)
  expect(await workspaceDeletionPending(h.db, 'beta')).toBe(false)
})
it('protects a live lease and rejects its expired holder after replacement', async () => {
  const row = await insertWorkspaceDeletion(h.db, request, now)
  const first = await acquireDeletionLease(h.db, row.id, now)
  if (!first) throw new Error('Missing lease')
  expect(await acquireDeletionLease(h.db, row.id, now)).toBeNull()
  const later = new Date(now.getTime() + 61_000)
  const second = await acquireDeletionLease(h.db, row.id, later)
  if (!second) throw new Error('Missing replacement lease')
  expect(
    await transitionWorkspaceDeletion(
      h.db,
      row.id,
      first,
      'requested',
      'refused',
      later,
    ),
  ).toBe(false)
  expect(
    await transitionWorkspaceDeletion(
      h.db,
      row.id,
      second,
      'requested',
      'refused',
      later,
    ),
  ).toBe(true)
  expect(await workspaceDeletionPending(h.db, 'alpha')).toBe(false)
  expect((await insertWorkspaceDeletion(h.db, request, later)).id).not.toBe(
    row.id,
  )
})
it('lists stale unfinished work and prunes only terminal rows after thirty days', async () => {
  const refused = await insertWorkspaceDeletion(h.db, request, now)
  const lease = await acquireDeletionLease(h.db, refused.id, now)
  if (!lease) throw new Error('Missing lease')
  await transitionWorkspaceDeletion(
    h.db,
    refused.id,
    lease,
    'requested',
    'refused',
    now,
  )
  const unfinished = await insertWorkspaceDeletion(h.db, request, now)
  expect(
    (
      await listStaleWorkspaceDeletions(h.db, new Date(now.getTime() + 61_000))
    ).map((r) => r.id),
  ).toEqual([unfinished.id])
  expect(
    await pruneWorkspaceDeletions(
      h.db,
      new Date(now.getTime() + 29 * 86_400_000),
    ),
  ).toBe(0)
  expect(
    await pruneWorkspaceDeletions(
      h.db,
      new Date(now.getTime() + 31 * 86_400_000),
    ),
  ).toBe(1)
  expect(await workspaceDeletionPending(h.db, 'alpha')).toBe(true)
})
it('rejects invalid attribution and content in the snapshot', async () => {
  await expect(
    insertWorkspaceDeletion(h.db, { ...request, initiator: 'erasure' }, now),
  ).rejects.toThrow()
  await expect(
    insertWorkspaceDeletion(
      h.db,
      { ...request, snapshot: { secret: 'content' } },
      now,
    ),
  ).rejects.toThrow()
})

it('checkpoints only a live lease, clears queued receipts and retains done fencing until prune', async () => {
  const row = await insertWorkspaceDeletion(h.db, request, now)
  let state: typeof row.state = 'requested'
  for (const next of [
    'drained',
    'rows_deleted',
    'audited',
    'swept',
    'done',
  ] as const) {
    const token = await acquireDeletionLease(h.db, row.id, now)
    if (!token) throw new Error('Missing lease')
    expect(
      await transitionWorkspaceDeletion(h.db, row.id, token, state, next, now, {
        snapshot: { plan: 'solo', trips: 2, r2ObjectsDeleted: 4 },
        receiptQueued: true,
      }),
    ).toBe(true)
    state = next
    if (next === 'swept') {
      expect(
        await pruneWorkspaceDeletions(
          h.db,
          new Date(now.getTime() + 31 * 86_400_000),
        ),
      ).toBe(0)
    }
  }
  const stored = h.sqlite
    .prepare(
      'select receipt_to, receipt_name, snapshot from workspace_deletions where id = ?',
    )
    .get(row.id)
  expect(stored).toMatchObject({ receipt_to: null, receipt_name: null })
  expect(await workspaceDeletionPending(h.db, 'alpha')).toBe(true)
  expect(await acquireDeletionLease(h.db, row.id, now)).toBeNull()
  expect(
    await listStaleWorkspaceDeletions(h.db, new Date(now.getTime() + 61_000)),
  ).toEqual([])
  expect(
    await pruneWorkspaceDeletions(
      h.db,
      new Date(now.getTime() + 30 * 86_400_000),
    ),
  ).toBe(0)
  expect(
    await pruneWorkspaceDeletions(
      h.db,
      new Date(now.getTime() + 31 * 86_400_000),
    ),
  ).toBe(1)
})

it('validates erasure attribution, transitions and checkpoints without releasing a valid lease', async () => {
  const row = await insertWorkspaceDeletion(
    h.db,
    { organizationId: 'alpha', initiator: 'erasure', erasureId: 'job' },
    now,
  )
  expect(row.requestedBy).toBeNull()
  expect(row.receiptTo).toBeNull()
  const token = await acquireDeletionLease(h.db, row.id, now)
  if (!token) throw new Error('Missing lease')
  await expect(
    transitionWorkspaceDeletion(h.db, row.id, token, 'requested', 'done', now),
  ).rejects.toThrow('Invalid workspace deletion transition')
  await expect(
    transitionWorkspaceDeletion(
      h.db,
      row.id,
      token,
      'requested',
      'requested',
      now,
      { snapshot: { trips: -1 } },
    ),
  ).rejects.toThrow()
  expect(
    await transitionWorkspaceDeletion(
      h.db,
      row.id,
      token,
      'requested',
      'requested',
      now,
      { lastError: 'billing-unavailable' },
    ),
  ).toBe(true)
  expect(
    (
      await listStaleWorkspaceDeletions(h.db, new Date(now.getTime() + 61_000))
    )[0],
  ).toMatchObject({
    lastError: 'billing-unavailable',
    state: 'requested',
  })
})

it('enforces state, initiator and attribution checks in SQLite itself', async () => {
  const row = await insertWorkspaceDeletion(h.db, request, now)
  expect(() =>
    h.sqlite
      .prepare('update workspace_deletions set state = ? where id = ?')
      .run('unknown', row.id),
  ).toThrow()
  expect(() =>
    h.sqlite
      .prepare('update workspace_deletions set initiator = ? where id = ?')
      .run('unknown', row.id),
  ).toThrow()
  expect(() =>
    h.sqlite
      .prepare(
        'update workspace_deletions set requested_by = null where id = ?',
      )
      .run(row.id),
  ).toThrow()
})
