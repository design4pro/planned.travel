# Paperclip delivery pilot

## Authority and activation

The developer authorized this two-lane low-risk pilot on 2026-11-10. Paperclip is
the sole coordinator and execution system. Cezar-specific schedules, identities,
run stores and cockpit instructions in older documents are historical for this
pilot. Repository validation, readiness, tracker and environment helpers remain
usable where they do not require a Cezar run identity. Do not fabricate CEZ_*
variables to enable them. This policy changes delivery coordination, not product
contracts, branch protection, trusted authors, holds or configured validation.

Activate only after this policy is merged into develop, before/after configuration
receipts are preserved, both Delivery agents use Codex CLI (`codex_local`),
`gpt-6.1-sol`, medium effort and the existing shared OpenAI connection, and the
PM's effective maximum concurrent runs is one. Keep the second agent paused and
without product work until those conditions hold. Use existing subscriptions and
allocations; change no company budget, provider, grant or permissions policy.

The PM owns one existing or newly justified rollout task and its `pilot` document.
Record activation time, policy commit, agent IDs, baseline cohort, two slot rows
and experiment results there. Existing owners, branches, PRs and holds survive.
The infrastructure/policy adoption PR is outside the low-risk product cohort and
uses the existing acceptance process. At activation verify the PM has a scheduled
Paperclip heartbeat at least daily. Record the effective cadence and deadlines
(activation + 14 days; last cohort merge + 7 days) in the pilot document. Each
heartbeat checks due reports even without a GitHub event. If that wake mechanism
is unavailable, keep activation closed. Use no external scheduler.

## Ownership and admission

The PM is the sole operational allocator. The CEO owns priorities, exceptions and
final publication; ordinary handoffs and corrections need no additional CEO vote.
Delivery A and B each own one implementation. Architecture and Quality & Trust
provide two independent full-diff acceptance verdicts. Specialists join for an
identified gap; existing tasks outside the pilot keep their original process.

Enroll only trusted, ready GitHub issues labelled risk-low with a bounded bug fix
or UI change, explicit acceptance criteria and no existing writer or open PR.
Check current issue comments, dependencies, readiness output and every applicable
hold before assigning. Unknown readiness or ownership refuses admission.
Exclude auth, tenancy, payments, deletion, schema/migrations, dependency changes,
agent/CI configuration and public contract changes. Reassess the actual diff;
if it crosses an exclusion, park it for the CEO's scope decision.

Before reserving a slot, acquire the Paperclip checkout of the rollout task and
re-read its current document. Serialize admission through that checkout; use
optimistic document revisions and stop on conflicts. Check all existing project
tasks and GitHub claims, then reserve one of two numbered slots for the canonical
issue URL and existing owner. An implementer with active non-pilot work is
ineligible until that work completes or is safely parked. Resuming non-pilot
work likewise requires finishing or safely parking any conflicting pilot
assignment first; one implementer never owns two active execution streams.
A repeated event reuses that reservation. No other
agent allocates or starts unreserved pilot work. If serialization cannot be
verified, admission stays closed.

A slot stays occupied through build, gate, review, corrections and merge waiting.
Free it only after verified completion or safe parking: save checkpoint and
unpushed changes, stop owned executions/services, release only owned claims and
record the observable resume condition. Preserve assignment while parked.
Resuming requires admission again; a parked task cannot silently take a third slot.

## Delivery handoff and isolation

Keep one `delivery` document on the implementation task, updated in place:

| Field     | Required value                                                     |
| --------- | ------------------------------------------------------------------ |
| Identity  | Canonical issue URL, owner agent ID, slot and acceptance criteria  |
| Scope     | Intended files, exclusions and identified integration dependencies |
| Workspace | Absolute worktree, branch, PR URL, current head and base SHAs      |
| Stage     | ready, build, gate, review, fix, merge, parked or done             |
| Round     | 1 for initial implementation, then at most 2 and 3 for corrections |
| Evidence  | Executed commands/results and links to CI, both reviews and QA     |
| Recovery  | Last checkpoint, blocker owner, resume signal and owned resources  |

Each lane uses a separate worktree, local test database, environment descriptor,
free port and browser session. Reserve distinct ports in the existing supported
test range; read the actual URL from each worktree's descriptor. Restart the
owned environment after changes before browser evidence counts. Stop processes
by owned PID, never by shared process name. Secrets stay outside artifacts.

Admit file-disjoint work only. Shared generated outputs or locale files count as
overlap. On an unexpected overlap, the PM parks one lane before more writes.
Recheck current develop and affected integration behavior before publication.
Push only the owned branch using `git push origin HEAD:refs/heads/<branch>`;
verify remote head and live PR state immediately before pushing. A competing
writer or closed PR stops publication. No direct develop/main pushes, force
pushes, bypassed hooks, admin merges, main promotion or production administration.

## Validation, independent review and QA

Run the complete gate from `validation.commands` in `.ai/agentic.config.json`
through the configured validation runner. A failed gate returns logs directly
to its owner before reviewers start. Missing, queued, cancelled, failed or unknown
required CI is not green. Local validation does not replace required native CI.
Reuse evidence only for the exact current head, base and applicable policy;
changed code or integration base invalidates evidence until rechecked.

For an explicitly enrolled pilot issue only, two named Paperclip reviewers replace
the additional persona subagents in om-code-review and the low-risk QA panel in
om-auto-qa-pr. This is a substitution of review coverage, not a waiver:

- Architecture Reviewer covers correctness, architecture, maintainability,
  regression contracts and the product/acceptance promise.
- Quality & Trust Reviewer covers user flows and manual edge cases, security
  applicability, WCAG 2.2 AA, keyboard/focus behavior, responsive layout, i18n and
  the QA evidence. It may perform browser QA, and never implements its own fixes.

Both receive the same frozen full diff, issue, head/base, policy and validation
packet in separate contexts. Start them in parallel, wait for both and reconcile
all findings once. Neither sees the other's verdict before submitting its own.
Missing coverage or an unavailable reviewer blocks acceptance; ask the existing
specialist to fill the documented gap instead of silently dropping it.

UI changes retain Playwright evidence, required blind base/head screenshot pairs,
light/dark and desktop/mobile checks, RTL when applicable, and the repository's
QA head/label contract. The independent Quality reviewer owns QA approval after
examining the evidence; the implementer cannot self-approve. No UI change becomes
skip-qa merely because it is risk-low. Preserve the installed skills' safety
rules and all review rules unrelated to the explicit persona substitution.

Record PASS or CHANGES, reviewer identity, inspected head/base, findings and
coverage in each review task/report. The PM sends one consolidated correction
packet to the original implementer. Updated code requires both fresh matching
verdicts and affected QA/validation before merge. Preserve unresolved findings;
style preferences alone do not create another blocking round.

After initial round 1, allow at most two correction rounds. Restarts, renamed
agents and repeated events do not reset the count. A remaining blocker after
round 3 goes to the CEO with attempted fixes and the precise decision needed.
Environment failure goes once to Runtime Engineer with reproduction and checkpoint;
resume on changed evidence, not repeated identical diagnosis.

The CEO rechecks live head/base, both independent acceptances, required executed
CI, QA freshness, unresolved threads, holds and develop-only target before the
ordinary guarded merge. Verify the actual merge and linked issue closure using
GitHub; internal task completion alone is not delivery.

## Rollout, measurements and rollback

First complete one eligible issue through merge and linked issue closure. Then
prove two distinct implementation executions overlap under the existing shared
subscription with isolated resources. Save run IDs and actual start/end times;
configuration and queued jobs alone do not prove concurrency. Also demonstrate
that one safely parked lane permits the other to finish. Keep WIP at two.

Before admission, freeze the ten most recent comparable low-risk issues with
reliable timestamps, or document unavailable baseline data. Start the 14-day
window at activation. At ten completed issues or day 14, whichever comes first,
the PM publishes the available cohort, incomplete issues and measurement gaps.
Report time from readiness to merge, build/review/CI waiting, handoffs, correction
rounds, repeated validations, available tokens/run counts, human interventions,
regressions and reopened issues. Unknown token use is unknown, never zero.
A smaller pilot cohort is provisional and does not prove the success threshold.

Retain two lanes only with no control or ownership violations, no serious
regression detected for seven days after the last cohort merge, and at least a
20% reduction in median readiness-to-merge time across ten comparable pilot and
ten baseline issues. Missing data or unfinished follow-up is inconclusive. This
is a pilot decision threshold, not a causal guarantee or promise of acceleration.
No third lane is authorized by this pilot.

On a control violation, ownership conflict or serious regression, stop new pilot
admissions immediately. Safely finish or park running work, pause Delivery B,
and restore the saved role instructions, reporting lines and skill selections
using current revision checks. Preserve later unrelated changes; a stale snapshot
is a comparison source, not permission to overwrite them. Restore repository
policy by normal PR when needed. Do not automatically revert valid product merges.
