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
import type { TransportLeg } from '#/server/db/types'

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

/**
 * Replaces only the chain of a Transport that exists: the record is sent empty, so its title and
 * every other field stay as they were, and the Legs it now has come back in chain order.
 *
 * A writer of the chain alone used to exist for these tests; it had no production caller left once
 * both save paths wrote through `saveTransport`, so the chain-only cases are shown here.
 */
export async function replaceChain(
  scope: TenantScope,
  tripId: string,
  transportId: string,
  chain: SaveTransportInput['chain'],
): Promise<Array<TransportLeg>> {
  const { legs } = await editTransport(scope, tripId, transportId, {}, chain)
  return legs
}
