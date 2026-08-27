# Domain glossary

A glossary and nothing else. No implementation details, no file paths, no commands. Terms are added lazily, during grilling sessions, when they earn their place. Decisions with rationale belong in docs/adr/, not here.

- **Organization (tenant)** — the unit of isolation and billing. Every product row belongs to exactly one organization; a user acts inside one organization at a time.
- **Workspace console** — the administrative surface where an organization manages members, billing and settings.
- **Trip** — the central planning object: a titled, dated journey owned by an organization, with members and guests.
- **Day** — one calendar day inside a trip; the unit the itinerary timeline is built from.
- **Place** — a geographic point attached to a trip: created by hand, search or import; rendered as a map marker.
- **Reservation** — a booked commitment (lodging, activity, table) with dates, status and optional documents.
- **Transport** — a movement between places, made of one or more **legs** (flight, train, drive), placeable in a day.
- **Budget entry / expense** — a cost recorded against a trip, splittable between members, carrying its own currency with a frozen exchange rate.
- **Settlement** — the computed "who owes whom" resolution of split expenses.
- **Pack** — a packing list attached to a trip; items are checkable per member.
- **Product module** — an optional, separately-toggled product area: Atlas (world-map tracker), Journal, Leave planner, Collections.
- **Atlas** — the world-map tracker module: countries and regions a user has visited.
- **Share token** — an unguessable token granting session-less, read-only access to a named projection of one trip resource.
- **Entitlement** — a capability granted by the organization's billing plan.
- **Quota** — a numeric ceiling on an entitlement, enforced at the data-access boundary.
- **Platform actor** — a privileged operator acting across organizations; every such action is audited.
- **Guest** — a trip participant who is not an organization member.
- **Reminder** — a pre-departure notice delivered to a trip's members ahead of the start date, honouring each member's channel preferences; its lead time is counted in days, and zero means off.
- **System event** — a notification event with no acting user (a reminder, a billing follow-up); nobody is excluded from its recipients.
- **Entity history** — the per-entity view of a tenant's audit trail.
