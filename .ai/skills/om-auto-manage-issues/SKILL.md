---
name: om-auto-manage-issues
description: planned.travel extension of the installed om-auto-manage-issues skill. Human-hold labels, category mapping and trigger-label hygiene.
---

Extends the installed skill: read `.claude/skills/om-auto-manage-issues/SKILL.md` and follow it. On top:

- Human-hold labels (skip the issue entirely): `blocked`, `do-not-close`, `do-not-merge`.
- `groom` is the human "re-groom" trigger label: remove it from an issue as the first mutation when present. Never add `groom`, `autofix` or `spec`; a human decides when an issue starts implementation.
- Category comes from the issue form (`.github/ISSUE_TEMPLATE`): a bug report is `bug`, an enhancement or idea is `feature`, a maintenance item is `refactor`; Dependabot is `dependencies`; Sentry-filed issues (`pnpm sentry-triage`) are `bug` and keep the `priority-high` the filer set.
- The Definition of Ready is in `SDLC.md`; the not-ready comment names the missing ticket-level items and points at the issue form section that holds each.
- **Hand a ready issue on, and only then.** As the **last** mutation of a groom that ends `READY_STATUS=ready`, add `needs-triage`. That label is what starts `afk-triage`, and adding it here is the one step that was missing between the issue form and the unattended ladder (`SDLC.md` § Intake labels). The bridge is deliberately narrow - skip it, leaving the issue for a human, when any of these hold:
  - `READY_STATUS` is anything but `ready`;
  - the issue already carries `needs-triage`, `needs-info`, `ready-for-agent` or `ready-for-human` - a decision exists, or triage is already pending, and `afk-triage` owns both;
  - it carries a trigger label (`autofix`, `spec`, `groom`) - a human already routed it;
  - it carries `risk-high` or `security` - that work is out of the unattended ladder by design, and this is the first of the two locks on that door;
  - it carries `dependencies`;
  - it was not opened by a maintainer.

  The last condition is the point of the gate rather than a formality. `Triage new issues` describes `needs-triage` as a label only a collaborator can set, and grooming is not a collaborator; what makes it safe to cross is that nothing reaches this rule except an issue a maintainer opened which then passed the Definition of Ready. A drive-by report still waits for a person. Never remove `needs-triage` - consuming it is `afk-triage`'s job.

- Implementation notes must name the owner module for each concept (docs/SPEC.md §8) and warn when the change would touch a protected surface in `BACKWARD_COMPATIBILITY.md`.
