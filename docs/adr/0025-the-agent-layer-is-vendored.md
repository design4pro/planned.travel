# 0025. The agent layer is vendored; agent-kit is retired

Status: accepted
Date: 2026-09-20
Supersedes: ADR 0024 (the kit distributes the agent layer, and a kit-owned fix is an issue in the kit).
Amends: ADR 0021 (decision 1: the gate loses its first command), ADR 0018 (`guard-generated.sh` is
removed; one of the things it protected is not replaced, and decision 2 says which).

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

**2. `guard-generated.sh` is removed.** ADR 0024's property - _a run cannot rewrite the gate that
judges that run_ - is not wrong. A hook that refuses by path is the wrong instrument for it: it is
this repository's own invention, neither Cezar CLI nor Open Mercato prescribes it, it cannot tell a
correction from a subversion, and its own escape hatch ("a guarded file this branch already changes")
already conceded that most refusals were false positives. Under GitHub Actions the agent config is
still not the pull request's to supply: `claude-code-review.yml` re-checks out `.claude/`,
`scripts/ci/` and `.ai/agentic.config.json` from the base ref. Everything else is review's job, as it
is for every other file in a diff.

**One protection the hook held alone is not replaced, and this is a known gap.**
`worker-configuration.d.ts` is the fourth generated file and the only one with no drift check: the
route tree, `drizzle/` and the spec index are all diffed against a fresh regeneration by
`.ai/scripts/check-generated.sh` and by `ci.yml`, and this change intended to add a fourth block in
the same shape. It cannot be added, because the committed file is not `wrangler types`' output.
Today's wrangler emits `TRIP_ROOM: DurableObjectNamespace<import("./src/server/worker").TripRoom>`
and a `Cloudflare.GlobalProps` carrying `typeof import("./src/server/worker")`; that file is what
`src/server/worker.ts` imports `Env` from, so the reference is circular, `Env` resolves to an empty
type and `pnpm typecheck` reports 14 errors on files this branch does not touch. The committed copy
carries `DurableObjectNamespace /* TripRoom */` instead, which is the adjustment that makes it
compile. Generated-then-adjusted has nothing to be diffed against, and that - not an oversight - is
why this one file got a hook that refused edits rather than a check that compared them.

The file is stale today, independently of this change: `wrangler.jsonc` declares `AI`,
`CF_VERSION_METADATA` and `SANDCASTLE_REGISTRY`, and the committed types know none of them. Nothing
in the repository would have reported that, before or after. It is a defect of its own and is filed
as one; the fix is either an upstream wrangler that does not self-reference, or a check that asserts
every binding in `wrangler.jsonc` appears in the types without demanding byte equality.

**3. The host layer moves to `design4pro/cezar`.** The launchd plists and the runner pool live there
under `host/`, with the runbook in `docs/host/README.md` and the placement argued in that
repository's ADR 0007. It is already the cockpit's boot repository. `agent-kit` is then **archived on
GitHub, not deleted**: its README is the only record of the five `design4pro/cezar` fork commits and
the silent symptom of each one's absence.

**4. The two application repositories may now diverge, and nothing tracks it.** When a fix belongs in
both, it is applied in both, as two ordinary pull requests. ADR 0024's three-class routing table is
void: every guarded path is now simply a path, and a fix is written where the file is.

## Consequences

- **The two agent layers will drift, and no check will say so.** That is the bet this ADR makes, and
  it is the one thing here that can go wrong quietly. The mitigation is that both repositories are
  read by the same people and neither layer is large; the tripwire, if this proves wrong, is a
  periodic diff rather than a return to rendering.
- **Nothing detects a hand edit of an agent-layer file.** Review does, or it does not. In exchange,
  a correction to a skill, a hook or a workflow is one commit on the branch that needs it.
- **`worker-configuration.d.ts` is now unguarded in both directions:** nothing refuses an edit to it
  and nothing notices when `wrangler.jsonc` moves past it. Decision 2 says why the obvious
  replacement does not work here. This is the one place where this ADR is a net loss.
- **The gate is one command shorter and no branch goes red for being behind a version number.** The
  13-merge-commit class disappears with the `--base` comparison, and `refresh-open-prs.yml` - which
  ADR 0024 introduced only to compensate for narrowing that comparison - is never needed.
- **Two protections are given up knowingly.** The worktree-confinement rule goes, which once stopped a
  `pr-autopilot` run reaching `../agent-kit/templates/…` and rewriting eight files in a sibling
  checkout - far less relevant now that the sibling is archived. And the agent-config write block goes
  outside GitHub Actions, where decision 2's re-checkout replaces it.
- **`git-guardrails.sh`, `guard-read.sh` and `format-file.sh` stay.** The destructive-git net and the
  read confinement are not what this ADR is about, and removing either would be a real regression.
- **The `afk-*` ladder stays as it is.** Pruning it was one of the four complaints that motivated this
  change, and it is now an ordinary pull request in one repository rather than a kit release - which
  is the point. It is a sensible follow-up, not part of this.
- **ADR 0024 stands as the record of why the kit existed and what it cost.** Its evidence is this
  ADR's evidence; only its decision is reversed.
