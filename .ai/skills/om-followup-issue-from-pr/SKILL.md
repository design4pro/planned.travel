---
name: om-followup-issue-from-pr
description: planned.travel extension of the installed om-followup-issue-from-pr skill. A spec PR carrying `Refs #n` already has its implementation ticket, so design-doc mode files no second `Implement:` issue for it.
---

Extends the installed skill: read `.claude/skills/om-followup-issue-from-pr/SKILL.md` and follow it. One addition, to design-doc mode (steps 3, 4 and 9). Comment mode is untouched: a review nit on a spec PR still becomes its own follow-up.

- **A spec under `.ai/specs/` whose PR body carries `Refs #n` already has a tracking issue: `#n`.** ADR 0018 says the FR issue is the implementation ticket and no second issue is filed for building what the spec describes, and the step-4 dedupe cannot see this one - it searches `<slug> in:title,body` for an open `Implement: …` title or a body naming the spec path, and an FR issue that predates the spec matches neither (`om-auto-write-spec` leaves the spec path in a _comment_ on it, not in the body). So resolve the reference directly instead: read the PR body for `Refs #<n>`, and when `#<n>` is an open issue, treat step 4 as having found the tracking issue - report `#<n>`, optionally comment the spec PR link on it, and never reach step 9.
- Only a spec PR with no `Refs #n`, or one whose referenced issue is already closed, still creates an `Implement:` issue. `om-spec-writing`'s step 9 ("`om-followup-issue-from-pr` can file the `Implement:` tracking issue once it merges") describes that remaining case; the spec route in this repository always goes through `om-auto-write-spec`, which writes `Refs #n`.
