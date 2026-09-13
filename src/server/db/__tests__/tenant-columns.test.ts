/**
 * Every table belongs to a workspace, unless it is on the list of the ones that do not.
 *
 * A tenant column is not decoration: `tenantFilter()` puts `organization_id` in the WHERE clause of
 * every statement the base repository writes, so a table without one cannot be reached through the
 * tenant-scoped path at all — and a table that gains one it has no business carrying looks exactly
 * like every other table in `schema.ts` and is caught by nothing, because a tenant-isolation test
 * only ever asserts that the filter is applied, never that it should have been.
 *
 * Both mistakes used to be catchable only where somebody happened to write the assertion for one
 * table (`airports`, in `transport-schema.test.ts`). Asked the other way round — over every declared
 * table, against a list of the ones that are exempt and why — the rule covers the table nobody
 * thought to write it for, and the next one has to justify itself in the list below or carry the
 * column (#184). A name left behind by a renamed table reddens this too: the list is compared whole,
 * not searched.
 */

import { describe, expect, it } from 'vitest'
import { is } from 'drizzle-orm'
import { SQLiteTable, getTableConfig } from 'drizzle-orm/sqlite-core'
import { authSchema } from '#/server/db/auth-schema'
import * as domainSchema from '#/server/db/schema'

/**
 * The tables that belong to no workspace, and the reason each one is exempt.
 *
 * Better Auth owns the first group and models the workspace itself as `organization`, so a tenant
 * column on any of them would be circular. The platform group is staff-facing configuration and
 * audit that spans every workspace by definition (`docs/SPEC.md` §6). `airports` is the single
 * stated exception to the tenant-scoped repository rule: public-domain catalogue content read
 * through `src/server/catalog`, where an airport belongs to nobody.
 */
const GLOBAL_TABLES: ReadonlyArray<string> = [
  // Better Auth identity, and the workspace itself.
  'account',
  'organization',
  'passkey',
  'session',
  'two_factor',
  'user',
  'verification',
  // Staff-facing platform configuration and audit.
  'app_settings',
  'platform_audit_log',
  'provider_registry',
  'staff_api_tokens',
  // Catalogue content, served by `src/server/catalog`.
  'airports',
]

/**
 * Every table `schema.ts` and `auth-schema.ts` declare, as drizzle describes it.
 *
 * Widened to `unknown` before the guard on purpose: both modules export plenty that is not a table —
 * helpers, column presets, literal tuples — and the union TypeScript infers for those exports is too
 * narrow to be the parameter of a `value is SQLiteTable` predicate.
 */
function declaredTables() {
  const exported: Array<unknown> = Object.values({
    ...authSchema,
    ...domainSchema,
  })
  return exported
    .filter((value): value is SQLiteTable => is(value, SQLiteTable))
    .map((table) => getTableConfig(table))
}

describe('the tenant column', () => {
  it('is on every declared table but the ones named as global', () => {
    const withoutTenantColumn = declaredTables()
      .filter(
        (table) =>
          !table.columns.some((column) => column.name === 'organization_id'),
      )
      .map((table) => table.name)
      .sort()

    expect(withoutTenantColumn).toEqual([...GLOBAL_TABLES].sort())
  })
})
