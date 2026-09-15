# 0019. Road routing is bought from HERE, on the contract transit already holds

Status: accepted
Date: 2026-09-15

## Context

Gate B of `docs/plans/02-places-and-maps.md` - routed segment times, road distance and day travel
totals for `MAP-08`, road-following lines for car, bus, taxi and bicycle for `MAP-09` - was the last
open commercial decision in that plan. `11-S3` recorded it as adjacent to Gate A, ADR 0013 closed
Gate A without it, and said why in one line: HERE sells ordinary routing under the contract ADR 0011
already established, and a route is consumed rather than stored, so the retention term that
disqualified HERE for geocoding "does not obviously bite there". That sentence was a supposition. This
ADR replaces it with the terms.

Two stages wait on the answer. `02-S9` (wave 5) ships great-circle distance and prints no time;
`02-S12` (wave 6) draws every leg as a geodesic arc. Both were shaped so a routed number or a routed
geometry can be added later without a redesign, which is what makes buying one cheap to adopt.

The maintainer chose HERE. The recommendation put to them was one vendor, one credential, one meter:
extend the HERE contract rather than open a third location vendor beside HERE and Geoapify. What
follows tests that choice against the two conditions `02-S1` fixes and against the terms that decide
the shape, on HERE's own wording rather than a summary - the method ADR 0011 learned from Transitous
and ADR 0013 applied to Geoapify.

The governing document is the **HERE Platform Terms**, effective 18 September 2023
(`https://www.here.com/en-gb/terms/here-platform-terms-september-2023`), with its Exhibit 2 (HERE
Location Services Terms), the **Acceptable Use Policy** effective 18 January 2022
(`https://www.here.com/en-gb/terms/acceptable-use-policy-january-2022`), which §3.1 of the Platform
Terms incorporates, and the **General Content Supplier Terms and Notices**, effective 10 March 2026
(`https://www.here.com/en-gb/terms/general-content-supplier-terms-and-notices`). All three were read
on 2026-09-15.

## Decision

Buy road routing from **HERE Routing API v8**, on the same HERE account and credential as ADR 0011,
behind our own server-side proxy.

### The two conditions, tested

1. **A tier whose terms exclude a commercial, subscription-funded product is unusable.** Cleared.
   The Platform Terms grant the right, "Subject to your compliance with these Terms and payment of
   applicable fees", to "use the applicable SDKs, tools, and APIs for the sole purpose of developing
   Applications and integrating SDKs and APIs within your Applications" (§5.2 b), and Exhibit 2 grants
   "a non-exclusive, non-transferable, non-sub-licensable, revocable, limited right to download the
   Location Services Access/APIs for the sole purpose of integrating APIs with your Applications and
   distribute the Location Services Access/APIs as part of your Applications" (Exhibit 2, §1.1).
   Neither the Platform Terms, Exhibit 2 nor the AUP limits that to non-commercial use; the only
   evaluation-only grants in the document are the Workspace Evaluation Add-on and HERE Content
   Samples, and we use neither.

   One trap, recorded so nobody falls into it later: HERE's consumer **Service Terms**
   (`https://www.here.com/en-gb/terms/serviceterms`, effective 4 December 2015) do say "Use the
   Service only for your personal, non-commercial purposes" and "Not to use any automated systems or
   means to access, acquire, copy or monitor any part of the service." They govern HERE's consumer
   service, not the Platform. §3.1 of the Platform Terms lists every document it incorporates - the
   exhibits, the subscription-plan terms, the AUP, the Privacy and Lifecycle policies, the Supplier
   Terms and the DPA - and the Service Terms are not among them.

2. **A policy that forbids automated querying is unusable.** Cleared on policy; the rate half stays
   real. Nothing in the Platform Terms or Exhibit 2 forbids server-side, programmatic requests -
   integrating the API into an Application is the grant itself. The AUP's list of forbidden acts,
   which does name "scraping", is scoped to use that "permits or seeks to permit the unauthorized
   use, disclosure or access of/to any HERE Materials ... (except as expressly permitted by
   applicable law or contract)" (AUP, clause 4). A request our proxy makes under the Exhibit 2 grant is
   authorised use. The rate question is not answered by the policy: a day total is several calls, and
   it is recomputed when the day is reordered, so the call rate is bounded by a ceiling, below.

### The terms that decide the shape

Price was never going to decide this; three other terms do, and each one binds the owning stage.

- **We may draw HERE's answer on our own map.** Using non-HERE data with HERE Results is forbidden
  by default, and then allowed: "you may (i) layer Your Content and third-party content with HERE
  Content or Results for display purposes; and (ii) combine Your Content and third-party content with
  HERE Content or Results for the purpose of delivering derived location responses, such as a route
  or search result, provided, in both cases (i) and (ii), that the origin of the HERE Content and
  non-HERE content can be distinguished and correct attribution can be provided" (§6.4 a). Our
  basemap is MapLibre over Protomaps in our own R2, so this is the clause that makes HERE usable at
  all - ADR 0013 recorded that Google and Mapbox tie display of their geocoding to their own map.
- **One request may not serve more than one end user.** "You may not ... Create any Results that
  contain unenhanced or unmodified HERE Content or scaling one Request to serve multiple End Users"
  (§6.4 l). This is the binding term, and it is the opposite of the property ADR 0011 and ADR 0013
  built their caches on. A route between two public coordinates is still a public fact, but under
  this contract its answer is licensed to the end user who asked for it. **The routing cache is
  therefore not cross-tenant, and not shared inside a workspace either**: a cached route is keyed to
  the member who requested it, which makes the key tenant data, scoped like tenant data - the
  isolation rule `02-S1` and `11-S3` state, applied rather than merely respected.
- **A cached answer expires, and HERE says when.** "You may not ... Cache or store outside of the
  Platform any Results that include anything from the use of HERE Content or Location Services for
  more than 30 days" (§6.4 j), and, stricter, "you may not use HERE Materials in a manner that
  pre-fetches, caches, or stores data or Results, except as explicitly allowed by the caching headers
  (HTTP/1.1 standard) returned by HERE Location Services" (Exhibit 2, §1.3). The TTL of a cached route
  is the lesser of what the response's caching headers allow and 30 days; a response that forbids
  caching is not cached. No route, time or geometry is written to D1, so no column is added for one:
  the sequence `11-S3` fixes - decision, then column, then feature - ends here at "no column".

Three further terms travel with it:

- **Results are shown as returned.** "You may not ... Modify HERE Content and/or Results" (§6.4 c).
  The geometry is decoded and drawn, not simplified or smoothed into a different line, and a time is
  formatted, not adjusted.
- **Attribution is owed where a routed answer appears.** §6.4 a conditions the layering on "correct
  attribution", §6.4 m forbids "incorrect attribution of any information derived from the Platform",
  and the Supplier Terms add that "you shall provide End-Users of your products and/or services with
  notice, in a reasonably conspicuous manner (e.g., by inserting a reference in the End-User Terms),
  of the terms under Section 1 below and source attributions under Section 2 below, where
  applicable." So a HERE credit joins the map's attribution line on any surface that shows a routed
  time or line, and the product's terms reference HERE's supplier notices.
- **Personal data reaching HERE carries a notice duty.** "If any personal data of End Users is
  delivered to HERE by the End User or through the End User's use of your Application ... you shall
  make the End User Terms and the HERE Privacy Policy available to End Users in Applications or
  product documentation" (§6.2). The proxy sends coordinates and a transport mode and nothing that
  names a person; a traveller's coordinates may still be personal data, so the privacy notice names
  HERE as a recipient of route coordinates rather than assuming they are not.

### What the owning stages inherit

The shape ADR 0011 and ADR 0013 fixed is not reopened, and it is restated here only as obligations:

- **One proxy, server-side only, minted once.** `02-S9` mints it in wave 5; `02-S12` in wave 6 calls
  what is there. The browser never holds the key (`docs/SPEC.md` §6).
- **The cache answers before the provider does** (`docs/ARCHITECTURE.md` §4) - per member, with the
  TTL above. Its value is a planner reordering the same day back and forth, not a second traveller
  asking the same question; the cost model is written for that.
- **The credential is the existing `HERE_API_KEY`**, the secret ADR 0011 added (`docs/DEPLOY.md`).
  No new secret, no `.dev.vars.example` entry and no `wrangler.jsonc` change follow from this ADR;
  what does follow is enabling Routing on the same HERE project, an account step for the maintainer
  before `02-S9` ships. The credential is never per tenant.
- **The ceiling lives in `resolveLimits()`** (`src/server/billing/limits.ts`): a new metric in
  `RATE_METRICS` and `PLAN_RATE_CEILINGS`, counted by the KV tally in `src/server/metering/rate.ts`
  as transit, extraction and geocoding already are. Its numbers are `02-S9`'s to size. Free's figure
  is not zero, by that module's own rule: the day map is a surface Free's catalogue entry sells.
- **`docs/ARCHITECTURE.md` §8 gains a routing line** under Metered outbound calls when `02-S9`
  builds, with HERE's routing rate read from HERE's pricing page at that time and a cached column
  that assumes no cross-member sharing.

### What `MAP-08` and `MAP-09` may claim

- **`02-S9` may claim** a routed segment time and a road distance for a leg HERE routed, and a day
  travel total built from routed legs. **It may not claim** a time for a leg HERE did not route, nor
  present a total that mixes routed legs and great-circle legs as one road number. Great-circle
  distance stays as the designed state when the ceiling refuses, the provider fails or a mode is not
  routed, and in that state the pill claims a distance and nothing more. The stage's own
  one-metric rule stands: the order it optimises and the number it shows next to it are the same
  metric, and the stage says which.
- **`02-S12` may claim** a road-following line for a car, taxi, bus or bicycle leg that HERE routed.
  **It may not claim** one for any other leg: a flight, a ferry, a mode HERE Routing does not serve,
  a refused or failed request, or an expired cache entry not yet refetched all draw the geodesic arc
  they draw today.

`MAP-08` and `MAP-09` do not close on this ADR. They close when those two stages ship.

## Consequences

Gate B closes, and with it the last open provider decision in plan 02. `11-S3` records the closure by
citation, as it does for Gate A.

We hold two location vendors, not three: HERE for transit and road routing, Geoapify for geocoding.
One HERE account, one key and one invoice cover both routing products.

The cache is worth less here than in either earlier ADR, and that is the price of the contract, not
an oversight. A cross-tenant cache is what made transit's cached column half its cold one in
`docs/ARCHITECTURE.md` §8; routing cannot have one, so its meter grows with members planning rather
than with distinct routes. The per-member cache still absorbs the reorder loop, which is the pattern
that would otherwise dominate the bill.

**The same clause reaches ADR 0011.** The transit proxy at HEAD shares its cache across tenants by
design - `src/server/transit/search.ts` keys a search on the query alone, and its test asserts that a
second workspace "pays nothing for" the first one's question. Under §6.4 l of the Platform Terms that
is one Request serving multiple End Users. Its six-hour TTL is inside the 30-day limit; the sharing is
not. That is not this ADR's to fix: `03-reservations-and-transport.md` is frozen and migrated to PRD
#167, so the correction belongs on the tracker, as an amendment to ADR 0011 and a change to that
module.

The proxy is still the seam that keeps the choice reversible. A provider that permits a shared cache,
or a self-hosted router the day one runs on our runtime, replaces what sits behind it and changes
nothing in front.

## Alternatives rejected

- **No provider: great-circle distance and the geodesic arc, permanently.** A legitimate and complete
  answer, the one `02-S1` assumed, and needing nobody's permission. Rejected because the maintainer
  chose to buy road numbers; it survives as the fallback state of both stages.
- **Google Routes or Mapbox Directions.** ADR 0013 recorded that both vendors tie display of their
  geocoding to their own basemap, and our map is our own. Their routing terms were not re-read for
  this decision; §6.4 a is what shows HERE's do not set the same trap.
- **A third vendor, including Geoapify's routing API.** Not re-read against its own terms for this
  decision; ADR 0013 quoted Geoapify's storage right for geocoding only, and this ADR does not carry
  that quote across to a different product. The recommendation put to the maintainer was one
  contract for all routing, and the decision took it. Should §6.4 l make routing's bill the line that
  matters, Geoapify's routing terms are the first to read.
- **A self-hosted router (OSRM, Valhalla, GraphHopper).** The argument ADR 0013 made for Nominatim
  holds: a worldwide road graph is a memory-resident service on a machine, and `wrangler.jsonc`
  declares no Containers binding. That is leaving Cloudflare, not extending it.
