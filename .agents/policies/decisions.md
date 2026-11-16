# Independent specialist decisions

An unattended run has no human to ask. A choice between options is not a reason to stop, put a `blocked` hold on an issue, or leave "a human's call" in a ticket: it is a question for a specialist. You ask one, apply the answer, record it, and keep working.

## 1. When to use it

Use it every time you are about to do any of these:

- post options, a "Decision for the implementer", a "human's call" or a "Why not an agent" line;
- add `blocked` or record `not-ready` for any reason other than those in step 5;
- stop a run because a product, design, architecture, scope, risk or security question is open.

Do not use it for a question that has one defensible answer in the code, the spec, an ADR or `CONTEXT.md`. Read those first and apply what they say.

## 2. Frame the question

Write a decision brief, neutral and self-contained, into the run's scratch directory (`$TMPDIR`):

- **Question:** one sentence.
- **Context:** the issue, spec or PR, and the constraints you verified, with file paths and the ADRs in play.
- **Options:** two to four, each with its consequence and how reversible it is. Include "do less now, file the rest as a follow-up" when a smaller slice is possible.
- **Evidence:** what you read and ran.

Do **not** state which option you prefer. The specialist is independent only if it forms its own view from the evidence.

## 3. Ask the specialist

Spawn **one** sub-agent with the current runner's sub-agent facility. Pick the specialist by the question:

| Question                                                                                                  | Specialist                    | `subagent_type`                 |
| --------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------- |
| Product scope, what the user was promised, splitting a ticket, a category or priority                     | product owner                 | `persona-product-owner`         |
| Module shape, seams, test deletion, ADR conflict, a dependency                                            | software architect            | `general-purpose`               |
| `risk-high`, `security`, tenancy, roles, sharing, auth, secrets, data loss                                | security and tenancy reviewer | `persona-workspace-owner`       |
| Accessibility (WCAG 2.2 AA, keyboard, screen reader)                                                      | accessibility specialist      | `persona-accessibility-auditor` |
| Copy, UX, i18n, a default a traveller meets                                                               | UX specialist                 | `persona-traveller`             |
| Test strategy, which tests to keep or delete                                                              | test engineer                 | `general-purpose`               |
| Reproducibility, untested states, QA coverage                                                             | manual tester                 | `persona-manual-tester`         |
| A change to agent or project configuration (workflows, automations, skills, `.agents/`, hooks, `.husky/`) | configuration guardian        | `general-purpose`               |

Role briefs live in `.agents/reviewers/`. Spawn a fresh generic sub-agent with the relevant role brief; names in the table identify roles, not required runtime agent types.

The prompt carries the path to the decision brief, and it asks the specialist to:

1. verify the brief's claims against the repository read-only, and name any it finds wrong;
2. choose exactly one option, or a better one it names, applying `SDLC.md` § Unattended decisions: prefer the most reversible reasonable option that still ships a complete slice;
3. answer in this shape:

```md
VERDICT: <chosen option, one line>
CONFIDENCE: high | medium | low
WHY: <two to five sentences, citing files or ADRs>
CONDITIONS: <what the implementation must do for this to hold, or "none">
ESCALATE: no | yes - <the only reason a human is needed>
```

The configuration guardian also checks that a configuration change grants no more than the task needs, removes no deny rule for secrets or destructive commands, and weakens no guard. It answers `ESCALATE: yes` when either happens.

## 4. Apply the verdict

- `ESCALATE: no`: act on the verdict now, in this same run, and meet its CONDITIONS.
- `CONFIDENCE: low`: ask a second specialist from a different row. When the two disagree, take the more reversible option.
- `ESCALATE: yes` is valid only for the cases in step 5 (a guardian escalation and a withheld security approval included). Otherwise treat it as `no` and apply the verdict.

Record every verdict as a row in the Resolved assumptions table of the brief, spec, PR body or handoff you are writing:

| #   | Question   | Applied default | Why                                                           |
| --- | ---------- | --------------- | ------------------------------------------------------------- |
| n   | <question> | <verdict>       | Decided by <specialist> sub-agent (confidence <level>): <why> |

A human who disagrees overturns the row in review. That is an ordinary review finding, and it costs less than a stalled queue.

## 5. What still goes to a human

Only what no agent in this pipeline can do:

- an action that needs a person's own credentials, account settings, payment, or a legal commitment;
- merging the `develop` -> `main` promotion (a merge into `develop` is the pipeline's own, `om-pr-autopilot --allow-merge`), closing an issue, or removing a label a human set;
- a PR into `develop` that `om-pr-autopilot`'s fix-and-QA loop could not close in three rounds: it carries `blocked` and the `🤖 HUMAN-ONLY:` comment that loop posts. QA sign-off, `risk-high` and `security` included, is never a person's before that (owner decision 2026-10-06, ADR 0035);
- information only the reporter has: a repro, a version, what they expected;
- a platform limit, such as a ruleset that requires a review the run's own account cannot give (the `develop` ruleset requires none, so self-approval is never a blocker there);
- a configuration guardian verdict of `ESCALATE: yes`: the change weakens a guard or removes a deny rule, so it is not applied; add `blocked` to the issue and state the verdict in a 🤖 comment;
- a security and tenancy specialist that does not approve `risk-high` or `security` work for unattended implementation: it gets no Agent Brief and no claim; add `blocked` and state the verdict and its reasons in a 🤖 comment;
- a runtime-denied write: follow `.agents/policies/security.md`, stop once and hand over the exact patch and guardian verdict.

Every comment that hands a matter to a person starts with `🤖 HUMAN-ONLY: <the one thing a person must do>`. That marker is what stops the Reconciler (ADR 0033) from launching `unblock` on the hold again: an agent-set `blocked` without it is offered to a specialist, which is a wasted run when the matter is one of these. A hold or a `STOP:` an agent set for any other reason is lifted by `unblock` on a specialist's verdict.

Everything else is decided here.

## Done when

The question has a verdict, the work continued on it in this run, and the verdict is a Resolved assumptions row.
