# 0025. The agent layer is vendored; agent-kit is retired

Status: accepted
Date: 2026-09-20
Supersedes: ADR 0024 (the kit distributes the agent layer, and a kit-owned fix is an issue in the kit).
Amends: ADR 0021 (decision 1: the gate loses its first command), ADR 0018 (`guard-generated.sh`
keeps three of its four tiers; tier 3, and only tier 3, goes), ADR 0023 (the host runbook moved to
`design4pro/cezar`), ADR 0003 (its consequences call `guard-generated.sh` the thing that keeps
`om-approve-merge-pr/SKILL.md` outside an agent run's reach; that is now true under
`GITHUB_ACTIONS` only).

## Context

ADR 0024 was accepted earlier the same day, and everything it measured is still true. What it
decided was a cheaper way to **pay** the cost of the kit, not that the cost was worth paying.

Its own numbers: `design4pro/agent-kit` rendered 51 files into this repository and into
`money-tracker.online`, `kitVersion` moved from 1 to 48 in twelve days, 14 `ci.yml` runs went red at
`Check the agent layer` on branches with no relationship to the kit, 13 `Merge remote-tracking
branch 'origin/develop'` commits carried no product change, and 49% of the last 41 lock bumps
touched nothing a branch executes. ADR 0024 answers the first four by narrowing `--base` to an
`enforced` subset of the lock, and the routing problem by a three-class table plus a seed-commit
convention, plus a new `refresh-open-prs.yml` to compensate for the narrowing.

That is a lot of machinery whose entire output is: three repositories hold identical copies of files
that one person writes and one person reviews. The distribution problem is real - the kit's README
records two production defects that existed because this layer had no distribution mechanism at all:
`.ai/scripts/cezar-host-patch.sh` keyed its idempotency check off text it never inserted, so it
re-patched a clean install every time, and `$PIPELINE_LABELS` was iterated with `for label in
$PIPELINE_LABELS`, which zsh does not word-split, so the loop ran once on the whole string. Both are
worth remembering. Neither needed a rendering pipeline to find; both needed someone to read the
script.

The cost that is not in ADR 0024's numbers is the one that prompted this. Correcting a sentence in an
`afk-*/SKILL.md` is a pull request in the kit, a review, a merge, a sync pull request here, a second
review and a second merge - for a file nobody outside this organisation consumes. The guard makes the
same trip mandatory for a hook or a workflow. ADR 0024 calls that price "paid by a person reading a
diff rather than writing one", which is accurate and is still two merges for a typo.

## Decision

**1. The rendered files stay exactly as they are, as ordinary repository files.** Byte for byte,
nothing in `.ai/skills/afk-*/`, `.ai/cezar/`, `.claude/hooks/`, `scripts/ci/`, `.ai/trackers/` or the
three Claude workflows changes behaviour. `.ai/agent-kit.lock.json` and
`.ai/scripts/agent-kit-check.mjs` are deleted, the check leaves `validation.commands` and `ci.yml`,
and `.prettierignore` keeps every one of those paths - the ignore is now about prose that wraps as
written, not about a hash.

**2. `guard-generated.sh` loses one tier of four, and keeps the rest.** The file was read as a
single thing, argued about as a single thing, and is not one. It has four rules with four different
reaches, and only one of them is what made this change necessary:

| Tier | Reach            | What it refuses                                                            | Verdict   |
| ---- | ---------------- | -------------------------------------------------------------------------- | --------- |
| 1    | everyone, always | a hand-edit of `routeTree.gen.ts`, `drizzle/`, `worker-configuration.d.ts` | **stays** |
| 2    | agent runs       | a write through `..` or outside the worktree                               | **stays** |
| 3    | cezar runs       | a write to a path that configures the agent                                | **goes**  |
| 4    | GitHub Actions   | the same paths, with no exception                                          | **stays** |

**Tier 3 is the whole of the cost.** It is what made a correction to a skill, a hook or a workflow a
two-repository round trip, and its own escape hatch - "a guarded file this branch already changes" -
already conceded that most of its refusals were false positives. In a cezar run the diff belongs to
a human, is proposed as a pull request and is read by a reviewer before it merges; that is the same
protection every other file in the diff gets, and it is enough. ADR 0024's property - _a run cannot
rewrite the gate that judges that run_ - is kept where the run's diff is not a human's, which is
tier 4 and only tier 4.

**Tier 4 is not redundant with anything**, and this was nearly lost by reading the file as one rule.
`claude-code-review.yml` reads untrusted pull-request content with a write token under
`--permission-mode bypassPermissions`. It re-checks out four paths from the base ref -
`.claude/settings.json`, `.claude/hooks`, `scripts/ci` and `.ai/agentic.config.json` - which stops
the pull request from supplying its own judge. It does nothing about the _running agent_:
`git-guardrails.sh` is re-read on every `PreToolUse` and its own header calls itself the only thing
between a crafted pull request and `gh pr review --approve`, so an agent able to `Write` it disarms
the rest in one call. Tier 4 is that half. (Two limits of the re-checkout are worth stating because
they are easy to overstate: it does **not** cover `.claude/skills/`, and it restores rather than
cleans, so a path a pull request _adds_ survives it. Both predate this change; the first is filed.)

_Amended by #711: `claude-code-review.yml` was retired. Tier 4 still protects agent
configuration under `GITHUB_ACTIONS`, but the former review job no longer reads pull-request
content with a write token._

**Tier 2 is not redundant either.** Its header records a `pr-autopilot` run that reached
`../agent-kit/templates/…` and rewrote eight files in a sibling checkout a human was working in,
with nothing downstream able to tell. It costs a correct run nothing.

`.ai/agent-kit.lock.json` leaves the tier-4 path list with the file it named.

**Tier 1 keeps `worker-configuration.d.ts` protected, which matters more than it looks**, because
that file is the one generated file with no drift check behind it. The route tree, `drizzle/` and
the spec index are all diffed against a fresh regeneration by `.ai/scripts/check-generated.sh` and
by `ci.yml`. This change tried to add a fourth block in the same shape and could not, because the
committed file is not `wrangler types`' output.
Today's wrangler emits `TRIP_ROOM: DurableObjectNamespace<import("./src/server/worker").TripRoom>`
and a `Cloudflare.GlobalProps` carrying `typeof import("./src/server/worker")`; that file is what
`src/server/worker.ts` imports `Env` from, so the reference is circular, `Env` resolves to an empty
type and `pnpm typecheck` reports 14 errors on files this branch does not touch. The committed copy
carries `DurableObjectNamespace /* TripRoom */` instead, which is the adjustment that makes it
compile. Generated-then-adjusted has nothing to be diffed against, and that - not an oversight - is
why this one file got a hook that refused edits rather than a check that compared them.

So the file is protected from a hand edit and unprotected against `wrangler.jsonc` moving past it -
which is exactly the state it was in before this change, and the reason it is stale today:
`wrangler.jsonc` declares `AI`, `CF_VERSION_METADATA` and `SANDCASTLE_REGISTRY`, and the committed
types know none of them. Nothing in the repository would have reported that, before or after. It is
a defect of its own and is filed as one; the fix is either an upstream wrangler that does not
self-reference, or a check that asserts every binding in `wrangler.jsonc` appears in the types
without demanding byte equality.

**3. The host layer moves to `design4pro/cezar`.** The launchd plists and the runner pool live there
under `host/`, with the runbook in `docs/host/README.md` and the placement argued in that
repository's ADR 0007. It is already the cockpit's boot repository. `agent-kit` is then **archived on
GitHub, not deleted**: its README is the only record of the five `design4pro/cezar` fork commits and
the silent symptom of each one's absence.

**4. The two application repositories may now diverge, and nothing tracks it.** When a fix belongs in
both, it is applied in both, as two ordinary pull requests. ADR 0024's three-class routing table is
void: in a cezar run every one of those paths is now simply a path, and a fix is written where the
file is.

## Consequences

- **The two agent layers will drift, and no check will say so.** That is the bet this ADR makes, and
  it is the one thing here that can go wrong quietly. The mitigation is that both repositories are
  read by the same people and neither layer is large; the tripwire, if this proves wrong, is a
  periodic diff rather than a return to rendering.
- **Nothing detects a hand edit of an agent-layer file.** No lock, no hash, and in a cezar run no
  hook. Review does, or it does not. In exchange, a correction to a skill, a hook or a workflow is
  one commit on the branch that needs it, which is the whole point.
- **A branch that is behind on the agent layer is no longer failed, and this one is a real loss
  rather than a trade.** The `Check the agent layer` step did two things, and the comment above it
  named the second: `--base`/`--head` compared the base branch's lock with the head's, so a branch
  cut before a pipeline change went red for being stale, not only for being edited. That matters
  because `pr-autopilot` and `pr-fix` check out the pull request _head_ - a branch from last week
  runs last week's hooks, last week's workflows and last week's guards, and nothing else in the
  repository notices. It cannot be reconstructed in that shape: it compared two copies of a lock
  file that no longer exists. What is left is that a stale agent layer is now visible only in the
  diff, as an absence, which is the hardest thing for a reviewer to see. A per-file
  `git merge-base` comparison over the same paths would recover most of it and is the obvious
  follow-up if this bites.
- **A cezar run can now rewrite its own gate, its own skills and its own workflows.** That is tier
  3 going, stated plainly. The reviewer of its pull request is what stands there instead, and a
  diff that quietly widens what a run may do is a review finding like any other. Under GitHub
  Actions nothing changes: tier 4 refuses the same paths it always did.
- **`worker-configuration.d.ts` is guarded against a hand edit and not against drift.** Decision 2
  says why the obvious drift check does not work here. Unchanged by this ADR, and filed separately
  rather than left implicit.
- **The gate is one command shorter and no branch goes red for being behind a version number.** The
  13-merge-commit class disappears with the `--base` comparison, and `refresh-open-prs.yml` - which
  ADR 0024 introduced only to compensate for narrowing that comparison - is never needed.
- **One protection is given up, and it is named above rather than bundled.** An earlier draft of
  this ADR deleted the hook outright and described the loss as a single line about
  `worker-configuration.d.ts`. Review in both repositories caught that: the file carried worktree
  confinement and an absolute GitHub Actions block that nothing else provides, and neither had
  anything to do with the kit. Separating the four tiers is what let the expensive one go without
  the other three.
- **`git-guardrails.sh`, `guard-read.sh` and `format-file.sh` stay.** The destructive-git net and the
  read confinement are not what this ADR is about, and removing either would be a real regression.
- **The `afk-*` ladder stays as it is.** Pruning it was one of the four complaints that motivated this
  change, and it is now an ordinary pull request in one repository rather than a kit release - which
  is the point. It is a sensible follow-up, not part of this.
- **ADR 0024 stands as the record of why the kit existed and what it cost.** Its evidence is this
  ADR's evidence; only its decision is reversed.
