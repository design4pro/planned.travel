# Execution plan — reveal a masked code in place

Issue: #213
Source doc: .ai/specs/2026-09-15-reveal-code-in-place.md (spec PR #518, merged)
Branch: feat/issue-213-reveal-code-in-place

## Goal

Make a masked confirmation code one persistent `CopyValue` button with two states: a click, tap,
`Enter` or `Space` reveals it, the next activation copies it, losing focus masks it again, and a hover
or a `Tab` past it reveals nothing. The focus handover machine in `MaskedCode` and the `ref` prop on
`CopyValue` go away.

## Scope

- `src/components/modules/shared/controls.tsx` — `CopyValue` gains `mask`, `revealed`, `data-state`;
  loses `ref`.
- `src/components/modules/shared/masked-code.tsx` — renders exactly one `CopyValue`.
- `src/lib/i18n/messages/*/settings.ts` — `settings.appearance.privacy.codesHint`, all locales.
- Tests: `src/components/modules/shared/__tests__/copy-value.test.tsx` (new),
  `src/components/modules/shared/__tests__/masked-code.test.tsx`, one Playwright case in `e2e/`.
- Spec lifecycle: `.ai/specs/2026-09-15-reveal-code-in-place.md` → `implemented/`, regenerated index.

## Non-goals

- The accessible name of `CopyValue` ("Copy …" / "… copied" are English templates) — spec Out of scope.
- What the preference covers or where it is stored.
- A document-level listener or timer for the iOS inert-tap residual.
- The two call sites (`bookings-timeline.tsx`, `transports-timeline.tsx`) — their props do not change.

## Implementation Plan

### Phase 1: One control, click to reveal, blur to mask

- 1.1 `CopyValue` learns to start masked (`mask` prop, `revealed` state, `onMouseDown` prevent,
  explicit `focus()` on reveal, `onBlur` resets, `data-state`); remove `ref`; new `copy-value.test.tsx`.
- 1.2 `MaskedCode` renders one `CopyValue`; delete `handOver`, `copyRef`, the `useEffect`, `reveal()`
  and the masked `button`; update `masked-code.test.tsx`.
- 1.3 The settings hint tells the truth, in every locale.
- 1.4 Pin the WebKit behaviour with one Playwright case (`chromium` and `mobile-safari`).
- 1.5 Verify: full gate, spec lifecycle bookkeeping.

## Risks

- jsdom reproduces neither WebKit focus quirk; the Playwright case is the only pin, and CI runs
  `mobile-safari` nightly, not per PR.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: One control, click to reveal, blur to mask

- [ ] 1.1 CopyValue learns to start masked
- [ ] 1.2 MaskedCode renders one CopyValue
- [ ] 1.3 The settings hint tells the truth
- [ ] 1.4 Pin the WebKit behaviour
- [ ] 1.5 Verify and record the spec lifecycle
