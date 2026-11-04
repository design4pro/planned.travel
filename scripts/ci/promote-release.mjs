import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPrState } from '../../.ai/scripts/pr-state.mjs'
import {
  promotionDecision,
  releaseApproved,
  promotionCi,
} from './release-policy.mjs'

const run = (command, args) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
const gh = (args) => JSON.parse(run('gh', args))
const repo = process.env.GITHUB_REPOSITORY
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? ''))
  throw new Error('Invalid repository')
const root = `repos/${repo}`
const incident = gh([
  'api',
  '--paginate',
  '--slurp',
  `${root}/issues?state=open&per_page=100`,
])
  .flat()
  .some(
    (issue) =>
      !issue.pull_request &&
      issue.title === '[release incident] Production releases paused',
  )
if (incident) throw new Error('Production incident blocks promotion')
const sha = gh(['api', `${root}/commits/develop`]).sha
const promotions = gh([
  'api',
  '--paginate',
  '--slurp',
  `${root}/pulls?state=open&base=main&head=${repo.split('/')[0]}:develop&per_page=100`,
]).flat()
if (promotions.length !== 1)
  throw new Error('Expected one develop to main promotion')
const pr = promotions[0]
if (pr.head.sha !== sha) throw new Error('Promotion head changed')
const ci = readPrState(repo, pr.number, gh)
const files = run('git', [
  'diff',
  '--no-renames',
  '--name-only',
  'origin/main',
  sha,
])
  .split('\n')
  .filter(Boolean)
if (
  run('git', ['merge-tree', '--write-tree', 'origin/main', sha]).split(
    '\n',
  )[0] !== run('git', ['rev-parse', `${sha}^{tree}`])
)
  throw new Error('Promotion tree differs from observed staging')
const commits = run('git', ['rev-list', `origin/main..${sha}`])
  .split('\n')
  .filter(Boolean)
const prs = commits.flatMap((commit) => {
  const linked = gh([
    'api',
    '--paginate',
    '--slurp',
    `${root}/commits/${commit}/pulls?per_page=100`,
  ])
    .flat()
    .filter((p) => p.merged_at && p.base.ref === 'develop')
  return linked.length
    ? linked.map((p) => ({ known: true, labels: p.labels.map((l) => l.name) }))
    : [{ known: false, labels: [] }]
})
const reviews = gh([
  'api',
  '--paginate',
  '--slurp',
  `${root}/pulls/${pr.number}/reviews?per_page=100`,
]).flat()
const trusted = JSON.parse(
  readFileSync('.ai/agentic.config.json'),
).trustedAuthors
const comments = gh([
  'api',
  '--paginate',
  '--slurp',
  `${root}/issues/${pr.number}/comments?per_page=100`,
]).flat()
const approved = releaseApproved(reviews, comments, trusted, sha)
const artifacts = gh([
  'api',
  '--paginate',
  '--slurp',
  `${root}/actions/artifacts?name=staging-evidence-${sha}&per_page=100`,
])
  .flatMap((page) => page.artifacts)
  .filter((a) => !a.expired && a.workflow_run?.head_sha === sha)
if (!artifacts.length) throw new Error('No staging receipt')
const scratch = mkdtempSync(join(tmpdir(), 'release-evidence-'))
try {
  const artifact = artifacts[0]
  const workflow = gh([
    'api',
    `${root}/actions/runs/${artifact.workflow_run.id}`,
  ])
  if (
    workflow.conclusion !== 'success' ||
    workflow.head_branch !== 'develop' ||
    workflow.event !== 'push' ||
    workflow.path !== '.github/workflows/ci.yml'
  )
    throw new Error('Untrusted staging receipt producer')
  run('gh', [
    'run',
    'download',
    String(artifact.workflow_run.id),
    '--repo',
    repo,
    '--name',
    artifact.name,
    '--dir',
    scratch,
  ])
  const staging = JSON.parse(
    readFileSync(join(scratch, 'release-smoke.json'), 'utf8'),
  )
  const reason = promotionDecision({
    sha,
    staging,
    ci: promotionCi(workflow, sha, ci.ci),
    files,
    prs,
    approved,
    incident: process.env.RELEASE_INCIDENT === 'true',
  })
  if (reason) throw new Error(reason)
  if (
    ci.blockingLabels.some((label) => label !== 'do-not-merge') ||
    ci.review === 'changes-requested' ||
    ci.draft
  )
    throw new Error('Promotion is held')
  if (gh(['api', `${root}/commits/develop`]).sha !== sha)
    throw new Error('Develop advanced; restart observation')
  if (process.argv.includes('--apply'))
    run('gh', [
      'pr',
      'merge',
      String(pr.number),
      '--repo',
      repo,
      '--merge',
      '--match-head-commit',
      sha,
    ])
  console.log(
    JSON.stringify({
      outcome: process.argv.includes('--apply')
        ? 'promotion-requested'
        : 'verified',
      sha,
      pr: pr.number,
    }),
  )
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
