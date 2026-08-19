/// <reference types="@cloudflare/workers-types" />

/**
 * Drizzle client bound to the Worker's D1 binding.
 *
 * This is the only module in the codebase that touches the runtime environment. Repositories
 * receive a {@link Database} handle and never reach for a binding themselves, which is what keeps
 * them unit-testable against an in-memory SQLite database.
 */

import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import type { Database } from './types'

/**
 * Lazily created per isolate. The Drizzle handle is a stateless wrapper around the binding and
 * holds no request data, so reusing it across requests is safe and avoids re-building the query
 * dialect on every invocation.
 */
let handle: Database | undefined

/** The request-independent Drizzle handle for the Worker's D1 binding. */
export function getDb(): Database {
  handle ??= drizzle(env.DB)
  return handle
}

/**
 * Wraps an explicit D1 binding — used by Durable Objects, queue consumers and cron handlers that
 * receive `env` as an argument rather than importing it.
 */
export function createDb(binding: D1Database): Database {
  return drizzle(binding)
}
