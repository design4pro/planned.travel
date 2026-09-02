# Stage template

Every plan file in `docs/plans/` is a sequence of stage blocks in this exact shape. Copy the block at
the end of this file, fill every heading, delete nothing. The headings are the contract between a
plan and the agent that executes it: an orchestrator reads **Owned paths** to fan out without
collisions, and an auditor reads **Definition of done** to decide whether the stage closed.

Read `docs/SPEC.md`, `DESIGN.md` and `docs/ARCHITECTURE.md` before writing a stage. This file
does not restate them; it says where each of their requirements is answered.

## How a plan file is shaped

A plan file opens with a short **Area brief** — what this area is today on disk, what the 89-row
matrix says is missing, and which rows the plan closes — and then runs stage blocks in wave order,
lowest wave first. Nothing else. No appendices, no glossary, no status log; the wave order lives in
`README.md`. (Row statuses used to live in `.claude/ultrabuild/recon/gap-rows.json`, a machine-local
ultrabuild artifact that no longer exists anywhere — row ids like `MNY-07` survive in these plans as
historical identifiers only. Do not go looking for the file; verify a row's real status against the
code.)

## Rules that bind every stage

- **The eleven `###` headings below are required, in that order, and no others appear at that
  level.** A stage that has nothing to say under a heading writes one sentence saying so and why —
  "No new countable row: this stage only edits existing rows" is an answer. An empty heading is not.
- **Owned paths are disjoint.** Two stages in the same wave may not name the same file. None of the
  six shared paths governed by `00-foundations.md` may be named at all — see `README.md`.
- **The clean-room rule of `README.md` applies to every word of a stage.** The reference product is
  never named, its pages are cited as `` `wiki: <Page-Name>` `` with no URL, and no sentence, table
  name, enum value or UI string is reproduced from it.
- **The stage is the unit of ownership, the run is not.** A stage that cannot be finished by one
  agent in one run is two stages.

## Stage block — copy from here

### Stage id

`<NN>-S<k>` where `<NN>` is the plan's ordinal and `<k>` counts stages within it, e.g. `04-S2`. One
line, then a title, the wave the stage may start in, and an effort roll-up (S/M/L/XL) taken from the
rows it closes.

### Reference rows

The matrix row ids this stage closes (historically from `gap-rows.json` — see above), one per line, each with the status it moves **from** and
**to** — `MNY-07 partial → done`. A row is closed by exactly one stage. If a row is only partly
addressed, say which behaviour is deferred and to which stage id, because "partial → partial" that
nobody has to justify is how a matrix stops meaning anything.

Where a behaviour needs sourcing, cite the page as `` `wiki: <Page-Name>` `` on its own. Describe the
behaviour in planned.travel's vocabulary; never carry text across.

### Owned paths

Every file the stage creates or edits, as an explicit list of repository-relative paths — no globs
that could widen under a later refactor, except `__tests__` directories the stage owns wholly. Mark
each `new` or `edit`. This list is the fan-out contract: an auditor diffs the stage's actual changes
against it, and a path outside it is a failure even if the code is correct.

If the stage needs a change to a shared path, it does **not** appear here. State the requirement
under the relevant heading below so it becomes a wave-0 foundations stage in `00-foundations.md`.

### Data and migration

Tables and columns the stage needs. State for each whether it already exists in
`src/server/db/schema.ts` — most do; 57 domain tables are already deployed.

- Schema changes are **additive only** (`ARCHITECTURE.md` §9): a rollback must keep working against
  the new schema. No column is dropped, renamed or narrowed in the same stage that stops writing it.
- The schema edit itself belongs to `00-foundations.md`. This section states the requirement: table,
  column, type, nullability, default, the CHECK constraint for any enum, and the leading
  `organization_id` position in every new composite index.
- Name the migration `pnpm db:generate` will produce and say what it backfills, or state that it
  backfills nothing.
- Money is integer minor units plus a `text(3)` ISO-4217 currency. Dates are `YYYY-MM-DD` text, times
  `HH:MM` text, instants epoch milliseconds. Ids come from `newId()`. Do not invent a second
  convention.

### Server (repo, server function, Zod)

- **Repository.** The module under `src/server/repos/` and the exported functions the stage adds or
  changes. SQL lives here and nowhere else. Every query is built on `tenantFilter()` from
  `src/server/repos/base.ts`; a repository that can be called without a `TenantScope` is malformed.
- **Server function.** Each `createServerFn({ method })` the stage exposes, with its file under
  `src/server/fns/` or a route-local `-server/` directory, and what it returns.
- **Zod.** The v4 schema for every input — `z.email()`, `z.iso.date()`, `z.strictObject()`, the
  `error` parameter. Validation is shape, not permission.
- **Authorisation.** Say explicitly where it is decided. A server function is a public endpoint
  reachable without the route that renders its UI; `beforeLoad` is UX, never a data boundary. A
  well-formed id from the client is not an authorised id.
- Anything slow — export, import, email, thumbnails — is enqueued on `TASKS`, never run inline.
  Realtime fan-out goes through the per-trip `TripRoom` Durable Object and a patch type in
  `src/server/do/protocol.ts`, inside the 32 KiB frame and 40 msg/s limits.

### UI (route, components)

- **Route.** The path and file. A new route file means `pnpm generate-routes`;
  `src/routeTree.gen.ts` is never hand-edited. Say whether the route is SSR, `ssr: false` or
  `ssr: 'data-only'`, and why if it is not the default.
- **Components.** Which existing primitives from `src/components/ui` are reused — name them, because
  a second implementation of an existing primitive is a defect — and which new product components
  the stage adds, under `src/components/<module>/` or a route-local `-ui/` directory.
- **States.** For each list and each async surface, name the empty state's copy and illustration, the
  skeleton's shape, and the error state's recovery affordance. "Has an empty state" is not a plan.
- **Tokens.** Any colour, spacing, radius, shadow, easing or z-index value the stage needs that is
  not already in `src/styles/tokens.css` is a foundations requirement, stated here. No hard-coded
  hex, no one-off margin, `tabular-nums` on every number that can change.

### Quota

Which metric this stage's writes consume, and where the ceiling is asserted.

- If the stage creates a row a plan can run out of, name the metric, say whether it already exists in
  `resolveLimits()` (`src/server/billing/limits.ts`) or in `PLAN_QUOTAS` (`src/server/db/types.ts`),
  and name the `assertQuota(scope, metric, currentUsage)` call site — inside the repository, before
  the write.
- The published number is the enforced number. A metric added to the catalogue and not to the
  resolver is caught by `src/server/billing/__tests__/limits.test.ts`; a stage that adds one adds the
  case there too.
- For R2 writes, the order is object first, assert second, compensating delete on throw.
- If the stage creates no countable row, say so in one sentence and why.

### Tenant isolation test

The case added to `src/server/repos/__tests__/tenant-isolation.test.ts`: organization A asks, in A's
scope, to read, list, update and delete B's new rows by id, and to parent new rows onto B's rows.
Every one must be a `NotFoundError`, and B's data must be untouched afterwards. Name the repository
functions covered. A stage that adds a repository function and no isolation case is not done.

### Verification

- The command gate, run in this order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The unit tests the stage adds, by file, and what invariant each holds.
- The browser evidence: route, viewport widths at both ends of the 360px–2560px range, both themes,
  and the interaction state that is the point of the stage — a resting screenshot is not evidence
  about a hover affordance. `12-verification-protocol.md` owns the evidence format; this section
  names the specific screens and states, not the procedure.
- Console must be silent. A warning in the console is this stage's bug.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply to every stage without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

On top of those, the visual clauses of `docs/SPEC.md` §2 are ticked per stage, for every surface the
stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

A stage with an unticked box is not done, and neither is one that ticks a box it did not look at.

### Blockers

Anything that stops the stage, stated before it is scheduled rather than discovered mid-run:

- A package outside the SPEC §3 pinned set. Record the package, what it would do, and the
  disposition: **defer** (wait for a decision), **substitute** (a named platform capability that
  covers it), **hand-roll** (scope and risk of writing it ourselves), or **drop** (the row moves to
  `11-boundaries-and-blockers.md`). Never plan as though the package were present, and never install
  one — the freeze covers the dependency blocks of `package.json` and `pnpm-lock.yaml` absolutely.
  It does not cover the `scripts` block; see SPEC §3.
- A binding absent from `wrangler.jsonc`, which is a foundations requirement and a cost-model change.
- A third-party service whose licence or usage policy does not permit a paid, subscription-funded
  product, or that has no commercial tier. Name the constraint and the cost.
- A dependency on a row in another plan that has not landed. Cite the row id and its wave.

If there are none, write "None." — and mean it.
