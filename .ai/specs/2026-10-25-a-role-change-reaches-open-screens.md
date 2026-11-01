# A role change reaches the trip screens a person has open

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #1092 |
| **Spec PR**        | #1615 |
| **Implementation** | none  |

## 📝 TLDR

A trip member whose role changes (promotion, demotion), who is removed from the trip, or whose trip is archived or
restored should see their open trip screens follow, without a reload and without having to attempt a write that fails.

The brief of #1092 assumes the room never hears about a role change and proposes a new "role message". **That premise is
out of date.** Since #1076 (#1050) `setTripRoleFn`, `addTripMemberFn`, `removeTripMemberFn`, `leaveTripFn` and the
archive, restore and visibility writes already close the affected sockets of the trip room with a fixed close (code
`1012`, reason `Room closed`), and the browser hook already answers that close by re-reading the screen's loaders. What is
missing is only the **listener**: `useTripRoom` is mounted by `PresenceBar`, and `PresenceBar` by the collaboration screen
alone. On Plan, Costs, Book, Files, Transports, Lists and People nobody is listening, so the close arrives nowhere.

**Decision: mount a close-only listener in the trip layout. No new message, no server change, no role on the wire.** The
layout opens the existing socket and never sends `hello`, so the room does not count it as present and sends it no commit
or presence frame; it still receives every `Room closed` close. A close, or a reconnect after a gap, makes the tab
re-read its loaders, which are the only thing that decides what a screen shows. The write forms that outlive a revoked
permission close with a message that says nothing was saved (the planner already closes them; it says nothing when no
write failed first).

Cut into **three tickets**: **1** the listener in the layout and the planner's message, **2** the costs and files screens,
**3** the remaining write screens (lists, transports, book, people, collaboration).

## 📝 Problem Statement

### What happens today

| Question                                           | Answer at `HEAD`                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where does a screen get its write permission?      | From its own loader: `editable` on the planner (`canWritePlan(trip, role)` in `-server/plan.ts`), `canWrite` on notes, files, transports and book, `canConfigure` on collaboration, owner status on people and costs. The layout loader (`loadTripHeader`) carries no reader-role flag.                |
| Does a role change reach the room?                 | Yes. `setTripRoleFn` (only when the role actually changed), `addTripMemberFn`, `removeTripMemberFn` and `leaveTripFn` call `evictFromRoom` (`-server/people.ts`) → `closeRoomFor` (`src/server/fns/context.ts`) → `closeTripRoomFor`. Archive, restore and a narrowing of visibility call `closeRoom`. |
| What does the room do with it?                     | Closes that person's sockets (every tab and device) with `1012` / `Room closed`, and records a per-person revocation watermark so a connect minted before the close is refused (`TripRoom.handleClose`, `isRevoked`). It closes a socket older than 15 minutes at its next five-minute alarm.          |
| What does the browser do with the close?           | `useTripRoom` `onClose` calls `onCommit` (a router invalidation) when the reason is `Room closed`, and `partysocket` reconnects through `serveTripRoom`, which resolves the stored role again.                                                                                                         |
| Who runs that hook?                                | Only `PresenceBar`, which only `collab.tsx` renders, after hydration. Every other trip screen holds no socket.                                                                                                                                                                                         |
| What does a viewer promoted to editor see on Plan? | Nothing until a reload or a navigation that re-runs the loader. No write fails, so the refusal-triggered re-read (#1030, #1067) never runs.                                                                                                                                                            |
| What does a demoted editor see?                    | Write controls until the first refused write, which re-reads the loader (#1030, #1067). The planner then closes its open form, and shows the refusal as a toast only when the closed form carried one.                                                                                                 |
| Can a stale tab write?                             | No. Every D1 write re-checks (`requireWritableTrip`, `assertTripRole`). The problem is a stale screen, not an authorization hole.                                                                                                                                                                      |

### Premises of the brief checked and corrected

1. **"`setTripRoleFn` sends no signal into the trip room."** Wrong at `HEAD`; see above. The signal is the close, and it
   already covers promotion, demotion, removal, archive and restore. A new `role` message would add a data-bearing frame
   to carry what a close already carries for free (the fact that something changed), and the screen would still have to
   re-read its loader to learn the rest.
2. **"The room listener is mounted on the collaboration screen only."** Correct, and it is the whole defect.
3. **"#1050 covers the socket side only."** Correct, and sufficient: this spec is the client side that #1050 left.
4. **"A viewer promoted to editor sees no write controls until a reload."** Correct on every screen except collaboration,
   which already re-reads on the close.
5. **Found while checking:** `serveTripRoom` admits a person removed from a trip that the whole workspace can read, as a
   viewer (it refuses only a person who may no longer read the trip). The listener must handle both outcomes.

### Who has the problem

A workspace owner who promotes a colleague and is told "I still can't edit"; an editor who has been demoted and keeps
clicking controls that will be refused; a person removed from a private trip who keeps reading it until they act.

## 📝 Proposed Solution

### The trigger

A new client module, **`TripAccessListener`** (owner: `src/components/modules/collab/`, next to `PresenceBar` and
`useTripRoom`), renders nothing. It is mounted by the trip layout (`src/routes/_app/trips/$tripId/route.tsx`) from an
effect after hydration, exactly as `collab.tsx` mounts `PresenceBar` today, and it calls `useTripRoom` with a new option,
**`listenOnly`**.

`listenOnly` changes two things in the hook and nothing on the server:

- **The socket never sends `hello`.** In the room a socket is "joined" only after `hello` (`handleHello`); presence lists,
  `welcome`, `presence` and `commit` broadcasts all skip an unjoined socket (`presence()`, `broadcast()`), while an
  eviction, a revocation and the age-based close apply to every socket regardless (`evict()`, `alarm()`). So a
  listen-only socket is invisible to the other people on the trip, receives no frame of any trip data, and still hears
  every `Room closed`.
- **A reconnect re-reads.** The hook keeps a `stale` flag: set when the socket closes or errors, cleared when it asks the
  screen to re-read. A close with the `Room closed` reason asks at once (as today). A close for any other reason, which
  is how a dropped network looks, asks on the next successful `open`. One gap therefore costs one re-read, never two. This
  closes the case the close cannot: the role changed while the tab had no socket, so the close found nobody, and the
  reconnect reads the new role at the door but the page does not. The rule applies to the joined (collaboration) hook as
  well, for the same reason; it adds a re-read per reconnect there.

The listener's `onCommit` is `router.invalidate()`. Every active loader under the trip layout re-runs
(`loadTripHeader` and the screen's own), nothing is built from a frame, and D1 stays the truth.

### What each case does

| Case                                                           | Server today (unchanged)                                                 | What the open screen does after this spec                                                                                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Promotion** (viewer → editor, editor → owner)                | `closeRoomFor`; reconnect resolves the new role                          | Loaders re-run, `editable` / `canWrite` / owner controls appear. No form was open, so nothing else happens.                                                                                                         |
| **Demotion** (owner → editor → viewer)                         | Same                                                                     | Controls disappear; a form that is open when the flag flips closes with the message below; focus moves as the planner does today.                                                                                   |
| **Removed from a trip the workspace can read**                 | `closeRoomFor`; reconnect succeeds as `viewer`                           | The person stays on a read-only screen; the People list no longer lists them.                                                                                                                                       |
| **Removed from a private trip** (or the trip left their reach) | `closeRoomFor`; the reconnect gets `404`                                 | The re-read finds no trip, the layout's `notFoundComponent` replaces the screen and unmounts the listener, which ends its retries. The listener's own `404` retries before that are harmless and bounded.           |
| **Trip archived** (every role becomes read-only)               | `closeRoom` (all sockets)                                                | `canWritePlan` is false for everyone: the same as a demotion, with the same message.                                                                                                                                |
| **Trip restored**                                              | `closeRoom`                                                              | The write flags return for owners and editors: the same as a promotion.                                                                                                                                             |
| **Person leaves the workspace**                                | `trip-room-evict` queue job closes their sockets in every reachable room | The re-read fails the shell's workspace check; the existing error and redirect handling of the shell applies. The listener adds no behaviour.                                                                       |
| **Socket dropped when the change happened**                    | The close finds no socket                                                | The reconnect (the next `open`) re-reads, so the screen follows within seconds of the network returning.                                                                                                            |
| **Room unreachable when the change was written**               | `evictQuietly` logs and swallows; the write succeeds                     | The socket stays open with the old role until it reaches the 15-minute age at the next alarm (about 20 minutes at most), when the room closes it with the same reason and the screen re-reads. Stated limit, below. |
| **A tab whose workspace changed in another tab**               | The door answers `4001` / `Workspace changed`                            | The listener stops retrying, as the hook does for `PresenceBar`.                                                                                                                                                    |

### An open form when permission is revoked

The planner already decides this (#1067): when a re-read takes `editable` away, a form that is open closes, a pin being
placed is cancelled, focus goes to the itinerary, and a refusal the form was showing becomes a toast. When the
re-read was started by the listener there is no refusal, so the planner closes the form **without saying why**. This
spec closes that hole and fixes one rule for every write screen:

> If a write flag flips from true to false while a form is open, the form closes, the submit never fires, and a toast says
> `trips.access.writeLost.title` / `.body`: the reader can no longer edit and nothing in the form was saved. A refusal the
> form was already showing replaces the generic body.

The close does not name a cause, and the toast does not guess one ("your role changed or the trip was archived"). Keeping
the typed text across the revocation was considered and rejected below.

### What the push exposes

Nothing new. The frame is a WebSocket close with a fixed code and a fixed reason; it carries no role, no user id, no
trip id, no list of members. A reader never learns another member's role from it, and it does not even carry the
recipient's own role: the recipient learns that from a loader that already returns it to them. The listener, being
unjoined, receives no presence, commit or welcome frame, so it sees nothing a screen without it would not see. It does not
appear in the presence list other people see. The door is the existing one: `/api/trip-room/:tripId` with the session, the
workspace claim and the readable-trip check; anyone who can read a trip can already open this socket by hand, and the
listener grants nothing they could not do. Server logs on this path carry ids only.

### Alternatives considered

| Option                                                        | Why not                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B.** A `role` frame into the room, carrying the new role    | A data-bearing frame to secure, a protocol addition that lives on in deployed tabs, and it would still need the layout to subscribe. The close already says "re-read", and the loader already says the rest.                                                                 |
| **C.** Refetch on window focus / `visibilitychange`           | Fires only when the tab regains focus: a tab left in front of the person is never updated, which is the case this spec exists for. Adds a read per focus on every trip screen. A resumed mobile tab is covered by the reconnect rule anyway.                                 |
| **D.** A bounded poll of the trip header                      | Steady D1 load for every open tab, latency equal to the interval, and a poll needs a budget and a "check again" (as `import-jobs.ts` has) because it must stop. The room pushes already.                                                                                     |
| **E.** A combination of A with C                              | The only gap C would fill is a close the room never received. That is the age-bounded case (about 20 minutes) that already has a stated backstop; a focus read for it costs every focus.                                                                                     |
| **F.** Do less: only record that collaboration is covered     | Leaves Plan, Costs, Book, Files, Transports, Lists and People deaf, which is the issue.                                                                                                                                                                                      |
| Keep a revoked form open with its text, submit disabled       | Needs draft persistence in about ten forms, each with its own state, and a banner inside each dialog. The planner closes its form today; a message that says nothing was saved removes the silence. Revisit if a form turns out to hold long text (notes).                   |
| A global banner on every role change                          | The close names no cause and the layout holds no reader role, so the banner would be a guess. A reader-role flag in `loadTripHeader` is the recipient's own role and would be allowed; it is a follow-up for announcing a gain to screen readers, not part of these tickets. |
| One shared socket for the layout and the collaboration screen | That is plan stage `07-S1` (`TripRoomProvider` in the layout, `PresenceBar` as a consumer, coalesced invalidations). It is not specified yet and this spec does not wait for it. When it lands, its connection receives the same close and `TripAccessListener` is deleted.  |

### Limits, stated

- **The close is best effort.** The bound on a lost close is the room's age close: 15 minutes plus up to one five-minute
  alarm, as `canWritePlan`'s docblock already states. After eight failed reconnects the hook goes offline and the listener
  stops; the next navigation (which re-runs the loaders), or the first refused write (#1030, #1067), re-reads.
- **One more hibernating socket per open trip tab on every trip screen** (today: collaboration only). On the
  collaboration screen the tab holds two (the listener's and `PresenceBar`'s) and a close makes both re-read; the two
  reads are not coalesced across hooks. The 25-second keepalive ping applies to the listener. The first ticket measures
  the request count a day of an idle tab adds in the local worker before the cost is called acceptable; it is not
  verified here.
- **A tab that is closed to a trip it cannot read shows not-found, and what was typed in it is gone.** There is nothing
  to save it to.
- **Passing time does not re-read.** The age close re-reads every open trip tab's active loaders about every 15 to
  20 minutes while the socket lives; that is a D1 read per tab per quarter hour, accepted.

## 📝 Architecture

- Owner of the listener: `src/components/modules/collab/` (`trip-access-listener.tsx`, new; `use-trip-room.ts`, the
  `listenOnly` option and the `stale` rule). The layout only mounts it. `components/ui` is untouched; the listener
  fetches nothing (it calls `router.invalidate()`), imports nothing from `src/server` except the protocol constants the
  hook already imports.
- No server change, no protocol change (`src/server/do/protocol.ts`, `tripRoomIdentitySchema` and `TripRoom` are
  untouched), no migration, no server-function input, no new endpoint. Nothing here widens a schema, so the "optional
  fields only" rule of `BACKWARD_COMPATIBILITY.md` is not engaged; a tab from before the deploy simply has no listener.
- The planner's lost-write handling (`plan-screen.tsx`) is the model. Ticket 2 extracts it into a hook once a second
  screen needs it (`-ui/use-write-access-lost.ts`, owner: the trip route's `-ui` directory), because extracting from one
  consumer would be a guess.

## 📝 Visual change expected

Backend-visible nothing; on screen one thing: the toast `trips.access.writeLost` when a form is closed by a revoked
permission (sonner, the toast the planner already uses), in light and dark, on desktop and mobile. The write controls
appearing or disappearing is the existing rendering of the loader's flags. No new screen, no new component with markup:
`TripAccessListener` renders `null`.

## 📝 Copy

Lands in `src/lib/i18n/messages/<locale>/trips.ts` for all 23 locales (procedure: the `i18n-messages` skill).

| Key                            | `en`                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `trips.access.writeLost.title` | `You can't edit this trip any more`                                                                          |
| `trips.access.writeLost.body`  | `Your role changed or the trip was archived. The form you had open was closed, and nothing in it was saved.` |

## ✅ Acceptance criteria

This spec (the issue's list):

- [x] A spec is merged under `.ai/specs/` with `Status` `ready` and its `Issue` row naming #1092 (the merge is the spec PR's).
- [x] It decides the trigger (a close-only listener in the layout) and records the rejected alternatives (B to F, drafts,
      banner, shared socket).
- [x] It covers promotion, demotion, removal from the trip and archiving, and says what an open write dialog does.
- [x] It states what the push exposes (a fixed close; no role, no member).
- [x] It slices into tickets, each an SLC slice.

The tickets (every one):

- [ ] The listener sends no `hello`, so the presence list another person sees is unchanged by it (room handler test).
- [ ] It opens only the existing door and stops on the workspace-changed close (hook test; the door's own cases in
      `connect.test.ts` for another workspace and a mismatching claim are cited, not rewritten).
- [ ] Promotion, demotion, removal from a private trip, removal from a readable trip, archive and restore each show the
      right screen after the re-read (screen tests drive the loader's data, not a socket frame).
- [ ] A form open when the flag flips closes, its submit does not fire, the toast is shown once and focus does not fall to
      `body`.
- [ ] The server still checks every write; no server test changes.
- [ ] Every new string is in all 23 locales; no hardcoded copy.

## 📝 Risks and impact review

| Risk                                                                        | Where                  | Mitigation                                                                                                                                                      |
| --------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An unjoined socket is later made to receive a frame (a broadcast change)    | `TripRoom.broadcast`   | A room handler test pins "an unjoined socket receives no broadcast and is absent from presence"; a future change that breaks it fails there, not in production. |
| A reconnect loop re-reads without end                                       | `useTripRoom`          | The `stale` flag clears when a re-read is asked; one gap asks once. Hook test: close, open, open again with no close in between asks once.                      |
| The listener keeps retrying against a trip it can no longer reach           | `useTripRoom`          | The layout's not-found replaces the screen and unmounts it; the retry limit (eight) ends it otherwise.                                                          |
| Cost: one more socket per open trip tab                                     | Durable Object billing | Measured in ticket 1 before it merges; reversible by unmounting one component.                                                                                  |
| A second reader of the close double-invalidates on the collaboration screen | `collab.tsx`           | Accepted; deleted with the listener when `07-S1` lands.                                                                                                         |
| A screen whose flag flips with a form open and no handling                  | Tickets 2 and 3        | Each ticket lists its forms and carries a test per form; until then the stale-tab behaviour is today's (the server refuses, the refusal re-reads).              |

### Out of scope

- Implementing the room-side change (there is none), the refusal-triggered re-read (#1030, #1067), closing sockets on a
  role change (#1050, #1076).
- Announcing a gain of write permission to a screen reader, and a reader-role flag in `loadTripHeader`.
- Preserving a revoked form's text.
- The shared per-trip connection of plan stage `07-S1`.
- A focus or visibility refetch, and any poll.

## 📋 Phasing

Ticket 1 is useful alone: promotion becomes visible everywhere, and the planner (the busiest write screen) behaves fully.
Tickets 2 and 3 only make other screens close their open forms the way the planner does; until they ship, those screens
behave as they do after any re-read today (the server refuses a stale write and the refusal re-reads). Order: 1, then 2
and 3 in any order.

## 📋 Implementation plan

Each ticket is claimed only after the security and tenancy specialist gives it an approving verdict on its own diff
brief, because this area is `risk-high`; this spec's verdict covers the design, not the tickets.

### Ticket 1 - The listener in the trip layout, and the planner's message

- `use-trip-room.ts`: the `listenOnly` option (no `hello`), the `stale` rule (re-read on the next `open` after a close or
  error that did not already ask), the header comment updated (it says the hook is mounted by `PresenceBar` only).
- `trip-access-listener.tsx` (new): renders `null`, calls `useTripRoom(tripId, { listenOnly: true, onCommit: invalidate })`;
  exported from `collab/index.ts`. `presence-bar.tsx`'s header ("the only component that opens the realtime socket") is
  corrected.
- `route.tsx`: mount it after hydration (the `live` pattern of `collab.tsx`), keyed by `trip.id`.
- `plan-screen.tsx`: when a re-read takes `editable` away and the closed form carried no refusal, toast
  `trips.access.writeLost`; the `canWritePlan` docblock in `src/server/repos/trips.ts` gains a sentence saying who now
  listens.
- Copy: the two keys, 23 locales.
- Tests first, at three seams. **Hook** (`use-trip-room.test.ts`): `listenOnly` sends no `hello` on open; a `Room closed`
  close asks once; a close with another reason asks on the next open, not before; an open with no preceding close does not
  ask; the workspace-changed close stops retries. **Room handler** (`trip-room.test.ts`): an unjoined socket is absent
  from `presence()` and from the `welcome` of a joined one, receives no `commit` or `presence` broadcast, and is closed by
  `closeTripRoomFor`, `closeTripRoom` and the alarm's age close. **Screens** (`ui` project, jsdom): the planner with
  `editable` flipping false shows the toast once, closes the form and keeps focus inside the page; flipping true shows the
  controls. `vi.mock` the `cloudflare:workers` chains the way neighbouring suites do.
- Measure and record in the PR body the requests an idle tab adds in a day against the local worker; if the figure is
  not acceptable, stop and file a follow-up for `07-S1` instead of merging.

### Ticket 2 - The costs and files screens

- Extract the planner's lost-write handling into `-ui/use-write-access-lost.ts` (the planner becomes its first consumer,
  behaviour pinned by the existing tests), and adopt it on the costs screen (expense, payment and budget dialogs, the
  currency change) and the files screen (upload and rename).
- Tests: per form, the flag flips with the form open: it closes, the toast shows, no write is sent.

### Ticket 3 - Lists, transports, book, people and collaboration

- Adopt the hook on the remaining write surfaces (lists and items, the transport dialog and its `writeBlocked`, the
  booking import dialog, the people dialogs that already close on an owner loss, the collaboration composers and note
  dialogs), auditing each for a form that survives a flip. People already closes its owner-only dialogs when a refusal
  costs the owner role; it adopts the generic message for the flip the listener causes.
- Tests: one per form, as in ticket 2.

## Verification

Per ticket: `pnpm typecheck && pnpm lint && pnpm test` (per vitest project), the gate in `.ai/agentic.config.json` and
`bash .ai/scripts/check-generated.sh`. Ticket 1 also drives promotion and demotion in the browser against two sessions of
the demo workspace (a restarted dev server, `sh .ai/scripts/test-env-up.sh --force`) and records both in the PR.

## Human decides

1. **A revoked form closes and says nothing was saved; its text is not kept.** The verdict asked that the text not be
   discarded silently, and this spec reads that as "discarded with a message", which is what the planner does today.
   If the text must survive, tickets 2 and 3 grow a draft store and this spec needs an amendment first.
2. **The reconnect re-read** (the `stale` rule) is an addition of this spec to the specialist's design, which allowed a
   close-only listener and nothing else. It sends no frame and changes no server code, and ticket 1 carries it for its own
   verdict. Overturn it and a role changed during a network gap shows only after the next navigation.
3. **Two sockets on the collaboration screen** until `07-S1` lands.

## Resolved assumptions

| #   | Question                                                              | Applied default                                                                                                                                                         | Why                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | May an unattended run claim #1092 (`risk-high`) and write the design? | Yes, as a design-only spec; every implementing ticket needs its own approving verdict before it is claimed and a verdict on its diff before merge.                      | Decided by security and tenancy specialist sub-agent (confidence high): the spec changes no code; the brief carried no verdict, so one was obtained before claiming.                                                                  |
| 2   | How does a role change reach every open screen?                       | A listener in the trip layout that opens the existing socket without `hello` and re-reads on the existing `Room closed` close. No new frame; no focus refetch; no poll. | Decided by security and tenancy specialist sub-agent (confidence high): the room sends no frame to an unjoined socket but closes it with the rest, so no wire change is needed, and a data-bearing frame would stay in deployed tabs. |
| 3   | Does the spec add a `role` message?                                   | No.                                                                                                                                                                     | Same sub-agent: the brief's premise that no signal exists is out of date; the close is the signal and it carries nothing.                                                                                                             |
| 4   | What does an open write form do when its permission is revoked?       | It closes, the submit never fires, a toast says nothing was saved.                                                                                                      | The specialist's condition 5 (no submit, no silent loss), applied through the planner's existing behaviour (#1067); the reading of "silent" is flagged under Human decides 1.                                                         |
| 5   | Does a reconnect re-read?                                             | Yes, once per gap.                                                                                                                                                      | Spec author, within the specialist's condition that a frame is a signal only: otherwise a role changed while the socket was down is applied at the door and not on the page. Flagged under Human decides 2.                           |
| 6   | Does the collaboration screen share the layout's socket?              | No, two sockets until `07-S1`.                                                                                                                                          | Same sub-agent left the choice to the spec; sharing is `07-S1`'s provider, unspecified today, and a second socket is reversible by deleting one component.                                                                            |
