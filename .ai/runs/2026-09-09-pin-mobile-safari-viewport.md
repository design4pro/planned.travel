# Execution plan — pin the mobile-safari viewport

Source doc: `.ai/specs/2026-09-09-pin-mobile-safari-viewport.md`
Tracker: issue #151, spec PR #375 (merged in `b0caaca7`).

## Goal

Make the phone geometry the journeys are calibrated to a value this repository holds, instead of one
it inherits invisibly from `playwright-core`'s `devices['iPhone 15']` and restates in a comment. The
`mobile-safari` project gains `viewport: { width: 393, height: 659 }` after the descriptor spread —
symmetrically with `chromium`'s `1440x900` — the stale two-line comment goes, and journey 7's doc
comment says where the 393px handset it argues about now comes from.

## Scope

Two files, three edits, one commit.

- `playwright.config.ts` — the `mobile-safari` project's `use` block: delete the two-line comment,
  expand to the multi-line form, add the pinned `viewport` after the spread and before
  `extraHTTPHeaders`, with the comment block the spec's Architecture section quotes verbatim.
- `e2e/journeys.spec.ts` — one clause in numbered item 2 of journey 7's doc comment, naming
  `playwright.config.ts` as the owner of the geometry the item measures against.

## Non-goals

Recorded in the spec's "Out of scope" section and not re-derived here:

- Pinning `screen`, `deviceScaleFactor` or the user agent (Q2); pinning the `setup` project (Q5).
- Any drift assertion tying the pin back to the descriptor (Q4).
- Changing the reference phone, or any of journey 7's measurements, assertions or `setViewportSize`
  literals (`360x640` at the fold, `360x900` for impersonation).
- Re-labelling issue #151 from `feature` to `refactor` (Q7) — named for the human who grooms it.
- Any file under `src/**`, `drizzle/**`, `src/lib/i18n/messages/**`, `package.json` or
  `pnpm-lock.yaml`.

## Verification

The spec makes the pin's safety measurable rather than asserted: it is only a no-op if it equals the
installed descriptor. Read at implementation time on this worktree's lockfile:

```
node --input-type=module -e "const { devices } = await import('@playwright/test'); console.log(JSON.stringify(devices['iPhone 15'].viewport))"
→ {"width":393,"height":659}
```

Byte-for-byte the pinned pair, so every journey runs at the geometry it already ran at. Then
`rg 'never captured' playwright.config.ts` returns nothing, and the full gate
(`.ai/agentic.config.json` → `validation.commands`, all seven in order) runs with
`bash .ai/scripts/e2e.sh` green.

**Blocker on the seventh gate step, recorded rather than worked around.** `bash .ai/scripts/e2e.sh`
could not run on this host: `playwright.config.ts` accepts only ports 3030-3040 outside CI, and all
eleven were held by concurrent checkouts (`ERROR: no free port in 3030-3040`; the two earlier
attempts died as `ERROR: no answer on :3040 within 120s` under a load average above 120). Steps 1-6
ran green locally. The e2e evidence therefore comes from CI, which is the stronger source here
anyway: `.ai/scripts/e2e.sh` passes `--project=chromium` and never exercises `mobile-safari`, the
one project this change touches, whereas the CI job runs both.

## Risks

Low and bounded. No runtime code, no bundle, no migration, no locale key — `pnpm build`,
`pnpm typecheck`, `pnpm lint` and `pnpm test` cannot be affected by a Playwright project's `use`
block. The one behavioural risk is a lockfile that moved since the spec was written, which the
verification above catches before the pin is written; the residual gap (the rest of the descriptor
stays inherited) is accepted in the spec's Q2 and stated in the PR body.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: the geometry becomes code

- [x] 1.1 Pin the viewport and settle the prose — dea912dd
