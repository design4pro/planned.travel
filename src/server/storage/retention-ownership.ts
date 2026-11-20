import { createScope } from '#/server/repos/base'
import { getFileByStorageKey } from '#/server/repos/files'
import { organizationExistsForRetentionUnscoped } from '#/server/repos/object-retention'
import { tripsRepository } from '#/server/repos/trips'
import type { Database } from '#/server/db/types'
import type { RetentionOwnership } from './weekly-retention'

export function createRetentionOwnership(db: Database): RetentionOwnership {
  return {
    organizationExists: (organizationId) =>
      organizationExistsForRetentionUnscoped(db, organizationId),
    async hasUploadReference(organizationId, tripId, key) {
      const scope = createScope(db, {
        organizationId,
        userId: 'system:weekly-object-retention',
        role: 'member',
        impersonatedBy: null,
      })
      // The tenant repository includes private, archived and otherwise unreadable trips.
      return (
        (await tripsRepository.findById(scope, tripId)) !== null ||
        (await getFileByStorageKey(scope, key)) !== null
      )
    },
  }
}
