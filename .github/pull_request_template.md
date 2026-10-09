Closes #<issue>

<!-- `Closes #n` for an implementation, `Refs #n` for a spec-only or partial PR. GitHub does not
close on merge into develop; the housekeeping run (om-close-fixed-issues) reads this line and
does. Labels, per SDLC.md: one category (bug / feature / refactor / security / dependencies /
documentation), one priority-*, one risk-*, and `needs-qa` when a screen changes, otherwise
`skip-qa`. `review` is the pipeline label a PR wears while an agent reviews it. -->

## What

## Definition of done (docs/SPEC.md §7)

- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` and `pnpm typecheck` clean, no new suppressions
- [ ] New logic has tests; `pnpm test` passes
- [ ] Visually verified in a browser: light and dark, desktop and mobile (UI changes). Nothing in CI photographs a screen (ADR 0016), so for a deliberate visual change run `node scripts/visual/capture.mjs` and look at the pair
- [ ] No TODOs, placeholder copy, `console.log` or commented-out code
- [ ] Only files the issue or spec names were touched
- [ ] User-facing copy landed in all 23 locales (`i18n-messages`)
- [ ] Docs grep run on this head (CODE_REVIEW.md "Docs and CI"): every document that states what this change changes was searched for the old name and count, and fixed. Terms searched: <list them, including the old names of any function, module, constant or rule you changed and the paths searched (`.ai/specs/`, `CONTEXT.md`, `docs/`, comments in `src/`), or `none: no label, workflow, automation, skill, guard, runner variable, gate step, function, module, constant or rule changed`>

## Noticed but not touching

<!-- Things outside this change that deserve their own issue. Leave "nothing" if empty. -->
