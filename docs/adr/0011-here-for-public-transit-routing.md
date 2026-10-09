# 0011. Public-transit routing is bought from HERE, behind our own proxy

Status: accepted, amended 2026-10-03 (the cache is per member, not shared across tenants)
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
HERE's. ~~A search result is keyed on two stops and a date, which is a **public fact**, so its cache is
shared across tenants and the second traveller to search a route costs nothing.~~ _Withdrawn by the
amendment below: a cached answer belongs to the member whose Request fetched it._ The per-tenant rate
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

### Amendment, 2026-10-03 - a cached answer belongs to the member who fetched it

The property this ADR called non-optional, a cache shared across tenants, breaks the contract it
was bought under. ADR 0019 read the same clauses for road routing on 2026-09-15 and named this
module as the place the correction belongs (#516). The terms below are the **HERE Platform Terms**
effective 18 September 2023 and their Exhibit 2, as ADR 0019 quotes them.

**What the terms say.**

- "You may not ... Create any Results that contain unenhanced or unmodified HERE Content or scaling
  one Request to serve multiple End Users" (§6.4 l), and "Provide Results and/or HERE Content to
  another person or entity" (§6.4 h).
- An End User is "any entity or person who (i) receives or uses an Application or (ii) accesses all
  or any portion of the HERE Content or Services in or through an Application" (§21.7), and a
  Request is "each API call made to the respective HERE Services to request Results as initiated by
  an End User using an Application, excluding internal server requests in response to each API
  call" (§21.16). Reading the workspace as the End User is arguable and is **rejected**, as in ADR
  0019: every person using the product is equally an End User under (i), and a wrong reading would
  breach on every shared answer.
- "You may not use HERE Materials in a manner that pre-fetches, caches, or stores data or Results,
  except as explicitly allowed by the caching headers (HTTP/1.1 standard) returned by HERE Location
  Services" (Exhibit 2, §1.3).
- No cache or storage outside the Platform "for more than 30 days" (§6.4 j), and for Results in
  Japan "for more than 24 hours" (§6.4 k).

**What changes.**

1. **The key names its owner.** A cached connection search is keyed on the organization, the
   member and the normalised query (two stops, date, clock, mode filter). Both ids are taken from
   the server-side scope and never from request input. Two members of one workspace asking the
   same question are two Requests, and so are two workspaces. The key version moves from `v1` to
   `v2`, so no entry written under the shared key is read again; the old entries age out of KV
   within their own six hours.
2. **HERE's headers decide what is stored.** The provider client reports the response's caching
   headers with the connections. Nothing is stored unless HTTP caching would let a shared cache
   store it (RFC 9111), exactly ADR 0019's rule: no `no-store`, `no-cache` or `private`, and an
   explicit lifetime from `s-maxage`, else `max-age`, else `Expires` minus `Date`, less `Age`. A
   response without one, or with a lifetime under KV's 60-second minimum, is returned to the
   member and not stored. Keying per member does not make the proxy a private cache. An empty
   answer is still never stored. The rule is one exported pure function in `src/lib/http-cache.ts`,
   which the road-routing proxy (#662) imports rather than writes again.
3. **The TTL is the lesser of that lifetime and 24 hours.** The fixed six hours was not derived
   from anything HERE returns. A flat 24-hour cap satisfies §6.4 j (30 days) and §6.4 k (Japan)
   with one number and no detector for which side of a border a search is on.
4. **The plan boundary stays.** A ceiling of zero is refused before the cache is read. Its reason
   is rewritten: it keeps a downgraded workspace's member from being served their own old entries
   without a meter, not from being served another tenant's.
5. **A departed member's entries are unreachable and expire.** Their key needs their user id,
   which no session can present once they have left, and each entry expires by its TTL, at most 24
   hours after it was written. Nothing is deleted on departure.

**What is not ruled here.**

- **Japan, §6.4 a.** "The HERE Content of Japan may only be used with Your Content and third-party
  content for point of interest (PoI), visual content or dynamic content incl. traffic." ADR 0019
  applies it to road routing and requests no routed answer in Japan. Whether a connection list
  combined with our own trip fields is one of those uses has **not been read against this module**,
  and this amendment neither refuses Japanese searches nor permits them: it is **open**, for a
  person to rule. The 24-hour cap means §6.4 k is not the open part.
- **An operator acting as a member.** An impersonated session carries the target's user id, so
  an operator impersonating a member is served that member's cached answers and spends the
  workspace's allowance. Whether an operator acting as a member is a second End User is a reading
  for a person; the key is by user id and does not tell the two apart. It is **open**.
- **Saved connections.** `saveSearchedConnection` writes the stations and wall clocks of a
  connection a member confirmed into D1 as an ordinary journey, with no expiry, visible to the
  trip's other members. ADR 0019 says §6.4 j and §6.4 h "reach as well" such rows, and this
  amendment does not overturn that. Whether a confirmed row is still a HERE Result is a reading of
  the contract, with legal exposure, and is **open** (#797). The three readings, each with what it
  would cost:
  1. _A confirmed row is the traveller's own record._ The member chose it, edited it and may have
     booked against it, so it has stopped being a Result. Consequence: nothing to change, and
     sharing it with the trip's members stays legal. The cost is that the whole position rests on
     a reading HERE has not confirmed.
  2. _A saved row stays a Result._ Then §6.4 j caps it at 30 days and §6.4 h forbids showing it to
     another member. Consequence: a provenance and expiry column (an additive D1 migration under
     `BACKWARD_COMPATIBILITY.md` §1), a backfill, and journeys that vanish or blank for the other
     members of a trip after a month, which breaks the product's central promise to a group.
  3. _Split by origin._ What the member typed or chose (endpoints, clocks they confirmed) is theirs;
     what only HERE supplied (intermediate stops, service names, fares) remains a Result.
     Consequence: provenance per field, an expiry on part of a row, and a save that drops HERE-only
     detail unless it is stored with a lifetime.

  Until #797 is ruled, saved rows stay exactly as they are: no schema change, no deletion, no
  hiding. Every reading leaves them intact, so nothing is lost by waiting.

**Cost, honestly.** The transit meter now grows with members searching rather than with distinct
routes. Ten members of one workspace repeating a route spend ten units of the workspace's allowance
where one was spent before, and the HERE bill moves toward the cold column of `docs/ARCHITECTURE.md`
§8 (no hit rate is assumed there until HERE's live headers are recorded). The ceilings in
`resolveLimits()` are unchanged; whether to resize them is a person's decision.

**The terms are re-read when a stage builds.** HERE "reserves the right to change these Terms at any
time" (§3.2); a changed §6.4 or Exhibit 2 §1.3 reopens this ADR instead of being absorbed silently.
