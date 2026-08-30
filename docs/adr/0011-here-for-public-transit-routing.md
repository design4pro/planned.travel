# 0011. Public-transit routing is bought from HERE, behind our own proxy

Status: accepted
Date: 2026-08-30

## Context

`BKG-08` (the connection search, `docs/plans/03-reservations-and-transport.md`, `03-S3`) was parked
as blocked on "a commercial decision", with no provider named and no budget agreed. The reference
product ships the capability on Transitous (`api.transitous.org`), a community MOTIS instance over
public GTFS feeds, free and without a key.

Transitous is closed to us, in its own words: "Due to data source licences and resource
prioritisation, commercial use is not allowed", and its eligibility rules require the calling project
to be open-source and non-commercial. We are neither. This is not a rate-limit problem we could
negotiate around; it is the terms.

We then measured what is left. Transitland forbids commercial use on its free tier and its
pay-as-you-go plan does not exist yet. Geoapify has no public-transit routing at all. Mapbox has
none either — its Directions API offers driving, walking and cycling only — and we hold no Mapbox
contract in any case, because our map is MapLibre over Protomaps archives in our own R2. Google's
Routes API does transit and is dearer than HERE. Self-hosting MOTIS is genuinely open (MIT, no
commercial restriction) but is a stateful, memory-resident routing service that cannot run on
Workers, and it does not escape the licence question — it moves it, because Transitous cites data
source licences as one of its two reasons, so each GTFS feed we ingested would need its own
commercial-use review.

## Decision

We buy transit routing from HERE's Public Transit API v8: 30,000 requests a month free, then
$0.75 per 1,000, with commercial use permitted self-serve. At one search costing $0.00075, a hundred
searches on a trip is seven and a half cents, which a subscription absorbs without noticing.

Three properties bound it, and none is optional. The provider is called **server-side only, behind
our own proxy**, so the browser never holds the key and the response shape is ours rather than
HERE's. A search result is keyed on two stops and a date, which is a **public fact**, so its cache is
shared across tenants and the second traveller to search a route costs nothing. The per-tenant rate
is a ceiling in `resolveLimits()` like every other ceiling, never a constant inside a feature module,
because a metered outbound call a noisy tenant can make in a loop is a cost inflicted on every other
tenant.

## Consequences

This is the product's first paid per-request dependency, and it arrives in a codebase whose map data
is deliberately self-hosted; the difference is that tiles are static objects on R2 while a routing
engine is a live service with real-time feeds, so the precedent does not carry.

The proxy is the seam that makes the choice reversible: moving to a self-hosted MOTIS later swaps
what sits behind it and changes nothing in front. Should that day come, ADR 0010's argument applies
again, and the feed-licence review this decision avoids is the work it would cost.

Attribution and caching terms are HERE's to dictate and ours to honour; whatever they require on
screen is a design constraint on the search surface, and it is settled before that surface is
designed rather than after.
