import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { createErasureScope } from '../scope'
import { eraseUserMoney } from '#/server/repos/expenses-erasure'
import { eraseUserCollaboration } from '#/server/repos/collab-erasure'
import { eraseUserTrips } from '#/server/repos/trips-erasure'
import { auditLog } from '#/server/db/schema'
import {
  createTenantRepository,
  prepareTenantInsert,
} from '#/server/repos/base'
import { runBatch } from '#/server/repos/batch'
import { createHarness } from '#/server/repos/__tests__/harness'

const source = resolve('src')
const factory = join(source, 'server/erasure/scope.ts')
function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return filesUnder(path)
    return /\.[cm]?[jt]sx?$/.test(path) && !/\.(test|spec)\./.test(path)
      ? [path]
      : []
  })
}
function dependency(from: string, name: string): string | undefined {
  let path: string
  if (name.startsWith('#/') || name.startsWith('@/'))
    path = join(source, name.slice(2))
  else if (name.startsWith('.')) path = resolve(dirname(from), name)
  else return undefined
  return [
    path,
    path + '.ts',
    path + '.tsx',
    path + '.js',
    join(path, 'index.ts'),
    join(path, 'index.tsx'),
  ].find((candidate) => existsSync(candidate) && /\.[jt]sx?$/.test(candidate))
}
function reachesFactory(
  roots: string[],
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): boolean {
  const seen = new Set<string>()
  const pending = [...roots]
  while (pending.length) {
    const path = pending.pop()
    if (path === undefined || seen.has(path)) continue
    if (path === factory) return true
    seen.add(path)
    const text = read(path)
    // Static imports/re-exports, side-effect imports, dynamic imports and CommonJS requires.
    const imports =
      /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]([^'"]+)['"]/g
    for (const match of text.matchAll(imports)) {
      const name = match[1]
      if (name === undefined) continue
      const target = dependency(path, name)
      if (target) pending.push(target)
    }
  }
  return false
}

it('no route or server function can import the scope factory, including through another module', () => {
  const roots = [
    ...filesUnder(join(source, 'routes')),
    ...filesUnder(join(source, 'server/fns')),
  ]
  expect(roots.length).toBeGreaterThan(0)
  expect(reachesFactory(roots)).toBe(false)
  // Positive probe: an indirect edge through a real repository module must fail the guard.
  const bridge = join(source, 'server/repos/expenses-erasure.ts')
  const root = roots[0]
  if (root === undefined) throw new Error('No request entry point')
  expect(
    reachesFactory([root], (path) => {
      if (path === root)
        return "export { eraseUserMoney } from '#/server/repos/expenses-erasure'"
      if (path === bridge) return "import('#/server/erasure/scope')"
      return readFileSync(path, 'utf8')
    }),
  ).toBe(true)
})

it('mints only one workspace and refuses ordinary or impersonated scopes and malformed tombstones before writes', async () => {
  const harness = await createHarness()
  try {
    const a = await harness.seedTenant('a')
    expect(createErasureScope(harness.db, a.organizationId).ctx).toEqual({
      organizationId: a.organizationId,
      userId: 'system:erasure',
      role: 'owner',
      impersonatedBy: null,
    })
    for (const scrub of [eraseUserMoney, eraseUserCollaboration]) {
      await expect(scrub(a.scope, 'person', 'erased_person')).rejects.toThrow(
        'Invalid erasure',
      )
      await expect(
        scrub(
          createErasureScope(harness.db, a.organizationId),
          'person',
          'person',
        ),
      ).rejects.toThrow('Invalid erasure')
    }
    await expect(
      eraseUserTrips(a.scope, 'person', 'erased_person', async () => {}),
    ).rejects.toThrow('Invalid erasure')
    await expect(
      eraseUserMoney(
        {
          db: harness.db,
          ctx: {
            ...createErasureScope(harness.db, a.organizationId).ctx,
            impersonatedBy: 'staff',
          },
        },
        'person',
        'erased_person',
      ),
    ).rejects.toThrow('Invalid erasure')
  } finally {
    harness.close()
  }
})

it('stamps a prepared batch insert with the scope even when a payload carries another workspace', async () => {
  const harness = await createHarness()
  try {
    const a = await harness.seedTenant('a')
    const b = await harness.seedTenant('b')
    const payload = {
      organizationId: b.organizationId,
      actorUserId: 'system:erasure',
      action: 'trip.owner_promoted',
    }
    await runBatch(a.scope, [prepareTenantInsert(a.scope, auditLog, payload)])
    const repo = createTenantRepository(auditLog, 'audit')
    expect(await repo.count(a.scope)).toBe(1)
    expect(await repo.count(b.scope)).toBe(0)
    await runBatch(a.scope, [
      prepareTenantInsert(a.scope, auditLog, payload, sql`0`),
    ])
    expect(await repo.count(a.scope)).toBe(1)
    const instant = new Date('2026-10-19T00:00:00Z')
    await runBatch(a.scope, [
      prepareTenantInsert(
        a.scope,
        auditLog,
        { ...payload, createdAt: instant, metadata: { count: 1 } },
        sql`1`,
      ),
    ])
    expect(await repo.count(a.scope)).toBe(2)
    expect(await repo.count(b.scope)).toBe(0)
    expect(
      (await repo.findMany(a.scope)).find((row) => row.metadata !== null),
    ).toMatchObject({ createdAt: instant, metadata: { count: 1 } })
  } finally {
    harness.close()
  }
})
