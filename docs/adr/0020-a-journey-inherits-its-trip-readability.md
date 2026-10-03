# 0020. A journey is read by whoever may read the trip it names

Status: accepted
Date: 2026-09-15

## Context

ADR 0007 made a trip private to its members unless its `visibility` says `organization`, and #196
carried that predicate into the journal's two _trip_ readers. The journal's _journey_ readers kept
answering for the whole organization (#456): a member on none of a workspace's trips could list the
journey written about a private trip, open its story by id, and see its entries in the recent strip
and its moods in the tally. A journey is reachable without its trip ever being read, so ADR 0007 does
not reach it on its own.

A journey is not only a view of a trip. It may name no trip at all, and the `journeys` row carries an
`owner_user_id`, a `visibility` column (`private` / `organization` / `public`, default `private`) and
a `public_token` minted on publish. Three readings were open: the journey inherits its trip's
readability; the journey's own `visibility` governs it; the journey belongs to its author until
published. Nothing in the product writes `journeys.visibility` - the create server function and the
new-journey dialog offer no choice - so every row holds the `private` default.

## Decision

A journey tied to a trip is readable exactly when that trip is readable under ADR 0007: by the trip's
members, and by every member of the organization when the trip's `visibility` is `organization`. A
journey tied to no trip is readable by every member of the organization, because there is no trip to
inherit from. A journey the caller may not read raises `NotFoundError`, exactly as a foreign tenant's
does. The predicate lives beside the journey readers in `src/server/repos/journey.ts` and asks the
trip through `readableTripFilter`, so a journey and its trip can never disagree about who may see
them.

`journeys.visibility` is not read, and `public_token` keeps meaning session-less publication only.

Considered and rejected: the journey's own `visibility`. Enforcing a column nobody can set would hide
every existing journey from everyone but its author on the day it shipped, and it would tie what a
published token means to a value the traveller never chose. Also rejected: author-only until
published. It takes away the journal a workspace writes together - entries already carry their own
author - and it conflicts with the trip that journal describes being readable by its members.

## Consequences

Every reader that returns a journey row or something derived from one - the journal list and its
counts, the direct getters, the story, the recent entries, the mood tally - applies the predicate, and
`member-isolation.test.ts` carries the case beside the trip ones. `journalCoverage` is unchanged: it
counts trips, so it asks `readableTrips`. A write that resolves a journey by id asks the same
question: the readers landed first (#456), and the writes and the journey-id-keyed helpers followed
(#521). If a traveller is ever given a journey visibility control, it narrows this rule rather than
replacing it, and that is a new record.

Deleting a trip does not delete the journey written about it: `journeys.trip_id` is
`ON DELETE SET NULL`, so the journey becomes one tied to no trip. Read plainly, this rule would make it
readable by the whole organization, which is a gap in the rule rather than a choice; ADR 0034 closes it
(#520): such a journey stays with its owner, marked by `journeys.trip_deleted_at`, and a journey that
never had a trip stays the organization's.
