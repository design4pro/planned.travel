---
name: om-followup-issue-from-pr
description: planned.travel extension of the installed om-followup-issue-from-pr skill. A spec PR carrying `Refs #n` already has its implementation ticket, so design-doc mode files no second `Implement:` issue for it.
---

Extends the installed skill: read `.claude/skills/om-followup-issue-from-pr/SKILL.md` and follow it. One addition, to design-doc mode (steps 3, 4 and 9). Comment mode is untouched: a review nit on a spec PR still becomes its own follow-up.

- **A spec under `.ai/specs/` whose PR body carries `Refs #n` already has a tracking issue: `#n`.** ADR 0018 says the FR issue is the implementation ticket and no second issue is filed for building what the spec describes. Resolve the reference directly instead of relying on step 4's open-issue search: read issue `#n` even when it is closed, inspect why it closed and whether implementation is complete, and report whether reopening or remaining work is needed. Never automatically create a duplicate `Implement:` issue for a valid reference. An open referenced issue may also receive a comment linking the spec PR.
- Only when the spec PR has no valid `Refs #n` implementation ticket should step 4 search for another existing ticket and step 9 create one if that search finds none. The spec route in this repository normally goes through `om-auto-write-spec`, which writes `Refs #n`.
