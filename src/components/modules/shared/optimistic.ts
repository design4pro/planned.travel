/**
 * The overlay that makes a checkbox feel instant without letting it lie.
 *
 * These screens are loader-driven: the server's answer, re-fetched after every
 * write, is the only truth. An optimistic tick therefore cannot *replace* that
 * truth — it sits on top of it as an overlay keyed by row id, and is withdrawn
 * the moment the write settles, whichever way it settled.
 *
 * Two properties matter enough to be tested rather than assumed:
 *
 * 1. **Rollback is exact.** A failed write withdraws only the rows *that write*
 *    claimed, at the value it claimed. Tick A, tick B, A fails: B must stay
 *    ticked.
 * 2. **A later claim wins.** Ticking a row twice in quick succession leaves the
 *    overlay showing the second intention, and the first request settling late
 *    must not resurrect the first.
 *
 * The reducer is generic over the value so the same machine drives a boolean tick
 * and a reordered array of ids.
 */

/** A single in-flight claim: the rows it touched and the value it asserted. */
export interface OptimisticClaim<TValue> {
  readonly id: number
  readonly entries: ReadonlyMap<string, TValue>
}

export interface OptimisticState<TValue> {
  /** The value to render for a row, when a claim covers it. */
  readonly values: ReadonlyMap<string, TValue>
  /** Claims still in flight, oldest first. */
  readonly claims: ReadonlyArray<OptimisticClaim<TValue>>
  /** Monotonic id for the next claim. */
  readonly nextId: number
}

export type OptimisticAction<TValue> =
  | {
      readonly type: 'claim'
      readonly id: number
      readonly entries: ReadonlyArray<readonly [string, TValue]>
    }
  | { readonly type: 'settle'; readonly id: number }
  | { readonly type: 'clear' }

export function emptyOptimistic<TValue>(): OptimisticState<TValue> {
  return { values: new Map(), claims: [], nextId: 1 }
}

/**
 * Rebuilds the rendered overlay from the claims still in flight, oldest first, so
 * the newest claim for any row is the one that shows.
 */
function project<TValue>(
  claims: ReadonlyArray<OptimisticClaim<TValue>>,
): Map<string, TValue> {
  const values = new Map<string, TValue>()
  for (const claim of claims) {
    for (const [key, value] of claim.entries) {
      values.set(key, value)
    }
  }
  return values
}

export function optimisticReducer<TValue>(
  state: OptimisticState<TValue>,
  action: OptimisticAction<TValue>,
): OptimisticState<TValue> {
  switch (action.type) {
    case 'claim': {
      if (action.entries.length === 0) {
        return state
      }
      const claims = [
        ...state.claims,
        { id: action.id, entries: new Map(action.entries) },
      ]
      return {
        values: project(claims),
        claims,
        nextId: Math.max(state.nextId, action.id + 1),
      }
    }
    case 'settle': {
      const claims = state.claims.filter((claim) => claim.id !== action.id)
      if (claims.length === state.claims.length) {
        return state
      }
      return { values: project(claims), claims, nextId: state.nextId }
    }
    case 'clear':
      return state.claims.length === 0 && state.values.size === 0
        ? state
        : { values: new Map(), claims: [], nextId: state.nextId }
  }
}

/** True while any write started through this overlay is still outstanding. */
export function isSettling<TValue>(state: OptimisticState<TValue>): boolean {
  return state.claims.length > 0
}

/**
 * Applies an array move without mutating the input — the operation a
 * drag-and-drop reorder needs before it is sent to the server.
 *
 * Returns the array unchanged when the move is a no-op or either index is out of
 * range, so a stray drop cannot scramble an order or throw.
 */
export function moveItem<T>(
  items: ReadonlyArray<T>,
  from: number,
  to: number,
): Array<T> {
  const next = [...items]
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= next.length ||
    to >= next.length
  ) {
    return next
  }
  const [moved] = next.splice(from, 1)
  if (moved === undefined) {
    return [...items]
  }
  next.splice(to, 0, moved)
  return next
}
