import { AsyncLocalStorage } from 'node:async_hooks'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { subscriptions } from '#/server/db/schema'
import { member } from '#/server/db/auth-schema'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { createScope } from '#/server/repos/base'
import { createTag } from '#/server/repos/tags'
import { listAuditLog } from '#/server/repos/audit'
import {
  createTaxonomyCategory,
  deleteTaxonomyCategory,
  loadTaxonomy,
  moveTaxonomyCategory,
  updateTaxonomyCategory,
} from '../taxonomy-lib/handlers'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

let harness: Harness
let tenant: SeededTenant
beforeEach(async () => {
  harness = await createHarness({ ddl: 'migrations' })
  tenant = await harness.seedTenant('taxonomy')
  await subscribeTenant(tenant.scope, 'free')
})
afterEach(() => harness.close())

it('prepares member reads and returns resolved shared usage without exposing tags', async () => {
  const userId = await tenant.addUser('Reader')
  const scope = tenant.scopeFor(userId)
  const data = await loadTaxonomy(scope, {})
  expect(data.categories).toHaveLength(8)
  expect(data.meter).toEqual({ used: 8, limit: 256 })
  await createTag(tenant.scope, { name: 'Tag' })
  expect((await loadTaxonomy(scope, {})).meter).toEqual({ used: 9, limit: 256 })
  expect(data).not.toHaveProperty('tags')
})

it('allows owner/admin writes and audits ordinary impersonated tenant writes', async () => {
  const admin = await tenant.addUser('Admin', 'admin')
  const scope = createScope(harness.db, {
    ...tenant.scopeFor(admin, 'admin').ctx,
    impersonatedBy: 'operator',
  })
  const row = await createTaxonomyCategory(scope, {
    name: 'Culture',
    colour: '#123',
  })
  expect(
    await updateTaxonomyCategory(scope, {
      categoryId: row.id,
      name: 'History',
    }),
  ).toMatchObject({ slug: 'culture', name: 'History' })
  await moveTaxonomyCategory(scope, { categoryId: row.id, direction: 'down' })
  await deleteTaxonomyCategory(scope, { categoryId: row.id })
  const { items: audit } = await listAuditLog(scope)
  expect(audit).toHaveLength(4)
  expect(
    audit.every((entry) => entry.metadata?.impersonatedBy === 'operator'),
  ).toBe(true)
})

it('refuses every member mutation even when the caller supplies platform or trip roles', async () => {
  const userId = await tenant.addUser('Member')
  const scope = tenant.scopeFor(userId)
  const data = await loadTaxonomy(scope, {})
  const categoryId = data.categories[0].id
  for (const write of [
    () => createTaxonomyCategory(scope, { name: 'No' }),
    () => updateTaxonomyCategory(scope, { categoryId, name: 'No' }),
    () => moveTaxonomyCategory(scope, { categoryId, direction: 'down' }),
    () => deleteTaxonomyCategory(scope, { categoryId }),
  ])
    await expect(write()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(
    createTaxonomyCategory(scope, {
      name: 'No',
      role: 'owner',
      platformRole: 'admin',
      tripRole: 'owner',
    }),
  ).rejects.toThrow()
  expect((await listAuditLog(tenant.scope)).items).toEqual([])
})

it('rejects malformed, forged, unknown fields and foreign/stale IDs', async () => {
  for (const input of [
    { name: '' },
    { name: 'No', organizationId: 'other' },
    { name: 'No', slug: 'forged' },
    { name: 'No', sortOrder: 1 },
    { name: 'No', icon: 'javascript' },
    { name: 'No', colour: 'red' },
    { name: 'x'.repeat(201) },
  ]) {
    await expect(createTaxonomyCategory(tenant.scope, input)).rejects.toThrow()
  }
  await expect(
    loadTaxonomy(tenant.scope, { organizationId: 'other' }),
  ).rejects.toThrow()
  const other = await harness.seedTenant('other')
  const row = await createTaxonomyCategory(other.scope, { name: 'Foreign' })
  for (const categoryId of [row.id, 'deleted']) {
    await expect(
      updateTaxonomyCategory(tenant.scope, { categoryId, name: 'No' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      deleteTaxonomyCategory(tenant.scope, { categoryId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      moveTaxonomyCategory(tenant.scope, { categoryId, direction: 'up' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  }
  await expect(
    updateTaxonomyCategory(tenant.scope, {
      categoryId: row.id,
      slug: 'changed',
    }),
  ).rejects.toThrow()
  await expect(
    moveTaxonomyCategory(tenant.scope, {
      categoryId: row.id,
      direction: 'sideways',
    }),
  ).rejects.toThrow()
})

vi.mock('../context', () => ({ appScope: vi.fn() }))
it('resolves current authority for each server-function call, including a role downgrade', async () => {
  const { appScope } = await import('../context')
  const { createCategoryFn } = await import('../taxonomy')
  vi.mocked(appScope).mockImplementation(async () => {
    const [membership] = await harness.db
      .select()
      .from(member)
      .where(eq(member.userId, tenant.ownerUserId))
    return tenant.scopeFor(
      tenant.ownerUserId,
      membership.role as 'owner' | 'admin' | 'member',
    )
  })
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage()
  const storage = globals[key] as AsyncLocalStorage<{
    startOptions: Record<string, never>
    request: Request
  }>
  const call = (name: string) =>
    storage.run(
      {
        startOptions: {},
        request: new Request('https://planned.travel/_serverFn/taxonomy'),
      },
      () => createCategoryFn({ data: { name } }),
    )
  await call('First')
  await harness.db
    .update(member)
    .set({ role: 'member' })
    .where(eq(member.userId, tenant.ownerUserId))
  await expect(call('After downgrade')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
  expect(vi.mocked(appScope)).toHaveBeenCalledTimes(2)
})

it('resolves the tenant limit, counts only this workspace and allows edits/deletion above quota', async () => {
  const first = await createTaxonomyCategory(tenant.scope, { name: 'Same' })
  const second = await createTaxonomyCategory(tenant.scope, { name: 'Same' })
  expect([first.slug, second.slug]).toEqual(['same', 'same-2'])
  const other = await harness.seedTenant('other-meter')
  await createTaxonomyCategory(other.scope, { name: 'Foreign' })
  await createTag(other.scope, { name: 'Foreign tag' })
  await harness.db
    .update(subscriptions)
    .set({ quotaOverrides: { taxonomy: 2 } })
    .where(eq(subscriptions.organizationId, tenant.organizationId))
  expect((await loadTaxonomy(tenant.scope, {})).meter).toEqual({
    used: 10,
    limit: 2,
  })
  await expect(
    createTaxonomyCategory(tenant.scope, { name: 'No room' }),
  ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
  await updateTaxonomyCategory(tenant.scope, {
    categoryId: first.id,
    name: 'Renamed',
  })
  await deleteTaxonomyCategory(tenant.scope, { categoryId: second.id })
  expect((await loadTaxonomy(tenant.scope, {})).meter.used).toBe(9)
})
