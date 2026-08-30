---
name: to-tickets-project
description: Break a PRD issue into vertical-slice sub-issues on GitHub with blocking dependencies. Use after /to-spec-project.
disable-model-invocation: true
argument-hint: "<PRD issue number>"
---

Take the PRD issue number the user gives you and break it into independently grabbable tickets.

## Guard

First check `gh api "repos/design4pro/planned.travel/issues/<PRD>/sub_issues" --jq 'length'` — if sub-issues already exist, list them and ask before adding more.

## Slicing rules

- Each slice cuts a narrow but COMPLETE path through every layer it needs (schema → repo → server fn → UI → tests) — vertical, never a horizontal slice of one layer.
- A completed slice is demoable or verifiable on its own.
- Each slice fits one fresh context window.
- Any prefactoring is its own first ticket.
- A sub-issue must not itself need sub-issues.
- **Wide refactors** (a mechanical change fanning across the codebase) are the exception: sequence them expand–contract (add the new form beside the old → migrate call sites in batches, each batch a ticket → delete the old form), never force them into a tracer bullet.

## Ticket body

Every ticket carries, besides its description:

- **Owned paths** — the disjoint set of paths this ticket may touch. Two tickets in the same wave must never share a path.
- **Tenant isolation test** — for any ticket adding a tenant-scoped data path: the isolation case it must add.
- **Verification** — the commands that prove it done (`pnpm typecheck && pnpm lint && pnpm test`; UI slices also note "visual gate runs in CI").
- No `Closes #n` directives — closing is the merger's job.

Quiz the user briefly on the proposed split (order, sizes, anything that looks horizontal) before publishing.

## Publish

Per ticket, in dependency order (sub-issue list order IS execution order):

```bash
gh issue create --title "<slice>" --label "ready-for-agent" --body-file <tmpfile>
ISSUE_ID=$(gh api "repos/design4pro/planned.travel/issues/<child>" --jq '.id')
gh api -X POST "repos/design4pro/planned.travel/issues/<PRD>/sub_issues" -f sub_issue_id="$ISSUE_ID"
```

Add native blocking links between tickets where one requires another's code. Tracker contract: docs/agents/issue-tracker.md.

## Verify the wave

`ready-for-agent` is the loop's gate and it is per-slice: a ticket without it is invisible to
`pnpm sandcastle`, and a PRD whose children all lack it makes `--issues <PRD>` fail outright.
Publishing is not finished until this prints nothing:

```bash
gh api "repos/design4pro/planned.travel/issues/<PRD>/sub_issues" \
  --jq '.[] | select(.state=="open") | select([.labels[].name] | index("ready-for-agent") | not) | "missing ready-for-agent: #\(.number)"'
```

Fix what it names with `gh issue edit <n> <n> ... --add-label "ready-for-agent"`, then run it again.
