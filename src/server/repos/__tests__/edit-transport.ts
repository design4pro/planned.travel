/**
 * An edit of a Transport through the one writer: the record, and a chain that is empty unless the
 * test names one. An empty chain is a statement ("this journey has no legs"), so it deletes the
 * Legs the row had; a test that needs them to survive sends the chain it saved.
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
  chain: SaveTransportInput['chain'] = { stations: [], legs: [] },
) {
  return saveTransport(scope, {
    tripId,
    transportId,
    intent: 'edit',
    record,
    chain,
  })
}
