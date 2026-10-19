import { afterEach, beforeEach, expect, it } from 'vitest'
import { auditLog } from '#/server/db/schema'
import { createMemorySink, createLogger } from '#/server/observability'
import { PLATFORM_SYSTEM_ACTOR } from '#/server/catalog/audit'
import { createHarness } from '#/server/repos/__tests__/harness'
import { pruneAuditLog } from '#/server/repos/audit'
import { pruneTenantAuditLog } from '../retention'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

let harness: Harness
let a: SeededTenant
let b: SeededTenant
const now = new Date('2026-10-19T00:00:00Z')
const cutoff = new Date(now.getTime() - 400 * 86_400_000)
beforeEach(async () => {
  harness = await createHarness()
  a = await harness.seedTenant('audit-a')
  b = await harness.seedTenant('audit-b')
  if (a.organizationId > b.organizationId) [a, b] = [b, a]
})
afterEach(() => harness.close())
async function seed(tenant: SeededTenant, id: string, createdAt: Date) {
  await harness.db.insert(auditLog).values({
    id,
    organizationId: tenant.organizationId,
    actorUserId: tenant.ownerUserId,
    action: 'trip.created',
    createdAt,
  })
}
it('derives the 400-day cutoff, keeps its boundary and isolates the workspace', async () => {
  await seed(a, 'a-old', new Date(cutoff.getTime() - 1))
  await seed(a, 'a-boundary', cutoff)
  await seed(a, 'a-recent', now)
  await seed(b, 'b-old', new Date(cutoff.getTime() - 1))
  expect(await pruneAuditLog(a.scope, now)).toBe(1)
  expect(
    (await harness.db.select({ id: auditLog.id }).from(auditLog))
      .map((row) => row.id)
      .sort(),
  ).toEqual(['a-boundary', 'a-recent', 'b-old'])
})
it('drains both workspaces without recording an audit of itself', async () => {
  for (const [tenant, prefix] of [
    [a, 'a'],
    [b, 'b'],
  ] as const) {
    await seed(tenant, `${prefix}-old`, new Date(cutoff.getTime() - 1))
    await seed(tenant, `${prefix}-boundary`, cutoff)
    await seed(tenant, `${prefix}-recent`, now)
  }
  const sink = createMemorySink()
  const result = await pruneTenantAuditLog(
    harness.db,
    PLATFORM_SYSTEM_ACTOR,
    createLogger({ sink }),
    { now },
  )
  expect(result).toEqual({
    deleted: 2,
    batches: 2,
    organizations: 2,
    drained: true,
  })
  expect(await harness.db.select().from(auditLog)).toHaveLength(4)
})
it('bounds each delete and shares one cap across workspaces, logging undrained work at error', async () => {
  for (let i = 0; i < 201; i++)
    await seed(a, `old-${i}`, new Date(cutoff.getTime() - 1))
  await seed(b, 'b-old', new Date(cutoff.getTime() - 1))
  const sink = createMemorySink()
  const result = await pruneTenantAuditLog(
    harness.db,
    PLATFORM_SYSTEM_ACTOR,
    createLogger({ sink }),
    { now, maxBatches: 1 },
  )
  expect(result).toEqual({
    deleted: 200,
    batches: 1,
    organizations: 1,
    drained: false,
  })
  expect(await harness.db.select().from(auditLog)).toHaveLength(2)
  expect(
    sink.records.some(
      (record) => record.level === 'error' && record.drained === false,
    ),
  ).toBe(true)
  expect(
    await pruneTenantAuditLog(
      harness.db,
      PLATFORM_SYSTEM_ACTOR,
      createLogger({ sink }),
      { now },
    ),
  ).toMatchObject({ deleted: 2, drained: true })
})

it('does not reset the batch budget when moving to another workspace', async () => {
  await seed(a, 'a-old', new Date(cutoff.getTime() - 1))
  await seed(b, 'b-old', new Date(cutoff.getTime() - 1))
  const sink = createMemorySink()
  expect(
    await pruneTenantAuditLog(
      harness.db,
      PLATFORM_SYSTEM_ACTOR,
      createLogger({ sink }),
      { now, maxBatches: 1 },
    ),
  ).toEqual({ deleted: 1, batches: 1, organizations: 1, drained: false })
})
it('reports an exact full final batch as drained when no old entries remain', async () => {
  for (let i = 0; i < 200; i++)
    await seed(a, `old-${i}`, new Date(cutoff.getTime() - 1))
  const sink = createMemorySink()
  expect(
    await pruneTenantAuditLog(
      harness.db,
      PLATFORM_SYSTEM_ACTOR,
      createLogger({ sink }),
      { now, maxBatches: 1 },
    ),
  ).toMatchObject({ deleted: 200, drained: true })
})

it('discovers only due organisation ids and keyset-pages past the first 100', async () => {
  const { listTenantAuditRetentionOrganizations } =
    await import('#/server/catalog/tenant-audit-retention')
  const ids: Array<string> = []
  for (let i = 0; i < 101; i++) {
    const tenant = await harness.seedTenant(`page-${i}`)
    ids.push(tenant.organizationId)
    await seed(tenant, `page-${i}`, new Date(cutoff.getTime() - 1))
  }
  await seed(a, 'boundary-only', cutoff)
  const first = await listTenantAuditRetentionOrganizations(harness.db, now)
  const second = await listTenantAuditRetentionOrganizations(
    harness.db,
    now,
    first.at(-1)?.organizationId,
  )
  expect(first).toHaveLength(100)
  expect(second).toHaveLength(1)
  expect([...first, ...second]).toEqual(
    ids.sort().map((organizationId) => ({ organizationId })),
  )
  expect(
    await listTenantAuditRetentionOrganizations(
      harness.db,
      now,
      second[0]?.organizationId,
    ),
  ).toEqual([])
})
