/**
 * The single binding seam of `src/server/fns/console/**`.
 *
 * Everything in this directory that reaches the Worker environment, the Better Auth instance or the
 * D1 handle does it here and nowhere else. That is the same arrangement `src/server/db/client.ts`
 * already has for D1 and for the same two reasons: `cloudflare:workers` cannot be imported in the
 * `server` Vitest project at all — the project's own header says so — and a module that reaches for
 * a binding itself cannot be driven with a fake one. Keeping the seam to one file is what lets
 * `./context`, `./users`, `./sessions` and `./impersonation` be tested as themselves, with the whole
 * of the guard, the audit writer and the ordering they encode running for real.
 *
 * Nothing here decides anything. There is no authorisation, no validation and no audit write in this
 * file; it hands back handles.
 *
 * It is emphatically not `src/server/fns/context.ts`. That module's `appScope()` resolves a tenant
 * scope, and a console action has no organization by construction — SPEC §5 forbids fabricating one
 * to reach global rows, and `__tests__/isolation.test.ts` asserts no module in this directory
 * imports it.
 */

import { env } from 'cloudflare:workers'
import { z } from 'zod'

import { getAuth } from '#/server/auth'
import { getSession } from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { loggerFromEnv } from '#/server/observability'
import { SESSION_TOKEN_LIMIT } from './session-keys'

import type { AuthSession } from '#/server/auth/session'
import type { Database } from '#/server/db/types'
import type { Logger } from '#/server/observability'
import type { SessionKeyStore } from './session-keys'

/** Better Auth's server-side API surface, in process. Never the HTTP router — docs/ACCESS.md §2.6. */
export type PlatformApi = ReturnType<typeof getAuth>['api']

/** Memoised per isolate: the logger holds no request state. */
let logger: Logger | undefined

export function consoleLogger(): Logger {
  logger ??= loggerFromEnv(env, { context: { component: 'console-fn' } })
  return logger
}

/** The caller's session, or `null`. One KV read; no cookie-cache window. */
export async function currentSession(): Promise<AuthSession | null> {
  return getSession()
}

/**
 * The plain D1 handle, never a `TenantScope`.
 *
 * `platform_audit_log` and `staff_api_tokens` carry no `organization_id`, and SPEC §5 forbids
 * reaching them through `createTenantRepository()` or `src/server/repos/base.ts`.
 */
export function platformDb(): Database {
  return getDb()
}

/** Better Auth's in-process API. The fifteen HTTP paths behind it answer `404`. */
export function platformApi(): PlatformApi {
  return getAuth().api
}

/** The `SESSIONS` namespace, where Better Auth keeps every session blob and its per-user index. */
export function sessionKeyStore(): SessionKeyStore {
  return env.SESSIONS
}

/**
 * The target's session rows, read from D1.
 *
 * Straight through Better Auth's own database adapter rather than a Drizzle statement of ours:
 * `session` is an auth-owned table, the adapter already knows its field mapping, and this keeps the
 * read on the same layer as every other auth read in the product. It is emphatically *not*
 * `internalAdapter.listSessions`, which consults secondary storage first and answers `[]` when the
 * KV index is missing — the exact reading this whole path exists to stop trusting.
 * `session_user_id_idx` is what makes the predicate cheap, and `storeSessionInDatabase: true` is
 * what makes D1 the durable record rather than a mirror.
 *
 * It is also why the console's session list does not use `auth.api.listUserSessions`: that endpoint
 * reads the same KV index, and every mutation on this path deliberately drops the cached blobs it
 * would then walk. One source, and it is the one that survives its own cache.
 *
 * Bounded at {@link SESSION_TOKEN_LIMIT}; see the note there for why the bound is not optional.
 */
export async function readSessionRows(
  userId: string,
): Promise<ReadonlyArray<unknown>> {
  const context = await getAuth().$context
  return context.adapter.findMany<unknown>({
    model: 'session',
    where: [{ field: 'userId', value: userId }],
    limit: SESSION_TOKEN_LIMIT,
  })
}

const userRoleSchema = z.object({ role: z.string().nullish() })

/**
 * One `user` row's platform role, straight from D1.
 *
 * `auth.api.getUser` would be the obvious call and cannot be used here: it checks `user:get` for
 * itself, and the only caller is the impersonation exit, which runs on a session that holds no
 * statement at all. This is a read of one column of a row the caller has already proved it is
 * connected to, taken through the same adapter as {@link readSessionRows}.
 */
export async function readUserRole(userId: string): Promise<string | null> {
  const context = await getAuth().$context
  const row = await context.adapter.findOne<unknown>({
    model: 'user',
    where: [{ field: 'id', value: userId }],
    select: ['role'],
  })
  const parsed = userRoleSchema.safeParse(row)
  return parsed.success ? (parsed.data.role ?? null) : null
}
