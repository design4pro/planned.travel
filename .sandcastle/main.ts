// planned.travel AFK loop — plan → execute (+review) → merge, on GitHub Issues.
//
// Adapted from the sandcastle "parallel-planner-with-review" template:
//   Phase 1 (Plan):             The planner reads open GitHub issues, builds a
//                               dependency graph and outputs a <plan> JSON of
//                               unblocked issues with deterministic branches.
//   Phase 2 (Execute + Review): Per issue, one Docker sandbox: implementer
//                               first; if it commits, a reviewer runs in the
//                               same sandbox. Pipelines run concurrently.
//   Phase 3 (Merge):            One agent merges completed branches into the
//                               current branch and closes the issues.
//
// Run it from an integration branch cut from `develop` (never from develop
// itself): after the loop, open a PR to develop — CI runs the full gate there,
// including the visual e2e suite.
//
//   git switch -c sandcastle/run-$(date +%Y%m%d) develop
//   pnpm sandcastle
//
// Requires: Docker running, `sandcastle docker build-image` executed once,
// and the env vars from .env.example.

import * as sandcastle from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { z } from 'zod'

const planSchema = z.object({
  issues: z.array(
    z.object({ id: z.string(), title: z.string(), branch: z.string() }),
  ),
})

// Maximum number of plan→execute→merge cycles before stopping.
const MAX_ITERATIONS = 10

// Models per role. Planning and implementation follow the reference setup
// (mattpocock/course-video-manager) and use Opus; a cheaper implementer is a
// cost knob, not the default.
const PLANNER_MODEL = 'claude-opus-5'
const IMPLEMENTER_MODEL = 'claude-opus-5'
const REVIEWER_MODEL = 'claude-opus-5'

// Runs inside the sandbox before each agent starts. The first install over
// the copied darwin node_modules fetches linux binaries — well past the 60 s
// default hook timeout.
const hooks = {
  sandbox: {
    onSandboxReady: [
      { command: 'pnpm install --frozen-lockfile', timeoutMs: 600_000 },
    ],
  },
}

// Copy node_modules from the host into the worktree before each sandbox
// starts; the install hook above reconciles platform-specific binaries.
// .e2e-tiles carries the ~480 MB basemap cache so a sandbox that needs the
// Playwright suite does not re-download it from R2 (see setup-e2e.sh).
const copyToWorktree = ['node_modules', '.e2e-tiles']

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`)

  const plan = await sandcastle.run({
    hooks,
    sandbox: docker(),
    name: 'planner',
    // One iteration: the planner reads and reasons, it does not write code.
    maxIterations: 1,
    agent: sandcastle.claudeCode(PLANNER_MODEL),
    promptFile: './.sandcastle/plan-prompt.md',
    output: sandcastle.Output.object({ tag: 'plan', schema: planSchema }),
  })

  const issues = plan.output.issues

  if (issues.length === 0) {
    console.log('No unblocked issues to work on. Exiting.')
    break
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) to work in parallel:`,
  )
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`)
  }

  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: docker(),
        hooks,
        copyToWorktree,
      })

      try {
        const implement = await sandbox.run({
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

        // Only review if the implementer produced commits.
        if (implement.commits.length > 0) {
          const review = await sandbox.run({
            name: 'reviewer',
            maxIterations: 1,
            agent: sandcastle.claudeCode(REVIEWER_MODEL),
            promptFile: './.sandcastle/review-prompt.md',
            promptArgs: {
              BRANCH: issue.branch,
            },
          })

          return {
            ...review,
            commits: [...implement.commits, ...review.commits],
          }
        }

        return implement
      } finally {
        await sandbox.close()
      }
    }),
  )

  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === 'rejected') {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      )
    }
  }

  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === 'fulfilled' &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue)

  const completedBranches = completedIssues.map((i) => i.branch)

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits:`,
  )
  for (const branch of completedBranches) {
    console.log(`  ${branch}`)
  }

  if (completedBranches.length === 0) {
    console.log('No commits produced. Nothing to merge.')
    continue
  }

  await sandcastle.run({
    hooks,
    sandbox: docker(),
    name: 'merger',
    maxIterations: 1,
    agent: sandcastle.claudeCode(REVIEWER_MODEL),
    promptFile: './.sandcastle/merge-prompt.md',
    promptArgs: {
      BRANCHES: completedBranches.map((b) => `- ${b}`).join('\n'),
      ISSUES: completedIssues.map((i) => `- ${i.id}: ${i.title}`).join('\n'),
    },
  })

  console.log('\nBranches merged.')
}

console.log('\nAll done.')
