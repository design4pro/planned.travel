#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const gh = (args) =>
  JSON.parse(
    execFileSync('gh', args, {
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )
const pages = (path, read) => read(['api', '--paginate', '--slurp', path])

export function judgeChecks({ checks, statuses, runs, required, readable }) {
  const rows = [
    ...checks.map((c) => ({
      name: c.name,
      app: c.app?.id,
      state: c.status === 'completed' ? c.conclusion : 'pending',
    })),
    ...statuses.map((s) => ({ name: s.context, state: s.state })),
  ]
  const passing = new Set(['success', 'neutral', 'skipped'])
  const failing = new Set([
    'failure',
    'error',
    'cancelled',
    'timed_out',
    'action_required',
    'startup_failure',
    'stale',
  ])
  const failed = rows.filter((r) => failing.has(r.state)).map((r) => r.name)
  const missing = required
    .filter(
      (r) =>
        !rows.some(
          (c) =>
            c.name === r.context &&
            (!r.app_id || c.app === r.app_id) &&
            c.state === 'success',
        ),
    )
    .map((r) => r.context)
  let state = 'green'
  if (
    failed.length ||
    runs.some((r) => r.status === 'completed' && failing.has(r.conclusion))
  )
    state = 'red'
  else if (
    !readable ||
    rows.some((r) => !passing.has(r.state) && r.state !== 'pending') ||
    runs.some((r) => r.status === 'completed' && !passing.has(r.conclusion))
  )
    state = 'unknown'
  else if (
    !rows.length ||
    missing.length ||
    rows.some((r) => r.state === 'pending') ||
    runs.some((r) => r.status !== 'completed')
  )
    state = 'pending'
  return {
    state,
    checks: rows.length,
    workflowRuns: runs.length,
    pending:
      rows.filter((r) => r.state === 'pending').length +
      runs.filter((r) => r.status !== 'completed').length,
    missing: [...new Set(missing)],
    failed: [...new Set(failed)],
  }
}

/** A paginated REST snapshot includes app checks, legacy statuses and not-yet-registered runs. */
export function readPrState(repo, number, read = gh) {
  const root = `repos/${repo}`
  const pr = read(['api', `${root}/pulls/${number}`])
  const warnings = []
  let readable = true
  const optional = (name, fn, fallback, required = true) => {
    try {
      return fn()
    } catch {
      warnings.push(`${name} unavailable`)
      if (required) readable = false
      return fallback
    }
  }
  const checks = optional(
    'App check runs',
    () =>
      pages(
        `${root}/commits/${pr.head.sha}/check-runs?per_page=100&filter=latest`,
        read,
      ).flatMap((p) => p.check_runs),
    [],
  )
  const rawStatuses = optional(
    'Commit statuses',
    () =>
      pages(
        `${root}/commits/${pr.head.sha}/statuses?per_page=100`,
        read,
      ).flat(),
    [],
  )
  const statuses = [
    ...new Map(rawStatuses.toReversed().map((s) => [s.context, s])).values(),
  ]
  const rawRuns = optional(
    'Workflow runs',
    () =>
      pages(
        `${root}/actions/runs?head_sha=${pr.head.sha}&event=pull_request&per_page=100`,
        read,
      ).flatMap((p) => p.workflow_runs),
    [],
  )
  const runs = [
    ...new Map(
      rawRuns
        .toReversed()
        .filter((r) => r.head_sha === pr.head.sha && r.event === 'pull_request')
        .map((r) => [r.workflow_id, r]),
    ).values(),
  ]
  let rulesKnown = false
  const required = []
  try {
    const rules = pages(
      `${root}/rules/branches/${encodeURIComponent(pr.base.ref)}`,
      read,
    ).flat()
    required.push(
      ...rules
        .filter((r) => r.type === 'required_status_checks')
        .flatMap((r) => r.parameters.required_status_checks)
        .map((r) => ({ context: r.context, app_id: r.integration_id })),
    )
    rulesKnown = true
  } catch {
    warnings.push('Ruleset requirements unavailable')
    readable = false
  }
  try {
    const classic = read([
      'api',
      `${root}/branches/${encodeURIComponent(pr.base.ref)}/protection/required_status_checks`,
    ])
    required.push(
      ...(classic.checks?.length
        ? classic.checks
        : classic.contexts.map((context) => ({ context }))),
    )
    rulesKnown = true
  } catch (error) {
    let absent = false
    // GitHub hides some resources with 404; confirm administrative visibility first.
    if (/\(HTTP 404\)/.test(String(error.stderr ?? error.message))) {
      try {
        absent = read(['api', root]).permissions?.admin === true
      } catch {
        // Unknown permissions cannot establish absence of classic protection.
      }
    }
    if (!absent) {
      warnings.push('Classic protection unavailable')
      readable = false
    }
  }
  const reviews = optional(
    'Reviews',
    () => pages(`${root}/pulls/${number}/reviews?per_page=100`, read).flat(),
    [],
    false,
  )
  const lastReviews = new Map()
  for (const review of reviews)
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state))
      lastReviews.set(review.user.login, review.state)
  const ci = judgeChecks({
    checks,
    statuses,
    runs,
    required,
    readable: readable && rulesKnown,
  })
  // A push while collecting evidence invalidates every check just read.
  const current = read(['api', `${root}/pulls/${number}`])
  if (
    current.head.sha !== pr.head.sha ||
    current.base.sha !== pr.base.sha ||
    current.base.ref !== pr.base.ref ||
    current.state !== pr.state
  ) {
    ci.state = 'pending'
    warnings.push('PR head, base or state changed during snapshot; read again')
  }
  const labels = current.labels.map((l) => l.name)
  let review = 'none'
  if ([...lastReviews.values()].includes('APPROVED')) review = 'approved'
  if ([...lastReviews.values()].includes('CHANGES_REQUESTED'))
    review = 'changes-requested'
  return {
    number,
    url: pr.html_url,
    state: current.merged ? 'MERGED' : current.state.toUpperCase(),
    head: current.head.sha,
    base: current.base.ref,
    draft: current.draft,
    mergeable: current.mergeable,
    labels,
    review,
    qa: labels.includes('needs-qa')
      ? 'required: verify current-head QA evidence before merging'
      : 'not-required',
    blockingLabels: labels.filter((l) =>
      ['blocked', 'do-not-merge', 'qa-failed'].includes(l),
    ),
    ci,
    warnings,
  }
}

export async function waitForPr(
  snapshot,
  {
    timeoutMs = 40 * 60_000,
    pollMs = 30_000,
    now = Date.now,
    sleep: pause = sleep,
  } = {},
) {
  const deadline = now() + timeoutMs
  for (;;) {
    const state = await snapshot()
    if (state.state !== 'OPEN' || state.ci.state !== 'pending') return state
    if (now() >= deadline) return { ...state, timedOut: true }
    await pause(Math.min(pollMs, deadline - now()))
  }
}

async function main(argv) {
  const number = Number(argv.shift())
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error('Usage: pr-state.mjs N [--wait] [--timeout-ms N]')
  const config = JSON.parse(readFileSync('.ai/agentic.config.json', 'utf8'))
  let timeoutMs = (config.ci?.maxWaitMinutes ?? 40) * 60_000
  let wait = false
  while (argv.length) {
    const flag = argv.shift()
    if (flag === '--wait') wait = true
    else if (flag === '--timeout-ms') {
      timeoutMs = Number(argv.shift())
      if (
        !Number.isSafeInteger(timeoutMs) ||
        timeoutMs <= 0 ||
        timeoutMs > 40 * 60_000
      )
        throw new Error('Timeout must be 1..2400000 ms')
    } else throw new Error(`Unknown argument ${flag}`)
  }
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner
  const snapshot = () => readPrState(repo, number)
  const result = wait ? await waitForPr(snapshot, { timeoutMs }) : snapshot()
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (wait && (result.state !== 'OPEN' || result.ci.state !== 'green'))
    process.exitCode = result.ci.state === 'unknown' ? 3 : 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).catch(() => {
    process.stdout.write(
      `${JSON.stringify({ ci: { state: 'unknown' }, error: 'PR/CI read failed; no green evidence' })}\n`,
    )
    process.exitCode = 3
  })
}
