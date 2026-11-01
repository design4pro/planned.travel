# 0036. Road routing stays single-vendor on HERE, and vendor keys stay Cloudflare secrets

Status: proposed
Date: 2026-10-07
Issue: #664
Refs: ADR 0019 (road routing is bought from HERE - its Decision and Alternatives text stands as
written), ADR 0011, ADR 0013

Proposed successor for #1319: [ADR 0047](0047-eligible-providers-for-editable-day-routes.md).
It changes provider selection only on acceptance; this document retains its current status.

## Context

The request behind #664 asked for road routing from HERE, OpenRouteService and Google behind one
abstraction, with each vendor's key and limit set in the operator console and an automatic fall-through
to whichever vendor still has allowance. ADR 0019 decided the opposite five days earlier. It rejected
Google Routes and Mapbox Directions, "A third vendor, including Geoapify's routing API" and a
self-hosted router, and it records that "We hold two location vendors, not three" and that "The
credential is never per tenant". An accepted ADR is not something an implementation ticket may quietly
step around, so the question needed a decision document. This is it: the question was asked again, and it is answered the same way, with the reasons
written down so nobody has to ask it a third time.

What the repository already holds changes the question, because three of the request's four parts are
built:

- **The abstraction.** `callProvider` in `src/server/metering/outbound.ts` is the one wrapper every
  outbound third-party call is meant to pass through. It consults the operator's ceiling, throws
  `ProviderBlockedError` before the vendor is called, and records `calls`, `errors` and `blocked` into
  `provider_usage`.
- **A per-vendor limit in the console.** `provider_registry` stores a ceiling, a window (`day` or
  `month`), a policy (`allow` or `block`), warn and critical thresholds and the `blockable` safety
  interlock. `/console/providers` renders it and `saveProviderLimit()` in
  `src/server/fns/console/providers.ts` writes it behind `provider:configure`, with a
  `platform_audit_log` row. A provider with no row reads as `allow` with no ceiling.
- **Usage counted during requests.** `provider_usage` counts per provider, operation, hour or month
  bucket and workspace.

Two things are not built, and each is a decision rather than a gap. There is **no fall-through chain**:
every domain has one adapter chosen at build time (`src/server/geo/` is Geoapify,
`src/server/transit/` is HERE), and the failure model is a typed refusal, never a retry against another
vendor. And there is **no vendor key entered through a UI**: every vendor key is a Cloudflare secret.
`GEOAPIFY_API_KEY` is read in `src/server/geo/bindings.ts` and `HERE_API_KEY` in
`src/server/transit/bindings.ts`, each in that directory's one binding seam. `EMAIL_API_KEY` is not read
in a per-domain seam: the queue handler reads it (`src/server/queue/handlers/email.ts`). Nothing in D1
holds a key that is decrypted and sent; the nearest thing, `staff_api_tokens.token_hash`, is a generated
token stored as an HMAC and never recoverable, which is the opposite of what a vendor key needs.

What this ADR read: the repository, ADR 0011, ADR 0013 and ADR 0019. What it did **not** read, and so
does not quote or conclude from: the routing terms of OpenRouteService, Google (Routes) and Geoapify; the
current HERE Routing price and free allowance; HERE's Base Plan terms and the End User License Terms,
which ADR 0019 also names as unread. No vendor term or price below is stated from memory.

## Decision

Two questions, decided separately. Either can be reopened without the other.

### 1. Road routing stays single-vendor, on HERE

ADR 0019 stands. A routed answer comes from HERE Routing API v8 behind our own proxy, and when HERE
refuses it - the ceiling is spent, the provider fails, the segment is in Japan - the designed state is
the great-circle distance and the geodesic arc. No second routing vendor is adopted and no fall-through
chain is built. The reasons are facts the repository and ADR 0019 already establish:

- **Licensing is per vendor, not per abstraction.** ADR 0019 chose HERE on HERE's own wording: §6.4 a is
  what permits drawing a routed line over our OpenStreetMap-derived basemap at all, §6.4 l and §6.4 h
  bind a routed answer to the member whose Request fetched it, Exhibit 2 §1.3 ties caching to the
  response's own headers, and §6.4 f keeps a result away from a model. **Each of those is HERE's
  wording.** The routing terms of OpenRouteService, Google and Geoapify are unread, so whether any of them
  permits display over our own basemap, may be cached and for how long, may be shown to more than one
  person, or must be credited in a particular way is unknown. ADR 0013 already found that Google and
  Mapbox tie display of their geocoding to their own map; if Google's routing terms do the same, Google
  is out on the ground that decided HERE.
- **A chain changes which licence governs the answer on screen.** ADR 0019's per-member rule (a routed
  answer belongs to the member whose Request produced it), its attribution rule (a HERE credit joins
  the map's attribution line on any surface that shows a routed answer) and its Japan exclusion are
  written for one vendor. With a chain, the credit line, the cache rule and the regions where an answer
  may be requested all depend on which vendor answered this segment, and incorrect attribution is a
  breach under §6.4 m, not a cosmetic bug.
- **The price is unread.** HERE's routing rate and free allowance, and whether the allowance transit
  spends is shared with routing, were unreadable when ADR 0019 was written and are not read here. "We
  might run out of allowance" is a hypothesis until those figures exist, and the per-provider ceiling in
  the console is how the maintainer sets the spend.
- **The need behind the request is already met.** "The day map must not go blank when the allowance runs
  out" is the case ADR 0019 designed for: every refusal falls back to great-circle distance and the
  geodesic arc, which is a complete and honest answer rather than an error.

Raising the HERE ceiling is the maintainer's spend decision, which ADR 0019 reserves ("No routed call
ships until the maintainer has agreed them"). It is never something an agent run does.

### 2. Vendor keys stay Cloudflare secrets, platform-wide, and are never stored in D1

A vendor API key is a Cloudflare secret read only inside the server's credential seams: the per-domain
`bindings.ts` for geocoding and transit, and the queue handler for the email key. No vendor key is
stored in D1, in plain text or encrypted.

A vendor key is **platform-wide and never per workspace**: there is no bring-your-own-key per
workspace. ADR 0019 said this of the HERE key only ("The credential is never per tenant"); this ADR
states it for every vendor key, because the licence terms each vendor's contract carries are the
platform's, not a tenant's.

The cost of what this turns down, so a later reader does not "fix" it: an encrypted column needs a master
key that itself lives in a secret, a decrypt path, an audit trail on read as well as on write, and from
then on every D1 export and every console bug carries vendor keys. A Cloudflare secret is not readable by
the Worker's own database, is not in a D1 export and is not reachable through a console defect. What it
costs is that rotating a key is a `wrangler secret put` and not a form; that is accepted.

## The terms that decide the shape

Nothing in this ADR rests on a vendor term read for it. The shape is decided by terms already read and
quoted in ADR 0019 (HERE §6.4 a, h, l, m, Exhibit 2 §1.3), by the repository as it stands, and by what is
**unread**. The unread list above is the decision's load-bearing part: a single vendor is chosen
because it is the only one whose routing terms have been read against this product, not because another
vendor's terms are known to be worse.

## What the owning stages inherit

- **The routing feature (#662) ships single-vendor under ADR 0019**, exactly as it already may. This ADR
  does not block it and changes nothing in front of the proxy.
- **The proxy stays the seam that keeps the choice reversible**, as ADR 0019 says. A second vendor
  replaces or joins what sits behind it; adopting one is a superseding ADR, then a ticket.
- **The credential is the existing `HERE_API_KEY`.** No schema, binding, `.dev.vars.example`,
  `wrangler.jsonc` or server-function change, and no dependency, follows from this ADR. It adds no
  `CONTEXT.md` term.
- **Geocoding's chain (#281) and transit's cache defect (#516)** are their own tickets under their own
  ADRs. They are read against this decision only in that a vendor chain is not yet adopted anywhere.

### Reopen conditions

ADR 0019's single-vendor rule is reopened by a superseding ADR when any of these holds:

1. **Measured refusals.** After #662 ships, HERE routing refusals at the agreed ceiling are measured in
   `provider_usage` (`blocked` against `calls`) and show the great-circle fallback is shown to members
   often enough to matter. "Measured" can only apply after #662: no HERE routing meter exists until
   then, so a claim of quota exhaustion before it is a hypothesis.
2. **A candidate's terms, read.** A candidate vendor's routing terms are read, quoted and dated, and
   permit display over the product's own OpenStreetMap-derived basemap. Geoapify is the first to read,
   as ADR 0019 says, and the unread parts of any document are named as unread.
3. **HERE's terms change** in the way ADR 0019 already treats as reopening it: §6.4, Exhibit 2 §1.3,
   or the Base Plan terms carrying a commercial or evaluation limit.

### Reopen conditions for the keys question

The preferred future direction, if the maintainer wants a key rotated without a deploy, is the **middle
path**: the console chooses which Cloudflare secret a provider uses, and no key value enters D1. A later
ticket for it is `security` and `risk-high` and is claimed only on a security and tenancy specialist's
approving verdict. It meets these conditions:

- The console picks the secret from a **closed list defined in code per provider**; it never accepts a
  typed name, and nothing reads the environment by a string stored in D1.
- **Key values never leave the Worker environment**: never returned by a server function, rendered,
  written to the audit log or exported. The console shows only configured or missing.
- **Switching the secret is audited** under a new provider audit action. `docs/ACCESS.md` gains that
  action in its closed list (§4.2) and the section it already cites and does not have (§2.3b), which says
  that only `admin` holds `provider:configure` and that the server enforces it.
- **Each new secret name lands in `.dev.vars.example`, `scripts/worktree/bootstrap.sh` and
  `docs/DEPLOY.md` in the same change**, with the operator step (`BACKWARD_COMPATIBILITY.md` §7).

## Consequences

The question of a second routing vendor and of keys in the console is closed, with its reopen conditions
written where the next person asks. ADR 0019's text is unchanged; a one-line pointer to this ADR is the
only edit to it.

The cost is a single point of failure for routed answers: when HERE's allowance or service fails, every
member sees great-circle distance and the arc until it recovers. That state is complete and honest, but
it carries no road time, which is what a second vendor would have bought. A key rotation stays a
deploy-side operation.

We hold two location vendors, not three, and keep every vendor key in one place.

## Alternatives rejected

- **HERE, OpenRouteService and Google behind one abstraction, selected by remaining quota.** The
  abstraction and the per-vendor ceiling exist; the chain does not. Rejected for now because the second
  and third vendors' routing terms are unread and a chain moves licence, cache and attribution rules
  from one document to several (above). It is the first thing reopened by a measured need.
- **Raising the HERE ceiling instead.** It may well be the cheapest answer, and it is the maintainer's
  spend decision under ADR 0019, so this ADR records it as an option and does no more.
- **Vendor keys in D1, encrypted at rest.** Rejected above: a master key in a secret, a decrypt path,
  audit on read, and every export and console bug carrying keys. Nothing is gained that the middle path
  does not give without it.
- **A key per workspace.** Rejected: the vendor contract and its terms are the platform's, and ADR 0019
  already fixed the credential as never per tenant.
- **Splitting this into two ADRs.** The keys half decides to change nothing, so a separate ticket would
  carry a `security` and `risk-high` label for an answer of "no change". Two separately headed decisions
  in one document keep each reopenable on its own.
