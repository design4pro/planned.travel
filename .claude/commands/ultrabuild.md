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
- **Dev server: the reserved port range 3010-3020.** Ports **3010 to 3020 belong to ultrabuild and
  to nothing else**. Everything below 3010 belongs to the developer or to another project — port
  3000 currently serves an unrelated app — so a round never binds there, never probes there and
  never kills there.

  This rule exists because it was learned the hard way: six rounds in a row started a server and
  left it running, because there was no way to tell our process from someone else's and therefore
  no safe way to clean up. A reserved range makes ownership decidable, so cleanup becomes safe.

  Start of round — reclaim the range, then bind one port in it:

  ```
  for p in $(seq 3010 3020); do
    pid=$(lsof -nP -iTCP:$p -sTCP:LISTEN -t 2>/dev/null) && [ -n "$pid" ] && kill $pid
  done
  pnpm exec vite dev --port 3010 --strictPort &
  curl -s -o /dev/null -w '%{http_code}' http://localhost:3010/
  ```

  **Call `vite` directly, never `pnpm dev`.** The `dev` script in `package.json` is
  `vite dev --port 3000`, so `pnpm dev -- --port 3010` passes *two* `--port` flags and Vite keeps
  the first one. This was tried and it bound 3000 — the very port the rule above forbids, which
  happened to be free at that moment. `pnpm exec vite dev` has no baked-in port and honours the
  flag.

  `--strictPort` is not optional either: without it Vite silently walks to the next free port and
  the round loses track of what it bound. If 3010 is genuinely wedged, use 3011, and say which
  port the round is on in your report.

  End of round — kill it, unconditionally, before you write the report:

  ```
  for p in $(seq 3010 3020); do
    pid=$(lsof -nP -iTCP:$p -sTCP:LISTEN -t 2>/dev/null) && [ -n "$pid" ] && kill $pid
  done
  ```

  Every Playwright invocation gets `PLAYWRIGHT_BASE_URL=http://localhost:<the port you bound>`
  passed explicitly. Without it `playwright.config.ts` falls back to `http://localhost:3000`
  (line 10) with `reuseExistingServer` on (line 129), and the gate photographs whatever unrelated
  application happens to be answering there — a green run proving nothing about this repo.
- **Visual verification: Ego Lite first, Playwright for the gate.** `~/.local/bin/ego-browser` is a
  light Chromium built for agents, and the `ego-browser` skill drives it. Use it for the
  look-at-the-screen work inside a round: checking a change rendered, grabbing a screenshot for the
  blind A/B pair, walking a flow by hand. Keep Playwright for what only it does — the committed
  baseline comparison, cross-browser (the config runs desktop Chromium and mobile WebKit), and the
  end-to-end specs. A round that only needs to look at a page does not need Playwright and must not
  start a server for it.
- **Local D1, before the seed.** Every worktree carries its own `.wrangler/state`, so a worktree
  that has not run migrations has an empty database and the seed fails with
  `Failed query: select "id" from "user" …`. Run `pnpm db:migrate:local` first; it is idempotent
  and reports which migrations were already applied. `--local` only ever touches this worktree.
- **Demo data and the demo session.** The authenticated half of the visual gate signs in as
  `rafal@planned.travel`. Run `node scripts/seed/seed.mjs --url http://localhost:<port>` if the
  authenticated specs report themselves as skipped — it provisions the workspace and reconciles the
  account password, and is idempotent, so running it is always safe. Note the seed script's own port
  probe only covers 3000-3005, so pass `--url` explicitly — with the reserved range it will never
  find the port on its own.
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
`pnpm exec playwright test`, running the dev server **on a port in 3010-3020**, killing any
listener **in that range** (it is ours by definition), driving `ego-browser`, taking screenshots,
fetching reference URLs, `wrangler deploy`, `wrangler d1 migrations apply --local|--remote`,
`wrangler versions upload`, `git add|commit|push` (fast-forward), Polar **sandbox** API calls.

Never, under any circumstance, even if a round seems to need it — stop and ask instead:

- `wrangler d1 delete`, `wrangler r2 bucket delete`, `wrangler kv namespace delete`, or any other
  deletion of a Cloudflare resource, remote database or bucket.
- `git push --force`, `git reset --hard` on shared history, `git rebase`/`filter-branch` on `main`,
  or anything that rewrites published commits.
- Polar **production**-mode API calls. Sandbox is fine; production moves real money.
- `pnpm add` / `pnpm remove`, or editing `package.json` or `pnpm-lock.yaml` — `SPEC.md` §3 freezes
  the dependency set. A genuinely missing package is a finding to report, not a thing to install.
  **One standing exception, and it is a list of two names rather than a policy:**
  `@react-email/components` and `react-email` may be installed, in **phase A of the Polar
  migration and in no other round**, because `SPEC.md` §3 admits them by name. Phase A also
  **removes** `stripe` in the same round, since that phase deletes the last code importing it.
  Nothing else is in scope: any other package is still a finding you report and never install.
- Hand-editing `src/routeTree.gen.ts` (run `pnpm generate-routes`).
- Introducing the TREK name, mark, source or assets anywhere in this repo.
