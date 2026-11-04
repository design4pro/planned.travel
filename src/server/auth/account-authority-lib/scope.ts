import type { Database } from '#/server/db/types'

export type AccountAuthDatabase = Pick<
  Database,
  'select' | 'insert' | 'update' | 'delete' | 'run'
>

export const accountScopeBrand: unique symbol = Symbol('account-auth')
export interface AccountAuthScope {
  readonly [accountScopeBrand]: true
  readonly db: AccountAuthDatabase
  readonly userId: string
}
export interface ProofRevision {
  readonly revision: number
  readonly trustRevision: number
  readonly lastFence: number
}
