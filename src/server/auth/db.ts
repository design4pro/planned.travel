import { drizzle } from 'drizzle-orm/d1'
import { authSchema } from '#/server/db/auth-schema'
import { d1 } from './env'

/**
 * Drizzle client scoped to the Better Auth tables.
 *
 * The auth layer owns its own client so it stays usable before (and
 * independently of) the application schema, and so provisioning hooks can write
 * organizations and memberships without importing the product data layer.
 */
export function authDb() {
  return drizzle(d1(), { schema: authSchema, logger: false })
}

export type AuthDb = ReturnType<typeof authDb>
