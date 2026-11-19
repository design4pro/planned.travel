#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isAlive, runStore } from './backlog-status.mjs'

const windowDays = 14
const limit = 30
const outputLimit = 18_000
const delivery = {
  'pr-autopilot': { merge: 'merge', confirm: 'confirm' },
  'implement-ticket': { merge: 'approve', confirm: 'confirm-merge' },
}
const terminal = new Set(['done', 'failed', 'cancelled'])
const nativeSteps = new Set([
  'execution-guard',
  'preflight',
  'implement',
  'gate',
  'bootstrap',
  'pr',
  'prepare',
  'ci-preflight',
  'ci',
  'verify-ci',
  'merge',
  'approve',
  'confirm',
  'confirm-merge',
  'reconcile-issues',
])
const stepStatuses = new Set([
  'pending',
  'running',
  'waiting',
  'done',
  'failed',
  'cancelled',
  'skipped',
])

export function summarizeDeliveryRuns(runs, now = new Date()) {
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const eligible = runs
    .filter(
      (run) =>
        run &&
        Object.hasOwn(delivery, run.workflow) &&
        terminal.has(run.status) &&
        !isAlive(run) &&
        typeof run.finishedAt === 'string' &&
        typeof run.id === 'string' &&
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(run.id) &&
        Date.parse(run.finishedAt) >= since.getTime() &&
        Date.parse(run.finishedAt) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))

  const report = {
    since: since.toISOString(),
    through: now.toISOString(),
    eligible: eligible.length,
    limit,
    runs: [],
  }
  for (const run of eligible.slice(0, limit)) {
    const observed = Array.isArray(run.steps) ? run.steps : []
    const statuses = new Map()
    for (const step of observed) {
      if (!nativeSteps.has(step?.id)) continue
      statuses.set(
        step.id,
        statuses.has(step.id) || !stepStatuses.has(step.status)
          ? 'ambiguous'
          : step.status,
      )
    }
    const continuationCount = observed.filter(
      (step) =>
        typeof step?.id === 'string' &&
        /^continue-[1-9][0-9]{0,3}$/.test(step.id),
    ).length
    const { merge, confirm } = delivery[run.workflow]
    const confirmed =
      run.status === 'done' &&
      [confirm, 'reconcile-issues'].every((id) => statuses.get(id) === 'done')
    const followedCi =
      confirmed &&
      continuationCount === 0 &&
      ['ci', 'verify-ci', merge].every((id) => statuses.get(id) === 'done')
    report.runs.push({
      id: run.id,
      workflow: run.workflow,
      status: run.status,
      finishedAt: new Date(run.finishedAt).toISOString(),
      pr:
        Number.isSafeInteger(run.prNumber) && run.prNumber > 0
          ? run.prNumber
          : null,
      nativeDelivery: followedCi
        ? 'ci-to-confirm'
        : confirmed
          ? 'confirm-only'
          : 'unverified',
      continuationCount,
      steps: [...statuses].map(([id, status]) => ({ id, status })),
    })
    if (JSON.stringify(report).length > outputLimit) {
      report.runs.pop()
      break
    }
  }
  return report
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const runs = JSON.parse(readFileSync(join(runStore(), 'runs.json'), 'utf8'))
  process.stdout.write(`${JSON.stringify(summarizeDeliveryRuns(runs))}\n`)
}
