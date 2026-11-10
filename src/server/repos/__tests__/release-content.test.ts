import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, expect, inject, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { admin } from 'better-auth/plugins/admin'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getPlatformProxy } from 'wrangler'
import { eq } from 'drizzle-orm'
import { user, organization, member } from '#/server/db/auth-schema'
import {
  importRelease,
  approveRelease,
  approveReleaseTranslation,
} from '../content'
import {
  listReleaseHistory,
  seedPreviewReleaseDeployment,
  withdrawRelease,
} from '../releases'
import { createLogger, createMemorySink } from '#/server/observability'
import * as audit from '#/server/catalog/audit'
import { createHarness } from './harness'
import { runAtomicDatabaseBatch } from '../batch'
import {
  contentEntries,
  trips,
  contentTranslations,
  releaseDeployments,
  releaseDeploymentEntries,
  releaseProductionState,
  contentVersions,
  releasePublications,
  platformAuditLog,
} from '#/server/db/schema'
import type { ReleaseAuthority } from '#/server/auth/release-authority'
import type { Database } from '#/server/db/types'
import type { AuthSession } from '#/server/auth/tenant'

let directory: string
let platform: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>
let db: Database
let authority: ReleaseAuthority
const body = {
  title: 'Release fixture',
  summary: ['A complete local fixture.'],
  features: ['A new capability.'],
  fixes: [],
}
const source = {
  operationId: 'import-1',
  version: '1.0.0',
  headingDate: '2026-11-01',
  sourceCommit: 'a'.repeat(40),
  cutoffSha: 'b'.repeat(40),
  body,
}
const session: AuthSession = {
  user: {
    id: 'operator',
    email: 'operator@example.test',
    name: 'Operator',
    emailVerified: true,
    image: null,
    twoFactorEnabled: true,
    role: 'admin',
    banned: false,
    banReason: null,
    banExpires: null,
  },
  session: {
    id: 'session',
    token: 'fixture',
    userId: 'operator',
    activeOrganizationId: 'workspace-a',
    expiresAt: new Date('2099-01-01'),
    impersonatedBy: null,
  },
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'release-content-'))
  const configPath = join(directory, 'wrangler.json')
  await writeFile(
    configPath,
    JSON.stringify({
      name: 'release-content-test',
      compatibility_date: '2026-08-15',
      d1_databases: [
        {
          binding: 'DB',
          database_name: 'test',
          database_id: '00000000-0000-0000-0000-000000000001',
        },
      ],
    }),
  )
  platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath,
    persist: false,
    remoteBindings: false,
  })
  db = drizzle(platform.env.DB)
  for (const ddl of inject('schemaDdl'))
    await platform.env.DB.prepare(ddl).run()
}, 60000)
beforeEach(async () => {
  const triggers = await platform.env.DB.prepare(
    "select name from sqlite_master where type = 'trigger'",
  ).all<{ name: string }>()
  for (const { name } of triggers.results)
    await platform.env.DB.exec(`drop trigger "${name}"`)
  await platform.env.DB.batch([
    ...[
      'release_production_state',
      'release_deployment_entries',
      'release_deployments',
      'release_publications',
      'content_translations',
    ].map((table) => platform.env.DB.prepare(`delete from ${table}`)),
    platform.env.DB.prepare(
      'update content_entries set published_version_id = null',
    ),
    ...[
      'content_versions',
      'content_entries',
      'platform_audit_log',
      'trips',
      'member',
      'organization',
      'user',
    ].map((table) => platform.env.DB.prepare(`delete from ${table}`)),
  ])
  for (const ddl of inject('schemaDdl').filter((statement) =>
    statement.startsWith('CREATE TRIGGER'),
  ))
    await platform.env.DB.exec(ddl)
  await db.insert(user).values({
    id: 'operator',
    email: 'operator@example.test',
    name: 'Operator',
    createdAt: new Date(),
    updatedAt: new Date(),
    role: 'admin',
  })
  authority = {
    session,
    adapter: drizzleAdapter(db, { provider: 'sqlite', schema: { user } })({
      plugins: [admin()],
    }),
  }
}, 60000)
afterAll(async () => {
  await platform?.dispose()
  if (directory) await rm(directory, { recursive: true, force: true })
})
async function imported() {
  return importRelease(db, authority, source)
}
async function approved() {
  const result = await imported()
  expect(result.status).toBe('applied')
  return approveRelease(db, authority, {
    operationId: 'approve-1',
    version: source.version,
    versionId: result.versionId,
    sourceHash: result.sourceHash,
    expectedGeneration: 0,
  })
}
async function shipped() {
  const result = await approved()
  return seedPreviewReleaseDeployment(db, authority, {
    operationId: 'ship-1',
    version: source.version,
    versionId: result.versionId,
    sourceHash: result.sourceHash,
    expectedGeneration: 1,
    expectedProductionGeneration: 0,
    deployment: {
      providerId: 'preview-fixture',
      runId: 'fixture-run',
      attempt: 1,
      mainCommit: source.sourceCommit,
      treeSha: 'c'.repeat(40),
      target: 'local-preview',
      activatedAt: 1000,
      receiptDigest: 'd'.repeat(64),
    },
  })
}
it('imports immutably, retries identically and refuses identity/cutoff/hash reuse conflicts', async () => {
  const first = await imported()
  expect(await imported()).toEqual({ ...first, status: 'unchanged' })
  expect(
    (
      await importRelease(db, authority, {
        ...source,
        cutoffSha: 'e'.repeat(40),
      })
    ).status,
  ).toBe('conflict')
  expect(
    (
      await importRelease(db, authority, {
        ...source,
        body: { ...body, title: 'Conflicting same commit' },
      })
    ).status,
  ).toBe('conflict')
  expect(await db.select().from(contentVersions)).toHaveLength(1)
  expect(await db.select().from(platformAuditLog)).toHaveLength(1)
})
it('keeps drafts and approvals invisible; ships a whitelist shared across workspaces', async () => {
  await approved()
  expect(
    (await listReleaseHistory(db, session, { locale: 'pl' })).items,
  ).toEqual([])
  await seedPreviewReleaseDeployment(db, authority, {
    operationId: 'ship-1',
    version: source.version,
    versionId: (await imported()).versionId,
    sourceHash: (await imported()).sourceHash,
    expectedGeneration: 1,
    expectedProductionGeneration: 0,
    deployment: {
      providerId: 'fixture',
      runId: 'run',
      attempt: 1,
      mainCommit: source.sourceCommit,
      treeSha: 'c'.repeat(40),
      target: 'local-preview',
      activatedAt: 1000,
      receiptDigest: 'd'.repeat(64),
    },
  })
  for (const [label, role] of [
    ['a', 'owner'],
    ['b', 'admin'],
  ] as const) {
    await db.insert(organization).values({
      id: `workspace-${label}`,
      name: `Private workspace ${label}`,
      slug: `workspace-${label}`,
      createdAt: new Date(),
    })
    await db.insert(user).values({
      id: `reader-${label}`,
      name: `Reader ${label}`,
      email: `reader-${label}@example.test`,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await db.insert(member).values({
      id: `member-${label}`,
      userId: `reader-${label}`,
      organizationId: `workspace-${label}`,
      role,
      createdAt: new Date(),
    })
    await db.insert(trips).values({
      organizationId: `workspace-${label}`,
      createdBy: `reader-${label}`,
      title: `PRIVATE-TENANT-CONTENT-${label}`,
      slug: `private-${label}`,
    })
    const workspaceSession = {
      ...session,
      user: { ...session.user, id: `reader-${label}`, role: 'user' },
      session: {
        ...session.session,
        userId: `reader-${label}`,
        activeOrganizationId: `workspace-${label}`,
      },
    }
    await expect(
      importRelease(
        db,
        { ...authority, session: workspaceSession },
        { ...source, operationId: `denied-${label}` },
      ),
    ).rejects.toThrow()
    expect(
      await listReleaseHistory(db, workspaceSession, { locale: 'pl' }),
    ).toEqual(await listReleaseHistory(db, session, { locale: 'pl' }))
  }
  const a = await listReleaseHistory(db, session, { locale: 'pl' })
  const b = await listReleaseHistory(
    db,
    {
      ...session,
      session: { ...session.session, activeOrganizationId: 'workspace-b' },
    },
    { locale: 'pl' },
  )
  expect(a).toEqual(b)
  expect(a.items).toEqual([
    {
      version: '1.0.0',
      shippedAt: 1000,
      contentLocale: 'en',
      sourceLocale: 'en',
      usedFallback: true,
      ...body,
    },
  ])
  const foreignSelector = {
    locale: 'en' as const,
    organizationId: 'workspace-b',
  }
  await expect(
    listReleaseHistory(db, session, foreignSelector),
  ).rejects.toThrow()
})
it('withdraws without erasing source or history and refuses stale publication retries', async () => {
  await shipped()
  expect(
    (
      await withdrawRelease(db, authority, {
        operationId: 'withdraw-1',
        version: source.version,
        expectedGeneration: 2,
        reason: 'sensitive',
      })
    ).status,
  ).toBe('applied')
  expect(
    (await listReleaseHistory(db, session, { locale: 'en' })).items,
  ).toEqual([])
  expect(await db.select().from(contentVersions)).toHaveLength(1)
  expect(await db.select().from(releasePublications)).toHaveLength(1)
})
it('rolls back import when audit insert fails', async () => {
  await platform.env.DB.exec(
    "CREATE TRIGGER fail_audit BEFORE INSERT ON platform_audit_log BEGIN SELECT RAISE(ABORT, 'fixture audit failure'); END",
  )
  await expect(imported()).rejects.toThrow()
  expect(await db.select().from(contentVersions)).toEqual([])
  expect(await db.select().from(releasePublications)).toEqual([])
})
it.each(['user', 'curator', 'owner', 'admin-workspace'])(
  'denies primary role %s even when the cached session says admin',
  async (role) => {
    await db.update(user).set({ role }).where(eq(user.id, 'operator'))
    await expect(imported()).rejects.toThrow()
    expect(await db.select().from(contentVersions)).toEqual([])
  },
)
it('denies a freshly banned or missing actor and impersonation', async () => {
  await db.update(user).set({ banned: true }).where(eq(user.id, 'operator'))
  await expect(imported()).rejects.toThrow()
  await db.update(user).set({ banned: false }).where(eq(user.id, 'operator'))
  await expect(
    importRelease(
      db,
      {
        ...authority,
        session: {
          ...session,
          session: { ...session.session, impersonatedBy: 'someone' },
        },
      },
      source,
    ),
  ).rejects.toThrow()
  await db.delete(user).where(eq(user.id, 'operator'))
  await expect(imported()).rejects.toThrow()
})

it('appends a correction while retaining the previous approved visible source until replacement ships', async () => {
  await shipped()
  const before = await db.select().from(contentVersions)
  const correction = await importRelease(db, authority, {
    ...source,
    operationId: 'correct-1',
    sourceCommit: 'e'.repeat(40),
    body: { ...body, title: 'Corrected release' },
  })
  expect(correction.status).toBe('applied')
  const versions = await db.select().from(contentVersions)
  expect(versions).toHaveLength(2)
  expect(versions.find((v) => v.id === before[0].id)).toEqual(before[0])
  expect(
    (await listReleaseHistory(db, session, { locale: 'en' })).items[0].title,
  ).toBe(body.title)
  const [p] = await db.select().from(releasePublications)
  expect(p.approvedVersionId).toBeNull()
  await approveRelease(db, authority, {
    operationId: 'correct-approve',
    version: source.version,
    versionId: correction.versionId,
    sourceHash: correction.sourceHash,
    expectedGeneration: 3,
  })
  expect(
    (await listReleaseHistory(db, session, { locale: 'en' })).items[0].title,
  ).toBe(body.title)
  await seedPreviewReleaseDeployment(db, authority, {
    operationId: 'correct-ship',
    version: source.version,
    versionId: correction.versionId,
    sourceHash: correction.sourceHash,
    expectedGeneration: 4,
    expectedProductionGeneration: 1,
    deployment: {
      providerId: 'correct-fixture',
      runId: 'fixture-run',
      attempt: 1,
      mainCommit: 'e'.repeat(40),
      treeSha: 'c'.repeat(40),
      target: 'local-preview',
      activatedAt: 2000,
      receiptDigest: 'e'.repeat(64),
    },
  })
  expect(
    (await listReleaseHistory(db, session, { locale: 'en' })).items[0],
  ).toMatchObject({
    title: 'Corrected release',
    shippedAt: 1000,
    updatedAt: 2000,
  })
})

it('uses only the whole reviewed translation of the visible exact source revision', async () => {
  await shipped()
  const original = await imported()
  const translated = {
    title: 'Translated title',
    summary: ['Translated summary'],
    features: ['Translated feature'],
    fixes: ['Translated fix'],
  }
  expect(
    (
      await approveReleaseTranslation(db, authority, {
        operationId: 'translate-1',
        version: source.version,
        versionId: original.versionId,
        sourceHash: original.sourceHash,
        expectedGeneration: 2,
        locale: 'pl',
        body: translated,
      })
    ).status,
  ).toBe('applied')
  expect(
    (await listReleaseHistory(db, session, { locale: 'pl' })).items[0],
  ).toMatchObject({
    ...translated,
    contentLocale: 'pl',
    sourceLocale: 'en',
    usedFallback: false,
  })
  expect(
    (await listReleaseHistory(db, session, { locale: 'ar' })).items[0],
  ).toMatchObject({ ...body, contentLocale: 'en', usedFallback: true })
  const correction = await importRelease(db, authority, {
    ...source,
    operationId: 'edit-2',
    sourceCommit: 'f'.repeat(40),
    body: { ...body, title: 'New English source' },
  })
  await approveRelease(db, authority, {
    operationId: 'review-2',
    version: source.version,
    versionId: correction.versionId,
    sourceHash: correction.sourceHash,
    expectedGeneration: 4,
  })
  await seedPreviewReleaseDeployment(db, authority, {
    operationId: 'ship-2',
    version: source.version,
    versionId: correction.versionId,
    sourceHash: correction.sourceHash,
    expectedGeneration: 5,
    expectedProductionGeneration: 1,
    deployment: {
      providerId: 'correction',
      runId: 'fixture',
      attempt: 1,
      mainCommit: 'f'.repeat(40),
      treeSha: 'c'.repeat(40),
      target: 'local-preview',
      activatedAt: 2000,
      receiptDigest: 'e'.repeat(64),
    },
  })
  expect(
    (await listReleaseHistory(db, session, { locale: 'pl' })).items[0],
  ).toMatchObject({
    title: 'New English source',
    summary: body.summary,
    contentLocale: 'en',
    usedFallback: true,
  })
  expect(await db.select().from(contentTranslations)).toHaveLength(1)
})

it('paginates equal timestamps by the same deterministic binary version tuple', async () => {
  const versions = ['1.10.0', '1.2.0', '1.9.0']
  for (const [index, version] of versions.entries()) {
    const importedRevision = await importRelease(db, authority, {
      ...source,
      version,
      operationId: `import-${index}`,
      body: { ...body, title: version },
    })
    await approveRelease(db, authority, {
      version,
      versionId: importedRevision.versionId,
      sourceHash: importedRevision.sourceHash,
      expectedGeneration: 0,
      operationId: `approve-${index}`,
    })
    await seedPreviewReleaseDeployment(db, authority, {
      version,
      versionId: importedRevision.versionId,
      sourceHash: importedRevision.sourceHash,
      expectedGeneration: 1,
      expectedProductionGeneration: index,
      operationId: `ship-${index}`,
      deployment: {
        providerId: `fixture-${index}`,
        runId: 'fixture',
        attempt: 1,
        mainCommit: source.sourceCommit,
        treeSha: 'c'.repeat(40),
        target: 'local-preview',
        activatedAt: (index + 1) * 1000,
        receiptDigest: 'd'.repeat(64),
      },
    })
  }
  await db.update(releasePublications).set({ firstShippedAt: new Date(1000) })
  const first = await listReleaseHistory(db, session, {
    locale: 'en',
    limit: 1,
  })
  const second = await listReleaseHistory(db, session, {
    locale: 'en',
    limit: 1,
    cursor: first.nextCursor ?? undefined,
  })
  const third = await listReleaseHistory(db, session, {
    locale: 'en',
    limit: 1,
    cursor: second.nextCursor ?? undefined,
  })
  expect(
    [...first.items, ...second.items, ...third.items].map((v) => v.version),
  ).toEqual(['1.9.0', '1.2.0', '1.10.0'])
  expect(third.nextCursor).toBeNull()
})

it('rolls back every receipt, pointer and audit statement on a real D1 batch fault', async () => {
  const approvedRevision = await imported()
  await approveRelease(db, authority, {
    version: source.version,
    versionId: approvedRevision.versionId,
    sourceHash: approvedRevision.sourceHash,
    expectedGeneration: 0,
    operationId: 'approvedRevision',
  })
  const tables = [
    'content_entries',
    'content_versions',
    'content_translations',
    'release_publications',
    'release_deployments',
    'release_deployment_entries',
    'release_production_state',
    'platform_audit_log',
  ]
  const footprint = () =>
    Promise.all(
      tables.map((table) =>
        platform.env.DB.prepare(`select * from ${table} order by rowid`).raw(),
      ),
    )
  const before = await footprint()
  let failAt = 0
  let count = 1
  const faulty = new Proxy(platform.env.DB, {
    get(target, property) {
      if (property === 'batch')
        return (statements: Array<D1PreparedStatement>) => {
          count = statements.length
          const batch = [...statements]
          batch.splice(
            failAt,
            0,
            target.prepare('select * from nonexistent_release_fault'),
          )
          return target.batch(batch)
        }
      const value: unknown = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  const faultDb = drizzle(faulty)
  for (failAt = 0; failAt <= count; failAt++) {
    await expect(
      seedPreviewReleaseDeployment(faultDb, authority, {
        version: source.version,
        versionId: approvedRevision.versionId,
        sourceHash: approvedRevision.sourceHash,
        expectedGeneration: 1,
        expectedProductionGeneration: 0,
        operationId: 'ship-fault',
        deployment: {
          providerId: 'fixture',
          runId: 'fixture',
          attempt: 1,
          mainCommit: source.sourceCommit,
          treeSha: 'c'.repeat(40),
          target: 'local-preview',
          activatedAt: 1000,
          receiptDigest: 'd'.repeat(64),
        },
      }),
    ).rejects.toThrow()
    expect(await footprint()).toEqual(before)
  }
}, 60000)

it('allows one winning CAS even when concurrent callers reuse the same operation id', async () => {
  const importedRevision = await importRelease(db, authority, source)
  let arrived = 0
  let release: () => void = () => {
    throw new Error('Gate not initialized')
  }
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const racing = new Proxy(platform.env.DB, {
    get(target, property) {
      if (property === 'batch')
        return async (statements: Array<D1PreparedStatement>) => {
          if (++arrived === 2) release()
          await gate
          return target.batch(statements)
        }
      const value: unknown = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  const racingDb = drizzle(racing)
  const input = {
    version: source.version,
    versionId: importedRevision.versionId,
    sourceHash: importedRevision.sourceHash,
    expectedGeneration: 0,
    operationId: 'same-review',
  }
  const results = await Promise.all([
    approveRelease(racingDb, authority, input),
    approveRelease(racingDb, authority, input),
  ])
  expect(results.map((result) => result.status).sort()).toEqual([
    'applied',
    'conflict',
  ])
  expect(await db.select().from(platformAuditLog)).toHaveLength(2)
  expect((await approveRelease(db, authority, input)).status).toBe('unchanged')
})

it('refuses an unknown batch driver before executing any mutation', async () => {
  const unsupported = await createHarness()
  try {
    const write = unsupported.db
      .insert(contentEntries)
      .values({ slug: '1.0.0' })
    await expect(
      runAtomicDatabaseBatch(unsupported.db, [write]),
    ).rejects.toThrow('Known atomic D1 driver required')
    expect(await unsupported.db.select().from(contentEntries)).toEqual([])
    await expect(
      importRelease(unsupported.db, authority, source),
    ).rejects.toThrow('Known atomic D1 driver required')
    expect(await unsupported.db.select().from(contentVersions)).toEqual([])
  } finally {
    unsupported.close()
  }
})

it('refuses invalid audit preparation before the import batch', async () => {
  const prepare = audit.preparePlatformAudit
  const spy = vi
    .spyOn(audit, 'preparePlatformAudit')
    .mockImplementation((database, actor, input) =>
      prepare(database, actor, { ...input, sourceHash: 'invalid' }),
    )
  try {
    await expect(imported()).rejects.toThrow()
    expect(await db.select().from(contentEntries)).toEqual([])
    expect(await db.select().from(contentVersions)).toEqual([])
    expect(await db.select().from(platformAuditLog)).toEqual([])
  } finally {
    spy.mockRestore()
  }
})

it('denies primary read errors, unauthenticated requests, and expired sessions', async () => {
  const spy = vi
    .spyOn(authority.adapter, 'findOne')
    .mockRejectedValue(new Error('Primary unavailable'))
  await expect(imported()).rejects.toThrow('Primary unavailable')
  spy.mockRestore()
  await expect(
    importRelease(db, { ...authority, session: null }, source),
  ).rejects.toThrow()
  await expect(
    importRelease(
      db,
      {
        ...authority,
        session: {
          ...session,
          session: { ...session.session, expiresAt: new Date(0) },
        },
      },
      source,
    ),
  ).rejects.toThrow()
  await expect(listReleaseHistory(db, null, { locale: 'en' })).rejects.toThrow()
  expect(await db.select().from(platformAuditLog)).toEqual([])
})

it('restricts ordinary deletion without cascading away source, receipts or publication history', async () => {
  await shipped()
  await expect(db.delete(contentEntries)).rejects.toThrow()
  await expect(db.delete(contentVersions)).rejects.toThrow()
  await expect(db.delete(releasePublications)).rejects.toThrow()
  expect(await db.select().from(releaseDeployments)).toHaveLength(1)
  expect(await db.select().from(releaseDeploymentEntries)).toHaveLength(1)
  expect(await db.select().from(releaseProductionState)).toHaveLength(1)
  expect(await db.select().from(contentVersions)).toHaveLength(1)
})

it('links several approved releases to one matching receipt without advancing active state again', async () => {
  await shipped()
  const second = await importRelease(db, authority, {
    ...source,
    operationId: 'import-second',
    version: '1.1.0',
  })
  await approveRelease(db, authority, {
    operationId: 'review-second',
    version: '1.1.0',
    versionId: second.versionId,
    sourceHash: second.sourceHash,
    expectedGeneration: 0,
  })
  const input = {
    operationId: 'link-second',
    version: '1.1.0',
    versionId: second.versionId,
    sourceHash: second.sourceHash,
    expectedGeneration: 1,
    expectedProductionGeneration: 1,
    deployment: {
      providerId: 'preview-fixture',
      runId: 'fixture-run',
      attempt: 1,
      mainCommit: source.sourceCommit,
      treeSha: 'c'.repeat(40),
      target: 'local-preview' as const,
      activatedAt: 1000,
      receiptDigest: 'd'.repeat(64),
    },
  }
  expect(
    (await seedPreviewReleaseDeployment(db, authority, input)).status,
  ).toBe('applied')
  expect(
    (await seedPreviewReleaseDeployment(db, authority, input)).status,
  ).toBe('unchanged')
  expect(await db.select().from(releaseDeployments)).toHaveLength(1)
  expect(await db.select().from(releaseDeploymentEntries)).toHaveLength(2)
  expect((await db.select().from(releaseProductionState))[0].generation).toBe(1)
  expect(
    (await listReleaseHistory(db, session, { locale: 'en' })).items.map(
      (item) => item.version,
    ),
  ).toEqual(['1.1.0', '1.0.0'])
})

it('rejects pairing an existing commit with another existing revision hash', async () => {
  await imported()
  const correctedBody = { ...body, title: 'Later revision' }
  await importRelease(db, authority, {
    ...source,
    operationId: 'import-correction',
    sourceCommit: 'e'.repeat(40),
    body: correctedBody,
  })
  const result = await importRelease(db, authority, {
    ...source,
    operationId: 'forged-pair',
    body: correctedBody,
  })
  expect(result.status).toBe('conflict')
  expect(await db.select().from(contentVersions)).toHaveLength(2)
})

it.each(['user', 'curator', 'banned', 'impersonated'])(
  'applies the same authority veto to every writer: %s',
  async (veto) => {
    await shipped()
    const original = await imported()
    if (veto === 'banned')
      await db.update(user).set({ banned: true }).where(eq(user.id, 'operator'))
    else if (veto === 'impersonated')
      authority = {
        ...authority,
        session: {
          ...session,
          session: { ...session.session, impersonatedBy: 'operator-2' },
        },
      }
    else
      await db.update(user).set({ role: veto }).where(eq(user.id, 'operator'))
    const revision = {
      version: source.version,
      versionId: original.versionId,
      sourceHash: original.sourceHash,
      expectedGeneration: 2,
    }
    const before = await db.select().from(platformAuditLog)
    for (const write of [
      () =>
        importRelease(db, authority, {
          ...source,
          operationId: 'denied-import',
          sourceCommit: 'e'.repeat(40),
          body: { ...body, title: 'Denied' },
        }),
      () =>
        approveRelease(db, authority, {
          ...revision,
          operationId: 'denied-review',
        }),
      () =>
        approveReleaseTranslation(db, authority, {
          ...revision,
          operationId: 'denied-translation',
          locale: 'pl',
          body,
        }),
      () =>
        seedPreviewReleaseDeployment(db, authority, {
          ...revision,
          operationId: 'denied-receipt',
          expectedProductionGeneration: 1,
          deployment: {
            providerId: 'denied-fixture',
            runId: 'fixture',
            attempt: 1,
            mainCommit: source.sourceCommit,
            treeSha: 'c'.repeat(40),
            target: 'local-preview',
            activatedAt: 2000,
            receiptDigest: 'e'.repeat(64),
          },
        }),
      () =>
        withdrawRelease(db, authority, {
          version: source.version,
          expectedGeneration: 2,
          operationId: 'denied-withdrawal',
          reason: 'sensitive',
        }),
    ])
      await expect(write()).rejects.toThrow()
    expect(await db.select().from(platformAuditLog)).toEqual(before)
  },
)

it('does not reuse an old operation id for a different content transition', async () => {
  await imported()
  const review = await imported()
  await approveRelease(db, authority, {
    operationId: 'approved',
    version: source.version,
    versionId: review.versionId,
    sourceHash: review.sourceHash,
    expectedGeneration: 0,
  })
  expect(
    (
      await importRelease(db, authority, {
        ...source,
        sourceCommit: 'e'.repeat(40),
        body: { ...body, title: 'Conflicting retry' },
      })
    ).status,
  ).toBe('conflict')
  expect(await db.select().from(contentVersions)).toHaveLength(1)
  expect(await db.select().from(platformAuditLog)).toHaveLength(2)
})

it('reconciles a losing concurrent import against commit identity as well as its hash', async () => {
  const correctedBody = { ...body, title: 'Concurrent later revision' }
  let intercepted = false
  const competing = new Proxy(platform.env.DB, {
    get(target, property) {
      if (property === 'batch')
        return async (statements: Array<D1PreparedStatement>) => {
          if (!intercepted) {
            intercepted = true
            await importRelease(db, authority, source)
            await importRelease(db, authority, {
              ...source,
              operationId: 'concurrent-correction',
              sourceCommit: 'e'.repeat(40),
              body: correctedBody,
            })
          }
          return target.batch(statements)
        }
      const value: unknown = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  expect(
    (
      await importRelease(drizzle(competing), authority, {
        ...source,
        operationId: 'conflicting-loser',
        body: correctedBody,
      })
    ).status,
  ).toBe('conflict')
  expect(await db.select().from(contentVersions)).toHaveLength(2)
})

it('keeps review attribution solely in its atomic audit row and survives identity retention expiry', async () => {
  await shipped()
  const revision = await imported()
  await approveReleaseTranslation(db, authority, {
    operationId: 'translation-review',
    version: source.version,
    versionId: revision.versionId,
    sourceHash: revision.sourceHash,
    expectedGeneration: 2,
    locale: 'pl',
    body: { ...body, title: 'Translated release' },
  })
  const [publication] = await db.select().from(releasePublications)
  const [translation] = await db.select().from(contentTranslations)
  expect(publication.reviewAuditId).toBe('approve-1')
  expect(translation.reviewAuditId).toBe('translation-review')
  const reviews = await db.select().from(platformAuditLog)
  expect(
    reviews.find((row) => row.id === publication.reviewAuditId),
  ).toMatchObject({
    actorUserId: 'operator',
    action: 'release.reviewed',
    changes: {
      after: { versionId: revision.versionId, sourceHash: revision.sourceHash },
    },
  })
  expect(
    reviews.find((row) => row.id === translation.reviewAuditId),
  ).toMatchObject({
    actorUserId: 'operator',
    action: 'release.translation_reviewed',
    changes: {
      after: {
        versionId: revision.versionId,
        sourceHash: revision.sourceHash,
        locale: 'pl',
      },
    },
  })
  await db
    .insert(user)
    .values({
      id: 'retained-reader',
      name: 'Reader',
      email: 'reader@example.test',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  const readerSession = {
    ...session,
    user: { ...session.user, id: 'retained-reader', role: 'user' },
    session: { ...session.session, userId: 'retained-reader' },
  }
  const before = await listReleaseHistory(db, readerSession, { locale: 'pl' })
  await db.delete(user).where(eq(user.id, 'operator'))
  const logger = createLogger({ level: 'debug', sink: createMemorySink() })
  const result = await audit.prunePlatformAuditLog(
    db,
    audit.PLATFORM_SYSTEM_ACTOR,
    logger,
    { now: new Date(Date.now() + 401 * 86400000) },
  )
  expect(result.deleted).toBe(reviews.length)
  expect(await db.select().from(platformAuditLog)).toEqual([])
  expect(await listReleaseHistory(db, readerSession, { locale: 'pl' })).toEqual(
    before,
  )
}, 60000)

it('refuses a translation review audit that omits its locale', () => {
  expect(() =>
    audit.preparePlatformAudit(
      db,
      { actorKind: 'human', userId: 'operator', role: 'admin', tokenId: null },
      {
        action: 'release.translation_reviewed',
        entityId: 'publication',
        operationId: 'translation-review',
        versionId: 'revision',
        sourceHash: 'a'.repeat(64),
      },
    ),
  ).toThrow()
})
