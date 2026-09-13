/**
 * The atlas write boundary, driven the way the runtime drives it.
 *
 * Two things about `createServerFn` shape these tests, and both are properties of
 * the framework rather than of this module:
 *
 * - A server function only runs inside TanStack Start's `AsyncLocalStorage`
 *   context. {@link startStorage} installs one under the same global symbol the
 *   framework uses, which is why `../atlas` is imported dynamically below - the
 *   storage has to exist before the framework module that looks for it loads.
 * - Outside a Start build there is no extracted RPC pair, so calling a server
 *   function runs the handler but discards its return value, while
 *   `__executeServer` runs the boundary validator and stops. So the two are used
 *   for what each can prove: the four wrappers below for what a handler *does*, and
 *   {@link validateAtBoundary} for what the validator *refuses*. What a handler
 *   returns is `atlasCountryState`, which is called directly.
 *
 * Everything else is real: a fully migrated SQLite database from the Drizzle
 * schema, two real tenants, real repositories, real unique indexes.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthRequirementError } from '#/server/auth/tenant'
import {
  achieveBucketListItem,
  createBucketListItem,
  getAtlasSummary,
  isUniqueConstraintViolation,
  listBucketList,
  listVisitedCountries,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  recomputeDelaySeconds,
  travelStatsTaskId,
} from '#/server/queue/handlers/travel-stats'
import { taskEnvelopeSchema } from '#/server/queue/types'

import type * as Repos from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'
import type { TaskEnvelope } from '#/server/queue/types'

/* ------------------------------------------------------------------ mocking */

/**
 * Mutable state the two module mocks read at call time. It lives in
 * `vi.hoisted` because `vi.mock` factories are lifted above every import, so a
 * plain `let` would still be in its temporal dead zone when they run.
 */
const stubs = vi.hoisted(() => ({
  /** The scope `appScope()` resolves to; `null` stands in for an anonymous caller. */
  scope: null as TenantScope | null,
  /** When set, the next bucket-list insert refuses with a repository quota error. */
  quota: null as { metric: string; limit: number; current: number } | null,
  /**
   * How many of the next visited-country inserts are refused the way the unique
   * index refuses them, and whether the row the winner would have written is
   * actually laid down before each refusal.
   *
   * Together these reproduce a race the harness cannot schedule on demand: a
   * concurrent request that commits between this one's read and its write.
   */
  clashes: 0,
  clashLeavesRow: false,
  /** Every body handed to the `TASKS` binding, with the options it was sent under. */
  sent: [] as Array<{ body: unknown; options?: { delaySeconds?: number } }>,
  /** When true, the queue refuses the send the way an unreachable binding would. */
  queueRejects: false,
}))

/**
 * The refusal a driver produces when `visited_countries_org_user_country_unq`
 * rejects a duplicate, copied in shape from what this harness actually throws:
 * an outer error carrying the whole statement and the tenant's identifiers, with
 * SQLite's own message and sub-code hanging off it as `cause`. It is reproduced
 * rather than provoked so a test can also assert what the boundary does *not*
 * forward.
 */
function uniqueIndexRefusal(): Error {
  const inner = Object.assign(
    new Error(
      'UNIQUE constraint failed: visited_countries.organization_id, visited_countries.user_id, visited_countries.country_code',
    ),
    { code: 'ERR_SQLITE_ERROR', errcode: 2067, errstr: 'constraint failed' },
  )
  return new Error(
    'Failed query: insert into "visited_countries" ("id", "organization_id", "user_id", "country_code") values (?, ?, ?, ?)\nparams: row_c0ffee,org_seeded_atlas,user_seeded_atlas,IS',
    { cause: inner },
  )
}

/**
 * The `TASKS` binding. `#/server/auth/env` is the module that reads the Worker
 * environment for it, and it imports `cloudflare:workers` at module scope, so
 * it is replaced wholesale rather than partially: the server project runs in
 * plain Node, where that specifier does not resolve.
 */
vi.mock('#/server/auth/env', () => ({
  taskQueue: () => ({
    send: async () => undefined,
    sendBatch: async (
      messages: Array<{ body: unknown; delaySeconds?: number }>,
    ) => {
      if (stubs.queueRejects) {
        throw new Error('TASKS binding is unreachable')
      }
      // Flattened across batches, and the per-message delay is lifted onto the
      // same shape a single `send` used to record, so the assertions below read
      // one envelope at a time whatever the producer batched them into.
      stubs.sent.push(
        ...messages.map(({ body, delaySeconds }) =>
          delaySeconds === undefined
            ? { body }
            : { body, options: { delaySeconds } },
        ),
      )
      return undefined
    },
  }),
}))

vi.mock('../context', async () => {
  const { AuthRequirementError: AuthError } =
    await import('#/server/auth/tenant')
  return {
    appScope: async (): Promise<unknown> => {
      if (stubs.scope === null) {
        throw new AuthError(
          'unauthenticated',
          'You need to sign in to continue.',
        )
      }
      return stubs.scope
    },
  }
})

vi.mock('#/server/repos', async (importOriginal) => {
  const actual = await importOriginal<typeof Repos>()
  return {
    ...actual,
    createBucketListItem: async (
      ...args: Parameters<typeof actual.createBucketListItem>
    ) => {
      const forced = stubs.quota
      if (forced !== null) {
        throw new actual.QuotaExceededError(
          forced.metric,
          forced.limit,
          forced.current,
        )
      }
      return actual.createBucketListItem(...args)
    },
    markCountryVisited: async (
      ...args: Parameters<typeof actual.markCountryVisited>
    ) => {
      if (stubs.clashes > 0) {
        stubs.clashes -= 1
        if (stubs.clashLeavesRow) {
          await actual.markCountryVisited(...args)
        }
        throw uniqueIndexRefusal()
      }
      return actual.markCountryVisited(...args)
    },
  }
})

/* ------------------------------------------------------------ start context */

/** The subset of Start's request context these handlers can observe. */
interface StartContext {
  readonly startOptions: Record<string, never>
  readonly request: Request
}

/**
 * The framework's own `AsyncLocalStorage`, created here if the framework has not
 * created it yet. Both sides key off the same global symbol, so whichever runs
 * first wins and the other reuses it.
 */
const startStorage = ((): AsyncLocalStorage<StartContext> => {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage<StartContext>()
  return globals[key] as AsyncLocalStorage<StartContext>
})()

function startContext(): StartContext {
  return {
    startOptions: {},
    request: new Request('https://planned.travel/_serverFn/atlas', {
      method: 'POST',
    }),
  }
}

const {
  AtlasConflictError,
  AtlasQuotaError,
  addCountryToBucketListFn,
  addCountryToBucketListInputSchema,
  atlasCountryState,
  markCountryVisitedFn,
  markCountryVisitedInputSchema,
  removeCountryFromBucketListFn,
  removeCountryFromBucketListInputSchema,
  unmarkCountryVisitedFn,
  unmarkCountryVisitedInputSchema,
} = await import('../atlas')

/**
 * The four handlers, each wrapped the way the runtime wraps it: the boundary
 * validator first, then the handler with what the validator produced, inside a
 * request context.
 *
 * The validator is applied here rather than left to `createServerFn` because
 * outside a Start build the framework only runs it on the server leg - see the
 * note at the top of this file. Skipping it would test each handler against input
 * no request can actually deliver, which is how a `.transform()` silently stops
 * being covered. Each wrapper takes `unknown`, because that is what a wire
 * carries.
 */
const markVisited = async (data: unknown): Promise<void> => {
  const validated = markCountryVisitedInputSchema.parse(data)
  await startStorage.run(startContext(), () =>
    markCountryVisitedFn({ data: validated }),
  )
}

const unmarkVisited = async (data: unknown): Promise<void> => {
  const validated = unmarkCountryVisitedInputSchema.parse(data)
  await startStorage.run(startContext(), () =>
    unmarkCountryVisitedFn({ data: validated }),
  )
}

const addToBucketList = async (data: unknown): Promise<void> => {
  const validated = addCountryToBucketListInputSchema.parse(data)
  await startStorage.run(startContext(), () =>
    addCountryToBucketListFn({ data: validated }),
  )
}

const removeFromBucketList = async (data: unknown): Promise<void> => {
  const validated = removeCountryFromBucketListInputSchema.parse(data)
  await startStorage.run(startContext(), () =>
    removeCountryFromBucketListFn({ data: validated }),
  )
}

interface BoundaryOutcome {
  readonly result?: unknown
  readonly error?: unknown
}

function isOutcome(value: unknown): value is BoundaryOutcome {
  return typeof value === 'object' && value !== null
}

/**
 * Puts unvalidated input through the boundary validator alone. Nothing past the
 * validator runs, which is exactly the claim under test: bad input never reaches
 * a write.
 */
async function validateAtBoundary(
  fn: {
    __executeServer: (options: {
      method: 'POST'
      data: unknown
    }) => Promise<unknown>
  },
  data: unknown,
): Promise<string | null> {
  const outcome = await startStorage.run(startContext(), () =>
    fn.__executeServer({ method: 'POST', data }),
  )
  if (!isOutcome(outcome) || outcome.error === undefined) {
    return null
  }
  return outcome.error instanceof Error
    ? outcome.error.message
    : String(outcome.error)
}

/* -------------------------------------------------------------------- setup */

let harness: Harness
let tenant: SeededTenant
let other: SeededTenant

/** Signs the given scope in for the duration of one call. */
function signIn(scope: TenantScope | null): void {
  stubs.scope = scope
}

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('atlas')
  other = await harness.seedTenant('elsewhere')
  signIn(tenant.scope)
  stubs.quota = null
  stubs.clashes = 0
  stubs.clashLeavesRow = false
  stubs.sent = []
  stubs.queueRejects = false
})

afterEach(() => {
  harness.close()
})

async function visitedCodes(scope: TenantScope): Promise<Array<string>> {
  const rows = await listVisitedCountries(scope, scope.ctx.userId)
  return rows.map((row) => row.countryCode)
}

/* --------------------------------------------------------------------- mark */

describe('markCountryVisitedFn', () => {
  it('records a country with no trip behind it', async () => {
    await markVisited({
      countryCode: 'pe',
      visitedOn: '2026-03-04',
      note: '  Two weeks, no flights  ',
    })

    const state = await atlasCountryState(tenant.scope, 'PE')
    expect(state.countryCode).toBe('PE')
    expect(state.continent).toBe('South America')
    expect(state.bucketGoal).toBeNull()
    expect(state.visit).toMatchObject({
      countryCode: 'PE',
      continent: 'South America',
      firstVisitedOn: '2026-03-04',
      lastVisitedOn: '2026-03-04',
      visitCount: 1,
      note: 'Two weeks, no flights',
    })
  })

  it('files the country under a continent the roll-up can name', async () => {
    await markVisited({ countryCode: 'JP' })
    await markVisited({ countryCode: 'FR' })

    const summary = await getAtlasSummary(tenant.scope, tenant.ownerUserId)
    expect(
      [...summary.byContinent].sort((a, b) =>
        a.continent.localeCompare(b.continent),
      ),
    ).toEqual([
      { continent: 'Asia', countryCount: 1 },
      { continent: 'Europe', countryCount: 1 },
    ])
    // The defect this boundary exists to prevent: a blank continent is a group.
    expect(summary.byContinent.map((row) => row.continent)).not.toContain('')
  })

  it('accepts a country it cannot place without inventing a continent', async () => {
    // `XK` is named by the atlas and filed by the table; a code that is neither
    // must still be recordable, and must still stay out of the roll-up.
    await markVisited({ countryCode: 'ZZ' })

    const state = await atlasCountryState(tenant.scope, 'ZZ')
    expect(state.continent).toBeNull()
    expect(state.visit?.continent).toBeNull()

    const summary = await getAtlasSummary(tenant.scope, tenant.ownerUserId)
    expect(summary.countryCount).toBe(1)
    expect(summary.byContinent).toEqual([])
  })

  it('is idempotent against the (organisation, traveller, country) unique index', async () => {
    await markVisited({ countryCode: 'IS', visitedOn: '2025-11-02' })
    await markVisited({ countryCode: 'IS', visitedOn: '2026-01-09' })
    await markVisited({ countryCode: 'is' })

    const rows = await listVisitedCountries(tenant.scope, tenant.ownerUserId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      countryCode: 'IS',
      visitCount: 1,
      firstVisitedOn: '2025-11-02',
      lastVisitedOn: '2025-11-02',
    })
  })

  it('survives two requests for the same country arriving at once', async () => {
    // Not a simulation: both calls run through the real repository against the
    // real index, and the second one's insert is genuinely refused. Before the
    // boundary converged on that refusal, this rejected with the driver's error.
    const outcomes = await Promise.allSettled([
      markVisited({ countryCode: 'IS', visitedOn: '2025-11-02' }),
      markVisited({ countryCode: 'IS', visitedOn: '2025-11-02' }),
    ])

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ])

    const rows = await listVisitedCountries(tenant.scope, tenant.ownerUserId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ countryCode: 'IS', visitCount: 1 })
  })

  it('answers with the winner’s row when the index refuses this one', async () => {
    stubs.clashes = 1
    stubs.clashLeavesRow = true

    await markVisited({ countryCode: 'IS', visitedOn: '2025-11-02' })

    const state = await atlasCountryState(tenant.scope, 'IS')
    expect(state.visit).toMatchObject({
      countryCode: 'IS',
      visitCount: 1,
      firstVisitedOn: '2025-11-02',
    })
    expect(await visitedCodes(tenant.scope)).toEqual(['IS'])
  })

  it('reports a standing collision as a conflict, not as a database error', async () => {
    // The winner takes the index and then rolls its own row back, so re-reading
    // finds nothing and the second attempt is refused too.
    stubs.clashes = 2
    stubs.clashLeavesRow = false

    const failure = await markVisited({ countryCode: 'IS' }).catch(
      (cause: unknown) => cause,
    )

    expect(failure).toBeInstanceOf(AtlasConflictError)
    const conflict = failure as InstanceType<typeof AtlasConflictError>
    expect(conflict.status).toBe(409)
    expect(conflict.countryCode).toBe('IS')
    expect(conflict.message).toContain('Iceland')
    // What a boundary must never hand back: the statement, the tenant and the
    // traveller the driver names in its own refusal.
    expect(conflict.message).not.toMatch(/insert into/i)
    expect(conflict.message).not.toContain('org_seeded_atlas')
    expect(conflict.message).not.toContain('user_seeded_atlas')
    expect(await visitedCodes(tenant.scope)).toEqual([])
  })

  it('refuses malformed input at the boundary, before any write', async () => {
    expect(
      await validateAtBoundary(markCountryVisitedFn, { countryCode: 'FRANCE' }),
    ).toContain('two-letter ISO country code')
    expect(
      await validateAtBoundary(markCountryVisitedFn, { countryCode: 'F1' }),
    ).toContain('two-letter ISO country code')
    expect(
      await validateAtBoundary(markCountryVisitedFn, {
        countryCode: 'FR',
        visitedOn: '04/03/2026',
      }),
    ).toContain('YYYY-MM-DD')
    expect(
      await validateAtBoundary(markCountryVisitedFn, { countryCode: 42 }),
    ).not.toBeNull()
    expect(
      await validateAtBoundary(markCountryVisitedFn, undefined),
    ).not.toBeNull()

    expect(await visitedCodes(tenant.scope)).toEqual([])
  })

  it('refuses a note longer than the boundary allows, before any write', async () => {
    expect(
      await validateAtBoundary(markCountryVisitedFn, {
        countryCode: 'FR',
        note: 'x'.repeat(2_001),
      }),
    ).not.toBeNull()

    expect(await visitedCodes(tenant.scope)).toEqual([])
  })

  it('normalises a padded, lower-case code on the wire, not just in memory', async () => {
    // The `.transform()` runs on the boundary validator, which is the only place
    // a code arriving from a map feature or a URL passes through.
    await markVisited({ countryCode: '  fr  ' })

    expect(await visitedCodes(tenant.scope)).toEqual(['FR'])
    expect((await atlasCountryState(tenant.scope, 'FR')).visit?.continent).toBe(
      'Europe',
    )
  })

  it('rejects an anonymous caller and writes nothing', async () => {
    signIn(null)
    await expect(markVisited({ countryCode: 'FR' })).rejects.toBeInstanceOf(
      AuthRequirementError,
    )

    signIn(tenant.scope)
    expect(await visitedCodes(tenant.scope)).toEqual([])
  })

  it('writes into the caller’s workspace and nobody else’s', async () => {
    await markVisited({ countryCode: 'FR' })

    signIn(other.scope)
    await markVisited({ countryCode: 'JP' })

    expect(await visitedCodes(tenant.scope)).toEqual(['FR'])
    expect(await visitedCodes(other.scope)).toEqual(['JP'])

    // Same traveller identity, other workspace: the atlas is scoped by both.
    signIn(tenant.scope)
    expect((await atlasCountryState(tenant.scope, 'JP')).visit).toBeNull()
    expect((await atlasCountryState(other.scope, 'FR')).visit).toBeNull()
  })

  it('keeps one colleague’s atlas out of another’s inside one workspace', async () => {
    const colleagueId = await tenant.addUser('Colleague')
    const colleague = tenant.scopeFor(colleagueId)

    signIn(colleague)
    await markVisited({ countryCode: 'CL' })

    signIn(tenant.scope)
    expect(await visitedCodes(tenant.scope)).toEqual([])
    expect(await visitedCodes(colleague)).toEqual(['CL'])
  })
})

/* ------------------------------------------------------------------- unmark */

describe('unmarkCountryVisitedFn', () => {
  it('undoes the mark and leaves the bucket-list entry alone', async () => {
    await addToBucketList({ countryCode: 'NO' })
    await markVisited({ countryCode: 'NO' })
    await unmarkVisited({ countryCode: 'NO' })

    const state = await atlasCountryState(tenant.scope, 'NO')
    expect(state.visit).toBeNull()
    expect(state.bucketGoal?.name).toBe('Norway')
    expect(await visitedCodes(tenant.scope)).toEqual([])
  })

  it('is idempotent when there is nothing to undo', async () => {
    await unmarkVisited({ countryCode: 'NO' })
    await unmarkVisited({ countryCode: 'NO' })

    const state = await atlasCountryState(tenant.scope, 'NO')
    expect(state.visit).toBeNull()
  })

  it('survives two undos of the same country arriving at once', async () => {
    await markVisited({ countryCode: 'NO' })

    const outcomes = await Promise.allSettled([
      unmarkVisited({ countryCode: 'NO' }),
      unmarkVisited({ countryCode: 'NO' }),
    ])

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ])
    expect(await visitedCodes(tenant.scope)).toEqual([])
  })

  it('refuses malformed input at the boundary', async () => {
    expect(
      await validateAtBoundary(unmarkCountryVisitedFn, { countryCode: '' }),
    ).not.toBeNull()
    expect(await validateAtBoundary(unmarkCountryVisitedFn, {})).not.toBeNull()
  })

  it('cannot reach another workspace’s record', async () => {
    signIn(other.scope)
    await markVisited({ countryCode: 'FR' })

    signIn(tenant.scope)
    await unmarkVisited({ countryCode: 'FR' })

    expect(await visitedCodes(other.scope)).toEqual(['FR'])
    expect(await visitedCodes(tenant.scope)).toEqual([])
  })

  it('cannot reach a colleague’s record inside the same workspace', async () => {
    const colleagueId = await tenant.addUser('Colleague')
    const colleague = tenant.scopeFor(colleagueId)

    signIn(colleague)
    await markVisited({ countryCode: 'FR' })

    signIn(tenant.scope)
    await unmarkVisited({ countryCode: 'FR' })

    expect(await visitedCodes(colleague)).toEqual(['FR'])
  })

  it('rejects an anonymous caller and leaves the record standing', async () => {
    await markVisited({ countryCode: 'FR' })

    signIn(null)
    await expect(unmarkVisited({ countryCode: 'FR' })).rejects.toBeInstanceOf(
      AuthRequirementError,
    )

    signIn(tenant.scope)
    expect(await visitedCodes(tenant.scope)).toEqual(['FR'])
  })
})

/* --------------------------------------------------------------- bucket list */

describe('addCountryToBucketListFn', () => {
  it('adds the country under the name this product spells it with', async () => {
    await addToBucketList({
      countryCode: 'kr',
      targetYear: 2027,
      note: 'Autumn, for the maples',
    })

    const state = await atlasCountryState(tenant.scope, 'KR')
    expect(state.bucketGoal).toMatchObject({
      name: 'South Korea',
      targetYear: 2027,
      note: 'Autumn, for the maples',
      isAchieved: false,
      achievedOn: null,
    })
    // Wanting to go is not having been.
    expect(state.visit).toBeNull()

    const items = await listBucketList(tenant.scope, tenant.ownerUserId)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'country', countryCode: 'KR' })
  })

  it('is idempotent, so a double tap does not list a country twice', async () => {
    await addToBucketList({ countryCode: 'KR', targetYear: 2027 })
    await addToBucketList({ countryCode: 'KR', targetYear: 2030 })

    const items = await listBucketList(tenant.scope, tenant.ownerUserId)
    expect(items).toHaveLength(1)
    expect(items[0]?.targetYear).toBe(2027)
  })

  it('lists a country once when two adds arrive at once', async () => {
    // `bucket_list_items` has no unique index, so both inserts succeed and the
    // duplicate is permanent unless the boundary collapses it. Before it did,
    // this left two entries and the bucket tab showed the country twice.
    const outcomes = await Promise.allSettled([
      addToBucketList({ countryCode: 'KR', targetYear: 2027 }),
      addToBucketList({ countryCode: 'KR', targetYear: 2030 }),
    ])

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ])

    const items = await listBucketList(tenant.scope, tenant.ownerUserId)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'country', countryCode: 'KR' })

    const state = await atlasCountryState(tenant.scope, 'KR')
    expect(state.bucketGoal?.id).toBe(items[0]?.id)
  })

  it('collapses onto the same entry whichever request gets there first', async () => {
    // Both racers keep the lowest id, so the survivor does not depend on which
    // of them ran the repair - and one entry cannot outlive the other's delete.
    await Promise.all([
      addToBucketList({ countryCode: 'KR' }),
      addToBucketList({ countryCode: 'KR' }),
    ])
    await addToBucketList({ countryCode: 'KR' })

    const items = await listBucketList(tenant.scope, tenant.ownerUserId)
    expect(items).toHaveLength(1)
  })

  it('leaves an achieved entry standing rather than listing the country twice', async () => {
    const achieved = await createBucketListItem(tenant.scope, {
      kind: 'country',
      name: 'South Korea',
      countryCode: 'KR',
    })
    await achieveBucketListItem(tenant.scope, achieved.id, '2026-04-02')

    await addToBucketList({ countryCode: 'KR' })

    const items = await listBucketList(tenant.scope, tenant.ownerUserId)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: achieved.id, isAchieved: true })
  })

  it('refuses malformed input at the boundary, before any write', async () => {
    expect(
      await validateAtBoundary(addCountryToBucketListFn, { countryCode: 'K' }),
    ).not.toBeNull()
    expect(
      await validateAtBoundary(addCountryToBucketListFn, {
        countryCode: 'KR',
        targetYear: 1200,
      }),
    ).not.toBeNull()
    expect(
      await validateAtBoundary(addCountryToBucketListFn, {
        countryCode: 'KR',
        targetYear: 2027.5,
      }),
    ).not.toBeNull()

    expect(await listBucketList(tenant.scope, tenant.ownerUserId)).toEqual([])
  })

  it('rejects an anonymous caller and writes nothing', async () => {
    signIn(null)
    await expect(addToBucketList({ countryCode: 'KR' })).rejects.toBeInstanceOf(
      AuthRequirementError,
    )

    signIn(tenant.scope)
    expect(await listBucketList(tenant.scope, tenant.ownerUserId)).toEqual([])
  })

  it('lists the country on the caller’s list and nobody else’s', async () => {
    await addToBucketList({ countryCode: 'KR' })

    signIn(other.scope)
    await addToBucketList({ countryCode: 'PE' })

    expect(
      (await listBucketList(tenant.scope, tenant.ownerUserId)).map(
        (row) => row.countryCode,
      ),
    ).toEqual(['KR'])
    expect(
      (await listBucketList(other.scope, other.ownerUserId)).map(
        (row) => row.countryCode,
      ),
    ).toEqual(['PE'])

    signIn(tenant.scope)
    expect((await atlasCountryState(tenant.scope, 'PE')).bucketGoal).toBeNull()
    expect((await atlasCountryState(other.scope, 'KR')).bucketGoal).toBeNull()
  })

  it('does not collapse a colleague’s entry for the same country', async () => {
    const colleagueId = await tenant.addUser('Colleague')
    const colleague = tenant.scopeFor(colleagueId)

    signIn(colleague)
    await addToBucketList({ countryCode: 'KR' })

    signIn(tenant.scope)
    await addToBucketList({ countryCode: 'KR' })

    // Two travellers, one country, two goals: the repair only ever touches the
    // rows the caller can see, which are their own.
    expect(await listBucketList(colleague, colleagueId)).toHaveLength(1)
    expect(await listBucketList(tenant.scope, tenant.ownerUserId)).toHaveLength(
      1,
    )
  })

  it('names the metric and the ceiling when the repository refuses on quota', async () => {
    stubs.quota = { metric: 'collections', limit: 25, current: 25 }

    const failure = await addToBucketList({
      countryCode: 'KR',
    }).catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(AtlasQuotaError)
    const quotaError = failure as InstanceType<typeof AtlasQuotaError>
    expect(quotaError.status).toBe(402)
    expect(quotaError.metric).toBe('collections')
    expect(quotaError.limit).toBe(25)
    expect(quotaError.message).toContain('25')
    expect(quotaError.message).toContain('collections')
  })
})

describe('removeCountryFromBucketListFn', () => {
  async function seedGoal(scope: TenantScope, code: string): Promise<string> {
    signIn(scope)
    await addToBucketList({ countryCode: code })
    const items = await listBucketList(scope, scope.ctx.userId)
    const id = items.find((row) => row.countryCode === code)?.id
    if (id === undefined) {
      throw new Error(`the ${code} goal was not created`)
    }
    return id
  }

  it('takes the country back off the list and returns the country to its clean state', async () => {
    const itemId = await seedGoal(tenant.scope, 'MN')
    await removeFromBucketList({ itemId })

    const state = await atlasCountryState(tenant.scope, 'MN')
    expect(state.bucketGoal).toBeNull()
    expect(state.continent).toBe('Asia')
    expect(await listBucketList(tenant.scope, tenant.ownerUserId)).toEqual([])
  })

  it('survives two removals of the same entry arriving at once', async () => {
    const itemId = await seedGoal(tenant.scope, 'MN')

    const outcomes = await Promise.allSettled([
      removeFromBucketList({ itemId }),
      removeFromBucketList({ itemId }),
    ])

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ])
    expect(await listBucketList(tenant.scope, tenant.ownerUserId)).toEqual([])
  })

  it('refuses an id from another workspace and leaves it standing', async () => {
    const itemId = await seedGoal(other.scope, 'MN')

    signIn(tenant.scope)
    await expect(removeFromBucketList({ itemId })).rejects.toThrow(/not found/i)

    expect(await listBucketList(other.scope, other.ownerUserId)).toHaveLength(1)
  })

  it('refuses a colleague’s entry inside the same workspace', async () => {
    const colleagueId = await tenant.addUser('Colleague')
    const colleague = tenant.scopeFor(colleagueId)
    const itemId = await seedGoal(colleague, 'MN')

    signIn(tenant.scope)
    await expect(removeFromBucketList({ itemId })).rejects.toThrow(/not found/i)

    expect(await listBucketList(colleague, colleagueId)).toHaveLength(1)
  })

  it('refuses an entry that is not a country', async () => {
    const place = await createBucketListItem(tenant.scope, {
      kind: 'place',
      name: 'The night train over the Alps',
    })

    await expect(removeFromBucketList({ itemId: place.id })).rejects.toThrow(
      /not found/i,
    )

    expect(await listBucketList(tenant.scope, tenant.ownerUserId)).toHaveLength(
      1,
    )
  })

  it('refuses malformed input at the boundary, before any write', async () => {
    const itemId = await seedGoal(tenant.scope, 'MN')

    expect(
      await validateAtBoundary(removeCountryFromBucketListFn, { itemId: '' }),
    ).not.toBeNull()
    expect(
      await validateAtBoundary(removeCountryFromBucketListFn, {}),
    ).not.toBeNull()
    expect(
      await validateAtBoundary(removeCountryFromBucketListFn, {
        itemId: 'x'.repeat(65),
      }),
    ).not.toBeNull()

    expect(await listBucketList(tenant.scope, tenant.ownerUserId)).toHaveLength(
      1,
    )
    expect(itemId).not.toBe('')
  })

  it('rejects an anonymous caller', async () => {
    const itemId = await seedGoal(tenant.scope, 'MN')
    signIn(null)

    await expect(removeFromBucketList({ itemId })).rejects.toBeInstanceOf(
      AuthRequirementError,
    )

    signIn(tenant.scope)
    expect(await listBucketList(tenant.scope, tenant.ownerUserId)).toHaveLength(
      1,
    )
  })
})

/* -------------------------------------------------------- atlasCountryState */

describe('atlasCountryState', () => {
  it('reads both halves of a country for the traveller who asked', async () => {
    await markVisited({ countryCode: 'PT', visitedOn: '2024-05-19' })
    await addToBucketList({ countryCode: 'PT', targetYear: 2028 })

    const state = await atlasCountryState(tenant.scope, ' pt ')
    expect(state.countryCode).toBe('PT')
    expect(state.continent).toBe('Europe')
    expect(state.visit?.firstVisitedOn).toBe('2024-05-19')
    expect(state.bucketGoal?.targetYear).toBe(2028)
  })

  it('is empty for a country nobody in this tenant has touched', async () => {
    signIn(other.scope)
    await markVisited({ countryCode: 'PT' })

    const state = await atlasCountryState(tenant.scope, 'PT')
    expect(state).toEqual({
      countryCode: 'PT',
      continent: 'Europe',
      visit: null,
      bucketGoal: null,
    })
  })
})

/* --------------------------------------------------------- stats recompute */

/**
 * The write half of the statistics panel.
 *
 * `travel_stats` is a derived cache with no writer in production before this:
 * marking a country visited repainted the map and left every number frozen. The
 * assertions below are about the *envelope* — the queue is stubbed above, and
 * what the handler then does with the message is
 * `src/server/queue/handlers/__tests__/travel-stats.test.ts`.
 */
describe('travel-stats recompute enqueue', () => {
  /**
   * The clock is pinned, because the envelope id and the delay are both derived
   * from the collapse window the write fell into: a real clock would put a test
   * that crosses a window boundary in the flaky pile for no gain.
   */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-04T09:00:03.500Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** The envelopes this test's writes produced, newest last. */
  function envelopes(): Array<TaskEnvelope> {
    return stubs.sent.map((entry) => taskEnvelopeSchema.parse(entry.body))
  }

  function statYears(): Array<number> {
    return envelopes().flatMap((envelope) =>
      envelope.kind === 'travel-stats' ? [envelope.payload.statYear] : [],
    )
  }

  it('enqueues the all-time roll-up for a mark with no date', async () => {
    await markVisited({ countryCode: 'PE' })

    const sent = envelopes()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      kind: 'travel-stats',
      orgId: tenant.organizationId,
      payload: { userId: tenant.ownerUserId, statYear: 0 },
    })
  })

  it('adds the year the visit is dated to, with the deterministic ids', async () => {
    const at = Date.now()
    await markVisited({ countryCode: 'PE', visitedOn: '2026-03-04' })

    expect(statYears()).toEqual([0, 2026])
    // The id is what makes a burst collapse: the consumer acks a redelivery of
    // an id it has already completed.
    expect(envelopes().map((envelope) => envelope.id)).toEqual([
      travelStatsTaskId(tenant.organizationId, tenant.ownerUserId, 0, at),
      travelStatsTaskId(tenant.organizationId, tenant.ownerUserId, 2026, at),
    ])
  })

  it('sends only the all-time roll-up for a year the envelope cannot carry', async () => {
    // `0999-03-04` clears the input validator's `YYYY-MM-DD` but is not a year
    // the payload schema accepts, so no year envelope is built for it.
    await markVisited({ countryCode: 'PE', visitedOn: '0999-03-04' })

    expect(statYears()).toEqual([0])
  })

  it('holds the message until the collapse window has closed', async () => {
    await markVisited({ countryCode: 'PE' })

    const delay = stubs.sent[0]?.options?.delaySeconds
    expect(delay).toBe(recomputeDelaySeconds(Date.now()))
    // Delivering before the window closes would recompute from a snapshot the
    // rest of the burst is still being written into.
    expect(delay).toBeGreaterThan(0)
  })

  it('collapses a burst of marks onto one envelope per year', async () => {
    await markVisited({ countryCode: 'PE' })
    await markVisited({ countryCode: 'CL' })
    await markVisited({ countryCode: 'AR' })

    expect(new Set(envelopes().map((envelope) => envelope.id)).size).toBe(1)
  })

  it('enqueues on an undo too, for the year the removed visit was dated to', async () => {
    await markVisited({ countryCode: 'PE', visitedOn: '2026-03-04' })
    stubs.sent = []

    await unmarkVisited({ countryCode: 'PE' })

    expect(statYears()).toEqual([0, 2026])
  })

  it('enqueues nothing when there was nothing to undo', async () => {
    await unmarkVisited({ countryCode: 'PE' })
    expect(stubs.sent).toEqual([])
  })

  it('enqueues nothing from the bucket list, which feeds no statistic', async () => {
    await addToBucketList({ countryCode: 'PE', targetYear: 2028 })
    const items = await listBucketList(tenant.scope, tenant.ownerUserId)
    const item = items.at(0)
    if (item === undefined) {
      throw new Error('The bucket-list add must have written a row.')
    }
    await removeFromBucketList({ itemId: item.id })

    expect(stubs.sent).toEqual([])
  })

  it('does not fail the traveller’s write when the queue refuses the message', async () => {
    stubs.queueRejects = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await markVisited({ countryCode: 'PE', visitedOn: '2026-03-04' })

    // The row the traveller asked for is there; only the recompute was lost, and
    // it was reported rather than swallowed.
    expect(await visitedCodes(tenant.scope)).toEqual(['PE'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

/* ------------------------------------------- isUniqueConstraintViolation */

describe('isUniqueConstraintViolation', () => {
  it('recognises the wrapped refusal this driver throws', () => {
    expect(isUniqueConstraintViolation(uniqueIndexRefusal())).toBe(true)
  })

  it('recognises the refusal D1 throws in the Worker, which carries no code', () => {
    // D1 flattens SQLite's message into its own and drops the sub-code, so a
    // detector that only read `errcode` would let this one through as a fault.
    expect(
      isUniqueConstraintViolation(
        new Error(
          'D1_ERROR: UNIQUE constraint failed: visited_countries.organization_id, visited_countries.user_id, visited_countries.country_code: SQLITE_CONSTRAINT',
        ),
      ),
    ).toBe(true)
  })

  it('recognises the sub-code alone, whatever the message says', () => {
    expect(
      isUniqueConstraintViolation(
        Object.assign(new Error('constraint failed'), { errcode: 2067 }),
      ),
    ).toBe(true)
    expect(
      isUniqueConstraintViolation(
        Object.assign(new Error('constraint failed'), { errcode: 1555 }),
      ),
    ).toBe(true)
  })

  it('says no to everything a retry would not fix', () => {
    expect(
      isUniqueConstraintViolation(
        new Error('CHECK constraint failed: bucket_list_items_kind_chk'),
      ),
    ).toBe(false)
    expect(
      isUniqueConstraintViolation(
        Object.assign(new Error('FOREIGN KEY constraint failed'), {
          errcode: 787,
        }),
      ),
    ).toBe(false)
    expect(isUniqueConstraintViolation(new Error('network timed out'))).toBe(
      false,
    )
    expect(isUniqueConstraintViolation('UNIQUE constraint failed')).toBe(false)
    expect(isUniqueConstraintViolation(null)).toBe(false)
    expect(isUniqueConstraintViolation(undefined)).toBe(false)
  })

  it('terminates on a cause chain that points at itself', () => {
    const looping = new Error('wrapped')
    Object.defineProperty(looping, 'cause', { value: looping })
    expect(isUniqueConstraintViolation(looping)).toBe(false)
  })
})
