import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/d1'
import { getPlatformProxy } from 'wrangler'
import { expect, it } from 'vitest'
import {
  shippedMigrations,
  statementsOf,
} from '#/server/db/__tests__/migration-files'
import { createScope } from '#/server/repos/base'
import {
  previewGallerySubmission,
  expireGalleryPreviews,
  readGalleryPreview,
} from '#/server/repos/community'
import { deleteTrip } from '#/server/repos/trips'
import { drainWorkspace, deleteWorkspace } from '#/server/repos/members'
import { sweepGalleryPreviews } from '#/server/community/expiry'
import { GALLERY_MAX_BYTES } from '#/server/community/snapshot'
import type { GalleryPreviewResult } from '#/server/community/snapshot'

function ready(
  value: GalleryPreviewResult,
): asserts value is Extract<GalleryPreviewResult, { status: 'ready' }> {
  expect(value.status).toBe('ready')
}
const fields = {
  tripId: 'trip',
  publicTitle: 'Public',
  summary: 'Summary',
  attribution: 'Traveller',
  showDates: false,
}

it('captures and replaces atomically within every bound on migrations-built D1, and deletion fails closed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gallery-d1-'))
  const configPath = join(directory, 'wrangler.json')
  await writeFile(
    configPath,
    JSON.stringify({
      name: 'gallery-test',
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
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath,
    persist: false,
    remoteBindings: false,
  })
  const binding = platform.env.DB
  const execute = (statement: string) => binding.prepare(statement).run()
  try {
    for (const migration of shippedMigrations())
      await binding.batch(
        statementsOf(migration.sql).map((statement) =>
          binding.prepare(statement),
        ),
      )
    await execute(
      "INSERT INTO organization (id,name,slug,created_at,updated_at) VALUES ('org','Org','org',1,1),('victim','Victim','victim',1,1)",
    )
    await execute(
      "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('actor','Actor','a@example.test',1,1,1),('outsider','Outsider','b@example.test',1,1,1)",
    )
    await execute(
      "INSERT INTO member (id,organization_id,user_id,role,created_at) VALUES ('m','org','actor','owner',1),('o','org','outsider','admin',1)",
    )
    await execute(
      "INSERT INTO trips (id,organization_id,created_by,title,slug,created_at,updated_at,country_codes) VALUES ('trip','org','actor','Private','private',1,1,'[\"PL\",\"JP\"]'),('victim-trip','victim','actor','Secret','secret',1,1,'[]')",
    )
    await execute(
      "INSERT INTO trip_members (id,organization_id,trip_id,user_id,role,created_at,updated_at) VALUES ('tm','org','trip','actor','owner',1,1)",
    )
    await execute(
      "INSERT INTO workspace_deletions (id,organization_id,requested_by,initiator,state,requested_at,updated_at) VALUES ('victim-deletion','victim','actor','owner','requested',1,1)",
    )
    const db = drizzle(binding)
    const scope = createScope(db, {
      organizationId: 'org',
      userId: 'actor',
      role: 'owner',
      impersonatedBy: null,
    })
    const victim = createScope(db, { ...scope.ctx, organizationId: 'victim' })
    const outsider = createScope(db, {
      ...scope.ctx,
      userId: 'outsider',
      role: 'admin',
    })
    const first = await previewGallerySubmission(scope, fields, 1000)
    ready(first)
    expect(first.document.countryCodes).toEqual(['PL', 'JP'])
    const stored = await binding
      .prepare('SELECT document FROM gallery_previews WHERE id=?')
      .bind(first.previewId)
      .first<{ document: string }>()
    expect(JSON.stringify(first.document)).toBe(stored?.document)
    await expect(
      previewGallerySubmission(victim, fields),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      previewGallerySubmission(outsider, fields),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await execute(
      "INSERT INTO trip_members (id,organization_id,trip_id,user_id,role,created_at,updated_at) VALUES ('outsider-trip','org','trip','outsider','viewer',1,1)",
    )
    expect(
      await readGalleryPreview(outsider, first.previewId, 'trip', 1000),
    ).toBeNull()
    await expect(
      previewGallerySubmission(scope, {
        ...fields,
        actorUserId: 'outsider',
      } as typeof fields),
    ).rejects.toThrow()
    await expect(
      previewGallerySubmission(scope, {
        ...fields,
        organizationId: 'victim',
      } as typeof fields),
    ).rejects.toThrow()
    await execute(
      "INSERT INTO workspace_deletions (id,organization_id,requested_by,initiator,state,requested_at,updated_at) VALUES ('own-deletion','org','actor','owner','requested',1,1)",
    )
    for (const state of ['requested', 'done']) {
      await binding
        .prepare(
          "UPDATE workspace_deletions SET state=? WHERE id='own-deletion'",
        )
        .bind(state)
        .run()
      await expect(
        previewGallerySubmission(scope, fields),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      expect(
        await readGalleryPreview(scope, first.previewId, 'trip', 1000),
      ).toBeNull()
      expect(
        await binding
          .prepare('SELECT document FROM gallery_previews WHERE id=?')
          .bind(first.previewId)
          .first('document'),
      ).toBe(stored?.document)
    }
    await execute(
      "UPDATE workspace_deletions SET state='refused' WHERE id='own-deletion'",
    )
    const unfenced = await previewGallerySubmission(scope, fields, 2000)
    ready(unfenced)
    expect(
      await readGalleryPreview(scope, unfenced.previewId, 'trip', 2000),
    ).not.toBeNull()
    await execute(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<366) INSERT INTO days (id,organization_id,trip_id,day_number,date,title,notes,created_at,updated_at) SELECT 'd'||x,'org','trip',x,'2026-01-01','','PRIVATE NOTE',1,1 FROM n",
    )
    const textBoundary = await previewGallerySubmission(scope, {
      ...fields,
      publicTitle: 't'.repeat(120),
      summary: 's'.repeat(280),
      attribution: 'a'.repeat(80),
    })
    ready(textBoundary)
    for (const [field, maximum] of [
      ['publicTitle', 120],
      ['summary', 280],
      ['attribution', 80],
    ] as const) {
      await expect(
        previewGallerySubmission(scope, {
          ...fields,
          [field]: 'a'.repeat(maximum + 1),
        }),
      ).rejects.toThrow()
    }
    expect(
      await readGalleryPreview(scope, textBoundary.previewId, 'trip'),
    ).not.toBeNull()
    const daysBoundary = await previewGallerySubmission(scope, fields)
    ready(daysBoundary)
    expect(daysBoundary.document.days).toHaveLength(366)
    expect(daysBoundary.document.days[0]).toEqual({
      order: 1,
      title: '',
      places: [],
    })
    await execute(
      "INSERT INTO days (id,organization_id,trip_id,day_number,created_at,updated_at) VALUES ('overflow','org','trip',367,1,1)",
    )
    expect(await previewGallerySubmission(scope, fields)).toEqual({
      status: 'too-large',
    })
    expect(
      await readGalleryPreview(scope, daysBoundary.previewId, 'trip'),
    ).not.toBeNull()
    await execute("DELETE FROM days WHERE id='overflow'")
    await execute(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1000) INSERT INTO places (id,organization_id,trip_id,name,notes,lat,lng,created_at,updated_at) SELECT 'p'||x,'org','trip','Place '||x,'PRIVATE PLACE',0,0,1,1 FROM n",
    )
    await execute(
      "INSERT INTO day_assignments (id,organization_id,trip_id,day_id,place_id,order_index,created_at,updated_at) SELECT 'a'||id,'org','trip','d1',id,0,1,1 FROM places WHERE organization_id='org'",
    )
    await execute(
      "INSERT INTO categories (id,organization_id,name,slug,created_at,updated_at) VALUES ('public-category','org','Public category','public',1,1),('victim-category','victim','PRIVATE CATEGORY','private',1,1)",
    )
    await execute(
      "UPDATE places SET category_id='public-category' WHERE id='p1'",
    )
    await execute(
      "UPDATE places SET category_id='victim-category' WHERE id='p2'",
    )
    const placesBoundary = await previewGallerySubmission(scope, {
      ...fields,
      showDates: true,
    })
    ready(placesBoundary)
    expect(placesBoundary.document.days[0]?.places).toHaveLength(1000)
    expect(
      placesBoundary.document.days[0]?.places
        .slice(0, 4)
        .map((place) => place.name),
    ).toEqual(['Place 1', 'Place 10', 'Place 100', 'Place 1000'])
    expect(
      placesBoundary.document.days[0]?.places.find(
        (place) => place.name === 'Place 1',
      )?.category,
    ).toBe('Public category')
    expect(
      placesBoundary.document.days[0]?.places.find(
        (place) => place.name === 'Place 2',
      )?.category,
    ).toBeNull()

    expect(placesBoundary.document.days[0]?.date).toBe('2026-01-01')
    expect(placesBoundary.document.days[0]?.places[0]?.coordinates).toEqual({
      lat: 0,
      lng: 0,
    })
    expect(JSON.stringify(placesBoundary.document)).not.toContain('PRIVATE')
    await execute(
      "INSERT INTO day_assignments (id,organization_id,trip_id,day_id,place_id,created_at,updated_at) VALUES ('overflow','org','trip','d2','p1',1,1)",
    )
    expect(await previewGallerySubmission(scope, fields)).toEqual({
      status: 'too-large',
    })
    await execute("DELETE FROM day_assignments WHERE id='overflow'")
    await execute(
      "INSERT INTO places (id,organization_id,trip_id,name,created_at,updated_at) VALUES ('overflow','org','trip','Overflow',1,1)",
    )
    expect(await previewGallerySubmission(scope, fields)).toEqual({
      status: 'too-large',
    })
    await execute("DELETE FROM places WHERE id='overflow'")
    await execute('DELETE FROM days WHERE day_number>1')
    await execute("UPDATE days SET title='' WHERE id='d1'")
    const baseline = await previewGallerySubmission(scope, fields)
    ready(baseline)
    const baselineBytes = await binding
      .prepare('SELECT document FROM gallery_previews WHERE id=?')
      .bind(baseline.previewId)
      .first<{ document: string }>()
    expect(baselineBytes).not.toBeNull()
    const size = new TextEncoder().encode(baselineBytes?.document).length
    const exact = 'é' + 'a'.repeat(GALLERY_MAX_BYTES - size - 2)
    await binding
      .prepare("UPDATE days SET title=? WHERE id='d1'")
      .bind(exact)
      .run()
    const byteBoundary = await previewGallerySubmission(scope, fields)
    ready(byteBoundary)
    expect(
      await binding
        .prepare(
          'SELECT length(cast(document as blob)) AS size FROM gallery_previews WHERE id=?',
        )
        .bind(byteBoundary.previewId)
        .first('size'),
    ).toBe(GALLERY_MAX_BYTES)
    await binding
      .prepare("UPDATE days SET title=? WHERE id='d1'")
      .bind(exact + 'a')
      .run()
    expect(await previewGallerySubmission(scope, fields)).toEqual({
      status: 'too-large',
    })
    await execute("UPDATE days SET title='before' WHERE id='d1'")
    const [during] = await Promise.all([
      previewGallerySubmission(scope, fields),
      binding.batch([
        binding.prepare("UPDATE days SET title='after'"),
        binding.prepare("UPDATE places SET name='after'"),
      ]),
    ])
    ready(during)
    const day = during.document.days[0]
    expect([
      ['before', 'Place 1'],
      ['after', 'after'],
    ]).toContainEqual([
      day?.title,
      day?.places.find(
        (place) => place.name === 'Place 1' || place.name === 'after',
      )?.name,
    ])
    const beforeRevoke = await previewGallerySubmission(scope, fields)
    ready(beforeRevoke)
    await execute("UPDATE member SET role='member' WHERE id='m'")
    await expect(previewGallerySubmission(scope, fields)).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    )
    expect(
      await readGalleryPreview(scope, beforeRevoke.previewId, 'trip'),
    ).toBeNull()
    await execute("UPDATE member SET role='owner' WHERE id='m'")
    await execute("UPDATE trips SET country_codes='broken'")
    expect(await previewGallerySubmission(scope, fields)).toEqual({
      status: 'too-large',
    })
    await execute("UPDATE trips SET country_codes='[]'")
    await execute(
      "CREATE TRIGGER refuse_preview_cleanup BEFORE DELETE ON gallery_previews BEGIN SELECT RAISE(ABORT, 'cleanup unavailable'); END",
    )
    await expect(
      expireGalleryPreviews(scope, Date.now() + 1000000),
    ).rejects.toThrow()
    await expect(deleteTrip(scope, 'trip')).rejects.toThrow()
    expect(
      await binding.prepare("SELECT id FROM trips WHERE id='trip'").first(),
    ).not.toBeNull()
    await execute('DELETE FROM member')
    await expect(drainWorkspace(scope, {}, async () => {})).rejects.toThrow()
    await expect(deleteWorkspace(scope)).rejects.toThrow()
    expect(
      await binding
        .prepare("SELECT id FROM organization WHERE id='org'")
        .first(),
    ).not.toBeNull()
    await execute('DROP TRIGGER refuse_preview_cleanup')
    await sweepGalleryPreviews(db, Date.now() + 1000000)
    expect(
      (await binding.prepare('SELECT id FROM gallery_previews').all()).results,
    ).toEqual([])
    await execute(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<101) INSERT INTO gallery_previews (id,organization_id,trip_id,actor_user_id,document,expires_at) SELECT 'expired'||x,'org','trip','expired'||x,'{}',0 FROM n",
    )
    expect(await expireGalleryPreviews(scope, 1)).toBe(100)
    expect(await expireGalleryPreviews(scope, 1)).toBe(1)
    await execute(
      "INSERT INTO member (id,organization_id,user_id,role,created_at) VALUES ('m','org','actor','owner',1)",
    )
    const last = await previewGallerySubmission(scope, fields)
    ready(last)
    await execute('DROP TABLE categories')
    await expect(previewGallerySubmission(scope, fields)).rejects.toThrow()
    expect(
      await binding
        .prepare('SELECT id FROM gallery_previews WHERE id=?')
        .bind(last.previewId)
        .first(),
    ).not.toBeNull()
    const categoriesDdl = shippedMigrations()
      .flatMap((migration) => statementsOf(migration.sql))
      .find((statement) => statement.startsWith('CREATE TABLE `categories`'))
    if (!categoriesDdl) throw new Error('Missing categories migration')
    await execute(categoriesDdl)
    await deleteTrip(scope, 'trip')
    expect(
      (await binding.prepare('SELECT id FROM gallery_previews').all()).results,
    ).toEqual([])
    expect(
      await binding
        .prepare("SELECT id FROM trips WHERE id='victim-trip'")
        .first(),
    ).not.toBeNull()
    await execute('DELETE FROM member')
    await drainWorkspace(scope, {}, async () => {})
    await deleteWorkspace(scope)
    expect(
      await binding
        .prepare("SELECT id FROM organization WHERE id='org'")
        .first(),
    ).toBeNull()
    expect(
      await binding
        .prepare("SELECT id FROM organization WHERE id='victim'")
        .first(),
    ).not.toBeNull()
  } finally {
    await platform.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 120000)
