/**
 * The database barrel: every table, every enumerated value tuple and every row type in one place.
 *
 * The relational model is split across two files by ownership — `./auth-schema` holds the tables
 * Better Auth writes directly (users, sessions, credentials and the organization/member/invitation
 * tenancy triple), `./schema` holds the product domain. Both are re-exported here so callers and
 * `drizzle-kit` see a single, complete schema.
 *
 * `./client` is deliberately *not* re-exported: it imports `cloudflare:workers`, and pulling that
 * into the barrel would make the schema unusable from tests and from `drizzle-kit`.
 */

export * from './auth-schema'
export * from './schema'
export * from './types'
