# 0047. Editable day routes select randomly among verified eligible providers

Date: 2026-10-31
Status: Proposed
Refs: #1319; [saved-day-route specification](../../.ai/specs/2026-10-31-editable-saved-day-routes.md)

## Context

ADR 0019 chose HERE exclusively for the #662 routing foundation. ADR 0036 is **proposed** and
repeated that choice, with an explicit reopening condition: read another candidate's routing
terms against our own basemap. #1319 now requests random selection among available providers,
editable intermediate points and saved intent shared with authorized travellers. Its Agent Brief
authorizes a design, not provider activation or implementation.

Geoapify's official [routing page](https://www.geoapify.com/routing-api/) and
[documentation](https://apidocs.geoapify.com/docs/routing/), retrieved 2026-10-31, document both
modes, waypoint routing and permission to store/redistribute routing results. Its
[pricing](https://www.geoapify.com/pricing/) permits commercial Free production within limits and
attribution; [general terms](https://www.geoapify.com/terms-and-conditions/) retain production
limitations/contact wording and prohibit splitting traffic across accounts/projects to lower
bills. Account-specific confirmation remains an activation prerequisite. This is new candidate
terms evidence, not measured quota exhaustion. The spec contains the full dated vendor matrix,
unread terms and exact activation conditions.

## Decision proposed

On acceptance of this ADR and the specification, replace **only** ADR 0019's exclusive HERE
selection and ADR 0036's decision 1 with a closed routing-provider registry and **uniform random
selection among currently eligible providers**, without replacement and with at most two distinct
attempts per explicit user operation. This is one day-route operation, not a generic gateway for
other domains. #662 still owns the underlying routing foundation and canonical HERE adapter.

Eligibility requires reviewed commercial/own-basemap rights, capabilities, regions, credentials,
explicit operator activation, an agreed blocking call ceiling, workspace allowance and no known
suppression. HERE and Geoapify are conditional targets, not providers this ADR enables. Google's
[Routes policies](https://developers.google.com/maps/documentation/routes/policies), read on the
same date, require map-displayed results on a Google map, making it ineligible here. Applicable
Mapbox routing rights were not verified from its fetched terms page; openrouteservice's old terms
links returned 404. Neither enters the eligible pool from capability documentation alone.

Preserve ADR 0019's HERE layering/attribution, per-member result restrictions, expiry, conservative
Japan exclusion, end-user notice and operator Base Plan/price checks. Preserve ADR 0036's entire
second decision: platform-wide Cloudflare secrets, no key values in D1 or UI and no tenant keys.
Persist only the traveller's own mode and raw intermediate constraints. Recompute geometry for
each reader on explicit request; no shared HERE result cache. No vendor result goes to an AI model.

Keep the existing approximate `callProvider` and `spendRateUnit` behavior for their other callers.
Routing adds fresh fail-closed eligibility and a synchronously acknowledged provider-wide
suppression record for known exhaustion/failures, with UTC reset/cooldown rules in the spec.
Already-admitted concurrent attempts may finish. Neither these counters nor random selection
provides a hard financial cap or an exact vendor balance. A Geoapify HTTP attempt may cost several
credits; operator ceilings must account for that and other uses of the account.

## Consequences and alternatives

The day editor can preserve shared intent without assuming indefinite vendor retention or showing
a geodesic line as a calculated route. Different eligible providers may return different streets
on reopen; the UI explains that before saving. Zero eligible providers is a recoverable state,
not permission to activate another service.

Keeping HERE-only would drop the clarified provider policy. Activating every named vendor would
assume unread or incompatible rights. Weighted/cheapest-first selection contradicts random choice.
A strict global reservation service is disproportionate to a design that explicitly promises
approximate allowances; revisit it if hard monetary bounds become a requirement. Route history and
shared geometry caching remain separate work.

This ADR does not accept vendor terms, spend money or change production configuration. Operator
account/terms/price and activation steps remain explicit. The specification is human-merged;
eventual risk-high implementation needs its own security/tenancy review. Until this proposal is
accepted, ADR 0019 remains the current design authority and ADR 0036 remains proposed.
