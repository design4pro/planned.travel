# 0013. Geocoding is bought from Geoapify, chosen for the right to keep the coordinates

Status: accepted
Date: 2026-08-30

## Context

Gate A of `docs/plans/02-places-and-maps.md` - reverse lookup for `MAP-01`, address completion for
`MAP-03` - was parked as an open commercial decision in `11-S3`, and `02-S13` is BLOCKED behind it.
The confirmation import in `docs/plans/03-reservations-and-transport.md` (`03-S7`) reaches the same
gate from the other side: it extracts a hotel's name and address and has nowhere to get a pin from.

The reference product answers this with a per-user Google Maps key and a fallback to the public
Nominatim instance. That model belongs to self-hosted software, where each operator brings their own
key and their own rate limit. Requests from a hosted multi-tenant product all originate with us, and
the public Nominatim instance's usage policy exists precisely to refuse that.

The decisive property is not price per request. It is **whether we may keep the answer.** A place's
`lat`/`lng` live as long as the trip does, which is years. Most commercial geocoders forbid exactly
that:

- **HERE** - which we already contracted for public-transit routing in ADR 0011 - caps retention of
  geocoding results at 30 days on its standard plans; permanent storage is a separate licence
  starting around USD 10,000 a year. Reusing the HERE credential here would have been the DRY answer
  and it is not available to us.
- **Google** caps caching at 30 days and requires its own basemap for display.
- **Mapbox** sells permanent storage only on a distinct, dearer endpoint, and also ties display to
  its own map.
- **Geocodio** and the US Census permit unrestricted storage but cover the United States only, which
  is useless to a worldwide travel planner in 23 locales.

Self-hosting Nominatim or Photon, which `11-S3` gestures at, is not a binding we are missing. We run
on Workers; `wrangler.jsonc` declares no Containers binding, and a worldwide Nominatim is a machine
with a multi-hundred-gigabyte OSM database behind it. That is leaving Cloudflare, not extending it.

## Decision

Buy geocoding from **Geoapify**, behind our own server-side proxy, on the same shape as ADR 0011.

Three properties decided it, each verified on Geoapify's own pages rather than in a summary - the
mistake Transitous taught us in ADR 0011:

1. **We may keep the coordinates.** "Our services are based on Open Data. So we do not restrict you
   from storing results", conditioned on keeping the attribution with the stored object.
2. **The free plan may be used commercially in production.** "The commercial use of the
   _Free_-package is allowed in the development and, with some limitations, in the production
   phase." It is 3,000 credits a day at 5 requests a second; the first paid tier is USD 59 a month
   for 10,000 a day, so growth is a subscription change and not a migration.
3. **The data is the data we already ship.** Geoapify aggregates OpenStreetMap, OpenAddresses, Who's
   on First and GeoNames, and our basemap is already Protomaps built from OSM, so the OSM
   attribution obligation is one we already carry.

Three constraints come with it:

- **Attribution is not optional.** OSM attribution always, and "Geoapify attribution is mandatory
  when using Free subscription plan" - so a "Powered by Geoapify" credit ships with the map surface
  for as long as we are on the free plan, and the attribution travels with a stored coordinate.
- **The cache is cross-tenant and does not expire.** An address resolving to a point is a public
  fact, not a tenant's data, and the right to store permanently is exactly what makes an unexpiring
  shared cache legal here. Under HERE the same lookup would have to be repurchased every 30 days,
  forever. The cache key is the normalised query, and it holds no tenant identifier.
- **A per-tenant ceiling lives in `resolveLimits()`**, as with transit and with Workers AI, so one
  workspace cannot spend the whole daily allowance. The real consumer is not the import - it is the
  per-keystroke search on the place form (`MAP-02`, and address completion for `MAP-03`), so the
  debounce, the minimum query length and the cancel-on-supersede are cost controls and not manners.
  That budget is plan 02's to design.

Ownership follows the waves and adds nothing to plan 03: **plan 02 mints the proxy in `02-S4`, its
wave 3** - `src/server/geo/geocode.ts` behind a route-local `-server/geocode.ts` - and `02-S11`,
`02-S13` and `03-S7` call what is already there. Wave 3 rather than wave 1 because `02-S4` is the
stage that needs it first and it is scheduled there; nothing in wave 1 of that plan touches a
geocoder.

## Consequences

Gate A closes. `MAP-01` and `MAP-03` lose their blocker, `02-S13` is scheduled - in wave 4, because
that is the only wave in which `plan-actions.tsx` is free - and the confirmation import can give an
extracted hotel address a pin instead of a coordinate-less place.

We now hold two location vendors rather than one: HERE for transit routing, Geoapify for geocoding.
That is the cost of the storage right, and it is the reason to record it - a later reader will
otherwise ask why the HERE key was not simply reused, and the answer is not in the code.

Gate B - routing for `MAP-08` and `MAP-09` - stays open. HERE sells ordinary routing under the
contract ADR 0011 already established, and a route is consumed rather than stored, so the 30-day
retention rule that disqualified HERE here does not obviously bite there. That is plan 02's decision
to take, on its own evidence, and this ADR does not take it.

## Alternatives rejected

- **HERE, reusing the ADR 0011 credential.** One vendor, one key, one meter. Refused by its own
  terms: a coordinate we may not keep is not a coordinate we can put in `places.lat`.
- **OpenCage.** Permits permanent storage and draws no distinction between temporary and permanent
  endpoints, but its free tier is marked for testing only, so it starts at roughly PLN 205 a month
  with no free path for a product that has not launched.
- **A build-time GeoNames catalogue, as ADR 0010 did for airports.** Free, no runtime provider, and
  it would resolve cities. It does not resolve a hotel's street address, which is the case the
  import exists for, so it would buy a second mechanism and still leave the gate open.
- **Self-hosted Nominatim or Photon.** Not reachable from our runtime, as recorded above.
- **Keeping the deferral and creating places without coordinates.** Legal at HEAD - `lat` and `lng`
  are nullable and the map filters those rows out - and it remains the fallback behaviour when a
  lookup fails. As the permanent answer it ships a place the map cannot show.
