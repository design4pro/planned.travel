# 11 — Boundaries and blockers

## Area brief

Every other plan in this directory describes work. This one describes the edge of the work: the ten
reference rows that do not port to a hosted multi-tenant product, the in-scope capabilities that
cannot be built under the `docs/SPEC.md` §3 dependency freeze, and the decisions that are not ours
to take. It exists so that the eleven area plans can **cite** a boundary instead of re-arguing it,
and so that no plan quietly re-imports a single-tenant concept — an instance-wide administrator, a
deployment-wide feature switch, an operator's filesystem, an environment-variable configuration
surface — as though one deployment served one customer.

Nothing here is built. `README.md` places the ten out-of-scope rows in wave 1 because nothing gates
them: the argument has to be on record before wave-1 construction starts, not because there is code
to write. The three stages below are registers, and they close their rows as **excluded**, not as
done.

Three registers, three stages:

- **`11-S1`** — the ten hosted-model exclusions, each with the reason its shape does not survive one
  deployment serving every tenant, and either a hosted equivalent named by its own row id or an
  explicit "none".
- **`11-S2`** — the blocked register: every in-scope capability that would need a package absent
  from the dependencies in `package.json`, with the §3 verdict and one chosen fallback each. Two of
  its ten entries — mail-message parsing and document text extraction — are now **closed** rather
  than deferred, by a platform binding rather than by a package, so `SPEC` §3 is untouched.
- **`11-S3`** — the absent bindings and the open commercial decisions: routing, weather, and
  foreign-exchange rates. Geocoding and place search stood here too until `docs/adr/0013-geoapify-for-geocoding.md`
  took it; the register keeps the closed entries, struck through and cited, because a reader needs to
  see that a decision was taken and where, not to find it silently gone.

**How an area plan uses this file.** A stage that runs into one of these boundaries writes one line
under its own **Blockers** heading naming the entry here, and plans the rest of the row around it.
It does not re-derive the exclusion, does not soften it, and never plans as though a package or a
binding were present. If a stage believes an entry here is wrong, it says so with its own
measurement — the same rule `README.md` applies to a `gap-rows.json` row.

**The stage container rule, fixed here.** `TEMPLATE.md` fixes eleven `###` headings per stage and
the order they appear in, but it does not say what delimits one stage from the next; three separate
audits of that file recorded the omission. This plan set closes it, and every plan file obeys it:

- A stage begins at a level-two heading of the exact form `## Stage <stage-id> — <title>`, where
  `<stage-id>` is the `NN-Sk` id the stage declares under its own **Stage id** heading.
- The eleven template headings inside a stage block stay at `###`, in the template's order, and
  nothing else in a plan file uses `###` at all.
- Anything finer inside a stage — a per-row entry, a table caption, a sub-case — uses `####` or
  deeper.

So a plan file's level-two headings are exactly `## Area brief` followed by one `## Stage …` per
stage in wave order, two consecutive stages can never run together as a flat sequence of `###`
headings with no boundary between them, and both halves of the rule are mechanically checkable:
`grep -c '^## Stage ' <file>` counts the stages, and the number of `^### ` lines between two of
those headings is exactly eleven. The rule lives here rather than in `TEMPLATE.md` because that file
is outside this plan's ownership; the amendment is carried as a contract extension.

## Stage 11-S1 — The ten hosted-model exclusions

### Stage id

`11-S1` — The ten hosted-model exclusions. Wave 1. Effort **S**: the rows it closes carry no effort
value in `gap-rows.json` because none of them is built, and the whole stage is the argument.

### Reference rows

Ten rows, each `out-of-scope → out-of-scope (closed as excluded)`. An excluded row is closed for
good: no later stage re-opens it, and no behaviour is deferred to a stage id, because there is no
stage to defer it to. Where a hosted equivalent is named by row id, that row — not this one — is
where the value is delivered, and it is planned in its own area file.

The reason all ten fail the same way is worth stating once. The reference product is one
installation per customer, so its operator and its user are the same person: an operator switch, an
operator credential, an operator filesystem and an operator network are all, from the product's
point of view, per-tenant. planned.travel is one deployment serving every tenant, so each of those
becomes either a cross-tenant switch, a shared credential, a machine that does not exist, or a
network we cannot reach.

#### MAP-04 — Map renderer choice with per-renderer tile source, token and style catalogue

Cited as `wiki: Map-Settings`.

**Why the shape does not survive.** The choice is only meaningful because the operator supplies the
tiles: they pick a renderer, paste their own map-service token and pay that service's bill for their
own install. One deployment serving every tenant has no per-tenant tile account to spend, and a
tenant-supplied token would be a third-party credential we store, proxy and get blamed for. `SPEC`
§3 pins the renderer to MapLibre GL over Protomaps `.pmtiles` served from our own `TILES` bucket and
freezes the dependency set, so the two alternative renderers are also unavailable as packages.

**Hosted equivalent: MAP-05.** One style preference over styles we serve ourselves, per user with a
workspace default — the setting already persists; what MAP-05 owes is the catalogue and the preview.

#### BKG-04 — Model-assisted parsing fallback for confirmations the extractor cannot read

Cited as `wiki: AI-Booking-Import`.

**Why the shape does not survive.** Two of its three parts are operator constructs. An
instance-level provider credential that overrides every user's own is, on one deployment, our
credential spent on every tenant's parse with no per-tenant meter; and local model management —
pulling a model onto the machine and managing it from an admin panel — presumes a filesystem and a
long-lived host, neither of which a Worker has. The remaining part, a background parse job with
sequential review, is shaped correctly for us and belongs to BKG-03.

**Hosted equivalent: BKG-03**, the deterministic extractor, which already exists as a complete queue
handler.

**Superseded in part by ADR 0012 — model-assisted parsing is in scope; the two operator constructs
are not.** When this entry was written, anything beyond deterministic extraction waited on the `AI`
binding decision recorded in `11-S3`. `docs/adr/0012-workers-ai-for-confirmation-extraction.md` takes that
decision: the `AI` binding is declared and `env.AI.toMarkdown()` plus a model call turn a document
into a draft booking. That changes this row's disposition from **excluded** to **excluded in its
reference shape, closed in ours**, and the distinction is the whole of the argument:

- The **instance-level provider credential** stays excluded. What lands is not a credential a tenant
  supplies or an operator overrides — it is a platform binding on our own account, spent by us, with
  a per-tenant ceiling in `resolveLimits()` and a KV counter in front of it so one tenant cannot
  drain the pool. There is no per-tenant key to store, proxy or be blamed for, which is exactly why
  the reference's construct does not survive and ours does.
- **Local model management** stays excluded, unconditionally and for the reason above: a Worker has
  no filesystem and no long-lived host, and no ADR changes that.
- The **background parse job with sequential review** was already shaped correctly for us; it is
  built by `03-S7` (`03-reservations-and-transport.md`, wave 5), which owns the producer, the queue
  branch, the staged draft and the confirm.

So `BKG-04` is closed by `03-S7` rather than by this register. The row's own line in
`03-reservations-and-transport.md` reads `absent → done`, and this entry stands as the record of
**which two thirds of it never came back**.

#### BKG-09 — External flight-log two-way sync and connecting-flight joining

Cited as `wiki: Transport-Flights-Trains-Cars`.

**Why the shape does not survive.** The reference holds one connection to the external service,
configured once under settings, and every user of that install shares it. On one deployment that
single credential would be shared across every tenant, which is a tenancy breach rather than a
feature. The hosted version — per-user OAuth to a third party, with token storage, refresh and
revocation per member — is a different feature with a different data model, not a port of this one.

**Hosted equivalent: none.** BKG-06 (manual transport entry) and BKG-03 (import from a confirmation
file) are the nearest capabilities in the product, but neither is an equivalent: they are manual and
per-trip, and they carry no external account.

#### DOC-05 — Personal photo-library connections to a self-hosted photo server

Cited as `wiki: Photo-Providers`.

**Why the shape does not survive.** The connection targets a machine on the operator's own private
network and needs two operator-only allowances to work: permission for the server to reach a private
address, and an escape hatch that skips certificate verification for a device with a self-signed
certificate. Neither can be delegated to a tenant of a shared deployment — one tenant asking our
Worker to fetch a private address is a request we must refuse, not configure — and a Worker has no
route onto a customer's local network in any case.

**Hosted equivalent: DOC-01 plus ADD-08.** A first-party picker over the photos a member has already
uploaded to our `FILES` bucket, chosen from the journal entry that wants them.

#### ADD-01 — Feature registry with deployment-wide enable and disable

Cited as `wiki: Addons-Overview`.

**Why the shape does not survive.** Enablement there is per installation and explicitly cannot be
scoped to a user. On one deployment serving every tenant, a switch of that shape toggles a feature
for every paying customer at once, which is not a product control — it is an outage with a checkbox.

**Hosted equivalent: none among the 89 rows**, because the equivalent is ours rather than the
reference's, and it is already modelled. `src/lib/plans.ts` declares `PlanModules` as **twelve
per-plan module flags** — `itinerary`, `map`, `budget`, `packing`, `reservations`, `journal`,
`atlas`, `collaboration`, `realtime`, `offlineMaps`, `pdfExport`, `prioritySupport` — and
`resolveLimits()` in `src/server/billing/limits.ts` resolves them for a tenant from the Stripe price
id, with per-tenant overrides having the last word. `/pricing` already renders them as what a plan
includes.

**The real work is enforcing them, and it has not been done.** Measured at HEAD: `hasFeature`,
`currentLimits` and `assertWithinLimit` in `src/server/billing/entitlements.ts` have no callers
outside `__tests__`, and `FeatureLockedError` (`src/server/billing/types.ts`) is constructed in
exactly one place — inside `assertWithinLimit`, which nothing calls — so it is never thrown in
production. Worse, `resolveQuotas` in `src/server/repos/base.ts` calls the same resolver on every
metered write and then returns only its column-shaped half, discarding the module flags it just
computed. So the modules are sold, displayed and resolved, and gate nothing. That gap belongs to
`08-product-modules.md`, which `README.md` scopes as the optional modules **and the entitlement gate
that sells them**; this row is the reason it must be planned as enforcement rather than as a
settings screen.

#### ACC-08 — Offline mode and background sync

Cited as `wiki: Offline-Mode-and-PWA`.

**Why the shape does not survive.** Partly the freeze — see the entry in `11-S2` — and partly the
conflict model. A client-side pending-change queue with its own conflict tokens and default
resolution rules is a **second** authority on what a concurrent edit means, competing with the one
we already have: the per-trip `TripRoom` Durable Object resolves last-write-wins per field against a
monotonic room version and can report what a write overwrote. Two resolvers disagreeing about the
same trip is the kind of defect that only appears in production, on a shared deployment, between two
tenants' members. The offline **map** half is not affected by this and is already served correctly.

**Hosted equivalent: ACC-07**, installability — the manifest, icons, standalone display and theme
colours — over the range-aware `.pmtiles` responses already served through the platform cache in
`src/routes/api/tiles/-lib/serve.ts`. That is the part of offline that a hosted product can actually
promise.

#### ADM-05 — Instance operations

Cited as `wiki: Admin-Panel-Overview`, `wiki: Admin-Users-and-Invites`, `wiki: Demo-Mode`,
`wiki: Admin-GitHub-Releases`.

**Why the shape does not survive.** Every item on it is deployment-scoped by construction, and on
one deployment serving every tenant each one crosses a tenant boundary: an instance user list is a
list of every customer's members; mail configuration is our configuration, not a tenant's; database
backup and restore is the whole fleet's database, so a per-tenant restore is not expressible; demo
mode changes the product for everybody; a release feed and update check tell a customer to upgrade
software they do not run. First-user-becomes-administrator is the same assumption stated as a rule.

**Hosted equivalent: ADM-02**, member and invitation administration inside a workspace, with ADM-01
and ADM-04 as the console that hosts it. Two operator concerns keep a non-feature home: mail delivery
is already wired through the queue's email handler against the `EMAIL_API_URL` configuration, and a
database export belongs to the nightly cron that `wrangler.jsonc` declares and
`src/server/worker.ts` currently answers with a warning.

#### EXT-01 — Plugin system

Cited as `wiki: Plugins`, `wiki: Plugin-Development`.

**Why the shape does not survive.** The runtime is the exclusion: each plugin runs as its own
operating-system process under a permission model, with its own database file in a plugin directory
on disk. Workers has no child processes and no filesystem (`SPEC` §3, Runtime). Independently of
that, an administrator-installed extension on one deployment executes inside every tenant's request
path, so the install decision of one customer would be a code-execution decision for all of them.

**Hosted equivalent: none.** There is no honest multi-tenant version short of an isolate-per-tenant
product, which is a different business.

#### EXT-02 — Plugin provider hooks and the plugin activity audit

Cited as `wiki: Plugin-Development`, `wiki: Plugin-Permissions`.

**Why the shape does not survive.** Every hook is a call into an installed third-party plugin, so it
inherits EXT-01 entirely. There is nothing left of the row once the runtime is gone.

**Hosted equivalent: MAP-07 for map markers, DOC-06 for document sections, ADD-05 for atlas layers,
ADD-08 for journal entry rows, ACC-05 for notification channels, ADM-04 for the tamper-evident
activity trail.** The value each hook delivers is first-party work we are already planning; what is
excluded is only the mechanism by which a stranger's code would deliver it.

#### EXT-03 — Built-in agent-protocol server

Cited as `wiki: MCP-Overview`.

**Why the shape does not survive.** Two independent reasons. The protocol SDK is absent from the §3
set — see `11-S2`. And the reference holds a session in the instance's memory, with sticky-session
and proxy-header requirements to keep a client pinned to it, which contradicts `SPEC` §5 outright:
stateless Workers, all state in D1, KV, R2 or a Durable Object. The correctly-shaped hosted version
would host the session in a Durable Object, and it would still need the absent dependency.

**Hosted equivalent: none.**

### Owned paths

`docs/plans/11-boundaries-and-blockers.md` — edit. This is the single repository path this plan
owns, for all three of its stages; `11-S2` and `11-S3` name none, so the disjoint-ownership rule of
`README.md` holds within the wave. No source file, no test, no configuration file and none of the
six shared paths is touched by this plan, in this wave or any other.

### Data and migration

No schema change. This stage adds no table and no column, so there is no migration to name and
nothing to backfill. One data fact is load-bearing for the entry above and is stated here so a later
stage does not go looking for it: `PlanModules` is a TypeScript shape in `src/lib/plans.ts` resolved
from the `subscriptions` row, not a column set — enforcing module entitlement needs no migration at
all.

### Server (repo, server function, Zod)

No repository, no server function and no Zod schema. The stage exposes nothing, so there is no input
to validate and no authorisation decision to place. The related server-side fact, recorded once:
`resolveQuotas` already resolves module entitlement on every metered write and discards it, so the
enforcement work that ADD-01 points at is a read of an existing value, not a new resolver.

### UI (route, components)

No route and no component. Nothing renders, so there is no empty, skeleton or error state to design,
no primitive to reuse and no token to request. A locked-module surface will need both a designed
lock state and a token pair for it; that requirement belongs to `08-product-modules.md`, which owns
the entitlement gate, and is named there rather than here.

### Quota

No countable row: this stage writes nothing, so it consumes no metric and asserts no ceiling. The
quota-adjacent finding that does matter is under ADD-01 — the resolver already computes the twelve
module flags inside `assertQuota`'s call path and throws them away.

### Tenant isolation test

No case is added to `src/server/repos/__tests__/tenant-isolation.test.ts`, because the stage adds no
repository function to isolate. The isolation argument this stage does make is the inverse one, and
it is the whole point of the register: every excluded row was excluded because a single-tenant
construct would have crossed a tenant boundary, and the ten entries above name which boundary each
one crossed.

### Verification

No browser evidence: the stage ships no surface, and a screenshot of a document is not evidence
about anything. The command gate is unaffected — `pnpm lint`, `pnpm typecheck`, `pnpm test` and
`pnpm build` see no changed source file — so what this stage is verified by is four checks over the
document itself:

1. Every feature id resolves to a real row:
   `grep -oE '(TRP|MAP|BKG|MNY|LST|DOC|COL|ADD|ACC|ADM|EXT)-[0-9]+' docs/plans/11-boundaries-and-blockers.md | sort -u`
   yields only ids present in `.claude/ultrabuild/recon/gap-rows.json`.
2. All ten out-of-scope rows appear: the ten ids whose `status` is `out-of-scope` in
   `gap-rows.json` each have an entry above.
3. Clean room: a case-insensitive search of this file for the reference product's name — the one
   `docs/SPEC.md` §1 forbids — returns nothing, and the file carries no URL, no reproduced sentence
   and no reproduced identifier from the reference wiki.
4. Formatting: `pnpm exec prettier --check docs/plans/11-boundaries-and-blockers.md` passes.

Console silence is not applicable; nothing executes.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply to every stage without amendment, and are
read for a document stage as follows:

1. `pnpm build` succeeds — unchanged by this stage; no source file is touched.
2. `pnpm lint` and `pnpm typecheck` are clean — unchanged for the same reason; eslint does not read
   markdown under `docs/`.
3. New logic has tests; `pnpm test` passes — this stage adds no logic. The four checks under
   **Verification** are its equivalent, and each is a command, not a claim.
4. Visually verified in a real browser, light and dark, desktop and mobile — not applicable: the
   stage ships no surface. Ticking this box would be ticking a box nobody looked at.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind — every entry
   above states a disposition; no entry defers its decision to a future editor.
6. You did not touch files outside your assigned ownership — the only path written is the one under
   **Owned paths**.

The visual clauses of `docs/SPEC.md` §2 are ticked per stage **for every surface the stage ships**.
This stage ships none, so none is ticked, and that is the honest reading rather than an exemption:
the moment any part of this plan grows a surface, it is a different stage and every clause applies
to it in full.

### Blockers

None. This stage is the record of other stages' blockers; nothing blocks the record itself.

## Stage 11-S2 — The frozen-dependency blocked register

### Stage id

`11-S2` — The frozen-dependency blocked register. Wave 1. Effort **S** for the register; the effort
of each fallback belongs to the stage that builds it.

### Reference rows

**This stage closes no row.** Every row named below stays with the plan that owns it, at the status
`gap-rows.json` records. What this stage fixes is the disposition each of those plans must adopt, so
that ten stages do not each rediscover the same missing package and each pick a different answer.

`docs/SPEC.md` §3 is unambiguous about the verdict, and it is the same for every entry: the
dependency set is complete, `package.json` and `pnpm-lock.yaml` are not edited, and a genuinely
missing package is **stop and report, do not install**. What §3 does not supply is what happens to
the feature afterwards, which is what this register decides. `TEMPLATE.md` fixes the vocabulary:
**defer** (wait for a decision), **hand-roll a restricted subset** (write a bounded thing ourselves,
with the bound stated), or **drop** (the capability is not sold).

Each entry names the missing capability rather than a package name where the package is a choice
rather than a fact, because naming a package invites installing it.

| #   | Missing capability                          | Rows it blocks                         | Wave of the earliest | Fallback                      |
| --- | ------------------------------------------- | -------------------------------------- | -------------------- | ----------------------------- |
| 1   | Locale and message runtime                  | ACC-06                                 | 1                    | hand-roll a restricted subset |
| 2   | Self-service identity-provider registration | ACC-01                                 | 1                    | drop                          |
| 3   | Agent-protocol SDK                          | EXT-03                                 | excluded             | drop                          |
| 4   | Offline storage and a background sync queue | ACC-08                                 | excluded             | drop                          |
| 5   | Markdown renderer                           | TRP-09, EXT-04, COL-07, ADD-08, DOC-06 | 1                    | hand-roll a restricted subset |
| 6   | Enrolment matrix-code encoder               | ACC-02                                 | 1                    | hand-roll a restricted subset |
| 7   | Track and placemark file parsing            | MAP-02                                 | 2                    | hand-roll a restricted subset |
| 8   | Mail-message parsing                        | BKG-03                                 | 4                    | hand-roll a restricted subset |
| 9   | Document text extraction                    | BKG-03                                 | 4                    | defer                         |
| 10  | Camera-format image decoding                | ADD-08                                 | 2                    | defer                         |

#### 1. Locale and message runtime — ACC-06

**Missing capability.** A message catalogue with plural and gender selection, and locale-aware
routing of every formatted date, number and currency. No such package is in the dependencies in
`package.json`.

**Verdict.** `SPEC` §3: stop and report, do not install.

**What exists already, measured.** `user_settings.locale` and `organization_settings.locale` are
real columns; `src/server/repos/settings.ts` validates a locale and resolves the user's over the
workspace's. The platform supplies `Intl` in both the Worker and the browser. The constraint a plan
would otherwise trip over is in `src/lib/format.ts`: it pins `const LOCALE = 'en-GB'`, freezes the
abbreviated month names in a table because the Worker runtime and WebKit disagree about them, and
says in its own header that there is exactly one date formatter in the product and a second must not
be added.

**Fallback: hand-roll a restricted subset.** The subset, stated so it cannot creep: a typed
catalogue module per locale keyed by message id, checked by TypeScript rather than at runtime; no
message-format parser — interpolation is named placeholders only, and plurals go through an explicit
category selector over `Intl.PluralRules`; locale threaded **through** the single formatter module,
never around it, with the frozen month table extended per locale rather than replaced by a runtime
lookup; direction handled as a document-level attribute plus logical CSS properties, which the token
set already supports. How many locales ship is a content decision for the user, not a code decision;
the mechanism is sized for one added locale to be a data file. A stage that finds itself writing a
message-format parser has left the subset and must stop.

#### 2. Self-service identity-provider registration — ACC-01

**Missing capability.** Per-workspace registration of an arbitrary identity provider: a stored
provider record with issuer, domain and client configuration, discovered at runtime and matched by
email domain at sign-in. The auth plugin that models this ships as a separate package and is absent.

**Verdict.** `SPEC` §3: stop and report, do not install.

**Measured.** The installed auth library at `1.7.1` exposes no such plugin; its plugin directory
carries twenty-six others. It **does** ship a generic OAuth plugin with discovery-document support,
which covers an arbitrary provider configured at deployment level from secrets — what it does not
cover is a tenant registering their own provider without us.

**Fallback: drop.** Per-workspace self-service provider registration is not sold. If arbitrary
enterprise sign-in is ever required, it lands as deployment-level configuration through the plugin
already in the pinned set — a secrets and configuration change, not a feature, and never a
tenant-editable one. Nothing else in ACC-01 is blocked: the change-password gap, email change,
avatar and account deletion are all ordinary work, and social sign-in is already the hosted
equivalent of arbitrary-provider sign-in at our tier.

#### 3. Agent-protocol SDK — EXT-03

**Missing capability.** A server-side SDK for the machine-client protocol, plus an authorisation-code
provider for its consent flow. Both are absent.

**Verdict.** `SPEC` §3: stop and report, do not install.

**Fallback: drop.** The row is excluded in `11-S1` on architectural grounds as well, so this is not
the only reason it is not built; but even if the session-in-memory problem were solved by hosting
the session in a Durable Object, the dependency would still be missing. Recorded here so that a
later reader who solves the architecture does not conclude the row has become buildable.

#### 4. Offline storage and a background sync queue — ACC-08

**Missing capability.** A client-side database wrapper for the cached trip bundles and the pending
change queue. No such package is present at any depth.

**Verdict.** `SPEC` §3: stop and report, do not install.

**Measured, and it corrects the row's own evidence.** That row lists three absent packages, and one
of them is not absent: `vite-plugin-pwa` at `1.3.0` **is** in `devDependencies`. Its service-worker
toolbox arrives transitively — the store carries the toolbox packages as its dependencies — but they
are not hoisted, so application code under `src/` cannot import them even though the build plugin
can use them internally. The correct reading is therefore narrower than the row's: generating a
service worker and a manifest through the plugin is available; importing the toolbox from our own
code is not; and the client-side database is absent outright.

**Fallback: drop.** The pending-change queue, the conflict tokens and the offline console are not
built — see the conflict-authority argument under ACC-08 in `11-S1`. ACC-07 is unaffected and stays
in wave 1 as ordinary work.

#### 5. Markdown renderer — TRP-09, EXT-04, COL-07, ADD-08, DOC-06

**Missing capability.** A CommonMark or GitHub-flavoured markdown parser, and the sanitiser that any
such parser obliges when it passes raw HTML through. Neither is in the dependencies.

**Verdict.** `SPEC` §3: stop and report, do not install.

**Measured.** Nothing in `src/` renders markdown today; the only occurrence of the word is the
`text/markdown` upload type in `src/server/fns/file-policy.ts`. Five rows want it: day notes
(TRP-09, wave 1), the in-app help browser (EXT-04, wave 1), shared notes (COL-07, wave 2), journal
entries (ADD-08, wave 2) and the document export that renders those bodies (DOC-06, wave 2).

**Fallback: hand-roll a restricted subset.** One implementation under `src/lib/`, owned by the
earliest wave-1 stage that needs it and reused by the other four; a second implementation is a
defect, not a convenience. The subset: block level — paragraph, heading levels one to three,
unordered and ordered list, fenced code, block quote, thematic break, and a simple pipe table;
inline — emphasis, strong, code span, hard break, and a link whose scheme is checked against an
`http`/`https`/`mailto` allow-list. Explicitly **not** in the subset: raw HTML pass-through in any
form, which is what removes the sanitiser requirement altogether; images inside a body, because
photos are an ordered entity of their own in ADD-08; reference links; footnotes; autolink literals;
nested block quotes. The renderer returns a React element tree — never a string assigned to
`dangerouslySetInnerHTML` — so the export path in DOC-06 serialises from the same tree rather than
parsing twice. Unsupported syntax degrades to its literal characters, never to a thrown error.

#### 6. Enrolment matrix-code encoder — ACC-02

**Missing capability.** An encoder that turns the enrolment URI into a scannable matrix image. No
such package is in the dependencies.

**Verdict.** `SPEC` §3: stop and report, do not install.

**Fallback: hand-roll a restricted subset.** Byte mode only, one fixed error-correction level, the
smallest symbol version that fits the enrolment URI, and an SVG output built from token-coloured
rectangles so it themes with everything else. It is a pure function with known published test
vectors, which makes it unusually cheap to prove correct. The typed secret stays on screen beside it
as the documented path for anyone who cannot scan, so the feature has a working degraded mode even
if the encoder is late.

#### 7. Track and placemark file parsing — MAP-02

**Missing capability.** Parsers for the two common geographic exchange formats, one of which is a
compressed container.

**Verdict.** `SPEC` §3: stop and report, do not install.

**Fallback: hand-roll a restricted subset.** Parse in the **browser**, where a document parser is a
platform API — the Worker has none, and `src/` uses neither — and send the result to the server as
ordinary validated place input through the manual-creation path MAP-01 owns, so the import path
writes the same rows with the same tenant scope and the same quota assertion as a hand-typed place.
The subset: waypoints from the track format and point placemarks from the markup format, name and
coordinates and description only. The compressed container is **not** in the subset, and neither are
routes, tracks with thousands of points, styles, overlays or nested folders. A file that exceeds the
subset is rejected at the boundary with a designed error that says which part was not understood.

#### 8. Mail-message parsing — BKG-03

**Missing capability.** A MIME parser for saved confirmation emails.

**Verdict.** `SPEC` §3: stop and report, do not install.

**Fallback, as this entry originally stood: hand-roll a restricted subset.** Headers plus a single
level of multipart, choosing the plain-text part when one exists; quoted-printable and base64
transfer decoding, both of which the platform supports directly; no nested multipart beyond one
level, no attachment extraction, no character sets beyond UTF-8 and Latin-1. The calendar attachment
is the high-value case and is already handled: `src/server/queue/ics.ts` reads iCalendar today, so
the parser's job is to find that part and hand it over, not to understand the mail.

**Closed by ADR 0012, and by dropping the requirement rather than meeting it.** `03-S7`
(`03-reservations-and-transport.md`, wave 5) accepts `.eml` and **writes no MIME parser at all**. A
saved confirmation email is read as raw text and handed to the model, which is what
`docs/adr/0012-workers-ai-for-confirmation-extraction.md` makes possible: the headers, the boundary markers
and the base64 blocks are noise the model reads past, and the booking details are in the text part
either way. The subset above is therefore not built. The one thing that is lost is the calendar
attachment shortcut — a base64 `text/calendar` part is not readable as text — and `03-S7` states
that limitation rather than hiding it: an `.eml` whose only booking data is inside an encoded
attachment comes back with fields the reader has to fill in, which is the same "recorded, needs
review" outcome any thin document already gets. `src/server/queue/ics.ts` keeps reading iCalendar for
the paths that hand it one directly.

#### 9. Document text extraction — BKG-03

**Missing capability.** Text extraction from a portable document. There is no realistic hand-rolled
subset: the format's text is compressed and font-encoded, and a partial reader silently produces
plausible nonsense, which is worse than refusing the file.

**Verdict.** `SPEC` §3: stop and report, do not install.

**Fallback, as this entry originally stood: defer.** It waited on the `AI` binding decision in
`11-S3`, which offers a document-to-markdown conversion as a platform capability rather than a
package.

**Closed by ADR 0012.** That decision has been taken:
`docs/adr/0012-workers-ai-for-confirmation-extraction.md` declares the `AI` binding and `env.AI.toMarkdown()`
is the extraction, as a platform capability and not as a package — so `SPEC` §3 is untouched and
nothing is installed. `03-S7` (`03-reservations-and-transport.md`, wave 5) builds it and reads PDF,
HTML, the common image formats and plain text through it. The deferral's own condition is met, so
this entry is **closed**, not softened: the reason it was deferred was that a hand-rolled subset
produces plausible nonsense, and nothing here asks anyone to hand-roll one.

Two limits survive the closure and are named by `03-S7` rather than here: the conversion has a
published list of accepted formats and `.pkpass` is not on it, so that format stays rejected at the
upload boundary with the designed message this entry always called for; and a document that converts
to too little text is treated as unreadable rather than as an empty booking.

#### 10. Camera-format image decoding — ADD-08

**Missing capability.** Decoding the still-image format modern phones produce by default, which most
browsers cannot decode and no package in the set can convert.

**Verdict.** `SPEC` §3: stop and report, do not install.

**Fallback: defer.** It waits on the image-transformation binding decision in `11-S3`, which accepts
that format as an input and can emit a web format. Until then ADD-08 accepts the formats a browser
can decode and rejects the rest at the upload boundary with a designed error rather than storing a
file the gallery cannot show. This is the one deferral with a real product cost — a photo journal
that rejects the default camera output of a common phone is a visible hole — so it should be the
first of the three binding decisions put to the user.

#### Looked at and **not** blocked

Recorded so no stage re-litigates them: the budget donut and any other chart (MNY-04) is SVG arc
geometry over existing tokens, and `src/components/ui/sparkline.tsx` already sets the precedent;
calendar output (DOC-07) is a serialiser we write, and the reader already exists; comma-separated
export (MNY-05) is done; installability (ACC-07) has its build plugin present already; and every
formatter ACC-06 needs is a platform `Intl` object rather than a package.

### Owned paths

None. This stage creates and edits no repository file; its output is the register above, inside the
document owned by `11-S1`.

### Data and migration

No schema change, and none implied. Each fallback above is deliberately shaped to write through an
existing table: imported places become `places` rows through the path MAP-01 owns, imported bookings
become `reservations` rows through the path BKG-03 owns, and a rendered body is a read of a column
that already exists.

### Server (repo, server function, Zod)

No repository or server function. Two contracts the fallbacks impose on the stages that build them,
stated once: parsing that happens in the browser is **input**, not a result — the server re-validates
every coordinate, date and amount with Zod and re-checks authorisation, because a well-formed
payload from a client is not an authorised one. And no hand-rolled parser runs on the request path if
its input is user-supplied and unbounded; it belongs in the queue handler that already exists.

### UI (route, components)

No route and no component. Every deferral and drop above owes a **designed** refusal rather than a
silent failure — a named format list, a reason and a next action — and each is the owning stage's
responsibility under its own **States** heading, not a blanket allowance from here.

### Quota

No countable row. One rule for the stages that build these fallbacks: an import path creates the
same rows as manual creation, so it asserts the same metric at the same place inside the repository,
before the write. A bulk import that skips `assertQuota` because "the user already had the file" is
a quota escape.

### Tenant isolation test

No case is added, because the stage adds no repository function. Any import path built on a fallback
above adds its own case where it lands, on the same terms as a hand-created row.

### Verification

The register is verified by the same four document checks as `11-S1`, plus one that is specific to
it: every capability listed above is absent from the dependencies in `package.json`, checkable by
reading that file, and every capability in the **not blocked** list is either present there or is a
platform API. The stage runs no code and produces no browser evidence.

### Definition of done

The six items of `docs/SPEC.md` §7 are read exactly as under `11-S1`: items 1 to 3 are unchanged by
a document, item 4 is not applicable because the stage ships no surface, item 5 is satisfied by every
entry carrying a disposition rather than an open question, and item 6 by owning no path at all. The
§2 visual clauses are not ticked, for the same reason.

One additional condition is specific to this stage: it is done only if **every** entry names one
fallback. An entry with two dispositions, or with a disposition conditional on something not named
here, has not decided anything and leaves the next stage exactly where it started.

### Blockers

None. The register is the disposition of the blockers, and each of the ten is disposed of above.

## Stage 11-S3 — Absent bindings and the open provider decisions

### Stage id

`11-S3` — Absent bindings and the open provider decisions. Wave 1. Effort **S** for the record; each
decision it records is the user's, and carries a cost rather than an effort.

### Reference rows

**This stage closes no row.** It records what fifteen rows across five plans are waiting on, so that
each of them stops at the decision instead of picking a provider inside a feature stage. The rows
and the plan that owns each:

| Row    | Owning plan                        | Wave | Waiting on                                                         |
| ------ | ---------------------------------- | ---- | ------------------------------------------------------------------ |
| MAP-01 | `02-places-and-maps.md`            | 1    | ~~geocoding — reverse lookup for a map-click place~~ — ADR 0013    |
| MAP-02 | `02-places-and-maps.md`            | 2    | ~~place search — type-ahead and share-link resolution~~ — ADR 0013 |
| MAP-03 | `02-places-and-maps.md`            | 5    | ~~geocoding — address completion on the place form~~ — ADR 0013    |
| MAP-08 | `02-places-and-maps.md`            | 3    | ~~routing — segment times and totals~~ — ADR 0019                  |
| MAP-09 | `02-places-and-maps.md`            | 4    | ~~routing — road lines behind the overlay~~ — ADR 0019             |
| BKG-07 | `03-reservations-and-transport.md` | 2    | ~~an airport and station reference dataset~~ — ADR 0010            |
| BKG-08 | `03-reservations-and-transport.md` | 3    | ~~public-transit routing~~ — ADR 0011                              |
| BKG-03 | `03-reservations-and-transport.md` | 4    | ~~the `AI` binding~~ — ADR 0012                                    |
| MNY-06 | `04-budget-and-currencies.md`      | 2    | foreign-exchange rates                                             |
| MNY-07 | `04-budget-and-currencies.md`      | 1    | foreign-exchange rates                                             |
| TRP-05 | `01-trips-core.md`                 | 2    | foreign-exchange rates                                             |
| COL-10 | `07-collaboration-and-sharing.md`  | 2    | foreign-exchange rates                                             |
| DOC-06 | `06-documents-and-media.md`        | 2    | the `BROWSER` binding or its equivalent credentials                |
| DOC-08 | `06-documents-and-media.md`        | 6    | weather                                                            |
| ADD-08 | `08-product-modules.md`            | 2    | the image-transformation binding                                   |

MNY-07 in wave 1 and MAP-01 in wave 1 are the two that make this stage urgent rather than tidy: both
are wave-1 rows whose central behaviour — a rate frozen at save time, an address on a map-click
place — cannot be built at all until a decision that is not a build decision has been taken.

**Eight of the fifteen have since had their decision taken, and the strikethroughs above say which.**
This stage records what a row is waiting on; when the waiting ends, the row leaves the register
rather than the register quietly keeping it. Five ADRs did it, and each is the argument this file
deliberately does not make itself:

| Row                    | Closed by                                                    | Now built by                                         |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| BKG-07                 | `docs/adr/0010-airport-catalogue-from-public-domain-data.md` | `03-S2`, wave 2                                      |
| BKG-08                 | `docs/adr/0011-here-for-public-transit-routing.md`           | `03-S3`, wave 3                                      |
| BKG-03, and BKG-04     | `docs/adr/0012-workers-ai-for-confirmation-extraction.md`    | `03-S7`, wave 5                                      |
| MAP-01, MAP-02, MAP-03 | `docs/adr/0013-geoapify-for-geocoding.md`                    | `02-S4` w3 mints the proxy; `02-S13` w4, `02-S11` w6 |
| MAP-08, MAP-09         | `docs/adr/0019-here-for-road-routing.md`                     | `02-S9` w5, `02-S12` w6, once plan 02 cites the ADR  |

BKG-08's wave moved from 2 to 3 when `03-S3` was rewritten around a real provider; the table above
now states 3, and `03-reservations-and-transport.md` is the authority. BKG-04 is not one of the
fifteen — it is an `11-S1` exclusion — and it is listed here because the same ADR that closed BKG-03
changed its disposition too; its own entry says exactly which parts of it stayed excluded.

**Seven rows still wait**, and the two registers below are still the record for them: weather
(DOC-08) and foreign-exchange rates (MNY-06, MNY-07, TRP-05, COL-10) are untouched, and the
`BROWSER` (DOC-06) and image-transformation (ADD-08) bindings are still absent from `wrangler.jsonc`.

### Owned paths

None. This stage creates and edits no repository file; its output is the two registers below, inside
the document owned by `11-S1`.

### Data and migration

No schema change here, and one warning for the plans that will need one. A frozen rate is a stored
number with a source and a timestamp, so MNY-07 will ask `00-foundations.md` for columns; a cached
forecast and a cached geocoding result are equally storable. None of those columns can be designed
before the provider is chosen, because what a provider licenses us to **retain** differs from
provider to provider and is often the binding term. So the sequence is decision, then column, then
feature — never a schema shaped around a provider we have not chosen.

### Server (repo, server function, Zod)

No server function. Two contracts for whoever builds against a provider once one is chosen: an
outbound call is never made from the request path when a cache can answer it — `ARCHITECTURE.md` §4
already fixes the caching layer — and a provider credential is a secret, never a checked-in variable
and never a value a tenant supplies. A per-tenant third-party credential is the shape that made
BKG-09 out-of-scope in `11-S1`, and it does not become acceptable elsewhere.

### UI (route, components)

No route and no component. One design consequence worth stating before it is designed around: a
type-ahead search box is not a neutral UI choice — it is a per-keystroke outbound call, and it is
exactly the usage pattern the constraint below rules out for the free tiers that look attractive.
Any surface that would search as the user types must be planned with a debounce, a minimum query
length and a cache, and those are decisions the owning stage makes **after** the provider is chosen,
not before.

### Quota

No countable row. But every one of these providers is metered by someone, and a metered outbound
call made on behalf of a tenant is a cost a noisy tenant can inflict on every other. When one is
adopted, its call rate belongs in the same place as every other ceiling — `resolveLimits()` — rather
than in a constant inside a feature module. The published number is the enforced number applies to a
provider call as much as to a row.

### Tenant isolation test

No case is added. The isolation rule that these decisions must not break: a cached provider result
keyed only by its query is shared across tenants, which is correct and desirable for a public fact
such as a place name, a forecast or a rate — and is a leak for anything derived from a tenant's own
data. A cache key that contains a trip id, a place id or a member id is tenant data and must be
scoped like tenant data.

### Verification

Verified as a record, by the same document checks as `11-S1`: every row id in the table above
resolves in `gap-rows.json`, and each wave matches the table in `README.md`. The binding facts below
are checkable against `wrangler.jsonc` directly. No code runs and there is no browser evidence.

### Definition of done

The six items of `docs/SPEC.md` §7 are read as under `11-S1` — unchanged gate, no surface, no
ownership beyond the register — and the §2 visual clauses are not ticked because the stage ships
nothing to look at.

The condition specific to this stage: it is done only if each provider decision below that is still
open is left **open with its constraint stated**, and none of them is silently resolved by naming a
provider inside this file. Choosing one here would be the worst outcome available: a plan is not the
place a commercial commitment gets made. **A decision that has since been taken elsewhere satisfies
that condition rather than breaking it**, provided the register names the ADR that took it and does
not restate the reasoning — which is why the five closures above are one line each and a citation.

### Blockers

Two kinds, both of which `TEMPLATE.md` names as blockers rather than as work: a binding absent from
`wrangler.jsonc`, which is a foundations requirement **and** a cost-model change; and a third-party
service whose terms do not permit a paid, subscription-funded product.

#### The binding register

`wrangler.jsonc` declares seven bindings — `DB`, `KV`, `SESSIONS`, `FILES`, `TILES`, `TRIP_ROOM`,
`TASKS` — in both the production and the staging environment, and `ARCHITECTURE.md` §3 documents
exactly those seven. **`BROWSER` and `AI` are absent from both environments**, as is the
image-transformation binding. **`AI` is absent but no longer undecided**: ADR 0012 adopts it, and the
row for it below now records a decision taken rather than a question open. It is added by the
wave-4 bindings stage of `00-foundations.md`, filed there by `03-S7` under its own **Blockers**, in
the form the paragraph below requires. That file's bindings table used to carry `AI` as **report
only** on the strength of BKG-04 being out of scope; it has since been corrected, and its stage
register records that the requirement left with the area — `03-reservations-and-transport.md`
migrated to the tracker before wave 4 opened, so the binding ships as issue #177 and the register
mints no stage for it. Adding one is an **infrastructure and cost decision for the user**, not a
build step, and no feature stage may add one: `wrangler.jsonc` is one of the six shared paths, the
change lands together with its re-export from `src/server/worker.ts` where one is needed, and
`README.md` requires a new binding to be argued as a cost-model change — which `ARCHITECTURE.md` §8
now does, under **Metered outbound calls**, with the rate and the arithmetic at two scales.

| Binding                       | Absent from            | Would unblock                                                                                                                                                                                                             | What exists instead today                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BROWSER` (browser rendering) | production and staging | DOC-06, the document export, at its highest fidelity                                                                                                                                                                      | `src/server/queue/handlers/pdf-export.ts` already renders through the same service's REST interface when a token and an account id are configured as secrets, and writes self-contained print markup when they are not. The capability is wired; what is absent is the binding form of it and the account configuration. |
| `AI` (model inference)        | production and staging | **decided — ADR 0012.** It unblocks entries 8 and 9 of `11-S2` and BKG-03, and changes BKG-04's disposition; `03-S7` (wave 5) builds against it and files the binding on the wave-4 bindings stage of `00-foundations.md` | nothing. BKG-03 reads calendar attachments deterministically and rejects the rest — which is what `03-S7` replaces.                                                                                                                                                                                                      |
| image transformation          | production and staging | the camera-format decoding deferred as entry 10 of `11-S2`, for ADD-08; and the `thumbnail` task kind, which `src/server/queue/types.ts` declares and `src/server/queue/consumer.ts` leaves without a handler             | nothing. Uploads are stored as received.                                                                                                                                                                                                                                                                                 |

What the user is actually being asked, for each:

- **`BROWSER`.** The included allowance on the paid plan is ten browser-hours a month with ten
  concurrent browsers, and beyond it usage is charged per browser-hour, with an additional charge
  per concurrent browser above the included concurrency. Exports are seconds each, so the allowance
  is generous at our scale; the decision is about enabling a billed product on the account and about
  the free plan's much smaller daily allowance, not about a large bill.
- **`AI`.** This was the one that changes the **shape** of the bill rather than its size:
  `ARCHITECTURE.md` §8 models storage, requests, CPU, rows, operations and object storage, and has no
  line for per-inference pricing at all. Adopting it means the cost model gains a term whose driver
  is user behaviour on a feature we would be inviting people to use. **That question has been
  answered — ADR 0012 adopts it — and the answer carries the mitigation with it:** the driver is
  bounded per tenant by a ceiling in `resolveLimits()` with a KV counter in front of the outbound
  call, because there is no row to `COUNT(*)` for an inference and `assertQuota` therefore cannot be
  the enforcement. `ARCHITECTURE.md` §8 still owes the new term, and that is a foundations edit
  rather than a decision.
- **Image transformation.** The transformation binding accepts the camera format as an input, with a
  stated maximum input size per call, and can emit a web format. Its cost is per transformation, and
  its natural pairing is the unimplemented thumbnail job, so the decision is best taken once for
  both rather than twice.

For context on all three: `ARCHITECTURE.md` §8 puts the whole platform bill at roughly six dollars a
month at ten users and under nine at a thousand, with storage as the driver. Any per-use binding is
therefore a larger proportional change to this product's economics than its unit price suggests,
which is precisely why it is the user's decision and not a stage's.

#### The provider decisions — two still open, and one taken in four parts

Three capabilities stood here with **no provider chosen and no budget agreed**. Two of them still do,
and this file deliberately does not choose for them:

1. **Weather** — the per-day forecast, the historical read for a past trip and the climatological
   estimate beyond the forecast window, for DOC-08.
2. **Foreign-exchange rates** — the rate frozen at save time for MNY-07, the re-basing in MNY-06, the
   converter widget in TRP-05 and the guest currency resolution in COL-10.

**The third — geocoding and place search, with its adjacent decisions — has been taken, and not as
one decision.** It was recorded here as a single question with four parts hanging off it: reverse
lookup for MAP-01, type-ahead and share-link resolution for MAP-02, address completion for MAP-03,
plus routing (MAP-08, MAP-09), transit routing (BKG-08) and the airport and station reference dataset
(BKG-07) as adjacent decisions "taken with it or immediately after it". They were taken separately,
by four ADRs, and the separation is the interesting part:

- **BKG-07** turned out not to be a provider decision at all. `docs/adr/0010-airport-catalogue-from-public-domain-data.md`
  buys nothing: a public dataset is fetched at **build time** by a pinned script, committed as a
  deterministic artefact and read from our own D1. No runtime call, no meter, no terms to honour on
  the request path.
- **BKG-08** is a bought service — `docs/adr/0011-here-for-public-transit-routing.md` — and it is
  the one that proves the constraint below is not theoretical: the obvious free option was refused
  after its terms were read rather than skimmed.
- **MAP-01, MAP-02 and MAP-03** are `docs/adr/0013-geoapify-for-geocoding.md`, and the property that
  decided it was not price but **the right to keep the coordinate**, which is the "cache and for how
  long" term named two paragraphs below. The provider we had already contracted for BKG-08 could not
  be reused, for exactly that reason.
- **MAP-08 and MAP-09 — routing** became their own decision rather than an appendix to a closed
  one, and `docs/adr/0019-here-for-road-routing.md` took it: the provider already contracted for
  BKG-08, and the term that shaped it was less retention than that one request may not serve more
  than one end user. `02-places-and-maps.md` calls this its Gate B.

The two conditions below therefore still bind, unchanged, for weather and for rates.

**The binding constraint, which no plan may plan around.** A free tier is not evidence that a
capability is free to us. Two conditions rule out the options that look cheapest, and both must be
checked against the provider's actual terms before a provider is named:

- **A tier whose terms exclude a commercial, subscription-funded product is unusable to us.** We
  charge for subscriptions through Stripe. A "free for non-commercial use" tier is therefore not
  available to this product at any traffic level, however low, and adopting one would be a licence
  breach dressed as a saving.
- **A policy that forbids type-ahead or automated per-keystroke querying is unusable for search.**
  Several open geocoding endpoints prohibit exactly that pattern, and several also require that a
  product whose core function is geocoding run its own instance rather than use theirs. MAP-02 is a
  search-as-you-type feature by definition, so it is precisely the case those policies exclude.

Two further terms decide the cost more than the per-call price does and must be read at the same
time: what the provider allows us to **cache and for how long** — which our whole caching strategy
depends on — and what **attribution** it requires on screen, which is a design constraint on a
surface that has not been designed yet.

**The rule this stage exists to impose: the plan that needs a provider stops at the decision.** It
describes the capability it needs, the call pattern, the cache it would keep and the attribution it
would owe, and it puts the choice to the user. It does not name a provider, does not assume a free
tier, does not write a client for an unnamed service, and does not ship a feature degraded into
uselessness in order to avoid asking. A stage that reaches this boundary is not blocked on us — it
is blocked on a commercial decision, and saying so plainly is the whole of its job.
