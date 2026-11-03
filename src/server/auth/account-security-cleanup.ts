import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto'
import {
  cleanupPage,
  finishCleanupReference,
  noteCleanupAttempt,
  pendingCleanupReferences,
  recordCleanupReference,
  setCleanupState,
  recordRoomTargets,
  pendingRoomTargets,
  operationFor,
} from '#/server/repos/account-security'
import { discoverAccountCleanup } from './account-authority'
import { deleteSessionBlobs } from './session-blobs'
import type { AccountAuthDatabase } from './account-authority-lib/scope'
import type { SessionKeyStore } from './session-blobs'

/** A bounded restartable sweep: native rows survive until encrypted retry references are durable. */
export async function sweepAccountSecurity(db: AccountAuthDatabase, options: {
  key: string
  store: SessionKeyStore
  workspaces: (userId: string) => Promise<ReadonlyArray<string>>
  publish: (userId: string, operationId: string, organizationIds: ReadonlyArray<string>) => Promise<void>
  now: number
}): Promise<void> {
  for (const { scope, operation } of await discoverAccountCleanup(db)) {
    await noteCleanupAttempt(scope, operation.id, options.now)
    const source = await cleanupPage(scope, operation.revision + 1, '', 200)
    for (const row of source) {
      const encrypted = await symmetricEncrypt({ key: options.key, data: row.token })
      await recordCleanupReference(scope, operation.id, row.id, encrypted)
    }
    const references = await pendingCleanupReferences(scope, operation.id)
    for (const reference of references) {
      const token = await symmetricDecrypt({ key: options.key, data: reference.encryptedToken })
      const outcome = await deleteSessionBlobs(options.store, [token])
      if (outcome.failed === 0) await finishCleanupReference(scope, operation.id, reference.id)
    }
    if (!operation.roomsRecorded) await recordRoomTargets(scope, operation.id, await options.workspaces(scope.userId))
    const rooms = await pendingRoomTargets(scope, operation.id)
    if (rooms.length > 0) await options.publish(scope.userId, operation.id, rooms)
    const settled = await operationFor(scope, operation.id)
    const roomsPending = settled?.roomsPending ?? true
    const remainingSource = await cleanupPage(scope, operation.revision + 1, '', 1)
    const remainingReferences = await pendingCleanupReferences(scope, operation.id)
    await setCleanupState(scope, operation.id, { cleanupPending: roomsPending || remainingSource.length > 0 || remainingReferences.length > 0 })
  }
}
