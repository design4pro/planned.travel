/**
 * The bridge between an authenticated request and the repository layer.
 *
 * Every server function in this directory starts here: it obtains a tenant
 * scope, and from that point on all data access goes through
 * `src/server/repos/**`. Nothing in `src/routes` ever builds a query.
 *
 * This module must only be referenced from *inside* a server-function handler.
 * Handlers are stripped out of the client bundle, which is what keeps the auth
 * layer and the D1 binding off the browser.
 */
import { requireOrg } from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { createScope } from '#/server/repos'

import type { TenantScope } from '#/server/repos'

/** The caller's tenant scope, or a thrown `AuthRequirementError`. */
export async function appScope(): Promise<TenantScope> {
  return createScope(getDb(), await requireOrg())
}
