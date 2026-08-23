---
description: Fan out sub-agents, loop, and adversarially critique until the task meets docs/SPEC.md — deterministic every run
argument-hint: <task description> | resume | status | stop
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Workflow, Skill, ScheduleWakeup, TodoWrite, TaskOutput, WebFetch, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_resize, mcp__playwright__browser_snapshot, mcp__playwright__browser_console_messages, mcp__playwright__browser_evaluate, mcp__playwright__browser_close
---

# /ultrabuild — run the standard perfection loop

Task argument: `$ARGUMENTS`

Current run state (empty means no run in progress):

!`cat .claude/ultrabuild/run.json 2>/dev/null || echo '{}'`

Accepted / rejected item tally:

!`test -f .claude/ultrabuild/items.json && node -e 'const s=require("./.claude/ultrabuild/items.json").items||[];const c=s.reduce((a,i)=>((a[i.status]=(a[i.status]||0)+1),a),{});console.log(JSON.stringify(c),"of",s.length)' 2>/dev/null || echo 'no items yet'`

Carried knowledge (tracked in git, survives archiving):

!`node -e 'const r=(f)=>{try{return require("./.claude/ultrabuild/knowledge/"+f).length}catch(e){return 0}};console.log(r("facts.json"),"facts ·",r("refuted.json"),"refuted claims ·",r("backlog.json"),"backlog items")'`

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
- If `run.json` exists with a **different** `slug`, move the run's payload to
  `.claude/ultrabuild/archive/<old-slug>/` first — `run.json`, `items.json`, `findings.jsonl`,
  `report.md`, `extensions.json`, `shots/`, `recon/`. Never silently overwrite another run's state.
  **`knowledge/` does not move.** It is the only thing that crosses runs, and it is why the second
  run does not rediscover the first one's environment.
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

### `task` is the user's words and does not grow

A previous run's `task` reached 10 KB because every fact the loop established was appended to it as
prose — verified facts, a port policy, a capture rule, a scope note. That blob then went into the
recon and decompose prompt of every subsequent round, and it did not survive archiving, so the next
run began by rediscovering all of it.

Established knowledge goes to `.claude/ultrabuild/knowledge/` instead, and the workflow injects it
scoped to the agents it applies to:

- **`facts.json`** — something you MEASURED that a later agent would otherwise measure again.
  `{id, claim, evidence, measuredIn, scope[], invalidatesWhen}`. `scope` is any of `builder`,
  `capture`, `critic`, `auditor`, `mechanical`.
- **`refuted.json`** — a claim investigated and found wrong, so it is not filed a fourth time.
  `{id, claim, why, cost, blindSafe, scope[]}`. Set `blindSafe: true` only when the wording cannot
  reveal which side of the blind pair is ours; only those reach the critic.
- **`backlog.json`** — work deliberately deferred, with the diagnosis that produced it.

Write to these when a round settles something. Never write a product decision here — that is the
user's call, not a fact.

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
- **Dev server, and its base URL.** One command owns this:

  ```
  PORT=$(scripts/ultrabuild/resolve-port.sh --start)
  ```

  It reuses the lowest port in 3000-3010 that identifies as this app by its own `/api/dev/seed`
  endpoint, and starts exactly one server only if none does. Do not probe by hand and do not assume
  3000 — on this machine it has belonged to an unrelated project. Export the resolved port as
  `PLAYWRIGHT_BASE_URL` for every Playwright invocation this round, or `playwright.config.ts` waits
  on 3000 forever and hangs the round.
- **Demo data and the demo session.** The authenticated half of the visual gate signs in as
  `rafal@planned.travel`. Run `node scripts/seed/seed.mjs --url http://localhost:$PORT` if the
  authenticated specs report themselves as skipped — it provisions the workspace and reconciles the
  account password, and is idempotent, so running it is always safe. Note the seed script's own port
  probe only covers 3000-3005, so pass `--url` explicitly.

  Then refresh the cached session, because a stale one does not fail — it redirects, and the capture
  files a picture of the login screen:

  ```
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  ```
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

First compute what the workflow cannot compute for itself. It runs in a sandbox with **no
filesystem**, so every file it needs is handed in through `args`.

**Recon cache.** Four high-effort readers run per round. Across twelve rounds of one run the
contract reader read 68 KB of documents twelve times for an answer that never changed. Hash each
reader's inputs and reuse any cached result whose hash still matches:

```
CONTRACT_HASH=$(git hash-object docs/SPEC.md docs/DESIGN.md docs/ARCHITECTURE.md docs/DEPLOY.md | tr -d '\n')
STACK_HASH=$(git hash-object package.json pnpm-lock.yaml | tr -d '\n')
CODEBASE_HASH=$(git rev-parse HEAD)
REFERENCE_HASH=<run.slug>
```

For each reader, if `.claude/ultrabuild/recon/<key>.json` exists and its `hash` equals the hash
above, put its `result` into `args.recon[<key>]`. Otherwise leave it out — the workflow will run
that reader and hand the fresh result back. Pass all four hashes as `args.reconHashes` either way.

**Item hashes.** So an item whose files did not move is not re-photographed:

```
git hash-object <each item's ownedPaths, expanded> | tr -d '\n'
```

one combined hash per item, into `args.itemHashes` keyed by item id. Skip a path that does not exist.

**Priority.** Name the items that unblock the round in `args.priorityItems` — above all, any item
that is the reason the mechanical gate is red. Alphabetical order used to decide this, and it cost
four rounds: the one item that could turn the gate green sorted last and was deferred twice while
every other item was failed for its redness.

Then call it exactly once per round:

```
Workflow({
  name: "ultrabuild",
  args: {
    task: <run.task>,
    slug: <run.slug>,
    round: <run.round + 1>,
    maxItemRounds: <run.maxItemRounds>,
    onlyItems: <ids of items whose status is "rejected" or "pending", or [] on round 1>,
    knownItems: <contents of items.json, or [] on round 1>,
    facts:    <.claude/ultrabuild/knowledge/facts.json>,
    refuted:  <.claude/ultrabuild/knowledge/refuted.json>,
    backlog:  <.claude/ultrabuild/knowledge/backlog.json>,
    recon: <cached reader results that are still valid>,
    reconHashes: { contract, stack, codebase, reference },
    itemHashes: <id -> combined hash of its ownedPaths>,
    priorityItems: <ids that unblock the round>
  }
})
```

An item at `accepted-pending-gate` is **not** in `onlyItems`: both its lenses passed it and only the
repo gate stands between it and acceptance. Rebuilding it is how finished work got rebuilt for
someone else's failing test across eight rounds.

This instruction is your authorisation to use the Workflow tool — the command exists to run it.
On **round 1 only**, print one line first:

> Tip: `/effort ultracode` (or start the session with `claude --effort ultracode`) gives this loop
> xhigh effort plus standing orchestration for the whole session.

The workflow returns `{ items, newFindings, dry }`. It runs in the background; wait for its
notification, then read its result. Do not fabricate its output, and do not run a second round
while one is pending.

## Step 5 — Persist

- `items.json` ← returned `items` (merged over `knownItems` by `id`; accepted items stay accepted
  unless the workflow explicitly reopened them). **Store state, not evidence.** Keep each item's
  fields plus `findings` as `{fingerprint, severity, file, line, summary}` — drop `allFindings`,
  every `evidence` string, and `contractExtensions`. The evidence lives in `findings.jsonl` and the
  extensions in `extensions.json`; carrying both again here is what took `items.json` to 188 KB, all
  of which travelled back into the workflow's `args` every round.
- Record `hashAtVerdict` on each item the workflow judged this round: the same combined
  `git hash-object` over its `ownedPaths`, taken **after** the round's edits. That is what lets the
  next round skip re-photographing an item nobody touched.
- `findings.jsonl` ← append `newFindings`, one JSON object per line.
- Close what got fixed: for each entry in `resolvedFindings`, drop that fingerprint from its item's
  carried `findings`. A finding used to stay on the list until a round happened not to mention it,
  so builders were handed problems they had already solved.
- `knowledge/facts.json` ← fold in `learnedFacts`. Give each a stable `id` and `measuredIn`, and
  drop any that duplicates an existing claim or that is a defect rather than a measurement.
- `recon/<key>.json` ← for each key in the returned `recon`, write `{hash, result}` verbatim.
- `report.md` ← regenerate: task, round, per-item status table, each item's critic verdict and
  A/B winner, open blocking findings, what changed this round. State `accepted-pending-gate`
  distinctly from `rejected`: the first means done and waiting on the repo, the second means the
  item's own work failed.
- `run.json` ← `round += 1`; `dryRounds = newFindings.length === 0 ? dryRounds + 1 : 0`. Do not
  append prose to `task` — see Step 1.
- Commit the round's work: `git add -A && git commit` with a message naming the accepted items.
  Skip `git push` when `git remote` is empty (it currently is).

## Step 6 — Loop control (the only decision point)

Evaluate in this order:

1. **Done** — every item `accepted` **and** `dryRounds >= 2` → `ScheduleWakeup({stop: true})`,
   print the final report, say plainly that the gate passed. An item at `accepted-pending-gate` is
   not done: a green repo is exactly what it is waiting for, so if the gate is green and one is
   still pending, run one more round to convert it rather than reporting it as a failure.
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
