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
 * file; it hands back handles, and everything that could be *wrong* rather than merely absent lives
 * one module over in `./adapter-reads`. That split is not tidiness: a query written in this file is
 * a query the tests can only assert against a copy of, because the test that drives the console
 * replaces this module wholesale. Two repairs were once pinned to such a copy.
 *
 * It is emphatically not `src/server/fns/context.ts`. That module's `appScope()` resolves a tenant
 * scope, and a console action has no organization by construction — SPEC §5 forbids fabricating one
 * to reach global rows, and `__tests__/isolation.test.ts` asserts no module in this directory
 * imports it.
 */

import { env } from 'cloudflare:workers'

import { getAuth } from '#/server/auth'
import { getSession } from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { loggerFromEnv } from '#/server/observability'
import {
  createSessionPageReader,
  readAccountMemberships,
  readAccountNames,
  readOrganizations,
  readPlatformRole,
  readWorkspaceOwnership,
} from './adapter-reads'
import { enumerateSessionRows } from './session-keys'

import type { AuthSession } from '#/server/auth/session'
import type { Database } from '#/server/db/types'
import type { Logger } from '#/server/observability'
import type {
  AuthReadAdapter,
  MemberRow,
  OrganizationRow,
  PlatformRoleRead,
} from './adapter-reads'
import type { OwnershipRead } from './last-owner'
import type {
  SessionEnumeration,
  SessionKeyStore,
  SessionRowPage,
} from './session-keys'

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

/** Better Auth's own database adapter, the one every auth read in the product goes through. */
async function authReadAdapter(): Promise<AuthReadAdapter> {
  const context = await getAuth().$context
  return context.adapter
}

/** {@link createSessionPageReader} bound to the shipped adapter. */
export function sessionPageReader(userId: string): SessionRowPage {
  return createSessionPageReader(authReadAdapter, userId)
}

/**
 * The account's live session rows for the console's list, bounded by `SESSION_LIST_CEILING`.
 *
 * The bound belongs to the list and to nothing else - see `./session-keys`, where the purge walks
 * the same pages to exhaustion, because a list that stops early is honest and a purge that stops
 * early leaves a live session nobody can name afterwards.
 */
export async function readSessionRows(
  userId: string,
): Promise<SessionEnumeration> {
  return enumerateSessionRows(sessionPageReader(userId))
}

/** {@link readPlatformRole} bound to the shipped adapter. */
export async function readUserRole(userId: string): Promise<PlatformRoleRead> {
  return readPlatformRole(authReadAdapter, userId)
}

/** {@link readAccountMemberships} bound to the shipped adapter. */
export async function readMemberships(
  userId: string,
  limit: number,
): Promise<ReadonlyArray<MemberRow>> {
  return readAccountMemberships(authReadAdapter, userId, limit)
}

/** {@link readOrganizations} bound to the shipped adapter. */
export async function readWorkspaces(
  organizationIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<OrganizationRow>> {
  return readOrganizations(authReadAdapter, organizationIds)
}

/** {@link readAccountNames} bound to the shipped adapter. */
export async function readNames(
  userIds: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, string | null>> {
  return readAccountNames(authReadAdapter, userIds)
}

/** {@link readWorkspaceOwnership} bound to the shipped adapter. */
export async function readOwnership(userId: string): Promise<OwnershipRead> {
  return readWorkspaceOwnership(authReadAdapter, userId)
}
