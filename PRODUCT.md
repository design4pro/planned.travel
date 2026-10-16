# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: a group co-planning one trip.** Friends or family who are planning a shared journey
together - several people editing the same itinerary, splitting the same costs, ticking the same
packing list. The workspace exists because a trip has more than one owner; single-planner use is
the degenerate case of the same model, not a separate product.

Secondary participants the product must serve as first-class, because the group is never uniform:

- **Trip members** with accounts, holding one trip role - _owner_ (metadata, lifecycle, people),
  _editor_ (the plan's content), _viewer_ (reading only). Every member may copy, favourite and leave.
- **Guests** - participants without accounts: a display name only, unique within the trip, never a
  recipient of anything. A guest can be merged into a member, who inherits what was assigned.
- **Session-less readers** reached through a share token: read-only access to one named projection
  of one trip resource, with no account and no session.
- **Workspace administrators** managing members, billing and settings in the organization console.
- **Platform actors** (`admin`, `curator`) operating across organizations, every action audited.

## Product Purpose

planned.travel is a multi-tenant SaaS travel planner: collaborative trip planning with an
interactive map, day-by-day itinerary, budgets with settlements, packing lists, reservations and
transports, a travel journal, and a world-map tracker of where a traveller has been.

The trip is the central object - a titled journey owned by an organization, dated or not yet, with
a run of numbered days that never has gaps. Everything else hangs off it.

Success is a group that plans an entire trip inside one product and never opens a spreadsheet, a
group chat thread, or a second app to finish the job - and a record of the trip that is still worth
opening after the trip is over.

## Positioning

Four claims, all four confirmed as the honest position:

1. **One place for the whole trip.** Plan, map, budget with computed settlements, reservations,
   packing, journal and the world map are facets of one object, not seven apps stitched together by
   a shared document. Copying a trip reproduces the plan and never the record - the distinction is
   product truth, not an implementation detail.
2. **Collaboration with real roles.** Trip owners / editors / viewers, guests without accounts,
   per-member assignment of costs, items and plans, and per-trip realtime presence. Sharing is a
   designed permission model, not a link that leaks a document. A trip a person may not see is
   indistinguishable to them from one that does not exist.
3. **Design and craft as the product.** The product is meant to be measurably better looking and
   better behaved than the category: designed empty, loading and error states everywhere, full
   parity in light and dark, purposeful motion, 360px → 2560px as designed layouts.
4. **Workspace-grade rigour.** Tenant isolation on every row, entitlements and quotas enforced at
   the data boundary, audited platform actions, and impersonation that can never be visually
   covered. SaaS discipline applied to trip planning.

## Operating Context

- **Two moments of use, not one.** Planning ahead (often collaboratively, often over weeks, often
  on a laptop) and consulting during the trip (alone, on a phone, possibly on poor connectivity).
  Both are real usage scenes and neither is the "mobile version" of the other.
- **The map is a working surface**, not an illustration: places are created by hand, by search or by
  import, and rendered as markers on a self-hosted basemap.
- **Money is shared.** Expenses carry their own currency with a frozen exchange rate, split between
  members, and resolve into a computed "who owes whom" settlement.
- **Time is structured by days.** The itinerary timeline is built from numbered days that acquire
  calendar dates once the trip is dated.
- **Reminders reach people before departure**, honouring each member's channel preferences, with a
  lead time in days where zero means off.
- **Modules are optional and separately toggled** per plan: Atlas (world-map tracker), Journal,
  Leave planner, Collections.
- **Billing is off-product by design.** Polar.sh is Merchant of Record; invoice details, tax data
  and payment methods are edited in the hosted portal, never in our UI.

## Capabilities and Constraints

**Confirmed capabilities.** Trips with members, guests, visibility (private / organization /
public) and a reversible archive; days and itinerary; places; reservations; transports with legs;
budget entries, splits and settlements; packing lists checkable per member; to-dos; notes; files;
conversations; share tokens; trip copy; favourites; notifications and reminders; entity history;
organization console (members, billing, settings); platform console with audited impersonation and
MCP token issuance; catalogue and packs curation.

**Plan model.** Three plans - `free`, `solo`, `crew`. Twelve module switches (`itinerary`, `map`,
`budget`, `packing`, `reservations`, `journal`, `atlas`, `collaboration`, `realtime`,
`offlineMaps`, `pdfExport`, `prioritySupport`) and three metered quotas (`seats`, `trips`,
`storageBytes`). `src/lib/plans.ts` is the single source of truth for what a subscription may do.

**Durable technical constraints** (contract lives in `docs/SPEC.md`; do not restate loosely):

- Cloudflare Workers + TanStack Start (React 19), D1/Drizzle, KV, R2, Durable Objects, Queues.
- **The dependency set is frozen.** No new packages. A genuine need is reported, never installed.
- Every query goes through a tenant-scoped repository in `server/repos`; `server/catalog` is the
  single stated exception outside repos (exactly two catalog members). Bounded `…Unscoped`
  repo functions may take a plain `Database` under SPEC §5 FU-3 (suffix, header justification,
  one named caller and a narrow projection without tenant content). `components/ui` never fetches data and never imports from `server/`.
- Every server-function input is validated with Zod.
- Ships in **23 locales** (`ar ca cs de el en es fr hu id it ja ko nl pl pt-BR ru sv tr uk vi
zh-Hans zh-Hant`), source locale `en`, negotiated server-side before first paint. No user-facing
  string is hardcoded; a new key lands in every locale in the same change. `ar` is RTL and is a
  designed layout, not a flip - layout uses logical properties and directional icons mirror.
  Out of scope for translation for now: the long-form legal prose under `src/routes/legal/**`,
  which stays English and says so on the page.
- Locale-dependent formatting must be provably identical in workerd and WebKit, or frozen in a
  table; a divergence is a defect, not a tolerance.

**Undecided / not yet product truth.**

- Whether the published prices and plan contents on `/pricing` are final was **not** confirmed.
  Treat the numbers in `src/lib/plans.ts` and the deployment's Polar product ids as the only
  authority, and do not invent, round or restate prices in copy.
- First release is provisioned for **10 users**; there is no confirmed launch audience, market or
  go-to-market claim beyond that.

## Brand Commitments

- **Name:** planned.travel. Production at `https://planned.travel`, staging at
  `https://staging.planned.travel`.
- **Clean-room rule (non-negotiable).** The open-source project TREK is a feature and data-model
  reference and a visual quality bar only. Never copy its source, comments, strings or assets;
  never use its name, wordmark or logo anywhere; never write reference captures into this
  repository. Our copy - including every translation - is authored from our own English.
- **Design language and visual contract already exist** in `docs/SPEC.md` §4 and `DESIGN.md`
  (editorial-modern; `MuseoModerno` display + `Geist Sans` UI; tokens in `src/styles/tokens.css`).
  This file does not restate them and future work must not contradict them.
- **Commit and copy language is English**; the product's source locale is `en`.

## Evidence on Hand

- **Real:** the product itself. Actual screens, the seeded demo workspace, and the plan/module
  matrix in `src/lib/plans.ts`. Playwright visual baselines exist under `e2e/`.
- **Does not exist and must never be fabricated:** users, testimonials, quotes, customer logos,
  press mentions, ratings, awards, adoption or usage numbers, uptime or performance claims, case
  studies, and named partners. No such element may appear on any public surface.
- Any future testimonial or logo requires the user to supply the exact wording and the permission
  first.

## Product Principles

1. **The trip is one object.** A feature that makes the trip feel like a folder of separate tools
   has failed, however good it is in isolation.
2. **More than one person is always in the room.** Roles, guests, assignment and visibility are
   designed into every feature from the start, never retrofitted onto a single-user screen.
3. **Plan and record are different things.** What is proposed (days, places, packing, budget) and
   what actually happened (reservations, expenses, files, conversations) are kept distinct, and
   operations like copy respect the line.
4. **Not seeing is indistinguishable from not existing.** Permission decisions are enforced at the
   data boundary and never leak through the UI, error text, counts or timing.
5. **Craft is the differentiator, so the unglamorous states are the product.** Empty, loading,
   error, offline, RTL, dark and 360px are first-class deliverables, not follow-ups.

## Accessibility & Inclusion

- **WCAG 2.2 AA minimum**, verified for every text/background pair in both themes.
- Keyboard navigable end to end; every interactive element ships hover, focus-visible, active,
  disabled and loading states. No `<div>` acting as a button; no custom control that loses keyboard
  or screen-reader behaviour.
- `prefers-reduced-motion: reduce` is honoured.
- 23 locales including RTL Arabic; a locale is always named in its own language and script.
- Responsive 360px → 2560px as designed layouts.
- Zero console errors or warnings; zero layout shift after paint.
