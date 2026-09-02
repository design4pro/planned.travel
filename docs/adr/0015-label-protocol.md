# 0015. Labels are the state machine, commands are not states

Status: accepted
Date: 2026-09-02
Amends: ADR 0006. Supersedes the label names in ADR 0014.

## Context

The backlog carried 57 labels; 28 had never been used, two priority families overlapped, one
status label ended in an invisible U+FE0F, and thirteen tickets under two PRDs had neither a
`type:` nor a `status:`. `ready-for-agent` did three jobs at once: "a human has specified this",
"nothing blocks it", and "start now", so a PRD wearing it (#167) was an instruction to build a whole
area, and a ticket wearing it beside `status: blocked` was a contradiction the loop resolved by
ignoring one of them. Dependencies existed natively on GitHub but no code read them; sandcastle's
planner inferred order from prose. The orchestrator is being replaced by cezar (ADR 0014), whose
engine never writes to GitHub, so whatever state machine the backlog has must be one that scripts
can drive and a human can read.

Two published methodologies were compared. mattpocock/skills treats labels as the only state, gives
the orchestrator sole ownership of mutations, and uses native `sub_issues` and `blocked_by`;
addyosmani/agent-skills adds a written definition of done, task sizing with split rules, and a spec
shape with explicit boundaries. Both were read; neither separates "what state is this in" from "what
should happen next", and that separation is the decision here.

## Decision

**Exactly one `status:` per open issue; `run:` labels are commands, not states; nothing else is
state.** The vocabulary is closed at 19 labels (docs/agents/triage-labels.md) and any label outside
it is deleted.

- `status:` names where an issue is: `triage`, `needs-info`, `backlog`, `queued` (an open native
  blocker), `ready`, `in-progress`, `review`, `needs-human`. It is written only by scripts under
  `scripts/agent/` and by the issue forms; an agent never edits a label.
- `run: triage` and `run: implement` are the two commands a human can give. The claim script
  removes the command as its first action, so a command that is still there is a command nobody
  has taken. Adding the next command is how a human accepts the previous artefact; the planning
  steps (spec, PRD, tickets) are started from the cockpit for the same reason and each ends at
  `status: review`.
- `type:` is mandatory on every issue without a parent and absent on tickets, which inherit it.
- `prd` marks the parent: an issue with sub-issues carries it, and an issue carrying it is titled
  `PRD:`. `auto-advance`, on an open PRD only, lets the sweeper add `run: implement` to each child
  as its blockers close. That is the one place autonomy widens, and a human turns it on per PRD.
- Dependencies are native `blocked_by` relations, written by the ticket publisher after the tickets
  exist and before any is labelled `ready`. Bodies do not mirror them.
- Three PR labels: `agent-pr`, `needs-e2e`, `agent-docs`. No priority axis; "visual change
  expected" is a body section.

A sweeper on the cezar host (later `agent-state.yml` when Actions is reliable) is the only writer
besides the claim, apply and handback scripts: it closes an issue when its PR merges, moves siblings
from `queued` to `ready` as blockers close, closes a PRD when its last child closes, and turns stale
or orphaned states into `needs-human`. It reports invariant violations and repairs only mechanical
ones. Every write leaves an HTML marker so a re-run is idempotent.

**ADR 0006 is amended, not reversed.** Auto-promotion still requires a reproduction, non-redundancy
and a settled fix direction; it now ends at `status: ready`, not at "start". A human's
`run: implement` (or the PRD's `auto-advance`) is what starts work.

## Consequences

The backlog can be read without the orchestrator: a query for `status: ready` is the frontier, a
query for any `run:` older than two hours is a stuck command, and one label per issue makes every
invariant a one-line check. Sandcastle stops working the moment `ready-for-agent` is deleted; that
is accepted, because its replacement reads `status: ready` + `run: implement` and the migration is
a phase of ADR 0014's rollout, not an independent change.

What is given up: the `status: blocked` note a human could leave (a human blocker is now a native
dependency or a comment), the priority labels (never used on an open issue), and the historical
labels on closed issues, which the deletion strips; a snapshot of both is committed under
`docs/agents/migration/` before the migration runs.

## Migration

`scripts/agent/labels-migrate.sh` is idempotent and dry-run by default. It renames the surviving
statuses (`pending → triage`, `on hold → needs-info`, `review needed → review`,
`in progress️ → in-progress`, `blocked → queued`), creates the rest, computes one status per
open issue from the sub-issue graph and the native blockers, strips `ready-for-agent`, marks
#104 and #167 as `prd` + `status: in-progress`, deletes the 50 labels outside the vocabulary, and
asserts the invariants. The code that files issues (`sentry-triage.ts`, `architecture-review.ts`,
`main.ts`) is changed in the same commit to write `status: triage`.
