---
name: om-auto-manage-issues
description: planned.travel extension of the installed om-auto-manage-issues skill. Human-hold labels, category mapping and trigger-label hygiene.
---

Extends the installed skill: read `.claude/skills/om-auto-manage-issues/SKILL.md` and follow it. On top:

- Human-hold labels (skip the issue entirely): `blocked`, `do-not-close`, `do-not-merge`.
- `groom` is the human "re-groom" trigger label: remove it from an issue as the first mutation when present. Never add `groom`, `autofix` or `spec`; a human decides when an issue starts implementation.
- Category comes from the issue form (`.github/ISSUE_TEMPLATE`): a bug report is `bug`, an enhancement or idea is `feature`, a maintenance item is `refactor`; Dependabot is `dependencies`; Sentry-filed issues (`pnpm sentry-triage`) are `bug` and keep the `priority-high` the filer set.
- The Definition of Ready is in `SDLC.md`; the not-ready comment names the missing ticket-level items and points at the issue form section that holds each.
- **Run the readiness verifier before recording `not-ready`.** When step 6 of the installed
  skill (`references/enrich-existing-issue.md`) finds a ticket-level item missing, follow
  `.ai/skills/om-auto-fix-issue/SKILL.md` § Readiness verifier: `READINESS: VERIFIED` records
  `READY_STATUS=ready` and posts the `readiness verified` comment instead of the not-ready one;
  `NEEDS_HUMAN` records `not-ready` and the not-ready comment lists only the `NEEDS_HUMAN` rows.
  A verified issue is ready for every rule below, including the hand-on to `needs-triage`.
- **After the readiness verifier, settle what an agent can still settle before you call an issue not-ready** (`SDLC.md` § Delegated decisions). Take only the `NEEDS_HUMAN` rows that are a missing out-of-scope section or an open question, and never when the verifier stopped on a `veto`, on `docs/agents/out-of-scope.md` or on an ADR contradiction: a maintainer's revocation and a product boundary are not settled by an agent. This narrows the installed skill's "readiness is reported, never invented" to the two items a human does not have to supply: the problem statement still comes only from a person, and the verifier's rules cover the rest.
  - A missing **Out of scope** section is not a reason for `not-ready`: write it yourself from the issue, its linked spec and `docs/agents/out-of-scope.md`, into the clarified description (the reporter's text stays verbatim beside it), and settle any boundary you are unsure of through `.ai/skills/afk-decide/SKILL.md` (the product owner). Seen on #734 and #736.
  - An **open question** is not addressed to the author. Settle it through `afk-decide`, record the verdict as a **non-blocking** row of a Resolved assumptions table (`# | Question | Applied default | Why`) in the implementation-notes comment, and count the question as answered. Only a question that needs information only the reporter has (a repro, a version, what they expected) stays blocking. Seen on #763.
  - "A human's call", "Decision for the implementer" or a list of options copied into a ticket from a brief, spec or review is an open question like any other: settle it through `afk-decide`, never treat it as blocking.
- **Hand a ready issue on, and only then.** As the **last** mutation of a groom that ends `READY_STATUS=ready`, add `needs-triage`. That label is what starts `afk-triage`, and adding it here is the one step that was missing between the issue form and the unattended ladder (`SDLC.md` § Intake labels). The bridge is deliberately narrow - skip it, leaving the issue for a human, when any of these hold:
  - `READY_STATUS` is anything but `ready`;
  - the issue already carries `needs-triage`, `needs-info`, `ready-for-agent` or `ready-for-human` - a decision exists, or triage is already pending, and `afk-triage` owns both;
  - it carries a trigger label (`autofix`, `spec`, `groom`) - a human already routed it;
  - it carries `dependencies`;
  - it was not opened by a maintainer.

  The last condition is the point of the gate rather than a formality. `Triage new issues` describes `needs-triage` as a label only a collaborator can set, and grooming is not a collaborator; what makes it safe to cross is that nothing reaches this rule except an issue a maintainer opened which then passed the Definition of Ready. A drive-by report still waits for a person. Never remove `needs-triage` - consuming it is `afk-triage`'s job.

- Implementation notes must name the owner module for each concept (docs/SPEC.md §8) and warn when the change would touch a protected surface in `BACKWARD_COMPATIBILITY.md`.
