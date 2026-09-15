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

The maintainer chose HERE, as the claim comment on #439 records. The recommendation put to them was
one vendor, one credential, one meter: extend the HERE contract rather than open a third location
vendor beside HERE and Geoapify. What follows tests that choice against the two conditions `02-S1`
fixes and against the terms that decide the shape, on HERE's own wording rather than a summary - the
method ADR 0011 learned from Transitous and ADR 0013 applied to Geoapify.

The governing document is the **HERE Platform Terms**, effective 18 September 2023
(`https://www.here.com/en-gb/terms/here-platform-terms-september-2023`), with its Exhibit 2 (HERE
Location Services Terms), the **Acceptable Use Policy** effective 18 January 2022
(`https://www.here.com/en-gb/terms/acceptable-use-policy-january-2022`), which §3.1 of the Platform
Terms incorporates, and the **General Content Supplier Terms and Notices**, effective 10 March 2026
(`https://www.here.com/en-gb/terms/general-content-supplier-terms-and-notices`). All three were read
on 2026-09-15. Two documents the Platform Terms incorporate were **not** read: the Base Plan terms
(`https://legal.here.com/en-gb/terms/here-base-plan-terms`), which render client-side and returned no
text to a plain fetch, and the HERE End User License Terms (§21.8). Where a conclusion below depends on
them, it says so.

## Decision

Buy road routing from **HERE Routing API v8**, on the same HERE account and credential as ADR 0011,
behind our own server-side proxy.

### The two conditions, tested

1. **A tier whose terms exclude a commercial, subscription-funded product is unusable.** Cleared on
   the documents read; the Base Plan terms remain to be checked. The Platform Terms grant the right,
   "Subject to your compliance with these Terms and payment of applicable fees", to "use the
   applicable SDKs, tools, and APIs for the sole purpose of developing Applications and integrating
   SDKs and APIs within your Applications" (§5.2 b), and Exhibit 2 grants "a non-exclusive,
   non-transferable, non-sub-licensable, revocable, limited right to download the Location Services
   Access/APIs for the sole purpose of integrating APIs with your Applications and distribute the
   Location Services Access/APIs as part of your Applications" (Exhibit 2, §1.1). Neither the Platform
   Terms, Exhibit 2 nor the AUP limits that to non-commercial use. The evaluation-only defaults in the
   document belong to other products: HERE Content Samples and the Workspace Evaluation Add-on, and
   Exhibit 5's default that "the use of HERE Content is solely for your internal evaluation and testing
   purposes" unless a Subscription Plan permits otherwise, which applies "If you have subscribed to
   HERE Content". Routing v8 is a Location Service under Exhibit 2, and we use none of those three.
   §3.1 b also incorporates "Additional terms applicable to the Subscription Plans and pricing that you
   have selected"; those are the Base Plan terms not read above, so the maintainer reads them for a
   commercial or evaluation limit when enabling Routing, and this condition is re-tested if they carry
   one.

   One trap, recorded so nobody falls into it later: HERE's consumer **Service Terms**
   (`https://www.here.com/en-gb/terms/serviceterms`, effective 4 December 2015) do say "Use the
   Service only for your personal, non-commercial purposes" and "Not to use any automated systems or
   means to access, acquire, copy or monitor any part of the service." They govern HERE's consumer
   service, not the Platform. §3.1 of the Platform Terms names the documents it incorporates - the
   exhibits, the subscription-plan terms, the AUP, the Privacy and Lifecycle policies, the Supplier
   Terms and the DPA - and the Service Terms are not named among them. §3.1 f adds, open-endedly,
   "other Documentation referred to in any of the above, on the Platform, or in the HERE Materials".

2. **A policy that forbids automated querying is unusable.** Cleared on policy; the rate half stays
   real. Nothing in the Platform Terms or Exhibit 2 forbids server-side, programmatic requests -
   integrating the API into an Application is the grant itself. The AUP's list of forbidden acts,
   which does name "scraping", is scoped to use that "permits or seeks to permit the unauthorized
   use, disclosure or access of/to any HERE Materials ... (except as expressly permitted by
   applicable law or contract)" (AUP, clause 4). A request our proxy makes under the Exhibit 2 grant is
   authorised use. The rate question is not answered by the policy: a day total is several calls, and
   it is recomputed when the day is reordered, so the call rate is bounded by a ceiling, below.

### The terms that decide the shape

Price was never going to decide this; the terms below do, and each one binds the owning stage.

- **We may draw HERE's answer on our own map, at render time.** Using non-HERE data with HERE
  Results is forbidden by default, and then allowed: "subject to compliance with Section 6.4 b. below
  and your license to HERE Materials for use in Applications, you may (i) layer Your Content and
  third-party content with HERE Content or Results for display purposes; and (ii) combine Your Content
  and third-party content with HERE Content or Results for the purpose of delivering derived location
  responses, such as a route or search result, provided, in both cases (i) and (ii), that the origin
  of the HERE Content and non-HERE content can be distinguished and correct attribution can be
  provided" (§6.4 a). Our basemap is MapLibre over Protomaps in our own R2, so this is the clause that
  makes HERE usable at all - ADR 0013 recorded that Google and Mapbox tie display of their geocoding to
  their own map. Its two conditions bind as well. §6.4 b forbids exposing HERE Materials "to any open
  source software, open content, open database licenses or other resembling terms" that would disclose
  them or license derivatives, and the basemap is built from OpenStreetMap under an open database
  licence: **a routed line is layered in the browser at render time and never written into the
  basemap archive or any OpenStreetMap-derived dataset.** And "The HERE Content of Japan may only be
  used with Your Content and third-party content for point of interest (PoI), visual content or dynamic
  content incl. traffic" (§6.4 a): whether a road-following line counts as visual content has not been
  read against our use, and a routed time or distance is combined with our own places on the same
  screen, so **no routed answer is requested or claimed in Japan** - a segment or leg with either
  endpoint inside Japan keeps great-circle distance and the arc.
- **One request may not serve more than one end user.** "You may not ... Create any Results that
  contain unenhanced or unmodified HERE Content or scaling one Request to serve multiple End Users"
  (§6.4 l), and "Provide Results and/or HERE Content to another person or entity" (§6.4 h). An End
  User is "any entity or person who (i) receives or uses an Application or (ii) accesses all or any
  portion of the HERE Content or Services in or through an Application" (§21.7), and a Request is
  "each API call made to the respective HERE Services to request Results as initiated by an End User
  using an Application, excluding internal server requests in response to each API call" (§21.16).
  This is the binding term, and it is the opposite of the property ADR 0011 and ADR 0013 built their
  caches on. A workspace is an entity, so reading the workspace as the End User is arguable; it is
  **rejected**, because every person using the product is equally an End User under (i), and a wrong
  reading would breach on every shared answer. The reading taken is the conservative one: **a routed
  answer belongs to the member whose Request fetched it.** The routing cache is therefore not
  cross-tenant and not shared inside a workspace either: a cached route is keyed to that member within that workspace, which
  makes the key tenant data, scoped like tenant data - the isolation rule `02-S1` and `11-S3` state,
  applied rather than merely respected.
- **What is shown follows the same line.** A routed time, road distance or line appears only to the
  member whose Request produced it. Another member looking at the same day makes their own Request
  when they open it. The `07-S6` guest viewer, anything printed or exported as a document, and the
  day's copy-out in `02-S9` carry no routed number or geometry; they show the great-circle distance
  and the arc. When the day's order changes after a member's Request - their own reorder or another
  member's, arriving live - their routed numbers give way to great-circle distance until their own
  client requests again. Print is excluded on a second ground as well: "Unless otherwise expressly permitted by
  HERE, no map data delivered by HERE can be used to create paper maps" (Supplier Terms, section 1).
- **A cached answer expires, and HERE says when.** "You may not ... Cache or store outside of the
  Platform any Results that include anything from the use of HERE Content or Location Services for
  more than 30 days" (§6.4 j); "Cache or store any Results from HERE Content and Location Services for
  Japan (with the exception of Geocoding and Search as described in context of these services) for
  more than 24 hours" (§6.4 k); and, stricter than both, "you may not use HERE Materials in a manner
  that pre-fetches, caches, or stores data or Results, except as explicitly allowed by the caching
  headers (HTTP/1.1 standard) returned by HERE Location Services" (Exhibit 2, §1.3). So **nothing is
  cached unless HTTP caching would let a shared cache store it** (RFC 9111): no `no-store`,
  `no-cache` or `private` directive, and an explicit freshness lifetime taken from `s-maxage`, else
  `max-age`, else `Expires` minus `Date`, less any `Age`. A response without one is not cached, and
  neither is one whose lifetime is shorter than KV's 60-second minimum `expirationTtl`; keying the
  entry per member does not make the proxy a private cache. When a route is cached, its TTL is the
  lesser of that lifetime and 30 days. No route in Japan is requested (above), so the 24-hour limit
  of §6.4 k is not reached; if that changes, it is the limit. **Nothing is fetched that the
  member has not asked to see**: no warming of other days, no recompute triggered by another member's
  reorder, no queue or cron refresh. Nobody has yet recorded the headers a live Routing v8 response
  carries, so `02-S9` records them before it sizes its ceiling, and sizes it cold if they permit no
  caching. No route, time or geometry is written to D1, so no column is added for one: the sequence
  `11-S3` fixes - decision, then column, then feature - ends here without a column.

Four further terms travel with it:

- **Results are shown as returned.** "You may not ... Modify HERE Content and/or Results" (§6.4 c).
  The geometry is decoded and drawn as returned, with the map source's own line simplification turned
  off (a MapLibre GeoJSON source simplifies by default; its `tolerance` is set to `0`). A time is
  formatted from the seconds HERE returns, with nothing added for traffic, padding or buffers. A day
  total is a derived location response that §6.4 a (ii) permits, not a modification of any one Result.
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
  product documentation in a manner that is enforceable by HERE. If the End User Terms and HERE Privacy
  Policy are made available on a map display, you may not obscure or block End Users' access to such
  terms" (§6.2), which also asks for "a reasonably effective notice about the transmission of certain
  information to HERE Services through the use of the Application". The proxy sends coordinates and a
  transport mode and nothing that names a person; a traveller's coordinates may still be personal
  data, so the product's terms incorporate the HERE End User License Terms and the HERE Privacy Policy
  by reference and a member accepts them together with the product's own terms, in a form HERE can
  enforce; the privacy notice names HERE as a recipient of route coordinates; and no map attribution
  control hides the links to either.
- **No routed answer reaches a model.** "You may not ... Use HERE Materials in connection with a
  machine learning or artificial intelligence ("AI") system" (§6.4 f). No route, time or geometry is
  passed to the Workers AI binding of ADR 0012 or to any other model.

### What the owning stages inherit

The shape ADR 0011 and ADR 0013 fixed is not reopened, and it is restated here only as obligations:

- **One proxy, server-side only, minted once.** The first stage to build a routed number mints it,
  and the second calls what is there. The browser never holds the key (`docs/SPEC.md` §6). Plan 02
  does not yet give either stage that work: `02-S9`'s Blockers defer Gate B with "No provider is named
  and no client is written for one", and `02-S12`'s defer it the same way. Until plan 02 amends those
  Blockers to cite this ADR (below), both stages ship their ungated outcome.
- **The cache answers before the provider does** - per member, only when
  HERE's headers allow it, with the TTL above. Its value is a planner reordering the same day back and
  forth, not a second traveller asking the same question; the cost model is written for that.
- **The credential is the existing `HERE_API_KEY`**, the secret ADR 0011 added (`docs/DEPLOY.md`).
  No new secret, no `.dev.vars.example` entry and no `wrangler.jsonc` change follow from this ADR;
  what does follow is enabling Routing on the same HERE project, and reading the Base Plan terms while
  doing it - an account step for the maintainer before `02-S9` ships. The credential is never per
  tenant.
- **The ceiling lives in `resolveLimits()`** (`src/server/billing/limits.ts`): a new metric in
  `RATE_METRICS` and `PLAN_RATE_CEILINGS`, counted by the KV tally in `src/server/metering/rate.ts`
  as transit, extraction and geocoding already are. `02-S9` proposes its numbers. Free's figure
  is not zero, by that module's own rule: the day map is a surface Free's catalogue entry sells.
- **The budget is deferred, not agreed.** HERE's routing rate and free allowance were not read -
  `here.com/get-started/pricing` renders client-side and returned no figures - and whether the
  allowance transit already spends is shared with routing is not known. `02-S9` reads both, writes
  the ceilings it proposes and the monthly spend they allow into its plan, and puts them to the
  maintainer: committing spend on a per-use service is "the user's decision and not a stage's"
  (`11-S3`). No routed call ships until the maintainer has agreed them, and the agreed ceilings are
  then the cap on spend.
- **`docs/ARCHITECTURE.md` §8 gains a routing line** under Metered outbound calls when `02-S9`
  builds, with that rate and a cached column that assumes no cross-member sharing.
- **The terms are re-read when a stage builds.** HERE "reserves the right to change these Terms at any
  time" (§3.2), and §3.1 incorporates its documents "and include any future updates to these
  documents". `02-S9` and `02-S12` each re-read §6.4 and Exhibit 2 §1.3 against the version live when
  they build, and a changed clause reopens this ADR rather than being absorbed silently.

### What `MAP-08` and `MAP-09` may claim

- **`02-S9` may claim** a routed segment time and a road distance for a segment HERE routed, and a
  day travel total built from routed segments, shown to the member who requested them. A segment is
  routed in the Routing v8 mode that matches its transport mode - `walk` as `pedestrian`, `bike` as
  `bicycle`, and `car`, `taxi` and `bus` as themselves - and a segment with no transport mode as
  `pedestrian`, the walking time the stage is named for. **It may not claim** a time for a segment
  HERE did not route, any routed answer for a segment in Japan, nor present a total that mixes routed and great-circle segments as one road
  number. Its one-metric rule resolves one way: the optimiser keeps ordering by great-circle distance,
  and the distance on the pill is that metric; a routed time or road distance is shown beside it,
  never as the metric the order optimises. Ordering by road would need every stop pair routed, which
  is HERE Matrix Routing, a separate product this ADR does not adopt. Great-circle distance stays as
  the designed state when the ceiling refuses, the provider fails, a mode is not routed, the segment is in
  Japan, the viewer is not the requesting member or the order has changed since their Request, and in that state the pill claims a distance and nothing more.
- **`02-S12` may claim** a road-following line for a `car`, `taxi`, `bus` or `bike` leg that HERE
  routed, outside Japan, shown to the member who requested it. A `bus` line is the road path a bus
  would drive, not the timetabled service's route. **It may not claim** one for any other leg:
  `walk` (outside the four modes `MAP-09` names), `transit`, `train`, `tram`, `metro`, `ferry`,
  `flight` and `other`, a leg in Japan, a refused or failed request, or an expired cache entry not yet
  refetched all draw the geodesic arc they draw today.

`MAP-08` and `MAP-09` do not close on this ADR. They close when those two stages ship.

## Consequences

Gate B's provider question closes; its budget is deferred to `02-S9`, as above. `11-S3` records the
closure by citation, as it does for Gate A.

Plan 02 still describes Gate B as open, and #439 deliberately did not edit it. Before either stage
builds against this ADR, plan 02 cites it the way it cites ADR 0013 for Gate A, in every place of
`docs/plans/02-places-and-maps.md` that would otherwise be false:

- the plan's gate summary: "Gate B — routing. STILL OPEN." and "Behind Gate B, two stages still
  carry a gated behaviour";
- `02-S1`: "Gate B is untouched and still open", the "Gate B — routing. OPEN." entry, and the
  falsifiable condition that "no Gate B provider is named at all", which would otherwise count the
  citation itself as the stage failing;
- `02-S9`: its divergence note on the reference's segment pills, and its Gate B Blockers entry;
- `02-S12`: "Road-following lines are Gate B and are not built", and its Gate B Blockers entry.

If #437's migration has frozen plan 02 by then, the amendment is recorded on #437 instead.

We hold two location vendors, not three: HERE for transit and road routing, Geoapify for geocoding.
One HERE account, one key and one invoice cover both routing products.

The cache is worth less here than in either earlier ADR, and that is the price of the contract, not
an oversight. A cross-tenant cache is what made transit's cached column half its cold one in
`docs/ARCHITECTURE.md` §8; routing cannot have one, so its meter grows with members planning rather
than with distinct routes. The per-member cache still absorbs the reorder loop, which is the pattern
that would otherwise dominate the bill - if HERE's headers permit caching at all.

**The same clauses reach ADR 0011.** The transit proxy at HEAD shares its cache across tenants by
design - `src/server/transit/search.ts` keys a search on the query alone, and its test "serves one
workspace the answer another workspace paid for", in which the second workspace "pays nothing for"
the first one's question. Under §6.4 l and §6.4 h that is one Request serving multiple End Users,
and its six-hour TTL is fixed rather than taken from HERE's caching headers (Exhibit 2, §1.3). The
TTL is inside the 30-day limit; the sharing is not. A connection saved through
`saveSearchedConnection` goes further: it keeps the stations and clocks HERE returned in D1 with no
expiry and shows them to the trip's other members, which §6.4 j and §6.4 h reach as well. That is not
this ADR's to fix: `03-reservations-and-transport.md` is frozen and migrated to PRD #167, so the
correction is tracked in #516, as an amendment to ADR 0011 and a change to that module.

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
