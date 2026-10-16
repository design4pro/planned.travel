# Read the whole trip conversation: older messages, runs, and a composer that keeps what you typed

| Field              | Value                                              |
| ------------------ | -------------------------------------------------- |
| **Status**         | in-progress                                        |
| **Issue**          | none                                               |
| **Spec PR**        | #904                                               |
| **Implementation** | #1293, #1314                                              |
| **Plan**           | 07-S3 (docs/plans/07-collaboration-and-sharing.md) |

## 📝 TLDR

Plan stage `07-S3` closes reference row `COL-03` (the trip's conversation, paged and grouped) on
`/trips/$tripId/collab`. The thread already posts, replies, edits, deletes and reacts. What it does not
do is let a traveller **read back**: the loader asks for the newest 50 messages, throws away the cursor
the repository returns with them, and the screen shows what came back, so a trip with a long
conversation silently loses its beginning. This stage adds a **"Load older"** control over a new GET
server function; **runs** (a burst of messages from one person shows the avatar and name once, broken by a
different author, a five-minute gap or a day change, and a day heading in the traveller's language); **jumbo glyphs** (a message that is only one to three
emoji renders large and bubble-less); and a **composer key contract** that is safe for the languages and
devices the product ships in (Enter never sends mid-IME-composition, Enter adds a line on a touch screen,
a failed send keeps the text and offers a lasting retry).

No SQL is written and no migration is generated: `listMessages` (`src/server/repos/collab.ts:123`) already
pages on a keyset cursor. The stage is cut into five slices a ticket run takes in order (Phasing).

This spec describes the work that is **left** at HEAD (`ff777dc5`). It departs from the plan's stage
block where the plan was written before ADR 0016, before the code, or before a specialist looked at it;
every departure is a row of the Resolved assumptions table.

## 📝 Problem Statement

Measured at HEAD:

- **Reading back is impossible.** `loadTripCollab` (`src/routes/_app/-server/trip.ts:644`) calls
  `listMessages(scope, trip.id, { limit: 50 })` and returns `page.items` reversed; `page.nextCursor` is
  discarded. The 51st-newest message and everything before it is unreachable from the UI. The plan cites
  `trip.ts:756`; the line moved, the defect did not.
- **The header lies once a thread is long.** `src/routes/_app/trips/$tripId/collab.tsx` prints
  `data.messages.length` as the message count, so a 400-message thread reads "50 messages". The route file
  belongs to `07-S2`, so this stage names it as a follow-up (Out of scope) rather than editing it.
- **Runs exist in half.** `thread.tsx:206-212` hides the avatar and name when the previous message has the
  same author and the same day; there is no time window, so a message at 09:00 and one at 17:00 are one
  "run". The grouping is inline in the render, so it is untested.
- **No jumbo glyphs.** `grep -n Segmenter src` returns nothing.
- **The composer ignores input methods.** `thread.tsx:679-691` sends on `Enter` without reading
  `isComposing`: a Japanese, Korean or Chinese traveller (`ja`, `ko`, `zh-Hans`, `zh-Hant` are among the 23
  locales) who confirms a candidate with Enter sends a half-typed message. On a phone's on-screen keyboard,
  Enter sends too, so a touch user cannot type a second line at all.
- **A send can lose text.** A successful send runs `setBody('')` (`:625`), which wipes anything typed while
  the request was in flight; a failed send raises only a timed toast, so on a bad connection the traveller
  can believe a message was posted.
- **The hint is permanent chrome and invisible to assistive technology.** The `Enter sends · Shift+Enter`
  line (`:734-743`) is a plain `<p>` the textarea does not reference.
- **Hardcoded copy, in a file this stage rewrites.** `thread.tsx:202` (the empty description), `:435`
  (`'Reply'`) and `:704` (the placeholder) are English literals, and `:532`/`:536` hand the **catalogue key**
  (`modules.collab.reaction.agree`...) to a `Tooltip` and an `aria-label` without calling `t()`, so a
  traveller hears the key.
- **Row actions are unreachable by touch.** The row's actions sit at `opacity-0` until the row is hovered
  or focused (`:425`); a touch screen has neither.
- **Below `xl` the page scrolls, not the thread.** The route bounds the thread's height only at `xl:`
  (`collab.tsx:104-108`), so on a phone the transcript has no scroll box of its own and any rule about where
  it scrolls would act on nothing.
- **The day heading is English for everyone.** It is built with `Intl.DateTimeFormat` pinned to `en-GB`
  (`thread.tsx:56-77`), while the frozen locale tables in `src/lib/format.ts` exist for exactly this.
- **The transcript follows the newest message unconditionally.** `scrollIntoView` on a bottom sentinel
  (`:159-161`) runs whenever the last id changes. That is harmless while history cannot be read; the moment
  "Load older" exists it yanks a reader out of what they are reading each time anyone posts, and
  `scrollIntoView` also scrolls the page on a phone.

Missing, and what a traveller asks of a trip's conversation: _what did we decide three weeks ago, and can
I answer without losing what I was typing?_

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                        | Not owned (read only, or left alone)                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/modules/collab/thread-model.ts` — new, pure                                                                                                                                         | `src/routes/_app/trips/$tripId/collab.tsx` and `-server/collab.ts` (`07-S2`: the screen, `loadTripCollab`, the header count)        |
| `src/components/modules/collab/__tests__/thread-model.test.ts`, `thread.test.tsx` — new                                                                                                             | `src/server/repos/collab.ts` — no repository change; `listMessages` and `listReactions` are used as they are (`07-S7` changes them) |
| `src/components/modules/collab/thread.tsx` — edit                                                                                                                                                   | `src/server/do/**`, `src/components/modules/collab/use-trip-room.ts`, `presence-bar.tsx` (`07-S1`)                                  |
| `src/server/fns/collab-thread.ts` — edit (created by `07-S2`): `loadOlderMessagesFn`; `src/server/fns/collab-payloads.ts` (also `07-S2`) — edit: the shared row mapper, where `threadPayload` lives | `src/components/modules/collab/types.ts` (`MessageData` is used as it is)                                                           |
| `src/lib/collab-thread.ts` — new, isomorphic: `THREAD_PAGE_SIZE`                                                                                                                                    | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3), `src/styles/**`                                                       |
| `src/server/repos/__tests__/tenant-isolation.test.ts` — append one `describe`                                                                                                                       | `src/server/db/**`, `drizzle/**` — no migration                                                                                     |
| `src/lib/i18n/messages/<locale>/modules.ts` — edit, **all 23 locales** (the `collab.*` keys)                                                                                                        | `e2e/` — no declaration is added (Verification)                                                                                     |
| This spec's `Status` / `Implementation` rows, the regenerated `.ai/specs/README.md`, any document the Phase 1 grep names                                                                            |                                                                                                                                     |

No route file changes, so `pnpm generate-routes` is not run. `src/lib/collab-thread.ts` is new and is the
one place the page size lives, so the loader (`threadPayload`) and `loadOlderMessagesFn` cannot disagree
and the client can tell "a full window, there may be more" from "fewer than a page, nothing older".

### Dependency on plan stage `07-S2`

`07-S2` ("Switch a trip's collaboration sections on and off", its spec, `.ai/specs/2026-10-05-switch-collaboration-sections-per-trip.md`, merged on PR #903 while this one was in review; its tickets may not exist yet) is the stage that splits `src/server/fns/collab.ts` into
`collab-thread.ts`, `collab-notes.ts` and `collab-polls.ts`, moves `loadTripCollab` into
`src/routes/_app/trips/$tripId/-server/collab.ts`, and repoints `thread.tsx`'s import paths. Its draft also
makes `Thread` and `Composer` report a dirty state upward (`onDirtyChange(sectionId, dirty)`), so a switch
cannot discard a half-typed message. This spec is written against that layout, which is also the plan's own
(the plan's **Owned paths** edit `src/server/fns/collab-thread.ts`).

- **Every phase is `Blocked by` the `07-S2` ticket that creates `collab-thread.ts`** (its file-split phase),
  and **Phases 3 and 4 are also `Blocked by` the `07-S2` ticket that rewrites `Thread` and `Composer`** (the
  dirty signal and the nullable props). Two PRs on one file is a merge hazard that costs more than the wait.
- **This file's name sorts after `2026-10-05-switch-collaboration-sections-per-trip.md` on purpose.** The
  Reconciler offers one slice candidate per tick, in path order (`unslicedSpecs` in
  `.ai/scripts/backlog-status.mjs`), so if both specs are merged and unsliced the `07-S2` spec is offered first
  and its tickets get filed; a name that sorted first would be offered every tick, end in `NO_ACTION_NEEDED`,
  and the wait below would never end. Do not rename it.
- **The slicing run must not slice this spec before those tickets exist.** `afk-to-tickets` ends with
  `NO_ACTION_NEEDED` until the `07-S2` file-split ticket exists as an issue, and each ticket it files names
  that issue by number in its `### Blocked by` (a spec path and a phase number are not a blocker the
  Reconciler can read). The same run files the two follow-ups of Out of scope (F1, F2) as issues.
- If the merged `07-S2` names a thing differently from the draft (`threadPayload`,
  `onDirtyChange`), the ticket run reads the merged code and follows it; the contract here is the behaviour,
  not the spelling. **The composer keeps reporting dirty** exactly as `07-S2` defined it, and this stage
  widens what counts as dirty (acceptance 7).
- `07-S1` (the trip-wide subscription) is **not** a blocker (Resolved assumption 14). The thread's liveness
  today is `PresenceBar`'s `router.invalidate()` on a room commit; `07-S1` moves that subscription up.
  Either way the loader window is re-read on a peer's chat write, which is the only fact this stage relies on.

### Departures from the plan's stage block

The panel and the specialists changed these things, each recorded in Resolved assumptions: the page size is
one constant rather than a client-chosen union (row 2); the hint shows while the field has focus on a fine
pointer rather than "once" (row 6); the composer is not auto-focused (row 7); there is no thread skeleton
(row 8); the visual verification is the blind pair plus a real-browser probe, not baselines (row 9); the
thread scrolls inside its own bounded box below `xl` (row 17).

### Phase 1 — Runs, jumbo glyphs and a localised day heading: `thread-model.ts`, wired into `thread.tsx`

The first slice a traveller can see, and the pure module every later phase extends.

`thread-model.ts` exports, with no React and no DOM:

- `RUN_WINDOW_MS = 5 * 60_000`.
- `startsRun(message, previous, timeZone): boolean` — **one predicate**, so `07-S7` adds the tombstone as a
  further clause without reshaping the module. True when there is no previous message, the author differs,
  the gap from `previous.createdAt` to `message.createdAt` exceeds the window (a negative gap, from clock
  skew, does not break; a non-finite one does), or `dayKeyIn` differs for the two instants **in the trip's
  zone**. The window is measured between neighbours, not from the run's first message, so a quick exchange is
  never cut in the middle by an arbitrary clock. A reply (`replyToId` set) does not break a run.
- `groupThread(messages, timeZone): ReadonlyArray<{ message; startsRun; startsDay }>` — `startsDay` is true
  for the first message and whenever the zone-local day changes, so a day divider is emitted once per day.
- `isJumboGlyphs(body: string): boolean` — true when the trimmed body consists of **one to three** emoji
  graphemes and nothing else (whitespace between them is ignored). Graphemes come from
  `Intl.Segmenter(undefined, { granularity: 'grapheme' })`; a grapheme is an emoji when it has emoji
  presentation (`\p{Emoji_Presentation}`), is a pictograph followed by `U+FE0F`, is a pictograph with an emoji
  modifier, is a pair of regional indicators (a flag), or is a keycap sequence. A bare digit, `©` or `™` is
  not. A ZWJ family or a skin-tone-modified hand is **one** grapheme. When `Intl.Segmenter` is undefined the
  function returns `false`, so a platform without it renders every message normally. It never changes the
  stored text and is a render decision only.

`thread.tsx` replaces its inline `previous`/`newDay`/`runs` arithmetic with `groupThread`, and renders a
jumbo message at `text-title` size with no bubble (the reply quote, the edited mark and the reactions are
unchanged). `startsRun === false` rows carry the body alone, indented to the same measure, so the column
edge stays straight, exactly as the run rows do today.

**The day divider is localised here.** It keeps today's look (rule, label, rule); its label is built from
the frozen locale tables in `src/lib/format.ts` (`formatWeekday(dayKey, locale)` and
`formatDayMonth(dayKey, locale)`), not from `Intl.DateTimeFormat` pinned to `en-GB` (`thread.tsx:56`), so a
Polish traveller reads a Polish day heading. "Today" keeps its existing key (`collab.thread.today`). The
clock time of each message keeps the file's `LOCALE` formatter and is named as follow-up F3 (Out of scope),
because it is shared with the other trip-tab call sites.

### Phase 2 — Copy debt and touch reach in the file this stage rewrites

No behaviour of the thread changes for a sighted desktop traveller; it stops being wrong for everyone else.

- The empty-state description (`:202`), the `Reply` menu label (`:435`) and the composer placeholder (`:704`)
  go through `t()`; the key for `Reply` already exists (`modules.collab.message.reply`).
- The six reaction labels (`REACTIONS[].label` is a key) are passed through `t()` before they reach the
  `Tooltip` and the `aria-label`.
- The row's action group keeps its existing classes (`group-hover/message:opacity-100 focus-within:opacity-100`, so a keyboard user still sees it, WCAG 2.4.7) and adds `pointer-coarse:opacity-100` (`src/components/ui/table.tsx:213` is the precedent). It stays in the tab order in both cases, as today.

### Phase 3 — The composer's key contract and a failed send that keeps the text

All inside `Composer` in `thread.tsx`.

- **Enter.** On a **fine pointer** `Enter` sends and `Shift+Enter` adds a line, as today. On a **coarse
  pointer** (`matchMedia('(pointer: coarse)')`, read after hydration, defaulting to fine on the server)
  `Enter` adds a line and the send button is the only way to send. On every device a keydown whose
  `event.nativeEvent.isComposing` is true or whose `keyCode` is `229` is ignored by the **whole** `onKeyDown` before anything else, so neither Enter nor Escape acts while a candidate is being composed (Escape would otherwise cancel a reply or edit and clear the draft of exactly the traveller this guards) (the `229` check is Safari's, which reports `isComposing: false` for the confirming Enter).
  `Escape` still cancels a reply or an edit.
- **The hint.** The visible `Kbd` row (`Enter sends · Shift+Enter adds a line`, plus `Esc cancels` while
  replying or editing) is shown **while the field has focus, on a fine pointer only**, and is `aria-hidden`
  (it is a visual duplicate). Its row keeps its height whether shown or not, so focusing the field does not
  move the layout. The information is carried by an always-mounted visually hidden node that the textarea's
  `aria-describedby` points at: "Press Enter to send, Shift and Enter for a new line" on a fine pointer, "Use
  the send button to send" on a coarse one, and, **while replying or editing, a second sentence "Press Escape
  to cancel"**. Nothing is stored in `localStorage`.
- **A send that cannot lose what was typed.** A ref guards the send in addition to `action.pending`, so two
  quick Enters or a double tap cannot post twice. On success the field is cleared **only if it still equals
  the text that was sent**; text typed during the request survives.
- **A failed send.** The toast `useAction` raises stays (it cannot be suppressed and need not be). Above the
  composer an inline `Alert` (tone `danger`, size `sm`) shows the existing title (`collab.toast.notSent`, or
  `collab.toast.editFailed` for an edit) and a **fixed catalogue body**, never the server's message (it may
  be English, an internal code or a stack): `collab.toast.notSentBody` for a send (exists) and
  `collab.toast.editFailedBody` for an edit (new; it is **also** the edit action's `fallback`, which the edit
  `useAction` lacks today, so the toast never shows an untranslated server string either). Below the text a
  **Try again** `Button` re-sends what is **currently in the field**; it shows `loading` while the retry runs
  and shares the send ref guard, so it cannot post twice. The `Alert`'s default `role="alert"` and
  `aria-live` are overridden to absent: the toast announces the failure once. The alert's id is added to the
  textarea's `aria-describedby`, so the failure is read when the field is focused. Focus: it stays where the
  traveller left it; when "Try again" is activated and then disappears (the retry succeeded), focus
  returns to the textarea on settle. While `loading`, the button stays focusable and inert. The alert
  clears on the next successful
  send, when the field is emptied, or when the failed send turns out to have **landed** (next bullet).
- **A send whose answer was lost.** A post can reach the server and the response not come back. The composer
  records the newest message id in the window when a send starts. After a failure, when a later window holds
  a message authored by the viewer, whose body equals the attempted body and whose id is **greater** than that
  recorded id (ids are time-sortable, so no clock is read), the send landed: the alert clears and the field
  is cleared **only if it still equals the attempted body**. A genuine duplicate cannot be created by this
  rule, because nothing is re-sent.
- **The dirty signal.** The composer is dirty (`07-S2`'s `onDirtyChange`) when the field is non-empty, an
  edit is in progress, or a failed-send alert is showing.
- **The empty state.** Title "Say the first thing" (the existing `modules.collab.thread.empty` key, new
  English text), the existing description, and **no autofocus** (Resolved assumption 7): the composer is the
  next tab stop and sits directly under the empty state.

### Phase 4 — "Load older", the viewer's own actions on older rows, and where the transcript scrolls

The slice that fixes the reported defect. It is one slice on purpose (Resolved assumption 15): own
delete/edit/react on an older row, and "follow only at the bottom", are what make loading history safe, and
a "Load older" that ships without them hands the reader a transcript that yanks them and loses their edits.
`afk-to-tickets` may cut it into at most the three parts below if a single PR is too large.

**Server.** `loadOlderMessagesFn` in `src/server/fns/collab-thread.ts`:

- `createServerFn({ method: 'GET' })`; validator `z.strictObject({ tripId, cursor })` with `tripId` and
  `cursor` both `z.string().trim().min(1).max(64)` and an `error` message on each, as the repository's strict
  inputs do. There is **no page-size input**: the page is `THREAD_PAGE_SIZE` (50), because a client-chosen
  size is a client-chosen row scan and D1 bills rows read.
- Handler: `const scope = await appScope()`, `const trip = await requireTrip(scope, data.tripId)` (a trip of
  another workspace, or a private trip of the caller's own workspace that the caller is not a member of, is a
  `NotFoundError` before the cursor is looked at, ADR 0007), then
  `listMessages(scope, trip.id, { limit: THREAD_PAGE_SIZE, cursor: data.cursor })` and
  `listReactions(scope, ids)` for **exactly the ids of `page.items`**. Returns
  `{ messages: MessageData[] /* oldest first */, exhausted: page.nextCursor === null }`, mapped by **the same row mapper** `threadPayload` uses (one owner, wherever `07-S2` put `threadPayload`: its draft says `src/server/fns/collab-payloads.ts`; the function itself stays in `collab-thread.ts`).
- **The per-trip conversation switch of `07-S2` is not consulted.** That switch is a display choice, not
  access control (its spec says so); the reader serves any member of the trip, and a trip whose conversation
  section is switched off simply never renders the control. Recorded as Resolved assumption 16.
- The cursor is not an authorisation input. It only narrows a query that is already tenant- and trip-scoped,
  so a cursor lifted from another workspace's page selects nothing of that workspace's.
- `threadPayload` replaces its literal `50` with `THREAD_PAGE_SIZE`. Nothing is enqueued, nothing mirrored.

**Client model.** `thread-model.ts` gains the pure functions below, and `thread.tsx` holds `held` (older
rows, a client **snapshot**) in state:

- `mergeThread(held, window)` returns the displayed list. The loader `window` is authoritative for every id
  `>= min(window)`, so a peer's delete inside that range disappears; held rows with `id < min(window)` are
  kept, and rows that **slide out** of the window as new messages arrive join `held` (so a message is never
  skipped between the window and the held rows). Deduplicated by id, oldest first. It relies on ids being
  time-sortable (`newId()`), the same property the keyset cursor relies on.
- **`byId` for reply quotes is built from the merged list.** A reply whose quoted message is older than every
  held row has no target to show: it renders as an ordinary message, without the quote, exactly as a reply to
  a message outside the window does today; it keeps its place in a run.
- **Non-overlapping window.** Contiguity is proven only when `min(window) <= max(previous displayed)`. When
  more than a page arrived while the viewer was disconnected, nothing links the two sets: `held` is dropped,
  the window stands alone, and the control is shown again. No scroll jump; one extra click, never a hole.
- **Cursor and exhaustion.** The cursor is the **oldest id displayed**. The control is shown when
  `window.length >= THREAD_PAGE_SIZE` (a shorter window means there is nothing older) and until a response
  says `exhausted`. A trip with exactly 50 messages yields an empty first page, which flips the control to
  the exhausted line; that is accepted (Resolved assumption 11 records why `exhausted` is not carried by the
  loader).
- **One request at a time.** A ref allows one request in flight, so a double activation fires one. A response
  whose requested cursor no longer equals the oldest displayed id (a reset happened meanwhile) is discarded.
- **No cap.** Nothing is evicted and nothing is capped: the reader asked for those rows and is looking at
  them. Memory is not the constraint at the sizes a trip's conversation reaches; DOM weight is, and it is
  named in Risks. Virtualising the list is out of scope.
- **Staleness, stated.** Other members' edits, deletes and reactions on messages **above** the loaded window
  appear after a reload or a reset; this is the price of reading history without re-billing rows read on every
  peer commit (Risks).
- **The viewer's own actions on held rows.** The loader does not re-read held rows, so the viewer's own
  delete, edit or reaction on one would be overwritten by the stale snapshot. Pure helpers, each called from
  the matching `useAction` success: `removeMessage(held, id)` on delete; `editMessage(held, id, body,
editedAt)` with the text just sent and the client's `now` as an ISO string (only "edited" is displayed);
  and, for a reaction, the claimed `run` closure calls `toggle.run` and then applies
  `setViewerReaction(held, id, viewerUserId, emoji, added)` from the returned `{ added }` **inside** the
  closure and therefore before the claim settles, so a held row never shows its old count between the
  settle and the patch. Rows still inside the window are patched by the loader as today.

**The control.** A row **outside the scroller**, directly above the `overflow-y-auto` transcript (so it
never scrolls away, is not part of the list, and a prepend cannot move it). A `Button`
with `data-part="thread-load-older"`:

- **rest** — "Load earlier messages";
- **loading** — `loading` with `loadingLabel` = `collab.thread.loadingOlder` ("Loading earlier messages"),
  the visible label unchanged so the row does not reflow;
- **failed** — a line "Earlier messages did not load" and the button reading "Try again". The line carries
  no `role="alert"`; it is read through the shared status region (Phase 5);
- **exhausted** — the button is replaced by a quiet line "This is where the conversation starts".

**Focus** (the button remains focusable and inert while loading; apply the settled focus target with
`focus({ preventScroll: true })` so the move cannot scroll the page): after a page the **control**; after the
last page the exhausted line (`tabIndex={-1}`), which is **focused and not also announced**; after a failure
the "Try again" button. The prepend does not animate.

**Where the transcript scrolls.** The `overflow-y-auto` div (now with a ref) is the scroller, and `Thread`
gives **it** a bounded height below `xl`: `max-h-[70svh] xl:max-h-none`, inside `thread.tsx` (an owned file).
Today the route bounds the thread only at `xl:` (`collab.tsx:104-108`), so below `xl` the page scrolls and
the transcript never does, and every scroll rule below would act on a box that does not scroll. At `xl` the
route's bound applies, as today.

- **Opening position.** On first render (after hydration, not on a prepend) the scroller's `scrollTop` is set to its `scrollHeight`, once, so the newest message is the last visible row of the transcript box. The page is not scrolled on load. At 360x800 the composer may sit below the fold (the nav bars, module header and panel header take roughly 330 px, and the box is up to `70svh`) and is reached by one page scroll; at `xl` the composer is in view, as today.
- **Prepend:** before the older page is applied the handler records `scrollHeight` and `scrollTop`; a
  `useLayoutEffect` after the commit sets `scrollTop` to the old `scrollTop` plus the height the prepend
  added, in every browser (WebKit has no scroll anchoring).
- **Follow only near the bottom** (owned here, with the scroller): `scrollIntoView` on the bottom sentinel
  (`thread.tsx:160`) is replaced everywhere by writes to this container's own `scrollTop`, so the page itself
  never scrolls. A message that arrives live (after the first render, not a prepend) scrolls the transcript
  to the bottom **only** when the viewer was within **48 px** of the bottom before it landed, or when the new
  message is the viewer's own. Otherwise nothing scrolls. No "N new messages" jump control in this stage
  (Out of scope).

### Phase 5 — Announcements and the arrival of a live row

- One visually hidden `role="status"` region, always mounted and empty on the server, owned by `Thread`. It is
  **cleared before every write** so the same text twice is still read. After a page loads it says "Loaded
  {count} earlier messages"; when a load fails, "Earlier messages did not load"; when nothing is left, "This is
  where the conversation starts" (the exhausted line is **focused and is not also announced**, so this text is
  written only when focus is not moved there).
- A peer's live message is announced **whether or not the transcript scrolls for it**: "New message from
  {name}" (one) or "{count} new messages" (several, grouped over a literal 1000 ms), never the message text,
  never the viewer's own, never on the first render or on a prepend. `role="log"` and `aria-live` are never
  put on the `<ol>`: a prepend would be read row by row.
- A row that arrived live enters over the 220 ms `--duration` token on `--ease-out-quint` with a 6 px rise and
  an opacity fade, written with the `starting:` utilities `menu.tsx` already uses and applied **only** to
  rows flagged as live arrivals (otherwise server-rendered rows would animate on load). Under
  `prefers-reduced-motion: reduce` it is opacity only (`motion-reduce:` classes drop the translate).

### Alternatives considered, and why they lost

| Alternative                                      | Why not                                                                                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drop the held pages on every loader revalidation | Every peer's chat write collapses the reader's view to the newest 50 (a jumping transcript); the plan's own "no animation on a prepend" argument rules it out. |
| Re-read the held range on every revalidation     | Needs a range reader in `repos/collab.ts` (not this stage's) and re-bills D1 rows read, growing with scroll depth, on every peer commit.                       |
| A client-chosen page size (25 or 50)             | The UI only ever asks for one size; a union of one literal is a constant, and a client-chosen size is a client-chosen scan.                                    |
| A cap on held rows with a "reload" line          | The reader loses the way back to what they were reading and must reload; it needed a measurement nobody has (Resolved assumption 12).                          |
| Offset paging                                    | The repository's keyset cursor is stable under inserts; an offset slides when anyone posts.                                                                    |
| Enter sends everywhere (the plan)                | Sends half-written plans from a phone and half-typed text from an IME; the send button exists for exactly the touch case.                                      |

## 📝 Architecture

| Concept                                  | Owner module                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Run grouping, day boundaries, jumbo test | `src/components/modules/collab/thread-model.ts` (pure)                                                                                                 |
| Merging held rows with the loader window | `thread-model.ts` (`mergeThread`, `removeMessage`, `editMessage`, ...)                                                                                 |
| The page size                            | `src/lib/collab-thread.ts` (`THREAD_PAGE_SIZE`), read by both ends                                                                                     |
| Reading an older page, the row mapper    | `collab-thread.ts` (the function); the mapper beside `threadPayload` (`collab-payloads.ts` in `07-S2`'s draft) — one mapper, used by loader and reader |
| Paging SQL                               | `src/server/repos/collab.ts` `listMessages` — **unchanged**                                                                                            |
| Day heading text                         | `src/lib/format.ts` (`formatWeekday`, `formatDayMonth`) — **unchanged**                                                                                |
| Rendering, scroll, live regions          | `src/components/modules/collab/thread.tsx`                                                                                                             |

Seams: `components/modules/collab` imports server functions (as it does today) and never `server/repos`; the
repository is reached only through the server function, which resolves the tenant scope and re-resolves the
trip inside it. `docs/SPEC.md` §6 holds (all SQL in `server/repos` through `tenantFilter()`); §8 ("one concept,
one owner") holds because the constant and the mapper each have one home.

## 📝 Data Model

None. Every column read exists: `collab_messages` carries `reply_to_id`, `edited_at` and `deleted_at`. The page
is the repository's keyset page on the primary key: `ORDER BY id DESC` and `id < cursor`
(`src/server/repos/base.ts:375-386`), filtered by tenant and trip; it does **not** order by `created_at`. That
is correct because `newId()` is time-sortable, so id order is message order, and `mergeThread`'s
"`id >= min(window)`" rule relies on the same property. No migration, no backfill.

## 📝 API Contracts

| Function              | Method | Input (Zod `strictObject`) | Output                                                          | Authorisation                                           |
| --------------------- | ------ | -------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| `loadOlderMessagesFn` | GET    | `{ tripId, cursor }`       | `{ messages: MessageData[]` (oldest first)`, exhausted: bool }` | `appScope()` then `requireTrip`: any reader of the trip |

No other server function changes. `postMessageFn`, `editMessageFn`, `deleteMessageFn` and `toggleReactionFn` keep
their inputs, outputs, notification and room mirror.

## 📝 UI/UX

- **Route.** Unchanged. The thread stays the 24rem rail beside notes and polls at `xl`, and the whole screen
  below, where the transcript now has its own bounded scroll box (Phase 4).
- **Primitives reused.** `Avatar`, `Button`, `IconButton`, `Kbd`, `Textarea`, `Alert`, `Spinner`, `EmptyState`,
  `Tooltip`, `Popover`. None is added. `Alert` carries the failed send; `Skeleton` is not used (assumption 8).
- **Tokens.** `text-title` (jumbo), `text-caption` (times, hint), `text-micro` (day label), `bg-surface-2`,
  `border-edge-faint`, `--duration` and `--ease-out-quint`. `tabular-nums` on times and counts. None missing.
- **States.** Transcript: empty ("Say the first thing", no illustration), resting, live arrival. Load older:
  rest, loading, failed, exhausted. Composer: idle, sending, failed (inline alert), editing, replying.
- **Touch (360 px).** The transcript is a bounded scroll box (`70svh`) above the composer; the opening position is the newest message at the bottom of the transcript box, the composer one page scroll away; the row actions are visible; the hint is absent; Enter adds a line.
- **RTL (`ar`).** Logical properties only; the avatar column and the run indent mirror.

## 📝 Visual change expected

Route `/trips/$tripId/collab`, thread panel, light and dark, 360 / 1280 / 2560 px:

- consecutive messages by one person inside five minutes lose their repeated avatar and name (they already do
  within a day; the visible change is that a long gap now starts a new run);
- a message that is only emoji renders large with no bubble;
- the day divider reads in the traveller's language;
- a "Load earlier messages" button above the transcript when 50 or more messages exist;
- below `xl` the transcript scrolls inside its own box instead of the page scrolling;
- the hint under the composer appears on focus (fine pointer) instead of always;
- an inline red alert above the composer after a failed send;
- row actions visible on a touch screen.

Nothing changes for a short conversation at rest except the hint, the empty-state title and the day heading's
language.

## 📝 Copy

New or changed `en` keys (the implementation lands each in all 23 locales per the `i18n-messages` skill;
`modules.ts`, prefix `collab.`; `collab.compose.placeholderText`, "Say something to the group…", already exists, added by #682):

| Key                             | `en`                                                                                                                       | Phase |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----- |
| `collab.thread.emptyBody`       | Everyone on this trip shares one thread. Decisions made here stay with the trip rather than scattering across group chats. | 2     |
| `collab.thread.empty` (changed) | Say the first thing                                                                                                        | 3     |
| `collab.compose.keysHint`       | Press Enter to send, Shift and Enter for a new line.                                                                       | 3     |
| `collab.compose.keysHintEsc`    | Press Escape to cancel.                                                                                                    | 3     |
| `collab.compose.keysHintTouch`  | Use the send button to send.                                                                                               | 3     |
| `collab.compose.retry`          | Try again                                                                                                                  | 3     |
| `collab.toast.editFailedBody`   | Your changes are still in the box. Check your connection, then try again.                                                  | 3     |
| `collab.thread.loadOlder`       | Load earlier messages                                                                                                      | 4     |
| `collab.thread.loadingOlder`    | Loading earlier messages                                                                                                   | 4     |
| `collab.thread.loadOlderFailed` | Earlier messages did not load                                                                                              | 4     |
| `collab.thread.retry`           | Try again                                                                                                                  | 4     |
| `collab.thread.start`           | This is where the conversation starts                                                                                      | 4     |
| `collab.thread.loadedEarlier`   | `one`: Loaded {earlier} earlier message · `other`: Loaded {earlier} earlier messages                                       | 5     |
| `collab.thread.newFrom`         | New message from {name}                                                                                                    | 5     |
| `collab.thread.newMany`         | `one`: {new} new message · `other`: {new} new messages                                                                     | 5     |

The existing `collab.toast.notSentBody` (the send's fixed body) is reused. **Plurals use the catalogue's real
format**: an object keyed by category, selected by the `count` param, with the number printed through a
**separately named** param formatted by `formatNumber(n, locale)`, exactly as `trips.collab.count.messages`
does (`{messages}` printed, `count` selecting). `ar` carries all six categories; `pl`, `ru`, `uk` and `cs` the
branches `en` lacks. **Translator context** (a JSDoc comment on the key, as `collab.hint.*` has): "Say the first
thing" is an invitation to write the first message of an empty conversation, not a command; the two "Try again"
keys are a button that repeats a failed send and a button that repeats a failed page load. The existing keys
`collab.reaction.*`, `collab.message.reply`, `collab.toast.notSent`, `collab.toast.editFailed` and
`collab.hint.*` are reused as they are. A key whose English changes (`collab.thread.empty`) is updated in every
locale, not only `en`; the parity test checks keys, so a reviewer checks the text.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                   | Behaviour                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trip with 0, 1, 49, 50, 51 messages                                    | 0: empty state. 1-49: no control. 50: control shown, first click may return an empty page and show "starts here". 51: control, one page.                                                          |
| Two clicks on "Load older"                                             | The button is focusable but inert while loading and a ref allows one request; the second never fires.                                                                                               |
| The reader loads older pages and a peer posts                          | The window re-reads; `mergeThread` keeps held rows below `min(window)`; the new row is appended; no scroll unless the reader was within 48 px of the bottom; announced.                           |
| More than a page arrives while disconnected                            | No overlap: held rows dropped, window stands alone, control shown again, no scroll jump.                                                                                                          |
| A response arrives after a reset                                       | Discarded (its cursor is no longer the oldest displayed id).                                                                                                                                      |
| `loadOlderMessagesFn` fails (offline, 500)                             | Failed line and "Try again"; held rows and scroll position untouched; focus on "Try again".                                                                                                       |
| A cursor of another workspace or trip                                  | `requireTrip` refuses a foreign trip; a foreign cursor on one's own trip narrows to one's own rows. Never another's rows.                                                                         |
| A private trip of the caller's workspace the caller is not a member of | `NotFoundError` (ADR 0007), the same as a foreign workspace.                                                                                                                                      |
| A reply whose quoted message is older than every held row              | Renders as an ordinary message without the quote, as today; it keeps its place in a run; loading older pages brings the quote in.                                                                 |
| A held message is deleted by someone else                              | Stays visible until reload or reset (stated staleness).                                                                                                                                           |
| The viewer deletes / edits / reacts on a held row                      | Patched locally from the success result (Phase 4); a failed call leaves the row as it was.                                                                                                        |
| IME composition: Enter confirms a candidate                            | Nothing is sent, on every browser including Safari (`keyCode` 229). Escape during composition cancels nothing.                                                                                    |
| Touch device                                                           | Enter adds a line; the send button sends; no hint.                                                                                                                                                |
| Send fails, then the traveller edits the field and presses Try again   | The current field text is sent; the alert clears on success; the button shows `loading`; focus returns to the textarea on settle.                                                                 |
| A post reaches the server but the response is lost                     | The next window shows the viewer's message with the same body and a greater id: the alert clears, the field clears only if unchanged; nothing is re-sent.                                         |
| Text typed while a send is in flight                                   | Survives the success; the field is cleared only if it still equals what was sent.                                                                                                                 |
| The server error text is English, a code, or a stack                   | Never shown in the alert or the edit toast: both use catalogue copy.                                                                                                                              |
| Body is `👍`, `👍👍👍`, `👍 🎉`, `👍🏽`, `👨‍👩‍👧`, `🇵🇱`                      | Jumbo. `👍👍👍👍`, `👍 ok`, `1`, `©`, an empty body: not jumbo.                                                                                                                                   |
| `Intl.Segmenter` missing                                               | Nothing is jumbo; every message renders normally.                                                                                                                                                 |
| Clock skew gives a negative gap between neighbours                     | Does not break the run. A non-finite gap does.                                                                                                                                                    |
| Author has left the trip                                               | The existing removed-person fallback name renders; unchanged.                                                                                                                                     |
| Viewer reads history and a message arrives                             | No scroll; a polite announcement; the viewer's own message always scrolls.                                                                                                                        |
| `prefers-reduced-motion: reduce`                                       | The live-arrival entrance is opacity only; a prepend never animates.                                                                                                                              |
| A 360 px phone, below `xl`                                             | The transcript scrolls in its own `70svh` box; opening at its bottom; the page is not scrolled on load; a prepend keeps the reader's place (WebKit included); the composer may be below the fold. |

## 📝 Observability

None added. A failed `loadOlderMessagesFn` reaches the existing server-function error path and Sentry like any other
server function; the client shows the failed state.

## ✅ Acceptance criteria

Phase in brackets.

1. [1] `startsRun` is true for the first message, a different author, a gap over 5 minutes and a day change in the
   trip's zone; false for the same author at 4 min 59 s; a reply does not break a run; a negative gap does not
   break and a non-finite one does. `groupThread` emits a day divider once per day, not once per message.
2. [1] `isJumboGlyphs` is true for 1, 2 and 3 emoji, for a skin-tone hand, a ZWJ family, a flag and a keycap, and
   for emoji separated by spaces; false for four emoji, an emoji plus a word, a bare digit, `©`, and an empty
   body; false for everything when `Intl.Segmenter` is stubbed away. The stored `body` is never altered.
3. [1] A jumbo message renders at `text-title` with no bubble; a run's continuation rows have no avatar or name
   and share the run's left edge; the day divider's text comes from `formatWeekday`/`formatDayMonth` for the
   active locale (a test renders `pl` and asserts it is not the `en-GB` string).
4. [2] No English literal remains in `thread.tsx` for the empty description, `Reply` or the placeholder; the six
   reaction tooltips and accessible names are translated text, never a key; the row actions carry `pointer-coarse:opacity-100` and still carry `group-hover/message:opacity-100` and `focus-within:opacity-100`, and stay in the tab order.
5. [3] Enter with `isComposing: true`, and with `keyCode` 229, sends nothing, and Escape with either cancels no reply or edit and clears nothing; Enter on a fine pointer sends,
   Shift+Enter adds a line; Enter on a coarse pointer adds a line and only the button sends.
6. [3] The visible hint row is `aria-hidden`, visible while the field has focus on a fine pointer, absent on a
   coarse one, and reserves its height; the textarea's `aria-describedby` resolves to an always-mounted node
   whose text matches the device and, while replying or editing, also says Escape cancels.
7. [3] A failed send keeps the text, shows the toast and an inline alert whose body is catalogue copy (never the
   server's message), with "Try again" that re-sends the field's current text, shows `loading` and shares the
   send ref guard; the alert has neither `role="alert"` nor `aria-live` and its id is in the textarea's
   `aria-describedby`; focus is in the textarea after the retry settles; a second Enter or a double tap while a
   send is in flight posts once; text typed during a send survives its success; a failed edit behaves the same
   way and its toast uses `collab.toast.editFailedBody` as the `fallback`; a failed send that later shows the
   viewer's same-body message with a greater id clears the alert; the composer reports **dirty** with a
   non-empty field, with an edit in progress and with the failed-send alert showing.
8. [3] The empty state reads "Say the first thing" and focus is **not** moved on mount.
9. [4] `loadOlderMessagesFn` returns the page older than the cursor, oldest first, with reactions for exactly the
   ids of that page, and `exhausted` true on the last page; a foreign trip id and a private trip the caller is
   not a member of are a `NotFoundError`; it has no page-size input.
10. [4] Tenant isolation (a `describe` appended to the suite): with **at least two messages seeded in A's trip**,
    in A's scope `listMessages` for B's trip id returns an empty page; `requireById` of B's message raises
    `NotFoundError`; B's message id used as the cursor on A's trip, and a cursor of `'~'`, each return only rows
    whose org and trip are A's and **no B id appears** (the test does not assert which of A's rows come back);
    `listReactions(alpha.tenant.scope, [beta.messageId])` returns an empty map; B's rows are unchanged afterwards.
11. [4] `mergeThread` retains slid-out rows, drops a peer-deleted row inside the window range, deduplicates, and
    resets on a non-overlapping window; a response for a stale cursor is discarded; a reply whose target is
    absent renders without a quote.
12. [4] The control sits outside the scroller. It shows rest, loading (`loadingLabel` set, label unchanged, no
    reflow), failed (line plus "Try again") and exhausted; a double activation fires one request; focus lands
    on the control after a page, on the exhausted line after the last page, on "Try again" after a failure,
    always with `focus({ preventScroll: true })` (asserted on the call's options); no `aria-live` is on the
    list.
13. [4] After loading older pages, the viewer's own delete removes the row, an edit shows the new text and
    "edited", and a reaction shows the new count with no flash of the old one.
14. [4] Scroll, asserted with stubbed `scrollHeight`/`scrollTop` (jsdom has no layout) on the container's written
    values, never `scrollIntoView` and never `window.scrollTo`: a prepend writes the old `scrollTop` plus the
    added height; a live message writes the bottom only within 48 px of the bottom or when it is the viewer's
    own; the scroller has `max-h-[70svh] xl:max-h-none`; on mount the scroller's `scrollTop` is written to its `scrollHeight`, and only once. **In a real browser** (below), at 360 px: the scroller is at its bottom after load and `window.scrollY` is unchanged by the load (the composer being on screen is not asserted), a prepend keeps the reader's place in WebKit, and a live message does not move a reader of history.
15. [5] The status region is cleared before each write and says how many earlier messages loaded; a peer's live
    message is announced whether or not the transcript scrolled, grouped over 1000 ms, never with its text and
    never for the viewer's own; only live rows carry the `starting:` entrance and its `motion-reduce:` classes
    are opacity only.
16. [all] Zero console errors or warnings; light and dark; 360 / 1280 / 2560; every new key in all 23 locales.

## 📝 Risks & Impact Review

| Risk                                                                                  | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Older rows are a snapshot: others' edits/deletes/reactions above the window are stale | Stated here and in acceptance 11; the alternative re-bills D1 rows on every peer commit. Swapping it later touches `mergeThread` and one function.                                                                                                                                                                                                                                                                                                                                                                                            |
| A cursor is a user-supplied string                                                    | It only narrows an already tenant- and trip-scoped query; tested with a cross-tenant cursor and a `'~'` cursor (acceptance 10).                                                                                                                                                                                                                                                                                                                                                                                                               |
| Rows read grow with scroll depth                                                      | One constant page size and a reaction read keyed to the page's ids. Measured (`EXPLAIN QUERY PLAN` on the migrated schema): the page orders by `id`, which no index covers, so each read scans the trip's non-deleted rows through `collab_messages_org_trip_idx` and sorts them; D1 rows read therefore grow with the **total thread length**, not with scroll depth, and a click costs about what today's loader read costs. A `(trip_id, id)` index would make it a range read; it is a migration and is out of scope here (Out of scope). |
| DOM weight of a long transcript with no cap and no virtualisation                     | Nobody has measured a trip past a few hundred messages; a measurement, then a virtual list, is its own stage. Not decided here, not hidden.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `07-S2` lands differently from its draft                                              | The ticket run follows the merged code; the contract is the behaviour. Phases are `Blocked by` `07-S2`'s tickets by issue number, and slicing waits for them.                                                                                                                                                                                                                                                                                                                                                                                 |
| IME, a real screen reader's output and contrast cannot be verified unattended         | The unit tests assert the mechanism (`isComposing`, `keyCode`, ids, roles, classes); a person confirms the experience at review, which the PR body says.                                                                                                                                                                                                                                                                                                                                                                                      |
| `@starting-style` support                                                             | Already used by `menu.tsx`; where unsupported the row simply appears.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Changing `collab.thread.empty`'s English                                              | Updated in all 23 locales in the same change; the parity test checks keys, so a reviewer checks the text.                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Backward compatibility (`BACKWARD_COMPATIBILITY.md`): additive. One new GET server function, no changed signature, no
migration, no event or route renamed.

### Out of scope

- **F1. The header count and the panel count read the loaded window** (`collab.tsx`), so a long thread says "50
  messages". The route file is `07-S2`'s. The slicing run files this as an issue **blocked by** the `07-S2`
  ticket that owns that file; it must either count the whole thread or stop printing a number that is only the
  window.
- **F2. Reaction, edit and delete do not check that the message belongs to the trip sent.** `toggleReaction`,
  `editMessage` and `deleteMessage` call `requireById` on the message id only; a member could react to, and an
  admin delete, a message of a private trip they are not a member of, by pairing its id with a trip they can
  see. A security finding that predates this stage and is not changed by it; the slicing run files it as an
  issue labelled `security` (#913, which closed it). `07-S2`'s Phase 1 ticket may already file the same issue: the slicing run files F2 only if no open `security` issue naming `toggleReaction`, `editMessage` or `deleteMessage` exists, and otherwise cites that one.
- **F3. The clock time of each message** keeps the file's `LOCALE = 'en-GB'` formatter (`thread.tsx:56`),
  shared with the other trip-tab call sites of `12-verification-protocol.md` §7.2.
- **Tombstones for deleted messages, who deleted, quote replies.** `07-S7` owns them; `startsRun` is built so the
  tombstone is one more clause.
- **A `(trip_id, id)` index on `collab_messages`**, if a measurement shows the per-read scan matters: its own migration ticket, not this stage's.
- **A "N new messages" jump control** while reading history; a separate slice if the announcement proves too quiet.
- **Virtualising the transcript** and any cap on held rows.
- **An unread badge**, a draft saved across navigation, mentions, attachments (`07-S8`).

## 📋 Phasing

| Phase | Slice                                                                      | Blocked by                                                   | Usable when it merges                                                                   |
| ----- | -------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1     | Runs, jumbo glyphs, a localised day heading (`thread-model.ts`)            | `07-S2` file-split ticket                                    | A long gap starts a new run; an emoji-only message reads large; days read in the locale |
| 2     | Copy debt and touch reach                                                  | `07-S2` file-split ticket                                    | The thread speaks the traveller's language; touch users can reach Reply, Edit, Delete   |
| 3     | The composer's key contract; a failed send keeps text; the dirty signal    | `07-S2` file-split ticket and its `Thread`/`Composer` ticket | Safe for IME and touch; a failed send is not lost                                       |
| 4     | "Load older": function, merge, control, own actions, scroll box and follow | Phases 1 and 3; `07-S2` `Thread`/`Composer` ticket           | A traveller reads back through the conversation, and acting on it still works           |
| 5     | Announcements and the live row's entrance                                  | Phase 4                                                      | A screen-reader or low-vision reader is told what a long thread is doing                |

Five tickets for `afk-to-tickets`; Phases 1-3 are independent of each other once `07-S2`'s tickets have merged, so
they may be taken in any order (Phase 3 after the `07-S2` rewrite of `Composer`). Phase 4 builds on Phase 1's module
and on the composer's dirty signal. Phase 4 is the heavy one; the slicer may cut it into server + merge model, control + scroll, and own actions, but not below that. **If Phase 4 is cut, the order is fixed and each cut ticket is `Blocked by` the previous one by issue number:** (a) `loadOlderMessagesFn`, `THREAD_PAGE_SIZE`, `mergeThread`, the three own-action helpers and their wiring into the `useAction` successes (inert while `held` is empty); (b) the control, the bounded scroller, prepend restore and follow-near-bottom. The ticket that renders the "Load earlier messages" control must not merge before the own-action wiring has. Acceptance 13 belongs to (a) and is asserted with a seeded `held`.

## 📋 Implementation Plan

### Phase 1 — Runs, jumbo glyphs, the localised day heading

1. Write `__tests__/thread-model.test.ts` first (acceptance 1-2); watch it fail.
2. Create `thread-model.ts` (`RUN_WINDOW_MS`, `startsRun`, `groupThread`, `isJumboGlyphs`); pass the tests.
3. Wire `thread.tsx` to `groupThread`; render a jumbo message; build the day label from `formatWeekday` and
   `formatDayMonth`; extend a `thread.test.tsx` render test (acceptance 3).
4. Docs grep (the rule in `AGENTS.md`, recorded in the PR template): `thread.tsx`, `COL-03`, `Intl.Segmenter`,
   `collab-thread`, `07-S3` across `docs/`, `.ai/`, `src/`, `CONTEXT.md`; update what states what this phase changes.

### Phase 2 — Copy debt and touch reach

1. Add the keys (Copy table, phase 2) to all 23 locales; run the parity test.
2. Replace the three literals and pass the reaction labels through `t()`; add `pointer-coarse:opacity-100`.
3. `thread.test.tsx`: no key text in the reaction `aria-label`s; the empty description is the catalogue string (acceptance 4).
4. Docs grep: `modules.collab`, `collab.reaction`, `opacity-0`.

### Phase 3 — The composer

1. Tests first: IME (`isComposing`, `keyCode` 229), fine and coarse Enter (stub `matchMedia`), clear-only-if-unchanged,
   double submit, failed send keeps text and shows the alert, Try again re-sends the current text, landed detection,
   the dirty signal (acceptance 5-8).
2. Implement in `Composer`; add the keys with their translator context; update `collab.thread.empty` in all 23 locales.
3. Docs grep: `collab.hint`, `collab.thread.empty`, `Kbd`, `onDirtyChange`.

### Phase 4 — Load older

1. Create `src/lib/collab-thread.ts` (`THREAD_PAGE_SIZE`); `threadPayload` uses it.
2. Tests first: `mergeThread` and the three own-action helpers in `thread-model.test.ts` (acceptance 11, 13); the isolation
   `describe` (acceptance 10); a `thread.test.tsx` case with `loadOlderMessagesFn` mocked: rest, loading, failed, exhausted,
   focus targets, stubbed-layout scroll values (acceptance 12, 14).
3. Implement `loadOlderMessagesFn` and the row mapper in `collab-thread.ts`; `mergeThread`; the control row outside the
   scroller; the bounded scroller; scroll restoration and near-bottom following; the own-action calls; add the keys.
4. Real-browser probe (Verification).
5. Docs grep: `loadTripCollab`, `listMessages`, `nextCursor`, `THREAD_PAGE_SIZE`, `COL-03`, `scrollIntoView`, `bottomRef`.

### Phase 5 — Announce and enter

1. Tests first: the status region cleared before each write, the load and live-message texts and the 1000 ms grouping, no
   entrance on first render or prepend, the `motion-reduce:` classes (acceptance 15).
2. Implement the region, the live-arrival flag and the `starting:` classes; add the keys.
3. Docs grep: `starting:`, `role="status"`.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json` (`pnpm typecheck`, `pnpm lint`, `pnpm test`,
`bash .ai/scripts/check-generated.sh`, `pnpm build`), run on the last commit of every ticket's PR. No screenshot is
compared anywhere (ADR 0016) and no `e2e/` declaration is added: the plan's `e2e/collaboration-and-sharing.visual.spec.ts`
and its baselines no longer exist as a mechanism.

Unit tests: `thread-model.test.ts` (pure) and `thread.test.tsx` (`ui` project, jsdom with `@testing-library/react` and
`user-event`, `loadOlderMessagesFn` and the write functions mocked), plus the appended isolation `describe`. jsdom has no
layout, so the scroll tests stub `scrollHeight` and `scrollTop` and assert the **values written** and the `focus` call's
options; they prove the arithmetic, not the pixels.

**Real browser** (Phase 4, and again for Phase 5 where it applies): the visual judgement is the **blind A/B pair**
(`docs/SPEC.md` §7 item 4, `verifying-changes` skill): `scripts/visual/capture.mjs`, `--auth`, viewports
`360x800,1280x900,2560x1440`, themes `light,dark`, the collaboration tab of a demo trip. No demo trip holds 50 messages,
so the author posts 60 messages through a throwaway local script (no seed change is committed), captures the resting
frame and `--click '[data-part="thread-load-older"]'`, and puts the capture's `console` and `warnings` in the PR body. A
throwaway Playwright probe on the `mobile-safari` profile at 360x800 (WebKit has no scroll anchoring, so Chromium alone
proves nothing here) reads the scroller's `scrollTop`/`scrollHeight` and asserts, with its output in the PR body: the scroller is at its bottom after load and `window.scrollY` is unchanged by it; after "Load earlier messages" the message the reader
was looking at has not moved; a message posted by a second session does not move the reader. The mid-load and failed
states are covered by the jsdom tests (`capture.mjs` cannot hold a response open); keyboard and IME behaviour likewise,
because the script presses no keys. IME, a real screen reader's output and contrast are not verifiable unattended
(Risks).

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                               | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                | Why                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How are older pages held next to a loader window that re-reads on every peer commit?                   | A client snapshot merged under the window by a pure `mergeThread`; own delete/edit/reaction patch it; a non-overlapping window resets; stale-cursor responses discarded; others' changes above the window appear after reload.                                                                                                                                                                                                 | Decided by the software architect sub-agent (confidence high): re-reading the held range needs a repository change this stage may not make and re-bills D1 on every commit; dropping the pages is the jumping transcript the plan forbids; A is the most reversible. |
| 2   | Client-chosen page size (the plan's "literal union of two sizes")?                                     | One constant `THREAD_PAGE_SIZE = 50` in `src/lib/collab-thread.ts`; no size input on the function.                                                                                                                                                                                                                                                                                                                             | Default applied: the UI only ever asks for one size, so a union is a constant; one owner for loader and reader (`docs/SPEC.md` §8).                                                                                                                                  |
| 3   | A grouping window: from the run's start or between neighbours?                                         | Between neighbours (5 minutes); a reply does not break a run.                                                                                                                                                                                                                                                                                                                                                                  | Default applied: an exchange is never cut mid-conversation by an arbitrary clock; same rule as common chat UIs.                                                                                                                                                      |
| 4   | Enter on a touch screen, and during IME composition?                                                   | Enter adds a line on `(pointer: coarse)`; never sends while composing (`isComposing` or `keyCode` 229).                                                                                                                                                                                                                                                                                                                        | Decided by the traveller and accessibility sub-agents (both confidence medium, in agreement): a phone's Enter sends half-written plans, and ja/ko/zh travellers lose text; the send button exists. Departs from the plan's "Enter sends".                            |
| 5   | Failed send: toast, inline alert or both?                                                              | Both: the toast `useAction` always raises, plus an inline `danger` `Alert` with "Try again" that re-sends the field's current text; the alert is not assertive, has a fixed catalogue body and is referenced by the textarea's `aria-describedby`.                                                                                                                                                                             | Decided by the traveller and accessibility sub-agents (agreement), refined by panel round 1: a timed toast alone is missed on poor wifi (WCAG 2.2.1); a server message in the alert could be untranslated or technical; two assertive announcements would repeat.    |
| 6   | The hint: "shown once", empty-only or on focus?                                                        | Visible (and `aria-hidden`) while the field has focus on a fine pointer, with a reserved row; never on a coarse pointer; the same information, plus the Escape sentence while replying or editing, always present as an `aria-describedby` node.                                                                                                                                                                               | Decided by the accessibility sub-agent (confidence medium); the traveller preferred empty-only. The more reversible, accessible form applies: Shift+Enter matters mid-message and "once" would need storage and still leave screen readers without it.               |
| 7   | Autofocus the composer on an empty transcript (the plan)?                                              | No. The empty state points at the composer, which is the next tab stop.                                                                                                                                                                                                                                                                                                                                                        | Decided by the traveller and accessibility sub-agents (agreement): autofocus pops the keyboard over a 360 px screen and skips the page heading (WCAG 2.4.3). Departs from the plan.                                                                                  |
| 8   | The plan's thread skeleton ("three grouped runs")?                                                     | Not built.                                                                                                                                                                                                                                                                                                                                                                                                                     | Default applied: the transcript is server-rendered from the loader; the only pending screen is the route's `CollabPending`, which this stage may not edit (`07-S2`), and Load older's loading state is a button.                                                     |
| 9   | The plan's blockers and baselines (§7.2 abbreviated month, `__screenshots__`, a visual spec)?          | History: ADR 0016 removed baselines. Verification is the gate, jsdom tests, the blind pair and a real-browser `mobile-safari` probe for scroll behaviour; no `e2e/` change.                                                                                                                                                                                                                                                    | One defensible answer in the repository (ADR 0016, `verifying-changes`); the probe was added because jsdom cannot prove scroll behaviour (accessibility and traveller reviewers).                                                                                    |
| 10  | The "N new messages" jump control?                                                                     | Out of scope; the announcement covers the first need.                                                                                                                                                                                                                                                                                                                                                                          | Decided by the traveller sub-agent (confidence medium): a new plural key in 23 locales can be its own slice.                                                                                                                                                         |
| 11  | Should `threadPayload` return `exhausted` instead of inferring "nothing older" from the window length? | No: infer it from `window.length < THREAD_PAGE_SIZE`; the cost is one possibly empty click for a trip with exactly 50 messages.                                                                                                                                                                                                                                                                                                | Default applied (product owner proposed the alternative): carrying it needs edits to `07-S2`'s `CollabPayload` and route files, which this stage does not own; the click is rare and harmless.                                                                       |
| 12  | A cap on held rows (the first draft's `HELD_CAP = 500` and a "reload the page" line)?                  | Dropped: no cap, nothing evicted, DOM weight named in Risks, virtualisation out of scope.                                                                                                                                                                                                                                                                                                                                      | Product owner and traveller reviewers (panel round 1): the cap had no measurement behind it, the number was invented, and "reload" lost the reader's place; the paging is reader-driven.                                                                             |
| 13  | Fix the hardcoded strings, raw reaction keys and hover-only actions in `thread.tsx` here?              | Yes, as Phase 2.                                                                                                                                                                                                                                                                                                                                                                                                               | Raised by the traveller sub-agent: the plan's Definition of done requires actions reachable without a pointer, and the file is rewritten by this stage; leaving a key read aloud to a screen-reader user would ship a known defect.                                  |
| 14  | Is `07-S1` (trip-wide subscription) a blocker?                                                         | No. Only the fact that a peer's chat write re-reads the loader window is relied on, and it holds before and after `07-S1`.                                                                                                                                                                                                                                                                                                     | Product owner reviewer (panel round 1) asked for it to be stated; `07-S2`, whose file split and dirty signal this stage does need, is the blocker.                                                                                                                   |
| 15  | Phase cut: own actions and the scroll rules in the "Load older" slice or separate?                     | One heavier slice (Phase 4); the slicer may cut it into model, control + scroll, and own actions; announcements and the entrance stay in Phase 5.                                                                                                                                                                                                                                                                              | Product owner (completeness: a "Load older" that loses edits and yanks the reader is not shippable) over the architect (Phase 4 is heavy). The follow rule moved to Phase 4 so scroll ownership has one owner.                                                       |
| 16  | Does `loadOlderMessagesFn` honour `07-S2`'s per-trip conversation switch?                              | No: the reader ignores it; the switch hides the section and is not access control.                                                                                                                                                                                                                                                                                                                                             | Security and tenancy reviewer asked for it to be stated; `07-S2`'s own draft calls the switch "a display choice, not access control".                                                                                                                                |
| 17  | Below `xl` the page scrolls, not the thread: what bounds the transcript?                               | The transcript's scroll div gets `max-h-[70svh] xl:max-h-none` inside `thread.tsx`; the route is not edited.                                                                                                                                                                                                                                                                                                                   | Traveller reviewer (panel round 1, verified against `collab.tsx:104-108`, which bounds height only at `xl:`): without it every scroll rule acts on a box that never scrolls; the file is owned by this stage.                                                        |
| 18  | A post that reached the server whose response was lost?                                                | The alert and the field clear when a later window shows the viewer's message with the same body and a greater id than the newest id when the attempt started (no clocks); nothing is re-sent.                                                                                                                                                                                                                                  | Traveller reviewer (panel round 1): otherwise the traveller retries and posts the same plan twice.                                                                                                                                                                   |
| 19  | The inline alert's body: the server's message or catalogue copy?                                       | Catalogue copy only (`collab.toast.notSentBody`, new `collab.toast.editFailedBody`, which is also the edit action's `fallback`).                                                                                                                                                                                                                                                                                               | Traveller and accessibility reviewers (panel round 1): a server string may be English, an internal code or a stack.                                                                                                                                                  |
| 20  | Day dividers: keep the `en-GB` formatter or localise?                                                  | Localise the heading through `formatWeekday`/`formatDayMonth` in Phase 1; the clock time keeps the file's formatter and is follow-up F3.                                                                                                                                                                                                                                                                                       | Traveller reviewer (panel round 1): a Polish traveller reading an English day heading in a rewritten file is the defect this stage's copy work is for; the frozen tables already exist.                                                                              |
| 21  | Is a security and tenancy review needed?                                                               | Yes, as part of the panel: the stage adds one tenant-scoped read taking a user-supplied cursor. Its conditions are applied in acceptance 9-10, the edge cases and F2.                                                                                                                                                                                                                                                          | `afk-plan-to-spec` § 5 names tenant scoping; the verdict is recorded below.                                                                                                                                                                                          |
| 22  | Why does this file's name sort after the `07-S2` spec's?                                               | The date-slug is `the-whole-trip-conversation`, not `read-the-whole-trip-conversation`.                                                                                                                                                                                                                                                                                                                                        | Product owner (panel round 2), verified in `unslicedSpecs` and `buildPlan`: one slice candidate per tick in path order, so a spec that waits on another and sorts first would block the other's slicing forever.                                                     |
| 23  | Verdicts of panel round 2 (final)                                                                      | Security and tenancy: approve. Product owner, software architect, accessibility, traveller: approve with conditions; every condition applied in the commit after this table was written (name sorts after `07-S2`; `collab-payloads.ts` named; fixed cut order for Phase 4; Phase 2 keeps `focus-within`; opening position is the scroller's bottom, composer may be below the fold at 360 px). No specialist answered revise. | The skill allows two rounds; round 2 raised no blocker that the conditions did not settle, and each condition was verified against the code before it was applied.                                                                                                   |
| 24  | Independent specification review of the open PR (`om-auto-review-pr`, row 3 of the autopilot matrix)   | Request changes on head `9171c3c2`, three findings, all applied in the next commit: the read cost is the trip's row scan (the page orders by `id`, which no index covers), not "one indexed read"; F2 is filed only if `07-S2`'s Phase 1 ticket has not already; the IME guard covers the whole `onKeyDown`, Escape included.                                                                                                  | Reviewer verified each against the code and the migrated schema (`EXPLAIN QUERY PLAN`); the fixes are text-only.                                                                                                                                                     |

## Panel verdicts

Two rounds, five independent specialists (`afk-decide`); round 1 was applied in one commit and round 2 asked again.

| Specialist                    | Round 1                 | Round 2 (final)         | What decided it                                                                                                                                                                  |
| ----------------------------- | ----------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product owner                 | approve with conditions | approve with conditions | Round 1: own actions into Phase 4, a carryable `07-S2` blocker, no cap. Round 2: the slicing order deadlock, so the file sorts after `07-S2`'s spec; `collab-payloads.ts` named. |
| Software architect            | approve with conditions | approve with conditions | Round 2: if Phase 4 is cut, the order is fixed and the control never merges before the own-action wiring.                                                                        |
| Security and tenancy reviewer | approve with conditions | approve                 | Isolation test with a foreign and a `'~'` cursor; reactions for the page's ids only; private-trip `NotFoundError`; the switch is not access control; F2 filed as a follow-up.    |
| Accessibility specialist      | approve with conditions | approve with conditions | Round 2: Phase 2 must keep `focus-within` and the named group; everything else met (control outside the scroller, focus targets, silent alert, hint, 1000 ms, 48 px).            |
| Traveller (UX)                | revise                  | approve with conditions | Round 2: the opening position is the scroller's bottom with the composer possibly below the fold at 360 px, not "composer in view".                                              |

After the PR opened, a fresh reviewer ran the specification review on head `9171c3c2` (request changes, three findings: read cost, F2 duplicate, IME guard on Escape; Resolved assumption 24). All three are applied.
