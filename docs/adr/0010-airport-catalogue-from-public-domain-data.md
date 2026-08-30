# 0010. The airport catalogue is public-domain data we build, not a provider we call

Status: accepted
Date: 2026-08-30

## Context

`BKG-07` (the transport endpoint pickers, `docs/plans/03-reservations-and-transport.md`, `03-S2`)
needs to turn a three-letter code into a name, a city, a country and an IANA zone. The plan filed
that lookup as a deferred provider decision in `docs/plans/11-boundaries-and-blockers.md`, `11-S3`,
grouping it with geocoding and routing as "a data-licence and cost decision", which is the reason
`BKG-07` stops at `partial` rather than `done`.

That framing turned out to be wrong. The reference product does not call a provider for this at all:
it builds a bundled dataset at build time from OurAirports
(`davidmegginson.github.io/ourairports-data`), which is **public domain**, keeping large and medium
airports that carry an IATA code and deriving each zone from its coordinates. There is no licence to
negotiate, no key to hold, no per-request cost and no runtime dependency.

## Decision

The airport catalogue is a build-time artefact from OurAirports, loaded into a catalogue table under
`server/catalog` — the one place `CLAUDE.md` exempts from the tenant-scoped repository rule, because
a catalogue belongs to no tenant. A prefix search on the IATA code and a search on the name are
answered from an index, not from a blob held in memory.

`BKG-07` is therefore no longer blocked on `11-S3` and reaches `done`: the picker fills the name, the
city, the country and the zone from a selection, which is the behaviour the row asked for.

Considered and rejected: a KV blob pulled into each isolate (605 KB on every cold start, and a linear
scan in JS instead of an index); an R2 object read by range (needs its own name index, so it ends up
being a database anyway); and keeping the deferral (the licence question it defers has a published
answer, so deferring it records a decision nobody has to take).

## Consequences

Refreshing the catalogue is a build step and a migration, not a deploy: a stale catalogue is a missing
airport, never an outage, and there is no provider whose downtime we inherit. The same shape is
available to any other reference dataset this product needs — station codes, currencies, carriers —
and the argument above is the precedent for reaching for it before reaching for a vendor.
