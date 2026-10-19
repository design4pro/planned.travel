/** Session-less scope for the erasure worker. Never imported by a request entry point. */
import { createScope } from '#/server/repos/base'
import type { Database } from '#/server/db/types'
import type { TenantScope } from '#/server/repos/base'

export function createErasureScope(
  db: Database,
  organizationId: string,
): TenantScope {
  return createScope(db, {
    organizationId,
    userId: 'system:erasure',
    role: 'owner',
    impersonatedBy: null,
  })
}
