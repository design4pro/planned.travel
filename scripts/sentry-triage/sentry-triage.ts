// Sentry → GitHub issues. Recurring, high-impact errors become `bug` + `priority-high` tickets;
// the cezar `issue-groom` automation picks every new issue up, adds risk and implementation
// notes, and a human decides whether to add `autofix` (ADR 0008 as amended by ADR 0018). This
// routine never applies `autofix`: it has reproduced nothing.
//
//   pnpm sentry-triage                      # report only — files nothing
//   pnpm sentry-triage --file-issues        # also file, capped
//   pnpm sentry-triage --window 14d --max 2
//
// Report-only by default: a manual run must never surprise the operator by writing to the
// backlog. The scheduled workflow (.github/workflows/sentry-triage.yml) passes --file-issues.
//
// Requires the Claude Code CLI on PATH, `gh` signed in, and SENTRY_ACCESS_TOKEN + SENTRY_ORG in
// the environment (see ./README.md). The agent runs on this checkout with the Sentry MCP server
// from ./mcp.json and nothing else attached; it cannot edit files and never commits.
//
// Why the policy lives in ./policy.ts and not in the prompt: see ./README.md.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const HERE = dirname(fileURLToPath(import.meta.url))
const MODEL = 'claude-opus-5'

/** Reports land beside the other run artefacts; `.agent/` is gitignored. */
const REPORT_DIR = '.agent'

/** One run cannot flood the backlog. The auditor's cap is 3 for the same reason. */
const DEFAULT_MAX_FILED = 3

/**
 * The backlog is the scarce resource, and this routine can only add to it. Past this many open
 * high-priority bugs (the shape every Sentry finding has), filing more is not help — every one of
 * them also starts a groom run. This is the brake that matters: the per-run cap is per run, and a
 * misconfigured schedule still runs.
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
  'planned-travel'

const argv = process.argv.slice(2)
const fileIssues = argv.includes('--file-issues')

function flag(name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? fallback : (argv[at + 1] ?? fallback)
}

const windowArg = flag('window', '7d')
const maxFiled = Number(flag('max', String(DEFAULT_MAX_FILED)))
/**
 * A Sentry short id to file even though the policy rejected it.
 *
 * It overrides `selectionVerdict` and nothing else. The agent's veto, the frame-exists check, the
 * dedup index and both caps still apply, because those answer questions of fact - is this a
 * duplicate, does that file exist - that a human naming a ticket has not answered. The thresholds
 * are the only judgement call here, and naming the ticket is how you make it yourself.
 */
const forceAt = argv.indexOf('--force')
const forcedRaw = forceAt === -1 ? '' : (argv[forceAt + 1] ?? '')
// Not `flag()`: its `?? fallback` would turn a bare `--force` into no force at all, and this run
// would sweep as though the flag had never been typed. A malformed override has to be refused, not
// interpreted.
if (forceAt !== -1 && (forcedRaw === '' || forcedRaw.startsWith('--'))) {
  console.error(
    '--force needs a Sentry short id, e.g. --force PLANNED-TRAVEL-1.',
  )
  process.exit(1)
}
const forced = forcedRaw === '' ? undefined : forcedRaw
const runLabel = new Date().toISOString().replace(/[:.]/g, '-')

const gh = (args: ReadonlyArray<string>, input?: string): string =>
  execFileSync('gh', [...args], {
    encoding: 'utf8',
    ...(input === undefined ? {} : { input }),
  })

/**
 * Every `bug` ticket, open and closed, read through the issues API.
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
    'bug',
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
    'bug',
    '--label',
    'priority-high',
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

type Report = ReturnType<typeof reportSchema.parse>

function renderPrompt(tracked: string): string {
  const fill: Record<string, string> = {
    ORG,
    PROJECTS,
    WINDOW: windowArg,
    TRACKED: tracked,
  }
  return readFileSync(join(HERE, 'prompt.md'), 'utf8').replace(
    /\{\{(ORG|PROJECTS|WINDOW|TRACKED)\}\}/g,
    (_, key: string) => fill[key] ?? '',
  )
}

/**
 * One non-interactive Claude Code session on this checkout, read-only by construction: Bash, Edit
 * and Write are removed from the tool set, and `--strict-mcp-config` attaches ./mcp.json alone, so
 * neither a developer's own MCP servers nor a root `.mcp.json` reach a scheduled run.
 */
function survey(prompt: string): Report {
  const run = spawnSync(
    'claude',
    [
      '-p',
      '--model',
      MODEL,
      '--dangerously-skip-permissions',
      '--mcp-config',
      join(HERE, 'mcp.json'),
      '--strict-mcp-config',
      '--disallowedTools',
      'Bash,Edit,Write,NotebookEdit',
      '--output-format',
      'text',
    ],
    {
      input: prompt,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'inherit'],
    },
  )
  if (run.error) throw run.error
  if (run.status !== 0)
    throw new Error(`claude exited with code ${String(run.status)}`)
  const block = /<sentry-triage>([\s\S]*?)<\/sentry-triage>/.exec(run.stdout)
  if (block === null)
    throw new Error(
      'the agent emitted no <sentry-triage> block; nothing was looked at',
    )
  return reportSchema.parse(JSON.parse(block[1]))
}

const tracked = buildTrackedIndex(trackedIssues())
const trackedSummary =
  tracked.size === 0
    ? '(none yet)'
    : [...tracked.keys()].map((shortId) => `- ${shortId}`).join('\n')

const report = survey(renderPrompt(trackedSummary))

if (report.status === 'mcp-unavailable') {
  console.error(
    `Sentry MCP unavailable — nothing was looked at. ${report.notes}`,
  )
  process.exit(1)
}

mkdirSync(REPORT_DIR, { recursive: true })
const reportPath = join(REPORT_DIR, `sentry-triage-${runLabel}.json`)
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

console.log(
  `Scanned ${String(report.scanned.production)} production and ${String(report.scanned.staging)} staging issues over ${report.window}.`,
)
console.log(
  `${String(report.candidates.length)} candidate(s). Report: ${reportPath}`,
)
for (const skip of report.skipped)
  console.log(`  skipped ${skip.shortId}: ${skip.reason}`)

const forcedCandidate =
  forced === undefined
    ? undefined
    : report.candidates.find((c) => c.shortId === forced)

// Loudly, and before the report-only exit: a --force that quietly files nothing is the failure this
// flag exists to avoid. `--force` reaches only into the population the two fixed searches returned,
// so a miss means the ticket is outside --window, is not `is:unresolved`, or is not at error level.
if (forced !== undefined && forcedCandidate === undefined) {
  console.error(
    `\n--force ${forced}: not among this run's candidates. It is only possible to force a ticket the sweep already returned - check --window, and that the issue is unresolved and at error level in Sentry.`,
  )
  process.exit(1)
}

if (report.status === 'no-data') {
  console.log('Sentry reported nothing in the window.')
  process.exit(0)
}

if (!fileIssues) {
  if (forcedCandidate !== undefined) {
    const gate = selectionVerdict(forcedCandidate, Date.now())
    console.log(
      `\n--force ${forcedCandidate.shortId}: ${gate.ok ? 'clears the policy on its own; --force changes nothing for it' : `would be forced past - ${gate.reason}`}`,
    )
    console.log(`\n${renderTitle(forcedCandidate, false)}\n`)
    console.log(
      renderIssueBody({
        candidate: forcedCandidate,
        sequence: 1,
        runLabel,
        reportPath,
        ...(gate.ok ? {} : { forcedReason: gate.reason }),
      }),
    )
  }
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

for (const candidate of filingOrder(report.candidates, forced)) {
  if (filed >= maxFiled) {
    console.log(
      `\nCap of ${String(maxFiled)} reached; the rest are in the report.`,
    )
    break
  }

  const isForced = candidate.shortId === forced
  const gate = selectionVerdict(candidate, now)
  if (!gate.ok && !isForced) {
    console.log(`  ${candidate.shortId}: below the bar — ${gate.reason}`)
    continue
  }
  if (!gate.ok) {
    console.log(
      `  ${candidate.shortId}: forced past the policy — ${gate.reason}`,
    )
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
      // Exactly these two labels and no others: the category and the priority a Sentry finding
      // earns by clearing the threshold. `autofix` is a human's to add, after the groom run has
      // added risk and implementation notes; this routine has reproduced nothing.
      '--label',
      'bug',
      '--label',
      'priority-high',
      '--body-file',
      '-',
    ],
    renderIssueBody({
      candidate,
      sequence: verdict.sequence,
      ...(isRegression ? { previous: verdict.previous } : {}),
      runLabel,
      reportPath,
      // Only when the gate actually rejected it. A forced id that clears the bar on its own earned
      // its place, and saying otherwise on the ticket would misinform the triager.
      ...(gate.ok ? {} : { forcedReason: gate.reason }),
    }),
  )
  filed += 1
  console.log(`  filed: ${title}`)
}

console.log(`\nFiled ${String(filed)} issue(s).`)
