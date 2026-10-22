import { drizzle } from 'drizzle-orm/d1'
import { authSchema } from '#/server/db/auth-schema'
import { d1 } from './env'

/**
 * Drizzle client scoped to the Better Auth tables.
 *
 * The auth layer owns its own client so it stays usable before (and
 * independently of) the application schema, and so provisioning hooks can write
 * organizations and memberships through a handle typed to the auth tables alone.
 * The auth layer does reach the product data layer for the rows that are not auth
 * tables - the invitation acceptance and the sign-up language seed - and does so
 * through `#/server/repos` with {@link authRepositoryDb}, never through this handle.
 */
export function authDb() {
  return drizzle(d1(), { schema: authSchema, logger: false })
}

export type AuthDb = ReturnType<typeof authDb>

/**
 * Schema-free handle for the repositories the auth layer calls: the bounded recipient invitation
 * repository and the sign-up language seed (`signup-locale.ts`).
 */
export function authRepositoryDb() {
  return drizzle(d1())
}
