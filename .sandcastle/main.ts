// planned.travel AFK loop, pipeline v2:
//   plan → per issue [implement → review → VALIDATE → fix loop] → merge → AUDIT
//
// The green validation path costs zero tokens: validate.sh is a deterministic
// ladder run via sandbox.exec(). The LLM enters only on failure — as the
// RESUMED implementer session (it already holds the context of its own
// decisions), with a bounded fix budget. After each iteration's merge a fresh
// Auditor adversarially re-checks every closed issue's Definition of Done and
// runs the full suite (including full e2e) once — the post-merge safety net
// that lets CI's e2e job run only on develop/main pushes.
//
// Run from an integration branch cut from `develop` (never develop itself):
//   git switch -c sandcastle/run-$(date +%Y%m%d) develop
//   pnpm sandcastle
//
// Requires: Docker running, `sandcastle docker build-image` executed once,
// and the env vars from .env.example.

import { cp, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import * as sandcastle from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { z } from 'zod'

const planSchema = z.object({
  issues: z.array(
    z.object({ id: z.string(), title: z.string(), branch: z.string() }),
  ),
})

const auditSchema = z.object({
  issues: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(['confirmed', 'refuted']),
      reason: z.string(),
    }),
  ),
})

// Maximum number of plan→execute→merge→audit cycles before stopping.
const MAX_ITERATIONS = 10

// Two concurrent issue pipelines: each UI validation runs vite dev + D1/R2
// sims + chromium + webkit inside one container; two is comfortable for an
// OrbStack VM, three risks the machine-load TIMEOUT flakes playwright.config
// documents as false evidence.
const MAX_PARALLEL = 2

// Fix-loop budget: resumes of the implementer session after a validator FAIL.
// Exhausted → the issue is labelled agent-blocked and excluded from the merge.
const FIX_BUDGET = 2

// Models per role (validator has no model — it is a script).
const PLANNER_MODEL = 'claude-opus-5'
const IMPLEMENTER_MODEL = 'claude-opus-5'
const REVIEWER_MODEL = 'claude-opus-5'
const AUDITOR_MODEL = 'claude-opus-5'

// Runs inside the sandbox before each agent starts. Fresh linux install is
// ~13 s; never copy darwin node_modules (10+ min teardown through the mount).
const hooks = {
  sandbox: {
    onSandboxReady: [
      { command: 'pnpm install --frozen-lockfile', timeoutMs: 600_000 },
    ],
  },
}

// .e2e-tiles carries the ~480 MB basemap cache so a sandbox that needs the
// Playwright suite does not re-download it from R2 (see setup-e2e.sh).
const copyToWorktree = ['.e2e-tiles']

const RUN_TS = process.env.SANDCASTLE_RUN_TS ?? String(process.pid)
const ARTIFACT_ROOT = join('.sandcastle', 'logs', `run-${RUN_TS}`)

type Issue = z.infer<typeof planSchema>['issues'][number]
type Validation = {
  uiTouched: boolean
  steps: Array<{ name: string; ok: boolean; durationMs: number }>
  e2e: {
    failed: Array<{ title: string; error: string; snapshotDiff: boolean }>
  }
  ok: boolean
}

/** Tiny inline semaphore — bounds concurrent issue pipelines. */
function createLimiter(limit: number) {
  let active = 0
  const queue: Array<() => void> = []
  return async function limited<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>((r) => queue.push(r))
    active++
    try {
      return await task()
    } finally {
      active--
      queue.shift()?.()
    }
  }
}

const integrationBranch = (await import('node:child_process'))
  .execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' })
  .trim()

async function runPlanner(): Promise<Issue[]> {
  const plan = await sandcastle.run({
    hooks,
    sandbox: docker(),
    name: 'planner',
    maxIterations: 1,
    agent: sandcastle.claudeCode(PLANNER_MODEL),
    promptFile: './.sandcastle/plan-prompt.md',
    output: sandcastle.Output.object({ tag: 'plan', schema: planSchema }),
  })
  return plan.output.issues
}

async function collectArtifacts(
  sandbox: sandcastle.Sandbox,
  issue: Issue,
  attempt: number,
): Promise<string> {
  const dest = join(ARTIFACT_ROOT, `issue-${issue.id}`, `attempt-${attempt}`)
  await mkdir(dest, { recursive: true })
  for (const name of [
    'playwright-report',
    'test-results',
    '.sandcastle-validation.json',
    'dev-server.log',
  ]) {
    await cp(join(sandbox.worktreePath, name), join(dest, name), {
      recursive: true,
      force: true,
    }).catch(() => {})
  }
  return dest
}

async function validate(
  sandbox: sandcastle.Sandbox,
  opts: { updateSnapshots?: boolean } = {},
): Promise<Validation> {
  const flags = ['--json-out .sandcastle-validation.json']
  if (opts.updateSnapshots) flags.push('--update-snapshots')
  const result = await sandbox.exec(
    `TARGET_BRANCH=${integrationBranch} bash .sandcastle/validate.sh ${flags.join(' ')}`,
  )
  const read = await sandbox.exec('cat .sandcastle-validation.json')
  try {
    return JSON.parse(read.stdout) as Validation
  } catch {
    return {
      uiTouched: true,
      steps: [{ name: 'validate.sh', ok: false, durationMs: 0 }],
      e2e: { failed: [] },
      ok: result.exitCode === 0,
    }
  }
}

function failureDigest(v: Validation, attempt: number): string {
  const failedSteps = v.steps.filter((s) => !s.ok).map((s) => s.name)
  const e2eLines = v.e2e.failed
    .map(
      (f) =>
        `- ${f.title}${f.snapshotDiff ? ' [snapshot diff]' : ''}: ${f.error}`,
    )
    .join('\n')
  return [
    `Validation FAILED (attempt ${attempt}/${FIX_BUDGET + 1}).`,
    `Failed steps: ${failedSteps.join(', ') || '(see e2e)'}.`,
    e2eLines ? `Failed e2e specs:\n${e2eLines}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 8_000)
}

/** Does the issue declare an intended visual change? */
async function declaresVisualChange(
  sandbox: sandcastle.Sandbox,
  issue: Issue,
): Promise<boolean> {
  const view = await sandbox.exec(
    `gh issue view ${issue.id} --json body,labels --jq '[(.body // ""), ([.labels[].name] | join(","))] | join("\\n")'`,
  )
  return (
    /visual change expected/i.test(view.stdout) ||
    view.stdout.includes('visual-change-expected')
  )
}

async function markBlocked(
  sandbox: sandcastle.Sandbox,
  issue: Issue,
  digest: string,
  artifactPath: string,
): Promise<void> {
  await sandbox.exec(
    `gh issue edit ${issue.id} --remove-label ready-for-agent --add-label agent-blocked`,
  )
  await sandbox.exec(`gh issue comment ${issue.id} --body-file -`, {
    stdin: [
      `Sandcastle fix budget exhausted (${FIX_BUDGET} resumes). Branch \`${issue.branch}\` holds the accumulated progress and is excluded from this iteration's merge.`,
      '',
      '```',
      digest,
      '```',
      '',
      `Artifacts on the operator host: \`${artifactPath}\``,
    ].join('\n'),
  })
}

async function workIssue(
  issue: Issue,
): Promise<{ issue: Issue; ok: boolean; commits: Array<{ sha: string }> }> {
  const sandbox = await sandcastle.createSandbox({
    branch: issue.branch,
    sandbox: docker(),
    hooks,
    copyToWorktree,
  })

  const commits: Array<{ sha: string }> = []
  let lastArtifactPath = ''
  try {
    let implement = await sandbox.run({
      name: 'implementer',
      maxIterations: 100,
      agent: sandcastle.claudeCode(IMPLEMENTER_MODEL),
      promptFile: './.sandcastle/implement-prompt.md',
      promptArgs: {
        TASK_ID: issue.id,
        ISSUE_TITLE: issue.title,
        BRANCH: issue.branch,
      },
    })
    commits.push(...implement.commits)

    if (commits.length === 0) return { issue, ok: false, commits }

    const review = await sandbox.run({
      name: 'reviewer',
      maxIterations: 1,
      agent: sandcastle.claudeCode(REVIEWER_MODEL),
      promptFile: './.sandcastle/review-prompt.md',
      promptArgs: { BRANCH: issue.branch },
    })
    commits.push(...review.commits)

    for (let attempt = 1; attempt <= FIX_BUDGET + 1; attempt++) {
      let verdict = await validate(sandbox)
      lastArtifactPath = await collectArtifacts(sandbox, issue, attempt)

      if (
        !verdict.ok &&
        verdict.e2e.failed.length > 0 &&
        verdict.e2e.failed.every((f) => f.snapshotDiff) &&
        verdict.steps.filter((s) => !s.ok).every((s) => s.name === 'e2e') &&
        (await declaresVisualChange(sandbox, issue))
      ) {
        // Every failure is a snapshot diff and the issue declares the change:
        // re-record the -linux baselines instead of "fixing" intended pixels.
        console.log(
          `  [${issue.id}] intended visual change — re-recording baselines`,
        )
        await validate(sandbox, { updateSnapshots: true })
        await sandbox.exec(
          `git add e2e/__screenshots__ && git commit -m "RALPH: re-record linux baselines — intended per issue #${issue.id}"`,
        )
        commits.push({ sha: 'baselines' })
        verdict = await validate(sandbox)
        lastArtifactPath = await collectArtifacts(sandbox, issue, attempt)
      }

      if (verdict.ok) return { issue, ok: true, commits }

      if (attempt > FIX_BUDGET) {
        await markBlocked(
          sandbox,
          issue,
          failureDigest(verdict, attempt),
          lastArtifactPath,
        )
        return { issue, ok: false, commits }
      }

      console.log(
        `  [${issue.id}] validation failed — resume fix ${attempt}/${FIX_BUDGET}`,
      )
      if (implement.resume === undefined) {
        await markBlocked(
          sandbox,
          issue,
          'Implementer session not resumable.',
          lastArtifactPath,
        )
        return { issue, ok: false, commits }
      }
      const fixPrompt = (await import('node:fs/promises')).readFile(
        './.sandcastle/fix-prompt.md',
        'utf8',
      )
      implement = await implement.resume(
        (await fixPrompt)
          .replaceAll('{{FAILURE_DIGEST}}', failureDigest(verdict, attempt))
          .replaceAll('{{ATTEMPT}}', String(attempt))
          .replaceAll('{{BUDGET}}', String(FIX_BUDGET)),
      )
      commits.push(...implement.commits)
    }
    return { issue, ok: false, commits }
  } finally {
    await sandbox.close()
  }
}

async function mergeBranches(passing: Array<{ issue: Issue }>): Promise<void> {
  await sandcastle.run({
    hooks,
    sandbox: docker(),
    name: 'merger',
    maxIterations: 1,
    agent: sandcastle.claudeCode(REVIEWER_MODEL),
    promptFile: './.sandcastle/merge-prompt.md',
    promptArgs: {
      BRANCHES: passing.map((p) => `- ${p.issue.branch}`).join('\n'),
      ISSUES: passing
        .map((p) => `- ${p.issue.id}: ${p.issue.title}`)
        .join('\n'),
    },
  })
}

async function runAuditor(closed: Issue[]): Promise<void> {
  const sandbox = await sandcastle.createSandbox({
    branch: integrationBranch,
    sandbox: docker(),
    hooks,
    copyToWorktree,
  })
  try {
    const audit = await sandbox.run({
      name: 'auditor',
      maxIterations: 1,
      agent: sandcastle.claudeCode(AUDITOR_MODEL),
      promptFile: './.sandcastle/audit-prompt.md',
      promptArgs: {
        ISSUES: closed.map((i) => `- ${i.id}: ${i.title}`).join('\n'),
      },
      output: sandcastle.Output.object({ tag: 'audit', schema: auditSchema }),
    })
    for (const finding of audit.output.issues) {
      if (finding.verdict === 'refuted') {
        console.log(`  AUDIT REFUTED #${finding.id}: ${finding.reason}`)
        await sandbox.exec(
          `gh issue reopen ${finding.id} --comment ${JSON.stringify(`Auditor refuted COMPLETE: ${finding.reason}`)}`,
        )
        await sandbox.exec(
          `gh issue edit ${finding.id} --add-label ready-for-agent`,
        )
      }
    }
    await collectArtifacts(
      sandbox,
      { id: 'audit', title: 'audit', branch: integrationBranch },
      1,
    )
  } finally {
    await sandbox.close()
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const limit = createLimiter(MAX_PARALLEL)

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(
    `\n=== Iteration ${iteration}/${MAX_ITERATIONS} (target: ${integrationBranch}) ===\n`,
  )

  const issues = await runPlanner()
  if (issues.length === 0) {
    console.log('No unblocked issues to work on. Exiting.')
    break
  }
  console.log(`Planning complete. ${issues.length} issue(s):`)
  for (const issue of issues)
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`)

  const settled = await Promise.allSettled(
    issues.map((issue) => limit(() => workIssue(issue))),
  )

  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === 'rejected') {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      )
    }
  }

  const passing = settled
    .filter(
      (o): o is PromiseFulfilledResult<Awaited<ReturnType<typeof workIssue>>> =>
        o.status === 'fulfilled' && o.value.ok && o.value.commits.length > 0,
    )
    .map((o) => o.value)

  console.log(
    `\nValidation passed on ${passing.length}/${issues.length} branch(es).`,
  )
  if (passing.length === 0) {
    console.log('Nothing to merge this iteration.')
    continue
  }

  await mergeBranches(passing)
  console.log('Branches merged. Running auditor…')
  await runAuditor(passing.map((p) => p.issue))
}

console.log(`\nAll done. Artifacts under ${ARTIFACT_ROOT}`)
