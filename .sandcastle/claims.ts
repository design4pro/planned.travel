/**
 * Which issue ids each live sandcastle run owns, so two concurrent runs never
 * build the same ticket.
 *
 * It exists because `--issues` did not stop that: the flag partitions the
 * backlog only when the operator types it correctly, and the night this was
 * written a `--issue 104` typo left a run unscoped, so its planner read the
 * whole `ready-for-agent` list and a second fleet re-implemented the two
 * tickets the first one was already building. Partitioning by discipline is not
 * partitioning.
 *
 * A claim is a file next to the run's pid lock, and liveness is that same pid:
 * claims beside a dead pid are not claims, exactly as a stale run lock is not a
 * lock, so a crashed run releases its work for free and the next run resumes it.
 *
 * Lives apart from `main.ts` because `main.ts` is a top-level script that starts
 * the loop on import — this is the seam that lets the logic be tested at all.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { z } from 'zod'

const claimsSchema = z.array(z.string())

/** Is that pid still alive? Signal 0 delivers nothing; it only asks. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function claimsPath(logsRoot: string, runId: string): string {
  return join(logsRoot, `run-${runId}`, 'claims.json')
}

/**
 * id → the run holding it, across every LIVE run except `selfRunId`. When two
 * runs somehow claim the same id, the first-sorting run id is reported as the
 * holder, which is what makes the tiebreak in `claim()` agree on both sides.
 */
export async function claimedElsewhere(
  logsRoot: string,
  selfRunId: string,
): Promise<Map<string, string>> {
  const claimed = new Map<string, string>()
  const runDirs = await readdir(logsRoot).catch((): string[] => [])
  for (const dir of runDirs) {
    if (!dir.startsWith('run-') || dir === `run-${selfRunId}`) continue
    const holder = await readFile(
      join(logsRoot, dir, 'run.lock'),
      'utf8',
    ).catch(() => '')
    if (holder === '' || !isAlive(Number(holder))) continue
    const raw = await readFile(
      join(logsRoot, dir, 'claims.json'),
      'utf8',
    ).catch(() => '[]')
    let ids: string[]
    try {
      ids = claimsSchema.parse(JSON.parse(raw))
    } catch {
      // A half-written claims file means a run is mid-plan. Ignoring it can
      // only widen this run's scope, which the re-read in `claim()` closes.
      continue
    }
    const owner = dir.slice('run-'.length)
    for (const id of ids) {
      const held = claimed.get(id)
      if (held === undefined || owner < held) claimed.set(id, owner)
    }
  }
  return claimed
}

/**
 * Publish this run's claims, then yield any id a concurrent run claimed in the
 * same window. Two planners can be in flight at once — that is exactly what
 * happened the night this was written — so claiming alone is not enough; the
 * re-read is what settles it. The first-sorting run id keeps the issue:
 * arbitrary, but total and stable, so both runs reach the same verdict from
 * their own side without talking to each other, and neither politely drops work
 * that both of them wanted.
 */
export async function claim(
  logsRoot: string,
  selfRunId: string,
  ids: string[],
): Promise<string[]> {
  const path = claimsPath(logsRoot, selfRunId)
  await writeFile(path, JSON.stringify(ids))
  const contested = await claimedElsewhere(logsRoot, selfRunId)
  const kept = ids.filter((id) => {
    const owner = contested.get(id)
    return owner === undefined || selfRunId < owner
  })
  if (kept.length !== ids.length) await writeFile(path, JSON.stringify(kept))
  return kept
}
