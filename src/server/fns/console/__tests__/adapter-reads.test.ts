/**
 * The two shipped adapter reads, driven directly.
 *
 * `__tests__/console.test.ts` exercises these through the real Better Auth adapter over a real
 * SQLite schema, which is where the *behaviour* is proved. This file asserts the two things a
 * behavioural test cannot see from the outside: the exact query the adapter is handed, and the three
 * different answers a role read can produce. Both were properties a previous round pinned against a
 * copy of the query living in a mock factory, so deleting the expiry predicate or the sort from the
 * shipped file changed nothing anybody could observe.
 *
 * The double is typed as the real adapter slice rather than as an approximation, so a Better Auth
 * bump that reshapes `findMany` breaks this file rather than passing over it.
 */

import { describe, expect, it } from 'vitest'

import { createSessionPageReader, readPlatformRole } from '../adapter-reads'
import { SESSION_PAGE_SIZE } from '../session-keys'

import type { AuthReadAdapter } from '../adapter-reads'

type FindManyQuery = Parameters<AuthReadAdapter['findMany']>[0]
type FindOneQuery = Parameters<AuthReadAdapter['findOne']>[0]

interface Recorder {
  readonly adapter: () => Promise<AuthReadAdapter>
  readonly findManyCalls: ReadonlyArray<FindManyQuery>
  readonly findOneCalls: ReadonlyArray<FindOneQuery>
}

/**
 * An adapter that records what it was asked for and answers with what it was told to.
 *
 * `rows` is a function of the call index so a paged walk can be handed a different page each time
 * without the double knowing anything about paging.
 */
function recorder(options: {
  rows?: (call: number) => ReadonlyArray<unknown>
  one?: unknown
  reject?: boolean
}): Recorder {
  const findManyCalls: Array<FindManyQuery> = []
  const findOneCalls: Array<FindOneQuery> = []

  const adapter: AuthReadAdapter = {
    findMany: async <T>(query: FindManyQuery): Promise<Array<T>> => {
      const index = findManyCalls.length
      findManyCalls.push(query)
      if (options.reject === true) {
        throw new Error('D1_ERROR: database is locked')
      }
      return (options.rows?.(index) ?? []) as Array<T>
    },
    findOne: async <T>(query: FindOneQuery): Promise<T | null> => {
      findOneCalls.push(query)
      if (options.reject === true) {
        throw new Error('D1_ERROR: database is locked')
      }
      return (options.one ?? null) as T | null
    },
  }

  return {
    adapter: async () => adapter,
    findManyCalls,
    findOneCalls,
  }
}

function sessionRow(id: string): { id: string; token: string } {
  return { id, token: `token_${id}` }
}

describe('the session page read', () => {
  it('asks only for the account’s rows, ordered totally, with the paging it was given', async () => {
    const store = recorder({ rows: () => [sessionRow('s1')] })
    const page = createSessionPageReader(store.adapter, 'user_1')

    await page(40, SESSION_PAGE_SIZE)

    expect(store.findManyCalls).toHaveLength(1)
    const [query] = store.findManyCalls
    expect(query.model).toBe('session')
    expect(query.limit).toBe(SESSION_PAGE_SIZE)
    expect(query.offset).toBe(40)
    // `id` is unique, so offset paging over it neither drops a row between pages nor repeats one.
    // `createdAt` is a millisecond stamp two sessions can share, and an unstable sort under paging
    // loses rows silently — a lost row here is a live session a ban never reaches.
    expect(query.sortBy).toEqual({ field: 'id', direction: 'asc' })
  })

  it('excludes rows whose expiry has passed', async () => {
    const store = recorder({ rows: () => [] })

    await createSessionPageReader(store.adapter, 'user_1')(0, 10)

    const where = store.findManyCalls[0]?.where ?? []
    expect(where).toContainEqual({ field: 'userId', value: 'user_1' })

    // Without this the console lists sessions that ended weeks ago as live, and
    // `platform.session.revoked` is written for one of them. `storeSessionInDatabase` deletes a row
    // only lazily, on the next `findSession` that resolves it.
    const expiry = where.find((clause) => clause.field === 'expiresAt')
    expect(expiry?.operator).toBe('gt')
    expect(expiry?.value).toBeInstanceOf(Date)
  })

  it('holds one expiry instant for the whole walk', async () => {
    const store = recorder({ rows: () => [] })
    const page = createSessionPageReader(store.adapter, 'user_1')

    await page(0, 10)
    await new Promise((resolve) => setTimeout(resolve, 5))
    await page(10, 10)

    const instants = store.findManyCalls.map(
      (query) =>
        query.where?.find((clause) => clause.field === 'expiresAt')?.value,
    )
    // A bound that moved between pages would shift the result set under offset paging and drop
    // rows. Two Date objects, one instant.
    expect(instants).toHaveLength(2)
    expect(instants[0]).toBeInstanceOf(Date)
    expect((instants[0] as Date).getTime()).toBe(
      (instants[1] as Date).getTime(),
    )
  })

  it('hands the rows back untouched, so the paging rule owns the walk and this owns the query', async () => {
    const pages = [[sessionRow('a'), sessionRow('b')], [sessionRow('c')]]
    const store = recorder({ rows: (call) => pages[call] ?? [] })
    const page = createSessionPageReader(store.adapter, 'user_1')

    expect(await page(0, 2)).toEqual(pages[0])
    expect(await page(2, 2)).toEqual(pages[1])
  })

  it('resolves the adapter per page rather than once, so no page reuses a stale handle', async () => {
    let resolved = 0
    const inner = recorder({ rows: () => [] })
    const page = createSessionPageReader(async () => {
      resolved += 1
      return (await inner.adapter()) satisfies AuthReadAdapter
    }, 'user_1')

    await page(0, 10)
    await page(10, 10)

    expect(resolved).toBe(2)
  })
})

describe('the platform-role read', () => {
  it('asks for one column of one row', async () => {
    const store = recorder({ one: { role: 'admin' } })

    await readPlatformRole(store.adapter, 'user_1')

    expect(store.findOneCalls[0]).toEqual({
      model: 'user',
      where: [{ field: 'id', value: 'user_1' }],
      select: ['role'],
    })
  })

  it('answers with the role it read', async () => {
    const store = recorder({ one: { role: 'curator' } })

    await expect(readPlatformRole(store.adapter, 'user_1')).resolves.toEqual({
      ok: true,
      role: 'curator',
    })
  })

  it('answers ok with a null role for an account whose column is NULL', async () => {
    // docs/ACCESS.md §1.3 resolves a NULL column as `user`, and that is a correct answer rather
    // than a failure: the distinction this whole type exists for is between this case and the two
    // below.
    const store = recorder({ one: { role: null } })

    await expect(readPlatformRole(store.adapter, 'user_1')).resolves.toEqual({
      ok: true,
      role: null,
    })
  })

  it('distinguishes a row that is not there from a role that is not set', async () => {
    const store = recorder({ one: null })

    await expect(readPlatformRole(store.adapter, 'user_1')).resolves.toEqual({
      ok: false,
      reason: 'not-found',
    })
  })

  it('reports an unparseable row rather than reading it as a plain account', async () => {
    const store = recorder({ one: { role: 42 } })

    await expect(readPlatformRole(store.adapter, 'user_1')).resolves.toEqual({
      ok: false,
      reason: 'unreadable',
    })
  })

  it('absorbs a rejected read and reports it as unreadable', async () => {
    const store = recorder({ reject: true })

    // The caller writes one branch, and every failure arrives through it. Propagating the raw
    // rejection would put a D1 transient in front of an operator as a stack trace.
    await expect(readPlatformRole(store.adapter, 'user_1')).resolves.toEqual({
      ok: false,
      reason: 'unreadable',
    })
  })

  it('reports an adapter that cannot be resolved at all', async () => {
    await expect(
      readPlatformRole(async () => {
        throw new Error('no auth context in this isolate')
      }, 'user_1'),
    ).resolves.toEqual({ ok: false, reason: 'unreadable' })
  })
})
