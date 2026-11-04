import { listWorkspacesHoldingUser } from '#/server/catalog/erasure'
import type { Database } from '#/server/db/types'
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto'
import {
  cleanupPage,
  finishCleanupReference,
  noteCleanupAttempt,
  noteCleanupReferenceAttempt,
  pendingCleanupReferences,
  recordCleanupReference,
  setCleanupState,
  recordRoomTargets,
  pendingRoomTargets,
  operationFor,
  noteRoomPublicationAttempt,
} from '#/server/repos/account-security'
import { discoverAccountCleanup } from './account-authority'
import { deleteSessionBlobs } from './session-blobs'
import type { AccountAuthDatabase } from './account-authority-lib/scope'
import type { SessionKeyStore } from './session-blobs'

/** A bounded restartable sweep: native rows survive until encrypted retry references are durable. */
export async function sweepAccountSecurity(
  db: AccountAuthDatabase,
  options: {
    key: string
    store: SessionKeyStore
    discoveryDb: Database
    publish: (
      userId: string,
      operationId: string,
      organizationIds: ReadonlyArray<string>,
    ) => Promise<void>
    now: number
  },
): Promise<void> {
  for (const { scope, operation } of await discoverAccountCleanup(db)) {
    await noteCleanupAttempt(scope, operation.id, options.now)
    const failures: Array<unknown> = []
    const tokenWork = async () => {
      try {
        const source = await cleanupPage(scope, operation.revision + 1, '', 200)
        for (const row of source) {
          try {
            const encrypted = await symmetricEncrypt({
              key: options.key,
              data: row.token,
            })
            await recordCleanupReference(scope, operation.id, row.id, encrypted)
          } catch (error) {
            failures.push(error)
          }
        }
      } catch (error) {
        failures.push(error)
      }
      try {
        const references = await pendingCleanupReferences(scope, operation.id)
        for (const reference of references) {
          try {
            await noteCleanupReferenceAttempt(
              scope,
              operation.id,
              reference.id,
              options.now,
            )
            const token = await symmetricDecrypt({
              key: options.key,
              data: reference.encryptedToken,
            })
            const outcome = await deleteSessionBlobs(options.store, [token])
            if (outcome.failed === 0)
              await finishCleanupReference(scope, operation.id, reference.id)
          } catch (error) {
            failures.push(error)
          }
        }
      } catch (error) {
        failures.push(error)
      }
    }
    const roomWork = async () => {
      if (!operation.roomsRecorded)
        await recordRoomTargets(
          scope,
          operation.id,
          await discoverRoomWorkspaces(options.discoveryDb, scope.userId),
        )
      const rooms = await pendingRoomTargets(scope, operation.id)
      if (rooms.length > 0) {
        await noteRoomPublicationAttempt(
          scope,
          operation.id,
          rooms,
          options.now,
        )
        await options.publish(scope.userId, operation.id, rooms)
      }
    }
    const outcomes = await Promise.allSettled([tokenWork(), roomWork()])
    for (const outcome of outcomes)
      if (outcome.status === 'rejected') failures.push(outcome.reason)
    const settled = await operationFor(scope, operation.id)
    const roomsPending = settled?.roomsPending ?? true
    const remainingSource = await cleanupPage(
      scope,
      operation.revision + 1,
      '',
      1,
    )
    const remainingReferences = await pendingCleanupReferences(
      scope,
      operation.id,
    )
    await setCleanupState(scope, operation.id, {
      cleanupPending:
        failures.length > 0 ||
        roomsPending ||
        remainingSource.length > 0 ||
        remainingReferences.length > 0,
    })
    if (failures.length > 0)
      throw new Error('Account security cleanup remains pending.')
  }
}

/** Only routing ids leave the catalog projection; discovery must finish before targets are recorded. */
export async function discoverRoomWorkspaces(
  db: Database,
  userId: string,
): Promise<Array<string>> {
  const ids: Array<string> = []
  let after: string | null = null
  for (let page = 0; page < 250; page += 1) {
    const result = await listWorkspacesHoldingUser(db, userId, {
      after,
      limit: 100,
    })
    ids.push(...result.items.map((item) => item.organizationId))
    if (result.next === null) return ids
    if (after !== null && result.next <= after)
      throw new Error('Room discovery cursor did not advance.')
    after = result.next
  }
  throw new Error('Room discovery exceeded its page budget.')
}
