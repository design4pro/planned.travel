/** Request-local replacement of the plugin's single member delete, preserving its lifecycle. */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { DBAdapter, DBTransactionAdapter } from 'better-auth'

interface Deletion {
  readonly commit: () => Promise<void>
  readonly memberId: string
  committed: boolean
}
const deletion = new AsyncLocalStorage<Deletion>()

export async function withMemberDeletion<T>(
  memberId: string,
  commit: () => Promise<void>,
  operation: () => Promise<T>,
): Promise<{ committed: boolean; error?: unknown }> {
  const state: Deletion = { commit, memberId, committed: false }
  return deletion.run(state, async () => {
    try {
      await operation()
      return { committed: state.committed }
    } catch (error) {
      return { committed: state.committed, error }
    }
  })
}

export function guardMemberDeletion(adapter: DBAdapter): DBAdapter {
  return {
    ...guardDelete(adapter),
    transaction: (callback) =>
      adapter.transaction((transaction) => callback(guardDelete(transaction))),
  }
}

function guardDelete<T extends DBTransactionAdapter>(adapter: T): T {
  return {
    ...adapter,
    findMany: async (input) => {
      const rows = await adapter.findMany(input)
      if (!deletion.getStore() || input.model !== 'member') return rows
      // The plugin counts owner tokens without trimming them. Only its preflight view is
      // normalized; the bound repository mutation still checks the original stored role atomically.
      return rows.map((row) => {
        if (
          typeof row !== 'object' ||
          row === null ||
          !('role' in row) ||
          typeof row.role !== 'string'
        )
          return row
        return {
          ...row,
          role: row.role
            .split(',')
            .map((role) => role.trim())
            .join(','),
        }
      })
    },
    deleteMany: async (input) => {
      if (deletion.getStore()) throw new Error('Unexpected bulk auth deletion.')
      return adapter.deleteMany(input)
    },
    delete: async (input) => {
      const state = deletion.getStore()
      if (!state) return adapter.delete(input)
      const [where] = input.where
      if (
        input.model !== 'member' ||
        input.where.length !== 1 ||
        where?.field !== 'id' ||
        where.value !== state.memberId ||
        (where.operator !== undefined && where.operator !== 'eq') ||
        state.committed
      ) {
        throw new Error('Unexpected auth deletion in membership operation.')
      }
      await state.commit()
      state.committed = true
    },
  }
}
