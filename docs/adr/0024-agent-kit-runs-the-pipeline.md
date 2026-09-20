# 0024. agent-kit runs the pipeline; a kit-owned fix is an issue in the kit

Status: superseded by ADR 0025
Date: 2026-09-20
Records: the agent layer's distribution through `design4pro/agent-kit`, which has been a structural
decision since 2026-09-08 with no ADR anywhere and has therefore been argued from README prose.
Amends: ADR 0018 (the guard stays exactly as it is; this names where a fix it refuses is written
instead).

## Context

`design4pro/agent-kit` renders 51 files into this repository and into `money-tracker.online`, and a
six-file subset into `cezar`. All 51 are the agent layer - hooks, cezar workflows, the tracker
descriptor, the `afk-*` skills, three `.github/workflows/`, `scripts/ci/` - and none of them is
product code. `.github/workflows/sync-consumers.yml` opens a `chore(agent-kit): sync kit NN` pull
request in each consumer on every push to the kit's `main`; the last four were merged 21 to 90
minutes after opening. The kit's README records two production defects, one per consumer, that
existed because this layer previously had no distribution mechanism at all.

What had no route was a **fix**. `.claude/hooks/guard-generated.sh` (ADR 0018) refuses an agent
write under `.github/`, `.claude/`, `.husky/`, `.ai/cezar/`, `.ai/skills/`, `.ai/scripts/`,
`.ai/trackers/`, `scripts/ci/` and a few named files - whether or not the kit owns them. Issues
#312, #342 and #364 each carry four `om-auto-fix-issue` runs that stopped with the same message
before claiming:

```
BLOCKED (agent run): '<path>' configures the agent; a run never edits it.
```

The guard is right, and retiring the kit would not have moved any of the three: every path they name
is in that set either way. The actual gap was one step upstream. **The kit itself had no pipeline
installed** - no `.ai/`, no `.claude/`, and the stock GitHub label set - so the one repository where
such a fix is allowed to be written was the one repository no agent could work in. Every kit-owned
fix needed a human hand-editing a template.

Two further facts shaped the decision.

**"Guarded" and "kit-owned" are different sets,** and conflating them is why "retire the kit" could
never have been the whole answer. Three classes, and `.ai/agent-kit.lock.json` - not a list in prose

- is the authority for which a file is in:

| Class                | Example                                                                         | Where a fix is written                                                         |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| kit-owned + guarded  | `.ai/trackers/github.md`, `scripts/ci/merge-gate.mjs`, `.claude/settings.json`  | `design4pro/agent-kit`, then the sync pull request                             |
| repo-owned + guarded | `.ai/scripts/check-generated.sh`, `.ai/agentic.config.json`, `.ai/skills/om-*/` | here, through the seed-commit route below                                      |
| vendored + guarded   | `.claude/skills/om-*/`, pinned by `skills-lock.json`                            | `open-mercato/skills`, to which we have no push rights: an override is the fix |

#312 straddles the first two classes, #342 the first two, #364 the first and third.

**`agent-kit-check.mjs --base` taxes branches that have no relationship to the kit.** It exits 3
when a branch's `kitVersion` is below its base's, and it is the first step of a required check. With
`kitVersion` moving 1 to 48 in twelve days, that produced 14 failed `ci.yml` runs at
`Check the agent layer` and 13 `Merge remote-tracking branch 'origin/develop'` commits carrying no
product change. Measured over the last 41 lock bumps, 20 of them (49%) touched nothing a branch
executes - nothing under `.claude/hooks/`, `.github/workflows/`, `scripts/ci/`, not
`.claude/settings.json` and not the checker itself. Those branches went red over wording in an
`afk-*/SKILL.md`. The `develop` ruleset has `strict_required_status_checks_policy: false`, so exit 3
is strictly stronger than the repository's own merge policy and is the only thing forcing those
merges.

## Decision

**1. The kit keeps distributing the agent layer, and now fixes it the same way this repository fixes
anything.** `design4pro/agent-kit` runs the `om-*` pipeline on its own issues: the SDLC label
taxonomy by exact name, `.ai/agentic.config.json` with a single validation command
(`node test/sync-check.mjs` - there is no `package.json` there, so the consumers' gate shape does not
apply), `qaGate: false`, the vendored skills, and one cockpit automation on `autofix`. Its `SDLC.md`,
`CODE_REVIEW.md` and `BACKWARD_COMPATIBILITY.md` are its own. A kit-owned defect is an ordinary
autofix issue there, and `sync-consumers` delivers it here.

**2. ADR 0018's property survives, and the line is drawn deliberately rather than inherited.** That
property is that _a run cannot rewrite the gate that judges that run_. In the kit, the gate judging a
run is the kit's own `.claude/`, `.ai/` and `.github/`, and its guard refuses those, plus `bin/`,
`test/`, `host/` and any path outside the worktree. `templates/**` is editable, because a template is
a gate for _other_ repositories' runs and reaches them only through **two independent human merges** -
the kit's pull request and then each consumer's sync pull request - with the kit's required `render
parity` check in between, which proves byte for byte that the reviewed template is what ships. The
`..` refusal is not theoretical: the hook's own header records a `pr-autopilot` run that reached
`../agent-kit/templates/…` and rewrote eight files in a sibling checkout, and nothing downstream could
tell.

Two narrowings are accepted rather than worked around. A fix wanting a new assertion in the kit's
`test/sync-check.mjs` stops with `Status: blocked` naming the assertion, because that file is the gate
judging its own pull request; a human adds it. `manifest.json` and `vars/*.json` stay writable,
because the tier demotion is mandatory on almost every template fix - but changing _what_ the kit
renders is a maintainer's decision, not a run's, and the kit's `CODE_REVIEW.md` makes that a
request-changes.

**3. Nothing about this repository's guard changes.** ADR 0018 stands unamended in its text. What
changes is the answer an agent gives when the guard refuses: not a fifth "blocked" comment, but a
route. A guarded path that the lock file says is kit-owned becomes one idempotent issue in the kit
with a back-link, and `blocked` here. A guarded path under `.claude/skills/` is upstream in a
repository we cannot push to, so the fix is an `.ai/skills/<name>/SKILL.md` override. Anything else
guarded is repo-owned and takes the **seed-commit route**, which needs no code and no relaxation:
the guard already allows a run to edit a guarded path that its branch _already changes_ relative to
its base, so a human opens the branch with the one-line touch and re-applies `autofix`.

**4. Staleness is measured against what a branch executes, not against a version number.** The
`--base` check will compare an `enforced` subset of the lock - `.claude/hooks/`,
`.github/workflows/`, `scripts/ci/`, `.claude/settings.json` and `agent-kit-check.mjs` itself -
and exit 3 naming the files that differ. A base lock written before the flag existed falls back to
today's `kitVersion` comparison, loudly; the exit-code contract (0/1/2/3) does not move. This
narrows a safety net - a branch may run an older `.ai/trackers/github.md` without a red check - so it
ships with its compensating control: a kit-rendered `refresh-open-prs.yml` that runs when a sync
lands and merges the base into every eligible open pull request, with a bot token, because a
`GITHUB_TOKEN` push does not re-run CI and would leave the branch updated and still red.

Points 1 and 2 land together, because installing the pipeline in the kit without its guard is the one
genuinely dangerous intermediate state. Points 4 and 3 follow, in that order, and 4 is itself the
first proof that 1 and 2 work.

## Consequences

- A kit-owned fix costs two human merges instead of one hand-edit. That is the price of the property
  in point 2, and it is paid by a person reading a diff rather than writing one.
- The merge rate into the kit goes up, and with it the chance that a bad kit pull request reaches both
  consumers. The three controls that make this acceptable - two human merges, the required `render
parity` check, and `sync.mjs`'s all-or-nothing render - must not be weakened while the rate rises.
- `main` in the kit is now protected: pull request required, `parity` and `tools` required. Nothing
  in either repository auto-merges, and `om-approve-merge-pr` exists in the kit's skill set without
  anything invoking it; the ruleset is what keeps that true by accident as well as by intent.
- #312, #342 and #364 are deliberately not fixed by this. They return to the queue and take the new
  route, which is the cheapest proof it works.
- The three-class table above is the thing to keep current. When it and `.ai/agent-kit.lock.json`
  disagree, the lock is right.
