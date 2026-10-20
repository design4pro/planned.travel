import { COLLECTION_PLACE_STATUSES } from '#/server/db/schema'
import type { MessageKey } from '#/lib/i18n'

export { COLLECTION_PLACE_STATUSES }
export type PlaceStatus = (typeof COLLECTION_PLACE_STATUSES)[number]
export const STATUS_KEYS: Record<PlaceStatus, MessageKey> = {
  idea: 'modules.collections.status.idea',
  shortlisted: 'modules.collections.status.shortlisted',
  planned: 'modules.collections.status.planned',
  visited: 'modules.collections.status.visited',
  rejected: 'modules.collections.status.rejected',
}
