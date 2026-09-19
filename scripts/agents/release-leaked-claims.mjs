#!/usr/bin/env node

/**
 * Releases the `in-progress` claims a review sweep opened and left behind (#551).
 *
 *   node scripts/agents/release-leaked-claims.mjs --since <ISO-8601> --prs 549,550 [--dry-run]
 *
 * `om-auto-review-pr` must release the lock it opened on every exit path, and says so. That rule
 * lives in prompt prose, and on PR #549 a housekeeping sweep claimed, reviewed nothing, and ended
 * `done` with the lock still on - so the same run's merge-buddy step, and every other actor for the
 * 24-hour stale window, backed off a PR nobody was working. This script is the deterministic half:
 * run as the sweep's last act, it checks the PRs the sweep dispatched and releases any claim that
 * outlived its run, saying in the comment - and on stdout, for the step's own report - whether a
 * review was submitted at all.
 *
 * Both bounds are required, because releasing a live claim is the opposite defect (#490: a PR
 * observably unclaimed while a run works it). `--prs` limits it to what this sweep dispatched and
 * `--since` to claims this sweep could have opened; within that, a claim is leaked only when it is
 * the newest lock event on the PR, so a later claim by any other skill or actor is left alone.
 */

import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const LABEL = 'in-progress'
const SKILL = 'om-auto-review-pr'
const ROBOT = '🤖'

// The lock lifecycle comments of `claim-pr.md`, plus the free-form claim #549 actually carried.
const CLAIM = /started by|claiming|taking over|adopting/i
const RELEASE = /lock (released|retained|handed off)|aborted/i

// The skill a lock comment speaks for: the first backticked `om-*` name on its first line. A claim
// by another skill may name this one further down ("re-entering the lock `om-auto-review-pr` left").
const owner = (body) => /`(om-[\w-]+)`/.exec(String(body).split('\n')[0])?.[1]

const lockEvent = (c) => {
  const body = String(c.body ?? '').trim()
  if (!body.startsWith(ROBOT)) return null
  if (RELEASE.test(body)) return 'release'
  if (CLAIM.test(body)) return 'claim'
  return null
}

/**
 * The release to make on one PR, or `null` when its lock is not this sweep's leak.
 *
 * @param {{ number: number, labels: {name: string}[], comments: {author: {login: string}, body: string, createdAt: string}[], reviews: {author: {login: string}, state: string, submittedAt: string}[] }} pr
 * @param {{ currentUser: string, since: string }} opts
 */
export function planRelease(pr, { currentUser, since }) {
  if (!pr.labels.some((l) => l.name === LABEL)) return null
  const last = pr.comments
    .filter((c) => lockEvent(c))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .at(-1)
  if (
    !last ||
    lockEvent(last) !== 'claim' ||
    last.author?.login !== currentUser ||
    owner(last.body) !== SKILL ||
    Date.parse(last.createdAt) < Date.parse(since)
  )
    return null
  const review = pr.reviews
    .filter(
      (r) =>
        r.author?.login === currentUser &&
        Date.parse(r.submittedAt) >= Date.parse(last.createdAt),
    )
    .at(-1)
  return {
    number: pr.number,
    claimedAt: last.createdAt,
    review: review
      ? { state: review.state, submittedAt: review.submittedAt }
      : null,
  }
}

/** The release comment; it matches `RELEASE`, so a second pass sees the PR as released. */
export function releaseComment({ claimedAt, review }) {
  const outcome = review
    ? `${review.state} review submitted at ${review.submittedAt}`
    : 'no review submitted'
  return `${ROBOT} \`release-leaked-claims\`: the \`${SKILL}\` claim from ${claimedAt} outlived its run - ${outcome}. Lock released.`
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' })

function arg(name) {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}

function main() {
  const since = arg('--since')
  const prs = (arg('--prs') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
  if (!since || Number.isNaN(Date.parse(since))) {
    console.error(
      'usage: release-leaked-claims.mjs --since <ISO-8601> --prs <n,n,...> [--dry-run]',
    )
    process.exit(2)
  }
  const dryRun = process.argv.includes('--dry-run')
  const currentUser = gh(['api', 'user', '--jq', '.login']).trim()

  let released = 0
  for (const number of prs) {
    const pr = JSON.parse(
      gh(['pr', 'view', number, '--json', 'number,labels,comments,reviews']),
    )
    const plan = planRelease(pr, { currentUser, since })
    if (!plan) continue
    const body = releaseComment(plan)
    if (!dryRun) {
      gh(['pr', 'edit', number, '--remove-label', LABEL])
      gh(['pr', 'comment', number, '--body', body])
    }
    released++
    console.log(`#${number}: ${body}${dryRun ? ' (dry run)' : ''}`)
  }
  console.log(
    `release-leaked-claims: ${released} of ${prs.length} PR(s) released.`,
  )
}

// Importing this file for `planRelease` must not talk to GitHub.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main()
