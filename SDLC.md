# Software delivery process

## Purpose

This file documents how work flows from ticket to merged PR in this repository. The agent skills configured in `.ai/agentic.config.json` enforce the process; humans read it here. Issues and PRs live in GitHub, with every tracker operation the skills run defined in `.ai/trackers/github.md` (edit that file to extend or override tracker behavior).

This document is this repository's own. Until the agent kit was retired (ADR 0025) it was shared word for word with a sibling that runs the same pipeline, and a marker near the end cut the shared part from the local one. Nothing renders or enforces that parity now, and a fix that belongs in both repositories is written in both by hand — so the marker is gone, and with it the rules that protected it. What the split got right is kept: **the base branch is `.ai/agentic.config.json` → `baseBranch`**, it is named once under `## This repository`, and everything here that says "the base branch" means that value.

Work enters through two paths: a free-form task brief handed to an agent, or a filed ticket. Both converge on the same review loop, the same validation gate, and the same merge gates.

Before intake, the work is shaped: `om-brainstorm` turns a single idea or question into a routing decision and a brief, and the spec skills (`om-spec-writing`, `om-auto-write-spec`) turn a feature into a design document before anything is built. Those steps feed the table below; they are not the ticket flow itself, and the Definition of Ready is the contract between them and Intake. A product-level step sits above both — `om-discover`, writing the brief every later decision reads — but it is **not enabled here**; see `## Product decisions as a protected contract`.

## Roles

- **Author** — the human or agent who writes the change. Owns the ticket from claim to a merge-ready PR.
- **Reviewer** — reads the diff and approves or requests changes. May be a human or the `om-auto-review-pr` skill; the `om-code-review` checklist applies either way.
- **Designer** — not enabled here: no pipeline run or automation takes a design step, and the design contract `.uxproof/` does not exist yet. Where a person fills the role they own the flow and its states before the code exists; `om-ux-shape` (shaping) and `om-ux-review-pr` (a pass over a PR's screens) are installed, a person starts either from the cockpit, and `om-ux-setup` extracts the contract once. Referenced by role, never by name.
- **QA reviewer** — exercises user-facing changes before they merge, with `om-prepare-test-env` to boot the app once and `om-auto-qa-pr` to walk it in a real browser. Manual means a person judges the result and owns `qa-approved`; it does not mean the work is unassisted. Here the unattended sign-off holds the role by default (`## The QA gate`). Always referenced by role, never by name or handle: assignments change.
- **Maintainer** — owns branch protection, the label taxonomy, the config, and this document; arbitrates when gates conflict.

## Ticket lifecycle

| Stage                   | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Driven by                                                                                                         | Done when                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Discovery               | An idea, question, or itch is talked through: the problem is questioned, alternatives (including building nothing) are weighed, and the conversation ends in a routing decision. The product-level half of this stage — establishing the context every later decision reads, from material that exists, with every claim tagged by its evidence — is `om-discover`, and it is not enabled here.                                                                                                                                                    | `om-brainstorm` (one idea), or a human                                                                            | A routed conversation, with a brief when the work continues     |
| Intake                  | A ticket or task brief is filed in GitHub and meets the Definition of Ready below. `om-prepare-issue` files it with SDLC labels and the ready sections; `om-auto-manage-issues` grooms what is already filed and reports what it still lacks. Agents file tickets too: `spec-to-tickets` slices a merged spec into tracer-bullet tickets, and `manual architecture review` files deepening candidates.                                                                                                                                             | Anyone, `om-prepare-issue`, `om-auto-manage-issues`, `spec-to-tickets`, `manual architecture review`              | Ticket exists and is ready, or its gaps are named on the ticket |
| Triage                  | Confirm the issue is real, still unfixed on the base branch, and not already claimed or covered by an open PR. Then write an Agent Brief, or put a `blocked` hold on it naming what a person must do (see Readiness below). Read-only on code; stops the chain cleanly when there is nothing to do.                                                                                                                                                                                                                                                | `triage`, `om-verify-in-repo`, or a human                                                                         | An Agent Brief posted or a hold set, or stopped as no-action    |
| Claim                   | The author claims the ticket so concurrent agents back off. See the claim protocol below.                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `om-fix` / `om-auto-create-pr`, or a human                                                                        | Claim visible on the ticket                                     |
| Design                  | Not enabled here: no pipeline run settles a flow before the code. For a user-facing change a person may decide the flow and its states (empty, loading, error, no permission) first; a ticket that touches no UI skips this stage.                                                                                                                                                                                                                                                                                                                 | `om-ux-shape` on demand from the cockpit, or a human designer                                                     | Nothing waits on it; no run gates on this stage                 |
| Implement               | Locate the minimal change surface (`om-root-cause`, read-only), then implement the change with regression tests and run the validation gate. Task briefs without a ticket go through `om-auto-create-pr`, which plans, implements phase by phase in an isolated worktree, and runs the same gate.                                                                                                                                                                                                                                                  | `om-root-cause` + `om-fix`, `om-auto-create-pr`, or a human author                                                | Change complete, validation gate green                          |
| PR                      | Commit, push, and open a PR against the base branch with normalized labels. On a hand-worked branch, `om-check-and-commit` runs the gate, fixes obvious drift, and pushes when green.                                                                                                                                                                                                                                                                                                                                                              | `om-open-pr`, `om-auto-create-pr`, or `om-check-and-commit`                                                       | Open, labeled PR                                                |
| Review loop             | The reviewer reads the diff against the `om-code-review` checklist and approves or requests changes. Requested changes are addressed (`om-auto-continue-pr` resumes agent PRs from the tracking plan, and adopts a PR that has none by reconstructing the plan from the PR's own context) and the PR is re-reviewed until approved. A user-facing change can also get a design pass: `om-ux-review-pr` walks the changed screens and reports findings ranked by user impact. A person starts it; the pass is advisory and does not hold the merge. | `om-auto-review-pr` (single PR), `om-review-prs` (sweep), `om-ux-review-pr` (design pass, on request), or a human | Approving review submitted                                      |
| QA                      | A PR carrying `needs-qa` waits for QA. The app is booted once with `om-prepare-test-env` and the change is walked in a real browser with `om-auto-qa-pr` (screenshots and a pass/fail report, no labels touched by default); a flow worth keeping becomes `om-integration-tests` coverage. The unattended sign-off (a specialist panel, `risk-high` included), or a QA reviewer, records the outcome. See the QA gate below.                                                                                                                       | QA reviewer, with `om-prepare-test-env`, `om-auto-qa-pr`, `om-integration-tests`                                  | `qa-approved` applied, or `qa-failed` routes it back            |
| Merge                   | `om-merge-buddy` reports, read-only, which PRs can merge now and which are close but blocked. `om-approve-merge-pr` re-checks every gate, approves, and merges by whatever mechanism `## This repository` names.                                                                                                                                                                                                                                                                                                                                   | `om-merge-buddy` + `om-approve-merge-pr`, or a human                                                              | PR merged into the base branch                                  |
| Post-merge housekeeping | Close issues the merged PR fixes; comment on issues whose PRs were closed without merging; turn leftover asks or review comments into tracked follow-up issues.                                                                                                                                                                                                                                                                                                                                                                                    | `om-close-fixed-issues`, `om-followup-issue-from-pr`                                                              | Tracker reconciled, follow-ups filed                            |

## Definition of Ready

A ticket is ready for implementation when the answers below are on the ticket or in a spec it links. They come in two tiers, because a spec can supply the second but never the first.

**Ticket-level — a problem statement is never invented, and the readiness verifier (below) resolves the rest from evidence or with a documented assumption, and what it leaves open is settled through a specialist sub-agent (§ Delegated decisions):**

- the problem or need, and who has it (a user or a role);
- the expected outcome, and how it will be checked;
- what is out of scope;
- open questions, each marked blocking or non-blocking — no blocking question left unanswered; a question a specialist settled is a non-blocking Resolved assumptions row;
- any autonomous assumption confirmed by a human (the resolved-assumptions comment on a spec PR), or settled by a specialist sub-agent and reviewed at the PR.

**Spec-level — a covering spec supplies these, and `om-auto-write-spec` writes them when they are missing:**

- acceptance criteria;
- business rules;
- the happy path and the main unhappy paths;
- impact on data and permissions;
- dependencies;
- a link to the prototype or mockups when the change is user-facing.

For a bug, ready means reproducible: `om-verify-in-repo` is that gate, and the list above applies only to its ticket-level items. Enforcement: `om-prepare-issue` files tickets with these sections; `om-auto-manage-issues` records `READY_STATUS` per issue and posts a not-ready comment naming what is missing; `om-auto-fix-issue`'s feature route stops on a ticket that fails the ticket-level tier instead of speccing around the gap, the way `om-verify-in-repo` stops on a bug that is not real. Spec-level gaps are not a stop — the spec is authored. A maintainer may waive an item by saying so on the ticket. Before either skill stops on a missing ticket-level item, the `readiness-verifier` sub-agent (`.agents/reviewers/readiness-verifier.md`) reads the ticket, its thread and the repository, and resolves each item from evidence or with a documented assumption; when it resolves them all, its table goes on the ticket as a `readiness verified` comment and the ticket is ready, and a maintainer revokes that with a `veto` reply. It never decides a blocking question nobody answered, a product choice the repository has not made, or a problem statement it would have to invent; those go to the specialist sub-agent of § Delegated decisions, and only what that leaves open waits for a human. `risk-high` and `security` work is not refused here: the security and tenancy specialist rules on it at triage.

**The Definition of Ready is the gate an unattended pipeline is built on.** `READY_STATUS` is the one machine-readable verdict that says a ticket can be worked without asking a person a question, so the triage step reads it and nothing downstream re-derives it. A ticket that is not ready is commented on and left alone; it is never handed to an implementing agent on the theory that the agent will work the gap out.

## Product decisions as a protected contract

**This section describes a layer that is not switched on here.** It rests on a product brief at `.ai/specs/product-brief.md` whose **Non-goals**, **Business rules** and **Decisions** tables carry stable ids (`N01`, `R03`, `D07`), an owner, a status and a review-by date, and are then protected in review the way `BACKWARD_COMPATIBILITY.md` protects contract surfaces — a PR contradicting an entry is a blocker until a superseding row lands with it.

There is no such file in this repository, the `discovery` block is absent from `.ai/agentic.config.json`, and the four skills the layer needs — `om-setup-discovery-pipeline`, which installs it, plus the feeders `om-synthetic-users`, `om-backlog` and `om-mockup-prototype` — are exactly the four the collection has and `skills-lock.json` does not (37 of 41). So nothing above is enforced today, and a reader should not go looking for decision ids that do not exist. Turning it on starts by installing those skills, because the setup skill is itself one of the missing ones; `## This repository` says so again where the rest of the local facts are.

## Scoping rule (SLC)

Every spec, ticket and agent-sized issue is scoped **Simple, Lovable, Complete** (Jason Cohen, "Your customers hate MVPs. Make a SLC instead"), not as a minimum viable product:

- **Simple**: the narrowest scope that does one job. Split anything that does not fit one ticket, or one fresh agent context.
- **Lovable**: no rough edge is left "for later" inside that scope. Error states, empty states, docs and tests ship with the change.
- **Complete**: the slice is useful and verifiable on its own. A change that only works once a later ticket lands is a layer, not a slice: merge it into the slice it serves.

A request that fails the rule is re-scoped (a spec, or tickets), not implemented partially. `triage` and `spec-to-tickets` both gate on this rule: a ticket too large for one fresh agent context never gets an Agent Brief as it stands. The skill splits it, on a product owner specialist's verdict (§ Delegated decisions), into a first slice it briefs and follow-up issues it files.

## Label state machine

Pipeline labels are mutually exclusive: a PR carries at most one, and it names where the PR sits in the flow.

- A ready, non-draft PR carries `review`.
- The reviewer moves it: request changes → `changes-requested`; after fixes it returns to `review`; approval → `merge-queue`.
- `merge-queue` is routing, not proof of QA: a `needs-qa` PR legitimately sits there until QA signs off. The label is this state machine's and is not GitHub's merge queue: a PR carrying it is waiting for the merge step `## This repository` describes, and only that step puts it in whatever queue GitHub runs.
- Only a QA reviewer sets the `qa` pipeline label. They move a queued `needs-qa` PR from `merge-queue` to `qa` while testing, then back to `merge-queue` with `qa-approved` on pass, or to `qa-failed` on failure. Automated skills request QA with `needs-qa`; they never set `qa`.
- `blocked` and `do-not-merge` stop the flow wherever it is. A skill may set `blocked` with a 🤖 comment, and the promotion workflow sets `do-not-merge` on the `develop` -> `main` PR. `do-not-merge` and `do-not-close` are a person's to clear. A `blocked` an agent set can also be lifted by `unblock` on an independent specialist's verdict (§ Readiness, ADR 0033); one a person set, or took over by commenting after it, stays.

| Group    | Labels                                                                                     | Exclusivity                   | Meaning                            |
| -------- | ------------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------------- |
| Pipeline | `review`, `changes-requested`, `qa`, `qa-failed`, `merge-queue`, `blocked`, `do-not-merge` | one at a time                 | Workflow state                     |
| Category | `bug`, `feature`, `refactor`, `security`, `dependencies`, `documentation`                  | additive                      | Kind of change                     |
| Meta     | `needs-qa`, `skip-qa`, `qa-approved`, `qa-self-verified`, `in-progress`, `ci-monitoring`   | additive                      | Process signals                    |
| Priority | `priority-low`, `priority-medium`, `priority-high`, `priority-extreme`                     | one at a time; unset = medium | Urgency of the work                |
| Risk     | `risk-low`, `risk-medium`, `risk-high`                                                     | one at a time; unset = medium | Blast radius of the change         |
| Outside  | `do-not-close`                                                                             | additive                      | A human hold no skill may override |

An issue carries the category, priority and risk groups and the holds, and nothing else: no label says an issue is ready or starts a run (§ Readiness, ADR 0032). `do-not-close` is the one label outside the Open Mercato taxonomy, and no other is created. Every group is also `labels.*` in `.ai/agentic.config.json`, and that file is what the skills read — a label this document names and the config does not is a label no skill will apply.

Priority is how urgent the work is; risk is how dangerous the change is to ship. A one-line fix for an outage can be `priority-extreme` and `risk-low`; a large auth refactor that can wait can be `priority-low` and `risk-high`. A PR inherits both from its source issue unless the scope clearly changed. When an automated skill adds or changes a pipeline or meta label, it leaves a short comment explaining why.

When no priority label is set, infer one:

- `priority-extreme` — production outage, data loss, or an active security incident.
- `priority-high` — security hardening or a release-blocking regression.
- `priority-medium` — ordinary bug fixes and net-new features (also the default reading of unset).
- `priority-low` — cosmetic, docs-only, dependency bumps, follow-up cleanup.

When no risk label is set, infer one:

- `risk-high` — auth, sessions, data scoping, money, schema migrations, shared contract surfaces, or broad cross-cutting edits. `## This repository` names the surfaces that are `risk-high` here.
- `risk-medium` — an ordinary single-area change that ships with tests (also the default reading of unset).
- `risk-low` — docs-only, test-only, typo, or isolated cosmetic changes.

When signals conflict, pick the higher label and say why in the label comment. A `risk-high` PR strengthens the case for `needs-qa` and deeper review even when it would otherwise look routine, and it sends the issue past a security and tenancy specialist (§ Delegated decisions) before any unattended implementing skill may take it.

## Readiness

No label says an issue is ready, and no label starts a run (ADR 0032). The taxonomy above is the whole vocabulary; readiness is computed.

An issue is **ready** when all of these hold: it is open; a maintainer opened it (`trustedAuthors` in `.ai/agentic.config.json`) or the Sentry sweep filed it; its body or a maintainer's comment carries an `## Agent Brief` (for a Sentry ticket only a maintainer's comment counts, ADR 0040); it has a category, a priority and a risk label; every issue under its `Blocked by` is closed; no open PR addresses it; no 🤖 not-ready or `STOP:` comment waits for an answer; and it carries none of `blocked`, `do-not-merge`, `do-not-close` or `in-progress`. A later trusted `🤖 RESOLVED:` comment (what `unblock` posts) answers a not-ready or `STOP:` comment, as a human reply does. A trusted author's comment that says `HUMAN-ONLY:`, or an issue body that opens with it (what `plan-to-spec` files for a stage only a person can decide), names what only a person can do, and no run is started on that issue until a maintainer comments. `.ai/scripts/backlog-status.mjs` is the one implementation of that rule. It prints the report a person reads, with `--next` it picks the issue the next `implement-ticket` run takes: highest priority first, then oldest, and nothing while three PRs are **waiting for a person**, and with `--plan` it lists everything the Reconciler may start right now (§ Repo automations, ADR 0033). A PR waits for a person when it is open, by a maintainer, not the `do-not-merge` promotion, and it is `blocked` (or `changes-requested` untouched for 24 hours): those are the PRs only a person can move. A PR the pipeline merges by itself (`review`, `changes-requested`, `merge-queue`, a plain draft) is not inventory, so it does not hold back the next implementation. Trusted authors are `trustedAuthors` in `.ai/agentic.config.json` plus the retired `design4pro-agent`, every issue of which came out of an agent run (ADR 0031, amendment of 2026-10-01).

- **How an issue gets there.** An explicitly configured allocator or operator starts `triage` on it: `triage` sets the category, priority and risk and writes the Agent Brief, or puts a `blocked` hold on it with a comment that starts `🤖 HUMAN-ONLY:` and names the one thing a person must do. A person who wants the Definition of Ready check and implementation notes first starts `triage` from the cockpit: `om-auto-manage-issues`, then `triage`, in one run so the two never race on the same labels. `spec-to-tickets` files tickets whose body is their brief; `plan-to-spec` writes the spec for a stage of `docs/plans/` that nothing covers yet, which `spec-to-tickets` then slices.
- **How it leaves a hold.** A hold an agent set that does not say `HUMAN-ONLY:` is offered to `unblock`, which asks a specialist (§ Delegated decisions): on a verdict it removes `blocked` and posts `🤖 RESOLVED:`, otherwise it posts `🤖 HUMAN-ONLY:` and leaves the hold. A hold a person set, or a person commented on last, and a `HUMAN-ONLY:` one stay until a person removes `blocked`; the issue still has no Agent Brief, so the Reconciler triages it again.
- **Limits on skills:** an implementing run takes `risk-high` or `security` work only on a security and tenancy specialist's approving verdict, recorded with its conditions as acceptance criteria, and it re-derives the risk from the area the brief touches rather than trusting the label. Skills never close an issue and never remove a hold a person set or took over; they lift only what an agent set, and only on a specialist's verdict or a checked fact.
- **Human override:** a person starts any workflow on any issue from the cockpit at any time: `triage`, `issue-autofix`, `spec`, `implement-ticket`.

## The QA gate

The one hard rule of this process: **a PR carrying `needs-qa` must not merge until it also carries `qa-approved`, even when every other check is green.** `om-merge-buddy` classifies such a PR as blocked; `om-approve-merge-pr` refuses to merge it. The label rules in this section are a convention those merge skills read; no CI check enforces them (ADR 0031).

- Apply `needs-qa` to UI changes, new features, and other user-facing behavior that needs manual exercise. Which paths make a PR `needs-qa` here is in `## This repository`.
- `skip-qa` is the explicit opt-out for docs-only, dependency-only, CI-only, test-only, and similarly low-risk non-user-facing changes. Never combine it with `needs-qa`.
- `qa-failed`, `do-not-merge`, and `blocked` are hard blocks regardless of every other signal. An active `qa` pipeline label means a tester is on the PR right now — never merge under an active tester.
- The gate is satisfied when a QA reviewer tests the PR and applies `qa-approved`.
- **Unattended sign-off**: the unattended run is the QA reviewer for every PR, `risk-high` and `security` included (owner decision 2026-10-06, ADR 0035). `om-auto-qa-pr --self-qa-signoff` attaches the evidence, a panel of specialist sub-agents judges it (`.agents/policies/decisions.md`; the security and tenancy reviewer sits on it for a `risk-high` or `security` PR), and on every member's approving verdict the run applies `qa-approved` + `qa-self-verified` under the self-QA exception below. A rejection goes to `om-auto-fix-pr` and QA again, at most three rounds; then the PR is `blocked` for a person (`.agents/policies/om-pr-autopilot.md`).
- **Self-QA exception**: when no QA reviewer has capacity in time, any engineer may sign off instead — but only by (1) checking the PR out and running it locally, (2) exercising the affected flow, and (3) attaching evidence to the PR: a screenshot of it working, or a written account of what was exercised and the observed result. Then apply both `qa-approved` (so the gate passes) and `qa-self-verified` (so the exception is auditable). No evidence, no `qa-approved`.

## The claim protocol

Before every GitHub item mutation, follow the installed skill and `.ai/trackers/github.md`:
acquire an atomic `refs/om-locks/{issue|pr}-N` lock with a unique run owner, verify `in-progress`,
re-read the issue/PR and complete comments, then recompute the intended write. Respect assignees,
human holds, foreign locks and local leases. Release on every exit using the expected lock SHA.
No error permits fallback to comment-only acquisition; a shared login never proves ownership.
Recovery requires positive evidence that the owner and delegated work stopped. Time alone is
not sufficient. The narrow CAS cleanup exception never permits rewriting a project branch.

The `om-auto-manage-issues` write transaction serializes housekeeping per issue; read-only scans
need no claim. `.agents/workflows/` contracts follow the same protocol before writing briefs,
labels or comments. Existing human holds and the label guards remain mandatory.

### Reporting is decoupled from CI

Agents apply labels, submit reviews, and post comments **as soon as their work is done**, without waiting for CI to go green. A review submitted while checks are still running says so in its body: branch protection plus the QA-approval gate hold the actual merge, and the approval covers the code, not a green run. The CI outcome arrives afterwards as a follow-up comment, which also corrects the pipeline label if the result changes the verdict.

The wait for that outcome is bounded by `ci.maxWaitMinutes` (default 40). When it expires with checks still running, the agent stops waiting, runs the local validation gate as its own evidence, posts that together with the still-pending check names and an explicit statement that no further follow-up is coming, drops `ci-monitoring`, and finishes.

A red signal does not short-circuit the review either. A failing required check or a conflicted head is collected as a **blocker finding** and reported together with the full code review, never instead of it: one review cycle gives the author the failing check, the conflict, and every code finding at once, rather than the cheapest red flag first and another cycle to discover the rest. Such a verdict is still `changes-requested` — completeness changed, the gate did not.

None of this touches the merge gates. Reporting early is safe; merging early is not — required checks still gate every merge, and the merge tooling refuses until they are genuinely green.

## The automation contract

The `om-auto-*` skills run this process unattended and are chainable: each accepts the artifact the previous one produced (an issue id, a spec path, or a PR number from the `PR: #<number> (link: <url>)` reference line every PR-producing skill emits), and each detects work already started — an open PR referencing the issue or plan — and continues on it rather than opening a duplicate. A completed autonomous run leaves a **ready** (non-draft), fully labeled PR — one pipeline label, category, QA meta, one priority, one risk — with a run-summary comment and, for user-facing changes, screenshots from the working app attached as PR evidence. Draft PRs are reserved for explicitly incomplete states: spec-only design PRs, interrupted hand-offs, or autonomous defaults flagged for human confirmation. Automation applies `qa-approved` only through the unattended sign-off in the QA gate.

Two properties bound the whole unattended loop, and both are worth stating plainly because they are what make it safe to leave running:

- **The pipeline merges into `develop` only.** A reviewed PR is squash-merged into `develop` after `om-pr-autopilot` review/QA, native CI waiting and `om-approve-merge-pr`, behind the ruleset and the QA gate (ADR 0031), `risk-high` and `security` PRs on a security and tenancy reviewer's verdict (ADR 0035); the `develop` -> `main` promotion (it carries `do-not-merge`) and every spec PR but one stay with a person: the `om-auto-write-spec` flow, and the spec task `implement-ticket` writes. The one is a spec PR `plan-to-spec` wrote: it is reviewed by an independent specialist panel (§ Delegated decisions), its verdicts are recorded in the PR body, and the pipeline merges it once CI is green (ADR 0033); a security reviewer that does not approve, or a verdict that escalates a case `decision protocol` § 5 lists, leaves it `blocked` for a person, while any other specialist's standing **revise** goes to a second specialist.
- **The cap is on inventory, not on rate.** `--next` and `--plan` start no implementation while three PRs wait for a person (`blocked`, or `changes-requested` untouched for 24 hours, which is an autopilot parked on a decision; QA and risk labels are the agents', ADR 0035), so a burst of intake cannot outrun the review only a person can give. Raising throughput means reviewing those PRs, not tuning the Reconciler.

## Unattended decisions

Unattended workflows use `.agents/workflows/` contracts and Open Mercato skills. Where a person would be consulted, the skill has an independent specialist sub-agent settle it (§ Delegated decisions), applies the verdict and records it as a row in a **Resolved assumptions** table (`# | Question | Applied default | Why`) in the brief, spec or PR body it writes. Humans review those rows at the PR, and overturning one is an ordinary review finding. Domain terms and decisions follow `domain modeling policy`: `CONTEXT.md` is updated in the same change, and ADRs are written only when a decision is hard to reverse, surprising, and a real trade-off.

A state an unattended pipeline can enter needs an exit that does not require a human to type something. When a state's only on-by-default exit is a person noticing it, work accumulates there silently: name the exit when the state is introduced, or do not introduce the state.

### Delegated decisions

A choice between options is not a reason to stop or to hand an issue to a person. An unattended skill that would present options, a "Decision for the implementer", a "human's call" or a `blocked` hold hands the question to an **independent specialist sub-agent** instead (product owner, software architect, security and tenancy, accessibility, UX, test engineer, manual tester, or configuration guardian; fresh generic sub-agents using the role briefs in `.agents/reviewers/` where one fits), applies the verdict, records it as a Resolved assumptions row, and continues the work in the same run. The protocol, the verdict format and the short list of cases that still need a person are in `.agents/policies/decisions.md`. A skill that stops on a question this protocol could settle is a defect to fix in the skill.

## Validation gate

Every PR passes the full validation gate before review sign-off. **The command list lives in exactly one place: `.ai/agentic.config.json` → `validation.commands`, in order.** This section deliberately does not repeat it, and neither should `AGENTS.md`, `CONTRIBUTING.md`, a skill, or a workflow file — a gate written down twice is a gate that disagrees with itself, and the copy an agent happens to read is the one that wins.

Any non-zero exit fails the gate and blocks the PR. The implementing skills run the configured gate before opening a PR, and `om-check-and-commit` runs it before pushing a hand-worked branch. Changing the gate means editing that one key; anything that needs the list at runtime reads it from there.

Use `node scripts/ci/validation.mjs` to execute that list in order. It expands the pinned unit-test
command into the same three Vitest projects (UI starts as four complete shards after exceeding this
host's nine-minute budget), bounds each job to nine minutes and retries a timed-out
or killed project as all four shards. It emits a compact JSON result with full log paths under
`.ai/tmp/validation/`. Each command receives a private temporary directory there through
`TMPDIR`, `TMP` and `TEMP`, isolating transformation caches from the host temporary filesystem.
After exit or verified timeout termination it is removed. An unverified termination instead fails
closed as infrastructure/exit 1 without shard retry, retaining caller-owned diagnostics and group
metadata in the receipt; see [retained diagnostic ownership](docs/agents/cezar.md).
`--resume` reuses successful local jobs only when the tracked content, command
list, runtime, environment and installed manifest digest match; stage untracked inputs first.
Ignored fixtures, services and changes inside installed packages are outside that digest, so resume
is a local interruption-recovery convenience, never trusted CI evidence. After those inputs change,
run fresh. Attestation always invokes the same executor fresh and refuses a checkout that changed.

### Agent attestation (ADR 0045)

With `pipeline.requireExecutedCi: true`, required CI jobs must execute; attestations do not skip them and the `attest` command publishes no skip record. The native wait checks their actual results. For projects without that policy, when the gate is green on the commit an agent is about to hand over, it records that with `node scripts/ci/attestation.mjs attest --pr <n>`: the script runs the committed head's gate from a clean tree and posts the result as a PR comment bound to the tree. CI's `attestation` job accepts it, and `lint · typecheck · build` and `unit tests` then report skipped (which counts as passed) instead of repeating the run. Do it **after the last push**: another commit changes the tree and voids the record, and the full jobs run as before. A diff that touches the gate itself or a `risk-high` path never rides on an attestation, and the e2e journeys always run. The push to `develop` runs everything and gates the deploy.

### Draft until the last push

A draft runs no CI (ADR 0037), so a chain keeps its PR a draft while it still pushes and lets CI start once, on the head it hands over. The chain opens the PR with `om-open-pr --draft` and keeps pushing review, QA and fix-round commits to it. After the last push it attests only if the policy permits skipping CI (above), then marks the PR ready (`gh pr ready <number>`); that `ready_for_review` is what starts CI. It never ends a run on a draft it opened: `om-approve-merge-pr` stops on drafts, so a stranded one never merges. A push after the PR is ready (a CI repair) re-runs CI as before and needs a new attestation.

## Repo automations

The retained workflows are documented in `docs/agents/cezar.md`. They use official Cezar with
Codex and the sole skill installation under `.agents/skills/`. Workflow contracts and reviewer
briefs are ordinary documents loaded through `AGENTS.md`, not additional registered skills.
Schedules are separate operational state. The 2026-11-15 audit in
`docs/agents/automation-audit.md` distinguishes local saved records from confirmed running jobs.
Do not install, enable or reconcile schedules as a side effect of a repository update.

One allocator owns an item. Local leases and run records remain additional checks, but do not
replace GitHub atomic item locks. Pause/drain old workers before an ownership-protocol cutover;
never adopt their claims solely because they use the same account.

## Amending this process

This document and `.ai/agentic.config.json` describe the same process: change them together, and re-run the `om-setup-agent-pipeline` skill when the toolchain or label taxonomy changes. Per-skill deviations — extra review rules, a different PR body template, an added gate step — belong in a repository policy at `.agents/policies/<skill-name>.md`, loaded by `AGENTS.md`, which takes precedence over the installed skill (and can `@`-import or reference it to extend rather than replace it); local rules win, but a repository policy cannot grant what the installed skill's safety rules forbid.

Two amendment rules are specific to this document's shape:

- **This file deliberately diverges from the `om-setup-agent-pipeline` SDLC template** by naming the base branch, the merge mechanics, the QA routing and the automations once, in `## This repository`, instead of rendering them throughout. Re-running that skill must not push those values back into the body.
- **A fact about how this repository actually runs belongs wherever a reader will act on it, and it belongs there true.** Two of the three rules that used to stand here protected a word-for-word parity with a sibling repository; the kit that enforced it is retired (ADR 0025) and the parity with it, so they are gone. They are worth remembering for what they cost: the pressure to keep the body identical is what pushed a local fact into a general sentence, and the sentence then said that post-merge housekeeping does not run on a schedule here when a launchd agent had been running it three times a day the whole time. When a statement would only be true in some repository, name the repository — never soften the statement until it is true nowhere.

## This repository

- **The base branch is `develop`.** Feature branches are squash-merged into it. The
  `develop` → `main` promotion is a separate PR merged with **a merge commit**, never squashed
  (ADR 0003): only a merge commit advances the merge base, and a squashed promotion compounds
  conflicts on every promotion after it. The tracker **merge-pr** operation reads the PR's
  current base: `main` uses `--merge`, other branches use `--squash`. The repo-local
  `om-approve-merge-pr` override refuses an explicitly requested squash or rebase on `main`.
  A merge queue still selects its own method; the operation enqueues without a strategy.
  The `main` ruleset remains the independent server-side guard.
- **The release log is `CHANGELOG.md`, and its topmost heading is the version of record.** There is
  no `version` in `package.json` and no release tags, on purpose — the file's own header says why,
  and `om-auto-update-changelog`'s repo-local override says how to resolve `--version` without one.
  Two things read that heading: the changelog skill, and `om-close-fixed-issues`, whose default
  `--since last-release` is how the housekeeping sweep knows how far back to look. **That boundary
  is a floor, and it only ever moves forward.** Before the file existed the lookup fell back to the
  last seven days, so anything older stayed open — and GitHub would not close it either, because
  `develop` is not the default branch. A dated heading does not reach back past itself and recover
  those: it swaps a rolling seven-day window for a fixed one, so the first sweep after a new heading
  lands reads a _narrower_ window than the sweep before it did. Reconciling what merged before the
  first heading is a one-time explicit backfill — `om-close-fixed-issues --since <date>` with a
  `--limit` wide enough to reach that far back, because the default 50 is itself a shorter reach
  than the date bound — and it is tracked as its own issue (#697), not implied by this file
  existing. Draft
  the next entry by hand on the open promotion PR; it is deliberately not on a schedule, because a
  person writes the Highlights paragraph.
- **CI is the merge authority** (ADR 0021). The local validation gate is the fast loop that keeps a
  PR from wasting a CI run; the required checks on `develop` are what actually gate the merge, and
  a reviewer reads them rather than the agent's own report. The critical journeys run on **every**
  PR in two shards (ADR 0016); WebKit runs nightly, not per PR (ADR 0022, #552). A PR whose diff
  stops at documentation skips them, on the `scope` job's word — there is no label that turns them
  on or off.
- **Who starts a run.** No label does (ADR 0032). The Reconciler triages an issue a maintainer
  opens, implements a ready one and slices a merged spec (§ The Reconciler); a PR is driven by
  its own automations. PR repair and second opinions require an explicit request; review findings
  never re-arm a run. A person can start any workflow from the cockpit.
- **Risk here.** `risk-high` means the diff touches `src/server/auth`, `src/server/repos/base.ts`,
  `src/server/billing`, `src/server/db/schema.ts`, `drizzle/` or `src/server/public`.
- **QA routing.** A PR that reaches `src/routes`, `src/components`, `src/styles`,
  `src/server/email` or a locale file carries `needs-qa`; everything else carries `skip-qa`. The
  visual judgement is the blind pair of ADR 0016, and critical journeys replace the old visual gate;
  `om-auto-qa-pr` evidence complements that and never replaces it.
  The sole base/head-pair alternative is SPEC §7’s bounded base-absent unmounted-screen
  exception, with its complete non-comparative evidence and unanimous independent panel;
  existing and mounted screens retain comparisons.
- **What a ticket contains** beyond the Definition of Ready: `docs/agents/issue-tracker.md`. The
  label page is `docs/agents/triage-labels.md`, and the live automation definitions are
  `docs/agents/cezar-automations.json` (see `docs/agents/cezar.md`).
- **Native merge queue remains off (#537, closed as not planned).** The `merge-queue` label is
  a process marker, not a native GitHub merge queue. A merge into `develop` is
  automatic once reviewed and green, a merge into `main` is manual (ADR 0031). Reconsider a native queue only if
  measured merge contention justifies it. Before enabling one, every required check must run on
  `merge_group`, with explicit scope/e2e conditions and non-colliding concurrency groups;
  promotions must retain merge commits, and the rollout must document a rollback to manual merging.
- **Sources of issues.** People, through the issue forms (blank issues are off, so every issue
  enters with a category); Sentry findings as `bug` + `priority-high`, triaged unattended and implemented only on a brief written from the code (ADR 0040);
  and follow-ups from `om-followup-issue-from-pr` and `om-review-prs`.
- **The product layer is off.** No `.ai/specs/product-brief.md`, no `discovery` block in
  `.ai/agentic.config.json`, and the four skills it needs — `om-setup-discovery-pipeline`,
  `om-synthetic-users`, `om-backlog`, `om-mockup-prototype` — are the four `skills-lock.json` is
  missing (37 of the collection's 41). So `## Product decisions as a protected contract` describes
  nothing that is enforced here, and no decision ids exist to quote in a review. Turning it on means
  installing those four first — `om-setup-discovery-pipeline` cannot be run before it is installed —
  then running it and `om-discover` (that one _is_ installed); until then the Definition of Ready's
  ticket-level tier is the only product gate. **The optional discovery layer (upstream note
  2026-09-07) is not adopted** — decided in #728: not now, and it stays documented as off. The
  Design stage and the Designer role above are not enabled here either.

### Workflow dispatch and housekeeping

`backlog-status.mjs --plan` is a read-only candidate report. It does not launch work. A configured
operator or allocator may dispatch the retained `triage`, `unblock`, `implement-ticket`,
`spec-to-tickets` and `plan-to-spec` workflows. Repository preparation does not install that allocator.
The Agent Brief, dependency, WIP and human-hold checks above remain mandatory.

Housekeeping uses `om-close-fixed-issues` with the upgraded atomic ownership protocol. The
legacy deterministic helper reports candidates only and refuses `--apply`; stale claims are
never released on age or login alone. Current candidate schedules and retirement recommendations
live in `docs/agents/automation-audit.md`.

## Controlled release and exploratory work

The implementation pipeline still merges only into develop. The deterministic release workflow
may merge develop into main after current-head staging observation, complete CI and whole-range
risk checks. A high-risk range needs a trusted current-head approval on the promotion PR;
`do-not-merge` continues to exclude the promotion from every agent merge flow. This path is
inactive until the rollout gates in docs/agents/autonomy-rollout.md are verified.

Product discovery uses active turn minutes over seven days, excluding parked CI gaps. Unknown
telemetry, an incident, an existing exploratory implementation or a share of at least 20% blocks
new exploratory implementation only. `pipeline.productDiscovery` stays false during rollout.
