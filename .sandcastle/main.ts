// planned.travel AFK loop, pipeline v2:
//   plan → per issue [implement → review → VALIDATE → fix loop → DEEP-REVIEW]
//        → merge → AUDIT
//
// The green validation path costs zero tokens: validate.sh is a deterministic
// ladder run via sandbox.exec(). The LLM enters only on failure — as the
// RESUMED implementer session (it already holds the context of its own
// decisions), with a bounded fix budget. After each iteration's merge a fresh
// Auditor adversarially re-checks every closed issue's Definition of Done and
// runs the full suite (including full e2e) once — the post-merge safety net
// that lets CI's e2e job run only on develop/main pushes.
//
// Two advisory passes run after a green validation and never block a merge: the
// deep review (structural code quality — read-only, so it cannot break the
// parallel-branch or Owned-paths model) and, on UI diffs, the blind A/B
// pixel-critic. SANDCASTLE_DEEP_REVIEW=0 skips the former.
//
// Run from anywhere: the integration branch `sandcastle/run-<date>-<n>` is cut
// from `origin/develop` (or resumed, when the same run number is given again)
// inside its own git worktree under `.sandcastle/worktrees/` — the operator's
// checkout is never switched and stays usable while the loop runs:
//   pnpm sandcastle                            # the next free run for today
//   pnpm sandcastle --run 2 --issues 101,102   # resume run 2, only those issues
//
// The run number is what makes two loops concurrent: it scopes the integration
// branch, the issue branches (`sandcastle/issue-<id>-<date>-<n>`), the artifact
// directory and the lock, so nothing is shared but the repo. `--issues` is how
// the operator partitions the backlog — both planners otherwise pick the same
// `ready-for-agent` issues and implement them twice. Same number = same run =
// resume; a new number is a run that shares nothing.
//
// Requires: Docker running, `sandcastle docker build-image` executed once,
// and the env vars from .env.example.

import { execSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import * as sandcastle from '@ai-hero/sandcastle'
import { z } from 'zod'

import { docker } from './sandbox'

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

const captureSchema = z.object({
  captured: z.boolean(),
  pairs: z
    .array(z.object({ viewport: z.string(), theme: z.string() }))
    .default([]),
  consoleErrors: z.array(z.string()).default([]),
  skippedReason: z.string().default(''),
})

// Structural findings from the advisory deep-review stage. Report-only: the
// stage never edits, so a finding may name code outside the issue's Owned paths.
const deepReviewSchema = z.object({
  verdict: z.enum(['clean', 'concerns']),
  findings: z
    .array(
      z.object({
        severity: z.enum(['blocker', 'strong', 'minor']),
        title: z.string(),
        summary: z.string(),
        files: z.array(z.string()).default([]),
        remedy: z.string().default(''),
      }),
    )
    .default([]),
})

const visualSchema = z.object({
  winner: z.enum(['A', 'B', 'tie']),
  findings: z
    .array(
      z.object({
        label: z.enum(['A', 'B']),
        summary: z.string(),
        severity: z.enum(['major', 'minor']),
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
const CRITIC_MODEL = 'claude-opus-5'
const DEEP_REVIEW_MODEL = 'claude-opus-5'

// The deep review is one extra agent run per issue on top of implementer,
// reviewer and the fix budget. Set SANDCASTLE_DEEP_REVIEW=0 to skip it.
const DEEP_REVIEW = process.env.SANDCASTLE_DEEP_REVIEW !== '0'

// Runs inside the sandbox before each agent starts. Fresh linux install is
// ~13 s; never copy darwin node_modules (10+ min teardown through the mount).
const hooks = {
  sandbox: {
    onSandboxReady: [
      { command: 'pnpm install --frozen-lockfile', timeoutMs: 600_000 },
    ],
  },
}

const argv = process.argv.slice(2)

/** `--name value`, the flag idiom this repo already uses (sentry-triage.ts). */
function flag(name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? fallback : (argv[at + 1] ?? fallback)
}

// Local calendar date, like the manual `date +%Y%m%d` this replaces — a UTC
// date would cut a fresh branch on a same-local-day rerun straddling UTC
// midnight, stranding the accumulated progress it exists to resume.
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`

/**
 * Run numbers already cut today. `integration.close()` deliberately keeps the
 * branch behind, so this is a record of what has EXISTED today, not of what is
 * running — which is exactly what "give me a number nobody has used" needs.
 */
function runNumbersToday(): number[] {
  const listed = execSync(
    `git branch --list 'sandcastle/run-${today}-*' --format='%(refname:short)'`,
    { encoding: 'utf8' },
  )
  return listed
    .split('\n')
    .map((branch) => /-(\d+)$/.exec(branch.trim())?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)
    .sort((a, b) => a - b)
}

// The run number partitions a day into independent runs, so two loops can work
// the backlog side by side without sharing a branch, a worktree or an artifact
// directory. With no `--run` one is allocated: a bare `pnpm sandcastle` is
// always a NEW run that shares nothing. Resuming is therefore always deliberate
// (`--run N`), which is why the banner below prints the numbers already on disk
// — that is where the operator reads them off. Empty means "allocate one".
const REQUESTED_RUN = flag('run', process.env.SANDCASTLE_RUN ?? '')
if (REQUESTED_RUN !== '' && !/^[1-9][0-9]*$/.test(REQUESTED_RUN)) {
  throw new Error(
    `--run takes a positive integer (got ${JSON.stringify(REQUESTED_RUN)}). Example: pnpm sandcastle --run 2`,
  )
}

/** Is that pid still alive? Signal 0 delivers nothing; it only asks. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Claiming the run number and locking it is one step, because the lock is the
// only thing that distinguishes a run to resume from a run already in flight:
// the lib reuses a managed worktree whose branch matches — that is what makes a
// resume work — and never asks whether another process is still inside it. Two
// fleets in one worktree would commit over each other in silence.
//
// The lock lives under the gitignored artifact root, so it can never dirty a
// worktree and trigger the lib's preserve-on-dirty path. A crashed run leaves
// its pid behind; a dead pid is not a conflict, so a crash costs the operator
// nothing — the next run takes the lock and resumes.
const takenToday = runNumbersToday()
let candidate =
  REQUESTED_RUN === '' ? String((takenToday.at(-1) ?? 0) + 1) : REQUESTED_RUN
let runId = ''
let lockPath = ''
for (;;) {
  runId = `${today}-${candidate}`
  lockPath = join('.sandcastle', 'logs', `run-${runId}`, 'run.lock')
  const holder = await readFile(lockPath, 'utf8').catch(() => '')
  if (holder === '' || !isAlive(Number(holder))) break
  if (REQUESTED_RUN !== '') {
    throw new Error(
      `sandcastle run ${runId} is already live in process ${holder}. Start an ` +
        `independent run with \`pnpm sandcastle\`, or delete ${lockPath} if you are ` +
        `certain that process is gone.`,
    )
  }
  // Auto-allocated: two runs launched together read the same free number before
  // either takes its lock, so walk to the next one rather than making the
  // operator stagger the launches.
  candidate = String(Number(candidate) + 1)
}
const RUN_NUMBER = candidate
// Everything a run owns is keyed on this: its integration branch, its issue
// branches, its artifacts and its lock. Same id = same run = resume; a new id is
// a run that shares nothing with the others.
const RUN_ID = runId

// How the operator partitions the backlog between concurrent runs. Without it
// both planners read the same `ready-for-agent` list and two fleets implement
// the same issues twice — the filter is what makes "independent runs" true.
const ONLY_ISSUES = flag('issues', '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

// Keyed on the run, not the process: a resumed run writes into the same tree and
// overwrites the `issue-<id>/attempt-<n>` slots it re-runs (cp with force). That
// is the right trade — the slot describes an attempt this invocation superseded
// — and it keeps one directory per run to hand to a PR reader.
const ARTIFACT_ROOT = join('.sandcastle', 'logs', `run-${RUN_ID}`)
await mkdir(ARTIFACT_ROOT, { recursive: true })
await writeFile(lockPath, String(process.pid))

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
// checked out. On a rerun with the SAME `--run` number the branch already
// exists, `baseBranch` is ignored (the lib's contract) and the existing
// worktree is reused, so accumulated issue-branch progress survives. The lib
// only refuses when the branch is checked out in a worktree OUTSIDE
// `.sandcastle/worktrees/`; inside it, it reuses silently — hence the lock
// above. The fetch is ours: createWorktree documents that callers keep the
// base ref current.
try {
  execSync('git fetch origin develop', { stdio: 'inherit' })
} catch {
  // `refs/remotes/origin/develop` is the one piece of operator-repo state two
  // concurrent runs both write, and losing its lock for a few ms would abort a
  // run at startup. One retry covers that; a second failure is a real problem
  // and should surface.
  execSync('git fetch origin develop', { stdio: 'inherit' })
}

const integration = await sandcastle.createWorktree({
  branchStrategy: {
    type: 'branch',
    branch: `sandcastle/run-${RUN_ID}`,
    baseBranch: 'origin/develop',
  },
  // Every run/createSandbox below anchors at this worktree, and the anchor
  // resolves `copyToWorktree` sources against it — so this gitignored input
  // must travel into the worktree at creation. The ~480 MB e2e basemap used to
  // ride along here; it is a bind-mount from .sandcastle/sandbox now.
  copyToWorktree: ['.sandcastle/.env'],
})
const integrationBranch = integration.branch
const integrationCwd = integration.worktreePath
console.log(
  `sandcastle: run ${RUN_ID} — integration branch ${integrationBranch} in worktree ${integrationCwd}`,
)
// The only place the operator learns which runs exist, and so the only way
// `--run N` is discoverable at the moment it is needed: to resume a run rather
// than start yet another one.
const otherRuns = takenToday.filter((n) => String(n) !== RUN_NUMBER)
if (otherRuns.length > 0) {
  console.log(
    `  today's other runs: ${otherRuns.join(', ')} — resume one with \`pnpm sandcastle --run ${otherRuns[0]}\``,
  )
}

/**
 * What the planner is allowed to look at. Concurrent runs read the same
 * `ready-for-agent` list, so partitioning the backlog is the operator's job and
 * this is the only place it is expressed — the planner is told, never guesses.
 */
function planScope(): string {
  return ONLY_ISSUES.length === 0
    ? 'Consider every issue listed above.'
    : `Consider ONLY these issues: ${ONLY_ISSUES.map((id) => `#${id}`).join(', ')}. Ignore every other issue, even an unblocked one — another sandcastle run owns it.`
}

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
    promptArgs: { RUN_ID, SCOPE: planScope() },
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
    '.sandcastle-visual.json',
    '.sandcastle-deep-review.json',
    '.sandcastle-shots',
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

/**
 * Advisory deep-review pass, run after a green validation: a fresh agent judges
 * how the change is STRUCTURED (code judo, file-size crossings, spaghetti
 * growth, canonical layer, type boundaries, thin abstractions, seams) rather
 * than whether it works — the ladder settled that. Read-only by construction:
 * the loop merges two issue branches in parallel and the auditor treats work
 * outside an issue's Owned paths as a violation, so this stage reports and
 * never edits. The findings land as an issue comment plus
 * `.sandcastle-deep-review.json` in the artifacts, and a single `blocker`
 * becomes a `status: pending` ticket so it does not evaporate. It NEVER blocks
 * the merge, so every failure path here only logs.
 */
async function runDeepReview(
  sandbox: sandcastle.Sandbox,
  issue: Issue,
): Promise<void> {
  try {
    const run = await sandbox.run({
      name: 'deep-reviewer',
      maxIterations: 1,
      agent: sandcastle.claudeCode(DEEP_REVIEW_MODEL),
      promptFile: './.sandcastle/deep-review-prompt.md',
      promptArgs: { BRANCH: issue.branch },
    })
    const raw = run.stdout.match(/<deep-review>([\s\S]*?)<\/deep-review>/)?.[1]
    if (raw === undefined) {
      console.log(
        `  [${issue.id}] deep-review: no <deep-review> block — skipped`,
      )
      return
    }
    const report = deepReviewSchema.parse(JSON.parse(raw))
    await sandbox.exec('cat > .sandcastle-deep-review.json', {
      stdin: JSON.stringify(report, null, 2),
    })

    const bySeverity = (s: string) =>
      report.findings.filter((f) => f.severity === s)
    console.log(
      `  [${issue.id}] deep-review (advisory): ${report.verdict} — ${bySeverity('blocker').length} blocker, ${bySeverity('strong').length} strong, ${bySeverity('minor').length} minor`,
    )

    await sandbox.exec(`gh issue comment ${issue.id} --body-file -`, {
      stdin: [
        `Sandcastle deep-review (advisory, structural): **${report.verdict}**.`,
        '',
        ...(report.findings.length > 0
          ? report.findings.map((f) =>
              [
                `- **[${f.severity}] ${f.title}**`,
                `  ${f.summary}`,
                ...(f.files.length > 0
                  ? [`  Files: ${f.files.map((p) => `\`${p}\``).join(', ')}`]
                  : []),
                ...(f.remedy ? [`  Remedy: ${f.remedy}`] : []),
              ].join('\n'),
            )
          : ['No structural findings.']),
        '',
        'Full report is in the run artifacts (`.sandcastle-deep-review.json`). This gate does not block the merge.',
      ].join('\n'),
    })

    // One blocker becomes a ticket so the highest-conviction structural finding
    // survives past the comment. Capped at one per issue — the backlog is the
    // scarce resource here.
    //
    // `type: enhancement`, NOT the auditor's `type: maintenance`: pre-triage
    // sweeps `type: bug` and `type: maintenance` (TRIGGER_LABELS in triage.ts)
    // and can promote a confirmed finding straight to `ready-for-agent`. That
    // is right for an auditor's reproducible defect and wrong for a structural
    // opinion, which no grep can confirm. `type: enhancement` is the label this
    // repo already uses for taste findings (docs/agents/triage-labels.md), so
    // these wait for a human running `/triage`.
    const blocker = bySeverity('blocker')[0]
    if (blocker !== undefined) {
      const existing = await sandbox.exec(
        `gh issue list --state open --search ${JSON.stringify(blocker.title)} --json number --jq 'length'`,
      )
      if (existing.stdout.trim() !== '0') {
        console.log(
          `  [${issue.id}] deep-review blocker already filed: ${blocker.title}`,
        )
        return
      }
      console.log(
        `  [${issue.id}] deep-review blocker → issue: ${blocker.title}`,
      )
      await sandbox.exec(
        `gh issue create --title ${JSON.stringify(blocker.title)} --label "type: enhancement" --label "status: pending" --body-file -`,
        {
          stdin: [
            blocker.summary,
            '',
            ...(blocker.files.length > 0
              ? [
                  `Files: ${blocker.files.map((p) => `\`${p}\``).join(', ')}`,
                  '',
                ]
              : []),
            ...(blocker.remedy
              ? [`Suggested direction: ${blocker.remedy}`, '']
              : []),
            '---',
            `_Filed by the sandcastle deep-review (run ${RUN_ID}) while reviewing #${issue.id}._`,
          ].join('\n'),
        },
      )
    }
  } catch (error) {
    console.log(
      `  [${issue.id}] deep-review: errored — ${error instanceof Error ? error.message : String(error)} (advisory, continuing)`,
    )
  }
}

/**
 * Advisory pixel-critic pass, run only after a green validation of a
 * UI-touching branch: a neutral capture agent photographs our screen (dev
 * server on :3010, still warm from the e2e run) and the reference demo as a
 * blind A/B pair, then a blind critic names the better-looking product. The
 * verdict lands as an issue comment plus `.sandcastle-visual.json` in the
 * artifacts — it NEVER blocks the merge, so every failure path here only logs.
 */
async function runPixelCritic(
  sandbox: sandcastle.Sandbox,
  issue: Issue,
): Promise<void> {
  try {
    const shotsDir = `.sandcastle-shots/issue-${issue.id}`
    // Deterministic blind order: the capture agent knows the mapping, the
    // critic and its prompt never see it.
    const oursLabel = Number.parseInt(issue.id, 10) % 2 === 0 ? 'A' : 'B'
    const refLabel = oursLabel === 'A' ? 'B' : 'A'

    const capture = await sandbox.run({
      name: 'pixel-capture',
      maxIterations: 1,
      agent: sandcastle.claudeCode(CRITIC_MODEL),
      promptFile: './.sandcastle/pixel-capture-prompt.md',
      promptArgs: {
        TASK_ID: issue.id,
        ISSUE_TITLE: issue.title,
        SHOTS_DIR: shotsDir,
        OURS_LABEL: oursLabel,
        REF_LABEL: refLabel,
      },
    })
    const capRaw = capture.stdout.match(/<capture>([\s\S]*?)<\/capture>/)?.[1]
    if (capRaw === undefined) {
      console.log(`  [${issue.id}] pixel-critic: no <capture> block — skipped`)
      return
    }
    const cap = captureSchema.parse(JSON.parse(capRaw))
    if (!cap.captured || cap.pairs.length === 0) {
      console.log(
        `  [${issue.id}] pixel-critic: capture skipped — ${cap.skippedReason || 'no pairs'}`,
      )
      return
    }

    const critic = await sandbox.run({
      name: 'pixel-critic',
      maxIterations: 1,
      agent: sandcastle.claudeCode(CRITIC_MODEL),
      promptFile: './.sandcastle/pixel-critic-prompt.md',
      promptArgs: {
        TASK_ID: issue.id,
        ISSUE_TITLE: issue.title,
        SHOTS_DIR: shotsDir,
      },
    })
    const visRaw = critic.stdout.match(/<visual>([\s\S]*?)<\/visual>/)?.[1]
    if (visRaw === undefined) {
      console.log(`  [${issue.id}] pixel-critic: no <visual> block — skipped`)
      return
    }
    const verdict = visualSchema.parse(JSON.parse(visRaw))

    const oursVerdict =
      verdict.winner === 'tie'
        ? 'tie'
        : verdict.winner === oursLabel
          ? 'won'
          : 'lost'
    const oursFindings = verdict.findings.filter((f) => f.label === oursLabel)
    await sandbox.exec('cat > .sandcastle-visual.json', {
      stdin: JSON.stringify({ oursLabel, oursVerdict, ...verdict }, null, 2),
    })
    console.log(
      `  [${issue.id}] pixel-critic (advisory): ours ${oursVerdict}, ${oursFindings.length} finding(s) against us`,
    )
    await sandbox.exec(`gh issue comment ${issue.id} --body-file -`, {
      stdin: [
        `Sandcastle pixel-critic (advisory, blind A/B vs the reference): **ours ${oursVerdict}**.`,
        '',
        ...(oursFindings.length > 0
          ? [
              'Findings against our side:',
              ...oursFindings.map((f) => `- [${f.severity}] ${f.summary}`),
            ]
          : ['No findings against our side.']),
        '',
        'Frames and full verdict are in the run artifacts (`.sandcastle-shots/`, `.sandcastle-visual.json`). This gate does not block the merge.',
      ].join('\n'),
    })
  } catch (error) {
    console.log(
      `  [${issue.id}] pixel-critic: errored — ${error instanceof Error ? error.message : String(error)} (advisory, continuing)`,
    )
  }
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

      if (verdict.ok) {
        if (DEEP_REVIEW) await runDeepReview(sandbox, issue)
        if (verdict.uiTouched) await runPixelCritic(sandbox, issue)
        if (DEEP_REVIEW || verdict.uiTouched) {
          // Re-collect: the advisory passes added .sandcastle-deep-review.json,
          // .sandcastle-shots and the visual verdict.
          await collectArtifacts(sandbox, issue, attempt)
        }
        return { issue, ok: true, commits }
      }

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
      const fixPrompt = readFile('./.sandcastle/fix-prompt.md', 'utf8')
      implement = await implement.resume(
        (await fixPrompt)
          .replaceAll('{{FAILURE_DIGEST}}', failureDigest(verdict, attempt))
          .replaceAll('{{ATTEMPT}}', String(attempt))
          .replaceAll('{{BUDGET}}', String(FIX_BUDGET)),
        // sandcastle 0.12.0 bug: resume() spreads the original run options and
        // clears promptFile but NOT promptArgs, and an inline prompt with
        // promptArgs is rejected (PromptError). Empty override passes.
        { promptArgs: {} },
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
  //
  // Keyed on the PID rather than the run id, and that is deliberate:
  // createSandbox checks an EXISTING branch out at its own tip instead of
  // re-cutting it, so a run-id-keyed audit branch would, on a resumed run, audit
  // the tree the previous invocation left rather than this HEAD — silently
  // gutting the one adversarial gate. Uniqueness per INVOCATION is what this
  // name needs.
  const sandbox = await sandcastle.createSandbox({
    branch: `sandcastle/audit-${process.pid}-i${iteration}`,
    sandbox: docker(),
    cwd: integrationCwd,
    hooks,
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
    // `ready-for-agent` from here. Pre-triage (.github/workflows/triage.yml on
    // the `opened` event, or `pnpm sandcastle:triage`) reproduces each one at
    // HEAD and promotes only a confirmed, unambiguous finding — ADR 0006; the
    // rest waits for a human. Capped and title-deduped.
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
          stdin: `${followUp.body}\n\n---\n_Filed by the sandcastle auditor (run ${RUN_ID}, iteration ${iteration}) while auditing: ${closed.map((i) => `#${i.id}`).join(', ')}._`,
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
      `Sandcastle run \`${RUN_ID}\` completed cleanly: every issue below was implemented, reviewed, validated by the deterministic ladder (typecheck · lint · vitest · e2e when UI-touched) inside the CI-identical sandbox, merged, and confirmed by the adversarial auditor (full ladder incl. full e2e).`,
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
    `gh pr create --draft --base develop --head ${integrationBranch} --title ${JSON.stringify(`sandcastle: ${merged.map((i) => `#${i.id}`).join(', ')} — run ${RUN_ID}`)} --body-file ${JSON.stringify(bodyPath)}`,
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
await rm(lockPath, { force: true })

console.log(`\nAll done. Artifacts under ${ARTIFACT_ROOT}`)
