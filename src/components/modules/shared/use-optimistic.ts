/**
 * The React face of `optimistic.ts`.
 *
 * `claim(entries, run)` paints the intention immediately, runs the write, and
 * withdraws the claim when it settles — successfully or not. Because the claim is
 * withdrawn on success *after* the router invalidation has landed, the row never
 * flickers back to its old value on its way to the new one.
 */
import { useCallback, useMemo, useReducer } from 'react'

import { emptyOptimistic, isSettling, optimisticReducer } from './optimistic'

import type { OptimisticAction, OptimisticState } from './optimistic'

/** Claim ids only need to be unique within a session, never persisted. */
let claimSequence = 0

export interface OptimisticOverlay<TValue> {
  /** The claimed value for a row, or `undefined` when the server's stands. */
  readonly get: (key: string) => TValue | undefined
  /** True while at least one claim is outstanding. */
  readonly settling: boolean
  readonly claim: (
    entries: ReadonlyArray<readonly [string, TValue]>,
    run: () => Promise<unknown>,
  ) => Promise<void>
}

export function useOptimistic<TValue>(): OptimisticOverlay<TValue> {
  const [state, dispatch] = useReducer(
    optimisticReducer as (
      state: OptimisticState<TValue>,
      action: OptimisticAction<TValue>,
    ) => OptimisticState<TValue>,
    undefined,
    emptyOptimistic<TValue>,
  )

  const claim = useCallback(
    async (
      entries: ReadonlyArray<readonly [string, TValue]>,
      run: () => Promise<unknown>,
    ): Promise<void> => {
      if (entries.length === 0) {
        return
      }
      // A module-scoped counter rather than `state.nextId`: this closure is
      // memoised with no dependencies (so a claim never gets stale), which means
      // it cannot read the current state, and two claims made inside one render
      // pass must not collide on the same id.
      claimSequence += 1
      const id = claimSequence
      dispatch({ type: 'claim', id, entries })
      try {
        await run()
      } finally {
        dispatch({ type: 'settle', id })
      }
    },
    [],
  )

  const get = useCallback(
    (key: string): TValue | undefined => state.values.get(key),
    [state.values],
  )

  return useMemo(
    () => ({ get, settling: isSettling(state), claim }),
    [get, state, claim],
  )
}
