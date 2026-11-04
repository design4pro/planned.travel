import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runStore, isAlive } from './backlog-status.mjs'

export function activeMinutes(events, now) {
  const since = now - 7 * 86400_000
  const starts = new Map()
  let milliseconds = 0
  for (const event of events) {
    const at = Date.parse(event.ts)
    if (!Number.isFinite(at)) throw new Error('Unknown event time')
    if (event.type === 'turn.started') starts.set(event.turnId, at)
    if (event.type === 'turn.completed' || event.type === 'turn.failed') {
      const start = starts.get(event.turnId)
      if (start === undefined && at >= since)
        throw new Error('Incomplete turn timing')
      if (start !== undefined)
        milliseconds += Math.max(0, Math.min(now, at) - Math.max(since, start))
      starts.delete(event.turnId)
    }
  }
  for (const start of starts.values())
    milliseconds += Math.max(0, now - Math.max(since, start))
  return milliseconds / 60_000
}

export function productBudget(
  runs,
  readEvents,
  now = Date.now(),
  currentRunId,
) {
  // shortcut: checks admission between runs; use an engine turn budget if a mid-turn ceiling is needed.
  let total = 0
  let product = 0
  let inFlight = false
  for (const run of runs) {
    const exploratory =
      run.workflow === 'product-radar' ||
      run.productDiscovery === true ||
      run.task?.includes('[product-radar]')
    if (
      exploratory &&
      run.workflow !== 'product-radar' &&
      run.id !== currentRunId &&
      isAlive(run)
    )
      inFlight = true
    if (
      Date.parse(run.finishedAt ?? new Date(now).toISOString()) <
      now - 7 * 86400_000
    )
      continue
    const events = readEvents(run.id)
    if (
      run.steps?.some((step) => step.kind === 'agent' && step.startedAt) &&
      !events.some((event) => event.type === 'turn.started')
    )
      throw new Error('Missing active-minute telemetry')
    const minutes = activeMinutes(events, now)
    total += minutes
    if (exploratory) product += minutes
  }
  return {
    totalMinutes: total,
    productMinutes: product,
    share: total ? product / total : null,
    inFlight,
    allowed: total > 0 && product / total < 0.2 && !inFlight,
  }
}

export function readProductBudget() {
  const store = runStore()
  return productBudget(
    JSON.parse(readFileSync(join(store, 'runs.json'), 'utf8')),
    (id) => {
      if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid run ID')
      return readFileSync(join(store, 'runs', `${id}.ndjson`), 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    },
    Date.now(),
    process.env.CEZ_RUN_ID,
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(JSON.stringify(readProductBudget()))
  } catch {
    console.log(
      JSON.stringify({
        allowed: false,
        reason: 'Active-minute telemetry is incomplete',
      }),
    )
  }
}
