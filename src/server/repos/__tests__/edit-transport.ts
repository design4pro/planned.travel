/**
 * An edit of a Transport through the one writer, as the dialog sends it: the record and nothing
 * about the chain, which an empty chain leaves exactly where it was.
 *
 * `updateTransport` used to be the writer these tests reached for; it had no production caller
 * left once the dialog saved through `saveTransport`, so the refusals it showed are shown here.
 */

import { saveTransport } from '../transports'
import type { TenantScope } from '../base'
import type { SaveTransportInput } from '../transports'

export function editTransport(
  scope: TenantScope,
  tripId: string,
  transportId: string,
  record: SaveTransportInput['record'],
) {
  return saveTransport(scope, {
    tripId,
    transportId,
    intent: 'edit',
    record,
    chain: { stations: [], legs: [] },
  })
}
