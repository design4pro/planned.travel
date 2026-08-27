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
// Run from anywhere: the integration branch `sandcastle/run-<date>` is cut
// from `origin/develop` (or resumed, on a same-day rerun) inside its own git
// worktree under `.sandcastle/worktrees/` — the operator's checkout is never
// switched and stays usable while the loop runs:
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
  // Incidental findings OUTSIDE the audited DoDs — coverage gaps, adjacent
  // debt. They become triage tickets (status: pending), never reopens.
  followUps: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
        kind: z.enum(['bug', 'maintenance']),
      }),
    )
    .default([]),
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

// The integration branch lives in its own git worktree (sandcastle's
// createWorktree), so nothing here ever switches the operator's checkout —
// which is also what keeps ADR 0003 honoured mechanically: the branch is
// always cut from `origin/develop`, whatever the operator happens to have
// checked out. On a same-day rerun the branch already exists, `baseBranch`
// is ignored (the lib's contract) and the existing worktree is reused, so
// accumulated issue-branch progress survives. The lib refuses cleanly if
// the branch is checked out elsewhere. The fetch is ours: createWorktree
// documents that callers keep the base ref current.
const { execSync } = await import('node:child_process')
execSync('git fetch origin develop', { stdio: 'inherit' })
// Local calendar date, like the manual `date +%Y%m%d` this replaces — a UTC
// date would cut a fresh branch on a same-local-day rerun straddling UTC
// midnight, stranding the accumulated progress it exists to resume.
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
const integration = await sandcastle.createWorktree({
  branchStrategy: {
    type: 'branch',
    branch: `sandcastle/run-${today}`,
    baseBranch: 'origin/develop',
  },
  // Every run/createSandbox below anchors at this worktree, and the anchor
  // resolves `.sandcastle/.env` and `copyToWorktree` sources against it — so
  // the two gitignored inputs must travel into the worktree at creation.
  copyToWorktree: ['.sandcastle/.env', ...copyToWorktree],
})
const integrationBranch = integration.branch
const integrationCwd = integration.worktreePath
console.log(
  `sandcastle: integration branch ${integrationBranch} in worktree ${integrationCwd}`,
)

async function runPlanner(): Promise<Issue[]> {
  const plan = await sandcastle.run({
    // No install hook: the planner only reads issues via gh. And NEVER the
    // default 'head' strategy — it bind-mounts the host working directory,
    // where an install hook would grind through the darwin node_modules
    // (measured: 10+ min vs 13 s fresh) and could corrupt them.
    sandbox: docker(),
    cwd: integrationCwd,
    branchStrategy: { type: 'merge-to-head' },
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
    cwd: integrationCwd,
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
    cwd: integrationCwd,
    // Temp branch off HEAD; the agent merges issue branches into it, then
    // sandcastle merges the temp branch back to HEAD. Same net effect as
    // 'head', but the container never installs over the host node_modules.
    branchStrategy: { type: 'merge-to-head' },
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

async function runAuditor(
  closed: Issue[],
  iteration: number,
): Promise<{ refuted: number }> {
  // A throwaway branch off HEAD (post-merge state): git refuses to check the
  // integration branch out into a second worktree while this one holds it.
  // The audit is read-only, so the branch is never merged anywhere.
  const sandbox = await sandcastle.createSandbox({
    branch: `sandcastle/audit-${RUN_TS}-i${iteration}`,
    sandbox: docker(),
    cwd: integrationCwd,
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
    })
    // sandbox.run() has no `output` option (only top-level run() does) —
    // extract and validate the <audit> block from stdout by hand.
    const raw = audit.stdout.match(/<audit>([\s\S]*?)<\/audit>/)?.[1]
    if (raw === undefined) {
      console.error(
        '  AUDIT: no <audit> block in auditor output — treating as inconclusive, nothing reopened.',
      )
      // Inconclusive blocks the auto-PR: an unverified merge is not clean.
      return { refuted: 1 }
    }
    const verdicts = auditSchema.parse(JSON.parse(raw))
    for (const finding of verdicts.issues) {
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
    // Incidental findings become triage tickets — `status: pending`, never
    // `ready-for-agent`: a human promotes them, so the loop cannot generate
    // and consume its own work unsupervised. Capped and title-deduped.
    for (const followUp of verdicts.followUps.slice(0, 3)) {
      const existing = await sandbox.exec(
        `gh issue list --state open --search ${JSON.stringify(followUp.title)} --json number --jq 'length'`,
      )
      if (existing.stdout.trim() !== '0') {
        console.log(`  AUDIT FOLLOW-UP already filed: ${followUp.title}`)
        continue
      }
      console.log(`  AUDIT FOLLOW-UP → issue: ${followUp.title}`)
      await sandbox.exec(
        `gh issue create --title ${JSON.stringify(followUp.title)} --label ${JSON.stringify(`type: ${followUp.kind}`)} --label "status: pending" --body-file -`,
        {
          stdin: `${followUp.body}\n\n---\n_Filed by the sandcastle auditor (run ${RUN_TS}, iteration ${iteration}) while auditing: ${closed.map((i) => `#${i.id}`).join(', ')}._`,
        },
      )
    }
    await collectArtifacts(
      sandbox,
      { id: 'audit', title: 'audit', branch: integrationBranch },
      1,
    )
    return {
      refuted: verdicts.issues.filter((f) => f.verdict === 'refuted').length,
    }
  } finally {
    await sandbox.close()
  }
}

/**
 * Open the human-review gate: push the integration branch and create a DRAFT
 * PR to develop. Runs only when the run is clean — at least one merged issue
 * and zero refuted verdicts in the final audit. Creating the PR is mechanical;
 * reviewing and merging it stays human (ADR 0003).
 */
async function openIntegrationPr(merged: Issue[]): Promise<void> {
  const { execSync } = await import('node:child_process')
  const { writeFile } = await import('node:fs/promises')
  execSync(`git push -u origin ${integrationBranch}`, { stdio: 'inherit' })
  const existing = execSync(
    `gh pr list --head ${integrationBranch} --state open --json number --jq 'length'`,
    { encoding: 'utf8' },
  ).trim()
  if (existing !== '0') {
    console.log(
      `PR for ${integrationBranch} already open — pushed new commits to it.`,
    )
    return
  }
  const bodyPath = join(ARTIFACT_ROOT, 'pr-body.md')
  await writeFile(
    bodyPath,
    [
      `Sandcastle run \`${RUN_TS}\` completed cleanly: every issue below was implemented, reviewed, validated by the deterministic ladder (typecheck · lint · vitest · e2e when UI-touched) inside the CI-identical sandbox, merged, and confirmed by the adversarial auditor (full ladder incl. full e2e).`,
      '',
      '## Issues completed',
      ...merged.map((i) => `- #${i.id} — ${i.title}`),
      '',
      `Artifacts (playwright reports, validation verdicts) on the operator host under \`${ARTIFACT_ROOT}\`.`,
      '',
      '_Draft on purpose: review, then mark ready and merge — the human gate of ADR 0003._',
    ].join('\n'),
  )
  execSync(
    `gh pr create --draft --base develop --head ${integrationBranch} --title ${JSON.stringify(`sandcastle: ${merged.map((i) => `#${i.id}`).join(', ')} — run ${RUN_TS}`)} --body-file ${JSON.stringify(bodyPath)}`,
    { stdio: 'inherit' },
  )
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const limit = createLimiter(MAX_PARALLEL)
const mergedAll: Issue[] = []
let lastAuditRefuted = 0

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
  mergedAll.push(...passing.map((p) => p.issue))
  console.log('Branches merged. Running auditor…')
  const audit = await runAuditor(
    passing.map((p) => p.issue),
    iteration,
  )
  lastAuditRefuted = audit.refuted
}

if (mergedAll.length > 0 && lastAuditRefuted === 0) {
  console.log(
    '\nRun is clean (merges present, final audit confirmed) — opening the draft PR to develop.',
  )
  await openIntegrationPr(mergedAll)
} else if (mergedAll.length > 0) {
  console.log(
    `\nNOT opening a PR: the final audit left ${lastAuditRefuted} refuted verdict(s) unresolved (iteration cap reached). Review ${integrationBranch} by hand.`,
  )
}

// Remove the integration worktree; the branch (and any open PR on it)
// survives. close() preserves a dirty worktree, and a crashed run leaves one
// behind — either way the next run reuses it (measured: createWorktree logs
// "Reusing existing worktree" for a matching branch).
await integration.close()

console.log(`\nAll done. Artifacts under ${ARTIFACT_ROOT}`)
