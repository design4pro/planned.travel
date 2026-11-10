import { afterEach, beforeEach, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { contentEntries, contentVersions } from '#/server/db/schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { Harness } from '#/server/repos/__tests__/harness'

let h: Harness
beforeEach(async () => {
  h = await createHarness({ ddl: 'migrations' })
})
afterEach(() => h.close())
it('ships seven additive tables and database-enforced immutable source revisions', async () => {
  expect(h.tableNames()).toEqual(
    expect.arrayContaining([
      'content_entries',
      'content_versions',
      'content_translations',
      'release_publications',
      'release_deployments',
      'release_deployment_entries',
      'release_production_state',
    ]),
  )
  const [entry] = await h.db
    .insert(contentEntries)
    .values({ slug: '1.0.0' })
    .returning()
  const [version] = await h.db
    .insert(contentVersions)
    .values({
      entryId: entry.id,
      revision: 1,
      sourceCommit: 'a'.repeat(40),
      sourceHash: 'b'.repeat(64),
      cutoffSha: 'c'.repeat(40),
      body: {
        title: 'Fixture',
        summary: ['A fixture'],
        features: [],
        fixes: [],
      },
    })
    .returning()
  await expect(
    h.db
      .update(contentVersions)
      .set({ sourceHash: 'd'.repeat(64) })
      .where(eq(contentVersions.id, version.id)),
  ).rejects.toThrow()
  await expect(
    h.db.delete(contentVersions).where(eq(contentVersions.id, version.id)),
  ).rejects.toThrow()
  expect(await h.db.select().from(contentVersions)).toEqual([version])
  await expect(h.db.delete(contentEntries)).rejects.toThrow()
})
