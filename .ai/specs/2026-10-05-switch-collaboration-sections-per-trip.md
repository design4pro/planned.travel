# Switch a trip's collaboration sections on and off, and let the screen follow

| Field              | Value                                              |
| ------------------ | -------------------------------------------------- |
| **Status**         | ready                                              |
| **Issue**          | none                                               |
| **Spec PR**        | #<pr, filled in step 6>                            |
| **Implementation** | none                                               |
| **Plan**           | 07-S2 (docs/plans/07-collaboration-and-sharing.md) |

## 📝 TLDR

Plan stage `07-S2` closes reference row `COL-02` (the collaboration panel as independently switchable
sub-features) on `/trips/$tripId/collab`. Today the screen is a fixed arrangement of three parts - the
conversation, the notes board and the polls board - and a trip owner or editor cannot turn one off;
`trips.collab_modules` (the column that is meant to hold that choice) **already exists** (migration
`0006_mighty_nehzno.sql`, `src/server/db/schema.ts:740`) and nothing reads or writes it. This stage
adds the choice and makes the screen follow it: a header menu "Choose sections" with one checkbox per
section, a screen that shows only the enabled ones (desktop: the conversation keeps its 24rem track
beside the rest, or the whole width when it is the only one on; below `xl`: a tab bar showing only the
enabled sections), and a signal to the other travellers' open screens so their layout changes under
them.

It is also the stage that makes the file layout follow the same seam, because three wave-2 stages of
plan 07 each change exactly one sub-feature (`07-S3` the thread, `07-S4` notes, `07-S5` polls): the
server write paths, the loader, the boards and the dialogs are split one file per sub-feature. That
part changes no behaviour except one extraction (`postTripMessage`, Phase 1) and is two prefactoring
tickets that come first, in order.

The stage is cut into four phases: **Phase 1** the server split (no visible change), **Phase 2** the
component split (no visible change), **Phase 3** "turn a section off" (vocabulary, repository writer,
server function, loader, header menu, desktop layout, peers update; `afk-to-tickets` may cut it into a
server slice and a UI slice, five tickets in all), **Phase 4** the tab bar below `xl` and per-section
skeletons. It describes the work **left** at HEAD (`ff777dc5`) and departs from the plan's stage block
where the Resolved assumptions table says so.

## 📝 Problem Statement

Measured at HEAD:

- `src/routes/_app/trips/$tripId/collab.tsx` renders `Thread`, `NotesBoard` and `PollsBoard` in
  `grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]`. Nothing can be switched off. When a trip has no use
  for polls, the polls card still takes its place; when only the conversation matters, the notes and
  polls cards still hold the right-hand track.
- `trips.collab_modules` exists (`text`, JSON mode, nullable) and is read and written by nothing
  (`grep -rn collab_modules src` returns the schema column only). Its docblock says the validation "lands
  with `07-S2`". So **no migration is needed**: the plan's "requirement filed to `00-S1`" was already met.
- The write paths of all three sub-features are one module, `src/server/fns/collab.ts` (328 lines), the
  boards are one module `collab-board.tsx` (599 lines) and the dialogs one `collab-dialogs.tsx` (436),
  and the loader `loadTripCollab` sits in `src/routes/_app/-server/trip.ts` (767 lines, shared by every
  trip tab). Three wave-2 stages would name all four.
- `src/routes/_app/-server/trip.ts:753` holds a **second** `postMessageFn`: no `requireTrip`, no room
  mirror, no notification. Its only caller is `src/routes/_app/-ui/message-composer.tsx`, which nothing
  imports (`grep -rn MessageComposer src` returns the definition only). The real writer is in
  `src/server/fns/collab.ts` and already carries the notification (`notifyTripMessage`, plan stage
  `00-S2` landed). `grep postMessageFn` therefore answers with two writers, which is the shape
  `docs/SPEC.md` §8 forbids and the exact trap the plan warns about when a message writer is moved.
- Below `xl` the three parts stack in one long column; a traveller who wants the notes scrolls past
  the whole transcript.
- The trip role helpers this needs exist: `requireWritableTrip`, `assertTripRole`, `tripRoleFor`,
  `canWritePlan` (`src/server/repos/trips.ts`); the repository `src/server/repos/collab.ts` already imports
  `requireTrip` from `./trips`, so it can compose them.

Missing, from the traveller's side: _On this trip we only use the chat. Can the rest get out of the
way?_ and _On my phone I want the notes, not the transcript above them._

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                                                                                                    | Not owned (read only, or left alone)                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/lib/collab-sections.ts` - new: the closed vocabulary, `resolveCollabSections`, `enabledCollabSections`, `collabLayout`, `activeCollabSection`, the Zod schemas; `src/lib/__tests__/collab-sections.test.ts` - new                                                                                                                                                                                                          | `drizzle/`, `src/server/db/schema.ts` columns - **no migration**; only the column's docblock sentence is updated |
| `src/server/repos/collab.ts` - edit: `setTripCollabSections`                                                                                                                                                                                                                                                                                                                                                                    | `src/server/repos/trips.ts` (read only: the guards are imported, not edited)                                     |
| `src/server/repos/__tests__/collab-sections.test.ts` - new; `tenant-isolation.test.ts` - append                                                                                                                                                                                                                                                                                                                                 | `src/server/do/protocol.ts` - no new entity kind; the signal is a field on the existing `trip` kind              |
| `src/server/fns/collab-thread.ts`, `collab-notes.ts`, `collab-polls.ts` - new (writers moved unchanged, plus a plain payload builder each and the row types it returns); `src/server/fns/collab.ts` - **delete**; `src/server/serialise.ts` - `git mv` from `src/routes/_app/-server/serialise.ts` (the four route consumers repointed)                                                                                         | The behaviour of every writer: unchanged, including the notification and the room mirror                         |
| `src/routes/_app/trips/$tripId/-server/collab.ts` - new: `loadTripCollab`, `setCollabSectionFn`                                                                                                                                                                                                                                                                                                                                 | `src/routes/_app/trips/$tripId/-server/plan.ts` and the other trip tabs                                          |
| `src/routes/_app/-server/trip.ts` - edit: the moved loader and its types, the duplicate `postMessageFn` and orphaned imports leave; `loadPeople` and `tripInput` gain `export`                                                                                                                                                                                                                                                  | `src/components/ui/**`, `src/styles/**` (no token or primitive is added)                                         |
| `src/routes/_app/-ui/message-composer.tsx` - **delete** (dead, see above)                                                                                                                                                                                                                                                                                                                                                       | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3)                                                     |
| `src/routes/_app/trips/$tripId/collab.tsx` - edit                                                                                                                                                                                                                                                                                                                                                                               | `src/routeTree.gen.ts` - no route is added or renamed, no `pnpm generate-routes`                                 |
| `src/components/modules/collab/`: `notes-board.tsx`, `polls-board.tsx`, `note-dialog.tsx`, `poll-dialog.tsx`, `sections.ts` (the presentation map: label key and icon per section id, typed `Record<CollabSectionId, ...>`; no order and no default of its own), `collab-sections-menu.tsx`, `collab-tabs.tsx` - new; `collab-board.tsx`, `collab-dialogs.tsx` - **delete**; `index.ts`, `thread.tsx` (import path only) - edit | `use-trip-room.ts`, `presence-bar.tsx`, `poll-options.ts`, `types.ts`                                            |
| `src/components/modules/collab/__tests__/sections.test.ts`, `collab-sections-menu.test.tsx`, `collab-tabs.test.tsx` - new                                                                                                                                                                                                                                                                                                       | `e2e/places-and-maps.spec.ts`, `e2e/trips-core.spec.ts`, `e2e/journeys.spec.ts` (other plans' declarations)      |
| `e2e/collaboration-and-sharing.spec.ts` - new: one `test.describe('07-S2 - ...')` with one journey                                                                                                                                                                                                                                                                                                                              |                                                                                                                  |
| `src/lib/i18n/messages/<locale>/trips.ts` - edit, **all 23 locales**                                                                                                                                                                                                                                                                                                                                                            |                                                                                                                  |
| `CONTEXT.md` - a **Collaboration section** entry (Phase 3)                                                                                                                                                                                                                                                                                                                                                                      |                                                                                                                  |
| This spec's `Status` / `Implementation` rows, the regenerated `.ai/specs/README.md`, any document a phase's grep names                                                                                                                                                                                                                                                                                                          |                                                                                                                  |

**The plan's file-ownership reasoning no longer binds.** It held `trips.ts` and the screen's files
back for wave-level collisions between parallel stages; tickets are implemented one at a time now. Its
`e2e/collaboration-and-sharing.visual.spec.ts` and `e2e/__screenshots__/…` are **struck**: ADR 0016
removed screenshot baselines, and the visual judgement is the blind A/B pair
(`scripts/visual/capture.mjs`). One browser journey is kept (see Verification) because the layout is
CSS-only and nothing below a real browser can prove it.

### The seam the plan draws, and where this spec moves it

The plan's table (conversation / notes / polls / what's next, one reader and writer module each) is
kept. The fourth row, "What's next", is registered by `07-S9` with its toggle and is **not** created
here: a switch for a panel that renders nothing is placeholder copy wearing a switch. The registry and
the schema are written so that adding it is one row in one file (see Phase 3 and the test that ties
the schema to the registry).

### Phase 1 - The server split (a prefactoring ticket; one extraction, otherwise no visible or behavioural change)

Behaviour is held constant; the ticket is verified by the existing gate plus the tests below.

1. `git mv src/routes/_app/-server/serialise.ts src/server/serialise.ts` and repoint its four route consumers
   (`trip.ts`, `library.ts`, `overview.ts`, `settings.ts`). The payload builders below need `isoOf` / `isoOfRequired`,
   and no module under `src/server` imports from `src/routes` (docs/SPEC.md §6, §8: route -> server, never the other
   way). The file's header comment explains why it is safe to reach from the client entry; the move keeps it a
   server-side module that routes import the same way they import `#/server/clock`, and `pnpm build` (in the gate)
   is the check that import protection is still satisfied.
2. Create `src/server/fns/collab-thread.ts` (`postMessageFn`, `editMessageFn`, `deleteMessageFn`,
   `toggleReactionFn`, `notifyTripMessage`, the message input shapes), `collab-notes.ts` (`createNoteFn`,
   `updateNoteFn`, `deleteNoteFn`, `noteInputSchema`, `noteUpdateSchema`) and `collab-polls.ts` (`createPollFn`,
   `castVoteFn`, `closePollFn`, `deletePollFn`, `pollInputSchema`), each moved **verbatim** from `collab.ts`, with
   one exception: **the one non-verbatim change of the phase** is that `postMessageFn`'s inline handler is pulled
   out into an exported plain function `postTripMessage(scope, data)` and the server function calls it. The room
   mirror, then `notifyTripMessage`, stay in that order inside it; this is what lets the notification be asserted
   (below) without a request. Each module also exports one **plain** async payload builder, and the row types it
   returns (`MessageRow`, `NoteRow`, `PollRow`): `threadPayload(scope, trip)` (the current `listMessages` page of 50
   plus `listReactions`), `notesPayload(scope, trip)`, `pollsPayload(scope, trip)` (polls plus `listVotes` and the
   tally). **All three take the resolved `Trip` row**, never a bare id: an exported reader that could be called
   with an id that skipped `requireTrip` would read a private trip through a tenant-only filter. The
   row-to-payload mapping is copied from `loadTripCollab` unchanged.
3. Delete `src/server/fns/collab.ts`. **Before deleting, assert the notification survived:** `postTripMessage`
   calls `notifyTripMessage` after the room mirror, exactly as today (the plan's warning about losing a call
   while splitting a file).
4. Create `src/routes/_app/trips/$tripId/-server/collab.ts` with `loadTripCollab` (same name, same `GET` server
   function, same input) composing `threadPayload`, `notesPayload`, `pollsPayload`, `loadPeople` and the timezone
   exactly as today, in one `Promise.all`. `CollabPayload` moves with it (the three row types come from the `fns`
   modules). Remove the loader, `CollabPayload` and the imports their removal orphaned from
   `src/routes/_app/-server/trip.ts`; **export `loadPeople` and `tripInput`** from it (the other loaders still use
   both; copying them would be two owners of one function).
5. Delete the duplicate `postMessageFn` in `trip.ts` and the unreferenced `message-composer.tsx`
   (`grep -rn "MessageComposer\|message-composer" src` must return nothing). The writer that remains mirrors to the
   room and notifies the members.
6. Repoint every consumer of the old module: `thread.tsx`, `collab-board.tsx` and `collab-dialogs.tsx` (which Phase 2
   then moves), and `collab.tsx`'s loader import.
7. File the follow-up issue for the writers' authorisation gap (Out of scope, below) and cite its number in the PR
   body. It is a tracker action, not a code change.

Tests, first: `src/server/fns/__tests__/collab-payloads.test.ts` drives the three plain builders over the
repository harness (`src/server/repos/__tests__/harness.ts`; the plain functions are driven rather than
the server functions for the reason `stays.test.ts` gives). Assertions: messages come back oldest-first,
with reactions; notes and polls come back with the shapes the screen reads today; a poll's tally counts
each option's votes. A second case drives `postTripMessage` and asserts it still dispatches a notification and
mirrors a `trip` patch, in that order (the notification is exercised through the same stub `dispatch.test.ts` uses).

### Phase 2 - The component split (a prefactoring ticket; no visible change; blocked by Phase 1)

Move, with no behaviour change: `NotesBoard` (with its `formatWhen`, `nameFor`, `LOCALE`) from
`collab-board.tsx` to `notes-board.tsx`; `PollsBoard` to `polls-board.tsx`; `NoteDialog` and `PollDialog`
(with `MAX_OPTIONS`) from `collab-dialogs.tsx` to `note-dialog.tsx` and `poll-dialog.tsx`; delete the two
old files; update `index.ts` (same public names). The moved files keep the `collab-notes` / `collab-polls`
imports Phase 1 gave them. The abbreviated-month call sites in the notes board (`Intl.DateTimeFormat('en-GB')`)
move with the file and are **not** fixed here (the plan records that deferral; it belongs to `07-S4`).

Verification: the gate, the `rendered-copy` and `logical-properties` tests (they scan this directory), and a
`pnpm dev` look at `/trips/<id>/collab` unchanged at 360 and 1280.

### Phase 3 - Turn a section off

`afk-to-tickets` may cut this phase into a **server slice** (vocabulary, `setTripCollabSections`,
`setCollabSectionFn`, the loader's `sections` / `canConfigure`; the screen still shows every section) and a **UI
slice** (menu, layout, draft retention, peers' signal, copy in 23 locales, glossary).

**The vocabulary** (`src/lib/collab-sections.ts`, pure and isomorphic, one owner; imported by the repository, the
server function and the UI - `src/lib/plans.ts` and `src/lib/map/basemap.ts` are the precedents for a repository
importing a `src/lib` vocabulary):

```ts
export const COLLAB_SECTIONS = [
  { id: 'conversation', defaultOn: true },
  { id: 'notes', defaultOn: true },
  { id: 'polls', defaultOn: true },
] as const
export type CollabSectionId = (typeof COLLAB_SECTIONS)[number]['id']
export type CollabSections = Readonly<Record<CollabSectionId, boolean>>
```

The words follow the glossary (**Collaboration section**, below). The column `trips.collab_modules` and the row field
`collabModules` keep their names (renaming a column is a migration); they are the one place "module" survives.

- `resolveCollabSections(stored: unknown): CollabSections` - never throws. `null`, a non-object or an empty
  object resolve to every registry default; a missing key takes the registry's `defaultOn`; a non-boolean
  value is treated as missing; **an unknown key is ignored** (a rolled-back or newer Worker may have written
  one); **a stored record with no known section on resolves to every registry default** (it can occur when a later
  stage stores only its own section on and a Worker is rolled back, or after a hand edit; without this every
  section would come back `null` and there would be nothing to fall back to). This is the only reader of the column.
- `enabledCollabSections(sections)` - the enabled ids in registry order (the tab bar's order).
- `collabLayout(sections)` - `'split'` when `conversation` is on and at least one other is on, otherwise `'single'`.
- `activeCollabSection(enabled, selected)` - `selected` when it is still enabled, else the first enabled id.
- `visibleCollabSections(sections, withDraft)` - the enabled ids plus any id in `withDraft` (the sections that hold
  the traveller's unsent work, see **Peers**), in registry order. The layout and the tab bar are computed from this
  set, not from the stored record alone.
- `collabSectionChangeSchema` - `z.strictObject({ tripId, section: z.enum(ids), on: z.boolean() })`, the server
  function's input (ids derived from the registry with `COLLAB_SECTIONS.map`).
- A test asserts the schema's accepted `section` values equal the registry ids, so a row added to the registry
  cannot be forgotten by the schema, and `sections.ts` (typed `Record<CollabSectionId, ...>`) fails typecheck
  until the new id has a label and an icon. **07-S9 adds `whats-next` by one row in `collab-sections.ts` and one
  entry in `sections.ts`** - not in the plan's `components/modules/collab/modules.ts`, which this spec replaces with
  `sections.ts` so there is one vocabulary and one presentation map.

**The repository** (`src/server/repos/collab.ts`):
`setTripCollabSections(scope, tripId, change: { section, on }): Promise<CollabSections>`:

1. `requireWritableTrip(scope, tripId)` - tenant, visibility, then not archived (`NotFoundError`, `TripArchivedError`).
   It returns the trip row; the next steps use that row, not a second read.
2. `assertTripRole(scope, tripId, ['owner', 'editor'])` - **after** the trip is proven visible, the order
   `day-notes.ts` `writableTripDay` documents (a foreign or private trip id is a `NotFoundError` and learns nothing).
   A workspace member who is not on an `organization`-visible trip can see it and therefore gets `TripRoleError`
   (role `null`), not `NotFoundError`.
3. Merge the one switch into `resolveCollabSections(trip.collabModules)`; if the result has no section on,
   refuse with a `CollabSectionsError` - a plain `Error` subclass whose name is **not** in `AUTHORED_ERROR_NAMES`
   (`src/server/errors/public.ts`), so `classifyFailure` shows the traveller no server sentence and the screen's own
   localised `collab.sections.failed` toast speaks (an English sentence from the server would reach 22 locales as
   English, docs/SPEC.md §9). The menu does not offer the toggle; this is the last line of defence for a stale tab.
4. `tripsRepository` update by id (`organization_id` is stamped by the tenant repository), writing the **whole
   resolved record** built from the row of step 1, never a per-key `json_set` or any partial SQL merge (the "at
   least one section on" rule holds only because every record that lands was validated whole); return it.

A trip's row is the only thing written. No countable row is created: no quota metric, no `resolveLimits()` case.

**The server function** (`-server/collab.ts`): `setCollabSectionFn`, `method: 'POST'`, `appScope()` then the
repository writer, then `mirrorToRoom(scope, tripId, [patch('trip', tripId, { collabSectionsChangedAt: Date.now() })])`.
The patch is a scalar **signal** in the family of `chatChangedAt` / `pollsChangedAt` (plan 07-S1's contract:
a commit frame makes peers `router.invalidate()`, it never carries data). It returns the resolved record. Role and
archive refusals reach the screen as the authored refusals `AUTHORED_ERROR_NAMES` already lists
(`TripRoleError`, `TripArchivedError`); the menu is not offered to a caller who would get one, so this is the
backstop for a stale tab.

**The loader** (`loadTripCollab`): after `requireTrip`, `sections = resolveCollabSections(trip.collabModules)`,
`role = tripRoleFor(...)`, `canConfigure = canWritePlan(trip, role)`; only the enabled sections' payload
builders run (a disabled section costs no reads). The payload gains `sections` and `canConfigure`; a disabled
section's field (`messages`, `notes`, `polls`) is `null`. The people list and time zone are unchanged.

**The screen** (`collab.tsx`):

- Header actions: the `CollabSectionsMenu` (below), rendered only when `canConfigure`. The `PresenceBar` stays
  where it is: presence is not a section.
- The header's description lists the counts of the **enabled** sections only, joined by the middle dot as today.
  When any section is off, **everyone** (a viewer and a traveller arriving from a notification link included) sees
  one quiet line under it, `trips.collab.sections.someHidden` ("Some sections are hidden on this trip."), so a
  missing section is explained and not mistaken for lost data. `trips.collab.empty` ("Nothing shared yet") shows
  only when every enabled section is empty **and** no section is hidden.
- Layout `'split'`: today's grid (`xl:grid-cols-[24rem_minmax(0,1fr)]`), the conversation panel keeps its sticky
  measure; notes and polls stack in the second track (those that are on). Layout `'single'`: one full-width track
  (`grid-cols-1`); a lone conversation keeps its sticky composer foot; a conversation-off trip stacks notes and
  polls in the one track. The layout is a pure function of the visible set, so server and client render the same
  tree (on first render nothing is dirty, so the visible set is the stored record's).
- Each visible section is rendered **once**, in the DOM, at every width (see Phase 4).
- No animation of the grid's tracks (a track change is a layout property, which the motion rules exclude; the plan's
  220 ms is struck for that reason). A panel that appears below `xl` runs the tab primitive's existing entrance
  (`animate-rise` on `TabsContent`); at `xl` it is suppressed (`xl:data-[state=active]:animate-none`) so a peer's
  fallback never replays it on a panel that was already on screen. `prefers-reduced-motion` already collapses it.
- `useRouteContext`'s `shell.role !== 'member'` moderation flag stays as is.

**The menu** (`collab-sections-menu.tsx`): a `DropdownMenu` whose trigger is a `Button` with visible text **"Choose
sections"** at every width (never icon-only: a phone has no hover tooltip), at least 44px high on touch, with
`data-part="collab-sections-trigger"`. The verb is deliberate: a bare "Sections" reads as navigation beside the
tab bar of sections and the shell's "Trip sections" nav. Content: a `DropdownMenuLabel` ("Show for everyone on this
trip" - the choice is the trip's, not the traveller's own view) and one **`DropdownMenuCheckboxItem`** per registry row
(`menuitemcheckbox`; the item label reuses the existing panel names). The menu stays open on toggle (`onSelect`
calls `preventDefault`).

- **No optimistic guess.** The checked state of every item comes from the record the screen holds. A toggle calls the
  server function, then **awaits the router invalidation**, and the item stays pending until the loader has delivered
  the new record - otherwise on a slow connection the checkbox would snap back and a second tap would undo the first.
- **Pending state.** `ItemIndicator` renders only while an item is checked, so it cannot carry a spinner for a section
  being switched **on**. The changed item shows `<Spinner label={null} />` in a trailing `aria-hidden` slot **inside
  the item's children**; its accessible name does not change while the write is in flight (a `Spinner`'s default
  `role="status"` label would append "Loading" to the name). Every item uses `aria-disabled="true"`, not `disabled`,
  while a write is pending, so focus is never dropped mid-write; `onCheckedChange` ignores a toggle while pending.
  `aria-busy` is not used (it says nothing to a screen reader on a menu item). The result is carried by the focused
  item's checked state changing.
- **The last section on.** When exactly one section is on, its item uses `aria-disabled="true"`, **not** `disabled`:
  Radix removes a `disabled` item from arrow navigation, typeahead and Home / End, so the footer that explains it would
  never be reached. `onCheckedChange` ignores it (it still fires after `preventDefault`), the style comes from
  `aria-disabled:` variants, and `aria-describedby` points at a persistent footer line, `trips.collab.sections.keepOne`
  ("At least one section stays on."). A test asserts ArrowDown reaches the item and its description is the footer.
- **A failed write** is a toast through `useAction`: title `collab.sections.failed` ("That change did not save"), body
  `collab.sections.failedBody` ("Nothing changed for anyone on the trip."); the menu stays in the server's state.
- A `Switch` is not used: a nested interactive control inside a menu item is invalid ARIA.

**Peers.** `PresenceBar`'s `onCommit` already invalidates the router on any `trip` patch, so a peer's loader re-reads
and the layout changes under them. Three things keep that from hurting a traveller:

1. **Unsent work is never taken away.** Each section reports whether it holds unsent work (a non-empty composer, an
   open note or poll dialog, a message being edited) through one `onDirtyChange(sectionId, dirty)` callback the
   screen collects into the `withDraft` set. A section that a peer switched off **stays on this screen** while it is in
   `withDraft`, with one line above it, `trips.collab.sections.turnedOff` ("This section was turned off for the trip.
   Send or discard to close it."); when the draft is sent or discarded it leaves like any other. Focus does not move
   while it stays.
2. **Focus is repaired.** When the section that holds focus leaves the screen (a peer's change, a send that closes a
   retained section), focus moves to the newly active tab below `xl`, or to the first remaining panel's heading at
   `xl`, never to `<body>`.
3. **The change is announced once.** When the visible set changes and the change did not come from this tab's own write,
   a polite live region says `trips.collab.sections.changed` ("The sections on this trip changed."). The author's own
   menu already shows the truth, and a viewer has no menu, so the announcement is for everyone else.

A peer's selected section that disappears falls back with `activeCollabSection`. A message posted from a stale tab into
a switched-off conversation still lands and still notifies the members: off is a display choice (below).

**Glossary:** `CONTEXT.md` gains **Collaboration section** - one of the independently switchable parts of a trip's
collaboration screen (the conversation, the notes, the polls). Switching one off hides it for everyone on the trip
and deletes nothing; it is a **display choice, not access control**: the data stays readable and writable elsewhere
(message previews in notifications, a future share-link `collab` scope, `docs/ACCESS.md` §3.1), and the section
reappears for everyone after a rollback to a Worker that does not read the setting. _Avoid_: "module" (that is a
**Product module**; the column `trips.collab_modules` is the one exception, named so in the entry), "widget".

**Documents:** the `trips.collab_modules` docblock in `schema.ts` ("that validation lands with `07-S2`, and until it does nothing reads or
writes the column") is rewritten to say where the validation lives; a grep for `collab_modules`, `collab-board`, `collab-dialogs`,
`fns/collab`, `loadTripCollab` and `postMessageFn` over `src docs scripts .ai CONTEXT.md` is run on every head and the terms recorded in the PR.

Tests, first:

- `src/lib/__tests__/collab-sections.test.ts`: `null` resolves to every default; an unknown stored key is ignored and the known keys survive;
  a non-boolean value falls back to the default; a record missing a key (a newer registry) takes that key's default; **a record with no known
  section on resolves to every default**; `enabledCollabSections` follows registry order; `collabLayout` is `'single'` for conversation alone, for
  conversation off, for one section on, and `'split'` for conversation with notes; `activeCollabSection` keeps a still-enabled selection and falls
  back otherwise; `visibleCollabSections` keeps a switched-off section that holds a draft; the schema accepts exactly the registry ids.
- `src/components/modules/collab/__tests__/sections.test.ts`: every registry id has a label key that exists in the `en` catalogue and an icon.
- `src/server/repos/__tests__/collab-sections.test.ts` (harness): an owner switches `polls` off and the stored record is the full resolved record;
  an editor may; a viewer gets `TripRoleError`; **a workspace member who is not on a `private` trip gets `NotFoundError`, and one who is not on an
  `organization`-visible trip gets `TripRoleError` (and the loader's `canConfigure` is false for them)**; an archived trip gets `TripArchivedError`;
  turning off the last enabled section is refused with `CollabSectionsError` and the row is unchanged; turning a section back on round-trips.
- `src/server/repos/__tests__/tenant-isolation.test.ts` (append one `describe`): in A's scope, `setTripCollabSections` on B's trip id is a
  `NotFoundError` and B's row is byte-identical afterwards (`collab_modules` and `updated_at` included). The refusals above run in A's own scope
  so a validation failure can never be mistaken for an isolation pass.
- `src/components/modules/collab/__tests__/collab-sections-menu.test.tsx`: one checkbox item per registry row, the checked states mirror the record;
  with one on, its item is `aria-disabled`, ArrowDown reaches it and its description is the footer; while pending every item is `aria-disabled`, the
  changed item shows the spinner without a change of its accessible name, and the item stays pending until the record arrives; a failed write shows the
  toast with its body and leaves the menu in the server's state.
- `src/components/modules/collab/__tests__/collab-peers.test.tsx`: a peer switches a section off while its composer has text, an open note
  dialog, an open poll dialog or a message being edited - the section stays with the `turnedOff` line and focus does not move; after the draft is
  sent it leaves and focus lands on a tab / panel heading, not `<body>`; a peer's change is announced once in the live region, and the author's own
  change is not.

### Phase 4 - On a phone the sections are tabs

Below `xl` (CSS only, `docs/` rule in `src/lib/breakpoints.ts`: a JS `matchMedia` paired with a Tailwind variant is the repo hazard, so none is used):

- A controlled `Tabs` (`collab-tabs.tsx`) renders one `TabsTrigger` per **visible** section, in registry order, `xl:hidden`. The tab list
  sits in a horizontally scrolling `ScrollArea` so long labels never wrap or clip; the underline `md` trigger is used (44px high on touch),
  and **the focus ring stays visible** because the `ScrollArea` viewport is padded by at least 4px (`viewportClassName="p-1"`), the ring being
  drawn 4px outside the trigger and the root being `overflow-hidden`. A trip with polls off has a two-tab bar, never a disabled third.
- **The bar sticks** below the trip sub-navigation, with the same offset variables the conversation panel already uses
  (`--impersonation-h`, `--nav-h`, `--subnav-h`, `src/routes/_app/trips/$tripId/collab.tsx`), so after a long conversation the traveller reaches
  Notes without scrolling back up; choosing a tab brings the top of its panel into view.
- Each visible section's panel is wrapped in `TabsContent forceMount` with `data-[state=inactive]:hidden xl:data-[state=inactive]:block`, so it is in the
  DOM once at every width: no hydration branch, no layout shift between server and client, and at `xl` all panels show in the grid. Each panel keeps its
  visible `ModulePanel` heading and gets `tabIndex={-1}` (a hidden tab list at `xl` must not leave three extra Tab stops with large outlines; each
  panel starts with its own focusable controls). The primitive's own `mt-5` is overridden at `xl` (`xl:mt-0`) and its entrance suppressed at `xl`
  (see Phase 3). The conversation's `xl:sticky` classes move onto the `TabsContent` wrapper that is the grid item, because a sticky element inside a
  wrapper is contained by that wrapper and would stop sticking.
- The selected tab is local state, initially the first visible; `activeCollabSection` repairs it when the record changes under it.
- The panel body is unchanged at every width (no new scroll container: the page scrolls on a phone as today).
- Per-section skeletons replace `CollabPending`'s two generic cards: three message rows (avatar circle + two text lines) for the conversation, two note cards (title bar + three-line body) for notes, one poll card with two option bars for polls; the pending component composes the ones the trip has on (the loader's sections are unknown while pending, so it shows all three, tabs-shaped below `xl`).
- Errors: the route `errorComponent` stays (`ErrorPanel` already offers a retry). Existing per-board empty states stay unchanged.

Tests: `collab-tabs.test.tsx` - only visible sections get a tab; registry order; arrow-key roving selection (Radix, asserted not re-implemented); an active tab that is switched off falls back to the first visible one; all visible panels are present in the DOM regardless of the active tab; each panel has `tabIndex={-1}`.

### Alternatives considered, and why they lost

| Alternative                                                        | Why not                                                                                                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The plan's whole-record write (`z.strictObject` of every id)       | A stale tab after a registry row is added sends a record missing a key and fails; two members toggling different sections overwrite each other's record. |
| `Switch` controls inside a dropdown menu                           | A switch nested in a menu item puts one interactive control inside another; `menuitemcheckbox` is the pattern the menu role defines.                     |
| A JS media query choosing between grid and unmounted `TabsContent` | A hydration branch and a layout shift; `src/lib/breakpoints.ts` records why the pairing is hazardous.                                                    |
| A hard unmount of a switched-off section under a peer's draft      | The traveller loses typed work because of what somebody else did, with nothing said; a section holding unsent work stays until it is sent or discarded.  |
| Writers refuse while a section is off                              | Off is a presentation choice; a stale tab or a notification link must still land. Data is kept either way.                                               |
| Per-panel error `Alert`s                                           | Needs a partial loader; the three readers share one round trip and the route `ErrorPanel` already retries.                                               |

## 📝 Architecture

- **Owner modules (docs/SPEC.md §8):** the section vocabulary - `src/lib/collab-sections.ts` (one row per section; its presentation, label and icon, `components/modules/collab/sections.ts`); the stored record's writer and its guards - `src/server/repos/collab.ts`
  (`setTripCollabSections`); the screen's loader and the setting's server function - `-server/collab.ts`; each section's writers and payload builder - its own `collab-*.ts`;
  the layout decision - `collabLayout` (pure) consumed by `collab.tsx`.
- **Dependency direction:** `collab.tsx` (route) -> `-server/collab.ts` -> `src/server/fns/collab-*.ts` plain builders (and the row types they return) -> repositories and `src/server/serialise.ts`; nothing under `src/server` imports from `src/routes`. `src/components/modules/collab` imports the
  vocabulary from `src/lib` and writers from `src/server/fns` as today; `src/components/ui` is untouched. The repository imports `src/lib/collab-sections` and `./trips` (no cycle: `trips.ts` does not import `collab.ts`).
- **Realtime:** one more producer of a `trip` signal; no new entity kind, no protocol edit.
- **Rollback safety:** the column is read through a tolerant resolver and written as a flat boolean object; a Worker rolled back to before this stage ignores it and renders today's fixed layout.

## 📝 Data Model

No change. `trips.collab_modules` (`text`, JSON, nullable, no index, no `CHECK`) already exists. Null = nothing decided = every section on. Validation is Zod on the way in and
`resolveCollabSections` on the way out; no `CHECK` because a constraint change on an existing SQLite table makes drizzle-kit rebuild the table. **No `pnpm db:generate`.** Writing the column bumps `trips.updated_at`
like every other trip column write.

## 📝 API Contracts

| Function                                                | Method | Input                                    | Output                                                                | Who                                    |
| ------------------------------------------------------- | ------ | ---------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| `loadTripCollab` (moved)                                | GET    | `{ tripId }`                             | the payload plus `sections`, `canConfigure`; disabled sections `null` | any reader of the trip                 |
| `setCollabSectionFn` (new)                              | POST   | `{ tripId, section: <registry id>, on }` | the resolved `CollabSections`                                         | trip `owner` or `editor`, not archived |
| `postMessageFn` … `deletePollFn` (moved, **unchanged**) | POST   | as today                                 | as today                                                              | as today                               |

## 📝 UI/UX

- `/trips/$tripId/collab`, default SSR, unchanged route. Header: title, counts of the enabled sections, the "some sections are hidden" line when any is off, presence bar, and (for owner/editor) the "Choose sections" menu.
- Desktop (`xl` and up): `'split'` or `'single'` as above. Below `xl`: a sticky tab bar of the visible sections above the one visible panel.
- States per section: loading (shaped skeleton), empty (the existing `EmptyState`), error (route `ErrorPanel` with retry).
- Tokens: none added. `--color-surface-2`, `--color-edge-faint`, `--radius-xl`, `--shadow-card` and its dark counterpart, `--space-4`/`--space-6` as the existing panels use them; counts carry `tabular-nums`; no hex, no one-off margin. The menu's footer line and the `turnedOff` / `someHidden` lines use the existing muted-text token pair that passes AA in both themes (checked in the browser capture, both themes).
- Keyboard: the tab list follows Radix's roving tabindex; the menu is reachable, arrow-navigable (the last-on item included), dismissed with Escape, and focus returns to the trigger. Focus is never dropped to `<body>` by a peer's change (Phase 3, **Peers**).

## 📝 Visual change expected

| Route                   | States that change                                                                                                                                                                                                                                                                                                  | Widths          | Themes         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------- |
| `/trips/$tripId/collab` | Three compositions: all on (looks as today on desktop; a sticky tab bar on a phone); conversation alone (one full-width track, with the "some sections are hidden" line); conversation off, notes and polls on. The open "Choose sections" menu, with one item on (last item `aria-disabled` with its footer line). | 360, 1280, 2560 | light and dark |

Capture with `scripts/visual/capture.mjs`, `--click '[data-part="collab-sections-trigger"]'` for the menu (assert `count() === 1` first), `PT_SERVER_TODAY=2026-08-20`. Phases 1 and 2 expect **no** visible change. At 360 the capture is also taken in `de`, `hu`, `el`, `ru`, `uk` (the longest labels) and in `ar` (the tab bar starts at the inline start).

## 📝 Copy

New keys, `en`, all in the `trips` namespace, each landed in all 23 locales per the `i18n-messages` skill. The section labels reuse existing keys (`trips.collab.conversation`, `modules.field.notes`,
`modules.collab.polls.heading`; each verified to exist at HEAD).

| Key                          | Text                                                                   |
| ---------------------------- | ---------------------------------------------------------------------- |
| `collab.sections.trigger`    | Choose sections                                                        |
| `collab.sections.menuLabel`  | Show for everyone on this trip                                         |
| `collab.sections.keepOne`    | At least one section stays on.                                         |
| `collab.sections.failed`     | That change did not save                                               |
| `collab.sections.failedBody` | Nothing changed for anyone on the trip.                                |
| `collab.sections.tabsLabel`  | Collaboration sections                                                 |
| `collab.sections.someHidden` | Some sections are hidden on this trip.                                 |
| `collab.sections.turnedOff`  | This section was turned off for the trip. Send or discard to close it. |
| `collab.sections.changed`    | The sections on this trip changed.                                     |

(`keepOne` is the menu's persistent line. The server's refusal of the last section carries no sentence the screen shows: it is a `CollabSectionsError`, which `classifyFailure` does not pass through, so the `failed` toast speaks in the traveller's own locale.)

## 📝 Edge Cases & Failure Scenarios

| Case                                                               | Behaviour                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Column is null                                                     | Every section on; no write until somebody switches one.                                                                                                                                    |
| Stored record has an unknown key or a non-boolean                  | Ignored / defaulted; never thrown.                                                                                                                                                         |
| Stored record has no known section on                              | Every registry default (never every section hidden).                                                                                                                                       |
| Two members switch different sections at once                      | Last write wins on the merged record (a single-switch input keeps the window to one read-modify-write); every record that lands has one section on; the signal makes both screens re-read. |
| Someone tries to turn off the last section                         | The menu does not offer it (the item stays focusable and says why); the repository refuses it for a stale tab with a diagnostic and the localised failure toast.                           |
| A viewer, or anyone on an archived trip                            | No menu rendered; the writer refuses (`TripRoleError`, `TripArchivedError`).                                                                                                               |
| A workspace member who is not on a `private` trip                  | The trip does not exist for them (`NotFoundError`).                                                                                                                                        |
| A workspace member who is not on an `organization`-visible trip    | They can read it; no menu (`canConfigure` false); the writer refuses with `TripRoleError`.                                                                                                 |
| Peer switches the section you are on (nothing unsent in it)        | Selection falls back to the first visible section; focus lands on the newly active tab (below `xl`) or the first panel heading (`xl`); one polite announcement.                            |
| Peer switches off a section where you hold unsent work             | The section stays with the `turnedOff` line until you send or discard; focus does not move; after it leaves, focus is repaired as above.                                                   |
| Section switched off, then a notification link opens the screen    | The screen opens without that section, with the "some sections are hidden" line; the trip's data is intact.                                                                                |
| A message posted from a stale tab into a switched-off conversation | It lands and still notifies the members (off is a display choice); the next refresh shows it when the section is switched back on.                                                         |
| Room unreachable when the write is mirrored                        | `mirrorToRoom` logs and swallows; the author's invalidation shows the change; peers catch up on reconnect.                                                                                 |
| Write fails                                                        | Toast with title and body; the menu shows the server's state.                                                                                                                              |
| Slow connection after a toggle                                     | The item stays pending until the loader has the new record; no snap-back, no second tap undoing the first.                                                                                 |
| Hydration                                                          | Server and client render the same tree at every width (CSS-only responsiveness); the room is opened after hydration as today.                                                              |

## ✅ Acceptance criteria

1. Phase 1: `grep -rn "fns/collab'" src` returns nothing; `postMessageFn` is defined once, in `collab-thread.ts`, calls `postTripMessage`, and that still mirrors then notifies; `message-composer.tsx` is gone; `trip.ts` no longer holds a collab loader; nothing under `src/server` imports from `src/routes`; the follow-up issue for the writers' authorisation gap exists and is cited in the PR body.
2. Phase 2: `collab-board.tsx` and `collab-dialogs.tsx` are gone; the screen is visually unchanged.
3. Phase 3: an owner or editor can switch each section off and on from the header menu; the screen shows exactly the visible sections; with only the conversation on it is full width; the last enabled section cannot be switched off (its item stays reachable by keyboard and says why); a viewer sees no menu and sees why sections are missing; another member's open screen follows without a reload, keeps any section holding their unsent work until it is sent or discarded, never loses focus to `<body>` and hears the change once; a section's rows are never deleted.
4. Phase 4: below `xl` the tab bar holds only the visible sections, sticks below the sub-navigation, labels never wrap or clip, its focus ring is visible, and exactly one panel is visible; at `xl` all visible panels are visible and the tab list is not.
5. `resolveCollabSections` never throws on any stored value and never resolves to "no section on"; every reader of the column goes through it.
6. A trip id from another workspace is a `NotFoundError` on the write and the foreign row is byte-identical afterwards.
7. 23 locales hold every new key (parity test); no console error or warning on the screen; no layout shift after paint.

## 📝 Risks & Impact Review

| Risk                                                                           | Mitigation                                                                                                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A call (the notification) lost while splitting `collab.ts`                     | Phase 1 asserts it in a test before the old module is deleted.                                                                                            |
| `forceMount` + responsive classes leave `role=tabpanel` panels visible at `xl` | Each panel keeps its own visible heading and `tabIndex={-1}`; the e2e journey asserts at 1280 that every visible panel is shown and the tab list is not.  |
| The sticky conversation panel stops sticking inside its new wrapper            | The sticky classes move onto the wrapper that is the grid item (Phase 4); browser-checked at 1280.                                                        |
| The setting is mistaken for an entitlement                                     | It is a per-trip preference; whether a workspace has collaboration is the plan-catalogue `collaboration` module key (`08-product-modules.md`), untouched. |
| The setting is mistaken for access control                                     | The glossary entry says it is a display choice; the data stays readable and writable elsewhere; no writer refuses because a section is off.               |
| Switching bumps `trips.updated_at` and moves the trip up the trip list         | Accepted: identical to every other trip column write.                                                                                                     |
| A stale tab triggers the last-section refusal and files a diagnostic           | Accepted: it needs a stale tab and the last section; the traveller sees the localised failure toast.                                                      |

### Out of scope

Each gap names where it goes:

- **Authorisation of the moved writers.** A trip `viewer` can post messages, notes and polls today: no collab writer checks a trip role. Further, the writers that act on a `noteId`, `pollId` or `messageId` (`updateCollabNote`, `deleteCollabNote`, `closePoll`, `deletePoll`, `castVote`, `editMessage`, `deleteMessage`, `toggleReaction` in `src/server/repos/collab.ts`) check the workspace only: neither that the row belongs to `data.tripId` nor that the caller can see that trip (ADR 0007), so a workspace member holding an id from a private trip can change or delete that row. Phase 1 moves these writers verbatim, which does not make it worse, and removes the unguarded duplicate `postMessageFn`. **Owner: a follow-up issue filed by the Phase 1 ticket** (acceptance criterion 1); no stage of plan 07 owns it today.
- The "What's next" section and its toggle: `07-S9`. The thread's paging and keys: `07-S3`. Notes categories and the notes board's per-board empty states and error `Alert`: `07-S4`. Poll deadlines and the polls board's empty state and error `Alert`: `07-S5`. (The plan's per-board empty-state copy and per-panel error `Alert` of this stage are re-owned by those three stages, plan 07 lines 812, 1016-1021 and 1197-1199.)
- The abbreviated-month formatting in the notes board (`07-S4`); any migration (none is needed).

## 📋 Phasing

| Phase | Slice                            | Visible | Blocked by |
| ----- | -------------------------------- | ------- | ---------- |
| 1     | The server split                 | no      | none       |
| 2     | The component split              | no      | 1          |
| 3     | Turn a section off               | yes     | 1, 2       |
| 4     | On a phone the sections are tabs | yes     | 3          |

Phase 3 may be cut into a server slice and a UI slice (above); with that cut the spec is five tickets, within the cap of eight.

## 📋 Implementation Plan

### Phase 1 - The server split

- [ ] Tests first (`collab-payloads.test.ts`), then `serialise.ts` moved, the three `collab-*.ts` modules (with `postTripMessage`), the moved loader, the duplicate-writer deletion, consumers repointed, `collab.ts` deleted, the follow-up issue filed.
- [ ] Grep: `fns/collab`, `loadTripCollab`, `postMessageFn`, `MessageComposer`, `CollabPayload`, `serialise`.

### Phase 2 - The component split

- [ ] Move boards and dialogs; update `index.ts`; delete the two old files.
- [ ] Grep: `collab-board`, `collab-dialogs`.

### Phase 3 - Turn a section off

- [ ] Server slice: tests first (vocabulary, repository, isolation), then `collab-sections.ts`, `setTripCollabSections`, `setCollabSectionFn`, the loader's `sections` / `canConfigure`, the schema docblock.
- [ ] UI slice: tests first (presentation map, menu, peers), then `sections.ts`, the menu, the screen's layout and `someHidden` line, draft retention, focus repair and announcement, copy in 23 locales, glossary.
- [ ] Grep: `collab_modules`, `collabModules`, `Sub-feature`, `Sub-features`.

### Phase 4 - On a phone the sections are tabs

- [ ] Tests first (`collab-tabs.test.tsx`), then `collab-tabs.tsx`, the sticky bar, the per-section skeletons, the one journey in `e2e/collaboration-and-sharing.spec.ts`.

## Verification

- Gate, in order: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`; plus `pnpm exec vitest run --project=tooling scripts/specs`.
- Migration: none. Confirm `git status` shows nothing under `drizzle/`.
- Browser evidence (the blind A/B pair, ADR 0016) at 360, 1280 and 2560 in both themes for the three compositions and the open menu; layout shift after the settle mark with a section toggled after the mark; console silent.
- `pnpm e2e` runs one journey (`07-S2`): as the demo owner, switch Polls off, reload, assert the polls panel is absent and, at 360px, the tab bar has two tabs and exactly one visible panel, then at 1280px that every visible panel is shown and the tab list is not; restore the setting in a `finally`. It stays because "the panel is hidden below `xl` by CSS alone" cannot be asserted below a real browser.
- Definition of done: `docs/SPEC.md` §7 unchanged; the grep `CODE_REVIEW.md` "Docs and CI" asks for, run on the final head.

## Resolved assumptions (autonomous defaults)

Each row is a departure from the plan's stage block, or a default this spec applied. Every one was put in front of the panel below (`afk-decide`); a row says who confirmed or amended it.

| #   | Question                                                                                         | Applied default                                                                                                                                                                                                                                                                                                         | Why                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Does the stage need the migration the plan filed to `00-S1`?                                     | No migration. `trips.collab_modules` already exists (migration `0006`) and nothing reads or writes it.                                                                                                                                                                                                                  | Verified at HEAD by the product owner and the architect (grep: the schema column only). No `pnpm db:generate`.                                                                                                                              |
| 2   | Whole-record write input, or one switch per call?                                                | One switch `{ tripId, section, on }` merged server-side; the whole resolved record is what is written. The Zod all-off refinement becomes a repository refusal.                                                                                                                                                         | Decided by the architect and security sub-agents (confidence high): a stale tab after a registry row is added cannot fail on a missing key, and the last-section rule holds because every landed record was validated whole.                |
| 3   | Register the fourth section ("What's next") here?                                                | No. Registry and schema are built so `07-S9` adds one row in `collab-sections.ts` and one entry in `sections.ts`.                                                                                                                                                                                                       | Decided by the product owner sub-agent (confidence high): a switch for a panel that renders nothing is placeholder copy; the plan assigns it to `07-S9`.                                                                                    |
| 4   | Which menu pattern, and what does the pending / last-on state do?                                | `DropdownMenuCheckboxItem`s under a visible-text "Choose sections" trigger; `aria-disabled` (never `disabled`) for the last-on item and for every item while a write is pending; spinner as an `aria-hidden` child; stays pending until the loader has the new record; the label says "Show for everyone on this trip". | Decided by the accessibility and UX sub-agents (confidence medium): Radix drops a `disabled` item from keyboard navigation, `ItemIndicator` renders only when checked, a bare "Sections" reads as navigation, and the choice is the trip's. |
| 5   | Keep the plan's visual spec and screenshot baselines?                                            | Struck (ADR 0016). Evidence is the blind A/B capture; one Playwright journey stays because CSS-only hiding below `xl` cannot be asserted below a real browser.                                                                                                                                                          | Decided by the architect sub-agent (confidence high) against ADR 0016 and `docs/SPEC.md` §7.                                                                                                                                                |
| 6   | Who may switch a section, and what does everyone else get?                                       | Trip `owner` / `editor`, not archived; guards in the order `requireWritableTrip` then `assertTripRole`. A foreign or private trip is `NotFoundError`; a workspace member not on an `organization` trip is `TripRoleError`.                                                                                              | Decided by the security and tenancy sub-agent (confidence high), who corrected the plan's `ForbiddenError` and the spec's first draft ("a non-member gets `NotFoundError`") against `readableTripFilter`. Tests cover both cases.           |
| 7   | What does the realtime patch carry?                                                              | A scalar `collabSectionsChangedAt` on the existing `trip` kind; peers re-read through the router invalidation `PresenceBar` already performs.                                                                                                                                                                           | Decided by the security and architect sub-agents (confidence high): plan 07-S1 says a commit frame is a signal, never a data channel; nothing leaks to peers.                                                                               |
| 8   | Animate the grid's track change (plan: 220 ms)?                                                  | No. A panel that appears below `xl` runs the tab primitive's own `animate-rise`; it is suppressed at `xl`.                                                                                                                                                                                                              | Decided by the accessibility sub-agent (confidence medium): a track change is a layout property the motion rules exclude; there is no separate "fade-in" class.                                                                             |
| 9   | Tabs below `xl`: how, and does the bar scroll away?                                              | `Tabs` with every panel `forceMount`ed and hidden by CSS, `tabIndex={-1}` panels, a padded `ScrollArea` for the focus ring, a bar that sticks below the sub-navigation; the page scrolls (plan: the panel body scrolls).                                                                                                | Decided by the accessibility, architect and UX sub-agents (confidence medium): no JS media query (`src/lib/breakpoints.ts`), no hydration branch; a long conversation must not strand the tab bar off screen.                               |
| 10  | Do writers refuse while a section is off?                                                        | No. Off is a display choice; data is kept and writers keep working; the glossary says it is not access control.                                                                                                                                                                                                         | Decided by the security and UX sub-agents (confidence high): a stale tab or a notification link must still land.                                                                                                                            |
| 11  | The plan's per-board empty-state copy, per-panel error `Alert` and descriptions?                 | Left out; re-owned by `07-S3`, `07-S4` and `07-S5`, which the plan already names for them. The route `ErrorPanel` stays.                                                                                                                                                                                                | Decided by the product owner sub-agent (confidence high): needs a partial loader this stage does not build, and each belongs to the stage that changes that board.                                                                          |
| 12  | Phase order, and how many tickets?                                                               | Phase 2 is blocked by Phase 1; Phase 3 may be cut into a server and a UI slice, five tickets in all.                                                                                                                                                                                                                    | Decided by the product owner and architect sub-agents (confidence high): Phase 2 repoints imports to modules Phase 1 creates.                                                                                                               |
| 13  | The writers' missing authorisation (a trip viewer can post; id-only writers check the workspace) | Out of scope. Phase 1's ticket files a follow-up issue and cites it; no stage of plan 07 owns it.                                                                                                                                                                                                                       | Decided by the security and product owner sub-agents (confidence high): moving the writers verbatim does not make it worse, and the only new writer is role-gated.                                                                          |
| 14  | "Module" or "section" in new identifiers; what is `modules.ts`?                                  | "Section" throughout (`collab-sections.ts`, `setTripCollabSections`, ...); the column `trips.collab_modules` keeps its name. The plan's `modules.ts` becomes a presentation-only `sections.ts`.                                                                                                                         | Decided by the product owner and architect sub-agents (confidence high): the glossary says avoid "module" (a **Product module**); one vocabulary and one presentation map, SPEC §8.                                                         |
| 15  | Where do the payload builders and row types live?                                                | In `src/server/fns/collab-*.ts`; `serialise.ts` moves to `src/server/serialise.ts`; the builders take the resolved `Trip`.                                                                                                                                                                                              | Decided by the architect and security sub-agents (confidence high): nothing under `src/server` imports `src/routes`; a bare-id reader would skip the visibility check.                                                                      |
| 16  | How is the notification asserted if Phase 1 is "verbatim"?                                       | `postMessageFn`'s handler is extracted into `postTripMessage(scope, data)`, the one non-verbatim change; mirror, then notify.                                                                                                                                                                                           | Decided by the architect and product owner sub-agents (confidence high): there is no plain core to drive at HEAD.                                                                                                                           |
| 17  | What does a stale tab see when it turns off the last section?                                    | A `CollabSectionsError` outside `AUTHORED_ERROR_NAMES`, so the localised failure toast speaks, not an English server sentence.                                                                                                                                                                                          | Decided by the UX sub-agent (confidence medium): `classifyFailure` passes Zod-shaped and authored messages through; `docs/SPEC.md` §9 forbids English in 22 locales.                                                                        |
| 18  | A peer switches off a section the traveller is writing in.                                       | The section stays until the draft is sent or discarded, with the `turnedOff` line; otherwise focus is repaired and the change announced once.                                                                                                                                                                           | Decided by the UX (blocker) and accessibility sub-agents (confidence medium): lost typed work and focus dropped to `<body>` are not acceptable side effects of someone else's action.                                                       |
| 19  | What does a stored record with no known section on resolve to?                                   | Every registry default.                                                                                                                                                                                                                                                                                                 | Decided by the security sub-agent (confidence high): a rolled-back newer Worker could leave such a record, and the screen would have nothing to show.                                                                                       |

## Panel verdicts

Round 1 (against the first draft). All five answered **approve with conditions**; every condition above was applied in the commit that follows them.

| Specialist                    | Verdict                                            | Confidence | Conditions applied                                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product owner                 | approve with conditions                            | high       | Phase 2 blocked by 1; `modules.ts` defined and the vocabulary one owner; glossary term in identifiers; `TripRoleError` case; `postTripMessage` seam; owners for the gaps.          |
| Software architect            | approve with conditions                            | high       | `serialise.ts` move and builder signatures; Phase 2 blocked by 1; `postTripMessage`; `sections.ts`; `TripRoleError` case; Phase 3 cut; `TabsContent` overrides; owner for the gap. |
| Security and tenancy reviewer | approve with conditions (approves once written in) | high       | non-member split; whole-record write; no-known-section fallback; builders take the `Trip`; widened out-of-scope with an owner; glossary: not access control.                       |
| Accessibility specialist      | approve with conditions                            | medium     | `aria-disabled` last-on item; spinner mechanism; focus repair and announcement; ring padding; `tabIndex={-1}`, e2e at 1280; one entrance animation.                                |
| UX specialist (traveller)     | approve with conditions                            | medium     | draft retention; localised refusal; scope-honest label; verb trigger; pending until refreshed; `someHidden` line; sticky tab bar; failure body.                                    |

Round 2: (filled in after the second round)
