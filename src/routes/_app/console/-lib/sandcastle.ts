/**
 * What the sandcastle screen counts and how it says durations.
 *
 * Separate from the screen because these are the only decisions on it that can be wrong in a way a
 * pixel comparison would not notice — a lease countdown that goes negative, an orphan count that
 * includes a branch somebody is still working on — and because they are pure, so they can be
 * tested as themselves.
 *
 * Every duration is derived from the registry's own `now`, never from `Date.now()`. The registry
 * computes expiry server-side precisely so that a laptop and a GitHub Actions runner with different
 * clocks agree about whose lease is live; reading the browser's clock here would reintroduce the
 * skew at the last step, and would make the page disagree with the runs it describes.
 */

import type { Translate } from '#/lib/i18n'
import type { RegistryState, WipView } from '#/server/do'

/** The three numbers at the top of the screen. */
export interface SandcastleFleetSummary {
  readonly liveRuns: number
  /** Issues under lease right now, across every live run. */
  readonly issuesHeld: number
  /** Branches with commits on them that no live run holds — work waiting to be adopted. */
  readonly orphanedBranches: number
}

export function summariseFleet(state: RegistryState): SandcastleFleetSummary {
  return {
    liveRuns: state.active.length,
    issuesHeld: state.active.reduce((held, run) => held + run.issues.length, 0),
    orphanedBranches: state.wip.filter((wip) => wip.orphaned).length,
  }
}

/**
 * Orphans first, then most recently touched.
 *
 * An orphan is the only row on the panel that asks the reader for anything: it is work sitting on a
 * branch that nothing is going to pick up unless a run claims that issue again.
 */
export function orderWip(wip: ReadonlyArray<WipView>): ReadonlyArray<WipView> {
  return [...wip].sort(
    (left, right) =>
      Number(right.orphaned) - Number(left.orphaned) ||
      right.updatedAt - left.updatedAt,
  )
}

/** `47s`, `12m`, `3h 12m`, `2d 3h` — coarsening as it grows, the way a reader reads it. */
export function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000))
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const remainder = minutes % 60
    return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
  }

  const days = Math.floor(hours / 24)
  const remainder = hours % 24
  return remainder === 0 ? `${days}d` : `${days}d ${remainder}h`
}

/**
 * How long a lease has left, or that it has none.
 *
 * A lease past its expiry is not an error and not a gap in the data: the registry reaps on a
 * one-minute alarm, so a run that stopped heartbeating is visibly expiring for up to a minute
 * before it is swept. Saying `expired` is more honest than a negative number and more useful than
 * hiding the row.
 */
export function formatLease(
  t: Translate,
  expiresAt: number,
  now: number,
): string {
  return expiresAt <= now
    ? t('console.runs.lease.expired')
    : t('console.runs.lease.left', { elapsed: formatElapsed(expiresAt - now) })
}
