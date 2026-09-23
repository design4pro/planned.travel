#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parseCloseLinks } from './close-fixed-issues.mjs'

const REQUIRED_CHECKS = [
  'lint · typecheck · build',
  'unit tests',
  'e2e · merged report',
  'merge-gate',
]
const HARD_BLOCKS = [
  'blocked',
  'do-not-merge',
  'changes-requested',
  'qa',
  'qa-failed',
  'in-progress',
]
const SHA = /^[0-9a-f]{40}$/
const GITHUB_ACTIONS_APP_ID = 15368
const hasLine = (body, line) =>
  body?.split('\n').some((part) => part.trim() === line)

export function decideMerge({
  pr,
  issues,
  reviews,
  checks,
  threads,
  comparison,
  qaComments,
  reviewDecision,
  trustedReviewers,
  trustedQaReviewers,
}) {
  const reasons = []
  const labels = new Set(pr.labels.map((label) => label.name))
  const headSha = pr.head?.sha
  const baseSha = pr.base?.sha
  if (
    pr.state !== 'open' ||
    pr.draft ||
    pr.base?.ref !== 'develop' ||
    pr.head?.repo?.full_name !== pr.base?.repo?.full_name
  )
    reasons.push('PR must be open, ready, same-repository, and target develop')
  if (!SHA.test(headSha ?? '') || !SHA.test(baseSha ?? ''))
    reasons.push('head or base SHA is unavailable')
  if (!pr.mergeable || pr.mergeable_state !== 'clean')
    reasons.push('GitHub does not report a clean merge')
  const linked = parseCloseLinks(pr)
  if (
    !linked.length ||
    linked.length !== issues.length ||
    linked.some((number) => !issues.some((issue) => issue.number === number))
  )
    reasons.push('implementation issue links are missing or incomplete')
  for (const issue of issues) {
    if (issue.pull_request) reasons.push(`#${issue.number} is a pull request`)
    if (issue.state !== 'open') reasons.push(`#${issue.number} is not open`)
    for (const label of [
      ...HARD_BLOCKS,
      'do-not-close',
      'needs-info',
      'ready-for-human',
    ])
      if (issue.labels.some(({ name }) => name === label))
        reasons.push(`#${issue.number} carries ${label}`)
    if (
      issue.labels.some(({ name }) => name === 'needs-qa') &&
      !labels.has('needs-qa')
    )
      reasons.push(`#${issue.number} requires PR-level QA`)
    if (issue.labels.some(({ name }) => name === 'security'))
      reasons.push(`#${issue.number} is security work`)
  }
  const risk = (names, owner) => {
    const found = [...names].filter((name) => name.startsWith('risk-'))
    if (found.length !== 1 || !['risk-low', 'risk-medium'].includes(found[0]))
      reasons.push(
        `${owner} must have exactly one risk-low or risk-medium label`,
      )
  }
  risk(labels, 'PR')
  if (labels.has('security')) reasons.push('PR is security work')
  for (const issue of issues)
    risk(new Set(issue.labels.map((label) => label.name)), `#${issue.number}`)
  for (const label of HARD_BLOCKS)
    if (labels.has(label)) reasons.push(`PR carries ${label}`)
  if (labels.has('needs-qa')) {
    if (!labels.has('qa-approved')) reasons.push('manual QA is outstanding')
    if (
      !qaComments.some(
        (comment) =>
          trustedQaReviewers.includes(comment.user?.login) &&
          hasLine(comment.body, `QA-approved SHA: ${headSha}`),
      )
    )
      reasons.push('QA approval does not name the current head SHA')
  }
  if (threads.some((thread) => !thread.isResolved && !thread.isOutdated))
    reasons.push('unresolved review threads remain')
  if (reviewDecision === 'CHANGES_REQUESTED')
    reasons.push('GitHub still reports changes requested')
  const currentReviews = reviews.filter(
    (review) => review.commit_id === headSha,
  )
  const latestByReviewer = new Map()
  for (const review of currentReviews.sort(
    (a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at),
  ))
    latestByReviewer.set(review.user?.login, review)
  if (
    [...latestByReviewer.values()].some(
      (review) => review.state === 'CHANGES_REQUESTED',
    )
  )
    reasons.push('a current review requests changes')
  if (
    ![...latestByReviewer.values()].some(
      (review) =>
        trustedReviewers.includes(review.user?.login) &&
        review.user?.login !== pr.user?.login &&
        review.state === 'APPROVED' &&
        hasLine(review.body, `Reviewed SHA: ${headSha}`),
    )
  )
    reasons.push('independent approval for the current head SHA is missing')
  for (const name of REQUIRED_CHECKS) {
    const latest = checks
      .filter(
        (check) =>
          check.name === name &&
          check.head_sha === headSha &&
          check.app?.id === GITHUB_ACTIONS_APP_ID,
      )
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0]
    if (latest?.head_sha !== headSha || latest?.conclusion !== 'success')
      reasons.push(`${name} is not successful on the current head`)
  }
  if (
    comparison?.behind_by !== 0 ||
    !['ahead', 'identical'].includes(comparison?.status)
  )
    reasons.push('head is not up to date with develop')
  return {
    number: pr.number,
    headSha,
    baseSha,
    eligible: reasons.length === 0,
    reasons,
  }
}

function parseOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      apply: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      repo: { type: 'string' },
    },
  })
  if (values.repo && !/^[\w.-]+\/[\w.-]+$/.test(values.repo))
    throw new Error('Invalid repository.')
  return {
    apply: Boolean(values.apply && !values['dry-run']),
    repo: values.repo ?? 'design4pro/planned.travel',
  }
}

export function runSelection(prs, { apply, inspect, merge, log }) {
  for (const item of prs.sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  )) {
    let result
    try {
      result = inspect(item)
    } catch {
      log(`PR #${item.number}: inspection failed; skipped.`, true)
      continue
    }
    log(JSON.stringify(result))
    if (!result.eligible || !apply) continue
    let current
    try {
      current = inspect(item)
    } catch {
      log(`PR #${item.number}: final inspection failed; skipped.`, true)
      continue
    }
    if (
      !current.eligible ||
      current.headSha !== result.headSha ||
      current.baseSha !== result.baseSha
    ) {
      log(`PR #${item.number}: changed during evaluation; skipped.`, true)
      continue
    }
    merge(result)
    log(`Merged PR #${result.number} at ${result.headSha}.`)
    break
  }
}

function main() {
  const { apply, repo } = parseOptions(process.argv.slice(2))
  const gh = (args) =>
    JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' }))
  const api = (path) => gh([`repos/${repo}/${path}`])
  const reviewers = (process.env.AUTO_MERGE_REVIEWERS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  const qaReviewers = (process.env.AUTO_MERGE_QA_REVIEWERS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  const config = JSON.parse(
    readFileSync(
      new URL('../../.ai/agentic.config.json', import.meta.url),
      'utf8',
    ),
  )
  if (config.baseBranch !== 'develop')
    throw new Error('Configured base branch is not develop.')
  const prs = gh([`repos/${repo}/pulls?state=open&base=develop&per_page=100`])
  if (prs.length === 100)
    throw new Error('PR page is full; refusing incomplete selection.')
  const inspect = (item) => {
    const pr = api(`pulls/${item.number}`)
    const currentBaseSha = api('branches/develop').commit.sha
    pr.base.sha = currentBaseSha
    const linked = parseCloseLinks(pr)
    const issues = linked.map((number) => api(`issues/${number}`))
    const reviews = api(`pulls/${pr.number}/reviews?per_page=100`)
    const checks = api(
      `commits/${pr.head.sha}/check-runs?per_page=100`,
    ).check_runs
    const qaComments = api(`issues/${pr.number}/comments?per_page=100`)
    const comparison = api(`compare/${currentBaseSha}...${pr.head.sha}`)
    const owner = repo.split('/')[0]
    const name = repo.split('/')[1]
    const query = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewDecision reviewThreads(first:100){nodes{isResolved isOutdated} pageInfo{hasNextPage}}}}}`
    const reviewData = gh([
      'graphql',
      '-f',
      `query=${query}`,
      '-f',
      `owner=${owner}`,
      '-f',
      `name=${name}`,
      '-F',
      `number=${pr.number}`,
    ]).data.repository.pullRequest
    const threadData = reviewData.reviewThreads
    if (
      threadData.pageInfo.hasNextPage ||
      reviews.length === 100 ||
      checks.length === 100 ||
      qaComments.length === 100
    )
      throw new Error(`PR #${pr.number} exceeds the inspection page limit.`)
    const result = decideMerge({
      pr,
      issues,
      reviews,
      checks,
      threads: threadData.nodes,
      comparison,
      qaComments,
      reviewDecision: reviewData.reviewDecision,
      trustedReviewers: reviewers,
      trustedQaReviewers: qaReviewers,
    })
    return result
  }
  runSelection(prs, {
    apply,
    inspect,
    log: (message, error = false) => {
      if (error) {
        console.error(message)
        process.exitCode = 1
      } else console.log(message)
    },
    merge: (result) => {
      const input = JSON.stringify({
        merge_method: 'squash',
        sha: result.headSha,
      })
      const merged = JSON.parse(
        execFileSync(
          'gh',
          [
            'api',
            '-X',
            'PUT',
            `repos/${repo}/pulls/${result.number}/merge`,
            '--input',
            '-',
          ],
          { input, encoding: 'utf8' },
        ),
      )
      if (!merged.merged)
        throw new Error(`GitHub refused PR #${result.number}.`)
    },
  })
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
