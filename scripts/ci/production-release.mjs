import { execFileSync } from 'node:child_process'
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rollbackDecision } from './release-policy.mjs'
import { prepareRevert } from './revert-release.mjs'

const run = (command, args, input) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    input,
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  }).trim()
const gh = (args, data) =>
  JSON.parse(
    run(
      'gh',
      [...args, ...(data ? ['--input', '-'] : [])],
      data && JSON.stringify(data),
    ),
  )
const repo = process.env.GITHUB_REPOSITORY
const sha = process.env.GITHUB_SHA
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !/^[a-f0-9]{40}$/.test(sha ?? ''))
  throw new Error('Invalid release identity')
const root = `repos/${repo}`
const title = '[release incident] Production releases paused'
const open = () =>
  gh(['api', '--paginate', '--slurp', `${root}/issues?state=open&per_page=100`])
    .flat()
    .find((issue) => !issue.pull_request && issue.title === title)
const mode = process.argv[2]
if (mode === 'before') {
  if (open())
    throw new Error('Resolve the production incident before another deployment')
  const artifacts = gh([
    'api',
    '--paginate',
    '--slurp',
    `${root}/actions/artifacts?name=production-healthy&per_page=100`,
  ])
    .flatMap((page) => page.artifacts)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  let healthy = null
  for (const artifact of artifacts) {
    if (artifact.expired || artifact.workflow_run?.head_sha === sha) continue
    const workflow = gh([
      'api',
      `${root}/actions/runs/${artifact.workflow_run.id}`,
    ])
    if (
      workflow.path !== '.github/workflows/ci.yml' ||
      workflow.conclusion !== 'success' ||
      workflow.head_branch !== 'main' ||
      workflow.event !== 'push'
    )
      continue
    const scratch = mkdtempSync(join(tmpdir(), 'healthy-release-'))
    try {
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
      healthy = JSON.parse(
        readFileSync(join(scratch, 'release-smoke.json'), 'utf8'),
      )
      if (
        healthy.sha !== workflow.head_sha ||
        healthy.smoke !== true ||
        !healthy.version
      )
        throw new Error('Invalid healthy receipt')
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
    break
  }
  writeFileSync('previous-release.json', JSON.stringify(healthy))
} else if (mode === 'failed') {
  if (open())
    throw new Error('Incident already recorded; rollback cannot repeat')
  const healthy = existsSync('previous-release.json')
    ? JSON.parse(readFileSync('previous-release.json', 'utf8'))
    : null
  const changed = healthy
    ? run('git', [
        'diff',
        '--name-only',
        healthy.sha,
        sha,
        '--',
        'drizzle',
        'src/server/db',
        'wrangler.jsonc',
      ])
    : 'unknown'
  let failed = null
  try {
    const response = await fetch(`${process.env.SMOKE_URL}/api/version`, {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID ?? '',
        'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET ?? '',
      },
    })
    const version = await response.json()
    if (response.ok && version.sha === sha && version.id)
      failed = { version: version.id }
  } catch {
    /* An unknown deployment cannot authorize rollback. */
  }
  const allowed = rollbackDecision({
    healthy,
    failed,
    schemaCompatible: changed === '',
    attempted: false,
  })
  // Persist the attempt before touching traffic; a crash cannot cause a second automatic rollback.
  const incident = gh(['api', '-X', 'POST', `${root}/issues`], {
    title,
    body: `Production verification failed at ${sha}.\n\nAutomatic rollback attempted: ${allowed}.\nLast verified healthy version: ${healthy?.version ?? 'unknown'}.\n\nRelease lock: keep this issue open until a repair or revert PR has merged and staging is verified; an operator then closes it for a monitored production release. A Worker rollback does not revert main or the database.\n\nRun: https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  })
  if (!allowed)
    throw new Error('No compatible healthy version; manual recovery required')
  run('pnpm', [
    'exec',
    'wrangler',
    'rollback',
    healthy.version,
    '--yes',
    '--message',
    `Automatic recovery of ${sha}; releases locked`,
  ])
  process.env.EXPECTED_SHA = healthy.sha
  execFileSync(process.execPath, ['scripts/ci/release-smoke.mjs'], {
    stdio: 'inherit',
    env: process.env,
    timeout: 120_000,
  })
  const repair = prepareRevert({
    repo,
    healthy: healthy.sha,
    failed: sha,
    incident: incident.number,
  })
  gh(['api', '-X', 'POST', `${root}/issues/${incident.number}/comments`], {
    body: `Rollback verified. Review the repair draft: ${repair}. Keep this incident open until recovery is complete.`,
  })
} else throw new Error('Expected before or failed')
