# Reveal a masked code in place

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | implemented |
| **Issue**          | #213        |
| **Spec PR**        | #518        |
| **Implementation** | #616        |

## 📝 TLDR

A masked confirmation code is today two controls: a masking `button` that unmounts itself on reveal
and a `CopyValue` that mounts in its place. The swap is why focus has to be handed over by hand, and
the three reveal triggers it carries (`click`, `focus`, `pointerenter`) with no way back to masked are
why one mouse sweep across the bookings desk unmasks every code on it for the rest of the visit. This
spec makes masked and revealed two states of **one persistent button**: a click or a tap reveals, a
second activation copies, losing focus masks again, and hovering or tabbing past reveals nothing. It
is for every traveller who keeps codes masked because somebody else can see their screen.

## 📝 Problem Statement

`MaskedCode` (`src/components/modules/shared/masked-code.tsx`) renders one of two elements:

- **masked** — its own `<button data-part="confirmation-code">` showing `maskCode(value)` and an `Eye`;
- **revealed** — `<CopyValue>` (`src/components/modules/shared/controls.tsx`), which shows the value
  and copies it.

Two defects follow from that shape, and both are in the shipped code rather than hypothetical.

1. **The reveal is a one-way latch with an intent-free trigger.** `revealed` is local state set to
   `true` by `onClick`, `onFocus` and `onPointerEnter` alike, and nothing ever sets it back. A pointer
   crossing a row is not a decision to read a code, yet it reveals it, and the code then stays
   revealed until the card unmounts. On `/trips/$tripId/book` and `/trips/$tripId/transports`, where
   the codes sit in a column of cards, moving the mouse down the list unmasks all of them — the exact
   exposure the "Hide confirmation codes until I ask" preference exists to prevent. Tabbing through the
   page does the same for keyboard readers, because `onFocus` reveals too.
2. **The swap forces a focus-restoration machine into existence.** Because revealing unmounts the
   focused node, `MaskedCode` carries a `handOver` ref, a `useEffect` that re-focuses the new button,
   and a `document.activeElement` comparison to tell a keyboard reveal from a hover; and `CopyValue`
   carries a `ref` prop that exists for this one caller (its own doc comment says so). Two of the five
   `MaskedCode` tests in `__tests__/masked-code.test.tsx` test that machine and nothing else.

The settings hint that describes the preference repeats the defect as a promise:
`settings.appearance.privacy.codesHint` tells the reader codes stay masked "until you hover, focus or
tap one".

## 📝 Proposed Solution

**One button, two states, one gesture that reveals.** `CopyValue` learns to start masked; `MaskedCode`
keeps owning the rule for _when_ a code is masked and hands the mask down.

| Gesture on the button              | Masked                       | Revealed                         |
| ---------------------------------- | ---------------------------- | -------------------------------- |
| Pointer enters / leaves            | nothing (hover colour only)  | nothing                          |
| Receives focus (`Tab`)             | nothing                      | —                                |
| Click, tap, `Enter`, `Space`       | reveals, and takes the focus | copies (unchanged)               |
| Loses focus                        | —                            | masks again                      |
| Card unmounts (navigation, filter) | state is gone                | state is gone — masked on return |

Revealing is still per card and never writes the preference — that part of the current design is
right and stays.

**Focus is the control's, not the mouse's.** Re-masking hangs off `blur`, and two browser behaviours
would break a naive version of it:

- Safari, and Firefox on macOS, do not focus a `button` on a mouse click — so without help a pointer
  reveal leaves nothing focused, `blur` never fires, and the latch is back.
- In those same browsers a `mousedown` on the already-focused button moves focus to the document. The
  second click would blur the revealed button, re-mask it, and then land its `click` on the masked
  state and reveal again — copying with the mouse would never happen.

So, while a mask is given, the button's `onMouseDown` calls `preventDefault()` (the `click` still
fires; only the focus change is suppressed), and the reveal handler calls `focus()` on the button
explicitly. Focus then moves in exactly two ways: the reveal puts it on the button, and the reader
takes it elsewhere. Keyboard activation fires no `mousedown` and is unaffected.

### Alternatives considered, and why they lost

- **`MaskedCode` renders its own single button** (the issue's second direction). It keeps `CopyValue`
  untouched, but the revealed state must copy, so the button would re-implement `copyToClipboard`'s
  call, the `copied` state, its 1600 ms timer and the `Check` affordance — a second copy control
  beside the first, which is the duplication `controls.tsx` exists to prevent.
- **Keep the swap, drop only `onPointerEnter` and `onFocus`.** Fixes the latch trigger but not the
  latch (nothing re-masks) and keeps the whole focus handover. Half the issue.
- **Re-mask on a timer** (say 10 s after reveal). It closes the latch without depending on `blur`, but
  it masks on a clock rather than on anything the reader did: a code still being read on the page
  disappears under them, and a time limit on reading content is what WCAG 2.2 SC 2.2.1 asks a design
  to avoid. `blur` masks when the reader moves on, which is a decision they made.
- **Re-mask on `pointerleave`.** On touch, `pointerleave` fires straight after `pointerup`, so a tap
  would reveal and mask in the same gesture. Restricting it to `pointerType === 'mouse'` adds a branch
  per input type to fix what `blur` already covers.
- **First click reveals and copies.** One gesture instead of two, but it writes to the clipboard a value
  the reader has not seen yet, and gives a click that only meant "let me look" a side effect.

## 📝 Architecture

No new module, boundary or dependency. The concept — "a masked code is one control that reveals on
intent and masks when left" — has three owners that change together in one item (docs/SPEC.md §8):

- **`src/components/modules/shared/controls.tsx` — `CopyValue`.** Owns the control: its states, its
  gestures, the copy. Gains the optional `mask` prop and the `revealed` state; loses the `ref` prop.
- **`src/components/modules/shared/masked-code.tsx` — `MaskedCode`.** Owns the rule: the preference, the
  empty-code exception, the glyph count, the accessible name of the reveal. Always renders exactly one
  `CopyValue`; loses `handOver`, `copyRef`, the `useEffect`, `reveal()` and its own button.
- **`src/lib/i18n/messages/*/settings.ts` — `settings.appearance.privacy.codesHint`.** The sentence that
  describes the behaviour is a claim about it (§8, "a claim is a file") and changes with it, in all 23
  locales.

Unchanged: the two call sites (`book/bookings-timeline.tsx:782`, `transports/transports-timeline.tsx:517`)
pass the same three props; the routes still read `maskConfirmationCodes` once and hand it down;
`maskCode` and `MASK_CHARACTER` keep their signatures and exports; `components/modules` still fetches
nothing and imports nothing from `server/`.

## 📝 Data Model

None. No schema, migration, preference or storage change; `maskConfirmationCodes` keeps its meaning.

## 📝 API Contracts

No server function changes. The one contract that changes is the in-repo component API of `CopyValue`,
which has no consumer outside `MaskedCode` (`src/components/modules/shared/index.ts` re-exports it; no
other module imports it) and is not a protected surface in `BACKWARD_COMPATIBILITY.md`.

```ts
// src/components/modules/shared/controls.tsx
export function CopyValue(props: {
  value: string
  label: string
  className?: string
  /**
   * Starts the control masked. Absent — the control behaves exactly as it does today.
   * `glyphs` replaces the value in the DOM until the reader activates the button;
   * `revealLabel` is the accessible name while masked.
   */
  mask?: { readonly glyphs: string; readonly revealLabel: string }
}): JSX.Element
// removed: ref?: React.Ref<HTMLButtonElement>
```

`CopyValue` keeps no translation of its own: `revealLabel` arrives already translated from
`MaskedCode`, so `CopyValue` still renders without an `I18nProvider` above it, exactly as it does
today.

```ts
// src/components/modules/shared/masked-code.tsx — the whole render
const glyphs = masked ? maskCode(value) : ''
return (
  <CopyValue
    value={value}
    label={label}
    className={className}
    mask={
      glyphs === ''
        ? undefined
        : { glyphs, revealLabel: t('modules.action.showCode', { label }) }
    }
  />
)
```

`MaskedCodeProps` does not change.

## 📝 UI/UX

**The button, by state** (one DOM node throughout):

| State            | Content                      | Accessible name          | Look                                                               | `data-state` |
| ---------------- | ---------------------------- | ------------------------ | ------------------------------------------------------------------ | ------------ |
| masked           | `glyphs` + `Eye` (hidden)    | `revealLabel` ("Show …") | today's mask: `bg-surface-inset`, `text-ink-4`, hover `text-ink-2` | `masked`     |
| revealed         | value + `Check` at opacity 0 | "Copy …" (today's)       | today's `CopyValue`                                                | `revealed`   |
| revealed, copied | value + `Check`              | "… copied" (today's)     | today's `text-success`                                             | `revealed`   |
| no `mask` prop   | value + `Check` at opacity 0 | "Copy …" (today's)       | today's `CopyValue`                                                | absent       |

- **The value is not in the DOM while masked.** The masked content is the `glyphs` text node with
  `aria-hidden`, exactly as today; the value is rendered only in the revealed state. Swapping the
  button's children is not the unmount the issue is about — the `button` itself persists, and so does
  its focus.
- **`data-part="confirmation-code"` goes.** No test, script or style reads it (repository search: it
  exists only on the element). The state a capture needs is `[data-state="masked"]` /
  `[data-state="revealed"]`, which is generic enough to live on `CopyValue`. Plan 03's recorded
  evidence invocation (`--hover '[data-part="confirmation-code"]'`) is history and is not rewritten; a
  capture of the revealed state now uses `--click '[data-state="masked"]'`.
- **No layout movement — which today's swap does not actually deliver.** The mask has the value's
  character count in the same mono face and `Eye` and `Check` are both `size-3`, but today's masked
  button carries `px-1.5` and `CopyValue` carries no padding, so revealing a code narrows it by 12 px.
  With a mask given, `px-1.5 rounded-sm` applies in both states and only `bg-surface-inset` is
  masked-only, so the width is the same before and after. Without a mask `CopyValue` keeps its current
  classes. The transition stays a colour change at `--duration-fast`.
- **Focus ring.** `focus-ring` draws on `:focus-visible` only, so the ring shows when the reader reveals
  from the keyboard and, per the browser's own heuristic, not after a pointer reveal. No ring is
  promised for a click.
- **Keyboard.** `Tab` lands on the mask and reveals nothing. `Enter`/`Space` reveals and the focus
  stays where it is. `Enter`/`Space` again copies. `Tab` onward masks the code behind the reader.
- **Screen readers.** The name changes from "Show the confirmation number for Hotel Gracery" to "Copy
  the confirmation number for Hotel Gracery" on the focused node; no live region is added. The
  revealed value itself is not part of the accessible name, today or after this change — see Out of
  scope.
- **Pointer and touch.** Hovering changes the colour only. A tap reveals; tapping the revealed code
  copies it. Tapping another control moves focus and masks the code.

## 📝 Visual change expected

- **`/trips/$tripId/book` and `/trips/$tripId/transports`, preference on** — at rest: none. Hovering a
  masked code: the code no longer appears (colour shift only). Clicking a masked code: today's revealed
  look, plus 6 px of inline padding either side that keeps the width of the mask it replaced. Clicking
  elsewhere afterwards: the code is masked again, where today it stays revealed. Light and dark,
  desktop and mobile alike; no layout difference between breakpoints.
- **`/trips/$tripId/book` and `/trips/$tripId/transports`, preference off** — none.
- **`/settings/appearance`** — the hint under "Hide confirmation codes until I ask" reads the new
  sentence (see Copy); its length changes by a few words, which may re-wrap the row on mobile. Light and
  dark, desktop and mobile.

## 📝 Copy

No new key. One existing key changes its text, because the sentence describes behaviour this spec
changes:

| Key (`en`)                              | Today                                                                                                                                                      | After                                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `settings.appearance.privacy.codesHint` | Booking references and confirmation numbers stay masked on the bookings desk and on transports until you hover, focus or tap one. Prices are never hidden. | Booking references and confirmation numbers stay masked on the bookings desk and on transports until you click or tap one, and mask again when you move on. Prices are never hidden. |

The other 22 locales are retranslated from the new English in the same change (`i18n-messages`).
`modules.action.showCode` ("Show {label}") is unchanged and keeps its placeholder.

## 📝 Edge Cases & Failure Scenarios

- **Empty or blank code with the preference on** — `maskCode` returns `''`, `MaskedCode` passes no
  `mask`, the control is a plain `CopyValue`. Unchanged behaviour, still tested.
- **Preference toggled while a card is mounted** — `masked` is read once by the route loader, so it
  only changes on the next load, which remounts the cards masked. If the prop ever did change in place,
  `mask` going from absent to present leaves `revealed` at its initial `false`, i.e. masked — the safe
  side.
- **Reveal then copy** — the copy click happens on a focused, revealed button; its `mousedown` moves no
  focus, so `blur` does not fire, the code stays revealed and `Check` shows for 1600 ms. Moving on
  masks it and resets `copied` in the same `onBlur`, so a reveal within those 1600 ms does not open on
  a stale "… copied" name.
- **Clipboard refused** (`copyToClipboard` resolves `false`) — unchanged: no `Check`, the value stays
  on screen for the reader to select by hand.
- **Touch browsers that do not blur on a tap on inert content.** Tapping plain text or empty page on
  iOS Safari does not move focus, so the code stays revealed until the reader taps another control,
  scrolls to a field, or leaves the page. Accepted residual: strictly less exposure than today, where
  nothing masks at all, and closing it needs a document-level listener or a timer, both rejected above.
- **The window loses focus** (the reader switches to the airline tab) — `blur` fires on the button and
  the code masks; the reader reveals it again with one click on return. Accepted: re-masking when the
  reader leaves is the point.

## 📝 Risks & Impact Review

- **Blast radius** — one shared control used by two cards on two routes; no server, data or locale
  structure change. Rollback is a revert of one PR.
- **Compatibility** — `CopyValue` loses `ref` and gains `mask`; `src/components` module boundaries are
  listed as not protected in `BACKWARD_COMPATIBILITY.md`, and the prop has no other consumer.
- **Accessibility** — WCAG 2.2: reveal is a native `button` activation (2.1.1), focus never leaves the
  control on reveal (2.4.3), no content appears on hover or focus any more (1.4.13 no longer applies),
  no time limit (2.2.1). The regression risks are the two WebKit focus behaviours in Proposed Solution:
  a missing `focus()` re-opens the latch, a missing `preventDefault()` makes copying by mouse
  impossible. jsdom reproduces neither, so a unit test pins the explicit `focus()` and a Playwright
  case in the `mobile-safari` (WebKit) project pins both.
- **Behaviour a reader may notice** — a revealed code masks when they click elsewhere. That is the
  change the issue asks for, and the settings hint says it.

### Out of scope

- **The accessible name of `CopyValue`.** "Copy {label}" replaces the button's content, so a screen
  reader never hears the code itself, masked or not; and the "Copy …" / "… copied" names are English
  template strings rather than catalogue keys. Both predate this change, both apply equally with the
  preference off, and fixing them is a copy and accessibility change to every `CopyValue`, not to the
  reveal. They belong to a follow-up issue.
- **Any change to what the preference covers** (prices, other fields) or to where it is stored.
- **A document-level listener or timer** to close the iOS inert-tap residual (Edge Cases).

## 📋 Phasing

One phase. Changing the control without the hint would leave the settings page promising reveal on
hover (§8, a claim is a file), and changing `MaskedCode` without `CopyValue` is not possible — so the
three owners land together in one pull request.

## 📋 Implementation Plan

**Phase 1 — one control, click to reveal, blur to mask**

1. **`CopyValue` learns to start masked.** Add the `mask` prop and `revealed` state to
   `src/components/modules/shared/controls.tsx`; the masked branch renders `glyphs` (`aria-hidden`) and
   `Eye`, takes `revealLabel` as its name and `bg-surface-inset` on top of the shared padding and radius; `onMouseDown` prevents default while a mask is given; `onClick` reveals and calls
   `focus()` when masked, copies otherwise; `onBlur` resets `revealed` and `copied`; `data-state`
   reflects the state when `mask` is given. Remove the `ref` prop and rewrite the doc comment that
   justifies it. `MaskedCode` compiles only if its `ref={copyRef}` goes in the same step, so remove that
   line, and delete the test "hands the focus to the revealed control when it was revealed from the
   keyboard", which that removal turns red (the swap keeps working without the handover). Tests: new
   `src/components/modules/shared/__tests__/copy-value.test.tsx` — no `mask` renders the value; masked
   renders no value in `textContent`; a click reveals and the node before and after is the same element
   (`toBe`); after a `fireEvent.click` — which, unlike `user.click`, moves no focus by itself —
   `document.activeElement` is that node; a second click calls `navigator.clipboard.writeText` with the
   value; `blur` masks again and clears `copied`; hover does not reveal; focus does not reveal.
2. **`MaskedCode` renders one `CopyValue`.** Replace its body with the single render in API Contracts;
   delete `handOver`, `copyRef`, the `useEffect`, `reveal()`, the masked `button`, the `useEffect`/
   `useRef`/`useState`/`Eye` imports; rewrite the doc comments that describe hover/focus reveal and the
   focus handover. Tests in `__tests__/masked-code.test.tsx`: keep "keeps the value out of the document",
   "shows the code … once asked" and "never masks when the preference is off, or when there is no code";
   delete "leaves the focus alone when a pointer reveals the code"; add "a hover no longer reveals the
   code" and "moving on masks the code again"; rewrite the file's header comment, which calls the
   reveal a control swap.
3. **The settings hint tells the truth.** Change `settings.appearance.privacy.codesHint` in
   `src/lib/i18n/messages/en/settings.ts` and in the 22 other locales per `i18n-messages`. `pnpm test`
   (parity) is the check.
4. **Pin the WebKit behaviour.** One Playwright case, run by both the `chromium` and `mobile-safari`
   projects, on a booking with a confirmation number and the preference on: click the
   `[data-state="masked"]` control → `data-state` is `revealed`; then `hover()` it and `mouse.down()`
   → while the pointer is held, `data-state` is **still** `revealed`; `mouse.up()`; click outside it →
   `masked`. Each of the two regressions gets the assertion that can actually see it. The held-pointer
   assertion is the `preventDefault()` pin: without it `mousedown` blurs the button, `onBlur` re-masks
   it, and the state reads `masked` between press and release — whereas after the release the buggy
   re-mask-then-reveal round trip ends on `revealed` exactly like the fixed path, so a plain second
   `click()` cannot tell them apart. The click-outside assertion is the `focus()` pin: without the
   explicit `focus()` a pointer reveal leaves nothing focused, `blur` never fires and the code stays
   `revealed`. Assert on `data-state`, not on the clipboard, which WebKit's automation does not grant —
   and not on the `Check`/"… copied" affordance either: `copyToClipboard` has no `execCommand`
   fallback, so a refused clipboard write leaves `copied` false and no affordance to assert in the one
   project that needs it. Before landing, remove each fix in turn and confirm its assertion goes red in
   `mobile-safari`: nothing here establishes that the WebKit build Playwright runs reproduces Safari's
   no-focus-on-click behaviour, and a case that stays green without the fix pins nothing.
5. **Verify.** The gate in `.ai/agentic.config.json`, then the blind A/B pair
   (`scripts/visual/capture.mjs`) on `/trips/demo-trip-01-tokyo-and-kyoto/book` with the preference on:
   the resting frame is identical, and a `--click '[data-state="masked"]'` state (which acts on the
   first matching card) shows the revealed code with no row movement, light and dark, 360 and 1280.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                 | Applied default                                                                                                              | Why                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | One persistent control: a `mask` prop on `CopyValue`, or a button owned by `MaskedCode`? | `mask` prop on `CopyValue`; `MaskedCode` keeps the rule and the translation.                                                 | The revealed state must copy, and `CopyValue` already owns copying; a second button would duplicate it. `CopyValue` stays provider-free. |
| Q2  | What masks a revealed code again?                                                        | `blur` only; the reveal calls `focus()` and `mousedown` moves no focus, so `blur` means "the reader moved on" in WebKit too. | The issue's direction; a timer masks on a clock (WCAG 2.2.1) and `pointerleave` breaks tap. The iOS inert-tap residual is documented.    |
| Q3  | Does the first click reveal and copy, or reveal only?                                    | Reveal only; copy on the next activation.                                                                                    | The issue's "whose click copies once revealed"; a look should not write the clipboard.                                                   |
| Q4  | Does keyboard focus still reveal?                                                        | No — `Enter`/`Space` reveals, focus alone does not.                                                                          | Tabbing through a page is no more intent than a hover, and the issue names click as the intent-bearing gesture.                          |
| Q5  | Does the settings hint change with the behaviour?                                        | Yes, in the same PR, all 23 locales.                                                                                         | It currently promises reveal on hover and focus; §8 treats that sentence as part of the concept.                                         |
| Q6  | Keep `data-part="confirmation-code"`?                                                    | Drop it; expose `data-state` on `CopyValue` instead.                                                                         | Nothing reads it, and a domain name on a generic control is the wrong owner. Plan 03's recorded capture command is history.              |

## Amendment

Implemented in #616. Two things shipped differently from the design above.

- **`data-state` is not unique to this control.** Radix triggers on the same card (the status menu,
  the row menu) carry `data-state="open"`/`"closed"`, so a bare `[data-state]` selector matches three
  buttons on a booking card. `[data-state="masked"]` and `[data-state="revealed"]` remain unique and
  are what a capture or a test should address.
- **The Playwright case writes its own booking.** The seed writes no reservation, so there is no code
  on `/trips/demo-trip-01-tokyo-and-kyoto/book` to reveal. `e2e/masked-code.spec.ts` adds a booking
  named for its project with a confirmation number, turns the preference on, and removes both again.
  The mutation check in step 4 was run: without the explicit `focus()` the case goes red in both
  projects, and without `preventDefault()` it goes red in `mobile-safari` only.
