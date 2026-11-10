import { createScope } from '#/server/repos/base'
import {
  expireGalleryPreviews,
  listExpiredGalleryPreviewsUnscoped,
} from '#/server/repos/community'
import type { Database } from '#/server/db/types'

/** Bounded indexed expiry discovery; replacement is protected by its fresh record id. */
export async function sweepGalleryPreviews(
  db: Database,
  now: number,
): Promise<void> {
  const due = await listExpiredGalleryPreviewsUnscoped(db, now)
  for (const organizationId of new Set(due.map((row) => row.organizationId))) {
    const scope = createScope(db, {
      organizationId,
      userId: 'system:gallery-expiry',
      role: 'member',
      impersonatedBy: null,
    })
    await expireGalleryPreviews(scope, now)
  }
}
