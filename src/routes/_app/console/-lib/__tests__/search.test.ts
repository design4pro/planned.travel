/**
 * The accounts screen's address, and the one property it is written for: it never throws.
 *
 * `validateSearch` runs on a `GET` that somebody may have typed, pasted or shortened, and a schema
 * that rejects turns that into HTTP 500 with `ZodError`'s own `JSON.stringify(issues)` rendered into
 * an error panel — the bracketed `origin`/`code`/`minimum` array, measured on this screen for
 * `?page=abc` and for `?role=admin&status=active`. Every case below is an address that used to do
 * that.
 */

import { describe, expect, it } from 'vitest'

import {
  CONSOLE_USERS_DEFAULT_DIRECTION,
  CONSOLE_USERS_DEFAULT_SORT,
  consoleUsersSearchSchema,
} from '../search'

function read(search: unknown): unknown {
  return consoleUsersSearchSchema.parse(search)
}

describe('the accounts address', () => {
  it('reads a well-formed address unchanged', () => {
    expect(
      read({
        q: 'mika',
        in: 'name',
        role: 'curator',
        sort: 'email',
        dir: 'asc',
        page: 3,
      }),
    ).toEqual({
      q: 'mika',
      in: 'name',
      role: 'curator',
      status: undefined,
      sort: 'email',
      dir: 'asc',
      page: 3,
    })
  })

  it('is empty for an empty address, and carries no default into the URL', () => {
    // A `.default()` here would be re-serialised on every navigation and `/console/users` would
    // become `/console/users?sort=createdAt&dir=desc&page=1` the moment anybody touched a control.
    expect(read({})).toEqual({
      q: undefined,
      in: undefined,
      role: undefined,
      status: undefined,
      sort: undefined,
      dir: undefined,
      page: undefined,
    })
  })

  it('drops an unreadable page rather than rejecting the request', () => {
    expect(read({ page: 'abc' })).toMatchObject({ page: undefined })
    expect(read({ page: 0 })).toMatchObject({ page: undefined })
    expect(read({ page: 4_001 })).toMatchObject({ page: undefined })
    expect(read({ page: 2.5 })).toMatchObject({ page: undefined })
  })

  it('drops an invented sort, direction, role, status and search column', () => {
    expect(
      read({
        sort: 'nope',
        dir: 'sideways',
        role: 'superuser',
        status: 'pending',
        in: 'slug',
      }),
    ).toEqual({
      q: undefined,
      in: undefined,
      role: undefined,
      status: undefined,
      sort: undefined,
      dir: undefined,
      page: undefined,
    })
  })

  it('drops a search term that is past the column limit instead of refusing the page', () => {
    expect(read({ q: 'x'.repeat(200) })).toMatchObject({ q: undefined })
  })

  it('narrows by role and drops the status when an address sets both', () => {
    // `auth.api.listUsers` builds at most one filter clause beside the search clause and silently
    // drops the second, so the pair is resolved here rather than sent and mistranslated.
    expect(read({ role: 'admin', status: 'suspended' })).toMatchObject({
      role: 'admin',
      status: undefined,
    })
  })

  it('keeps a status that arrives on its own', () => {
    expect(read({ status: 'suspended' })).toEqual({
      role: undefined,
      status: 'suspended',
    })
  })

  it('survives an address that is not an object at all', () => {
    for (const nonsense of [null, undefined, 'q=mika', 42, []]) {
      expect(() => read(nonsense)).not.toThrow()
    }
  })

  it('names the defaults the screen applies once, so the loader and the header agree', () => {
    expect(CONSOLE_USERS_DEFAULT_SORT).toBe('createdAt')
    expect(CONSOLE_USERS_DEFAULT_DIRECTION).toBe('desc')
  })
})
