---
name: om-auto-write-spec
description: planned.travel extension of the installed om-auto-write-spec skill. Repo-specific spec sections and label rules; the installed workflow applies unchanged.
---

Extends the installed skill: read `.claude/skills/om-auto-write-spec/SKILL.md` and follow it. On top:

- `spec` is the human trigger label. Remove it from the issue as the first tracker mutation of an issue-driven run. Never add `spec`, `autofix` or `groom`.
- Every spec under `.ai/specs/` carries two extra sections: **Visual change expected** (routes and states that change on screen, light and dark, desktop and mobile; "none" for backend-only work) and **Copy** (every new user-facing string, as an `en` key name plus text; the implementation lands each key in all 23 locales per the `i18n-messages` skill).
- Read `CONTEXT.md` for domain vocabulary and `docs/SPEC.md` for the architecture the spec must respect (tenant scoping in `src/server/repos`, Zod on every server-function input, `components/ui` never fetching data, additive D1 migrations). Name the owner module of each new concept (docs/SPEC.md §8).
- The spec PR is design-only: `Refs #{issueId}`, labels `review`, `documentation`, `skip-qa`, one priority, one risk. Branch `spec/<slug>`.
