Refs #<issue>

<!-- Never `Closes #n`: PRs target `develop`, where closing keywords do nothing. The sweeper closes the issue on merge. -->

## What

## Definition of done (docs/SPEC.md §7)

- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` and `pnpm typecheck` clean, no new suppressions
- [ ] New logic has tests; `pnpm test` passes
- [ ] Visually verified in a browser: light and dark, desktop and mobile (UI changes; `needs-e2e` for the full matrix)
- [ ] No TODOs, placeholder copy, `console.log` or commented-out code
- [ ] Only files inside the ticket's Owned paths were touched
- [ ] User-facing copy landed in all 23 locales (`i18n-messages`)

## Noticed but not touching

<!-- Things outside Owned paths that deserve their own issue. Leave "nothing" if empty. -->
