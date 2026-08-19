---
description: Fan out sub-agents, loop, and adversarially critique until the task meets docs/SPEC.md — deterministic every run
argument-hint: <task description> | resume | status | stop
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Workflow, Skill, ScheduleWakeup, TodoWrite, TaskOutput, WebFetch, mcp__plugin_playwright_playwright__browser_navigate, mcp__plugin_playwright_playwright__browser_take_screenshot, mcp__plugin_playwright_playwright__browser_resize, mcp__plugin_playwright_playwright__browser_snapshot, mcp__plugin_playwright_playwright__browser_console_messages, mcp__plugin_playwright_playwright__browser_evaluate, mcp__plugin_playwright_playwright__browser_close
---

# /ultrabuild — run the standard perfection loop

Task argument: `$ARGUMENTS`

Current run state (empty means no run in progress):

!`cat .claude/ultrabuild/run.json 2>/dev/null || echo '{}'`

Accepted / rejected item tally:

!`test -f .claude/ultrabuild/items.json && node -e 'const s=require("./.claude/ultrabuild/items.json").items||[];const c=s.reduce((a,i)=>((a[i.status]=(a[i.status]||0)+1),a),{});console.log(JSON.stringify(c),"of",s.length)' 2>/dev/null || echo 'no items yet'`

---

You are executing a **fixed protocol**. Run the steps below in order, every time, without
improvising extra phases and without skipping gates. The orchestration itself lives in
`.claude/workflows/ultrabuild.js` — your job is to resolve state, invoke it, persist the result,
and decide whether the loop continues. Do not re-implement the workflow inline.

## Step 0 — Dispatch on the argument

- `status` → print `.claude/ultrabuild/report.md` and stop. Change nothing.
- `stop` → call `ScheduleWakeup({stop: true})`, write `"stoppedByUser": true` into `run.json`, stop.
- `resume` → continue an existing run. If `run.json` is `{}` or missing, **stop and say so**.
  Do not invent a task. Do not guess what the previous run was about.
- anything else → treat it as a new task description.

## Step 1 — Resolve the run

If starting a new task:

- `slug` = the task lowercased, non-alphanumerics collapsed to `-`, truncated to 48 chars.
- If `run.json` exists with a **different** `slug`, move the whole `.claude/ultrabuild/`
  payload to `.claude/ultrabuild/archive/<old-slug>/` first. Never silently overwrite another
  run's state.
- Write `.claude/ultrabuild/run.json`:

```json
{
  "slug": "…",
  "task": "$ARGUMENTS",
  "contractPaths": ["docs/SPEC.md", "docs/DESIGN.md", "docs/ARCHITECTURE.md", "docs/DEPLOY.md"],
  "round": 0,
  "maxRounds": 8,
  "maxItemRounds": 3,
  "dryRounds": 0,
  "looping": false,
  "stoppedByUser": false
}
```

If resuming: read `run.json` and `items.json` as-is. **Do not re-derive the task, do not
re-decompose already-accepted items, do not restate the goal in your own words.** The whole point
of these files is that round 20 pursues the same objective as round 1.

## Step 2 — Load the contract (read, do not paraphrase)

Read `docs/SPEC.md` and `docs/DESIGN.md` every round. Read `docs/ARCHITECTURE.md` when the round
touches data, auth, billing, realtime or scaling; `docs/DEPLOY.md` only when it touches infra.

These files **are** the definition of done:

- `SPEC.md` §1 — clean-room rule. TREK is a feature and data-model reference only. Never copy its
  code, strings or assets; never use the TREK name or mark anywhere in this repo.
- `SPEC.md` §2 — the quality bar. A screen is done only when a blind side-by-side critic
  independently picks ours as the better-looking product. "It works" is not done. "It looks as
  good" is not done.
- `SPEC.md` §3 — pinned stack and **dependency freeze**.
- `SPEC.md` §6 — repo conventions. `SPEC.md` §7 — definition of done.
- `DESIGN.md` — the token contract and the palette.

A round may **extend** the contract (append newly discovered work items). A round may never
**relax** it. If the task genuinely conflicts with the contract, stop and report the conflict
rather than quietly picking a side.

## Step 3 — Preflight

Run these and fix what is trivially fixable before invoking the workflow.

- `node_modules` present and lockfile-consistent → `pnpm install --frozen-lockfile` if not.
- `e2e/visual.spec.ts` present. `playwright.config.ts` points at `./e2e`; without it the mechanical
  gate has nothing to run.
- Playwright browsers present → `pnpm exec playwright install` if a launch fails with
  "Executable doesn't exist". Both `chromium` and `webkit` are needed (the config runs a desktop
  Chromium project and a mobile WebKit one).
- **Dev server, and its base URL.** Start `pnpm dev` in the background if nothing is serving, then
  find the port it actually bound and confirm it answers:

  ```
  lsof -nP -iTCP -sTCP:LISTEN | grep -i node
  curl -s -o /dev/null -w '%{http_code}' http://localhost:<port>/
  ```

  This environment injects an extra `--port` into the dev command, so `pnpm dev` can land on a port
  other than 3000. Do not assume 3000. Export the real one as `PLAYWRIGHT_BASE_URL` for every
  Playwright invocation this round — `playwright.config.ts` then targets it directly and skips its
  own `webServer` block, which otherwise waits on 3000 forever and hangs the whole round.
- **Demo data and the demo session.** The authenticated half of the visual gate signs in as
  `rafal@planned.travel`. Run `node scripts/seed/seed.mjs --url http://localhost:<port>` if the
  authenticated specs report themselves as skipped — it provisions the workspace and reconciles the
  account password, and is idempotent, so running it is always safe. Note the seed script's own port
  probe only covers 3000-3005, so pass `--url` explicitly.
- Baselines: if `e2e/__screenshots__` is empty, seed it once with
  `PLAYWRIGHT_BASE_URL=… pnpm exec playwright test --update-snapshots`. After that **never** pass
  `--update-snapshots` automatically — a gate that rewrites its own baseline cannot fail, and
  accepting a regression as the new truth is the one way this loop can silently ruin the design.
  Re-baseline only for an item the critic has already accepted, and say so in the report.
- `pnpm generate-routes` if route files changed since `src/routeTree.gen.ts` was written.
- Note: `pnpm check` (prettier) is failing repo-wide on ~157 pre-existing files and is deliberately
  **not** part of the gate. Keep the files you touch prettier-clean
  (`pnpm exec prettier --check <paths>`); do not reformat the repo as a side effect of a round.

## Step 4 — Invoke the workflow (this is the sub-agent fan-out)

Call it exactly once per round:

```
Workflow({
  name: "ultrabuild",
  args: {
    task: <run.task>,
    slug: <run.slug>,
    round: <run.round + 1>,
    maxItemRounds: <run.maxItemRounds>,
    onlyItems: <ids of items whose status !== "accepted", or [] on round 1>,
    knownItems: <contents of items.json, or [] on round 1>
  }
})
```

This instruction is your authorisation to use the Workflow tool — the command exists to run it.
On **round 1 only**, print one line first:

> Tip: `/effort ultracode` (or start the session with `claude --effort ultracode`) gives this loop
> xhigh effort plus standing orchestration for the whole session.

The workflow returns `{ items, newFindings, dry }`. It runs in the background; wait for its
notification, then read its result. Do not fabricate its output, and do not run a second round
while one is pending.

## Step 5 — Persist

- `items.json` ← returned `items` (merged over `knownItems` by `id`; accepted items stay accepted
  unless the workflow explicitly reopened them).
- `findings.jsonl` ← append `newFindings`, one JSON object per line.
- `report.md` ← regenerate: task, round, per-item status table, each item's critic verdict and
  A/B winner, open blocking findings, what changed this round.
- `run.json` ← `round += 1`; `dryRounds = newFindings.length === 0 ? dryRounds + 1 : 0`.
- Commit the round's work: `git add -A && git commit` with a message naming the accepted items.
  Skip `git push` when `git remote` is empty (it currently is).

## Step 6 — Loop control (the only decision point)

Evaluate in this order:

1. **Done** — every item `accepted` **and** `dryRounds >= 2` → `ScheduleWakeup({stop: true})`,
   print the final report, say plainly that the gate passed.
2. **Capped** — `round >= maxRounds`, or the token budget is nearly spent → stop the loop and
   report exactly which items are still unaccepted and why. Do not claim success.
3. **Blocked** — a **contract-level** ambiguity only (the spec contradicts itself, or the task
   needs a decision no document authorises). Stop and ask. A failing test, a rejected critic
   verdict, or an ugly screen is **not** blocking — that is the loop's job.
4. **Continue** — otherwise:
   - if `run.looping` is false → `Skill({skill: "loop", args: "/ultrabuild resume"})` and set
     `looping: true`. This arms the self-paced outer loop.
   - if `run.looping` is true → `ScheduleWakeup({delaySeconds: 1200, prompt: "/ultrabuild resume",
     noop: <true only if this round changed nothing at all>, reason: "<n> items still failing the
     gate"})`.

## Step 7 — Report (keep it to ten lines)

Round number, accepted/total, each rejected item with its one-line reason, the critic's A/B
winner per screen, what changed, next action. No preamble, no restating the plan.

---

## Autonomy (granted) and hard limits (never)

Permitted unattended, no confirmation needed: editing source, `pnpm build|typecheck|lint|test`,
`pnpm exec playwright test`, running the dev server, taking screenshots, fetching reference URLs,
`wrangler deploy`, `wrangler d1 migrations apply --local|--remote`, `wrangler versions upload`,
`git add|commit|push` (fast-forward), Stripe **test**-mode calls.

Never, under any circumstance, even if a round seems to need it — stop and ask instead:

- `wrangler d1 delete`, `wrangler r2 bucket delete`, `wrangler kv namespace delete`, or any other
  deletion of a Cloudflare resource, remote database or bucket.
- `git push --force`, `git reset --hard` on shared history, `git rebase`/`filter-branch` on `main`,
  or anything that rewrites published commits.
- Stripe **live**-mode API calls.
- `pnpm add` / `pnpm remove`, or editing `package.json` or `pnpm-lock.yaml` — `SPEC.md` §3 freezes
  the dependency set. A genuinely missing package is a finding to report, not a thing to install.
- Hand-editing `src/routeTree.gen.ts` (run `pnpm generate-routes`).
- Introducing the TREK name, mark, source or assets anywhere in this repo.
