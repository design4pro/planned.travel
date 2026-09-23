# Software delivery process

## Purpose

This file documents how work flows from ticket to merged PR in this repository. The agent skills configured in `.ai/agentic.config.json` enforce the process; humans read it here. Issues and PRs live in GitHub, with every tracker operation the skills run defined in `.ai/trackers/github.md` (edit that file to extend or override tracker behavior).

This document is this repository's own. Until the agent kit was retired (ADR 0025) it was shared word for word with a sibling that runs the same pipeline, and a marker near the end cut the shared part from the local one. Nothing renders or enforces that parity now, and a fix that belongs in both repositories is written in both by hand — so the marker is gone, and with it the rules that protected it. What the split got right is kept: **the base branch is `.ai/agentic.config.json` → `baseBranch`**, it is named once under `## This repository`, and everything here that says "the base branch" means that value.

Work enters through two paths: a free-form task brief handed to an agent, or a filed ticket. Both converge on the same review loop, the same validation gate, and the same merge gates.

Before intake, the work is shaped: `om-brainstorm` turns a single idea or question into a routing decision and a brief, and the spec skills (`om-spec-writing`, `om-auto-write-spec`) turn a feature into a design document before anything is built. Those steps feed the table below; they are not the ticket flow itself, and the Definition of Ready is the contract between them and Intake. A product-level step sits above both — `om-discover`, writing the brief every later decision reads — but it is **not enabled here**; see `## Product decisions as a protected contract`.

## Roles

- **Author** — the human or agent who writes the change. Owns the ticket from claim to a merge-ready PR.
- **Reviewer** — reads the diff and approves or requests changes. May be a human or the `om-auto-review-pr` skill; the `om-code-review` checklist applies either way.
- **QA reviewer** — manually exercises user-facing changes before they merge. Always referenced by role, never by name or handle: assignments change.
- **Maintainer** — owns branch protection, the label taxonomy, the config, and this document; arbitrates when gates conflict.

## Ticket lifecycle

| Stage                   | What happens                                                                                                                                                                                                                                                                                                                                                                                       | Driven by                                                                                        | Done when                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Discovery               | An idea, question, or itch is talked through: the problem is questioned, alternatives (including building nothing) are weighed, and the conversation ends in a routing decision. The product-level half of this stage — establishing the context every later decision reads, from material that exists, with every claim tagged by its evidence — is `om-discover`, and it is not enabled here.    | `om-brainstorm` (one idea), or a human                                                           | A routed conversation, with a brief when the work continues     |
| Intake                  | A ticket or task brief is filed in GitHub and meets the Definition of Ready below. `om-prepare-issue` files it with SDLC labels and the ready sections; `om-auto-manage-issues` grooms what is already filed and reports what it still lacks. Agents file tickets too: `afk-to-tickets` slices a merged spec into tracer-bullet tickets, and `afk-architecture-review` files deepening candidates. | Anyone, `om-prepare-issue`, `om-auto-manage-issues`, `afk-to-tickets`, `afk-architecture-review` | Ticket exists and is ready, or its gaps are named on the ticket |
| Triage                  | Confirm the issue is real, still unfixed on the base branch, and not already claimed or covered by an open PR. Then write an Agent Brief and set exactly one intake label (see Intake labels below). Read-only on code; stops the chain cleanly when there is nothing to do.                                                                                                                       | `afk-triage`, `om-verify-in-repo`, or a human                                                    | One intake label set, or closed as no-action                    |
| Claim                   | The author claims the ticket so concurrent agents back off. See the claim protocol below.                                                                                                                                                                                                                                                                                                          | `om-fix` / `om-auto-create-pr`, or a human                                                       | Claim visible on the ticket                                     |
| Implement               | Locate the minimal change surface (`om-root-cause`, read-only), then implement the change with regression tests and run the validation gate. Task briefs without a ticket go through `om-auto-create-pr`, which plans, implements phase by phase in an isolated worktree, and runs the same gate.                                                                                                  | `om-root-cause` + `om-fix`, `om-auto-create-pr`, or a human author                               | Change complete, validation gate green                          |
| PR                      | Commit, push, and open a PR against the base branch with normalized labels. On a hand-worked branch, `om-check-and-commit` runs the gate, fixes obvious drift, and pushes when green.                                                                                                                                                                                                              | `om-open-pr`, `om-auto-create-pr`, or `om-check-and-commit`                                      | Open, labeled PR                                                |
| Review loop             | The reviewer reads the diff against the `om-code-review` checklist and approves or requests changes. Requested changes are addressed (`om-auto-continue-pr` resumes agent PRs from the tracking plan, and adopts a PR that has none by reconstructing the plan from the PR's own context) and the PR is re-reviewed until approved.                                                                | `om-auto-review-pr` (single PR), `om-review-prs` (sweep), or a human                             | Approving review submitted                                      |
| QA                      | A PR carrying `needs-qa` waits for manual QA. A QA reviewer tests it and records the outcome. See the QA gate below.                                                                                                                                                                                                                                                                               | QA reviewer (manual)                                                                             | `qa-approved` applied, or `qa-failed` routes it back            |
| Merge                   | `om-merge-buddy` reports, read-only, which PRs can merge now and which are close but blocked. `om-approve-merge-pr` re-checks every gate, approves, and merges by whatever mechanism `## This repository` names.                                                                                                                                                                                   | `om-merge-buddy` + `om-approve-merge-pr`, or a human                                             | PR merged into the base branch                                  |
| Post-merge housekeeping | Close issues the merged PR fixes; comment on issues whose PRs were closed without merging; turn leftover asks or review comments into tracked follow-up issues.                                                                                                                                                                                                                                    | `om-close-fixed-issues`, `om-followup-issue-from-pr`                                             | Tracker reconciled, follow-ups filed                            |

## Definition of Ready

A ticket is ready for implementation when the answers below are on the ticket or in a spec it links. They come in two tiers, because a spec can supply the second but never the first.

**Ticket-level — only a human can supply these:**

- the problem or need, and who has it (a user or a role);
- the expected outcome, and how it will be checked;
- what is out of scope;
- open questions, each marked blocking or non-blocking — no blocking question left unanswered;
- any autonomous assumption confirmed by a human (the resolved-assumptions comment on a spec PR).

**Spec-level — a covering spec supplies these, and `om-auto-write-spec` writes them when they are missing:**

- acceptance criteria;
- business rules;
- the happy path and the main unhappy paths;
- impact on data and permissions;
- dependencies;
- a link to the prototype or mockups when the change is user-facing.

For a bug, ready means reproducible: `om-verify-in-repo` is that gate, and the list above applies only to its ticket-level items. Enforcement: `om-prepare-issue` files tickets with these sections; `om-auto-manage-issues` records `READY_STATUS` per issue and posts a not-ready comment naming what is missing; `om-auto-fix-issue`'s feature route stops on a ticket that fails the ticket-level tier instead of speccing around the gap, the way `om-verify-in-repo` stops on a bug that is not real. Spec-level gaps are not a stop — the spec is authored. A maintainer may waive an item by saying so on the ticket.

**The Definition of Ready is the gate an unattended pipeline is built on.** `READY_STATUS` is the one machine-readable verdict that says a ticket can be worked without asking a person a question, so every automatic hand-off from grooming to triage reads it and nothing downstream re-derives it. A ticket that is not ready is commented on and left alone; it is never handed to an implementing agent on the theory that the agent will work the gap out.

## Product decisions as a protected contract

**This section describes a layer that is not switched on here.** It rests on a product brief at `.ai/specs/product-brief.md` whose **Non-goals**, **Business rules** and **Decisions** tables carry stable ids (`N01`, `R03`, `D07`), an owner, a status and a review-by date, and are then protected in review the way `BACKWARD_COMPATIBILITY.md` protects contract surfaces — a PR contradicting an entry is a blocker until a superseding row lands with it.

There is no such file in this repository, the `discovery` block is absent from `.ai/agentic.config.json`, and the four skills the layer needs — `om-setup-discovery-pipeline`, which installs it, plus the feeders `om-synthetic-users`, `om-backlog` and `om-mockup-prototype` — are exactly the four the collection has and `skills-lock.json` does not (37 of 41). So nothing above is enforced today, and a reader should not go looking for decision ids that do not exist. Turning it on starts by installing those skills, because the setup skill is itself one of the missing ones; `## This repository` says so again where the rest of the local facts are.

## Scoping rule (SLC)

Every spec, ticket and agent-sized issue is scoped **Simple, Lovable, Complete** (Jason Cohen, "Your customers hate MVPs. Make a SLC instead"), not as a minimum viable product:

- **Simple**: the narrowest scope that does one job. Split anything that does not fit one ticket, or one fresh agent context.
- **Lovable**: no rough edge is left "for later" inside that scope. Error states, empty states, docs and tests ship with the change.
- **Complete**: the slice is useful and verifiable on its own. A change that only works once a later ticket lands is a layer, not a slice: merge it into the slice it serves.

A request that fails the rule is re-scoped (a spec, or tickets), not implemented partially. `afk-triage` and `afk-to-tickets` both gate on this rule: a ticket too large for one fresh agent context goes to `ready-for-human`, never to `ready-for-agent`.

## Label state machine

Pipeline labels are mutually exclusive: a PR carries at most one, and it names where the PR sits in the flow.

- A ready, non-draft PR carries `review`.
- The reviewer moves it: request changes → `changes-requested`; after fixes it returns to `review`; approval → `merge-queue`.
- `merge-queue` is routing, not proof of QA: a `needs-qa` PR legitimately sits there until QA signs off. The label is this state machine's and is not GitHub's merge queue: a PR carrying it is waiting for the merge step `## This repository` describes, and only that step puts it in whatever queue GitHub runs.
- Only a QA reviewer sets the `qa` pipeline label. They move a queued `needs-qa` PR from `merge-queue` to `qa` while testing, then back to `merge-queue` with `qa-approved` on pass, or to `qa-failed` on failure. Automated skills request QA with `needs-qa`; they never set `qa`.
- `blocked` and `do-not-merge` are set and cleared by humans and stop the flow wherever it is.

| Group    | Labels                                                                                     | Exclusivity                   | Meaning                            |
| -------- | ------------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------------- |
| Pipeline | `review`, `changes-requested`, `qa`, `qa-failed`, `merge-queue`, `blocked`, `do-not-merge` | one at a time                 | Workflow state                     |
| Category | `bug`, `feature`, `refactor`, `security`, `dependencies`, `documentation`                  | additive                      | Kind of change                     |
| Meta     | `needs-qa`, `skip-qa`, `qa-approved`, `qa-self-verified`, `in-progress`, `ci-monitoring`   | additive                      | Process signals                    |
| Priority | `priority-low`, `priority-medium`, `priority-high`, `priority-extreme`                     | one at a time; unset = medium | Urgency of the work                |
| Risk     | `risk-low`, `risk-medium`, `risk-high`                                                     | one at a time; unset = medium | Blast radius of the change         |
| Intake   | `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`                         | one at a time; issues only    | Who acts on the issue next         |
| Command  | `groom`, `autofix`, `spec`, `review-threads`                                               | additive; consumed by the run | Start one run now                  |
| Outside  | `do-not-close`                                                                             | additive                      | A human hold no skill may override |

The first five groups are a PR's; **Intake** is an issue's and **Command** is either's, and each has its own section below rather than a line here. A repository may add a switch of its own outside the taxonomy; `## This repository` names it. Every group is also `labels.*` in `.ai/agentic.config.json`, and that file is what the skills read — a label this document names and the config does not is a label no skill will apply.

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

When signals conflict, pick the higher label and say why in the label comment. A `risk-high` PR strengthens the case for `needs-qa` and deeper review even when it would otherwise look routine, and it puts the issue out of reach of every unattended implementing skill.

## Intake labels

Intake labels go on issues only, one at a time, and say who acts on the issue next. They come before the PR pipeline above. The list lives in `.ai/agentic.config.json` as `labels.intake`.

| Label             | Meaning                                                                                                                       | Set by                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `needs-triage`    | Groomed and ready by the Definition of Ready, but not yet evaluated for an agent                                              | Humans; `afk-architecture-review` for its `Strong` candidates     |
| `needs-info`      | Waiting on the reporter                                                                                                       | `afk-triage`, humans                                              |
| `ready-for-agent` | Briefed and safe to implement unattended. Where `## This repository` says so, adding it launches the implementing automation. | `afk-triage`, `afk-to-tickets` (frontier tickets only), humans    |
| `ready-for-human` | Briefed, but needs a person: security, `risk-high`, a spec, a duplicate, a decline, or a judgement call                       | `afk-triage`, `afk-to-tickets`, `afk-architecture-review`, humans |

- **Transitions:** an issue labeled `needs-triage` moves to exactly one of `needs-info`, `ready-for-agent` or `ready-for-human`. When the reporter answers a `needs-info` issue, a human moves it back to `needs-triage`, and triage runs again. Re-triaging a decided issue means removing `ready-for-agent` or `ready-for-human` first, then adding `needs-triage`.
- **Grooming comes first.** `om-auto-manage-issues` owns `issue.opened` and adds the SDLC labels and the Definition of Ready check. `afk-triage` answers the `needs-triage` label instead, so the two never groom one issue at the same time.
- **Grooming hands a ready issue on, within a narrow gate.** A finished groom records `READY_STATUS`, and when that status is `ready` it adds `needs-triage` as its last mutation — which is what starts `afk-triage`. This was the open gap in this process: grooming used to record the status and stop, so an issue arriving through the issue form waited for a human to add an intake or trigger label before anything else happened. The gate is narrow on purpose, and the conditions are in `.ai/skills/om-auto-manage-issues/SKILL.md`: the issue must be maintainer-opened and `ready`, must carry no intake label already, no trigger label, and neither `risk-high` nor `security` nor `dependencies`. Anything else still waits for a person. The reason the gate is not wider is written in the `Triage new issues` automation itself — it treats `needs-triage` as a label only a collaborator can set, and grooming is not a collaborator; what crosses it is an issue a maintainer already opened and that already passed the Definition of Ready. `afk-architecture-review` also sets the label, on the `Strong` candidates it raises itself.
- **Limits on skills:** automated skills never add `ready-for-agent` to `risk-high` or `security` work, and never close an issue. Consuming `needs-triage` is exactly what `afk-triage` is for, so that one label it may remove; `ready-for-agent` and `ready-for-human` are terminal, and a skill never removes either once a human set it.
- **Human override:** a human may move any issue to any intake label at any time.

## Trigger labels

A trigger label is not a state: it is an instruction to start one run now. Adding one is how a human (or, for `review-threads`, a job) hands a specific piece of work to the pipeline out of band, and the skill's repo-local override removes the label as its first mutation — so a trigger label still present is a run nobody took.

| Label            | Starts                                    | Notes                                                                                                                                |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `groom`          | `om-auto-manage-issues` on one issue      | Labels, Definition of Ready check, implementation notes. The way an issue from someone other than a maintainer is groomed at all.    |
| `autofix`        | `om-auto-fix-issue`                       | A bug goes verify → root cause → fix → PR → review → QA; a feature goes spec → implement. The human express lane past triage.        |
| `spec`           | `om-auto-write-spec` on a `feature` issue | The spec lands under `.ai/specs/` on a design-only PR. Implementation is a separate run once that PR merges.                         |
| `review-threads` | `om-auto-fix-pr` on one PR                | The only trigger on a PR, and the only one no human adds: the review job applies it when it leaves threads the merge gate will hold. |

Two rules hold wherever these are wired:

- **A trigger label is never filed with the issue.** An issue created with its own trigger already attached produces two distinct events in one poll batch — the opened event and the label event — and launches two concurrent runs on the same ticket. File the issue bare and add the label afterwards.
- **No skill adds a trigger label to its own input.** Trigger labels are the human's lever; the intake ladder above is the pipeline's. Which triggers this repository actually wires is in `## This repository`.

## The QA gate

The one hard rule of this process: **a PR carrying `needs-qa` must not merge until it also carries `qa-approved`, even when every other check is green.** `om-merge-buddy` classifies such a PR as blocked; `om-approve-merge-pr` refuses to merge it.

- Apply `needs-qa` to UI changes, new features, and other user-facing behavior that needs manual exercise. Which paths make a PR `needs-qa` here is in `## This repository`.
- `skip-qa` is the explicit opt-out for docs-only, dependency-only, CI-only, test-only, and similarly low-risk non-user-facing changes. Never combine it with `needs-qa`.
- `qa-failed`, `do-not-merge`, and `blocked` are hard blocks regardless of every other signal. An active `qa` pipeline label means a tester is on the PR right now — never merge under an active tester.
- The gate is satisfied when a QA reviewer tests the PR and applies `qa-approved`.
- **Self-QA exception**: when no QA reviewer has capacity in time, any engineer may sign off instead — but only by (1) checking the PR out and running it locally, (2) exercising the affected flow, and (3) attaching evidence to the PR: a screenshot of it working, or a written account of what was exercised and the observed result. Then apply both `qa-approved` (so the gate passes) and `qa-self-verified` (so the exception is auditable). No evidence, no `qa-approved`.

## The claim protocol

Before mutating an issue or PR, an agent claims it with all three signals: it assigns itself, adds the `in-progress` label, and posts a claim comment saying what it is doing. Any agent that finds an existing claim backs off instead of colliding. A PR carrying `in-progress` is also skipped by the merge tooling.

`in-progress` means **actively working**. Once an agent's work is finished and fully reported — labels applied, review submitted, comments posted — it swaps `in-progress` for `ci-monitoring` if it still intends to report the CI outcome. `ci-monitoring` is **not** a claim and blocks nobody: it says only that the CI-result follow-up comment is still owed, so another agent or a human may act on the PR freely. That distinction matters because CI runs long: an agent that reported its work and then died while watching a run leaves an honest, self-describing state instead of a lock nobody holds. The label comes off when the follow-up lands, or when the agent gives up waiting at `ci.maxWaitMinutes` and says so.

The claim is released when the work finishes — on success and on failure alike. A stale `in-progress` with no recent activity may be cleared by the maintainer.

### Reporting is decoupled from CI

Agents apply labels, submit reviews, and post comments **as soon as their work is done**, without waiting for CI to go green. A review submitted while checks are still running says so in its body: branch protection plus the QA-approval gate hold the actual merge, and the approval covers the code, not a green run. The CI outcome arrives afterwards as a follow-up comment, which also corrects the pipeline label if the result changes the verdict.

The wait for that outcome is bounded by `ci.maxWaitMinutes` (default 40). When it expires with checks still running, the agent stops waiting, runs the local validation gate as its own evidence, posts that together with the still-pending check names and an explicit statement that no further follow-up is coming, drops `ci-monitoring`, and finishes.

A red signal does not short-circuit the review either. A failing required check or a conflicted head is collected as a **blocker finding** and reported together with the full code review, never instead of it: one review cycle gives the author the failing check, the conflict, and every code finding at once, rather than the cheapest red flag first and another cycle to discover the rest. Such a verdict is still `changes-requested` — completeness changed, the gate did not.

None of this touches the merge gates. Reporting early is safe; merging early is not — required checks still gate every merge, and the merge tooling refuses until they are genuinely green.

## The automation contract

The `om-auto-*` skills run this process unattended and are chainable: each accepts the artifact the previous one produced (an issue id, a spec path, or a PR number from the `PR: #<number> (link: <url>)` reference line every PR-producing skill emits), and each detects work already started — an open PR referencing the issue or plan — and continues on it rather than opening a duplicate. A completed autonomous run leaves a **ready** (non-draft), fully labeled PR — one pipeline label, category, QA meta, one priority, one risk — with a run-summary comment and, for user-facing changes, screenshots from the working app attached as PR evidence. Draft PRs are reserved for explicitly incomplete states: spec-only design PRs, interrupted hand-offs, or autonomous defaults flagged for human confirmation. Automation never applies `qa-approved`.

Two properties bound the whole unattended loop, and both are worth stating plainly because they are what make it safe to leave running:

- **The pipeline does not merge its own output.** A separate deterministic controller may merge a reviewed, current, low- or medium-risk PR into `develop` after CI and any required manual QA. Its exact gates and dry-run rollout are in `docs/agents/auto-merge.md`. `risk-high`, security work and promotion to `main` remain human merges.
- **The cap is on inventory, not on rate.** The implementing skills stop when enough agent PRs already wait in `review`, so a burst of intake cannot outrun review capacity. Raising throughput means reviewing, not tuning the trigger.

## Unattended decisions

The `afk-*` skills (`.ai/skills/`) run with no human to ask. Where a person would be consulted, the skill picks the most reversible reasonable option and records it as a row in a **Resolved assumptions** table (`# | Question | Applied default | Why`) in the brief, spec or PR body it writes. Humans review those rows at the PR, and overturning one is an ordinary review finding. Domain terms and decisions follow `afk-domain-modeling`: `CONTEXT.md` is updated in the same change, and ADRs are written only when a decision is hard to reverse, surprising, and a real trade-off.

A state an unattended pipeline can enter needs an exit that does not require a human to type something. When a state's only on-by-default exit is a person noticing it, work accumulates there silently: name the exit when the state is introduced, or do not introduce the state.

## Validation gate

Every PR passes the full validation gate before review sign-off. **The command list lives in exactly one place: `.ai/agentic.config.json` → `validation.commands`, in order.** This section deliberately does not repeat it, and neither should `AGENTS.md`, `CONTRIBUTING.md`, a skill, or a workflow file — a gate written down twice is a gate that disagrees with itself, and the copy an agent happens to read is the one that wins.

Any non-zero exit fails the gate and blocks the PR. The implementing skills run the configured gate before opening a PR, and `om-check-and-commit` runs it before pushing a hand-worked branch. Changing the gate means editing that one key; anything that needs the list at runtime reads it from there.

## Repo automations

The cezar cockpit runs this process unattended: an automation watches GitHub for one event, and launches one workflow from `.ai/cezar/workflows/` when a record matches its filters. The automations this repository runs are tabulated in `## This repository`; the definitions are committed, and the cockpit's copy under `.ai/cezar/` is runtime state that is rebuilt from them.

These operating rules were learned the hard way and apply to every repository running the cockpit:

- **`maxRecords` is an evaluation budget, not a launch cap.** A poll turns each record into observations — one per opened event, one per reconstructed label event — sorts them oldest-first and evaluates only the first `maxRecords`. A triage run applies four labels within seconds and the decisive one lands last, so a small budget evaluates the noise and never reaches the label that matters: the trigger reads as dead. Keep the schema default of 25. Cost is bounded by the WIP limit and the per-skill caps, never by starving this budget.
- **A repo-local skill is not invocable by name.** The cockpit injects a step's skill body as the agent's system prompt, but materializes only a _team_ skill into `.claude/skills/`. An agent that sees an `afk-*` name and calls the `Skill` tool gets `Unknown skill` and must recover on its own. So write an `afk-*` skill that never asks to be invoked, and point cross-references at `.ai/skills/<name>/SKILL.md` rather than naming a skill as something to load.
- **A cause is not established until an experiment reproduces it.** State a mechanism as a hypothesis until a controlled run reproduces it, and cite that run.
- **A substring match and a success banner are not evidence; read the field the system writes.** Searching a run's NDJSON for a token matches the _content_ of events — including files the agent read while it worked — not the system's own telemetry. The authoritative reading is each event's `type`. The shell form of the same error: capture an exit status before anything else runs, and when a search matches, confirm which field matched before concluding anything from it.
- **Never file an issue carrying the label that triggers its own automation.** The opened event and the label event are two records in one batch, and the receipt that prevents a relaunch keys on the automation plus the event rather than on the issue, so two concurrent runs start on one ticket.
- **Pausing an automation and enabling it again silently drops everything that arrived in between.** `enable` sets `baselineAt` to now and moves the cursor with it, and every candidate at or below the baseline is discarded. That is deliberate on a first enable — a backlog is never launched — and a trap for an operator who paused to investigate. To act on an item already pending, use `cez automation check <id> --execute`, which launches it without touching the baseline.
- **An automation resolves its workflow from the working tree, so switching branches disables every automation.** A branch that does not carry `.ai/cezar/workflows/` empties the directory, and the next poll logs `unknown workflow`. Switching back does not undo it: failures back off `60 s × 2^(failures-1)` capped at six hours. Treat any branch switch in the main checkout as pausing every automation, and read the log after one.
- **A failed launch still consumes the event: the receipt is reserved before the run starts and never released.** An event that failed for a transient reason is suppressed permanently — every later poll reports `duplicate`. Recovery is manual: delete the matching lines from `.ai/cezar/automation-receipts.ndjson`, which is runtime state, and re-check.
- **Read an automation's next poll time from its state file; never compute it.** Any operation that rewrites the working tree must run between polls. The authoritative value is `nextCheckAt` for that automation in `.ai/cezar/automation-state.json`. Read it, and abort when the margin is thin instead of trusting arithmetic over the system's recorded state.

**Bootstrap** on a running cockpit:

1. `cez automation create --file <definition>` for each definition. They are created paused.
2. `cez automation check <id>` for polls, or `cez automation run <id>` for schedules.
3. `cez automation enable <id>`.
4. After editing a definition, run `cez automation update <id> --file ...`.

The intake and trigger labels must exist first (`gh label create <label>`). To stop it all, `cez automation pause <id>`, or start the cockpit with `CEZ_AUTOMATIONS=0`.

## Amending this process

This document and `.ai/agentic.config.json` describe the same process: change them together, and re-run the `om-setup-agent-pipeline` skill when the toolchain or label taxonomy changes. Per-skill deviations — extra review rules, a different PR body template, an added gate step — belong in a repo-local skill of the same name at `.ai/skills/<skill-name>/SKILL.md`, which takes precedence over the installed skill (and can `@`-import or reference it to extend rather than replace it); local rules win, but a repo-local skill cannot grant what the installed skill's safety rules forbid.

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
- **Who starts a run.** `groom`, `autofix`, `spec` and `review-threads` are the trigger labels wired
  here, and no skill adds one to its own input. `review-threads` is removed inside the claim step,
  after `in-progress` is on, rather than before it (the `om-auto-fix-pr` override, #490), so the
  PR is never observably free. Alongside them the intake ladder runs:
  `needs-triage` starts triage, and `ready-for-agent` starts `implement-ticket`. A person can also
  hand an issue to the agent directly from the cockpit.
- **Risk here.** `risk-high` means the diff touches `src/server/auth`, `src/server/repos/base.ts`,
  `src/server/billing`, `src/server/db/schema.ts`, `drizzle/` or `src/server/public`.
- **QA routing.** A PR that reaches `src/routes`, `src/components`, `src/styles`,
  `src/server/email` or a locale file carries `needs-qa`; everything else carries `skip-qa`. The
  visual judgement is the blind pair of ADR 0016, and critical journeys replace the old visual gate;
  `om-auto-qa-pr` evidence complements that and never replaces it.
- **What a ticket contains** beyond the Definition of Ready: `docs/agents/issue-tracker.md`. The
  label page is `docs/agents/triage-labels.md`, and the live automation definitions are
  `docs/agents/cezar-automations.json` (see `docs/agents/cezar.md`).
- **Native merge queue remains off (#537, closed as not planned).** The `merge-queue` label is
  a process marker, not a native GitHub merge queue. A separate deterministic controller may
  merge eligible low- or medium-risk PRs into `develop` after current review, CI, and any required
  manual QA, after a separately gated rollout. `risk-high`, security work,
  and `develop` → `main` promotion remain manual. Reconsider a native queue only if measured merge
  contention justifies it. Before enabling one, every required check must run on `merge_group`,
  with explicit scope/e2e conditions and non-colliding concurrency groups; promotions must retain
  merge commits, and the rollout must document a rollback to manual merging.
- **Sources of issues.** People, through the issue forms (blank issues are off, so every issue
  enters with a category); Sentry findings as `bug` + `priority-high` + `groom`, never `autofix`;
  and follow-ups from `om-followup-issue-from-pr` and `om-review-prs`.
- **The product layer is off.** No `.ai/specs/product-brief.md`, no `discovery` block in
  `.ai/agentic.config.json`, and the four skills it needs — `om-setup-discovery-pipeline`,
  `om-synthetic-users`, `om-backlog`, `om-mockup-prototype` — are the four `skills-lock.json` is
  missing (37 of the collection's 41). So `## Product decisions as a protected contract` describes
  nothing that is enforced here, and no decision ids exist to quote in a review. Turning it on means
  installing those four first — `om-setup-discovery-pipeline` cannot be run before it is installed —
  then running it and `om-discover` (that one _is_ installed); until then the Definition of Ready's
  ticket-level tier is the only product gate.

### Automations

Workflows live in `.ai/cezar/workflows/`; the committed definitions are
`docs/agents/cezar-automations.json`, applied with `.ai/scripts/cez-automations.sh`.

| Automation                       | Trigger                               | Workflow                                          |
| -------------------------------- | ------------------------------------- | ------------------------------------------------- |
| Groom new issues                 | `issue.opened` by a maintainer        | `issue-groom` (`om-auto-manage-issues`)           |
| Re-groom on request              | `groom` added                         | `issue-groom`                                     |
| Fix issues on the autofix label  | `autofix` added                       | `issue-autofix` (`om-auto-fix-issue`)             |
| Write a spec for feature issues  | `spec` added to a `feature`           | `spec` (`om-auto-write-spec`)                     |
| Autopilot new pull requests      | `pull_request.opened` by a maintainer | `pr-autopilot`                                    |
| Resolve blocking review threads  | `review-threads` added                | `pr-fix` (`om-auto-fix-pr`)                       |
| Triage new issues                | `needs-triage` added                  | `triage` (`afk-triage`)                           |
| Implement ready-for-agent issues | `ready-for-agent` added               | `implement-ticket`                                |
| Spec to tickets                  | weekdays 07:00                        | `spec-to-tickets` (`afk-to-tickets`)              |
| Weekly architecture review       | Mondays 06:00                         | `architecture-review` (`afk-architecture-review`) |
| Weekly lessons                   | Fridays 16:00                         | `lessons` (`afk-lessons`)                         |

Five workflows have **no cezar automation**: `housekeeping` (`om-review-prs`, `om-merge-buddy`
report, `om-close-fixed-issues`), `backlog`, `brainstorm`, `implement-spec` and `pr-review`. Four
of them are started by hand from the cockpit.

`housekeeping` is the exception, and it matters because the sentence that used to stand here said
the opposite: **it runs on a schedule, just not on cezar's.** A launchd agent on the cezar host —
`dev.planned-travel.housekeeping`, template at `.ai/scripts/launchd/` — calls
`.ai/scripts/housekeeping.sh` at 07:00, 12:00 and 17:00 on weekdays, and that script POSTs one
`housekeeping` run to the cockpit's API. Cezar does have a scheduler — the table's last three rows
are wall-clock schedules, not events — but it takes one occurrence per automation, in the shapes
`weekdays` and `weekly`, each at a single time of day (`docs/agents/cezar-automations.json`). Three
runs a weekday is not one of them, so this cadence lives outside it (`docs/agents/cezar.md`
§ Housekeeping). So read "no automation" as "no row in the table above", never as "nothing starts
it" — the earlier wording told a reader that an issue whose PR merged stays open until someone runs
the sweep by hand, and that was wrong.

The `authors: ["rafalwolak"]` filter on the two `opened` automations is a security gate, not a
convenience: those runs read the issue or PR body as a prompt and hold Bash with no allowlist, so
anything from anyone else waits for a maintainer to add a trigger label.

**Guardrails:**

- Cezar never merges as part of implementation or review. The independent controller in `docs/agents/auto-merge.md` handles eligible `develop` PRs after the full gate.
- `implement-ticket` stops when three or more agent PRs already wait in `review`, and that cap is
  shared — the `issue-autofix` output counts against it too, because both ladders publish under the
  same `gh` identity.
- Neither triage nor implementation touches `risk-high` or `security` work.
- To stop it all, `cez automation pause <id>`, or start the cockpit with `CEZ_AUTOMATIONS=0`.

**Where an agent-layer file is fixed** (ADR 0025). Here, on the branch that needs it. The agent
layer — `.ai/cezar/`, `.ai/skills/`, `.ai/scripts/`, `.ai/trackers/`, `.claude/hooks/`,
`.claude/settings.json`, `scripts/ci/`, the Claude workflows — was rendered from
`design4pro/agent-kit`, hashed in a lock file and refused to every agent run by
`guard-generated.sh`. The kit is retired, the lock is gone, and the hook no longer refuses those
paths **in a cezar run**: no upstream issue, no sync pull request, no seed commit. Review is what
catches a change that should not have been made.

Two things still refuse, and neither is negotiable. **Under `GITHUB_ACTIONS` the same block is
absolute** — there the diff belongs to whoever opened the pull request, `claude-code-review.yml`
reads it with a write token, and a run that could write `.claude/hooks/` would disarm the guards
mid-flight. A finding on one of those paths is reported, not applied. And **a write outside the
worktree is refused in either mode**: a change that belongs to another repository is a pull request
there, from its own clone.

One further exception is not ours: `.claude/skills/` is pinned by `skills-lock.json` to
`open-mercato/skills`, to which we have no push rights. A repo-specific rule belongs in an
`.ai/skills/<name>/SKILL.md` extension instead; an extension can never relax a skill's safety rules.

`money-tracker.online` carries an agent layer that started as a copy of this one. Nothing keeps the
two in step, and nothing is meant to: each repository tunes its own. A fix that genuinely belongs in
both is written in both, by hand, as two ordinary changes.

### Known gaps in this pipeline

Named here because an unstated gap is one a reader rediscovers by losing work to it.

- **A dependabot pull request never enters the label state machine.** "Autopilot new pull requests"
  filters on `authors`, so nothing labels one: no pipeline label, no category, no QA meta. The
  `merge-gate` check passes it — it carries no hard block and no `needs-qa` — so an unlabeled
  dependency bump can merge while `## Label state machine` says a ready PR carries `review`.
  Labelling one is a human act today.
- **Stale claims outside the bounded review sweep still need a maintainer.** `om-review-prs`
  automatically ends its sweep with
  `node scripts/agents/release-leaked-claims.mjs --since <sweep start> --prs <dispatched PRs>`
  (#706). It only releases an `om-auto-review-pr` claim by the automation account when that is
  the PR's only lock event since the sweep started, and reports whether a review was submitted.
  Take-overs and newer claims after a release are left alone. The same bounded command with
  `--dry-run` previews manual recovery; arbitrary stale issue or PR claims still follow
  `## The claim protocol` and require the maintainer.
