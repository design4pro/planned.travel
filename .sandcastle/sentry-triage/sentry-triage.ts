// Sentry → GitHub issues. Recurring, high-impact errors become `type: bug` + `status: pending`
// tickets, which is exactly what .github/workflows/triage.yml fires on — so a finding is verified
// at HEAD and promoted, or not, by the machinery that already exists (ADR 0006). This routine never
// applies `ready-for-agent`: it has reproduced nothing, and promotion is earned by a reproduction.
//
//   pnpm sandcastle:sentry                      # report only — files nothing
//   pnpm sandcastle:sentry --file-issues        # also file, capped
//   pnpm sandcastle:sentry --window 14d --max 2
//   pnpm sandcastle:sentry --ci                 # noSandbox(); the CI runner is already disposable
//
// Report-only by default for the reason architecture-review.ts gives: a manual run must never
// surprise the operator by writing to the backlog. The scheduled workflow passes --file-issues.
//
// Requires: Docker running, `sandcastle docker build-image` executed once, and the Sentry keys in
// .sandcastle/.env (see .env.example — a commented-out line there is *not* forwarded).
//
// Why the policy lives in ./policy.ts and not in the prompt: see ./README.md.

import { execFileSync } from 'node:child_process'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import * as sandcastle from '@ai-hero/sandcastle'
import { noSandbox } from '@ai-hero/sandcastle/sandboxes/no-sandbox'

import { docker } from '../sandbox'
import {
  buildTrackedIndex,
  dedupeVerdict,
  filingOrder,
  renderIssueBody,
  renderTitle,
  reportSchema,
  selectionVerdict,
} from './policy'

import type { Candidate, TrackedIssue } from './policy'

const MODEL = 'claude-opus-5'

/** One run cannot flood the backlog. The auditor's cap is 3 for the same reason. */
const DEFAULT_MAX_FILED = 3

/**
 * The backlog is the scarce resource, and this routine can only add to it. Past this many untriaged
 * bugs, filing more is not help — every one of them also starts a triage run. This is the brake that
 * matters: the per-run cap is per run, and a misconfigured schedule still runs.
 */
const BACKLOG_PRESSURE_LIMIT = 10

// `SENTRY_ORG` / `SENTRY_PROJECT` are the conventional names, and the ones @sentry/vite-plugin and
// sentry-cli already read from the environment for the source-map upload. The `_SLUG` variants exist
// because the MCP server takes an `--organization-slug` flag and this routine can sweep more than
// one project; both are accepted so a machine that configured the build does not have to configure
// a second, near-identical pair of names to run the sweep.
const ORG = process.env.SENTRY_ORG_SLUG ?? process.env.SENTRY_ORG ?? ''
const PROJECTS =
  process.env.SENTRY_PROJECT_SLUGS ??
  process.env.SENTRY_PROJECT ??
  'plannedtravel'

const argv = process.argv.slice(2)
const fileIssues = argv.includes('--file-issues')
const ci = argv.includes('--ci')

function flag(name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? fallback : (argv[at + 1] ?? fallback)
}

const windowArg = flag('window', '7d')
const maxFiled = Number(flag('max', String(DEFAULT_MAX_FILED)))
const runLabel = new Date().toISOString().replace(/[:.]/g, '-')

const gh = (args: ReadonlyArray<string>, input?: string): string =>
  execFileSync('gh', [...args], {
    encoding: 'utf8',
    ...(input === undefined ? {} : { input }),
  })

/**
 * Every `type: bug` ticket, open and closed, read through the issues API.
 *
 * `--state all` is not optional: a closed ticket means the bug was fixed, and re-filing it silently
 * would be this routine's worst failure. Nor is the choice of API — `--search` goes through
 * GitHub's search index, which lags by seconds to minutes, so two runs close together would each
 * see nothing and file the same ticket twice.
 */
function trackedIssues(): ReadonlyArray<TrackedIssue> {
  const raw = gh([
    'issue',
    'list',
    '--state',
    'all',
    '--label',
    'type: bug',
    '--limit',
    '500',
    '--json',
    'number,state,closedAt,body',
  ])
  const rows = JSON.parse(raw) as Array<{
    number: number
    state: string
    closedAt: string | null
    body: string | null
  }>
  return rows.map((row) => ({
    number: row.number,
    state: row.state === 'OPEN' ? 'OPEN' : 'CLOSED',
    closedAt: row.closedAt,
    body: row.body ?? '',
  }))
}

function openUntriagedBugs(): number {
  const raw = gh([
    'issue',
    'list',
    '--state',
    'open',
    '--label',
    'type: bug',
    '--label',
    'status: pending',
    '--json',
    'number',
  ])
  return (JSON.parse(raw) as Array<unknown>).length
}

/**
 * The hallucination guard the prompt cannot enforce on itself.
 *
 * The agent is told to Read the file before reporting a frame; this checks the claim independently
 * against the host checkout, because a confident pointer at a file that does not exist sends the
 * triager somewhere real code never was.
 */
function frameExists(candidate: Candidate): boolean {
  const frame = candidate.inAppFrame
  if (frame === null) return false
  if (!existsSync(frame.file)) return false
  return readFileSync(frame.file, 'utf8').split('\n').length >= frame.line
}

const tracked = buildTrackedIndex(trackedIssues())
const trackedSummary =
  tracked.size === 0
    ? '(none yet)'
    : [...tracked.keys()].map((shortId) => `- ${shortId}`).join('\n')

const result = await sandcastle.run({
  sandbox: ci ? noSandbox() : docker(),
  // Never the default 'head' strategy off CI: it bind-mounts the host checkout and the install hook
  // would grind through a darwin node_modules. On the runner the checkout is already disposable.
  branchStrategy: ci
    ? 'head'
    : {
        type: 'branch',
        branch: `sandcastle/sentry-${runLabel}`,
        baseBranch: 'origin/develop',
      },
  name: 'sentry-triage',
  maxIterations: 1,
  agent: sandcastle.claudeCode(MODEL, {
    // noSandbox() does not pass the AFK permission flag, so a CI run would otherwise stall waiting
    // for a tool approval nobody is there to give.
    ...(ci ? { permissionMode: 'bypassPermissions' as const } : {}),
  }),
  promptFile: './.sandcastle/sentry-triage/prompt.md',
  promptArgs: {
    ORG: ORG,
    PROJECTS: PROJECTS,
    WINDOW: windowArg,
    TRACKED: trackedSummary,
  },
  hooks: {
    // Places the Sentry MCP server in the agent's cwd. A hook rather than `copyToWorktree`, which
    // preserves relative paths and so cannot rename a file into the worktree root. See ./README.md
    // for why this is not a committed root-level .mcp.json.
    host: {
      onWorktreeReady: [
        { command: 'cp .sandcastle/sentry-triage/mcp.json .mcp.json' },
      ],
    },
    sandbox: {
      onSandboxReady: [
        { command: 'cp .sandcastle/sentry-triage/mcp.json .mcp.json' },
        { command: 'pnpm install --frozen-lockfile', timeoutMs: 600_000 },
      ],
    },
  },
  copyToWorktree: ci ? undefined : ['.sandcastle/.env'],
  output: sandcastle.Output.object({
    tag: 'sentry-triage',
    schema: reportSchema,
  }),
  // The MCP server is a long-lived child process that inherits the agent's stdout.
  completionTimeoutSeconds: 90,
  idleTimeoutSeconds: 900,
})

const report = result.output

if (report.status === 'mcp-unavailable') {
  console.error(
    `Sentry MCP unavailable — nothing was looked at. ${report.notes}`,
  )
  process.exit(1)
}

const logDir = join('.sandcastle', 'logs')
mkdirSync(logDir, { recursive: true })
const reportPath = join(logDir, `sentry-triage-${runLabel}.md`)
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

console.log(
  `Scanned ${String(report.scanned.production)} production and ${String(report.scanned.staging)} staging issues over ${report.window}.`,
)
console.log(
  `${String(report.candidates.length)} candidate(s). Report: ${reportPath}`,
)
for (const skip of report.skipped)
  console.log(`  skipped ${skip.shortId}: ${skip.reason}`)

if (report.status === 'no-data') {
  console.log('Sentry reported nothing in the window.')
  process.exit(0)
}

if (!fileIssues) {
  console.log(
    '\nReport-only. Pass --file-issues to file the qualifying candidates for triage.',
  )
  process.exit(0)
}

const pressure = openUntriagedBugs()
if (pressure >= BACKLOG_PRESSURE_LIMIT) {
  console.log(
    `\n${String(pressure)} untriaged bugs are already open (limit ${String(BACKLOG_PRESSURE_LIMIT)}). Filing nothing.`,
  )
  process.exit(0)
}

const now = Date.now()
let filed = 0

for (const candidate of filingOrder(report.candidates)) {
  if (filed >= maxFiled) {
    console.log(
      `\nCap of ${String(maxFiled)} reached; the rest are in the report.`,
    )
    break
  }

  const gate = selectionVerdict(candidate, now)
  if (!gate.ok) {
    console.log(`  ${candidate.shortId}: below the bar — ${gate.reason}`)
    continue
  }
  // The agent may only veto. It cannot promote what the gate rejected.
  if (candidate.judgement === 'noise') {
    console.log(
      `  ${candidate.shortId}: vetoed by the agent — ${candidate.judgementReason}`,
    )
    continue
  }
  if (!frameExists(candidate)) {
    console.warn(
      `  ${candidate.shortId}: claimed frame ${candidate.inAppFrame?.file ?? '?'} does not exist at HEAD — not filed.`,
    )
    continue
  }

  const verdict = dedupeVerdict(candidate, tracked)
  if (verdict.action === 'skip') {
    console.log(`  ${candidate.shortId}: ${verdict.reason}`)
    continue
  }

  const isRegression = verdict.action === 'file-regression'
  const title = renderTitle(candidate, isRegression)
  gh(
    [
      'issue',
      'create',
      '--title',
      title,
      // Exactly these two labels and no others: the pair triage.yml fires on. `ready-for-agent` is
      // ADR 0006's to apply, after a reproduction this routine has not performed.
      '--label',
      'type: bug',
      '--label',
      'status: pending',
      '--body-file',
      '-',
    ],
    renderIssueBody({
      candidate,
      sequence: verdict.sequence,
      ...(isRegression ? { previous: verdict.previous } : {}),
      runLabel,
      reportPath,
    }),
  )
  filed += 1
  console.log(`  filed: ${title}`)
}

console.log(`\nFiled ${String(filed)} issue(s).`)
