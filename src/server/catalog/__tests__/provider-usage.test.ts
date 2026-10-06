/**
 * The meter, driven against a real SQLite database rather than a mock.
 *
 * A counter has no way of reporting that it is wrong. It keeps returning a plausible integer while
 * the upsert it depends on has quietly become an insert, or while a window predicate selects the
 * wrong buckets — so the cases below are chosen to fail on exactly those, and every one of them
 * runs the real `CREATE TABLE`, the two real partial unique indexes and the real `CHECK`
 * constraints generated from the schema by `./platform-tables`.
 *
 * Three properties get the most attention because each has a silent failure mode:
 *
 * - **The upsert is an upsert**, on both partial indexes. A `NULL` organization is the case that
 *   breaks first: SQLite treats `NULL`s as distinct inside a `UNIQUE` index, so a single index
 *   would let the same platform bucket be inserted twice and the meter would double-count for ever
 *   without erroring once.
 * - **Recording never throws.** The module's whole posture is that a dropped counter beats a failed
 *   request, so a broken database and a malformed record both have to come back as a log line.
 * - **The rollup converges.** It folds and deletes in the same pass, so running it twice over the
 *   same rows must not add them twice.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { providerRegistry, providerUsage } from '#/server/db/schema'
import {
  PLATFORM_SYSTEM_ACTOR,
  ProviderNotBlockableError,
  readProviderGate,
  readProviderLimit,
  recordProviderCall,
  rollUpProviderUsage,
  updateProviderLimit,
  usageBucket,
} from '../provider-usage'
import { createPlatformTables } from './platform-tables'
import type { PlatformTables } from './platform-tables'
import type { Logger } from '#/server/observability'
import type { AuthSession } from '#/server/auth/tenant'

const AT = new Date('2026-08-30T18:55:12.345Z')

function fakeLogger(): Logger {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
    track: vi.fn(async (_msg: string, fn: () => Promise<unknown>) => fn()),
  }
  return logger as unknown as Logger
}

let tables: PlatformTables
let logger: Logger

beforeEach(async () => {
  tables = await createPlatformTables()
  logger = fakeLogger()
})

describe('usageBucket', () => {
  it('slices both grains out of the UTC instant', () => {
    expect(usageBucket(AT, 'hour')).toBe('2026-08-30T18')
    expect(usageBucket(AT, 'month')).toBe('2026-08')
  })

  it('produces keys whose lexicographic order is chronological', () => {
    const earlier = usageBucket(new Date('2026-09-30T23:00:00.000Z'), 'hour')
    const later = usageBucket(new Date('2026-10-01T00:00:00.000Z'), 'hour')
    expect(earlier < later).toBe(true)
  })

  it('produces the two lengths the bucket/grain CHECK enforces', () => {
    expect(usageBucket(AT, 'hour')).toHaveLength(13)
    expect(usageBucket(AT, 'month')).toHaveLength(7)
  })
})

describe('recordProviderCall', () => {
  it('opens a bucket and then increments it rather than inserting again', async () => {
    for (let i = 0; i < 3; i += 1) {
      await recordProviderCall(
        tables.db,
        PLATFORM_SYSTEM_ACTOR,
        {
          provider: 'resend',
          operation: 'email.send',
          organizationId: 'org_1',
          outcome: 'ok',
          at: AT,
        },
        logger,
      )
    }

    const rows = await tables.db.select().from(providerUsage)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.calls).toBe(3)
    expect(rows[0]?.bucket).toBe('2026-08-30T18')
  })

  /**
   * The reason `provider_usage` carries two partial unique indexes instead of one. With a single
   * index spanning the nullable column this test records three rows and the meter reports 1.
   */
  it('increments one platform bucket, not three, when the organization is null', async () => {
    for (let i = 0; i < 3; i += 1) {
      await recordProviderCall(
        tables.db,
        PLATFORM_SYSTEM_ACTOR,
        {
          provider: 'resend',
          operation: 'email.send',
          organizationId: null,
          outcome: 'ok',
          at: AT,
        },
        logger,
      )
    }

    const rows = await tables.db.select().from(providerUsage)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.calls).toBe(3)
    expect(rows[0]?.organizationId).toBeNull()
  })

  it('keeps a workspace bucket and the platform bucket apart', async () => {
    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: 'org_1',
        outcome: 'ok',
        at: AT,
      },
      logger,
    )
    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: null,
        outcome: 'ok',
        at: AT,
      },
      logger,
    )

    const rows = await tables.db.select().from(providerUsage)
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.calls)).toEqual([1, 1])
  })

  it('counts an error once as a call and once as an error', async () => {
    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'polar',
        operation: 'api.request',
        organizationId: 'org_1',
        outcome: 'error',
        at: AT,
      },
      logger,
    )

    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({ calls: 1, errors: 1, blocked: 0 })
  })

  it('counts a blocked call as demand rather than usage', async () => {
    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: 'org_1',
        outcome: 'blocked',
        at: AT,
      },
      logger,
    )

    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({ calls: 0, errors: 0, blocked: 1 })
  })

  it('refuses an actor that is not the platform itself, and does not write', async () => {
    await recordProviderCall(
      tables.db,
      {
        userId: 'usr_1',
        actorKind: 'human',
        role: 'admin',
        tokenId: null,
      } as never,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: null,
        outcome: 'ok',
        at: AT,
      },
      logger,
    )

    expect(await tables.db.select().from(providerUsage)).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalledWith(
      'provider usage record rejected',
      expect.objectContaining({ provider: 'resend' }),
    )
  })

  it('rejects a malformed operation name rather than storing it', async () => {
    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'Email Send!',
        organizationId: null,
        outcome: 'ok',
        at: AT,
      },
      logger,
    )

    expect(await tables.db.select().from(providerUsage)).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalled()
  })

  it('swallows a database failure and reports it instead of throwing', async () => {
    const broken = {
      insert: () => {
        throw new Error('D1_ERROR: no such table')
      },
    } as never

    await expect(
      recordProviderCall(
        broken,
        PLATFORM_SYSTEM_ACTOR,
        {
          provider: 'resend',
          operation: 'email.send',
          organizationId: null,
          outcome: 'ok',
          at: AT,
        },
        logger,
      ),
    ).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledWith(
      'provider usage record failed',
      expect.objectContaining({ provider: 'resend', bucket: '2026-08-30T18' }),
    )
  })
})

describe('readProviderGate', () => {
  it('is open, and reads nothing, when no ceiling is agreed', async () => {
    const gate = await readProviderGate(tables.db, 'resend', AT, null)
    expect(gate).toMatchObject({ allowed: true, callLimit: null, used: 0 })
  })

  it('is open past a ceiling whose policy is allow', async () => {
    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: null,
        outcome: 'ok',
        at: AT,
      },
      logger,
    )

    const gate = await readProviderGate(tables.db, 'resend', AT, {
      callLimit: 1,
      policy: 'allow',
      limitWindow: 'month',
    } as never)

    expect(gate.used).toBe(1)
    expect(gate.allowed).toBe(true)
  })

  it('shuts only once a blocking ceiling is spent', async () => {
    const limit = {
      callLimit: 2,
      policy: 'block',
      limitWindow: 'month',
    } as never

    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: null,
        outcome: 'ok',
        at: AT,
      },
      logger,
    )
    expect(
      (await readProviderGate(tables.db, 'resend', AT, limit)).allowed,
    ).toBe(true)

    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: null,
        outcome: 'ok',
        at: AT,
      },
      logger,
    )
    expect(
      (await readProviderGate(tables.db, 'resend', AT, limit)).allowed,
    ).toBe(false)
  })

  it('counts folded month rows, so a rollup cannot re-open a spent ceiling', async () => {
    await tables.db.insert(providerUsage).values({
      provider: 'resend',
      operation: 'email.send',
      grain: 'month',
      bucket: '2026-08',
      organizationId: null,
      calls: 5,
    })

    const gate = await readProviderGate(tables.db, 'resend', AT, {
      callLimit: 5,
      policy: 'block',
      limitWindow: 'month',
    } as never)

    expect(gate.used).toBe(5)
    expect(gate.allowed).toBe(false)
  })

  it('measures a day-windowed ceiling over the day, not the month', async () => {
    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: null,
        outcome: 'ok',
        at: new Date('2026-08-29T10:00:00.000Z'),
      },
      logger,
    )
    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: null,
        outcome: 'ok',
        at: AT,
      },
      logger,
    )

    const day = await readProviderGate(tables.db, 'resend', AT, {
      callLimit: 10,
      policy: 'block',
      limitWindow: 'day',
    } as never)
    const month = await readProviderGate(tables.db, 'resend', AT, {
      callLimit: 10,
      policy: 'block',
      limitWindow: 'month',
    } as never)

    expect(day.used).toBe(1)
    expect(month.used).toBe(2)
  })
})

describe('readProviderLimit', () => {
  it('answers null for a provider nobody has configured', async () => {
    expect(await readProviderLimit(tables.db, 'resend')).toBeNull()
  })
})

describe('rollUpProviderUsage', () => {
  const OLD = new Date('2026-06-15T09:00:00.000Z')

  async function seedStale(calls: number): Promise<void> {
    await tables.db.insert(providerUsage).values({
      provider: 'resend',
      operation: 'email.send',
      grain: 'hour',
      bucket: usageBucket(OLD, 'hour'),
      organizationId: null,
      calls,
    })
  }

  it('folds an hourly row into its month row and deletes it', async () => {
    await seedStale(7)

    const result = await rollUpProviderUsage(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      logger,
      { now: AT },
    )

    expect(result).toMatchObject({ folded: 1, drained: true })
    const rows = await tables.db.select().from(providerUsage)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      grain: 'month',
      bucket: '2026-06',
      calls: 7,
    })
  })

  it('leaves rows inside the retention window alone', async () => {
    await recordProviderCall(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: 'resend',
        operation: 'email.send',
        organizationId: null,
        outcome: 'ok',
        at: AT,
      },
      logger,
    )

    const result = await rollUpProviderUsage(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      logger,
      { now: AT },
    )

    expect(result.folded).toBe(0)
    const rows = await tables.db
      .select()
      .from(providerUsage)
      .where(eq(providerUsage.grain, 'hour'))
    expect(rows).toHaveLength(1)
  })

  it('converges when run twice — the second pass folds nothing', async () => {
    await seedStale(4)

    await rollUpProviderUsage(tables.db, PLATFORM_SYSTEM_ACTOR, logger, {
      now: AT,
    })
    const second = await rollUpProviderUsage(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      logger,
      { now: AT },
    )

    expect(second.folded).toBe(0)
    const rows = await tables.db.select().from(providerUsage)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.calls).toBe(4)
  })

  it('adds into a month row that already exists', async () => {
    await tables.db.insert(providerUsage).values({
      provider: 'resend',
      operation: 'email.send',
      grain: 'month',
      bucket: '2026-06',
      organizationId: null,
      calls: 10,
    })
    await seedStale(3)

    await rollUpProviderUsage(tables.db, PLATFORM_SYSTEM_ACTOR, logger, {
      now: AT,
    })

    const rows = await tables.db.select().from(providerUsage)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.calls).toBe(13)
  })

  it('reports drained: false when the batch bound stops it short', async () => {
    for (let hour = 0; hour < 3; hour += 1) {
      await tables.db.insert(providerUsage).values({
        provider: 'resend',
        operation: 'email.send',
        grain: 'hour',
        bucket: `2026-06-15T0${hour}`,
        organizationId: null,
        calls: 1,
      })
    }

    const result = await rollUpProviderUsage(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      logger,
      {
        now: AT,
        batchSize: 1,
        maxBatches: 2,
      },
    )

    expect(result).toMatchObject({ folded: 2, drained: false })
    expect(logger.warn).toHaveBeenCalledWith(
      'provider usage rollup did not drain',
      expect.objectContaining({ drained: false }),
    )
  })

  it('refuses an actor that is not the platform itself', async () => {
    await expect(
      rollUpProviderUsage(
        tables.db,
        {
          userId: 'usr_1',
          actorKind: 'human',
          role: 'admin',
          tokenId: null,
        } as never,
        logger,
        { now: AT },
      ),
    ).rejects.toThrow()
  })
})

/**
 * A signed-in operator, built here rather than imported: `requirePermission` is pure and
 * synchronous, so the whole authorisation half of these functions is exercisable without a request,
 * a cookie or a Better Auth instance.
 */
function operator(role: string | null): AuthSession {
  return {
    user: {
      id: 'usr_ops',
      email: 'ops@planned.travel',
      name: 'Ops',
      emailVerified: true,
      image: null,
      twoFactorEnabled: true,
      role,
      banned: false,
      banReason: null,
      banExpires: null,
    },
    session: {
      id: 'ses_1',
      token: 'tok_1',
      userId: 'usr_ops',
      activeOrganizationId: 'org_1',
      expiresAt: new Date('2026-09-30T10:00:00.000Z'),
      impersonatedBy: null,
    },
  }
}

const LIMIT_INPUT = {
  label: 'Resend',
  limitWindow: 'month',
  callLimit: 1000,
  policy: 'allow',
  warnPercent: 70,
  criticalPercent: 90,
  notes: null,
} as const

describe('updateProviderLimit', () => {
  it('refuses an operator without the configure statement, before touching a row', async () => {
    await expect(
      updateProviderLimit(tables.db, operator('curator'), {
        ...LIMIT_INPUT,
        slug: 'resend',
      }),
    ).rejects.toThrow()

    expect(await tables.db.select().from(providerRegistry)).toHaveLength(0)
  })

  it('creates the row on a first save and reports no before', async () => {
    const { before, after } = await updateProviderLimit(
      tables.db,
      operator('admin'),
      { ...LIMIT_INPUT, slug: 'resend' },
    )

    expect(before).toBeNull()
    expect(after).toMatchObject({
      slug: 'resend',
      callLimit: 1000,
      policy: 'allow',
      limitWindow: 'month',
    })
  })

  it('moves an existing ceiling and hands back both sides of the change', async () => {
    await updateProviderLimit(tables.db, operator('admin'), {
      ...LIMIT_INPUT,
      slug: 'resend',
    })

    const { before, after } = await updateProviderLimit(
      tables.db,
      operator('admin'),
      { ...LIMIT_INPUT, slug: 'resend', callLimit: 2000, policy: 'block' },
    )

    expect(before?.callLimit).toBe(1000)
    expect(after.callLimit).toBe(2000)
    expect(after.policy).toBe('block')
    // One row, not two: the save is an upsert on the slug.
    expect(await tables.db.select().from(providerRegistry)).toHaveLength(1)
  })

  /**
   * The regression this pair exists for. A ceiling for a provider with no client is the whole reason
   * the planned slugs are listed — an operator agrees the terms before we write the adapter — and
   * the path used to cast the slug to a metered one, which sent it into a
   * `z.enum(METERED_PROVIDERS)` parse.
   *
   * The pair was written against `geoapify` and then `here`, both since adopted into
   * {@link METERED_PROVIDERS}, which would no longer exercise the cast at all. `workers-ai` is the
   * planned slug that stands in their place (`d1-export` is the other one left).
   */
  it('accepts a ceiling for a provider that has no client yet', async () => {
    const { after } = await updateProviderLimit(tables.db, operator('admin'), {
      ...LIMIT_INPUT,
      slug: 'workers-ai',
      label: 'Workers AI',
      limitWindow: 'month',
      callLimit: 5000,
    })

    expect(after).toMatchObject({
      slug: 'workers-ai',
      limitWindow: 'month',
      callLimit: 5000,
    })
  })

  it('reads that ceiling back through the same door a metered one uses', async () => {
    await updateProviderLimit(tables.db, operator('admin'), {
      ...LIMIT_INPUT,
      slug: 'workers-ai',
      limitWindow: 'month',
      callLimit: 5000,
    })

    expect(await readProviderLimit(tables.db, 'workers-ai')).toMatchObject({
      callLimit: 5000,
    })
  })

  it('keeps the day window an adopted provider agreed its ceiling under', async () => {
    // ADR 0013 buys Geoapify on a daily allowance. Adopting the slug into METERED_PROVIDERS moves
    // which door it comes through and must not move the window it is counted in.
    const { after } = await updateProviderLimit(tables.db, operator('admin'), {
      ...LIMIT_INPUT,
      slug: 'geoapify',
      label: 'Geoapify',
      limitWindow: 'day',
      callLimit: 3000,
    })

    expect(after).toMatchObject({
      slug: 'geoapify',
      limitWindow: 'day',
      callLimit: 3000,
    })
  })

  it('refuses to block a provider whose feature has no fallback', async () => {
    await expect(
      updateProviderLimit(tables.db, operator('admin'), {
        ...LIMIT_INPUT,
        slug: 'polar',
        label: 'Polar',
        policy: 'block',
      }),
    ).rejects.toBeInstanceOf(ProviderNotBlockableError)

    // Refused before the write, so the row is not left half-configured.
    expect(await tables.db.select().from(providerRegistry)).toHaveLength(0)
  })

  it('still lets that provider carry a ceiling it only warns about', async () => {
    const { after } = await updateProviderLimit(tables.db, operator('admin'), {
      ...LIMIT_INPUT,
      slug: 'polar',
      label: 'Polar',
      policy: 'allow',
    })

    expect(after).toMatchObject({ slug: 'polar', policy: 'allow' })
    expect(after.blockable).toBe(false)
  })

  it('rejects thresholds that would paint a bar green past its ceiling', async () => {
    await expect(
      updateProviderLimit(tables.db, operator('admin'), {
        ...LIMIT_INPUT,
        slug: 'resend',
        warnPercent: 95,
        criticalPercent: 80,
      }),
    ).rejects.toThrow()
  })
})
