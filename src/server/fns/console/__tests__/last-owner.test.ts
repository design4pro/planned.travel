/**
 * The ownership reads and the counting behind the sole-owner refusal, driven without a database.
 *
 * `console.test.ts` proves the refusal against the real Better Auth adapter over a real SQLite
 * schema. This file pins what a real adapter cannot be made to do cheaply: a page that comes back
 * full, a row that is not a membership, the exact query the adapter is handed, and the counting as a
 * table.
 */

import { describe, expect, it } from 'vitest'

import { readWorkspaceOwnership } from '../adapter-reads'
import {
  describeWorkspaces,
  findSoleOwnedWorkspaces,
  isOwnerRole,
} from '../last-owner'

import type { AuthReadAdapter } from '../adapter-reads'
import type { OwnershipRow } from '../last-owner'

type FindManyQuery = Parameters<AuthReadAdapter['findMany']>[0]

/** An adapter that answers each `findMany` with the next page it was given, and records the query. */
function pages(...answers: ReadonlyArray<ReadonlyArray<unknown>>): {
  readonly adapter: () => Promise<AuthReadAdapter>
  readonly calls: ReadonlyArray<FindManyQuery>
} {
  const calls: Array<FindManyQuery> = []
  const adapter: AuthReadAdapter = {
    findMany: async <T>(query: FindManyQuery): Promise<Array<T>> => {
      const answer = answers[calls.length] ?? []
      calls.push(query)
      return [...answer] as Array<T>
    },
    findOne: async <T>(): Promise<T | null> => null,
  }
  return { adapter: async () => adapter, calls }
}

function row(organizationId: string, role: string): OwnershipRow {
  return { organizationId, role }
}

describe('what makes a role an owner', () => {
  it.each([
    ['owner', true],
    ['admin,owner', true],
    ['admin, owner', true],
    ['owner,admin', true],
    ['member', false],
    ['admin', false],
    ['co-owner', false],
    ['owners', false],
    ['', false],
  ])('%j -> %s', (role, expected) => {
    expect(isOwnerRole(role)).toBe(expected)
  })
})

describe('the ownership read', () => {
  it('reads the target’s memberships, then everyone else’s in the workspaces it owns', async () => {
    const store = pages(
      [row('a', 'owner'), row('b', 'member'), row('c', 'admin,owner')],
      [row('a', 'member')],
    )

    const read = await readWorkspaceOwnership(store.adapter, 'user_1')

    expect(read).toEqual({
      complete: true,
      own: [row('a', 'owner'), row('b', 'member'), row('c', 'admin,owner')],
      others: [row('a', 'member')],
    })
    expect(store.calls).toHaveLength(2)
    expect(store.calls[0]).toMatchObject({
      model: 'member',
      where: [{ field: 'userId', value: 'user_1' }],
    })
    // Only the workspaces the target owns, and never the target's own row.
    expect(store.calls[1]).toMatchObject({
      model: 'member',
      where: [
        { field: 'organizationId', operator: 'in', value: ['a', 'c'] },
        { field: 'userId', operator: 'ne', value: 'user_1' },
      ],
    })
  })

  it('does not look at anybody else when the target owns nothing', async () => {
    const store = pages([row('a', 'member')])

    const read = await readWorkspaceOwnership(store.adapter, 'user_1')

    expect(read).toEqual({
      complete: true,
      own: [row('a', 'member')],
      others: [],
    })
    expect(store.calls).toHaveLength(1)
  })

  it('reports that it could not tell when the target’s page comes back full', async () => {
    const store = pages([row('a', 'owner'), row('b', 'owner')])

    expect(await readWorkspaceOwnership(store.adapter, 'user_1', 2)).toEqual({
      complete: false,
    })
    expect(store.calls).toHaveLength(1)
  })

  it('reports that it could not tell when the other members’ page comes back full', async () => {
    const store = pages(
      [row('a', 'owner')],
      [row('a', 'member'), row('a', 'member')],
    )

    expect(await readWorkspaceOwnership(store.adapter, 'user_1', 2)).toEqual({
      complete: false,
    })
  })

  it('reports that it could not tell when a row is not a membership', async () => {
    const store = pages([row('a', 'owner'), { organizationId: 'b' }])

    expect(await readWorkspaceOwnership(store.adapter, 'user_1')).toEqual({
      complete: false,
    })
  })
})

describe('the workspaces an account would strand', () => {
  const stranded = (
    own: ReadonlyArray<OwnershipRow>,
    others: ReadonlyArray<OwnershipRow>,
  ): ReadonlyArray<string> =>
    findSoleOwnedWorkspaces({ complete: true, own, others })

  it('lists a sole owner’s workspace that somebody else belongs to', () => {
    expect(stranded([row('a', 'owner')], [row('a', 'member')])).toEqual(['a'])
  })

  it('does not list a workspace nobody else belongs to', () => {
    expect(stranded([row('a', 'owner')], [])).toEqual([])
  })

  it('does not list a workspace with a second owner', () => {
    expect(
      stranded([row('a', 'owner')], [row('a', 'member'), row('a', 'owner')]),
    ).toEqual([])
  })

  it('counts owners per workspace', () => {
    expect(
      stranded(
        [row('a', 'owner'), row('b', 'owner')],
        [row('a', 'member'), row('b', 'owner')],
      ),
    ).toEqual(['a'])
  })

  it('does not list a workspace the target does not own', () => {
    expect(stranded([row('a', 'admin')], [row('a', 'member')])).toEqual([])
  })
})

describe('the workspaces a refusal names', () => {
  const isolated = (name: string) => `⁨"${name}"⁩`

  it('says "a workspace" when the read returned no name', () => {
    expect(describeWorkspaces([])).toBe('a workspace')
  })

  it('quotes one name', () => {
    expect(describeWorkspaces(['Acme'])).toBe(isolated('Acme'))
  })

  it('lists up to five names', () => {
    const names = ['a', 'b', 'c', 'd', 'e']
    expect(describeWorkspaces(names)).toBe(names.map(isolated).join(', '))
  })

  it('says how many more when there are over five', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(describeWorkspaces(names)).toBe(
      `${names.slice(0, 5).map(isolated).join(', ')} and 2 more`,
    )
  })

  it('shortens a name past 60 characters', () => {
    const shown = describeWorkspaces(['x'.repeat(80)])
    expect(shown).toBe(isolated(`${'x'.repeat(59)}…`))
  })

  it('isolates a right-to-left name so it cannot reorder the English sentence', () => {
    const shown = describeWorkspaces(['شركة السفر'])
    expect(shown.startsWith('⁨')).toBe(true)
    expect(shown.endsWith('⁩')).toBe(true)
  })
})
