# Execution plan — capture-landed-url-warning

Source doc: .ai/specs/2026-09-09-capture-landed-url-warning.md
Issue: #132
Spec PR: #369 (merged)
Engine: om-auto-create-pr (steps: 5, --loop: no)

## Goal

Replace `scripts/visual/capture.mjs`'s hardcoded list of anonymous-only routes with one universal
comparison — warn whenever a frame was taken on a different pathname than the one requested — so
every redirect is visible downstream instead of only the two that are listed.

## Scope

- `scripts/visual/landed-url.mjs` — new pure module, one export.
- `scripts/visual/__tests__/landed-url.test.mjs` — new unit test.
- `scripts/visual/capture.mjs` — wire the comparison in; delete the refusal, its import and the
  header paragraph that points at it; narrow the stale-session throw and evaluate it at the shutter
  as well; add the stderr pointer.
- `.claude/skills/verifying-changes/SKILL.md` — rewrite the refusal sentences into the warning
  contract.
- `scripts/visual/anonymous-only.mjs` + its test — deleted.
- `vitest.config.ts` — one clause of the `tooling` doc comment corrected.

## Non-goals

Taken verbatim from the spec's "Out of scope": query-parameter-only redirects, cross-origin
redirects with the same pathname, a `notFoundComponent` render, a machine-checkable `warnings`
shape, a redirect that `quiesce`/`--dismiss` triggers under `--click`, any change to `--click` /
`--hover` / `--enter` / `--dismiss` semantics, and anything under `e2e/**` or ADR 0016.

## Risks

- The exit-status contract moves in both directions (`2 → 0` for `--auth` on `/login`/`/register`,
  `0 → 1` for a post-hydration bounce to `/login`). Verified at implementation time that no
  workflow, `package.json` script or `e2e/**` helper shells out to `capture.mjs` — every caller is
  a human or agent reading its JSON, so nothing branches on the status unattended.
- Trading a hard refusal for a warning is only a net gain if the quoting obligation has a home;
  Step 3 is what gives it one, which is why it is a Step and not a footnote.

## Implementation Plan

### Phase 1: one comparison replaces the list

1. Add `scripts/visual/landed-url.mjs` and its unit test.
2. Wire it into `capture.mjs` — the landing read, the `--click` selection, the deduplicated push,
   the stderr pointer, the narrowed stale-session guard at both points, and the deleted import,
   refusal block and header paragraph.
3. Rewrite `.claude/skills/verifying-changes/SKILL.md` into the warning contract.
4. Delete `scripts/visual/anonymous-only.mjs` and its test; correct the `tooling` doc comment in
   `vitest.config.ts`.
5. Run the full validation gate.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: one comparison replaces the list

- [ ] 1.1 Add `scripts/visual/landed-url.mjs` and its unit test
- [ ] 1.2 Wire the comparison into `capture.mjs`
- [ ] 1.3 Rewrite `.claude/skills/verifying-changes/SKILL.md` into the warning contract
- [ ] 1.4 Delete `anonymous-only.mjs` and its test; correct the `vitest.config.ts` doc comment
- [ ] 1.5 Run the full validation gate
