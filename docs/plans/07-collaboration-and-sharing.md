# 07 — Collaboration and sharing

## Area brief

Eleven rows, and the one this repository's realtime substrate has been waiting for. The per-trip
Durable Object is finished, hibernating and correct; exactly one component in the product mounts it.
This plan turns that substrate into a trip-wide subscription, splits the collaboration surface along
its own sub-feature seams so the remaining nine rows can be built without colliding, and adds the
only two unauthenticated surfaces in the product.

#### What is on disk today, measured at HEAD

- **The room is complete.** `src/server/do/trip-room.ts` is one SQLite-backed Durable Object per
  trip on the WebSocket Hibernation API, with `acceptWebSocket` at `:238`, a ping/pong auto-response
  installed at `:180-181`, a rate-limit close at `:751`, an alarm at `:420` and an idle
  `deleteAll()` at `:430`. `src/server/do/trip-room-client.ts:33` states the addressing rule in one
  line — one object per trip, the trip id is the shard key — and `src/server/do/protocol.ts` is the
  isomorphic Zod contract both ends validate against.
- **One component subscribes.** `grep -rn useTripRoom src/` returns the definition, the barrel
  re-export at `src/components/modules/collab/index.ts:8`, and a single call site:
  `src/components/modules/collab/presence-bar.tsx:82`. `PresenceBar` is mounted only by
  `src/routes/_app/trips/$tripId/collab.tsx`, and only after hydration. Every other tab of the trip
  workspace — Plan, Transports, Book, Lists, Costs, Files — is deaf.
- **Two declared entity kinds have no producer.** `TRIP_ENTITY_KINDS` declares nine; a census of the
  mirror helpers (`grep -rhoE "patch\('[a-z-]+'|tombstone\('[a-z-]+'" src/`) finds `trip` 18,
  `route` 3, `packing-item` 3, `reservation` 3, `expense` 2, `note` 2 and their tombstones — and
  **zero** for `day` and `stop`. The reason is `src/routes/_app/trips/$tripId/-server/plan.ts`: it
  holds all eight planner writers and calls `mirrorToRoom` nowhere, so the busiest collaborative
  screen in the product is the one screen whose changes never reach a peer.
- **The write path is otherwise wired.** `mirrorToRoom` (`src/server/fns/context.ts`) is called 13
  times from `src/server/fns/collab.ts`, 11 from `lists.ts`, 5 each from `costs.ts`,
  `reservations.ts` and `transports.ts`, and 4 from `files.ts`.
- **Sharing exists as data and nothing else.** `share_links` (`src/server/db/schema.ts:1028-1051`)
  carries a globally unique `token`, a `ShareScopes` JSON payload (`:253-261`), a view counter and a
  revocation instant; `src/server/repos/trips.ts:476-518` implements list, create, revoke and touch,
  and `:503-507` already records the rule the public route will need — a public visitor has no
  tenant context, so the caller resolves the link first and builds a scope from the row's own
  organization. Nothing calls any of the four, and `src/routes/` has no public trip surface at all.
- **The collaboration screen is one file per concern too few.** `collab-board.tsx` (598 lines) holds
  the notes board and the polls board; `collab-dialogs.tsx` (454) holds both their dialogs;
  `src/server/fns/collab.ts` (278) holds all three write paths; and the loader,
  `loadTripCollab`, sits inside the 25.6 KB `src/routes/_app/-server/trip.ts` that every trip tab
  shares. Four of this plan's stages change one sub-feature each, and three of them would land in
  the same wave.

#### The rows this plan closes

| Row      | Status now                       | Stage    | Wave the stage runs in       |
| -------- | -------------------------------- | -------- | ---------------------------- |
| `COL-01` | partial                          | `07-S1`  | 1                            |
| `COL-02` | partial                          | `07-S2`  | 1                            |
| `COL-03` | partial                          | `07-S3`  | 2                            |
| `COL-07` | partial                          | `07-S4`  | 2 (one behaviour to `07-S8`) |
| `COL-08` | partial                          | `07-S5`  | 2                            |
| `COL-10` | absent                           | `07-S6`  | 2                            |
| `COL-04` | partial                          | `07-S7`  | 3                            |
| `COL-06` | recorded done, **measured open** | `07-S7`  | 3                            |
| `COL-09` | absent                           | `07-S9`  | 3                            |
| `COL-05` | absent                           | `07-S8`  | 4 (earliest 3 — see below)   |
| `COL-11` | absent                           | `07-S10` | 5                            |

Every row is closed by exactly one stage, and no row is deferred out of this plan. The table above
is the authority for that mapping, because a row id appears in more than one stage's **Reference
rows** and the two uses must not be confused: a stage **closes** a row only where it writes the row
id followed by a status arrow — `` `COL-05` absent → **done** `` — and every other mention is a
cross-reference naming the stage that does. Exactly two rows are mentioned in a **Reference rows**
section that is not their own, and both mentions exist to stop a reader assuming the work happens
where they are reading it:
`COL-05` is named by `07-S4`, which defers one behaviour to `07-S8` and says so, and `COL-06` is
named by `07-S1`, which used to hold it, and by `07-S3`, which is written against a reader `07-S7`
later changes.

#### `COL-06` is recorded **done** in the matrix and is not done, with the greps that refute it

The matrix's evidence for `COL-06` reads "…and `tombstone()` in `src/server/fns/context.ts`
mirroring it into the room so other connected members see the replacement immediately". `README.md`
requires a plan that contradicts a row to say so and show its own measurement, so here it is, four
greps at HEAD:

- **No `tombstone()` is mirrored for a message.** `deleteMessageFn`
  (`src/server/fns/collab.ts:114-125`) mirrors `patch('trip', data.tripId, { chatChangedAt: … })`.
  A census of every mirror helper in the tree — `grep -rhoE "patch\('[a-z-]+'|tombstone\('[a-z-]+'" src/` —
  returns `trip` 18, `route` 3, `reservation` 3, `packing-item` 3, `note` 2, `expense` 2 and one
  tombstone each for `route`, `reservation`, `packing-item`, `note` and `expense`. There is no
  message kind in `TRIP_ENTITY_KINDS` (`src/server/do/protocol.ts:50-60`) and no
  `tombstone('message'…)` anywhere.
- **Nothing can render a tombstone, because the reader hides the row.** `listMessages`
  (`src/server/repos/collab.ts:123-133`) filters `isNull(collabMessages.deletedAt)`, and its own
  doc comment at `:122` says so: "Soft-deleted messages are excluded." A deleted message vanishes
  from the transcript on the next read.
- **There is no deleter.** `collab_messages` (`src/server/db/schema.ts:1057-1082`) has `deleted_at`
  and no deleter column; `grep -rn deletedBy src/` returns nothing. `deleteMessage`
  (`src/server/repos/collab.ts:167-176`) writes `deletedAt` alone, and it permits a workspace
  `owner`/`admin` to delete somebody else's message, so the deleter is genuinely not derivable from
  the row.
- **There is no tombstone rendering.** `grep -n deleted src/components/modules/collab/thread.tsx`
  returns two toast strings at `:158-159` and nothing else.

So the one thing `COL-06` names — a visible tombstone naming the deleter and the time, shown to
everyone — exists in no layer. What is true is the half the matrix inferred from: the delete is
soft, and it does reach peers, as a `trip` signal that makes their loaders re-read. That is the
correct wire shape under the contract `07-S1` fixes and it is not changed. The row is therefore
carried as **recorded done, measured open → done** by `07-S7`, the stage that owns the message row,
and `07-S3` is written without assuming a tombstone it would have had nothing to render.

Two schedules differ from the mechanical wave in `README.md`, and both are stated rather than left
to be noticed:

- **`07-S8` runs in wave 4 although `COL-05`'s edges allow wave 3.** It and `07-S7` both change the
  rendered message row, and two stages in one wave may not name one file. Its dependency
  (`COL-05 → COL-03`, wave 2) is satisfied either way, so the later wave costs nothing but a run.
- **`07-S4` closes `COL-07` with one named deferral.** The website field's preview thumbnail is the
  same outbound fetch `COL-05` is about; building it twice would be a defect. `07-S4` ships the
  website field as a scheme-checked link chip and `07-S8` attaches the preview to it, changing no
  note surface.

Edges into other plans. Three of the four supplying plans exist on disk and their stage ids are
read out of them, not described:

| This stage | Needs                                               | Supplied by                                                   |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `07-S6`    | `MNY-07` — the frozen-rate columns on money rows    | `04-budget-and-currencies.md`, stage `04-S1`, wave 1          |
| `07-S9`    | `TRP-08` — the merged day timeline and its ordering | `01-trips-core.md`, stage `01-S4`, wave 2                     |
| `07-S10`   | `TRP-11` — trip membership, roles and removal       | `01-trips-core.md`, stage `01-S6`, wave 4                     |
| `07-S4`    | `DOC-01` — a file record and its upload path        | `06-documents-and-media.md` — **the file does not yet exist** |

Each of the three is a stage id read off the sibling file, not a paraphrase: `04-S1` names `MNY-07`
in its **Reference rows** and runs in wave 1, `01-S4` names `TRP-08` and runs in wave 2, `01-S6`
names `TRP-11` and runs in wave 4. Each stage below repeats its own edge with the same stage id
under **Blockers**, so a reader who opens one stage does not have to come back here for it.

`DOC-01` is the one edge that cannot be given a stage id today, and the reason is a measurement
rather than a convention: `ls docs/plans` returns eight plan files — `00`, `01`, `04`, `07`, `09`,
`10`, `11`, `12` — and `06-documents-and-media.md` is not among them, so `DOC-01` has no stage to
name yet.
`gap-rows.json` puts `DOC-01` in wave 1, which is what `07-S4` schedules against. When that plan is
written, the stage that closes `DOC-01` is filled in here and in `07-S4`'s **Blockers**; until then
`07-S4` waits on the row rather than inventing an upload path of its own, which is what its
**Blockers** section already says.

#### The sub-feature seam, and why `07-S2` cuts it

`COL-02` is recorded as an **S** and this plan sizes its stage at **M**. The extra work is a file
split, and it is not tidying: the collaboration surface has four sub-features and three of this
plan's wave-2 stages change exactly one each. With the boards in one module, the dialogs in one
module, the write path in one module and the loader inside a file every trip tab shares, those three
stages would all name the same four files in one wave, which `README.md` forbids outright. `07-S2`
is the row about composing four independently toggleable sub-features, so it is the stage that makes
the file layout follow the same boundary:

| Sub-feature  | Board                    | Dialog             | Reader and writer                 |
| ------------ | ------------------------ | ------------------ | --------------------------------- |
| Conversation | `thread.tsx` (unchanged) | composer is inline | `src/server/fns/collab-thread.ts` |
| Notes        | `notes-board.tsx`        | `note-dialog.tsx`  | `src/server/fns/collab-notes.ts`  |
| Polls        | `polls-board.tsx`        | `poll-dialog.tsx`  | `src/server/fns/collab-polls.ts`  |
| What's next  | `whats-next.tsx`         | none               | `src/server/fns/collab-next.ts`   |

Each reader module exports a plain `…Payload(scope, tripId, …)` function; the screen's loader
composes the three that are enabled into one round trip. The writers stay `createServerFn`. The
fourth row of that table is created by `07-S9`, with its toggle, because a toggle for a panel that
renders nothing is placeholder copy wearing a switch.

#### Two files this plan appends to rather than owns

- **`src/server/repos/__tests__/tenant-isolation.test.ts`** — the append-only exception
  `00-foundations.md` grants by name. Each stage that adds a repository function appends its own
  `describe` block, edits nobody else's, and still lists the file under **Owned paths** marked
  `append`, because an auditor diffs the actual change against that list.
- **`e2e/collaboration-and-sharing.visual.spec.ts`** — `12-verification-protocol.md` §4 fixes one
  spec file per plan file, told apart by `test.describe`. This plan has four stages in wave 2 and
  two in wave 3, so the same argument that produced the isolation-suite exception applies unchanged:
  forcing them into different waves would serialise the plan for one file. The mechanical rule is
  the same — a stage appends its own `test.describe` at the end and edits nobody else's — and the
  snapshot names carry the stage id, so `snapshotPathTemplate`'s `{arg}` keeps two stages' baselines
  in different files even inside one baseline directory. This is an extension of a rule that lives
  in a file this plan does not own; it is carried as a contract extension, not applied silently.

#### Cross-plan claims, measured with the checker rather than by reading siblings

The previous revision of this section resolved a file contention by argument — "`07-S1` runs after
`01-S2` has closed" — after checking exactly one sibling plan while asserting it had checked them
all. That was wrong twice: a same-wave claim is a clobber whatever order two runs are launched in,
and the sibling this section did not open, `04-budget-and-currencies.md`, was claiming
`src/server/do/protocol.ts` in wave 1 at the same time `07-S1` was.

The judgement is therefore no longer made here. `scripts/ultrabuild/check-plan-collisions.mjs`
parses every plan's **Owned paths** and reports same-wave exclusive collisions and cross-wave
sharers; its full output for this plan is pasted verbatim under **Cross-plan collisions** at the end
of this file, and every path it lists is named in the stage that owns it together with the sibling
stage id. Three things this plan does because of that run, each recorded where the reader will need
it:

- **`src/server/do/protocol.ts` is not an owned path of any stage here.** `07-S1` declares no new
  entity kind — `day` and `stop` are already in `TRIP_ENTITY_KINDS` and merely have no producer —
  so the only edit it ever wanted there was a documentation comment, which is not worth a claim on
  a file that two plans reach for. The field vocabularies are written down in `07-S1` instead. The
  wire contract that governs a future kind is still stated in `07-S1`, because the rule outlives the
  stage.
- **`src/routes/_app/trips/$tripId/-server/plan.ts` is claimed by `07-S1` in wave 1 and by `01-S4`
  in wave 2.** Different waves, so this is legal and is named on both sides here and in `07-S1`'s
  **Owned paths**. It was a wave-1 collision with `01-S2` when this plan was first written; that
  stage has since moved its day-note writers into a new module of its own, which the checker now
  confirms.
- **The remaining cross-wave sharers are `src/server/fns/collab.ts` (`00-S2`, wave 0),
  `src/server/queue/types.ts` and `src/server/queue/consumer.ts` (`00-S4`, wave 0),
  `src/server/repos/trips.ts` (`01-S1` wave 1, `01-S6` wave 4), `src/server/repos/itinerary.ts`
  (`01-S4`, wave 2) and `src/server/repos/index.ts` (`01-S6`, wave 4).** Each is named in the stage
  of this plan that owns it, with the sibling stage id and its wave, so the ordering constraint
  travels with the stage and not only with this brief.

Sibling plans are being written concurrently, so this is a snapshot and not a proof for all time.
The rule that survives the snapshot: **re-run the checker before scheduling**, and if a wave-1 stage
of another plan re-claims `-server/plan.ts`, `07-S1` yields — see its **Blockers** for the exact
fallback and what it costs.

`02-places-and-maps.md` does not exist yet. When it does, it is the other plan most likely to want
`-server/plan.ts` for `MAP-01` in wave 1, and the same rule applies to it: this plan's claim is the
additive one and yields to a stage that restructures the module.

#### Clean-room

The reference product is never named here, its pages are cited as `` `wiki: <Page-Name>` `` with no
URL, and no sentence, table name, column name, enum value or interface string is carried across.
Every behaviour below is described in planned.travel's vocabulary over the tables that already exist
in the schema module.

## Stage 07-S1 — The trip-wide realtime subscription and the wire contract

### Stage id

`07-S1` · Wave 1 · effort **M**. The first stage of this plan and the row with the highest
transitive in-degree in the whole matrix — twenty of the eighty-nine rows reach it.

### Reference rows

- `COL-01` partial → **done**. The room, the protocol and the per-field last-write-wins model
  already exist and are not rebuilt. What this stage adds is the subscription: one socket for the
  whole trip workspace instead of one component on one tab, the planner's missing mirror, and the
  reconnect behaviour written down as a contract rather than left as an emergent property.

This stage closes `COL-01` and no other row. An earlier revision also held `COL-06` here, on the
claim that message deletion "already mirrors a `tombstone()` patch"; the greps in the Area brief
refute that claim in every layer, so the row moved to `07-S7`, which owns the message row and can
actually render a tombstone. What this stage inherits from that row is a regression it must not
cause: the delete path's `trip` signal has to keep reaching peers across the subscription move, and
the unit test list below holds it.

One behaviour named in `COL-01` is **deferred outside this plan, not to a later stage**: a
client-side queue of _mutations_ made while the browser is offline. Writes in this product never
travel over the socket — they are server functions against D1, and the socket carries only a signal
that D1 changed. An offline mutation queue is therefore a different feature with its own storage and
its own conflict surface, and it is the capability `11-boundaries-and-blockers.md` disposes of as
**drop** under `ACC-08`. What this stage builds is the other half the row names: the reconnect
catch-up, which asks for a delta from the version the tab last applied and coalesces the result into
one re-read.

Sourcing for the behaviour: `wiki: Real-Time-Sync`.

### Owned paths

- `src/components/modules/collab/use-trip-room.ts` — edit. Gains the provider and the context hook
  alongside the existing socket hook; they are one concern and stay in one module.
- `src/components/modules/collab/presence-bar.tsx` — edit. Stops opening its own socket and reads
  the shared connection.
- `src/routes/_app/trips/$tripId/route.tsx` — edit. The trip workspace layout, which is where the
  single subscription is mounted. Claimed in wave 1 and claimed by no stage of any other plan, per
  the checker output at the end of this file.
- `src/routes/_app/trips/$tripId/-server/plan.ts` — edit. The eight planner writers gain their
  mirror calls. **Shared across waves with `01-S4` (`01-trips-core.md`, wave 2)**, which rewrites the
  merged day ordering in the same module; this claim is wave 1 and therefore lands first, and `01-S4`
  rebases onto eight additive call sites rather than the reverse.
- `src/components/modules/collab/__tests__/use-trip-room.test.ts` — new.
- `e2e/collaboration-and-sharing.visual.spec.ts` — new, this plan's spec file.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — new, this stage's own baselines
  only.

The barrel `src/components/modules/collab/index.ts` is **not** claimed here: `07-S2` holds it in the
same wave, so the trip layout imports the provider from the module directly rather than through the
barrel, and no export is added that would have no consumer.

`src/server/do/protocol.ts` is **not** claimed here either, and the reason is the wire contract
below rather than a scheduling dodge: this stage declares no entity kind, no message type, no
constant and no limit change, because `day` and `stop` have been in `TRIP_ENTITY_KINDS` since the
module was written (`src/server/do/protocol.ts:50-60`) and are missing only a producer. The one
edit an earlier revision wanted there was a documentation comment naming the two field
vocabularies, and those vocabularies are written into this stage instead, under **Server** below. A
comment is not worth an exclusive claim on a module another plan's wave-1 stage was reaching for at
the same time.

No route file is added or renamed, so the generated route tree does not change and
`pnpm generate-routes` is not run by this stage.

### Data and migration

No table and no column. Every row this stage causes to be written already exists and is already
written by the code being changed; the stage adds a fan-out, not a record. No migration is generated
and nothing is backfilled.

The schema module is not edited by this stage or named by it; if a later stage of this plan needs a
column it files the requirement to `00-foundations.md` under its own **Data and migration** heading,
as `07-S2` does.

### Server (repo, server function, Zod)

- **Repository.** None added, none changed. The rows this stage causes to be mirrored are written
  by `src/server/repos/itinerary.ts` and `src/server/repos/places.ts`, both of which build every
  query on `tenantFilter()` from `src/server/repos/base.ts` — which starts from
  `eq(table.organizationId, scope.ctx.organizationId)` and lets a caller only `AND` onto it — and
  stamp `organization_id` on insert through `createTenantRepository`. So every row this stage
  fans out was `organization_id`-scoped on the way in, and this stage adds no SQL anywhere.
- **Server function.** No new endpoint. The eight existing writers in
  `src/routes/_app/trips/$tripId/-server/plan.ts` — the reorder, schedule, unschedule, rank,
  stop-update and the three place writers — each gain a `mirrorToRoom` call after their D1 write,
  using the `patch()` and `tombstone()` helpers already exported from `src/server/fns/context.ts`.
  A place scheduled onto a day mirrors a `stop` upsert keyed by the assignment id; a reorder mirrors
  one `day` upsert per touched day carrying the new order; an unschedule mirrors a `stop` tombstone.
  The mirror is awaited but never able to fail the save: `mirrorToRoom` already swallows an
  unreachable room into a structured warning, and that behaviour is the reason D1 stays the record.
- **The `day` and `stop` field vocabularies, written here because the protocol module is not an
  owned path.** Both kinds are already declared in `TRIP_ENTITY_KINDS`; what has never been fixed is
  which field names a producer may put in a patch for them, and two producers inventing two spellings
  is how a per-field last-write-wins model quietly stops merging. A `stop` patch is keyed by the
  `day_assignments` row id and carries only `dayId`, `placeId`, `orderIndex`, `startTime`, `endTime`,
  `durationMinutes`, `transportMode`, `notes` and `reservationStatus` — the column names of that
  table (`src/server/db/schema.ts:530-560`), camel-cased exactly as the row type already spells them,
  so a reader never has to map a wire name onto a column. A `day` patch is keyed by the `days` row id
  and carries `date` and `orderVersion`, a monotonically increasing integer that says "this day's
  sequence changed" without shipping the sequence, because the sequence is what the loader re-reads.
  Every value in both is a scalar; no patch carries a list, an object or a row. That keeps a frame
  far inside the 32 KiB ceiling by construction rather than by measurement, and it is the whole
  reason a reorder of forty stops costs one small `day` patch instead of forty `stop` patches.
- **Zod.** No new input schema. `src/server/do/protocol.ts` already validates every frame on both
  sides through `parseClientMessage`, and this stage adds no message type.
- **Authorisation.** Unchanged and re-stated because it is the part a reader must not have to infer.
  The socket's authorisation boundary is `src/routes/api/trip-room/-lib/connect.ts` (the route module
  `$tripId.ts` only reads the binding) and nowhere else: it re-reads the session, re-reads the
  caller's stored trip role rather than trusting a cached role, resolves the trip _inside_ the
  caller's tenant so a foreign trip id is a 404 before a socket exists, and only then asserts an
  identity to the room. The room role is `canWritePlan(trip, tripRole)`: an owner or editor of a
  trip that is not archived connects as `editor`; a trip viewer, a traveller who is not on the trip,
  and anyone on an archived trip connect as `viewer` and have their patches refused inside the room,
  and so does a session an operator is impersonating (docs/ACCESS.md §6.4, #1253).
  The role is read at connect, so the writes that change it close the sockets they affect and the
  client's reconnect picks the stored role up: a role change, a removal or a leave closes that
  person's sockets, and an archive, a restore, a delete or a visibility narrowed to private closes the
  whole room (`closeRoomFor` and `closeRoom` in `src/server/fns/context.ts`, #1050). A person who
  stops belonging to the workspace - removed, leaving, or banned, signed out everywhere or deleted by
  the platform console - has their sockets closed in every room of it by the `trip-room-evict` queue
  task, which the auth hooks enqueue once the change committed (#1073); so does a person who ends
  their own session - a password reset, a password change that revokes the other sessions, a
  sign-out, a revoke of one, the other or all sessions (#1093), and so does the person an operator
  stops impersonating (#1179); a password reset, a revoke of all
  sessions and a password change that revokes the others also delete the cached session blob of each
  ended session by name, so the reconnect is refused within the KV convergence window (about 60
  seconds; a refresh in another colo inside it can re-cache a blob, which a second revoke of all
  sessions clears; only a D1 check closes it, #1085) (#1176). The close is
  best effort: a room that cannot be reached, or a connect already in flight whose upgrade reaches
  the room after the close, leaves the old role for at most the maximum socket age plus the
  alarm interval (15 + 5 minutes, about 20 minutes). Refusing a connect minted before a
  revocation is the exact race fix (#1085). The age cap adds one reconnect per open socket per
  maximum age: one app Worker request, a session read, two D1 reads and one Durable Object fetch,
  plus the screen loader re-read. Nothing in this stage relaxes any of that, and the provider does
  not pass a trip id the layout did not already resolve through its own loader.
- **The wire contract, stated so no later stage regresses it.** These four sentences are the part of
  `COL-01` that is a contract rather than a feature:
  1. **The Durable Object already exists and is addressed by trip id.** One room per trip,
     `namespace.get(namespace.idFromName(tripId))` — the line and its comment are at
     `src/server/do/trip-room-client.ts:33-34` — and the trip id is the shard key. No stage may
     introduce a room that is not per-trip, and no stage may address one by anything else.
  2. **A new patch type is declared in `src/server/do/protocol.ts` and nowhere else**, by extending
     `TRIP_ENTITY_KINDS` and giving the kind its Zod shape in the same module, inside the limits in
     point 3 and never by raising one. This stage adds none — `day` and `stop` are already declared
     (`:50-60`) and merely had no producer — which is exactly why the module is not one of its owned
     paths. A later stage that genuinely needs a kind claims the module in a wave where the checker
     shows it free, and no stage of this plan does.
  3. **The declared limits are the limits.** 32 KiB per frame
     (`TRIP_ROOM_MAX_MESSAGE_BYTES`), 40 messages per second per connection (`TRIP_ROOM_RATE_LIMIT`),
     50 patches per message, 64 fields per patch, 2000 entities per snapshot. A patch that would not
     fit is not a reason to raise a limit; it is a reason to send an id and let the receiver read.
  4. **A commit frame is a signal that invalidates the router, never a data channel.** Nothing on
     screen is assembled from a socket frame; the frame says the trip changed and the loader answers
     from D1. This is what makes a dropped connection incapable of leaving a screen disagreeing with
     the database, and it is the property every later stage in this plan inherits. A stage that
     renders a value that arrived only over the socket has regressed the design.
- Nothing slow and nothing enqueued: a mirror is an in-network Durable Object call, not third-party
  work.

### UI (route, components)

- **Route.** `src/routes/_app/trips/$tripId/route.tsx`, the existing trip workspace layout. Default
  SSR is kept; the provider renders its children unchanged on the server and opens the socket from
  an effect after hydration, which is the same decision the collaboration screen makes today and the
  reason it is moved rather than copied. No route file is added.
- **Components.** `TripRoomProvider` and `useTripRoomConnection`, added to
  `src/components/modules/collab/use-trip-room.ts`. The provider mounts `useTripRoom` once per trip
  and publishes the connection on a context; `PresenceBar` becomes a consumer of that context and
  loses its own `useTripRoom` call. Invalidation is coalesced in the provider: commits arriving
  inside one 250 ms window produce one `router.invalidate()`, so a peer pasting eight places into a
  day costs one re-read and not eight. Existing primitives are reused and none is added — `Avatar`,
  `AvatarStack`, `Button`, `Tooltip` and `Badge` from `src/components/ui`.
- **States.** The connection has four, and each is designed rather than merely labelled. `Live` is a
  1.5px brand-tinted dot with the peer stack beside it; `Connecting` is the same dot at
  `--color-ink-4` with a `Spinner` at 16px; `Reconnecting` is a `--color-warning` dot and a plain
  sentence saying that anything sent is still saved; `Not live` is a `--color-ink-3` dot with a
  `Button` variant `subtle` labelled "Reconnect", which is the error state's recovery affordance.
  The peer stack's empty state — nobody else here — is the viewer's own avatar alone with no count
  chip, never an empty rectangle. There is no list in this stage that can be pending, so no skeleton
  is added; the skeleton the workspace already ships in `TripPending` covers the layout it mounts in.
- **Motion.** The dot's colour and the stack's entrance are 220 ms on `--ease-out-quint`, transform
  and opacity only. A peer joining fades and rises 4px; the stagger is 24 ms and capped at eight
  avatars. `prefers-reduced-motion: reduce` collapses both to opacity.
- **Tokens.** None missing. `--color-brand`, `--color-warning`, `--color-ink-3`, `--color-ink-4`,
  `--space-2`, `--space-3`, `--radius-full`, `--duration`, `--ease-out-quint` all exist. No token
  stage is required for wave 1 on this stage's account, and no hex, radius or shadow is written
  inline. The peer count is a number that changes and carries `tabular-nums`.

### Quota

Creates no countable row. A socket is not a row and a mirror writes nothing to D1 — the D1 write has
already happened and has already passed whatever ceiling its own repository asserts. No metric is
added to `resolveLimits()` and none to `PLAN_QUOTAS`, so no case is added to the equivalence test.

What this stage does change is **fan-out**, and that has its own ceiling in the room rather than in
billing: the per-connection token bucket of 40 messages per second, enforced inside the Durable
Object, which closes a socket that exceeds it with code 1013. Moving the subscription from one tab
to the workspace multiplies connections per user by one, not by the number of tabs — the provider is
mounted once per trip layout, and a member with the Plan and Costs tabs open in two windows has two
connections exactly as they do today.

Entitlement is a separate question from quota and is not decided here: `realtime` and `collaboration`
are keys in `MODULE_KEYS` (`src/lib/plans.ts:126-139`) and `hasFeature`
(`src/server/billing/entitlements.ts:244`) has no caller outside its own test. Gating the module is
`08-product-modules.md`'s row, and this stage neither implements nor pre-empts it.

### Tenant isolation test

**No case is added, and the reason is that the stage adds no repository function.** Every read and
write it touches already runs through a scoped repository with its own case in the suite. That is
the only answer this heading accepts, so the stage instead states where its tenant boundary is
proved: `src/routes/api/trip-room/-lib/connect.ts` resolves the trip through `getTrip(scope, tripId)`
inside the caller's own scope and answers 404 when the trip is not in the caller's workspace, which
is the same `NotFoundError` semantics the suite asserts for every other entity. The unit test named
below holds that the provider passes the layout's already-resolved trip id and never a value from a
search parameter or a props path a caller could set.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests in `src/components/modules/collab/__tests__/use-trip-room.test.ts`, against a fake
  socket: (a) a `welcome` carrying commits invalidates once, not once per commit; (b) three commits
  inside the coalescing window produce exactly one invalidation and a fourth after it produces a
  second; (c) `applied` advances to the room's version so the next `hello` asks for a delta;
  (d) a `protocol-mismatch` error frame moves the status to offline and stops claiming to be live;
  (e) the regression the delete path needs from this stage: a `trip` patch carrying only a changed-at
  marker — the exact shape `deleteMessageFn` mirrors today at `src/server/fns/collab.ts:121-123` —
  reaches the consumer as one invalidation, and the hook renders nothing from the patch's fields, so
  `07-S7` can build a tombstone on a re-read rather than on a frame.
- Playwright, with the port resolved rather than assumed:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
    e2e/collaboration-and-sharing.visual.spec.ts
  ```

  The spec declares this plan's routes in its own table and calls `auditServerClock(page, …)` once
  in a `describe` of its own, because a route declared in a module spec is in nobody else's
  `APP_ROUTES` and is otherwise audited by nothing.

- Browser evidence: `/trips/$tripId/collab` and `/trips/$tripId/plan`, light and dark at 360, 1280
  and 2560. The state that is the point of this stage is not the resting screen — it is the
  connection indicator away from `Live`. The declared state is reached by
  `--click '[data-part="room-reconnect"]'` after the spec has forced the socket closed with
  `page.route()`, and the selector is verified by a `page.locator(sel).count()` of 1 in the spec
  before the frame is taken, never by reading the JSX. Frames go to
  `.claude/ultrabuild/shots/<slug>/round-<n>/07-S1/`, captured with `PT_SERVER_TODAY=2026-08-20`.
- Layout shift after the settle mark is read per engine and reported, with the WebKit reading stated
  as unsupported rather than as a pass — `layout-shift` is a Chromium-only entry type and observing
  it in WebKit silently records nothing.
- Console must be silent: `watchConsole` is attached before every navigation and its `fatal` list is
  asserted empty at the end of every test, including the tests that only take a frame.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm lint` and
`pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes; the
change is verified in a real browser in light and dark, desktop and mobile; nothing is left behind —
no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside **Owned
paths** is touched.

The `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on the reconnect control and every peer
      avatar that opens a tooltip.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`: the lone-viewer peer stack,
      the workspace skeleton the provider mounts inside, and the not-live recovery affordance.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused.
- [ ] 360px, 1280px and 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard reachable end to end, sensible focus order, accessible names, WCAG 2.2 AA in both
      themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **This is the first stage in this plan to baseline a trip tab, and it inherits
  `12-verification-protocol.md` §7.2.** Seven call sites still build their own `Intl.DateTimeFormat`
  with an abbreviated month, and two of them are on this screen —
  `src/components/modules/collab/notes-board.tsx` and `.../thread.tsx`. The Worker runtime and
  WebKit disagree about those strings, so a September date differs between the two projects for a
  reason that is not the design. The status there is deferred and this stage does not fix it; it
  records that its `mobile-safari` baselines carry the risk and reports any difference of that shape
  rather than pinning anything.
- **The one file contention, with a fallback that costs the schedule and not the row.**
  `src/routes/_app/trips/$tripId/-server/plan.ts` is this stage's only owned path another plan
  touches: `01-S4` holds it in wave 2, which is legal and lands after this stage. It was a wave-1
  collision with `01-S2` until that stage moved its day-note writers into a module of its own, so
  the checker is re-run before this stage is scheduled and not trusted from this sentence. If a
  wave-1 stage of another plan claims the module again, this stage yields it and the eight mirror
  calls move to the earliest wave in which the checker reports it free — wave 3 as the plans stand,
  because `01-S4` holds wave 2 — while the subscription, which is what `COL-03`, `ADD-04` and
  `ACC-05` actually wait on, still ships in wave 1. The cost of that fallback is one extra run and a
  planner that is not yet live to a peer; the cost of ignoring it is two runs writing one file.
- No package is required. No binding is required. No row in another plan gates this stage.

## Stage 07-S2 — The collaboration panel and its four sub-features

### Stage id

`07-S2` · Wave 1 · effort **M**. Recorded as **S** in the matrix; the difference is the file split
argued in the brief, without which three wave-2 stages cannot be scheduled.

### Reference rows

`COL-02` partial → **done**.

The screen today mounts the thread, the notes board and the polls board in a fixed two-column grid
with no way to turn one off, and the conversation column keeps its measure even when it is the only
thing on the screen. This stage makes each sub-feature independently switchable per trip, makes the
layout answer to how many are on, and gives the mobile layout a tab bar that shows only the ones
that are.

The fourth sub-feature — what's next — is registered by `07-S9` together with the widget it
switches. This stage ships the registry, the persistence and the layout for a variable set; it does
not ship a switch for a panel that would render nothing.

Sourcing: `wiki: Collab-Addon`.

### Owned paths

- `src/routes/_app/trips/$tripId/collab.tsx` — edit. The screen, recomposed.
- `src/routes/_app/trips/$tripId/-server/collab.ts` — new. `loadTripCollab` moves here from the
  shared trip loader module and composes the enabled sub-features' payload builders.
- `src/routes/_app/-server/trip.ts` — edit. Removes the moved loader and its now-unused imports;
  nothing else in the module changes.
- `src/server/fns/collab-thread.ts` — new. The thread's reader and its writers.
- `src/server/fns/collab-notes.ts` — new. The notes board's reader and its writers.
- `src/server/fns/collab-polls.ts` — new. The polls board's reader and its writers.
- `src/server/fns/collab.ts` — delete. Its contents move into the three modules above unchanged in
  behaviour. **Shared across waves with `00-S2` (`00-foundations.md`, wave 0)**, which makes this
  module the first production caller of notification dispatch — a posted trip message notifies the
  other trip members. Wave 0 closes before this wave opens, so what this stage moves is the module
  _with_ that call already in it, and the message writer's new home is checked for it before the old
  module is removed. Deleting a notification call while splitting a file is exactly the kind of loss
  a diff makes easy to miss.
- `src/components/modules/collab/notes-board.tsx` — new, from `collab-board.tsx`.
- `src/components/modules/collab/polls-board.tsx` — new, from `collab-board.tsx`.
- `src/components/modules/collab/collab-board.tsx` — delete.
- `src/components/modules/collab/note-dialog.tsx` — new, from `collab-dialogs.tsx`.
- `src/components/modules/collab/poll-dialog.tsx` — new, from `collab-dialogs.tsx`.
- `src/components/modules/collab/collab-dialogs.tsx` — delete.
- `src/components/modules/collab/modules.ts` — new. The sub-feature registry: id, label, icon,
  default state, and the order the tab bar follows.
- `src/components/modules/collab/index.ts` — edit. The module's public surface after the split.
- `src/server/repos/collab.ts` — edit. The reader and writer for a trip's sub-feature settings.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `src/components/modules/collab/__tests__/modules.test.ts` — new.
- `e2e/collaboration-and-sharing.visual.spec.ts` — append.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — this stage's own baselines only.

No route file is added or renamed — the screen keeps its path — so `pnpm generate-routes` is not
run by this stage.

### Data and migration

One column, and it is a **requirement filed to `00-foundations.md` stage `00-S1`**, which absorbs
every wave-1 **Data and migration** requirement so wave 1 opens against one migration.

| Table   | Column           | Type              | Null | Default | Index                    |
| ------- | ---------------- | ----------------- | ---- | ------- | ------------------------ |
| `trips` | `collab_modules` | `text`, JSON mode | yes  | none    | none — read with the row |

The payload is a flat object of booleans keyed by sub-feature id, the same shape and the same
storage idiom as `share_links.scopes` and `trips.country_codes`. Null means "nothing has been
decided for this trip", which resolves to every sub-feature on — so the column is genuinely optional
and the rollback window is safe: a Worker rolled back to before this stage ignores a column it does
not read, and the screen it renders is the fixed layout it renders today.

No `CHECK` is added: a constraint change on an existing SQLite table makes drizzle-kit emit a full
table rebuild, which is a poor trade for an invariant Zod holds better. The shape is validated in
`src/server/repos/collab.ts` on the way in and defaulted on the way out.

No index. Every read of this column arrives with the trip row that
`src/routes/_app/trips/$tripId/route.tsx` already loads.

Backfills nothing.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/collab.ts` gains `readTripCollabModules(scope, tripId)` and
  `setTripCollabModules(scope, tripId, modules)`. They read and write one column on the trip row, and
  they live in the collaboration repository rather than the trip repository for two reasons, the
  second of which is mechanical: the column is collaboration state that happens to be stored on the
  trip, and `src/server/repos/trips.ts` is held for wave 1 by `01-trips-core.md`'s `01-S1`, which no
  stage in this plan may contend with. Both are built on `tenantFilter()`, so `organization_id` is
  the leading predicate of every read and is stamped rather than accepted on every write; both
  resolve the trip through the `requireTrip` guard `collab.ts` already imports. The reader returns a fully resolved record — every key present,
  a null column resolving to all-on — so no caller has to know the default.
- **Server function.** `setCollabModulesFn` in `src/routes/_app/trips/$tripId/-server/collab.ts`,
  `method: 'POST'`, returning the resolved record so the screen renders the server's answer rather
  than its own optimistic guess. It mirrors a `trip` patch carrying the new record, which is a
  signal like every other: peers' loaders re-read and their layouts change under them.
- **Zod.** v4 idiom throughout: `z.strictObject` for the input, `z.boolean()` per key with the
  `error` parameter naming the sub-feature, and a refinement refusing an all-off record — a trip
  with no collaboration sub-features has no collaboration screen, and the honest way to express that
  is the workspace's own module entitlement, not four switches all off.
- **Authorisation.** Decided in the handler, never in `beforeLoad`. `appScope()` resolves the tenant
  from the session; `requireTrip` re-resolves the trip inside that scope, so a well-formed trip id
  from another workspace is a `NotFoundError` and never a re-scoped write. Changing the set is a
  trip-level decision, so it additionally requires that the caller is an `owner` or `editor` on the
  trip, read from `trip_members` at call time rather than from anything the client sent; a `member`
  of the workspace who is not on the trip gets the existing `ForbiddenError`.
- Nothing slow, nothing enqueued.

### UI (route, components)

- **Route.** `/trips/$tripId/collab`, the existing file. Default SSR, unchanged: the screen's first
  paint is a database read and there is no reason to move it to the client.
- **Components.** Reused from `src/components/ui` and none re-implemented: `Card`, `Switch`,
  `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `SectionLabel`, `EmptyState`, `Skeleton`,
  `SkeletonText`, `Button`, `IconButton`, `DropdownMenu`, `Separator`, plus `ModulePanel` and
  `FilterRow` from `src/components/modules/shared`. New product components are the four listed in
  the brief's table plus the registry module; the boards and dialogs move file with no behaviour
  change of their own, which keeps this stage reviewable.
- **Layout.** At `xl` the screen is a grid whose first track is the conversation's own measure
  (`24rem`, the value the screen already uses) and whose second is everything else; with the
  conversation the only sub-feature on, the grid collapses to one full-width track and the composer
  keeps its sticky foot. Below `xl` the sub-features become a `Tabs` bar rendering only the ones
  that are on, so a trip with polls off has a two-tab bar and not a disabled third. At 360px the tab
  bar scrolls horizontally inside a `ScrollArea` rather than wrapping, and the panel body owns the
  vertical scroll.
- **The switch surface.** A `DropdownMenu` on the screen header, labelled "Sub-features", holding
  one `Switch` per registered sub-feature with its label and a one-line description. Each switch has
  rest, hover, focus-visible, active, disabled (for a viewer who may not change it) and loading (the
  switch shows a `Spinner` in place of its thumb while the write is in flight and rolls back with a
  `Toast` on failure). Switching one off animates the grid's track change at 220 ms on
  `--ease-out-quint`, transform and opacity only.
- **States.** Each board keeps its own empty state and gains a consistent one on
  `--color-surface-2`: notes — "No shared notes yet", with the create affordance as the primary
  action; polls — "Nothing to decide yet"; conversation — "Say the first thing", with the composer
  focused. The skeleton is per sub-feature and shaped like the thing it replaces: three message rows
  with an avatar circle and two text lines for the conversation, two note cards with a title bar and
  a three-line body for notes, one poll card with two option bars for polls. The error state is an
  `Alert` variant `danger` inside the panel with a "Try again" `Button` that re-runs the loader,
  never a blank panel.
- **Tokens.** None missing. `--color-surface-2` for the state surfaces, `--color-edge-faint` for the
  panel hairline, `--radius-xl` for the cards, `--shadow-card` and its re-declared dark counterpart,
  `--space-4`/`--space-6` for the grid gaps. No hex, no one-off margin. The message, note and poll
  counts in the header change and carry `tabular-nums`.

### Quota

Creates no countable row. The column is a setting on a row that already exists and was already
counted when the trip was created — `trips.ts` asserts the `trips` metric before that insert. No
metric is added to `resolveLimits()`, none to `PLAN_QUOTAS`, and therefore no case to
`src/server/billing/__tests__/limits.test.ts`.

The sub-feature switches are **not** an entitlement surface and must not be mistaken for one. Whether
a workspace may use collaboration at all is the `collaboration` module key in the plan catalogue and
belongs to `08-product-modules.md`; this is a per-trip preference inside a workspace that already
has it.

### Tenant isolation test

A new `describe` block appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, covering
`readTripCollabModules` and `setTripCollabModules` in `src/server/repos/collab.ts`. In A's scope: read B's trip's sub-feature record
by B's trip id — `NotFoundError`; write a record onto B's trip id — `NotFoundError`, and B's row is
byte-identical afterwards, `collab_modules` included; then read A's own record in B's scope —
`NotFoundError`. The all-off refusal is asserted in A's own scope so a validation failure can never
be mistaken for an isolation pass.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Migration review, because this stage's column travels in `00-S1`'s migration: read the generated
  SQL and confirm it is one `ALTER TABLE trips ADD COLUMN`, that no `__new_trips` rebuild appears,
  and that the journal gained exactly one entry.
- Unit tests in `src/components/modules/collab/__tests__/modules.test.ts`: a null record resolves to
  all-on; an unknown key in a stored record is ignored rather than thrown on, because a rollback may
  have written one; the registry's order is the tab bar's order; and the layout selector returns the
  single-track layout when exactly one sub-feature is on.
- Playwright, the invocation of `07-S1` with this stage's own `test.describe`.
- Browser evidence at 360, 1280 and 2560 in both themes, for three compositions, because the point
  of this stage is a layout that answers to a set: all sub-features on; the conversation alone; the
  conversation off with notes and polls on. The declared non-resting state is the switch menu,
  reached with `--click '[data-part="collab-modules-trigger"]'`, the selector verified by a
  `count()` of 1 in the spec before the frame is taken. Frames under
  `.claude/ultrabuild/shots/<slug>/round-<n>/07-S2/`, with `PT_SERVER_TODAY=2026-08-20`.
- Layout shift after the settle mark, per engine, reported with the WebKit skip stated as a skip;
  the grid track change is the shift most likely to be real here and is measured with the switch
  toggled after the mark.
- Console silent, `fatal` empty, any tolerated entry named with the rule that excused it.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, exactly as under `07-S1`.

The `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every switch, tab trigger and panel
      action.
- [ ] Empty, skeleton and error states designed on `--color-surface-2` for all three boards, each
      shaped like the content it stands in for.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused.
- [ ] 360px, 1280px and 2560px, where the small layout is a tab bar and not a squeezed grid.
- [ ] Keyboard reachable end to end: the tab bar follows the roving-tabindex behaviour `Tabs`
      already implements, the switch menu is reachable and dismissible, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- The abbreviated-month deferral recorded by `07-S1` applies to this stage's baselines too, and for
  one extra reason: the two files that carry those call sites are the two this stage splits, so the
  call sites move file without changing behaviour. The stage does not fix them and says so.
- No package is required. No binding is required. The only cross-plan dependency is the column, and
  it is filed to `00-S1` in wave 0, which closes before this stage's wave opens.

## Stage 07-S3 — The thread: paging, grouping and the composer's keys

### Stage id

`07-S3` · Wave 2 · effort **M**.

### Reference rows

`COL-03` partial → **done**. The thread posts, edits, deletes, reacts and replies today, with
optimistic sends; what it does not do is page. `loadTripCollab` asks for a fixed window of 50
(`src/routes/_app/-server/trip.ts:756`) and the screen shows whatever came back, so a trip with a
long conversation silently loses its beginning. This stage adds the page, the "Load older" control,
the run-based grouping that stops a burst of messages from one person repeating their name and
avatar six times, and the composer's key contract.

The repository already pages: `listMessages` (`src/server/repos/collab.ts:123-133`) returns a
`CursorPage` over an id that is itself a keyset cursor. No SQL is written by this stage.

**What this stage deliberately does not assume.** That same reader excludes soft-deleted rows
(`isNull(collabMessages.deletedAt)` at `:129`), so a deleted message is absent from a page rather
than present as a tombstone. `COL-06`'s stage, `07-S7` in wave 3, is the one that changes that and
adds the deleter it needs; this stage is written against the reader as it is, and its grouping model
gains the tombstone as a run-breaking case there. Writing the grouping now as though tombstones
already arrived would be a rule with nothing to match it — which is how the previous revision of
this plan came to hold three stages on a behaviour no layer implemented.

Sourcing: `wiki: Collab-Chat`.

### Owned paths

- `src/server/fns/collab-thread.ts` — edit. The reader takes a cursor and a page size; a new
  `loadOlderMessagesFn` answers the "Load older" control.
- `src/components/modules/collab/thread.tsx` — edit.
- `src/components/modules/collab/thread-model.ts` — new. The pure functions: run grouping, the
  jumbo-glyph test, the day divider boundary. Kept out of the component so they are testable without
  a DOM.
- `src/components/modules/collab/__tests__/thread-model.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/collaboration-and-sharing.visual.spec.ts` — append.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — this stage's own baselines only.

No route file changes, so `pnpm generate-routes` is not run.

### Data and migration

None. Every column this stage reads exists, and `collab_messages` already carries the reply link,
the edit instant and the soft-delete instant. No migration is generated and nothing is backfilled.

### Server (repo, server function, Zod)

- **Repository.** None added, none changed. The rows this stage reads and writes belong to
  `src/server/repos/collab.ts` — `listMessages`, `listReactions` and the message writers — and every
  one of them is built on `tenantFilter()`, so `organization_id` leads the predicate on each read and
  is stamped on each insert. Nothing here is reachable without a `TenantScope`.
- **Server function.** `loadOlderMessagesFn` in `src/server/fns/collab-thread.ts`, `method: 'GET'`,
  taking the trip id and an opaque cursor and returning one page plus the next cursor and the
  reaction tallies for exactly that page's ids. The first page stays inside the screen's loader so
  the transcript is server-rendered; only older pages are fetched from the client.
- **Zod.** `z.strictObject` with the `error` parameter; the cursor is a bounded string
  (`z.string().trim().min(1).max(64)`) and the page size is a literal union of the two sizes the UI
  can ask for rather than a free integer, because a client-chosen page size is a client-chosen row
  scan and D1 bills rows read, not rows returned.
- **Authorisation.** In the handler. `appScope()` then `requireTrip`, so the trip id is re-resolved
  inside the caller's tenant and a foreign one is a `NotFoundError` before a cursor is looked at. The
  cursor is not an authorisation input: it only narrows a query that is already tenant-scoped and
  trip-scoped, so a cursor lifted from another workspace's page selects nothing rather than leaking.
- Nothing slow, nothing enqueued. A page is one indexed D1 read on
  `collab_messages_trip_created_at_idx`.

### UI (route, components)

- **Route.** Unchanged.
- **Components.** `thread.tsx` keeps its shape; the new pure module supplies the grouping. Reused
  primitives: `Avatar`, `Button`, `IconButton`, `ScrollArea`, `Skeleton`, `Spinner`, `Tooltip`,
  `Separator`, `Badge`. None is added.
- **Grouping.** Consecutive messages from one author inside a five-minute window render as one run:
  the first row carries avatar, name and time, the rest carry the body alone, indented to the same
  measure so the column edge stays straight. A run is broken by a different author, by the window
  closing and by a day boundary. The model's run-breaking test is written as a predicate over one
  row rather than as a list of three cases, so `07-S7` adds the tombstone as a fourth without
  reshaping it. A day boundary renders a centred divider with the date on `--color-surface-2`.
- **Jumbo glyphs.** A message whose entire trimmed body is one to three emoji renders at
  `--text-title` size with no bubble, which is a visual affordance and not a parsing feature: the
  test is written over `Intl.Segmenter`'s grapheme segmentation and falls back to rendering normally
  when a body does not qualify. It never changes the stored text.
- **The composer.** Enter sends, Shift+Enter inserts a newline, and the hint is shown once as a
  `Kbd` pair below the field rather than as permanent chrome. The field is a `Textarea` that grows
  to a maximum of six lines and then scrolls. Sending has a loading state on the send control; a
  failed send keeps the text in the field, shows a `Toast` and offers a retry rather than discarding
  what was typed.
- **States.** Empty — "Say the first thing", on `--color-surface-2`, with the composer focused and
  no illustration competing with it. Skeleton — three grouped runs of avatar plus two text lines,
  matching the rhythm of a real run so the transition does not jump. Error — an `Alert` variant
  `danger` above the composer with a "Try again" `Button`. The "Load older" control has its own three
  states: rest, loading (a `Spinner` inside the button, the label unchanged so the row does not
  reflow), and exhausted, where it is replaced by a quiet line saying the conversation starts here.
- **Tokens.** None missing. `--color-surface-2`, `--color-edge-faint`, `--radius-lg`, `--space-2`
  through `--space-6`, `--text-caption` for the time stamps, `--duration-fast` for the run's
  entrance. Message counts and the unread badge carry `tabular-nums`.
- **Motion.** A new message enters at 220 ms on `--ease-out-quint` with a 6px rise and an opacity
  fade; an older page prepends without animating, because animating a prepend is what makes a
  transcript jump. `prefers-reduced-motion: reduce` collapses both to opacity.

### Quota

Creates no countable row. A message is not a sold or metered entity: what bounds a conversation is
the trip it belongs to, and trips are metered. No metric is added to `resolveLimits()`, none to
`PLAN_QUOTAS`, and no case to the equivalence test.

What this stage does bound is **rows read**, which D1 bills whether or not they are returned. The
page size is a literal union rather than a client integer, the query rides
`collab_messages_trip_created_at_idx`, and the reaction read is keyed to exactly the ids on the page
rather than to the trip.

### Tenant isolation test

A new `describe` block appended to the isolation suite. The stage adds no repository function, so
the case is written against the one seam it does add: in A's scope, ask `listMessages` for a page of
B's trip by B's trip id — an empty page rather than B's rows, and a `requireById` of one of B's
message ids raises `NotFoundError`; then pass a cursor taken from B's page into a request scoped to
A and assert the result is A's own page, never B's. B's rows are unchanged afterwards. Functions
covered: `listMessages` and `listReactions` in `src/server/repos/collab.ts`, exercised through the
suite's existing `createScope()` fixtures.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests in `src/components/modules/collab/__tests__/thread-model.test.ts`: a run breaks on
  author, on the five-minute window and on a day boundary; three emoji qualify for
  the jumbo rendering and four do not; an emoji with a skin-tone modifier counts as one grapheme;
  a body with an emoji and a word does not qualify; the day divider is emitted once per day and not
  once per message.
- Playwright, the invocation of `07-S1` with this stage's own `test.describe`.
- Browser evidence at 360, 1280 and 2560 in both themes, for the resting transcript and for two
  declared states: the "Load older" control mid-load, reached with
  `--click '[data-part="thread-load-older"]'` against a `page.route()` that holds the response open;
  and the empty transcript, reached on a trip seeded with no messages. Both selectors are verified by
  a `count()` of 1 in the spec. Frames under `.claude/ultrabuild/shots/<slug>/round-<n>/07-S3/`.
- Layout shift after the settle mark, per engine, and specifically across a "Load older" prepend,
  which is where a transcript most easily shifts. WebKit's reading is stated as unsupported.
- Console silent; `fatal` empty.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, exactly as under `07-S1`.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on the composer's send, the row actions and
      the "Load older" control.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`, the skeleton shaped like a
      grouped run.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only, no animation on a prepend,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused.
- [ ] 360px, 1280px and 2560px; at 360 the transcript is the whole screen and the composer is
      pinned above the safe-area inset.
- [ ] Keyboard reachable end to end: Enter and Shift+Enter behave as documented, the row actions are
      reachable without a pointer, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- The abbreviated-month deferral of `12-verification-protocol.md` §7.2 applies: `thread.tsx` is one
  of the seven call sites and this stage baselines the screen it renders on.
- No package is required. No binding is required. `COL-03 → COL-01` is satisfied by `07-S1` in
  wave 1.

## Stage 07-S4 — Shared notes: categories as records, a website field, attachments

### Stage id

`07-S4` · Wave 2 · effort **L**.

### Reference rows

`COL-07` partial → **done**, with one behaviour explicitly deferred.

The notes board renders, filters, pins and colours notes today, and `collab_notes.category` is free
text — so two people spell one category two ways and the filter pills fork. This stage makes a
category a record with a name, one of six palette colours and an order, managed in a modal that
stages every add, rename, recolour and delete and commits them in one batch; adds a website field;
and lets a note carry file attachments through the file record `DOC-01` supplies.

**This stage closes `COL-07` and no other row.** The website field's preview thumbnail is the same
outbound metadata fetch `COL-05` is about, `COL-05` is closed by `07-S8`, and the fetch is built
once — there. Until then the website renders as a
scheme-checked link chip showing the host. `07-S8` attaches the preview to the same chip and changes
no other note surface.

Sourcing: `wiki: Collab-Notes`.

### Owned paths

- `src/server/fns/collab-notes.ts` — edit.
- `src/server/repos/collab.ts` — edit. The note category record and the note's new fields.
- `src/components/modules/collab/notes-board.tsx` — edit.
- `src/components/modules/collab/note-dialog.tsx` — edit.
- `src/components/modules/collab/note-categories-dialog.tsx` — new. The staged batch-commit modal.
- `src/components/modules/collab/__tests__/note-categories.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/collaboration-and-sharing.visual.spec.ts` — append.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — this stage's own baselines only.

No route file changes, so `pnpm generate-routes` is not run.

### Data and migration

One table and three columns, all **filed to `00-foundations.md` as the wave-1 schema stage's
requirement**, so they land before wave 2 opens. That stage mints its own id and owns the schema
module; this section states the requirement and nothing more.

New table `collab_note_categories`: `id` from `newId()`; `organization_id` not null referencing the
organization with cascade delete; `trip_id` not null referencing `trips` with cascade delete; `name`
text not null; `colour` text nullable, using the schema module's existing colour helper;
`sort_order` real not null default 0; the standard `created_at`/`updated_at` epoch-millisecond pair.
Indexes: a unique index on (`trip_id`, `name`) so one trip cannot hold two categories with one name,
and `(organization_id, trip_id)` as the leading composite — `organization_id` first, as every index
in the schema module already is.

Added columns:

| Table          | Column        | Type   | Null | Why                                              |
| -------------- | ------------- | ------ | ---- | ------------------------------------------------ |
| `collab_notes` | `category_id` | `text` | yes  | References the new table, `on delete set null`.  |
| `collab_notes` | `website_url` | `text` | yes  | Absolute `http`/`https` only, enforced in Zod.   |
| `trip_files`   | `note_id`     | `text` | yes  | References `collab_notes`, `on delete set null`. |

`trip_files` already carries exactly this pattern for four other targets — place, reservation,
transport and expense, each a nullable foreign key with its own index — so the note attachment is
the fifth instance of an established shape and not a new mechanism. It is deliberately **not** a
generalised link table: `DOC-04` (wave 4, `06-documents-and-media.md`) owns multi-target linking,
and inventing a second model here would be the duplicate implementation that plan then has to undo.

**Additive discipline for the category migration.** `collab_notes.category` is not dropped, renamed
or narrowed by this stage. During the rollback window the writer sets both `category_id` and the
denormalised label in `category`, and the reader reads `category_id`; a Worker rolled back to before
this stage keeps rendering the label it already understands. Dropping the text column is a separate
migration in a later wave, and this stage does not pre-empt it.

Backfills one thing, and it is stated because a silent backfill is worse than none: for each trip
holding notes with a non-empty `category`, the migration series creates one category record per
distinct label and points those notes' `category_id` at it, colour null and order by first
appearance. That is a data-shape migration over rows that already exist in the tenant they already
belong to; it invents no row in another tenant and touches no note whose category is null.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/collab.ts` gains `listNoteCategories(scope, tripId)` and one
  batch writer, `applyNoteCategoryChanges(scope, tripId, changes)`, taking the staged set — creates,
  renames, recolours, reorders and deletes — and running them through `db.batch()` so a partial
  commit is impossible; D1's batch is a real transaction and one failure rolls the sequence back.
  Deleting a category sets `category_id` to null on the trip's notes in the same batch rather than
  leaving a dangling id. `createCollabNote` and `updateCollabNote` gain the two new note fields.
  Every query is built on `tenantFilter()`; nothing here is reachable without a `TenantScope`.
- **Server function.** In `src/server/fns/collab-notes.ts`: `saveNoteCategoriesFn` (POST, returns
  the resolved category list), and the existing note writers extended for the website field and the
  attachment link. Each mirrors a `note` patch, which is a signal, so peers' boards re-read from D1.
- **Zod.** v4 throughout. The change set is a `z.strictObject` of four bounded arrays with the
  `error` parameter naming the offending operation; a category name is trimmed, 1–60 characters, and
  a colour is one of the six palette values as a `z.enum`, not a free hex — six is a design decision
  and a free hex is how a board stops looking designed. The website is `z.url()` with a refinement
  restricting the scheme to `http` or `https`; `z.string().url()` is v3 and is not used.
- **Authorisation.** In the handler. `appScope()` then `requireTrip`, so the trip is re-resolved
  inside the caller's tenant; a category id or a file id arriving from the browser is re-resolved in
  the same scope and is a `NotFoundError` when it does not belong there, never silently re-scoped.
  Attaching a file requires the file's own record to resolve inside the caller's scope _and_ to
  belong to the same trip, so a file from another trip in the same workspace is refused too.
- **Attachment policy.** The upload path and the extension policy already exist in
  `src/server/fns/file-policy.ts` and are reused, not re-implemented: this stage links an existing
  file record to a note and never accepts bytes of its own. The blocklist, the size ceiling and the
  R2 write order — object first, quota assertion second, compensating delete on throw — are
  `DOC-01`'s and stay there.
- Nothing slow, nothing enqueued.

### UI (route, components)

- **Route.** Unchanged.
- **Components.** Reused: `Dialog`, `Input`, `Textarea`, `Select`, `Chip`, `Badge`, `Button`,
  `IconButton`, `Card`, `Switch`, `Tooltip`, `EmptyState`, `Skeleton`, `Alert`, `Separator`,
  `ScrollArea`, `RadioGroup` for the colour choice, plus `ConfirmDialog` and `RowMenu` from
  `src/components/modules/shared`. New: the categories dialog.
- **The categories dialog.** Every edit is staged locally and nothing is written until "Save
  changes"; the footer shows a live count of pending changes with `tabular-nums`, "Discard" returns
  the list to the server's answer, and closing with unsaved changes asks first. A row being deleted
  stays visible struck through with an undo affordance until the commit, so a mis-click costs
  nothing. The save control has rest, hover, focus-visible, active, disabled (nothing staged) and
  loading states, and a failed commit keeps the staged set intact and shows the reason in an `Alert`.
- **Notes board.** The filter pills read from the category records, in their stored order, each
  carrying its palette colour as a 8px dot rather than as a full-bleed background, so a colour never
  competes with the text's contrast. Pinned notes sort above their category, as they do today. A
  note's website renders as a link chip with the host and an external-link icon, opening in a new tab
  with `rel="noreferrer noopener"`. Attachments render as a row of file chips with the filename and
  size, each downloading through the existing file route.
- **The note body.** Rendered as plain text with preserved line breaks — see **Blockers**.
- **States.** Empty — "No shared notes yet", on `--color-surface-2`, with "Add a note" as the
  primary action and a second line naming what notes are for. A trip with notes but no category
  matching the active filter gets its own empty state — "Nothing filed under this category" — with a
  "Show all" reset, because reusing the first empty state there tells the reader the board is empty
  when it is not. Skeleton — two note cards with a title bar, a colour dot and three text lines.
  Error — `Alert` variant `danger` with "Try again".
- **Tokens.** None missing. The six palette colours are the existing `--color-brand`,
  `--color-info`, `--color-success`, `--color-warning`, `--color-danger` and `--color-ink-3`
  families with their `-soft` companions, so dark mode is already designed for them and no new token
  is required. `--color-surface-2` for state surfaces, `--radius-xl`, `--shadow-card` with its
  re-declared dark counterpart.

### Quota

Creates countable rows — notes, categories and file links — and none of them is a metered metric,
which is stated rather than left implied. Notes and categories are not sold and not metered; what
bounds them is the trip, and trips are metered in `resolveLimits()`. The attachment is different in
one respect and identical in another: the **file** it links to consumes `files` and `storage_bytes`
and had `assertQuota` applied when it was uploaded by `DOC-01`'s path; **linking** it to a note
creates no new object and consumes nothing. So no metric is added to `resolveLimits()`, none to
`PLAN_QUOTAS`, and no case is added to `src/server/billing/__tests__/limits.test.ts`.

Two bounds are enforced in the repository anyway, because "not metered" is not "unbounded": a trip
holds at most 40 note categories and a note at most 10 attachments, both as named constants beside
the Zod schemas that hold them and both covered by a unit test rather than by a comment.

### Tenant isolation test

A new `describe` block appended to the isolation suite, and the new table joins the suite's `cases`
table so it inherits the five standing assertions — cannot be read by id, never listed, cannot be
updated, cannot be deleted, counts only the caller's own rows. On top of those: in A's scope, commit
a category change set naming one of B's category ids — `NotFoundError`, and B's categories are
unchanged; create a note in A's trip with `category_id` pointing at one of B's categories —
`NotFoundError`, never a re-scoped write; attach one of B's file ids to A's note — `NotFoundError`;
and delete one of B's categories through the batch writer — `NotFoundError`, with B's notes'
`category_id` untouched afterwards. Functions covered: `listNoteCategories`,
`applyNoteCategoryChanges`, `createCollabNote` and `updateCollabNote`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Migration review: read the generated SQL, confirm one `CREATE TABLE` and three
  `ALTER TABLE … ADD COLUMN`, no rebuild, no `DROP`, one journal entry; then apply it locally against
  a database that already carries the earlier migrations and confirm the backfill produced one
  category per distinct label per trip and left null-category notes alone.
- Unit tests in `src/components/modules/collab/__tests__/note-categories.test.ts`: staging is pure —
  a rename followed by a delete of the same row commits as a delete alone; a create followed by a
  rename commits as one create; the pending count matches the operations that will actually be sent;
  and a duplicate name inside the staged set is refused before it reaches the server.
- Playwright, the invocation of `07-S1` with this stage's own `test.describe`.
- Browser evidence at 360, 1280 and 2560 in both themes: the board at rest; the categories dialog
  with three staged changes, reached with `--click '[data-part="note-categories-trigger"]'`; and the
  filtered-empty state, reached by selecting a category with no notes. Selectors verified by a
  `count()` of 1 in the spec. Frames under `.claude/ultrabuild/shots/<slug>/round-<n>/07-S4/`.
- Layout shift after the settle mark, per engine, WebKit stated as unsupported.
- Console silent; `fatal` empty.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, exactly as under `07-S1`.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every pill, chip, colour swatch, staged
      row and the commit control.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`, including the distinct
      filtered-empty state.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused.
- [ ] 360px, 1280px and 2560px; at 360 the categories dialog is a full-height sheet, not a shrunken
      modal.
- [ ] Keyboard reachable end to end: the staged list is navigable, the colour choice is a radio
      group with arrow-key movement, focus returns to the trigger on close, WCAG 2.2 AA in both
      themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **Markdown rendering is BLOCKED and the row ships without it.** `COL-07` describes note bodies as
  markdown. No markdown parser is in the dependency set, and `docs/SPEC.md` §3 is absolute: stop and
  report, never install. The disposition is already recorded — `11-boundaries-and-blockers.md`,
  `11-S2`, entry 5 — as **hand-roll a restricted subset**, with one implementation under `src/lib/`
  owned by the earliest wave-1 stage that needs it, which is the stage closing `TRP-09` (day notes)
  in `01-trips-core.md`. This stage therefore does **not** write a renderer: it renders the note body
  as plain text with preserved line breaks in wave 2, and consumes that shared module when it exists.
  If `TRP-09`'s stage has landed by the time this one runs, the note body renders through it with no
  further work here; if it has not, the plain-text rendering is the shipped behaviour and is not a
  placeholder. Writing a second renderer in this stage would be a defect.
- The website preview thumbnail is deferred to `07-S8` as stated under **Reference rows**.
- `COL-07 → DOC-01` is supplied by `06-documents-and-media.md`, the stage that closes `DOC-01`, in
  wave 1. If that stage has not landed, this stage's attachment half cannot be built and the stage
  waits; it does not invent an upload path.
- The abbreviated-month deferral of `12-verification-protocol.md` §7.2 applies to this stage's
  baselines.

## Stage 07-S5 — Polls: deadlines, the countdown and the results gate

### Stage id

`07-S5` · Wave 2 · effort **S**.

### Reference rows

`COL-08` partial → **done**. Polls already carry options, single or multiple choice, a closed flag
and a deadline column; the board casts, moves and withdraws votes optimistically and can close and
delete. Three things are missing and all three are on the surface: there is no way to set the
deadline the column already stores, no countdown showing it, and results are visible to someone who
has not voted, which is how a poll stops measuring anything.

Measured, and it contradicts nothing in the matrix but is worth stating: `createPollInput`
(`src/server/repos/collab.ts`) already accepts `closesAt`, and `collab_polls.closes_at` already
exists with its own index. The gap is entirely above the repository.

Sourcing: `wiki: Collab-Polls`.

### Owned paths

- `src/server/fns/collab-polls.ts` — edit.
- `src/components/modules/collab/polls-board.tsx` — edit.
- `src/components/modules/collab/poll-dialog.tsx` — edit.
- `src/components/modules/collab/poll-options.ts` — edit. Gains the deadline and results-gate
  helpers next to the option helpers it already holds.
- `src/components/modules/collab/__tests__/poll-options.test.ts` — edit. The existing file for that
  module.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/collaboration-and-sharing.visual.spec.ts` — append.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — this stage's own baselines only.

No route file changes, so `pnpm generate-routes` is not run.

### Data and migration

None. `collab_polls.closes_at` is an existing epoch-millisecond column with
`collab_polls_closes_at_idx` already on it. No migration is generated and nothing is backfilled.

### Server (repo, server function, Zod)

- **Repository.** None added. The rows this stage writes belong to `src/server/repos/collab.ts` —
  `createPoll`, `closePoll`, `deletePoll`, `castVote` and `listVotes` — each built on
  `tenantFilter()`, so `organization_id` leads every read predicate and is stamped on every insert. `getPollResult` — which `repo-data.md` records as unreached — becomes
  reached by this stage's reader rather than being re-implemented beside it.
- **Server function.** In `src/server/fns/collab-polls.ts`: `createPollFn` passes the deadline
  through; a new `reopenPollFn` is **not** added, because a reopened poll invalidates votes cast
  under a closed poll's assumptions and nothing in the row asks for it. The reader is where the gate
  lives, and it is the important part: the payload builder returns per-option tallies **only** when
  the viewer has voted or the poll is closed, and otherwise returns the option list, the viewer's own
  vote state and the total count alone. Hiding a tally in CSS is not hiding it; a payload that never
  carried the numbers is.
- **Zod.** v4. The deadline is `z.iso.datetime()` mapped to an instant, optional and nullable, with
  a refinement that a deadline in the past is refused at creation — a poll that closes before it
  opens is a mistake, not a state. The `error` parameter names the field.
- **Authorisation.** In the handler. `appScope()` then `requireTrip`; a poll id from the browser is
  re-resolved in the caller's scope by `collabPollsRepository.requireById`, so a foreign id is a
  `NotFoundError`. Closing or deleting a poll requires authorship or a workspace `owner`/`admin`
  role, read at call time, matching the moderation rule the screen already applies.
- **The deadline is not a scheduled job.** A poll closes by being read after its deadline: the
  reader treats `closes_at` in the past as closed, and the `is_closed` column stays the record of a
  manual close. No cron, no queue message, and therefore no ceiling to argue — a design that costs
  nothing per poll and cannot drift when a job is missed. `castVote` already refuses a closed poll;
  the reader's derived-closed state is applied there too so a vote landing one second after the
  deadline is refused with the same `POLL_CLOSED` error rather than accepted.
- Nothing slow, nothing enqueued.

### UI (route, components)

- **Route.** Unchanged.
- **Components.** Reused: `Card`, `Progress`, `Badge`, `Chip`, `Button`, `IconButton`, `RadioGroup`,
  `Checkbox`, `DatePicker`, `Select` for the time, `Tooltip`, `Dialog`, `EmptyState`, `Skeleton`,
  `Alert`, `AvatarStack` for the voters. None added — `DatePicker` already ships and is consumed
  here rather than rebuilt.
- **The countdown.** A `Badge` on the poll card reading the time remaining, recomputed on a 30-second
  interval that is cleared on unmount and paused while the document is hidden. Inside the last hour
  it reads minutes; below a minute it reads "Closing now"; past the deadline the card switches to its
  closed presentation without a reload. The number is `tabular-nums`, so the badge does not jitter as
  digits change — which is exactly the clause `docs/SPEC.md` §4 exists for.
- **The results gate.** Before voting, each option is a full-width choice control with its label and
  nothing else, and a quiet line says results appear once you have voted. After voting — or once
  closed — each option gains a `Progress` bar, a percentage with `tabular-nums`, and an
  `AvatarStack` of the voters that is keyboard-focusable and names them in its accessible label. The
  transition between the two presentations is 220 ms on `--ease-out-quint`, opacity and transform
  only, and the card's height is reserved so voting does not push the board.
- **States.** Empty — "Nothing to decide yet", on `--color-surface-2`, with "Start a poll" as the
  primary action. Skeleton — one poll card with a question bar and two option bars. Error — `Alert`
  variant `danger` inside the card with "Try again", and a failed vote rolls the optimistic state
  back and says so in a `Toast` rather than leaving a bar at the wrong length.
- **Tokens.** None missing. `--color-surface-2`, `--color-brand-subtle` for the filled bar,
  `--color-edge-faint`, `--radius-lg`, `--space-2`/`--space-3`, `--duration`, `--ease-out-quint`.

### Quota

Creates no metered row. A poll and a vote are not sold and not metered; the trip they belong to is.
No metric is added to `resolveLimits()`, none to `PLAN_QUOTAS`, no case to the equivalence test.

The bounds that do apply are already in the repository and are kept: at most 20 options per poll in
`createPollInput`, and the unique index on (poll, user, option) that makes a double vote
unrepresentable rather than merely unlikely.

### Tenant isolation test

A new `describe` block appended to the isolation suite. In A's scope: read the result of one of B's
polls — `NotFoundError`; cast a vote on one of B's poll ids — `NotFoundError`, and B's vote rows are
unchanged; close and delete one of B's polls — `NotFoundError` for both, with B's poll still open
afterwards; and create a poll in A's trip carrying an option id copied from B's poll, asserting the
option is minted fresh in A's tenant and no row of B's is read. Functions covered: `getPollResult`,
`castVote`, `closePoll`, `deletePoll` and `createPoll` in `src/server/repos/collab.ts`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests appended to `src/components/modules/collab/__tests__/poll-options.test.ts`: the
  countdown formatter at a day, an hour, a minute and past the deadline; a poll whose deadline has
  passed reads as closed even with `is_closed` false; the gate returns no tally for a viewer who has
  not voted on an open poll and a full tally for the same viewer once they have; and a closed poll
  returns the tally to everyone.
- Playwright, the invocation of `07-S1` with this stage's own `test.describe`.
- Browser evidence at 360, 1280 and 2560 in both themes, in three states, because the resting card
  is the least interesting of them: an open poll the viewer has not voted in (the gate closed); the
  same poll after voting (the gate open); and a poll inside its final hour showing the countdown.
  The voted state is reached by clicking the first option, selector
  `[data-part="poll-option"]`, verified by a `count()` greater than 1 in the spec; the countdown
  state is reached by a fixture poll whose deadline is relative to the pinned server day rather than
  to wall-clock time, so the frame is reproducible. Frames under
  `.claude/ultrabuild/shots/<slug>/round-<n>/07-S5/`.
- Layout shift after the settle mark, per engine, measured specifically across the vote transition,
  which is the shift this stage is most likely to introduce. WebKit stated as unsupported.
- Console silent; `fatal` empty.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, exactly as under `07-S1`.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled (a closed poll's options) and loading (a vote in
      flight) on every option control and every card action.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured; the countdown never animates.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused.
- [ ] 360px, 1280px and 2560px; at 360 the option rows are full-width targets of at least 44px.
- [ ] Keyboard reachable end to end: single-choice options are a radio group, multiple-choice are
      checkboxes, the voter stack is focusable and named, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- The abbreviated-month deferral of `12-verification-protocol.md` §7.2 applies to this stage's
  baselines.
- No package is required. No binding is required. `COL-08 → COL-02` is satisfied by `07-S2` in
  wave 1.

## Stage 07-S6 — The public share link and the guest viewer

### Stage id

`07-S6` · Wave 2 · effort **L**. One of the two unauthenticated surfaces in the product, and the
first of them.

### Reference rows

`COL-10` absent → **done**. A trip owner mints a read-only link, chooses what it exposes, watches
its use, rotates it and revokes it; anyone holding the link sees the trip without an account and
without a workspace.

Two measurements shape the stage, and both differ from what the row's summary implies:

- **The record already exists and is richer than the row assumes.** `share_links`
  (`src/server/db/schema.ts:1028-1051`) carries a globally unique token, a view counter, a last-view
  instant, an optional expiry and a revocation instant; `ShareScopes` (`:253-261`) has **seven**
  keys — map, itinerary, reservations, lists, budget, collab and files. The row records five toggles
  for the reference product. Ours therefore exposes **six** toggles with the map fixed on, because a
  trip with no map is not a trip anyone would follow a link to see, and the seventh key is the one
  that is not a choice.
- **The repository is written and unreached.** `listShareLinks`, `createShareLink`, `revokeShareLink`
  and `touchShareLink` (`src/server/repos/trips.ts:476-518`) all exist; `:503-507` already records
  the tenancy rule this stage implements. Nothing is re-implemented.

Sourcing: `wiki: Public-Share-Links`.

### Owned paths

- `src/routes/shared/$token.tsx` — new. The unauthenticated guest viewer. **A new route file, so
  this stage runs `pnpm generate-routes`** and the regenerated tree travels inside its diff; the
  generated tree is never hand-edited and is not listed here.
- `src/routes/shared/-server/public-trip.ts` — new. The token resolution and the read bundle.
- `src/routes/shared/-ui/guest-shell.tsx` — new. The guest chrome and the revoked state.
- `src/routes/shared/-ui/guest-sections.tsx` — new. One section per enabled scope.
- `src/server/fns/sharing.ts` — new. The owner-side link management.
- `src/server/repos/trips.ts` — edit. Token hashing, the unscoped resolver and the scope factory.
  **Shared across waves with `01-S1` (`01-trips-core.md`, wave 1) and `01-S6` (wave 4)**, which own
  the trip lifecycle writers and the trip-member panel in the same module; this claim is wave 2, it
  sits between them, and it adds two functions beside the four share-link functions that already
  exist rather than touching anything either of those stages changes.
- `src/routes/_app/trips/$tripId/collab.tsx` — edit. The trigger for the share dialog.
- `src/components/modules/collab/share-dialog.tsx` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `src/server/repos/__tests__/share-links.test.ts` — new.
- `e2e/collaboration-and-sharing.visual.spec.ts` — append.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — this stage's own baselines only.

### Data and migration

**None**, and that is a deliberate result rather than a happy accident. The token column is a
64-character-capable unique text column and the repository's input already bounds a token at 16–64
characters, which is exactly wide enough to store a SHA-256 hex digest. So the link's secret is
minted with `nanoid(32)`, shown to the owner once, and **only its digest is stored** — a leaked
database row does not yield a working link, and rotation is one update. No column is added, no
`CHECK` changes, no migration is generated, and nothing is backfilled: the table has never held a
row, because nothing has ever called `createShareLink`.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/trips.ts` gains exactly two things and keeps the existing four
  functions:
  - `hashShareToken(secret)` — the digest helper, so the same transformation is applied on write and
    on read and cannot drift between them.
  - `findLiveShareLinkByToken(db, secret)` — **the one deliberately unscoped query in this plan**,
    and it is argued rather than slipped in. It takes a `Database` rather than a `TenantScope`,
    because there is no tenant to scope by until the row is found: the whole point is that the row
    _is_ the tenant resolution. It matches the digest against `share_links_token_unq`, returns null
    for a row that is revoked or expired, and returns only what the caller needs to build a
    scope — id, organization id, trip id, scopes, creator. It never returns trip content, so a
    caller that forgets to build a scope has nothing to render.

  Everything else in the module is unchanged and stays scoped: `listShareLinks`, `createShareLink`,
  `revokeShareLink` and `touchShareLink` are built on `tenantFilter()`, so `organization_id` leads
  every read predicate and is stamped rather than accepted on every write.

- **How the request resolves a tenant context without trusting a client-supplied identifier.** This
  is the tenancy rule for this surface, stated in full because it is the only place in the product
  where a request without a session reaches tenant data:
  1. The URL carries **one** value: an opaque secret. It is not an id, not an organization id, not
     a trip id, and nothing in the request path or the query string is read as any of those.
  2. The secret is hashed and matched against a unique index. A miss is a 404 rendered as the
     revoked state; there is no error that distinguishes "never existed" from "revoked".
  3. The **tenant comes from the matched row**, never from the request:
     `createScope(getDb(), { organizationId: link.organizationId, userId: link.createdBy, role: 'member' })`.
     The user identity is the link's creator, which is what makes "the sharer's preferences" a
     defined thing at all, and the role is the least privileged one in the enum.
  4. Every read after that is an ordinary tenant-scoped repository call for `link.tripId`, and the
     trip is re-resolved through `requireTrip` inside that scope, so even a corrupted row cannot
     read across a boundary.
  5. The scope is **read-only by construction of the call sites**: the module exports one function,
     the read bundle, and no writer. The single write the visit causes — the view counter — goes
     through `touchShareLink` in the same scope and is the only mutation the surface can perform.
- **The scope toggles.** The bundle asks for a section only when the link's scope record says so;
  a section that is off is not fetched, not serialised and not rendered — not hidden with CSS and
  not shipped as an empty array a client could ignore. Turning a toggle off therefore removes the
  data from the payload on the very next request.
- **Rotation.** `rotateShareLinkFn` mints a new secret, writes its digest over the row and returns
  the new secret once. The previous secret stops resolving on the next request because the digest it
  hashes to is no longer in the index; there is no grace period, which is the only behaviour a
  rotation control can honestly claim.
- **Revocation, and what it does to a viewer already connected.** This needs its own answer because
  a guest is not a member and the honest answer is a design decision, not an accident:
  - **A guest never opens a WebSocket.** The room's identity envelope requires a user and a role, the
    per-connection budget of 40 messages per second is a member's budget, and presence is a list of
    people the members know. Putting an anonymous stranger into a tenant's room would put all three
    in the hands of anyone holding a URL. So the guest viewer is server-rendered and has no socket,
    and `closeTripRoom` — which exists in `src/server/do/trip-room-client.ts` and is called when a trip
    is archived, restored or deleted or narrowed to private (#1050) — is deliberately not called
    here; a guest never has a socket for it to close.
  - **A revoked link takes effect on the next request, and the guest makes one every 60 seconds
    while the tab is visible.** The page polls a tiny liveness endpoint — the same token resolution,
    returning only whether the link still resolves — gated on `document.visibilityState`, and
    replaces the whole page with the revoked state when it stops resolving. A hidden tab makes no
    request at all and gets the revoked state the moment it is looked at again. Any navigation
    inside the viewer resolves the token afresh, so revocation is immediate for anyone actually
    using the page.
  - **Nothing already delivered is recalled**, and the surface says so to the owner in the dialog:
    revoking stops new reads; it does not reach into a page someone has already loaded or printed.
    Claiming otherwise would be the one dishonest sentence on the screen.
- **Currency.** Amounts resolve sharer-then-trip: the creator's `user_settings.currency` inside the
  link's own organization when it is set, otherwise `trips.currency`. The guest viewer performs **no
  live conversion and calls no rate provider** — it renders the amount in the row's own currency and,
  when a frozen rate is present on the row, the converted amount beside it. Those frozen columns are
  `MNY-07`'s (`04-budget-and-currencies.md`, wave 1); where no rate was frozen, only the source
  amount is shown. This is what keeps the stage clear of the open foreign-exchange provider decision
  recorded in `11-boundaries-and-blockers.md`, `11-S3`.
- **Zod.** v4 throughout: `z.strictObject` for the scope record with the `error` parameter, the
  token as a bounded opaque string, `z.iso.datetime()` for an optional expiry. Validation is shape;
  the authorisation is the digest match plus the tenant derived from the row.
- **Rate limiting.** The public route is the only unauthenticated data surface here, so it carries
  its own ceiling: a per-IP token bucket in `KV` with a short TTL, refusing with 429 above it, and a
  constant-time-shaped failure path so a caller cannot distinguish a wrong token from a rate refusal
  by timing. The bucket's size is a named constant beside the code that reads it and is covered by a
  unit test.
- Nothing slow, nothing enqueued.

### UI (route, components)

- **Route.** `/shared/$token`, a new top-level route file outside `_app`, so the authenticated
  shell's `beforeLoad` guard never runs and an anonymous visitor is never redirected to sign in. SSR
  is the default and is kept deliberately: the page must render for a reader with no session and no
  JavaScript-dependent hydration to see content. `pnpm generate-routes` runs; the generated tree is
  not hand-edited.
- **Components.** Guest chrome reuses `SkipToContent`, `MarketingHeader` and `MarketingFooter` from
  `src/components/marketing`, which is what the product's other unauthenticated pages already use,
  so a guest lands somewhere that looks like the product rather than like a leaked internal screen.
  Sections reuse `Card`, `StatCard`, `SectionLabel`, `Badge`, `Table`, `Separator`, `EmptyState`,
  `Alert`, `Skeleton` and `GlassPanel` over the map. The owner-side dialog reuses `Dialog`, `Switch`,
  `Button`, `IconButton`, `Tooltip`, `CopyValue` and `ConfirmDialog` from
  `src/components/modules/shared`. No primitive is added.
- **The guest page.** A hero naming the trip, its dates and its destination; then one section per
  enabled scope in a fixed order — map, itinerary, reservations, lists, budget, collaboration notes,
  files — each with its own heading so a reader can navigate by landmark. There is no edit
  affordance anywhere, no control that would 401, and a single quiet call to action inviting the
  reader to plan their own trip.
- **States.** The revoked state is a designed page, not a 404 shell: a centred `EmptyState` on
  `--color-surface-2` saying the link is no longer available, with the product's sign-in and
  marketing links as the way out. A section whose scope is on but whose trip has nothing in it gets
  its own empty state — "No reservations on this trip" — so a guest can tell "nothing here" from
  "not shared". The skeleton is the section stack with a hero bar and three card outlines; the error
  state is an `Alert` variant `danger` with a reload affordance. The owner's dialog has a loading
  state on mint and rotate, a disabled state for a member who may not share, and a copy control with
  a confirmed state that says what was copied.
- **Tokens.** None missing. `--color-surface-2` for the state surfaces, `--color-canvas` for the
  guest page ground, `--shadow-card` with its re-declared dark counterpart, `--radius-xl`,
  `--space-6`/`--space-8` for the section rhythm. Every amount, count and view tally carries
  `tabular-nums`.
- **Motion.** Sections enter at 220 ms on `--ease-out-quint` with a 6px rise, staggered 24 ms and
  capped at eight; the revoked state cross-fades at 150 ms. `prefers-reduced-motion: reduce`
  collapses both to opacity.

### Quota

Creates a countable row — a share link — and it is **not** added as a metered metric, which is
stated with its reason. Sharing is a plan capability rather than a counted resource: the catalogue
already models it as a module key, and metering "links" would sell the wrong unit. So nothing is
added to `resolveLimits()` and nothing to `PLAN_QUOTAS`, and no case is added to
`src/server/billing/__tests__/limits.test.ts`.

Two bounds are enforced in the repository regardless: at most 5 live links per trip, as a named
constant beside the writer and held by a unit test; and the per-IP bucket on the public route above,
which is the ceiling that actually matters, because an unauthenticated endpoint is the one place a
tenant's costs can be driven by someone who is not a tenant.

Whether a plan may share publicly at all is `08-product-modules.md`'s entitlement row; this stage
neither implements nor pre-empts that gate.

### Tenant isolation test

A new `describe` block appended to the isolation suite, plus a dedicated
`src/server/repos/__tests__/share-links.test.ts` for the unscoped resolver, because an unscoped
function deserves a file that says so in its name.

The isolation case, in A's scope: list B's trip's links by B's trip id — empty; create a link on B's
trip id — `NotFoundError`, and B's link rows unchanged; revoke and rotate one of B's link ids —
`NotFoundError` for both, with B's row byte-identical afterwards; and touch one of B's link ids —
`NotFoundError`, with B's view counter unchanged.

The resolver's own cases, which are the ones that matter for a surface with no session: a valid
secret resolves to **its own** organization and never to any other; the scope built from it reads A's
trip and, asked for B's trip id, raises `NotFoundError`; a revoked row resolves to null; an expired
row resolves to null; a secret that is one character different resolves to null; and a digest
present in the table but belonging to another tenant's row yields that tenant's scope and only that
tenant's rows. Functions covered: `findLiveShareLinkByToken`, `hashShareToken`, `createShareLink`,
`revokeShareLink`, `touchShareLink` and `listShareLinks`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `pnpm generate-routes` is run because a route file is added, and the regenerated tree is inspected
  in the diff rather than edited.
- Unit tests as named above, plus one holding that a section whose scope is off is absent from the
  serialised payload — asserted on the payload object, not on the DOM, because the point is that the
  data never left the server.
- Playwright, the invocation of `07-S1` with this stage's own `test.describe`. The guest route is
  the one route in this plan that must be visited **without** the cached session, so its tests use a
  fresh context rather than `AUTH_STATE`; that is also the strongest assertion available that the
  page needs no session.
- Browser evidence at 360, 1280 and 2560 in both themes, for three surfaces: the guest page with
  every scope on; the guest page with three scopes off, showing that the sections are gone rather
  than emptied; and the revoked state. Plus the owner's dialog, reached with
  `--click '[data-part="share-trip-trigger"]'`, selector verified by a `count()` of 1 in the spec.
  The guest frames are captured **without** `--auth`. Frames under
  `.claude/ultrabuild/shots/<slug>/round-<n>/07-S6/`, with `PT_SERVER_TODAY=2026-08-20`.
- Layout shift after the settle mark, per engine; the guest page carries a map and is settled with
  the two-sided `[data-map-ready]` predicate after every resize and every theme change. WebKit
  stated as unsupported for the shift reading.
- Console silent; `fatal` empty; the map route's tolerated rasteriser advisory named with the rule
  that excuses it.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, exactly as under `07-S1`.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every toggle, the copy control, the
      rotate control and the revoke confirmation.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`, including the per-section
      empty state and the revoked page.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused; the guest page is
      designed in dark, not inherited.
- [ ] 360px, 1280px and 2560px; at 2560 the guest page holds a measure rather than stretching its
      paragraphs to the viewport.
- [ ] Keyboard reachable end to end, with a skip link, landmark headings per section, and WCAG 2.2
      AA in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **The foreign-exchange provider decision is open** — `11-boundaries-and-blockers.md`, `11-S3` —
  and this stage is written so that it is not blocked by it: the guest renders frozen rates and never
  calls a provider. If `MNY-07`'s columns have not landed, the guest renders source amounts only and
  the stage still closes.
- `COL-10 → MNY-07` is supplied by `04-budget-and-currencies.md`, stage `04-S1`, in wave 1 — the
  stage that gives every receipt its own currency and freezes the rate it was booked at.
- No package is required. No binding is required: the digest is computed with `crypto.subtle`, which
  the Workers runtime supplies, and the rate-limit bucket uses the `KV` binding that already exists.

## Stage 07-S7 — Reactions, quote replies and the deletion tombstone

### Stage id

`07-S7` · Wave 3 · effort **M**. Recorded as **S** for `COL-04` alone; this stage also closes
`COL-06`, which the matrix records as done and which the Area brief's greps show is not.

### Reference rows

- `COL-04` partial → **done**. Reactions and replies work: six fixed reactions toggle optimistically
  through `toggleReactionFn`, and a reply writes `collab_messages.reply_to_id`. Three affordances
  are missing — a composer emoji picker, a quick-reaction gesture on a message, and a way to see who
  reacted — and one is a small design decision worth naming: hovering to reveal reactors is a
  pointer-only affordance, so it ships as a hover **and** as a focusable control, because a keyboard
  reader is not a second-class reader.
- `COL-06` recorded **done**, measured **open** → **done**. The row asks for a visible tombstone
  naming the deleter and the time, shown to everyone. The Area brief gives the four greps that
  refute the matrix's evidence; in one line each: the delete mirrors `patch('trip', …)` and not a
  `tombstone()` (`src/server/fns/collab.ts:114-125`), the reader hides deleted rows outright
  (`src/server/repos/collab.ts:123-133`), the table has no deleter column
  (`src/server/db/schema.ts:1057-1082`), and the thread renders no tombstone
  (`src/components/modules/collab/thread.tsx`, where `deleted` appears only in two toast strings at
  `:158-159`). This stage lands all three missing halves — the deleter, the reader change and the
  rendering — and it lands them here rather than in `07-S3` for a measured reason as well as a
  thematic one: the tombstone is a presentation of the message row, which is this stage's subject,
  and `src/server/repos/collab.ts` is already held in wave 2 by `07-S4`, so a wave-2 stage cannot
  take it.

What is **not** changed is the wire shape, and this is the part of `COL-06` that was always right:
deletion stays a soft delete announced as a `trip` signal, the peer's loader re-reads D1, and no
message content ever travels in a frame. No entity kind is added, so `src/server/do/protocol.ts` is
untouched by this stage as by every other stage of this plan.

Sourcing: `wiki: Collab-Chat`.

### Owned paths

- `src/components/modules/collab/thread.tsx` — edit.
- `src/components/modules/collab/thread-model.ts` — edit. Created by `07-S3` in wave 2; the
  run-breaking predicate gains the tombstone case and the tombstone's own label formatting.
- `src/components/modules/collab/emoji-picker.tsx` — new. A bounded, categorised picker over a
  curated set — not a full emoji index, which would be a data dependency this stage does not have.
- `src/server/fns/collab-thread.ts` — edit. Created by `07-S2` in wave 1 and last edited by `07-S3`
  in wave 2; the delete writer records the deleter and the reader serialises the tombstone.
- `src/server/repos/collab.ts` — edit. The two message functions named under **Server** below.
  Held by `07-S4` in wave 2 and by `07-S8` in wave 4; this claim is wave 3 and contends with
  neither.
- `src/components/modules/collab/__tests__/emoji-picker.test.ts` — new.
- `src/components/modules/collab/__tests__/tombstone.test.ts` — new. The deleted-row rules, in
  their own file so `07-S3`'s `thread-model.test.ts` is not contended across waves for a diff this
  stage can keep separate.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/collaboration-and-sharing.visual.spec.ts` — append.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — this stage's own baselines only.

No route file changes, so `pnpm generate-routes` is not run.

### Data and migration

`collab_message_reactions` and `collab_messages.reply_to_id` both exist and are already written, so
`COL-04` needs nothing.

`COL-06` needs **one additive column**, filed to `00-foundations.md` as the wave-2 schema stage's
requirement so it lands before wave 3 opens. This section states the requirement; the schema module
is not an owned path of this stage and is never edited here.

| Table             | Column       | Type   | Null | Default | Index                               |
| ----------------- | ------------ | ------ | ---- | ------- | ----------------------------------- |
| `collab_messages` | `deleted_by` | `text` | yes  | none    | none — read with the row it sits on |

Nullable, and it stays nullable for ever: every row written before this stage has a `deleted_at`
with no deleter, and the reader has to render those anyway. It follows the schema module's
`userRef()` convention — plain text with no Drizzle foreign key — because the domain schema never
imports the authentication schema, which is why `collab_messages.user_id` is spelled the same way
(`src/server/db/schema.ts:1057-1082`). No index: the column is never a predicate, only a projection,
and D1 charges a row written for every indexed column on every write.

No `CHECK`. Rollback safety is the reason the column is not `NOT NULL` and not defaulted: a Worker
rolled back to before this stage writes `deleted_at` alone and reads a reader that filters deleted
rows out, which is exactly the behaviour it shipped with.

Backfills nothing. Existing soft-deleted rows keep a null deleter and render the tombstone in its
unattributed form — "Message removed" with the time — which is the honest rendering of a fact the
database does not hold. Inventing a deleter for them would be a fabricated audit trail.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/collab.ts`, and two existing functions change rather than
  multiply. Both are built on `tenantFilter()` from `src/server/repos/base.ts`, which starts every
  predicate from `eq(table.organizationId, scope.ctx.organizationId)` and lets a caller only `AND`
  onto it, and both write through `createTenantRepository`, which stamps `organization_id` rather
  than accepting it:
  - `deleteMessage` (`:167-176`) keeps its authorship-or-moderator guard exactly as written and adds
    `deletedBy: scope.ctx.userId` to the same update. The deleter is the session's user and is never
    a value the caller supplies; there is no parameter for it.
  - `listMessages` (`:123-133`) stops filtering deleted rows out and instead **projects them
    empty**: the `isNull(collabMessages.deletedAt)` predicate is removed, and a row with a
    `deleted_at` is mapped at the repository boundary to a record whose `body` is the empty string
    and whose reply link, file link and edit instant are null, carrying only `id`, `userId`,
    `createdAt`, `deletedAt` and `deletedBy`. The deleted text therefore never leaves D1 — not to a
    server function, not to a payload, not to a client that knows how to open developer tools. A
    reader that merely hid the body in the component would be a different and much weaker promise.
  - Two guards follow from that change and are stated so they are not discovered as bugs:
    `editMessage` and `toggleReaction` refuse a row whose `deleted_at` is set, because a tombstone
    is not editable and not reactable, and `postMessage` refuses a `reply_to_id` naming a deleted
    row — a quote of nothing is worse than no quote.
  - `listReactions` is unchanged. It is keyed to the ids on the page, and a tombstone's id simply
    has no tallies once the guard above is in place.
- **Server function.** No new endpoint, for either row. The picker and the quick-reaction gesture
  both call the existing `toggleReactionFn`, and deletion keeps calling the existing delete writer,
  which after `07-S2`'s split lives in `src/server/fns/collab-thread.ts`; adding a second writer for
  either row would be the duplicate implementation `README.md` calls a defect. What changes in that
  module is the read side: the payload carries the tombstone's five fields and nothing more, and the
  delete keeps mirroring the `trip` signal it mirrors today (`src/server/fns/collab.ts:121-123`
  before the split), because a commit frame is a signal and the tombstone is rendered from the
  re-read.
- **Zod.** The existing reaction input is tightened rather than extended: the emoji is validated
  against the curated set as a `z.enum` instead of a free string, so the reaction column can only
  ever hold a glyph the product renders. That is a narrowing of accepted input, not of the column,
  so it is additive at the database level and needs no migration; existing rows outside the set —
  there are none, the set has not changed — would still read.
- **Authorisation.** Unchanged: `appScope()` then `requireTrip`, and the message id is re-resolved
  in the caller's scope so a foreign id is a `NotFoundError`. A reaction is always attributed to the
  session's user; the client cannot name a reactor. Deletion keeps the rule the repository already
  enforces — the author, or a workspace `owner`/`admin` — read from the scope at call time, and the
  deleter recorded on the row is that same session user, which is what makes the tombstone's
  attribution true rather than decorative.
- Nothing slow, nothing enqueued. Every write here — a toggle, a reply, a delete — mirrors the same
  `trip` signal patch the collaboration writers already mirror, carrying a changed-at marker and no
  content, so peers re-read from D1. No new entity kind is declared and `src/server/do/protocol.ts`
  is untouched, inside the 32 KiB frame and 40 messages-per-second ceilings `07-S1` fixes.

### UI (route, components)

- **Route.** Unchanged.
- **Components.** Reused: `Popover`, `Tabs`, `ScrollArea`, `IconButton`, `Tooltip`, `AvatarStack`,
  `Chip`, `Kbd`. New: the picker.
- **The picker.** Three categories in a `Tabs` bar, a curated grid of glyphs, arrow-key movement
  inside the grid with Home and End, Enter to insert, Escape to close, and focus returning to the
  composer with the caret where it was. It is a composer affordance, so it inserts into the text; it
  is not a second reaction surface.
- **Quick reactions.** Eight glyphs on a `Popover` anchored to the message row, opened by the row's
  own action button, by a context-menu gesture on a pointer device, and by a long press on touch.
  Every path lands on the same control, and the button is in the tab order so the gesture is never
  the only way in. Toggle semantics are the existing ones: a second press removes.
- **Reactors.** The reaction chip reveals its reactors in a `Tooltip` on hover and on focus, listing
  names, and its accessible name states the count and the glyph so a screen reader is not told
  "smiling face" and nothing else. The count is `tabular-nums`.
- **The reply strip.** Replying pins a strip above the composer showing the quoted author and a
  single truncated line, with a dismiss control; the sent message renders the quote inline above its
  own body, and clicking the quote scrolls the original into view and flashes it for 220 ms. A quote
  whose original has since been deleted renders the tombstone's own line instead of the text, so the
  transcript never shows words that were withdrawn.
- **The tombstone row.** A deleted message keeps its place in the transcript and renders as its own
  row, never inside a run: an inset line on `--color-surface-2` with a hairline of
  `--color-edge-faint`, no bubble, no avatar, a `Trash2` glyph at 14px in `--color-ink-4`, and one
  sentence in `--text-caption` on `--color-ink-3` — "Message removed by {name} · {time}" when the
  deleter is known, "Message removed · {time}" when the row predates the column. The time uses the
  same formatter as every other timestamp in the thread and is `tabular-nums`. The row carries no
  action: no reaction control, no reply control, no row menu, and it is not a focus stop, because
  there is nothing to do with it. Its accessible text is the same sentence, so a screen reader hears
  what a sighted reader sees rather than an empty list item. **The tombstone adds no live region and
  is never announced**, and that is a decision rather than an omission: the one status region the
  thread owns (`07-S3`, `data-part="thread-status"` in `thread.tsx`) speaks only about paging and
  about a peer's new message by name or count, never a message's text, and a tombstone is not a new
  message. The region is not put on the list: a transcript-wide live region would be read row by row.
  The tombstone sits in reading order where the message was, and is read there.
- **States.** The picker's search-less grid cannot be empty, so its only states are rest, hover,
  focus-visible and active per glyph; the reaction chip has rest, hover, focus-visible, active,
  a pending state while the toggle is in flight (the count holds its width so the row does not
  reflow), and a disabled state for a viewer who may not react. The delete control has rest, hover,
  focus-visible, active, disabled (a viewer who may not moderate) and loading, and it confirms
  through the shared `ConfirmDialog` naming what deletion does — the text goes for everyone and a
  marker stays. The thread's own empty, skeleton and error states are `07-S3`'s and are unchanged; a
  transcript that is nothing but tombstones is not an empty state and is not treated as one, because
  "everything here was deleted" is a true and useful thing to see.
- **Tokens.** None missing. `--color-surface-2`, `--color-brand-subtle` for a chip the viewer is in,
  `--shadow-popover` with its re-declared dark counterpart, `--radius-full`, `--radius-lg` for the
  tombstone's inset, `--color-edge-faint`, `--color-ink-3` and `--color-ink-4` for its text and
  glyph, `--text-caption`, `--space-1`/`--space-2`, `--duration-fast`. Both `--color-ink-3` on
  `--color-surface-2` and its dark counterpart are re-checked against WCAG 2.2 AA rather than
  assumed, because a tombstone is quiet by design and quiet is where contrast is usually lost.

### Quota

Creates a countable row — a reaction — and it is not metered, for the same reason a message is not:
it is not sold, and the trip that bounds it is metered. Nothing is added to `resolveLimits()` or
`PLAN_QUOTAS`, and no case to the equivalence test. The bound that does apply is structural: the
composite primary key on (`message_id`, `user_id`, `emoji`) — `collab_message_reactions` declares it
as a `primaryKey({ columns: … })` rather than as a unique index — makes a duplicate reaction
unrepresentable, and the curated set bounds the distinct glyphs per message to its own size.

`COL-06` creates **no** row at all: a delete is an update of two columns on a row that already
exists and was already counted, and the tombstone is a projection of it. What it changes is a read
cost, and the change is stated rather than left to be discovered: deleted rows are no longer
filtered out, so a page of 50 messages can contain tombstones and the page still reads 50 rows —
D1 bills rows scanned, and the removed `isNull` predicate was a filter over the same index walk
rather than a narrowing of it — with the filter in place the walk had to step past deleted rows to
fill a page, so the scan after this change is no larger than before and is usually smaller. Storage
does not grow either: no body is lengthened, and the only bytes added are a `deleted_by` value on
rows that have been deleted.

### Tenant isolation test

A new `describe` block appended to the isolation suite. In A's scope: toggle a reaction on one of B's
message ids — `NotFoundError`, and B's reaction rows unchanged; list reactions for a set of ids that
mixes A's and B's, asserting only A's are returned rather than the call failing, because a mixed read
must not become a way to probe existence; and post a reply whose `reply_to_id` is one of B's messages
— `NotFoundError`, never a re-scoped parent.

The deletion cases in the same block, because this stage changes two functions that read and write
across the boundary: delete one of B's messages by id in A's scope — `NotFoundError`, with B's row
byte-identical afterwards including `deleted_at` and `deleted_by`; list B's trip's messages in A's
scope — an empty page, not B's tombstones, so the reader change does not turn deleted rows into a
way to see that a conversation exists; and, in B's own scope, delete a message and assert that
`deleted_by` holds B's acting user and that the returned record's `body` is empty while the stored
row still belongs to B's organization. Every one of those runs through `tenantFilter()` and none of
them is reachable without a `TenantScope`.

Functions covered: `toggleReaction`, `listReactions`, `postMessage`, `deleteMessage`, `editMessage`
and `listMessages` in `src/server/repos/collab.ts`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Migration review, because this stage's column travels in the wave-2 schema stage's migration: one
  `ALTER TABLE collab_messages ADD COLUMN deleted_by text`, no `__new_collab_messages` rebuild, no
  `DROP`, one journal entry.
- Unit tests in `src/components/modules/collab/__tests__/emoji-picker.test.ts`: arrow-key movement
  wraps within a row and moves between rows; Home and End reach the ends of a row; the insertion
  places the glyph at the caret and not at the end; and the curated set contains no duplicate glyph,
  which is the kind of thing only a test notices.
- Unit tests in `src/components/modules/collab/__tests__/tombstone.test.ts`: a deleted row breaks a
  run on both sides, so the messages before and after it never join; a deleted row with a null
  deleter renders the unattributed sentence and not the string "null" or "undefined"; the projected
  record carries no body, so a test that asks for the body of a deleted message gets the empty string
  from the model rather than the original text; a quote whose target is deleted renders the tombstone
  line; and a tombstone exposes no action and no focus stop.
- Playwright, the invocation of `07-S1` with this stage's own `test.describe`.
- Browser evidence at 360, 1280 and 2560 in both themes, in four declared states, because none of
  this stage's output is visible at rest: the quick-reaction popover open, reached with
  `--click '[data-part="message-react"]'`; the reactor tooltip open, reached with
  `--hover '[data-part="reaction-chip"]'`; the reply strip pinned, reached with
  `--click '[data-part="message-reply"]'`; and a transcript containing a tombstone between two
  runs, selector `[data-part="message-tombstone"]`, reached from a fixture that seeds a deleted
  message rather than by deleting one during the frame, so the frame is reproducible. Each selector
  is verified by a `count()` of at least 1 in the spec before the frame is taken. Frames under
  `.claude/ultrabuild/shots/<slug>/round-<n>/07-S7/`.
- Layout shift after the settle mark, per engine, measured across a reaction toggle, which is the
  shift a held-width count exists to prevent. WebKit stated as unsupported.
- Console silent; `fatal` empty.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, exactly as under `07-S1`.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every glyph, chip, row action and the
      delete control with its confirmation.
- [ ] Empty, skeleton and error states on `--color-surface-2` — inherited from `07-S3` for the
      thread and re-verified here, with the reaction chip's own pending state and the tombstone's
      inset surface added; a transcript of nothing but tombstones is not shown as empty.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured; a message replaced by its tombstone cross-fades in
      place at 150ms and does not collapse its height.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused, and the tombstone's
      quiet ink re-checked for AA on `--color-surface-2` in both.
- [ ] 360px, 1280px and 2560px; at 360 the picker is a bottom sheet, the quick reactions are
      44px targets and the tombstone keeps its sentence on one line by truncating the name, never
      the time.
- [ ] Keyboard reachable end to end: every gesture has a keyboard equivalent, the reactor list is
      focus-reachable, the tombstone is announced but is not a focus stop, WCAG 2.2 AA in both
      themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- The abbreviated-month deferral of `12-verification-protocol.md` §7.2 applies to this stage's
  baselines.
- No package is required — the curated glyph set is data in this repository, not a dependency, and
  that is exactly why it is curated. No binding is required. `COL-04 → COL-03` is satisfied by
  `07-S3` in wave 2.
- `COL-06` has no edge in `gap-rows.json`, because the matrix records it as done. It nonetheless
  waits on two things inside this plan and they are named rather than assumed: `07-S3`, which
  creates `thread-model.ts` in wave 2, and the wave-2 foundations schema stage, which supplies
  `collab_messages.deleted_by`. If the column has not landed, this stage does **not** ship a
  half-tombstone attributed to nobody — it waits, because an unattributed tombstone is precisely the
  behaviour the row exists to replace.
- One measurement recorded rather than acted on: `src/server/repos/collab.ts` is edited by `07-S4`
  in wave 2 and by `07-S8` in wave 4 as well as by this stage in wave 3. Three waves, three stages,
  no overlap — but the module is the busiest file in this plan, so each of the three states its wave
  here and the checker output at the end of the file is the record.

## Stage 07-S8 — Link previews

### Stage id

`07-S8` · Wave 4 · effort **M**. `COL-05`'s edges permit wave 3; this plan schedules it in wave 4
because it and `07-S7` both change the rendered message row, and two stages in one wave may not name
one file. The dependency is satisfied either way.

### Reference rows

`COL-05` absent → **done**. The first URL in a message gets a preview card below the text, and
nothing else in the message does.

It also completes the one behaviour `07-S4` deferred: a shared note's website field renders through
the same preview, using the same fetcher, the same cache and the same rendering rules. Building it
twice was the alternative and would have been a defect.

Sourcing: `wiki: Collab-Chat`.

### Owned paths

- `src/lib/link-preview.ts` — new. URL extraction, normalisation and the metadata parser. Pure and
  isomorphic; no fetch, no Cloudflare import.
- `src/server/queue/handlers/link-preview.ts` — new. The outbound fetch and the cache.
- `src/server/queue/types.ts` — edit. The task kind and its payload schema. **Shared across waves
  with `00-S4` (`00-foundations.md`, wave 0)**, which registers the statistics-recomputation kind in
  the same table; wave 0 closes long before this wave, and this stage adds one member to a union
  rather than reshaping it.
- `src/server/queue/consumer.ts` — edit. The handler registration and its `case`. **Shared across
  waves with `00-S4` (wave 0)** for the same reason and in the same `switch`.
- `src/server/repos/collab.ts` — edit. Reading and writing the preview record on a message and a
  note. Held by `07-S4` in wave 2 and by `07-S7` in wave 3; this claim is wave 4 and contends with
  neither.
- `src/server/fns/collab-thread.ts` — edit. Enqueue on post; serialise the preview on read.
- `src/components/modules/collab/link-preview-card.tsx` — new.
- `src/components/modules/collab/thread.tsx` — edit. One call site for the card.
- `src/components/modules/collab/notes-board.tsx` — edit. The deferred note thumbnail.
- `src/lib/__tests__/link-preview.test.ts` — new.
- `src/server/queue/__tests__/link-preview.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/collaboration-and-sharing.visual.spec.ts` — append.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — this stage's own baselines only.

No route file changes, so `pnpm generate-routes` is not run.

### Data and migration

Two columns, **filed to `00-foundations.md` as the wave-3 schema stage's requirement**, so they land
before this stage's wave opens.

| Table             | Column                | Type              | Null | Why                                               |
| ----------------- | --------------------- | ----------------- | ---- | ------------------------------------------------- |
| `collab_messages` | `link_preview`        | `text`, JSON mode | yes  | The snapshot rendered with the message, for ever. |
| `collab_messages` | `link_preview_status` | `text`            | yes  | `pending`, `ready`, `empty` or `failed`.          |

No `CHECK` on the status column: a constraint change on an existing table makes drizzle-kit rebuild
it, and the four values are held by a `z.enum` in the repository instead — the same trade
`00-foundations.md` prescribes.

The stored payload is a snapshot: title, description, site name, image URL, the resolved URL and the
instant it was fetched. It is stored per message rather than only in cache because a message from
2026 must still render what it rendered then; a cache that expires would silently empty a year of
transcript.

`collab_notes` needs no new column: the website field `07-S4` added is the URL, and its preview is
stored in the same shared cache and read at render time, because a note is edited in place and has
no equivalent claim to a frozen snapshot.

Backfills nothing. Existing messages keep both columns null, which the reader treats as "never
attempted" and does not retroactively enqueue — a backfill of outbound fetches over a whole
transcript is exactly the traffic burst this stage's budget exists to prevent.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/collab.ts` gains `setMessageLinkPreview(scope, messageId, …)`
  and includes the two columns in the message reader. Both are built on `tenantFilter()`, so
  `organization_id` leads the predicate and the update cannot address a row outside the scope. The
  queue handler builds its scope from the envelope's organization id and re-resolves the message
  inside it, so a redelivered envelope naming another tenant's message writes nothing.
- **Server function.** No new endpoint. `postMessageFn` extracts the first URL, sets the status to
  `pending` in the same write, and enqueues one task. The preview arrives as an ordinary commit
  signal and the thread re-reads — the frame carries no preview data, because a commit frame is a
  signal and not a data channel.
- **Queue.** A new `link-preview` kind in `TASK_KINDS` with its own payload schema and a handler
  module. Enqueued through the existing single-message `enqueueTask`, never the unchunked batch
  producer: this producer emits exactly one message per posted message that contains a URL, so it
  does not scale with anything and needs no chunking — which is stated because
  `00-foundations.md` requires a producer to answer that question rather than skip it.
- **The outbound-fetch budget, stated as numbers rather than intentions.** Every one of these is a
  named constant in the handler module with a unit test holding it:
  - **One fetch per message.** Only the first URL in the body is considered. A message with nine
    links costs one fetch, and that is the whole of the row's "first URL only" behaviour.
  - **One fetch per URL per 24 hours across the whole product.** The `KV` cache is keyed by the
    SHA-256 of the normalised URL, so two tenants pasting one public link cost one fetch. The key
    contains no trip id, no message id and no organization id, because the cached fact is a public
    page's own metadata and nothing derived from a tenant's data — the rule
    `11-boundaries-and-blockers.md`, `11-S3` states for a shared cache. A negative result is cached
    too, for 1 hour, so a dead link is not re-fetched every time someone quotes it.
  - **A 5-second timeout** via `AbortSignal.timeout`, **at most 3 redirects**, and **at most 128 KiB
    of response body read** before the read is aborted — the metadata this stage wants is in the
    head, and a page that buries it past 128 KiB does not get a card.
  - **`http` and `https` only**, and a refusal for any host that resolves to a loopback, link-local
    or private range, so a pasted URL cannot be used to probe our own network from inside a Worker.
  - **At most 8 previews per trip per hour**, counted in `KV`, so a tenant cannot turn a chat box
    into an outbound crawler.
  - The handler runs on the queue, never in the request path, which is `ARCHITECTURE.md` §5's rule
    and the reason a slow third party cannot slow a message down. A failed fetch sets `failed` and
    is retried by the queue's own policy, then dead-letters; it never blocks a message.
- **The fetched document is untrusted third-party content and is never rendered as markup.** This is
  the security rule of the stage and it is absolute:
  - The parser extracts a bounded set of string values and returns **strings only**. There is no
    HTML in the stored payload and no HTML in the rendered output.
  - Every value is length-capped on the way in — title 200, description 400, site name 80 — decoded
    for HTML entities and then stripped of control characters.
  - `dangerouslySetInnerHTML` does not appear in this stage, in any file. The card is React elements
    with text children.
  - The image is not proxied and not inlined: it is rendered as an `<img>` with a fixed aspect box,
    `loading="lazy"`, `referrerPolicy="no-referrer"` and a decode failure falling back to the card
    without an image. The image URL's scheme is checked the same way the page URL's was.
  - The card's link carries `rel="noreferrer noopener"` and opens in a new tab, and the visible host
    is rendered from the **parsed URL's host**, never from a title the page supplied — so a page
    cannot claim to be somewhere it is not.
- **Zod.** v4 for the payload and for the stored record: `z.strictObject`, `z.url()` with a scheme
  refinement, `z.enum` for the status, the `error` parameter naming the field.
- **Authorisation.** The enqueue happens inside an already-authorised handler. The queue handler is
  not user-facing and takes its tenant from the envelope, re-resolving the message inside a scope
  built from it; there is no path by which a client chooses which message a preview is written to.

### UI (route, components)

- **Route.** Unchanged.
- **Components.** Reused: `Card`, `Skeleton`, `Badge`, `Tooltip`. New: the preview card.
- **The card.** Below the message text, inside the same bubble measure: a 16:9 image box on the left
  at wide widths and above the text at 360px, then the site name in `--text-micro` uppercase, the
  title in `--text-body` at two lines maximum, and the description in `--text-caption` at two lines
  maximum. It never grows past 480px wide, so a link in a chat column does not become the chat
  column.
- **States, and this card has all four.** `pending` is a skeleton shaped exactly like the card —
  image box, title bar, two text lines — so the arrival does not reflow the transcript. `ready` is
  the card. `empty` — the page gave nothing usable — renders a single-line link chip with the host,
  which is the same chip `07-S4`'s note website uses, so the two surfaces agree. `failed` renders
  the same chip, because a reader does not need to know our fetcher had a bad day. There is no error
  banner: a preview is an enhancement and its failure is not an event. A message deleted after it
  was posted renders **no** card in any of the four states: `07-S7`'s reader projects a deleted row
  empty, so the preview columns never reach the client — the tombstone is one line and nothing else,
  and a preview surviving its message would be the leak that the empty projection exists to prevent.
- **Tokens.** None missing. `--color-surface-2` for the card ground, `--color-edge-faint` for its
  hairline, `--radius-lg`, `--space-2`/`--space-3`, `--duration-fast` for the fade-in.
- **Motion.** The card cross-fades in at 150 ms on `--ease-out-quint` in the space the skeleton
  already occupied — no height animation, because animating a height inside a scrolled transcript is
  what makes a transcript jump. `prefers-reduced-motion: reduce` removes the fade.

### Quota

Creates no countable row: the preview is two columns on a message row that already exists. Nothing
is added to `resolveLimits()` or `PLAN_QUOTAS`, and no case to the equivalence test.

What this stage genuinely meters is **outbound work**, and it does so in the two places named under
the budget above: the shared 24-hour cache, which bounds fetches per URL globally, and the per-trip
hourly ceiling, which bounds them per tenant. Both are constants with tests. A metered third-party
call would belong in `resolveLimits()` rather than in a module constant; this one is our own egress
against no provider account, so the ceiling's home is the module and its justification is here.

### Tenant isolation test

A new `describe` block appended to the isolation suite. In A's scope: write a preview onto one of B's
message ids — `NotFoundError`, and B's message row unchanged, both columns included; read A's message
in B's scope — `NotFoundError`. Then the case that matters for a shared cache: a URL previewed by B
and then posted by A resolves from the cache without a second fetch **and** the record written is
A's own message row, so a cache hit never carries a row across a boundary. Functions covered:
`setMessageLinkPreview` and the extended message reader in `src/server/repos/collab.ts`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Migration review for the two columns: two `ALTER TABLE … ADD COLUMN`, no rebuild, no `DROP`, one
  journal entry.
- Unit tests in `src/lib/__tests__/link-preview.test.ts`: the first URL is chosen and later ones
  ignored; a URL inside a code span is not extracted; a trailing bracket or full stop is not part of
  the URL; normalisation strips a fragment and orders query parameters so two spellings of one link
  share a cache key; entity decoding is applied once and not twice; a title containing a tag is
  returned as literal characters and never as markup; and every extracted field is capped.
- Unit tests in `src/server/queue/__tests__/link-preview.test.ts`, against a fake fetch: the timeout
  aborts; the redirect cap is enforced; a body past the cap is truncated rather than read; a private
  or loopback host is refused before a request is made; a second request for one URL inside the TTL
  makes no fetch; the per-trip hourly ceiling refuses the ninth; and a redelivered envelope writes
  the same row once.
- Playwright, the invocation of `07-S1` with this stage's own `test.describe`, with the outbound
  fetch intercepted by `page.route()` so no test in this repository ever reaches a third party.
- Browser evidence at 360, 1280 and 2560 in both themes, in three states: the pending skeleton, held
  open by a `page.route()` that delays the read; the ready card; and the empty-result chip. Selectors
  `[data-part="link-preview"]` and `[data-part="link-chip"]`, each verified by a `count()` of 1 in
  the spec. Frames under `.claude/ultrabuild/shots/<slug>/round-<n>/07-S8/`.
- Layout shift after the settle mark, per engine, measured across the pending-to-ready transition,
  which is the entire reason the skeleton is the card's own shape. WebKit stated as unsupported.
- Console silent; `fatal` empty.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, exactly as under `07-S1`.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on the card, which is a link and behaves
      like one.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`: the card-shaped skeleton,
      the empty-result chip, and the failed-result chip that is deliberately the same.
- [ ] Motion 150–260ms on `--ease-out-quint`, opacity only for the card's arrival,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused; a light-mode preview
      image on a dark card gets its own hairline so it does not float.
- [ ] 360px, 1280px and 2560px; at 360 the image sits above the text and the card never exceeds the
      bubble.
- [ ] Keyboard reachable end to end: the card is one focusable link with an accessible name naming
      the host and the title, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- No package is required: the metadata parse is a bounded string extraction over a capped byte
  window, written here, and it is deliberately not a general HTML parser. If a future need turns it
  into one, that is a new decision and a new register entry, not a quiet growth of this module.
- No binding is required. Outbound fetch is available to a Worker by default, and the ceilings above
  are ours rather than the platform's.
- The abbreviated-month deferral of `12-verification-protocol.md` §7.2 applies to this stage's
  baselines.
- `COL-05 → COL-03` is satisfied by `07-S3` in wave 2.

## Stage 07-S9 — What's next

### Stage id

`07-S9` · Wave 3 · effort **M**.

### Reference rows

`COL-09` absent → **done**. A compact widget showing the next few scheduled things across the whole
trip, grouped by day, with the people expected at each.

The join table it needs exists and has no reader: `assignment_participants` is a
composite-primary-key table (`src/server/db/schema.ts:564-579`) whose only writer is
`setAssignmentParticipants` (`src/server/repos/itinerary.ts:364`). The precise claim, because "no
caller anywhere" would be refuted by one grep: `grep -rn setAssignmentParticipants src` returns the
definition, the development seeder at `src/routes/api/dev/-seed/apply-trip.ts:264` and the isolation
suite — **no production caller and no reader of any kind**. This stage is its first reader, which
also means the widget must behave correctly when the table is empty — and it does: an assignment
with no participants shows every trip member, because "everyone" is the honest reading of "nobody
was singled out".

This stage also registers the fourth sub-feature in `07-S2`'s registry, with its toggle, because the
toggle now has something to switch.

Sourcing: `wiki: Collab-Whats-Next`.

### Owned paths

- `src/server/fns/collab-next.ts` — new. The payload builder and nothing else; the widget writes
  nothing.
- `src/server/repos/itinerary.ts` — edit. The upcoming read and the participant read. **Shared
  across waves with `01-S4` (`01-trips-core.md`, wave 2)**, which builds the merged day timeline in
  the same module; this claim is wave 3 and reads the ordering that stage lands rather than
  redefining it.
- `src/components/modules/collab/whats-next.tsx` — new.
- `src/components/modules/collab/next-model.ts` — new. Grouping and the day labels, pure.
- `src/components/modules/collab/modules.ts` — edit. Registers the fourth sub-feature.
- `src/routes/_app/trips/$tripId/collab.tsx` — edit. Mounts the widget in the composition `07-S2`
  built for it.
- `src/routes/_app/trips/$tripId/-server/collab.ts` — edit. Composes the fourth payload builder.
- `src/components/modules/collab/__tests__/next-model.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/collaboration-and-sharing.visual.spec.ts` — append.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — this stage's own baselines only.

No route file changes, so `pnpm generate-routes` is not run.

### Data and migration

None. `day_assignments` carries the day, the place, the order, the start and end times and the
duration; `assignment_participants` carries the people; `days` carries the date. Every column this
stage reads exists. No migration is generated and nothing is backfilled.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/itinerary.ts` gains `listUpcomingAssignments(scope, tripId,
{ from, limit })` — assignments on days at or after a date, ordered by day date then by the day's
  own order index, capped at the limit — and `listAssignmentParticipants(scope, assignmentIds)`,
  which returns the join rows for exactly the ids given. Both are built on `tenantFilter()`; the
  first rides `day_assignments_org_trip_idx` and joins `days` for the date, and the second rides
  `assignment_participants_org_idx`. Neither reads a row for a day the trip does not own.
- **Server function.** No new endpoint: the payload builder is called by the collaboration screen's
  existing loader, which is the round trip the screen already makes. A widget that fetches
  separately would be a second request for data the first one could have carried.
- **Zod.** The builder's options are a `z.strictObject` with `z.iso.date()` for the boundary and a
  literal-union limit, with the `error` parameter. The date the widget starts from is the server's
  own day, read through `src/server/clock.ts`, and **never** a date from the client — a client-chosen
  "today" is how a widget becomes a way to read a trip's whole schedule one page at a time.
- **Authorisation.** In the loader's handler: `appScope()` then `requireTrip`, so the trip is
  re-resolved in the caller's tenant and a foreign id is a `NotFoundError` before an assignment is
  read.
- Nothing slow, nothing enqueued. Two indexed reads, capped at the widget's own size.

### UI (route, components)

- **Route.** Unchanged.
- **Components.** Reused: `Card`, `SectionLabel`, `AvatarStack`, `Avatar`, `Chip`, `Badge`,
  `Separator`, `EmptyState`, `Skeleton`, `Tooltip`, `ScrollArea`. New: the widget and its pure model.
- **The widget.** Up to eight upcoming entries, grouped under a heading per day: "Today",
  "Tomorrow", then the weekday and date. Each row shows the time, the place name, and an
  `AvatarStack` of the expected people. A row with no start time shows "Time not set" in
  `--color-ink-3` rather than an empty column, and sorts after the timed rows within its day, which
  is the only ordering that does not imply a time it does not have. Times are `tabular-nums` so the
  column edge is straight.
- **Participants.** The stack shows up to five avatars and a `+n` chip; its accessible name lists
  the names in full. When an assignment has no participant rows, the stack shows the trip's members
  and the row is labelled as expected of everyone, which is stated in the tooltip rather than left
  for the reader to guess.
- **States.** Empty has two distinct forms and both are designed on `--color-surface-2`, because
  telling them apart is the whole value of the widget: a trip with nothing scheduled at all says
  "Nothing scheduled yet" and offers the planner as the action; a trip whose schedule is entirely in
  the past says "This trip is behind you" and offers the journal. Skeleton — one day heading and
  three rows with a time bar, a title bar and an avatar circle. Error — an `Alert` variant `danger`
  inside the card with "Try again".
- **Tokens.** None missing. `--color-surface-2`, `--color-ink-3` for the unset time,
  `--color-edge-faint` for the row rule, `--radius-xl`, `--space-3`/`--space-4`,
  `--text-micro` for the day headings.
- **Motion.** Rows enter at 220 ms on `--ease-out-quint` with a 4px rise, staggered 24 ms and capped
  at eight — which is also the widget's size, so the cap is never reached by accident.
  `prefers-reduced-motion: reduce` collapses to opacity.

### Quota

Creates no countable row. The widget is read-only: it writes nothing, and every row it reads was
created and counted by the planner's own path. Nothing is added to `resolveLimits()` or
`PLAN_QUOTAS`, and no case to the equivalence test.

What it does consume is **rows read**, which D1 bills whether returned or not, so the read is capped
at the widget's size, ordered on an index that already leads with `organization_id`, and the
participant read is keyed to exactly the ids on screen rather than to the trip.

### Tenant isolation test

A new `describe` block appended to the isolation suite. In A's scope: list upcoming assignments for
B's trip id — an empty list, not B's rows; read participants for a set of assignment ids that mixes
A's and B's, asserting only A's join rows come back rather than the call failing; and confirm that a
day id belonging to B cannot pull B's assignments into A's result through the join. B's rows are
unchanged afterwards. Functions covered: `listUpcomingAssignments` and `listAssignmentParticipants`
in `src/server/repos/itinerary.ts`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests in `src/components/modules/collab/__tests__/next-model.test.ts`: today, tomorrow and a
  weekday label are chosen against a fixed server day; untimed rows sort after timed rows within a
  day and never before; grouping emits a heading once per day; the cap is eight entries and not
  eight days; and an assignment with no participant rows resolves to the full member list.
- Playwright, the invocation of `07-S1` with this stage's own `test.describe`. The fixture day is
  pinned to `BASELINE_DAY` so "Today" is a constant and not the morning the suite happened to run.
- Browser evidence at 360, 1280 and 2560 in both themes, in three states: the populated widget; the
  never-scheduled empty state; and the trip-is-past empty state, both reached through a fixture trip
  rather than by hiding rows. Frames under `.claude/ultrabuild/shots/<slug>/round-<n>/07-S9/`.
- Layout shift after the settle mark, per engine, WebKit stated as unsupported.
- Console silent; `fatal` empty.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, exactly as under `07-S1`.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every row link and the avatar stack.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`, with the two empty states
      genuinely distinct.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused.
- [ ] 360px, 1280px and 2560px; at 360 the widget is a full-width card above the conversation, not a
      squeezed sidebar.
- [ ] Keyboard reachable end to end: each row is one focusable target, the stack is focusable and
      names its people, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- `COL-09 → TRP-08` is supplied by `01-trips-core.md`, stage `01-S4`, in wave 2. That stage owns
  the merged day timeline and the ordering this widget reads; if it has not landed, this stage waits
  rather than inventing a second ordering.
- `COL-09 → COL-02` is satisfied by `07-S2` in wave 1.
- The abbreviated-month deferral of `12-verification-protocol.md` §7.2 applies to this stage's
  baselines.
- No package is required. No binding is required.

## Stage 07-S10 — The trip invite link

**Delivered:** #1024 completes the owner panel and end-to-end proof after #1020, #1022 and #1023.
`COL-11` is delivered as narrowed in `.ai/specs/2026-10-08-the-trip-invite-link.md`: the link grants
trip membership only to existing members of the trip’s workspace, never workspace membership.

### Stage id

`07-S10` · Wave 5 · effort **M**. The second and last unauthenticated surface in the product.

### Reference rows

`COL-11` absent → **done**. One rotating link per trip that adds an existing account to the trip,
with a sign-in round trip that returns to the invitation, an immediate invalidation on regenerate,
and a way to switch it off.

It is a different object from the workspace invitation that already exists.
`src/routes/(auth)/accept-invitation.$invitationId.tsx` accepts an **organization** invitation issued
by the authentication library to a named email address, with its own lifecycle and its own table.
This is a trip-level, address-less, single rotating secret. Conflating the two would be the worst
available outcome — a link that silently grants workspace membership — so they share no table, no
route and no token space.

Sourcing: `wiki: Invite-Links`.

### Owned paths

- `src/routes/join/$token.tsx` — new. The unauthenticated landing. **A new route file, so this stage
  runs `pnpm generate-routes`** and the regenerated tree travels inside its diff; the generated tree
  is never hand-edited and is not listed here.
- `src/routes/join/-server/join.ts` — new. Token resolution, the sign-in round trip and the join.
- `src/routes/join/-ui/join-card.tsx` — new. The landing card and its four states.
- `src/server/repos/invites.ts` — new. The invite record's repository.
- `src/server/repos/index.ts` — edit. One export line for the new module. **Shared across waves
  with `01-S6` (`01-trips-core.md`, wave 4)**, which exports its own additions from the same barrel;
  this claim is wave 5, so the line is appended to a file that already carries `01-S6`'s.
- `src/server/fns/sharing.ts` — edit. The owner-side invite controls, beside the share-link controls
  `07-S6` put there.
- `src/components/modules/collab/share-dialog.tsx` — edit. The invite tab.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `src/server/repos/__tests__/invites.test.ts` — new.
- `e2e/collaboration-and-sharing.visual.spec.ts` — append.
- `e2e/__screenshots__/collaboration-and-sharing.visual.spec.ts/` — this stage's own baselines only.

### Data and migration

One table, **filed to `00-foundations.md` as the wave-4 schema stage's requirement**, so it lands
before this stage's wave opens.

New table `trip_invite_links`: `id` from `newId()`; `organization_id` not null referencing the
organization with cascade delete; `trip_id` not null referencing `trips` with cascade delete;
`token` text not null holding a **digest, never a secret**; `role` text not null default `editor`,
the value the joiner is given on `trip_members`; `created_by`; `disabled_at` nullable epoch
milliseconds; `last_used_at` nullable; `use_count` integer not null default 0; the standard
timestamp pair. Indexes: a unique index on `token`, a unique index on `trip_id` — one rotating link
per trip, which is what "single" means and is enforced by the database rather than by a convention —
and `(organization_id, trip_id)` as the leading composite.

**Why a new table rather than a scope on `share_links`.** A share link grants anonymous read of a
chosen set of sections. An invite link grants membership. They differ in lifecycle, in
authorisation, in what a leak costs and in what revocation means. Encoding both in one table would
put one query between a public read token and a membership grant, and the first mistake in that
query is a stranger on a trip. Two tables make that mistake unrepresentable.

No `CHECK` on the role column; the enum is held by Zod in the repository, as
`00-foundations.md` prescribes for a constraint that would otherwise force a rebuild.

Backfills nothing: the table is new and every trip starts with no invite link.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/invites.ts`, built on `createTenantRepository`, exporting
  `readTripInvite(scope, tripId)`, `rotateTripInvite(scope, tripId, role)`,
  `disableTripInvite(scope, tripId)`, `touchTripInvite(scope, inviteId)` and the one unscoped
  resolver, `findLiveTripInviteByToken(db, secret)`. The secret is `nanoid(32)`, shown once; only its
  digest is stored, using the same helper `07-S6` added, so the two surfaces cannot drift in how they
  hash. Rotation overwrites the digest in place, so the previous secret stops resolving on the next
  request with no grace period — which is the only thing a "regenerate" control can honestly promise.
- **How the request resolves a tenant context without trusting a client-supplied identifier.** The
  rule is stated in full here as well as under `07-S6`, because a reader of one stage must not have
  to read the other to know what an unauthenticated request is allowed to do:
  1. The URL carries **one** value, an opaque secret. No id of any kind is read from the path, the
     query string or a header.
  2. It is hashed and matched against the unique digest index. A miss renders the unavailable state;
     there is no message distinguishing "never existed" from "disabled".
  3. The **tenant comes from the matched row**: organization id, trip id and role, none of them ever
     taken from the request. The scope used to read the trip's public-facing details — its title,
     its dates, its destination and who invited you — is built from that row with the inviter's user
     id and the least privileged role.
  4. **The join is not performed with that scope.** Adding a member is done in the _joining user's
     own_ authenticated context: the visitor signs in or registers, returns to the same URL, and only
     then is the row written — through the existing `addTripMember`
     (`src/server/repos/trips.ts:434-441`), never through an insert of this stage's own — with the
     joining user's session as the identity and the invite row as the authorisation. A scope derived
     from a link may read; it may never write a membership.
  5. The invited role is the row's, never the request's. A joiner cannot ask for `owner`.
- **The sign-in round trip.** An anonymous visitor sees the trip's name, who invited them, and one
  action. It carries them to the existing sign-in route with a redirect back to this URL — the same
  `?redirect=` contract `src/routes/_app/route.tsx` already uses — so a person without an account
  registers, verifies and lands back on the invitation rather than on a dashboard wondering what
  happened. The token is never placed in a cookie and never in local storage; it stays in the URL,
  which is the only place it needs to be.
- **No scope toggles, one dimension.** Unlike the public share link, this surface exposes nothing to
  switch on or off section by section: an invitation either adds you to the trip or it does not. The
  single dimension it does expose is the **role** the link grants, chosen by the owner from the trip
  member roles the schema module already declares and stored on the row, never sent by the joiner.
- **What rotation and disabling do to someone already on the page.** A visitor holding an open
  `/join/<token>` tab is not connected to anything: there is no socket, and the page is a rendered
  invitation. The token is therefore re-resolved at the moment the join is submitted, not only when
  the page was rendered, so a link regenerated or switched off while someone was reading it fails
  that submission and the card swaps to the unavailable state in place — no membership is written and
  no error page is shown. The same re-resolution happens on any navigation or reload. Nothing already
  granted is taken back: a person who joined before the rotation stays on the trip, and removing them
  is `TRP-11`'s path, which the dialog says in one line so an owner is not misled about what
  "regenerate" undoes.
- **Already a member** is a state, not an error: the page says so and offers the trip.
- **The workspace boundary is the one thing this row must not blur.** A trip belongs to an
  organization, and trip membership is a row inside it. A joiner who is not already a member of that
  organization cannot be added to the trip by a link, because that would make a trip invite a
  workspace invite with fewer checks. That case renders its own state — the invitation needs a
  workspace invitation first — and points at the existing organization invitation flow. This is the
  hosted multi-tenant reading of a single-tenant behaviour, and it is stated rather than discovered.
- **Zod.** v4: `z.strictObject`, the token as a bounded opaque string, the role as a `z.enum` over
  the trip member roles the schema module already declares, the `error` parameter naming the field.
- **Rate limiting.** As `07-S6`: a per-IP token bucket in `KV` on the public resolution, a 429 above
  it, and no timing difference between a wrong token and a refusal.
- Nothing slow, nothing enqueued. Joining does mirror a `trip` patch so anyone with the trip open
  sees the new member arrive.

### UI (route, components)

- **Route.** `/join/$token`, a new top-level route file outside `_app`, so no authentication guard
  runs and an anonymous visitor is never bounced. Default SSR: the page must render its invitation
  for a reader with no session. `pnpm generate-routes` runs; the generated tree is not hand-edited.
- **Components.** Reused: `Card`, `Button`, `Avatar`, `Badge`, `Alert`, `EmptyState`, `Skeleton`,
  `Separator`, plus `SkipToContent`, `MarketingHeader` and `MarketingFooter` for the guest chrome —
  the same shell `07-S6`'s guest page uses, so the two unauthenticated pages are recognisably one
  product. Owner-side, the invite tab reuses `Tabs`, `Switch`, `Select`, `CopyValue`, `ConfirmDialog`
  and `Tooltip`. No primitive is added.
- **The landing card** has five presentations and each is designed: **invited** — the trip, the
  inviter's avatar and name, the role being offered, and one primary action; **signed in and
  joining** — the action in its loading state; **already a member** — a quiet confirmation and a link
  to the trip; **needs a workspace invitation** — the explanation above with the way forward;
  **unavailable** — the link has been regenerated or switched off, on `--color-surface-2`, with the
  sign-in and marketing links as the exit.
- **The owner's tab.** The link with a copy control, the role the link grants as a `Select`, a
  `Switch` to turn it off, a regenerate control behind a `ConfirmDialog` that states plainly that
  everyone holding the old link loses it immediately, and the use count with `tabular-nums`. Every
  control has rest, hover, focus-visible, active, disabled (for a member who may not invite) and
  loading states.
- **States.** The owner's tab before a link has ever been minted is an `EmptyState` on
  `--color-surface-2` — "No invite link yet" — with "Create link" as the primary action, not a
  disabled control with a blank field beside it. Skeleton — the card outline with a title bar, an
  avatar circle and a button-sized block. Error — an `Alert` variant `danger` with "Try again".
- **Tokens.** None missing. `--color-surface-2`, `--color-canvas`, `--radius-xl`, `--shadow-card`
  with its re-declared dark counterpart, `--space-4`/`--space-6`.
- **Motion.** The card enters at 220 ms on `--ease-out-quint` with a 6px rise; the state change
  after joining cross-fades at 150 ms. `prefers-reduced-motion: reduce` collapses both to opacity.

### Quota

Creates two countable rows, and the honest accounting of them is shorter than the wrong one an
earlier revision of this stage wrote. That revision said the join "goes through
`src/server/repos/members.ts`, which already calls `assertQuota`". Both halves are wrong, and the
greps are one line each:

- `src/server/repos/members.ts:152-160` is the **workspace** member writer: `addMember` asserts the
  `members` metric, which `resolveLimits()` maps from the catalogue's `seats`
  (`src/server/billing/limits.ts:76`, `:226`). It writes the authentication schema's `member` table
  — workspace membership — and has nothing to do with a trip.
- The trip-member writer is `addTripMember` (`src/server/repos/trips.ts:434-441`). It parses its
  input, calls `requireTrip`, and inserts through `tripMembersRepository`. **It asserts no quota at
  all**, and there is no `trip_members`-shaped metric in `resolveLimits()` or in `PLAN_QUOTAS` for
  it to assert.

So the accounting is this:

- **The invite link** is one row per trip, structurally capped by the unique index on `trip_id`
  that the table declares. It is not sold and not metered; nothing is added to `resolveLimits()` or
  `PLAN_QUOTAS` for it, and no case to `src/server/billing/__tests__/limits.test.ts`.
- **The trip membership** is a row in `trip_members`, written by calling `addTripMember` — this
  stage inserts no member row of its own, because a second writer for a membership row is exactly
  how a link becomes a way around whatever ceiling that writer later grows. It consumes **no seat**,
  and that is a consequence of this stage's own workspace rule rather than a loophole: a joiner must
  already be a member of the trip's organization, so their seat was asserted by `addMember` when
  they were added to the workspace, and joining a trip inside a workspace they already belong to
  sells nothing new. Claiming a seat ceiling here would be doubly false — the wrong writer, and a
  ceiling that cannot be reached by this path.
- **What actually bounds trip membership**, therefore, is the workspace seat count: every trip
  member is an organization member, so a trip can never hold more members than the workspace has
  seats. That is a derived bound and it is the one this stage relies on.

Adding a metered `trip_members` metric would be a catalogue change — a key in `PLAN_QUOTAS`, a
resolver arm in `resolveLimits()`, a published number, a case in the equivalence test and an
`assertQuota` call inside `addTripMember` — and it is **not** this stage's to make: that writer
belongs to `TRP-11`, which `01-S6` closes in wave 4. It is recorded here as a finding for that stage
rather than invented here, because a ceiling asserted in two places drifts, and a ceiling published
in none is not a ceiling.

The per-IP bucket on the public resolution is this stage's real ceiling and the one that bounds
unauthenticated cost, exactly as under `07-S6`.

### Tenant isolation test

A new `describe` block appended to the isolation suite, plus
`src/server/repos/__tests__/invites.test.ts` for the unscoped resolver, and the new table joins the
suite's `cases` table so it inherits the five standing assertions.

The isolation case, in A's scope: read B's trip's invite by B's trip id — `NotFoundError`; rotate and
disable B's invite — `NotFoundError` for both, with B's row byte-identical afterwards, `token` and
`use_count` included; and touch B's invite id — `NotFoundError`.

The resolver's cases: a valid secret resolves to its own organization and trip and to no other; a
disabled row resolves to null; a rotated-away secret resolves to null immediately, asserted by
rotating and then resolving the old value in the same test; a scope built from a resolved row can
read that trip's public details and raises `NotFoundError` for any other trip id; and a joining user
who is not a member of the row's organization is refused rather than added, with no `trip_members`
row written. Functions covered: `readTripInvite`, `rotateTripInvite`, `disableTripInvite`,
`touchTripInvite` and `findLiveTripInviteByToken`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `pnpm generate-routes` is run because a route file is added, and the regenerated tree is inspected
  in the diff rather than edited.
- Migration review: one `CREATE TABLE` with three indexes, no rebuild, no `DROP`, one journal entry.
- Unit tests as named above, plus one holding that the secret is never returned by any read — only
  by the mint and the rotate — which is the property that makes storing a digest worth doing.
- Playwright, the invocation of `07-S1` with this stage's own `test.describe`. The join route is
  tested **both** without a session, where it must render the invitation and offer sign-in, and with
  the cached demo session, where it must complete; the anonymous half uses a fresh context rather
  than `AUTH_STATE`.
- Browser evidence at 360, 1280 and 2560 in both themes, for four surfaces: the anonymous
  invitation; the already-a-member state; the unavailable state; and the owner's invite tab, reached
  with `--click '[data-part="invite-tab"]'`, the selector verified by a `count()` of 1 in the spec.
  The anonymous frames are captured **without** `--auth`. Frames under
  `.claude/ultrabuild/shots/<slug>/round-<n>/07-S10/`.
- Layout shift after the settle mark, per engine, WebKit stated as unsupported.
- Console silent; `fatal` empty.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, exactly as under `07-S1`.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on the join action, the copy control, the
      role select, the switch and the regenerate confirmation.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`, including the never-minted
      owner state and the unavailable landing.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused; the landing is
      designed in dark, not inherited.
- [ ] 360px, 1280px and 2560px; at 360 the landing card is the whole screen with the action above
      the fold.
- [ ] Keyboard reachable end to end, with a skip link, one focus target for the primary action, and
      WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- `COL-11 → TRP-11` is supplied by `01-trips-core.md`, stage `01-S6`, in wave 4 — "Who is on this
  trip, including the people without accounts". That stage owns trip membership, its roles and its
  removal path; this stage adds a way in and must not invent a membership writer of its own. If it
  has not landed, this stage waits.
- No package is required. No binding is required: the digest uses `crypto.subtle` and the bucket
  uses the existing `KV` binding.
- One observation recorded rather than acted on, because it belongs to another row: this stage adds
  no caller of `closeTripRoom`. Evicting a live socket is what **removal** from a trip needs, not
  what an invite link needs, and #1050 gave removal, role changes and the trip lifecycle their
  callers (`closeRoomFor` and `closeRoom` in `src/server/fns/context.ts`).

## Cross-plan collisions

Run against the plan set as it stands, with this plan's ordinal:

```text
$ node scripts/ultrabuild/check-plan-collisions.mjs 07
plans 8 · stages 48 · owned paths 282

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (7) — legal; each plan must name the other:
  src/server/fns/collab.ts
      00-foundations.md  00-S2  wave 0  (edit)
      07-collaboration-and-sharing.md  07-S2  wave 1  (delete)
  src/server/queue/types.ts
      00-foundations.md  00-S4  wave 0  (edit)
      07-collaboration-and-sharing.md  07-S8  wave 4  (edit)
  src/server/queue/consumer.ts
      00-foundations.md  00-S4  wave 0  (edit)
      07-collaboration-and-sharing.md  07-S8  wave 4  (edit)
  src/server/repos/trips.ts
      01-trips-core.md  01-S1  wave 1  (edit)
      01-trips-core.md  01-S6  wave 4  (edit)
      07-collaboration-and-sharing.md  07-S6  wave 2  (edit)
  src/server/repos/itinerary.ts
      01-trips-core.md  01-S4  wave 2  (edit)
      07-collaboration-and-sharing.md  07-S9  wave 3  (edit)
  src/routes/_app/trips/$tripId/-server/plan.ts
      01-trips-core.md  01-S4  wave 2  (edit)
      07-collaboration-and-sharing.md  07-S1  wave 1  (edit)
  src/server/repos/index.ts
      01-trips-core.md  01-S6  wave 4  (edit)
      07-collaboration-and-sharing.md  07-S10  wave 5  (edit)
```

**No same-wave exclusive collision involves this plan**, which is the state this section exists to
prove rather than to assert. Every path the run lists under _touched by more than one plan in
different waves_ is legal — waves are sequential — and each is named in the stage of this plan that
owns it, with the sibling stage id, so a reader who opens a stage sees its constraint without coming
back here:

| Path                                            | Owned here by    | Sibling stage and wave                                 |
| ----------------------------------------------- | ---------------- | ------------------------------------------------------ |
| `src/routes/_app/trips/$tripId/-server/plan.ts` | `07-S1`, wave 1  | `01-S4` (`01-trips-core.md`), wave 2                   |
| `src/server/fns/collab.ts`                      | `07-S2`, wave 1  | `00-S2` (`00-foundations.md`), wave 0                  |
| `src/server/repos/trips.ts`                     | `07-S6`, wave 2  | `01-S1` wave 1 and `01-S6` wave 4 (`01-trips-core.md`) |
| `src/server/repos/itinerary.ts`                 | `07-S9`, wave 3  | `01-S4` (`01-trips-core.md`), wave 2                   |
| `src/server/queue/types.ts`                     | `07-S8`, wave 4  | `00-S4` (`00-foundations.md`), wave 0                  |
| `src/server/queue/consumer.ts`                  | `07-S8`, wave 4  | `00-S4` (`00-foundations.md`), wave 0                  |
| `src/server/repos/index.ts`                     | `07-S10`, wave 5 | `01-S6` (`01-trips-core.md`), wave 4                   |

`src/server/repos/__tests__/tenant-isolation.test.ts` and
`e2e/collaboration-and-sharing.visual.spec.ts` are shared by many stages and are not in that table
on purpose: both are `append` on every stage that names them, which is the documented cooperative
disposition and is not a collision. The checker agrees — it filters `append` out before it compares.

#### Three limits of this run, measured rather than assumed

- **Four stages state no parseable wave and are therefore invisible to the comparison**: `11-S1`,
  `11-S2`, `11-S3`, and an entry the run prints as `04-S2` which is not the real one. That fourth
  entry is an example heading inside a fenced code block at `12-verification-protocol.md:26`, which
  the parser reads as a stage because it splits on a `## Stage` line without respecting code fences;
  the real `04-S2` states wave 1 and is checked. The three `11-*` stages are unscheduled by design
  and say so in their own text. None of the four is a file of this plan, so none can be fixed from
  here; each is reported as a contract extension. An earlier run of the same command listed a fifth,
  `04-S7`; that stage has since been given a wave in its own file, which is the change that took the
  count from five to four and is the reason this section insists on the re-run below rather than on
  its own numbers.
- **The parser reads an owned path written as a list item — a dash, the path in backticks, an em
  dash, then the mode — and does not read a table row.** That is how this plan's wave-1 claim on
  `src/server/do/protocol.ts` and `04-S2`'s claim on the same module both sat in the plan set for a
  whole round without the checker seeing either: `04-S2` listed its owned paths as a Markdown table.
  It has since been rewritten as a list, and both stages have now dropped the module — this plan
  because it declares no entity kind, `04-S2` because it stopped declaring one. Nobody claims
  `src/server/do/protocol.ts` today, which is the correct outcome and not a stalemate: a stage that
  genuinely needs a kind takes the module in a wave where the checker shows it free.
- **`04-S2`'s own note still describes this plan as taking that module "in the same wave".** That
  sentence was true when it was written and is not any more. It lives in a file this plan does not
  own, so it is reported rather than edited.

The sibling plans were being written while this one was, and two more of them (`09` and `10`)
appeared during this stage's own revision. A snapshot is not a proof: **re-run the checker before
scheduling any stage of this plan**, and treat this section as the record of one run rather than a
standing guarantee.
