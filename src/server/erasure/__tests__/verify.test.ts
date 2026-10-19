/**
 * The verification sweep at its interface, over an in-memory database and fake stores: an id planted
 * in each registered place (and in each non-column place) is reported, a full run reports nothing,
 * and a sweep for a person in workspace A neither reads nor reports workspace B.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from '#/server/observability'
import {
  countAccountPlacesUnscoped,
  listTripIdsForRoomReset,
  platformPlaceNames,
} from '#/server/repos/erasure-sweep'
import { createTrip } from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { ERASURE_REGISTRY } from '../registry'
import { workspaceObjectPrefix } from '../stores'
import { verifyErasure } from '../verify'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { LogRecord } from '#/server/observability'
import type { StoredObjectHead } from '../stores'
import type { VerifyErasureInput } from '../verify'

const USER = 'erase_me_1'
const EMAIL = 'Erase.Me@example.test'

let harness: Harness
let alpha: SeededTenant
let beta: SeededTenant

beforeEach(async () => {
  harness = await createHarness()
  alpha = await harness.seedTenant('alpha')
  beta = await harness.seedTenant('beta')
  // The planter writes one column of each table and fills the rest, so neither a foreign key nor a
  // CHECK on those fillers is the subject here.
  harness.sqlite.exec('PRAGMA foreign_keys = OFF')
  harness.sqlite.exec('PRAGMA ignore_check_constraints = ON')
})

afterEach(() => {
  harness.close()
})

/* ------------------------------------------------------------------- planting -- */

interface ColumnInfo {
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

let counter = 0

/**
 * Inserts one row into `table` with `value` in `column` and the tenant column set when the table
 * has one. Every other NOT NULL column without a default gets a filler that is unique per row, so
 * a unique index never trips.
 */
function plantRow(
  table: string,
  column: string,
  value: string,
  organizationId: string | null,
): void {
  const info = harness.sqlite
    .prepare(`pragma table_info(${table})`)
    .all() as unknown as Array<ColumnInfo>
  const names: Array<string> = []
  const values: Array<string | number> = []
  for (const col of info) {
    counter += 1
    let planted: string | number | undefined
    if (col.name === column) planted = value
    else if (col.name === 'organization_id' && organizationId !== null)
      planted = organizationId
    else if (col.pk > 0 || (col.notnull === 1 && col.dflt_value === null)) {
      planted = /int|real|num/i.test(col.type) ? 0 : `filler-${counter}`
    }
    if (planted !== undefined) {
      names.push(col.name)
      values.push(planted)
    }
  }
  harness.sqlite
    .prepare(
      `insert into ${table} (${names.join(',')}) values (${names.map(() => '?').join(',')})`,
    )
    .run(...values)
}

/** What each place holds when the person is in it: the email, a longer string, or the plain id. */
function plantedValue(place: string): string {
  if (place === 'invitation.email') return EMAIL.toLowerCase()
  if (place === 'verification.identifier') return `reset-${USER}-token`
  if (place === 'verification.value') return `{"userId":"${USER}"}`
  return USER
}

const placeOf = (entry: { table: string; column: string }) =>
  `${entry.table}.${entry.column}`

const isTenantTable = (table: string): boolean =>
  (
    harness.sqlite
      .prepare(`pragma table_info(${table})`)
      .all() as unknown as Array<ColumnInfo>
  ).some((col) => col.name === 'organization_id')

/** The registered places the sweep itself looks at: not the ledger, not the anchor. */
const swept = ERASURE_REGISTRY.filter(
  (entry) => entry.outcome !== 'keep' && entry.step !== 'finish',
)
const sweptPlaces = swept.map(placeOf)
const platformPlaces = platformPlaceNames()

/* ------------------------------------------------------------------- the sweep -- */

function stores(
  objects: Record<string, StoredObjectHead> = {},
  kv: Record<string, string> = {},
): VerifyErasureInput['stores'] {
  return {
    sessions: { get: async (key) => kv[key] ?? null },
    kv: { get: async (key) => kv[key] ?? null },
    objects: { head: async (key) => objects[key] ?? null },
  }
}

const zeroPlatform = () => platformPlaces.map((place) => ({ place, count: 0 }))

function sweep(
  overrides: Partial<VerifyErasureInput> = {},
  tenants: ReadonlyArray<SeededTenant> = [alpha],
) {
  return verifyErasure({
    db: harness.db,
    userId: USER,
    email: EMAIL,
    platform: zeroPlatform(),
    workspaces: tenants.map((tenant) => ({
      scope: tenant.scope,
      objectKeys: [],
    })),
    stores: stores(),
    ...overrides,
  })
}

const placesIn = (report: Awaited<ReturnType<typeof sweep>>) =>
  report.findings.map((finding) => finding.place).sort()

describe('the sweep over registered places', () => {
  it('reports nothing for a person who is nowhere', async () => {
    const report = await sweep()

    expect(report).toEqual({ passed: true, findings: [] })
  })

  it('covers every registered place that is neither the ledger nor the anchor', () => {
    // The ledger and the anchor are the only registered places the sweep does not look at.
    expect(
      ERASURE_REGISTRY.filter((entry) => !swept.includes(entry)).map(placeOf),
    ).toEqual([
      'workspace_participants.user_id',
      'platform_audit_log.actor_user_id',
      'platform_audit_log.entity_id',
    ])
  })

  it.each(sweptPlaces.filter((place) => !platformPlaces.includes(place)))(
    'reports an id planted in %s',
    async (place) => {
      const [table = '', column = ''] = place.split('.')
      plantRow(
        table,
        column,
        plantedValue(place),
        isTenantTable(table) ? alpha.organizationId : null,
      )

      const report = await sweep()

      expect(report.passed).toBe(false)
      expect(placesIn(report)).toContain(place)
    },
  )

  it('reports a platform place only when its count is supplied or left out', async () => {
    const place = platformPlaces[0] ?? ''
    expect(platformPlaces.length).toBeGreaterThan(0)

    const withCount = await sweep({
      platform: zeroPlatform().map((entry) =>
        entry.place === place ? { place, count: 2 } : entry,
      ),
    })
    const withoutCounts = await sweep({ platform: undefined })

    expect(withCount.findings).toEqual([{ kind: 'column', place, count: 2 }])
    expect(withoutCounts.findings.map((finding) => finding.kind)).toEqual(
      platformPlaces.map(() => 'unverified'),
    )
  })

  it('does not report the platform audit ledger, the registered exception', async () => {
    plantRow('platform_audit_log', 'actor_user_id', USER, null)
    plantRow('platform_audit_log', 'entity_id', USER, null)

    const report = await sweep()

    expect(report.passed).toBe(true)
  })

  it('reports nothing after a full run: every planted row removed', async () => {
    for (const place of sweptPlaces.filter(
      (p) => !platformPlaces.includes(p),
    )) {
      const [table = '', column = ''] = place.split('.')
      plantRow(
        table,
        column,
        plantedValue(place),
        isTenantTable(table) ? alpha.organizationId : null,
      )
    }
    expect((await sweep()).passed).toBe(false)

    for (const place of sweptPlaces.filter(
      (p) => !platformPlaces.includes(p),
    )) {
      const [table = ''] = place.split('.')
      harness.sqlite.exec(`delete from ${table}`)
    }

    expect(await sweep()).toEqual({ passed: true, findings: [] })
  })

  it('matches an id inside text exactly: an underscore is not a wildcard', async () => {
    plantRow('verification', 'value', '{"userId":"eraseXme_1"}', null)
    plantRow('verification', 'identifier', 'reset-eraseXme_1-token', null)

    const report = await sweep()

    expect(report.passed).toBe(true)
  })

  it('counts the email places case-insensitively and across every workspace', async () => {
    plantRow('invitation', 'email', EMAIL.toUpperCase(), beta.organizationId)
    plantRow('member', 'user_id', USER, beta.organizationId)

    const report = await sweep({}, [alpha])

    expect(placesIn(report)).toEqual(['invitation.email', 'member.user_id'])
  })
})

describe('gaps fail the sweep', () => {
  it('treats a missing email as unverified, never as zero', async () => {
    const report = await sweep({ email: null })

    expect(report.passed).toBe(false)
    expect(report.findings).toEqual([
      { kind: 'unverified', place: 'invitation.email', count: 1 },
      { kind: 'unverified', place: 'verification.identifier', count: 1 },
    ])
  })

  it('refuses an empty user id rather than matching everything', async () => {
    await expect(
      countAccountPlacesUnscoped(harness.db, { userId: '  ', email: EMAIL }),
    ).rejects.toThrow()
  })
})

describe('stores outside D1', () => {
  const head = (
    uploadedBy: string,
    organizationId: string,
  ): StoredObjectHead => ({
    etag: 'e',
    size: 1,
    customMetadata: { organizationId, uploadedBy },
  })

  it('reports the active-sessions index and the discount counter while they exist', async () => {
    const report = await sweep({
      stores: stores(
        {},
        {
          [`active-sessions-${USER}`]: '[]',
          [`billing:discount-attempts:u:${USER}`]: '3',
        },
      ),
    })

    expect(placesIn(report)).toEqual([
      'kv.active-sessions-index',
      'kv.discount-attempts',
    ])
  })

  it('checks every reported object key by head', async () => {
    const own = `${workspaceObjectPrefix(alpha.organizationId)}trip/own`
    const missing = `${workspaceObjectPrefix(alpha.organizationId)}trip/gone`
    const clean = `${workspaceObjectPrefix(alpha.organizationId)}trip/clean`
    const foreign = `${workspaceObjectPrefix(beta.organizationId)}trip/foreign`

    const report = await sweep({
      workspaces: [
        {
          scope: alpha.scope,
          objectKeys: [own, missing, clean, foreign],
        },
      ],
      stores: stores({
        [own]: head(USER, alpha.organizationId),
        [clean]: head('erased_x', alpha.organizationId),
        [foreign]: head(USER, beta.organizationId),
      }),
    })

    expect(report.findings).toEqual([
      {
        kind: 'object',
        place: 'r2.uploaded-by.missing',
        organizationId: alpha.organizationId,
        count: 1,
      },
      {
        kind: 'object',
        place: 'r2.uploaded-by.refused',
        organizationId: alpha.organizationId,
        count: 1,
      },
      {
        kind: 'object',
        place: 'r2.uploaded-by.names-person',
        organizationId: alpha.organizationId,
        count: 1,
      },
    ])
  })
})

describe('tenant isolation', () => {
  it("does not read or report another workspace's rows", async () => {
    plantRow('expenses', 'paid_by', USER, beta.organizationId)
    plantRow('audit_log', 'entity_id', USER, beta.organizationId)

    const forAlpha = await sweep({}, [alpha])
    const forBoth = await sweep({}, [alpha, beta])

    expect(forAlpha).toEqual({ passed: true, findings: [] })
    expect(forBoth.findings.map((finding) => finding.place).sort()).toEqual([
      'audit_log.entity_id',
      'expenses.paid_by',
    ])
    expect(
      forBoth.findings.every(
        (finding) => finding.organizationId === beta.organizationId,
      ),
    ).toBe(true)
  })

  it('never lets an object of another workspace count for this one', async () => {
    const foreign = `${workspaceObjectPrefix(beta.organizationId)}trip/foreign`

    const report = await sweep({
      workspaces: [{ scope: alpha.scope, objectKeys: [foreign] }],
      stores: stores({
        [foreign]: {
          etag: 'e',
          size: 1,
          customMetadata: {
            organizationId: beta.organizationId,
            uploadedBy: USER,
          },
        },
      }),
    })

    expect(placesIn(report)).toEqual(['r2.uploaded-by.refused'])
  })
})

describe('what the report and the log may say', () => {
  it('carries no user id, email, object key or token', async () => {
    plantRow('expenses', 'paid_by', USER, alpha.organizationId)
    plantRow('invitation', 'email', EMAIL.toLowerCase(), alpha.organizationId)
    plantRow('verification', 'value', `{"userId":"${USER}"}`, null)
    const key = `${workspaceObjectPrefix(alpha.organizationId)}trip/passport-jan-kowalski.pdf`
    const lines: Array<LogRecord> = []
    const logger = createLogger({
      sink: { write: (record) => lines.push(record) },
    })

    const report = await sweep({
      logger,
      workspaces: [{ scope: alpha.scope, objectKeys: [key] }],
      stores: stores(
        {
          [key]: {
            etag: 'e',
            size: 1,
            customMetadata: {
              organizationId: alpha.organizationId,
              uploadedBy: USER,
            },
          },
        },
        { [`active-sessions-${USER}`]: 'tok_secret' },
      ),
    })

    const everything = JSON.stringify([report, lines])
    expect(report.passed).toBe(false)
    expect(lines).toHaveLength(1)
    for (const secret of [
      USER,
      EMAIL,
      EMAIL.toLowerCase(),
      'passport',
      'kowalski',
      'tok_secret',
    ]) {
      expect(everything).not.toContain(secret)
    }
  })
})

describe('listTripIdsForRoomReset', () => {
  it('lists every trip of the workspace, paged, and none of another', async () => {
    await subscribeTenant(alpha.scope, 'crew', 5)
    await subscribeTenant(beta.scope, 'crew', 5)
    const made: Array<string> = []
    for (const title of ['one', 'two', 'three']) {
      const trip = await createTrip(alpha.scope, { title })
      made.push(trip.id)
    }
    await createTrip(beta.scope, { title: 'other' })

    const first = await listTripIdsForRoomReset(alpha.scope, { limit: 2 })
    const second = await listTripIdsForRoomReset(alpha.scope, {
      limit: 2,
      after: first.next,
    })

    expect(first.next).not.toBeNull()
    expect(second.next).toBeNull()
    expect([...first.items, ...second.items].sort()).toEqual([...made].sort())
  })
})
