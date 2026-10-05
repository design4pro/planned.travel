# Read the whole trip conversation: older messages, runs, and a composer that keeps what you typed

| Field              | Value                                              |
| ------------------ | -------------------------------------------------- |
| **Status**         | ready                                              |
| **Issue**          | none                                               |
| **Spec PR**        | #<pr, filled in step 6>                            |
| **Implementation** | none                                               |
| **Plan**           | 07-S3 (docs/plans/07-collaboration-and-sharing.md) |

## 📝 TLDR

Plan stage `07-S3` closes reference row `COL-03` (the trip's conversation, paged and grouped) on
`/trips/$tripId/collab`. The thread already posts, replies, edits, deletes and reacts. What it does not
do is let a traveller **read back**: the loader asks for the newest 50 messages, throws away the cursor
the repository returns with them, and the screen shows what came back, so a trip with a long
conversation silently loses its beginning. This stage adds a **"Load older"** control over a new GET
server function; **runs** (a burst of messages from one person shows the avatar and name once, broken by a
different author, a five-minute gap or a day change); **jumbo glyphs** (a message that is only one to three
emoji renders large and bubble-less); and a **composer key contract** that is safe for the languages and
devices the product ships in (Enter never sends mid-IME-composition, Enter adds a line on a touch screen,
a failed send keeps the text and offers a lasting retry).

No SQL is written and no migration is generated: `listMessages` (`src/server/repos/collab.ts:123`) already
pages on a keyset cursor. The stage is cut into six slices a ticket run takes in order (Phasing).

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
- **The transcript follows the newest message unconditionally.** `scrollIntoView` on a bottom sentinel
  (`:159-161`) runs whenever the last id changes. That is harmless while history cannot be read; the moment
  "Load older" exists it yanks a reader out of what they are reading each time anyone posts, and
  `scrollIntoView` also scrolls the page on a phone.

Missing, and what a traveller asks of a trip's conversation: _what did we decide three weeks ago, and can
I answer without losing what I was typing?_

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                        | Not owned (read only, or left alone)                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/modules/collab/thread-model.ts` — new, pure                                                                         | `src/routes/_app/trips/$tripId/collab.tsx` and `-server/collab.ts` (`07-S2`: the screen, `loadTripCollab`, the header count)        |
| `src/components/modules/collab/__tests__/thread-model.test.ts`, `thread.test.tsx` — new                                             | `src/server/repos/collab.ts` — no repository change; `listMessages` and `listReactions` are used as they are (`07-S7` changes them) |
| `src/components/modules/collab/thread.tsx` — edit                                                                                   | `src/server/do/**`, `src/components/modules/collab/use-trip-room.ts`, `presence-bar.tsx` (`07-S1`)                                  |
| `src/server/fns/collab-thread.ts` — edit (created by `07-S2`): `loadOlderMessagesFn`, the shared row mapper, the page-size constant | `src/components/modules/collab/types.ts` (`MessageData` is used as it is)                                                           |
| `src/lib/collab-thread.ts` — new, isomorphic: `THREAD_PAGE_SIZE`                                                                    | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3), `src/styles/**`                                                       |
| `src/server/repos/__tests__/tenant-isolation.test.ts` — append one `describe`                                                       | `src/server/db/**`, `drizzle/**` — no migration                                                                                     |
| `src/lib/i18n/messages/<locale>/modules.ts` — edit, **all 23 locales** (the `collab.*` keys)                                        | `e2e/` — no declaration is added (Verification)                                                                                     |
| This spec's `Status` / `Implementation` rows, the regenerated `.ai/specs/README.md`, any document the Phase 1 grep names            |                                                                                                                                     |

No route file changes, so `pnpm generate-routes` is not run. `src/lib/collab-thread.ts` is new and is the
one place the page size lives, so the loader (`threadPayload`) and `loadOlderMessagesFn` cannot disagree
and the client can tell "a full window, there may be more" from "fewer than a page, nothing older".

### Dependency on plan stage `07-S2`

`07-S2` ("Switch a trip's collaboration sections on and off", its spec is being written in the same wave
and is not merged when this one is written) is the stage that splits `src/server/fns/collab.ts` into
`collab-thread.ts`, `collab-notes.ts` and `collab-polls.ts`, moves `loadTripCollab` into
`src/routes/_app/trips/$tripId/-server/collab.ts`, and repoints `thread.tsx`'s import paths. This spec is
written against that layout, which is also the plan's own (the plan's **Owned paths** edit
`src/server/fns/collab-thread.ts`).

- **Every phase is `Blocked by` the `07-S2` ticket that creates `collab-thread.ts`** (its file-split phase).
  Phases 1-3 would edit only `thread.tsx` and new files, but `07-S2` edits `thread.tsx` too, and two PRs on
  one file is a merge hazard that costs more than the wait. The ticket's `### Blocked by` names that phase by
  spec path and phase number, and by issue number once `07-S2`'s tickets exist.
- If the merged `07-S2` names a thing differently from the draft (`threadPayload`, `message-composer.tsx`),
  the ticket run reads the merged code and follows it; the contract here is the behaviour, not the spelling.
- `07-S1` (the trip-wide subscription) is **not** a blocker. The thread's liveness today is `PresenceBar`'s
  `router.invalidate()` on a room commit; `07-S1` moves that subscription up. Either way the loader window is
  re-read on a peer's chat write, which is the only fact this stage relies on.

### Departures from the plan's stage block

The panel and the specialists changed five things, each recorded in Resolved assumptions: the page size is
one constant rather than a client-chosen union (row 2); the hint shows while the field has focus on a fine
pointer rather than "once" (row 6); the composer is not auto-focused (row 7); there is no thread skeleton
(row 8); the visual verification is the blind pair, not baselines (row 9).

### Phase 1 — Runs and jumbo glyphs: `thread-model.ts`, wired into `thread.tsx`

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
unchanged). The day divider keeps today's look (rule, label, rule); only its source moves into the model.
`startsRun === false` rows carry the body alone, indented to the same measure, so the column edge stays
straight, exactly as the run rows do today.

### Phase 2 — Copy debt and touch reach in the file this stage rewrites

No behaviour of the thread changes for a sighted desktop traveller; it stops being wrong for everyone else.

- The empty-state description (`:202`), the `Reply` menu label (`:435`) and the composer placeholder (`:704`)
  go through `t()`; the key for `Reply` already exists (`modules.collab.message.reply`).
- The six reaction labels (`REACTIONS[].label` is a key) are passed through `t()` before they reach the
  `Tooltip` and the `aria-label`.
- The row's action group becomes visible on a coarse pointer: `opacity-0` stays for a fine pointer with
  hover, and `[@media(pointer:coarse)]:opacity-100` (or the equivalent in this repo's Tailwind) shows it
  where hover does not exist. It stays in the tab order in both cases, as today.

### Phase 3 — The composer's key contract and a failed send that keeps the text

All inside `Composer` in `thread.tsx`.

- **Enter.** On a **fine pointer** `Enter` sends and `Shift+Enter` adds a line, as today. On a **coarse
  pointer** (`matchMedia('(pointer: coarse)')`, read after hydration, defaulting to fine on the server)
  `Enter` adds a line and the send button is the only way to send. On every device a keydown whose
  `event.nativeEvent.isComposing` is true or whose `keyCode` is `229` is ignored by the Enter handling before
  anything else (the `229` check is Safari's, which reports `isComposing: false` for the confirming Enter).
  `Escape` still cancels a reply or an edit.
- **The hint.** The visible `Kbd` row (`Enter sends · Shift+Enter adds a line`, plus `Esc cancels` while
  replying or editing) is shown **while the field has focus, on a fine pointer only**. Its row keeps its
  height whether shown or not, so focusing the field does not move the layout. It is not the only carrier of
  the information: an always-mounted visually hidden node holds the same sentence for the device ("Press
  Enter to send, Shift and Enter for a new line" on a fine pointer; "Use the send button to send" on a coarse
  one), and the textarea's `aria-describedby` points at it. Nothing is stored in `localStorage`.
- **A send that cannot lose what was typed.** A ref guards the send in addition to `action.pending`, so two
  quick Enters or a double tap cannot post twice. On success the field is cleared **only if it still equals
  the text that was sent**; text typed during the request survives.
- **A failed send.** The toast `useAction` raises stays (it cannot be suppressed and need not be). Above the
  composer a compact inline `Alert` (tone `danger`, size `sm`) shows the title (`modules.collab.toast.notSent`,
  or `editFailed` for an edit) and the server's message (`post.error` / `edit.error`), with a **Try again**
  `Button` that re-sends what is **currently in the field**. Focus stays in the textarea. The alert clears on
  the next successful send or when the field is emptied; if it unmounts after a successful retry, focus
  returns to the textarea. The `Alert` is told a non-assertive role so a screen reader hears "Not sent" once
  (the toast already announces it).
- **The empty state.** Title "Say the first thing" (the existing `modules.collab.thread.empty` key, new
  English text), the existing description, and **no autofocus** (Resolved assumption 7): the composer is the
  next tab stop and sits directly under the empty state.

### Phase 4 — "Load older"

The slice that fixes the reported defect.

**Server.** `loadOlderMessagesFn` in `src/server/fns/collab-thread.ts`:

- `createServerFn({ method: 'GET' })`; validator `z.strictObject({ tripId, cursor })` with `tripId` and `cursor` both
  `z.string().trim().min(1).max(64)` and an `error` message on each, as the repository's strict inputs do.
  There is **no page-size input**: the page is `THREAD_PAGE_SIZE` (50), because a client-chosen size is a
  client-chosen row scan and D1 bills rows read.
- Handler: `const scope = await appScope()`, `const trip = await requireTrip(scope, data.tripId)` (a trip
  of another workspace is a `NotFoundError` before the cursor is looked at), then
  `listMessages(scope, trip.id, { limit: THREAD_PAGE_SIZE, cursor: data.cursor })` and `listReactions(scope,
ids)` for exactly that page's ids. Returns `{ messages: MessageData[] /* oldest first */, exhausted:
page.nextCursor === null }`, mapped by **the same row mapper** `threadPayload` uses (one owner, in
  `collab-thread.ts`).
- The cursor is not an authorisation input. It only narrows a query that is already tenant- and
  trip-scoped, so a cursor lifted from another workspace's page selects nothing of that workspace's.
- `threadPayload` replaces its literal `50` with `THREAD_PAGE_SIZE`. Nothing is enqueued, nothing mirrored.

**Client model.** `thread-model.ts` gains the pure functions the architect's verdict fixes (Resolved
assumption 1), and `thread.tsx` holds `held` (older rows, a client **snapshot**) in state:

- `mergeThread(held, window)` returns the displayed list. The loader `window` is authoritative for every id
  `>= min(window)`, so a peer's delete inside that range disappears; held rows with `id < min(window)` are
  kept, and rows that **slide out** of the window as new messages arrive join `held` (so a message is never
  skipped between the window and the held rows). Deduplicated by id, oldest first.
- **Non-overlapping window.** Contiguity is proven only when `min(window) <= max(previous displayed)`. When
  more than a page arrived while the viewer was disconnected, nothing links the two sets: `held` is dropped,
  the window stands alone, and the control is shown again. No scroll jump; one extra click, never a hole.
- **Cursor and exhaustion.** The cursor is the **oldest id displayed**. The control is shown when
  `window.length >= THREAD_PAGE_SIZE` (a shorter window means there is nothing older) and until a response
  says `exhausted`. A trip with exactly 50 messages yields an empty first page, which flips the control to the
  exhausted line; that is accepted.
- **One request at a time.** A response whose requested cursor no longer equals the oldest displayed id (a
  reset happened meanwhile) is discarded.
- **Cap.** `HELD_CAP = 500` older rows (ten pages). At the cap the control is replaced by a quiet line saying
  earlier messages are not shown here and that reloading the page starts again from the latest. Rows the
  reader is looking at are never evicted.
- **Staleness, stated.** Other members' edits, deletes and reactions on messages **above** the loaded window
  appear after a reload or a reset; this is the price of reading history without re-billing rows read on every
  peer commit, and it is recorded where a reader of the spec will look for it (Risks).

**The control.** `Button` with `data-part="thread-load-older"` at the top of the transcript, three states plus a
failure: rest ("Load earlier messages"); loading (a `Spinner` inside the button, the label unchanged so the
row does not reflow; the button is `loading`, which is natively disabled, so on settle focus is put back on
the control or, when the page was the last, on the exhausted line with `tabIndex={-1}`); **failed** (a
`role="alert"` line "Earlier messages did not load" and the same button reading "Try again"); **exhausted**
(the control is replaced by a quiet line "This is where the conversation starts"). The prepend does not animate.

**Scroll.** The transcript container (the `overflow-y-auto` div, now with a ref) is the scroller. Before the
older page is applied the handler records `scrollHeight` and `scrollTop`; a `useLayoutEffect` after the
commit sets `scrollTop` to the old `scrollTop` plus the height the prepend added, in every browser (WebKit has
no scroll anchoring). `scrollIntoView` is replaced everywhere by writes to this container's own `scrollTop`,
so the page itself never scrolls.

**Announcements.** One visually hidden `role="status"` region, always mounted and empty on the server, owned by
`Thread`. After a page loads it says "Loaded {count} earlier messages" (ICU plural); when nothing is left,
"This is where the conversation starts". `role="log"` and `aria-live` are never put on the `<ol>`: a prepend
would be read row by row.

### Phase 5 — The viewer's own actions on rows above the window

The loader does not re-read held rows, so the viewer's own delete, edit or reaction on one would be overwritten
by the stale snapshot (or, for a reaction, would flash back when the optimistic claim settles). Pure helpers
in `thread-model.ts` and a call from each `useAction` success in `thread.tsx`:

- **Delete:** `removeMessage(held, id)` on success.
- **Edit:** `editMessage(held, id, body, editedAt)` with the text just sent and the client's `now` as an ISO
  string (only "edited" is displayed).
- **Reaction:** the claimed `run` closure calls `toggle.run`, then applies `setViewerReaction(held, id,
viewerUserId, emoji, added)` from the returned `{ added }`, **inside** the closure and therefore before the
  claim settles, so a held row never shows its old count between the settle and the patch. Rows still inside
  the window are patched by the loader as today.

### Phase 6 — Follow the conversation only when the reader is at the bottom

- A message that arrives live (after the first render, not a prepend) scrolls the transcript container to
  the bottom **only** when the viewer was within about one row (48 px) of the bottom before it landed, or when
  the new message is the viewer's own. Otherwise nothing scrolls.
- When it does not scroll, the status region politely announces **"New message from {name}"** (one) or **"{count}
  new messages"** (several, grouped over about a second), never the message text and never the viewer's own,
  the first render or a prepend. No "N new messages" jump control in this stage (Out of scope).
- A row that arrived live enters over the 220 ms `--duration` token on `--ease-out-quint` with a 6 px rise and
  an opacity fade, written with the `starting:` utilities `menu.tsx` already uses and applied **only** to
  rows flagged as live arrivals (otherwise server-rendered rows would animate on load). Under
  `prefers-reduced-motion: reduce` it is opacity only.

### Alternatives considered, and why they lost

| Alternative                                      | Why not                                                                                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drop the held pages on every loader revalidation | Every peer's chat write collapses the reader's view to the newest 50 (a jumping transcript); the plan's own "no animation on a prepend" argument rules it out. |
| Re-read the held range on every revalidation     | Needs a range reader in `repos/collab.ts` (not this stage's) and re-bills D1 rows read, growing with scroll depth, on every peer commit.                       |
| A client-chosen page size (25 or 50)             | The UI only ever asks for one size; a union of one literal is a constant, and a client-chosen size is a client-chosen scan.                                    |
| Offset paging                                    | The repository's keyset cursor is stable under inserts; an offset slides when anyone posts.                                                                    |
| Enter sends everywhere (the plan)                | Sends half-written plans from a phone and half-typed text from an IME; the send button exists for exactly the touch case.                                      |

## 📝 Architecture

| Concept                                  | Owner module                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Run grouping, day boundaries, jumbo test | `src/components/modules/collab/thread-model.ts` (pure)                    |
| Merging held rows with the loader window | `thread-model.ts` (`mergeThread`, `removeMessage`, `editMessage`, ...)    |
| The page size                            | `src/lib/collab-thread.ts` (`THREAD_PAGE_SIZE`), read by both ends        |
| Reading an older page, the row mapper    | `src/server/fns/collab-thread.ts` — one mapper, used by loader and reader |
| Paging SQL                               | `src/server/repos/collab.ts` `listMessages` — **unchanged**               |
| Rendering, scroll, live regions          | `src/components/modules/collab/thread.tsx`                                |

Seams: `components/modules/collab` imports server functions (as it does today) and never `server/repos`; the
repository is reached only through the server function, which resolves the tenant scope and re-resolves the
trip inside it. `docs/SPEC.md` §6 holds (all SQL in `server/repos` through `tenantFilter()`); §8 ("one concept,
one owner") holds because the constant and the mapper each have one home.

## 📝 Data Model

None. Every column read exists: `collab_messages` carries `reply_to_id`, `edited_at` and `deleted_at`, and the read
rides `collab_messages_trip_created_at_idx` plus the primary-key cursor. No migration, no backfill.

## 📝 API Contracts

| Function              | Method | Input (Zod `strictObject`) | Output                                                          | Authorisation                                           |
| --------------------- | ------ | -------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| `loadOlderMessagesFn` | GET    | `{ tripId, cursor }`       | `{ messages: MessageData[]` (oldest first)`, exhausted: bool }` | `appScope()` then `requireTrip`: any reader of the trip |

No other server function changes. `postMessageFn`, `editMessageFn`, `deleteMessageFn` and `toggleReactionFn` keep
their inputs, outputs, notification and room mirror.

## 📝 UI/UX

- **Route.** Unchanged. The thread stays the 24rem rail beside notes and polls at `xl`, and the whole screen below.
- **Primitives reused.** `Avatar`, `Button`, `IconButton`, `Kbd`, `Textarea`, `Alert`, `Spinner`, `EmptyState`,
  `Tooltip`, `Popover`. None is added. `Alert` carries the failed send; `Skeleton` is not used (assumption 8).
- **Tokens.** `text-title` (jumbo), `text-caption` (times, hint), `text-micro` (day label), `bg-surface-2`,
  `border-edge-faint`, `--duration` and `--ease-out-quint`. `tabular-nums` on times and counts. None missing.
- **States.** Transcript: empty ("Say the first thing", no illustration), resting, live arrival. Load older: rest,
  loading, failed, exhausted, capped. Composer: idle, sending, failed (inline alert), editing, replying.
- **Touch (360 px).** The transcript is the whole screen, the composer sits above the safe-area inset, the row
  actions are visible, the hint is absent, Enter adds a line.
- **RTL (`ar`).** Logical properties only; the avatar column and the run indent mirror.

## 📝 Visual change expected

Route `/trips/$tripId/collab`, thread panel, light and dark, 360 / 1280 / 2560 px:

- consecutive messages by one person inside five minutes lose their repeated avatar and name (they already do
  within a day; the visible change is that a long gap now starts a new run);
- a message that is only emoji renders large with no bubble;
- a "Load earlier messages" button above the oldest message when 50 or more exist;
- the hint under the composer appears on focus (fine pointer) instead of always;
- an inline red alert above the composer after a failed send;
- row actions visible on a touch screen.

Nothing changes for a short conversation at rest except the hint and the empty-state title.

## 📝 Copy

New or changed `en` keys (the implementation lands each in all 23 locales per the `i18n-messages` skill;
`modules.ts`, prefix `collab.`):

| Key                              | `en`                                                                                                                       | Phase |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----- |
| `collab.thread.empty` (changed)  | Say the first thing                                                                                                        | 3     |
| `collab.thread.emptyBody`        | Everyone on this trip shares one thread. Decisions made here stay with the trip rather than scattering across group chats. | 2     |
| `collab.compose.placeholderText` | Say something to the group…                                                                                                | 2     |
| `collab.compose.keysHint`        | Press Enter to send, Shift and Enter for a new line.                                                                       | 3     |
| `collab.compose.keysHintTouch`   | Use the send button to send.                                                                                               | 3     |
| `collab.compose.retry`           | Try again                                                                                                                  | 3     |
| `collab.thread.loadOlder`        | Load earlier messages                                                                                                      | 4     |
| `collab.thread.loadOlderFailed`  | Earlier messages did not load                                                                                              | 4     |
| `collab.thread.retry`            | Try again                                                                                                                  | 4     |
| `collab.thread.start`            | This is where the conversation starts                                                                                      | 4     |
| `collab.thread.capped`           | Earlier messages are not shown here. Reload the page to start again from the latest.                                       | 4     |
| `collab.thread.loadedEarlier`    | `one`: Loaded {count} earlier message · `other`: Loaded {count} earlier messages                                           | 4     |
| `collab.thread.newFrom`          | New message from {name}                                                                                                    | 6     |
| `collab.thread.newMany`          | `one`: {count} new message · `other`: {count} new messages                                                                 | 6     |

`pl`, `ru`, `uk`, `ar` and `cs` need the plural branches `en` lacks; the parity test names the locale and key.
The existing keys `collab.reaction.*`, `collab.message.reply`, `collab.toast.notSent`, `collab.toast.editFailed` and
`collab.hint.*` are reused as they are. A key whose English changes (`collab.thread.empty`) is updated in every
locale, not only `en`.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                 | Behaviour                                                                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Trip with 0, 1, 49, 50, 51 messages                                  | 0: empty state. 1-49: no control. 50: control shown, first click may return an empty page and show "starts here". 51: control, one page. |
| Two clicks on "Load older"                                           | The control is disabled while loading and a ref allows one request; the second never fires.                                              |
| The reader loads older pages and a peer posts                        | The window re-reads; `mergeThread` keeps held rows below `min(window)`; the new row is appended; no scroll unless at the bottom.         |
| More than a page arrives while disconnected                          | No overlap: held rows dropped, window stands alone, control shown again, no scroll jump.                                                 |
| A response arrives after a reset                                     | Discarded (its cursor is no longer the oldest displayed id).                                                                             |
| `loadOlderMessagesFn` fails (offline, 500)                           | Failed state with "Try again"; held rows and scroll position untouched.                                                                  |
| A cursor of another workspace or trip                                | `requireTrip` refuses a foreign trip; a foreign cursor on one's own trip narrows to one's own rows. Never another's rows.                |
| 500 held rows                                                        | The control is replaced by the capped line; nothing is evicted.                                                                          |
| A held message is deleted by someone else                            | Stays visible until reload or reset (stated staleness).                                                                                  |
| The viewer deletes / edits / reacts on a held row                    | Patched locally from the success result (Phase 5); a failed call leaves the row as it was.                                               |
| IME composition: Enter confirms a candidate                          | Nothing is sent, on every browser including Safari (`keyCode` 229).                                                                      |
| Touch device                                                         | Enter adds a line; the send button sends; no hint.                                                                                       |
| Send fails, then the traveller edits the field and presses Try again | The current field text is sent; the alert clears on success.                                                                             |
| Text typed while a send is in flight                                 | Survives the success; the field is cleared only if it still equals what was sent.                                                        |
| Body is `👍`, `👍👍👍`, `👍 🎉`, `👍🏽`, `👨‍👩‍👧`, `🇵🇱`                    | Jumbo. `👍👍👍👍`, `👍 ok`, `1`, `©`, an empty body: not jumbo.                                                                          |
| `Intl.Segmenter` missing                                             | Nothing is jumbo; every message renders normally.                                                                                        |
| Clock skew gives a negative gap between neighbours                   | Does not break the run. A non-finite gap does.                                                                                           |
| Author has left the trip                                             | The existing removed-person fallback name renders; unchanged.                                                                            |
| Viewer reads history and a message arrives                           | No scroll; a polite announcement; the viewer's own message always scrolls.                                                               |
| `prefers-reduced-motion: reduce`                                     | The live-arrival entrance is opacity only; a prepend never animates.                                                                     |

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
   and share the run's left edge.
4. [2] No English literal remains in `thread.tsx` for the empty description, `Reply` or the placeholder; the six
   reaction tooltips and accessible names are translated text, never a key; the row actions are visible under a
   coarse pointer and still in the tab order.
5. [3] Enter with `isComposing: true`, and with `keyCode` 229, sends nothing; Enter on a fine pointer sends,
   Shift+Enter adds a line; Enter on a coarse pointer adds a line and only the button sends.
6. [3] The hint is visible while the field has focus on a fine pointer, absent on a coarse one, reserves its height,
   and the textarea's `aria-describedby` resolves to an always-mounted node whose text matches the device.
7. [3] A failed send keeps the text, shows the toast and an inline alert with "Try again" that re-sends the field's
   current text; focus stays in the field; a second Enter or a double tap while a send is in flight posts once;
   text typed during a send survives its success; a failed edit behaves the same way.
8. [3] The empty state reads "Say the first thing" and focus is **not** moved on mount.
9. [4] `loadOlderMessagesFn` returns the page older than the cursor, oldest first, with reactions for exactly those
   ids, and `exhausted` true on the last page; a foreign trip id is a `NotFoundError`; it has no page-size input.
10. [4] Tenant isolation (below): in A's scope `listMessages` for B's trip id returns an empty page, `requireById` of
    B's message raises `NotFoundError`, and a cursor taken from B's page used from A's scope yields A's own page;
    B's rows are unchanged afterwards.
11. [4] `mergeThread` retains slid-out rows, drops a peer-deleted row inside the window range, deduplicates, resets
    on a non-overlapping window, and honours the 500-row cap; a response for a stale cursor is discarded.
12. [4] The control shows rest, loading (label unchanged, no reflow), failed (alert plus "Try again") and exhausted
    states; a prepend keeps the reader's position (scroll delta restored) and does not animate; the status region
    says how many earlier messages loaded; no `aria-live` is on the list.
13. [5] After loading older pages, the viewer's own delete removes the row, an edit shows the new text and "edited",
    and a reaction shows the new count with no flash of the old one.
14. [6] A live message scrolls the transcript only when the viewer was within about 48 px of the bottom or sent it;
    otherwise a polite announcement names the author or the count; the page itself never scrolls; only live rows
    enter animated.
15. [all] Zero console errors or warnings; light and dark; 360 / 1280 / 2560; WCAG 2.2 AA; every new key in all 23 locales.

## 📝 Risks & Impact Review

| Risk                                                                                  | Mitigation                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Older rows are a snapshot: others' edits/deletes/reactions above the window are stale | Stated in the UI-adjacent docs and acceptance 11; the alternative re-bills D1 rows on every peer commit. Swapping it later touches `mergeThread` and one function. |
| A cursor is a user-supplied string                                                    | It only narrows an already tenant- and trip-scoped query; tested with a cross-tenant cursor (acceptance 10).                                                       |
| Rows read grow with scroll depth                                                      | One constant page size, a 500-row cap, one indexed read and a reaction read keyed to the page's ids.                                                               |
| `07-S2` lands differently from its draft                                              | The ticket run follows the merged code; the contract is the behaviour. Every phase is `Blocked by` `07-S2`'s file split.                                           |
| `@starting-style` support                                                             | Already used by `menu.tsx`; where unsupported the row simply appears.                                                                                              |
| Changing `collab.thread.empty`'s English                                              | Updated in all 23 locales in the same change; the parity test checks keys, so a reviewer checks the text.                                                          |

Backward compatibility (`BACKWARD_COMPATIBILITY.md`): additive. One new GET server function, no changed signature, no
migration, no event or route renamed.

### Out of scope

- **The header count and the panel count read the loaded window** (`collab.tsx`), so a long thread says "50 messages".
  The route file is `07-S2`'s; the slicing run files this as follow-up F1 once `07-S2` has merged.
- **Tombstones for deleted messages, who deleted, quote replies.** `07-S7` owns them; `startsRun` is built so the
  tombstone is one more clause.
- **A "N new messages" jump control** while reading history; a separate slice if the announcement proves too quiet.
- **The thread's `LOCALE = 'en-GB'` date and clock formatting** (`thread.tsx:48`) and its own `Intl` use for the
  day heading: existing debt shared with the other trip-tab call sites of `12-verification-protocol.md` §7.2, whose
  pixel-baseline reason ADR 0016 removed. Not changed here.
- **An unread badge**, a draft saved across navigation, mentions, attachments (`07-S8`).

## 📋 Phasing

| Phase | Slice                                                 | Blocked by                        | Usable when it merges                                                                 |
| ----- | ----------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| 1     | Runs and jumbo glyphs (`thread-model.ts`)             | `07-S2` file-split phase          | A long gap starts a new run; an emoji-only message reads large                        |
| 2     | Copy debt and touch reach                             | `07-S2` file-split phase          | The thread speaks the traveller's language; touch users can reach Reply, Edit, Delete |
| 3     | The composer's key contract; a failed send keeps text | `07-S2` file-split phase          | Safe for IME and touch; a failed send is not lost                                     |
| 4     | "Load older": the function, the merge, the control    | `07-S2` file-split phase; Phase 1 | A traveller reads the whole conversation                                              |
| 5     | The viewer's own actions on older rows                | Phase 4                           | Delete, edit and react work on loaded history                                         |
| 6     | Follow only at the bottom; announcements; entrance    | Phase 4                           | Reading history is not interrupted by new messages                                    |

Six tickets for `afk-to-tickets`; Phases 1-3 are independent of each other once `07-S2`'s split has merged, so they may
be taken in any order; Phase 4 builds on Phase 1's module (it adds to `thread-model.ts`).

## 📋 Implementation Plan

### Phase 1 — Runs and jumbo glyphs

1. Write `__tests__/thread-model.test.ts` first (acceptance 1-2); watch it fail.
2. Create `thread-model.ts` (`RUN_WINDOW_MS`, `startsRun`, `groupThread`, `isJumboGlyphs`); pass the tests.
3. Wire `thread.tsx` to `groupThread`; render a jumbo message; extend a `thread.test.tsx` render test (acceptance 3).
4. Docs grep (the rule in `AGENTS.md`, recorded in the PR template): `thread.tsx`, `COL-03`, `Intl.Segmenter`,
   `collab-thread`, `07-S3` across `docs/`, `.ai/`, `src/`, `CONTEXT.md`; update what states what this phase changes.

### Phase 2 — Copy debt and touch reach

1. Add the keys (Copy table, phase 2) to all 23 locales; run the parity test.
2. Replace the three literals and pass the reaction labels through `t()`; add the coarse-pointer visibility.
3. `thread.test.tsx`: no key text in the reaction `aria-label`s; the empty description is the catalogue string (acceptance 4).
4. Docs grep: `modules.collab`, `collab.reaction`, `opacity-0`.

### Phase 3 — The composer

1. Tests first: IME (`isComposing`, `keyCode` 229), fine and coarse Enter (stub `matchMedia`), clear-only-if-unchanged,
   double submit, failed send keeps text and shows the alert, Try again re-sends the current text (acceptance 5-8).
2. Implement in `Composer`; add the keys; update `collab.thread.empty` in all 23 locales.
3. Docs grep: `collab.hint`, `collab.thread.empty`, `Kbd`.

### Phase 4 — Load older

1. Create `src/lib/collab-thread.ts` (`THREAD_PAGE_SIZE`); `threadPayload` uses it.
2. Tests first: `mergeThread` cases (acceptance 11) in `thread-model.test.ts`; the isolation `describe` (acceptance 10); a
   `thread.test.tsx` case with `loadOlderMessagesFn` mocked: rest, loading, failed, exhausted, capped (acceptance 12).
3. Implement `loadOlderMessagesFn` and the row mapper in `collab-thread.ts`; `mergeThread`; the control; scroll restoration;
   the status region; add the keys.
4. Docs grep: `loadTripCollab`, `listMessages`, `nextCursor`, `THREAD_PAGE_SIZE`, `COL-03`.

### Phase 5 — Own actions on older rows

1. Tests first: `removeMessage`, `editMessage`, `setViewerReaction`; a render test that a reaction on a held row never shows
   the old count (acceptance 13).
2. Implement the helpers and the three call sites.

### Phase 6 — Follow and announce

1. Tests first: near-bottom and own-message scroll, the announcement text and grouping, no animation on first render or
   prepend (acceptance 14).
2. Implement the container scroll, the near-bottom ref, the live-arrival flag and the `starting:` classes; add the keys.
3. Docs grep: `scrollIntoView`, `bottomRef`, `starting:`.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json` (`pnpm typecheck`, `pnpm lint`, `pnpm test`,
`bash .ai/scripts/check-generated.sh`, `pnpm build`), run on the last commit of every ticket's PR. No screenshot is
compared anywhere (ADR 0016) and no `e2e/` declaration is added: the plan's `e2e/collaboration-and-sharing.visual.spec.ts`
and its baselines no longer exist as a mechanism, and nothing here fails in a browser that a jsdom test cannot reproduce.

Unit tests: `thread-model.test.ts` (`ui` or `server` project, pure) and `thread.test.tsx` (`ui` project, jsdom with
`@testing-library/react` and `user-event`, `loadOlderMessagesFn` and the write functions mocked), plus the appended
isolation `describe`. The visual judgement is the **blind A/B pair** (`docs/SPEC.md` §7 item 4, `verifying-changes`
skill): `scripts/visual/capture.mjs`, `--auth`, viewports `360x800,1280x900,2560x1440`, themes `light,dark`, the
collaboration tab of a demo trip. No demo trip holds 50 messages, so for Phases 4-6 the author posts 60 messages through
a throwaway local script (no seed change is committed), captures the resting frame and `--click
'[data-part="thread-load-older"]'`, and puts the capture's `console` and `warnings` in the PR body. The mid-load and failed
states are covered by the jsdom tests (`capture.mjs` cannot hold a response open); keyboard and IME behaviour likewise,
because the script presses no keys. The plan's §7.2 abbreviated-month precondition belonged to the baselines and is not
a blocker (assumption 9).

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                      | Applied default                                                                                                                                                                                                                             | Why                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How are older pages held next to a loader window that re-reads on every peer commit?          | A client snapshot merged under the window by a pure `mergeThread`; own delete/edit/reaction patch it; 500-row cap; a non-overlapping window resets; stale-cursor responses discarded; others' changes above the window appear after reload. | Decided by the software architect sub-agent (confidence high): re-reading the held range needs a repository change this stage may not make and re-bills D1 on every commit; dropping the pages is the jumping transcript the plan forbids; A is the most reversible.  |
| 2   | Client-chosen page size (the plan's "literal union of two sizes")?                            | One constant `THREAD_PAGE_SIZE = 50` in `src/lib/collab-thread.ts`; no size input on the function.                                                                                                                                          | Default applied: the UI only ever asks for one size, so a union is a constant; one owner for loader and reader (`docs/SPEC.md` §8) and the client infers "nothing older" from a short window.                                                                         |
| 3   | A grouping window: from the run's start or between neighbours?                                | Between neighbours (5 minutes); a reply does not break a run.                                                                                                                                                                               | Default applied: an exchange is never cut mid-conversation by an arbitrary clock; same rule as common chat UIs.                                                                                                                                                       |
| 4   | Enter on a touch screen, and during IME composition?                                          | Enter adds a line on `(pointer: coarse)`; never sends while composing (`isComposing` or `keyCode` 229).                                                                                                                                     | Decided by the traveller and accessibility sub-agents (both confidence medium, in agreement): a phone's Enter sends half-written plans, and ja/ko/zh travellers lose text; the send button exists. Departs from the plan's "Enter sends".                             |
| 5   | Failed send: toast, inline alert or both?                                                     | Both: the toast `useAction` always raises, plus an inline `danger` `Alert` with "Try again" that re-sends the field's current text, announced once.                                                                                         | Decided by the traveller and accessibility sub-agents (agreement): a timed toast alone is missed on poor wifi and is a timed control for keyboard users (WCAG 2.2.1). The plan's "Alert" line is the load-error state; the composer's own line asks for a retry.      |
| 6   | The hint: "shown once", empty-only or on focus?                                               | Visible while the field has focus on a fine pointer, with a reserved row; never on a coarse pointer; the same information always present as an `aria-describedby` node; nothing in `localStorage`.                                          | Decided by the accessibility sub-agent (confidence medium); the traveller preferred empty-only. The more reversible, accessible form applies: Shift+Enter matters mid-message and "once" would need storage and still leave screen readers without it.                |
| 7   | Autofocus the composer on an empty transcript (the plan)?                                     | No. The empty state points at the composer, which is the next tab stop.                                                                                                                                                                     | Decided by the traveller and accessibility sub-agents (agreement): autofocus pops the keyboard over a 360 px screen and skips the page heading (WCAG 2.4.3). Departs from the plan.                                                                                   |
| 8   | The plan's thread skeleton ("three grouped runs")?                                            | Not built.                                                                                                                                                                                                                                  | Default applied: the transcript is server-rendered from the loader; the only pending screen is the route's `CollabPending`, which this stage may not edit (`07-S2`), and Load older's loading state is a button. A skeleton would be a rule with nothing to match it. |
| 9   | The plan's blockers and baselines (§7.2 abbreviated month, `__screenshots__`, a visual spec)? | History: ADR 0016 removed baselines. Verification is the gate, jsdom tests and the blind pair; no `e2e/` change.                                                                                                                            | One defensible answer in the repository (ADR 0016, `verifying-changes`), so no specialist was needed.                                                                                                                                                                 |
| 10  | The "N new messages" jump control and the header count?                                       | Both out of scope; the announcement covers the first, the second is follow-up F1 on `07-S2`'s file.                                                                                                                                         | Decided by the traveller sub-agent (confidence medium) for the control (a new plural key in 23 locales can be its own slice); the route file is not this stage's to edit.                                                                                             |
| 11  | Fix the hardcoded strings, raw reaction keys and hover-only actions in `thread.tsx` here?     | Yes, as Phase 2.                                                                                                                                                                                                                            | Raised by the traveller sub-agent: the plan's Definition of done requires actions reachable without a pointer, and the file is rewritten by this stage; leaving a key read aloud to a screen-reader user would ship a known defect.                                   |
| 12  | The day divider's look and the new-row entrance?                                              | The divider keeps today's rule-label-rule; the entrance uses `starting:` utilities on live arrivals only, 220 ms.                                                                                                                           | Default applied: the plan's "centred on `--color-surface-2`" would be a redesign with no problem behind it; `styles.css` is not owned, so no keyframes; `menu.tsx` is the precedent for `starting:`.                                                                  |
| 13  | Is a security and tenancy review needed?                                                      | Yes, as part of the panel: the stage adds one tenant-scoped read taking a user-supplied cursor.                                                                                                                                             | `afk-plan-to-spec` § 5 names tenant scoping; the verdict is recorded below.                                                                                                                                                                                           |

## Panel verdicts

_Recorded in step 5._
