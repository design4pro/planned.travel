# 0034. A journey whose trip is deleted stays with its owner

Status: accepted
Date: 2026-10-03
Amends: ADR 0020 (who may read a journey that names no trip)
Amended by: ADR 0043 (the owner of a journey that stays may be a Former member)

## Context

ADR 0020 made a journey tied to a trip readable exactly when that trip is readable, and a journey tied
to no trip readable by every member of the workspace. It left one gap open (#520): `journeys.trip_id`
is `ON DELETE SET NULL` and `deleteTrip` hard-deletes the trip, so a journey written about a private
trip became, the moment the trip was deleted, a journey that names no trip. Its title, subtitle,
dates, entries - including entries written by other members of the deleted trip - and photographs were
then readable by every member of the workspace, and nothing in the row told it apart from a journey
that never had a trip.

The product writes little of this today: `publishJourney`, `updateJourney`, `deleteJourney`,
`createEntry` and `addPhoto` are called only by the dev seed, so what is at stake in production is
mostly a journey's title, subtitle and dates. The gap is still a rule that says the opposite of ADR
0007 for exactly the trips a member chose to keep private.

Three outcomes were open: delete the journal with the trip (Option A), keep the orphan readable by its
owner only (Option B), or accept the behaviour and record it (Option C).

## Decision

**Option B.** A journey whose trip was deleted stays, and is readable only by its owner
(`journeys.owner_user_id`). A nullable `journeys.trip_deleted_at` timestamp, set in the same
`runBatch` that removes the trip, tells it apart from a journey that never had a trip. The column has
no foreign key: there is nothing left to point at.

The read rule in `readableJourneyFilter` (`src/server/repos/journey.ts`) becomes: the trip is readable
under ADR 0007, **or** the journey names no trip and either `trip_deleted_at` is null (it never had
one: the whole workspace, as ADR 0020 says) or the caller owns it. Every reader and every id-keyed
writer already goes through that predicate or `inReadableJourney`, so none gets its own copy.
`journeys.visibility` stays unread, as in ADR 0020.

Rejected: **Option A, cascading the journal with the trip.** One click by a trip owner who may not own
the journey would destroy other members' entries irreversibly, the delete-trip dialog does not warn
about it, and `journey_photos` rows would go while their objects stay in R2, referenced by nothing.
Rejected: **Option C, accepting the leak.** It keeps on purpose what ADR 0007 forbids.

## Consequences

- **Forward-only.** Trip deletion nulls both `journeys.trip_id` and `journey_entries.source_trip_id`, so
  an orphan made before this change cannot be told apart from a journey that never had a trip. Those
  rows are not backfilled and stay readable by the whole workspace. The same holds for a trip deleted
  by a Worker that still runs the old code between the migration and the deploy: it removes the trip
  without stamping its journeys.
- **An orphan whose owner leaves the workspace becomes unreadable**, and stops counting against the
  journeys quota (#799). `createJourney` counts the tenant's journeys less any that names no trip,
  carries `trip_deleted_at` and whose owner holds no `member` row in the workspace. The count is
  worked out when the quota is checked, because people leave through Better Auth's organization
  endpoints and through the console deleting the user, not through `removeMember`; it corrects itself
  if the owner is added back. Nothing is deleted or moved, and no read rule changes. A journey that
  never had a trip keeps counting, whoever owns it. What else a departed member's data amounts to is
  #807.
- **The reader set can be widened later.** Letting entry authors other than the owner read an orphan,
  or re-linking one to another trip (`updateJourneyInput` has no `tripId`), is a new record that
  amends this one.
- **Additive migration** (`BACKWARD_COMPATIBILITY.md` §1): `ALTER TABLE journeys ADD trip_deleted_at
integer`. Rolling back means no longer reading the column.
- `deleteTrip` is also the clean-up of a failed trip copy (`src/server/queue/handlers/trip-copy.ts`);
  a copy target has no journeys, so the marker update touches none and the path is unchanged.
- `member-isolation.test.ts` pins the rule for every journal reader and writer, and
  `tenant-isolation.test.ts` pins that a deletion in one workspace marks nothing in another.

## Amendment (ADR 0043)

When the owner of a journey is erased, the journey stays and its `owner_user_id` becomes the
workspace's Former member id (`erased_<nanoid>`). The read rule is unchanged: only the owner id
reads the journey, and no session can hold a Former member id, so the journey is kept for the
record and read by nobody until the workspace deletes it. Entries and photographs written by other
members are never taken by an erasure.
