/** Shared in-statement authority and owner-survival rules for membership mutations. */
import { and, eq, exists, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { member } from '#/server/db/auth-schema'
import { tenantFilter } from './base'
import type { SQL } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { TenantScope } from './base'

/** Whitespace trimmed from legacy comma-joined role tokens by the JavaScript guard. */
const ROLE_WHITESPACE = [
  9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198,
  8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279,
] as const
export function hasStoredRole(
  column: SQLiteColumn,
  role: string,
): SQL<boolean> {
  // json_array escapes the stored text before commas split its role tokens. Trimming each token
  // (rather than deleting all spaces) must not turn an invalid `ow ner` into a surviving owner.
  const whitespace = sql.raw(ROLE_WHITESPACE.join(','))
  return sql<boolean>`exists (
    select 1 from json_each(replace(json_array(${column}), ',', '","')) as stored_role_token
    where trim(stored_role_token.value, char(${whitespace})) = ${role}
  )`
}

export function anotherOwner(scope: TenantScope): SQL {
  const other = alias(member, 'remaining_owner')
  return exists(
    scope.db
      .select({ present: sql`1` })
      .from(other)
      .where(
        and(
          eq(other.organizationId, scope.ctx.organizationId),
          ne(other.id, member.id),
          hasStoredRole(other.role, 'owner'),
        ),
      ),
  )
}

/** Current stored actor authority, evaluated in the same statement as the mutation. */
export function memberAuthority(
  scope: TenantScope,
  selfRemoval: boolean,
  grantingOwner = false,
): SQL {
  const actor = alias(member, 'membership_actor')
  return exists(
    scope.db
      .select({ present: sql`1` })
      .from(actor)
      .where(
        and(
          eq(actor.organizationId, scope.ctx.organizationId),
          eq(actor.userId, scope.ctx.userId),
          or(
            selfRemoval ? eq(member.userId, actor.userId) : undefined,
            hasStoredRole(actor.role, 'owner'),
            grantingOwner
              ? undefined
              : and(
                  hasStoredRole(actor.role, 'admin'),
                  sql`not (${hasStoredRole(member.role, 'owner')})`,
                ),
          ),
        ),
      ),
  )
}

export function removalPredicate(
  scope: TenantScope,
  memberId: string,
): SQL | undefined {
  return tenantFilter(
    scope,
    member,
    and(
      eq(member.id, memberId),
      memberAuthority(scope, true),
      or(
        sql`not (${hasStoredRole(member.role, 'owner')})`,
        anotherOwner(scope),
      ),
    ),
  )
}
