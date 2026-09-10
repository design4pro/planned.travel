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

- [x] 1.1 Add `scripts/visual/landed-url.mjs` and its unit test — 79553d7a
- [x] 1.2 Wire the comparison into `capture.mjs` — fa479b60
- [ ] 1.3 Rewrite `.claude/skills/verifying-changes/SKILL.md` into the warning contract
- [x] 1.4 Delete `anonymous-only.mjs` and its test; correct the `vitest.config.ts` doc comment — 840142e6
- [x] 1.5 Run the full validation gate — six of seven commands green; the e2e step is red for a cause measured on the base

Gate result: `agent-kit-check`, `pnpm typecheck`, `pnpm lint`, `check-generated` and `pnpm build`
green; `pnpm test` 5780 passed / 238 files. `bash .ai/scripts/e2e.sh` ends red on
`e2e/journeys.spec.ts:910 — the click surface never takes the reader's input`, a bare
`Test timeout of 30000ms exceeded` with no assertion diff: 32.5 s under full-suite load against
14.9 s run alone. Measured against the base rather than assumed — the same suite on a detached
`origin/develop` (`c81a51c4`), same machine, same seeded environment, fails **eight** tests
including that one, where this branch fails one. The branch diff reaches no file the application or
the Playwright suite loads (`scripts/visual/**` is agent tooling; `vitest.config.ts` is not in the
Playwright run), so the step is red for a cause that predates the branch. CI's sharded journeys are
the adjudicating signal.

### Step 1.3 is blocked by a repo guard

`.claude/hooks/guard-generated.sh` refuses any agent-run edit under `.claude/` — the file
configures the agent, and the guard's one exception (a path the branch already changes) cannot be
reached by the run that would introduce the change. The spec calls this step "the load-bearing part
of the change", because without it the two surviving prose sentences still describe a refusal
`capture.mjs` no longer performs, and `capture.mjs`'s own stderr pointer names a document that
contradicts it. A human has to apply it, or authorize a different home for the contract.
