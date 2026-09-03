# Labels

Labels are the backlog's state machine (ADR 0015). Every open issue carries **exactly one
`status:`**; `run:` labels are commands a human gives and a script consumes; nothing else is state.
The vocabulary is closed: 19 labels, listed here, and no others.

## Vocabulary

| Label                                                   | Written by                                  | Meaning                                                                               |
| ------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `status: triage`                                        | issue forms, audit and Sentry follow-ups    | new, not yet reproduced; the triage automation picks it up                            |
| `status: needs-info`                                    | triage                                      | triage needs an answer from the reporter (questions in a comment)                     |
| `status: backlog`                                       | idea form, triage (`needs-plan`)            | a feature or idea waiting for a plan run or a decision                                |
| `status: queued`                                        | publish-tickets, sweeper                    | a ticket with an open native blocker                                                  |
| `status: ready`                                         | triage, publish-tickets, sweeper            | specified and unblocked; `run: implement` may claim it                                |
| `status: in-progress`                                   | **claim scripts only**                      | a run holds it (a PRD keeps it while any child is open)                               |
| `status: review`                                        | handback, publish-spec/prd/tickets          | an artefact waits for a human: a draft PR, a spec, a PRD, tickets                     |
| `status: needs-human`                                   | handback `--blocked`, triage, sweeper       | a workflow could not finish; the comment says why                                     |
| `run: triage`                                           | a human                                     | command: (re)triage; bypasses the "already triaged" marker                            |
| `run: implement`                                        | a human; the sweeper under `auto-advance`   | command: implement this ticket                                                        |
| `type: bug` / `feature` / `enhancement` / `maintenance` | issue forms, triage                         | mandatory on every issue without a parent; absent on tickets (they inherit the PRD's) |
| `prd`                                                   | publish-prd                                 | parent issue: title `PRD: …`, body `prd/v1`; its sub-issues are the tickets           |
| `auto-advance`                                          | a human, on an open PRD only                | the sweeper adds `run: implement` to each child as it unblocks                        |
| `agent-pr` (PR)                                         | handback                                    | a draft PR opened by an implement run                                                 |
| `agent-docs` (PR)                                       | cez-docs-pr                                 | a PR carrying `CONTEXT.md` or ADR changes from a plan run                             |

A command is not a state: the claim script removes the `run:` label as its first action, and adding
the next command is how a human accepts the previous artefact. There is no priority axis; "visual
change expected" is a body section, not a label (`## Visual change expected`).

## Transitions

```
issue form (bug/enhancement/maintenance) ─► status: triage ─(triage run)─► status: in-progress
      ─► ready | needs-info | backlog | needs-human          human: run: triage repeats it
issue form (idea) ─► status: backlog
human: cockpit → issue → "Hand this to the agent" → workflow plan
      prompt "spec"    ─► in-progress ─► review (spec/v1 in the body)
      prompt "prd"     ─► in-progress ─► review (prd/v1, title PRD:, label prd)
      prompt "tickets" ─► children created queued/ready with native sub_issues + blocked_by;
                          the PRD stays in-progress until its last child closes
human: run: implement on ready | needs-human ─(claim)─► in-progress
      ─(handback)─► review (draft PR, agent-pr) | needs-human (WIP pushed, digest in a comment)
sweeper: PR merged ─► issue closed (completed) ─► siblings with no open blocker: queued → ready
         (+ run: implement when the PRD carries auto-advance); last child closed ─► PRD closed
sweeper: PR closed without merge ─► needs-human;  run: unclaimed for 2 h ─► needs-human
```

## Invariants (the sweeper reports them; `--fix` repairs the mechanical ones)

1. Exactly one `status:` per open issue.
2. A `type:` on every issue without a parent.
3. An issue with sub-issues carries `prd`; an issue with `prd` is titled `PRD:`.
4. A `run:` label without a claim: after 30 min with no pending task in cezar, a comment; after 2 h,
   removed and `status: needs-human`.
5. `status: queued` if and only if a native blocker is open.
6. `status: in-progress` on a ticket without a heartbeat for 3 h and no active run, or on a
   spec/PRD run that is neither active nor parked, becomes `status: needs-human` (a PRD with open
   children is exempt).
7. `status: review` on a ticket if and only if an open `agent-pr` PR references it.
8. A closed issue carries no `run:`.
9. `auto-advance` only on an open `prd`.
10. Owned paths are disjoint among siblings in `status: in-progress`.

## Markers

Scripts leave HTML comments so a run is idempotent and auditable; each is edited in place rather
than posted again: `<!-- agent-claim: <runId> -->`, `<!-- agent-heartbeat: <ISO> -->`,
`<!-- agent-result: ok|needs-human|refused -->`, `<!-- agent-triage -->`, `<!-- agent-grilling -->`,
`<!-- agent-noticed -->`, `<!-- sweeper: … -->`; on a PR, `<!-- agent-run: <runId> -->`. Every text a
script sends to GitHub passes through a filter that neutralises `@claude`, so an agent's output can
never summon `claude.yml`.

## Sources of issues

- **People**, through the issue forms (`.github/ISSUE_TEMPLATE/`). Blank issues are disabled so every
  issue enters with a `type:` and a `status:`.
- **Audit follow-ups** from PR audits and **Sentry** findings (`.github/workflows/sentry-triage.yml`,
  ADR 0008) enter as `type: bug|enhancement` + `status: triage` with their own marker in the body
  (`<!-- sentry-issue: SHORT-ID -->`, `<!-- agent-audit: … -->`); dedup is keyed on the marker across
  open **and** closed issues.

Triage (ADR 0006 as amended by ADR 0015) promotes to `status: ready` only a claim it has
**reproduced** at HEAD, that is not redundant, and whose fix direction is settled by SPEC, an ADR or
the code; it writes the `## Agent Brief` the implementer needs. Everything else gets a verdict and a
recommended state in a comment, and a human decides.
