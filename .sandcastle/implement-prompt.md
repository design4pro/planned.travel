# TASK

Implement issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view {{TASK_ID}} --comments`. If it has a parent PRD, pull that in too (`gh issue view <parent>`).

Only work on the issue specified. Respect the issue's **Owned paths** — do not touch files outside them; report discoveries in an issue comment instead.

Work on branch {{BRANCH}}. Make commits and run tests.

# CONTEXT

Read CLAUDE.md first — it holds the commands, layering rules and pointers. Domain vocabulary is in CONTEXT.md; decisions in docs/adr/.

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# EXECUTION

Use RGR (red-green-refactor) at the seams the issue names:

1. RED: write one failing test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

Never hand-edit generated files (`src/routeTree.gen.ts` → `pnpm generate-routes`; `drizzle/` → `pnpm db:generate`).

# FEEDBACK LOOPS

Before committing, run `pnpm typecheck`, `pnpm lint` and `pnpm test` and make them pass.

You do NOT need to run the Playwright suite yourself: after you finish, the orchestrator runs the full deterministic ladder (`validate.sh`) in this sandbox — including e2e against the `-linux` baselines when your diff touches UI — and resumes your session with a failure digest if it is red. If you want an early e2e signal anyway: `bash .sandcastle/setup-e2e.sh --if-needed`, then `PLAYWRIGHT_BASE_URL=http://localhost:3010 pnpm e2e`.

Never run `--update-snapshots` and never edit `e2e/__screenshots__`. If your change intentionally moves pixels, the ISSUE must declare it (a `## Visual change expected` section or the `visual-change-expected` label) — the orchestrator then re-records baselines; an undeclared pixel diff is treated as a regression.

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Include task completed + PRD reference
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
