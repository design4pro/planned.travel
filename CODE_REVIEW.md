# Code review

Review rules for this repository, read by `om-code-review` (and therefore by `om-auto-review-pr`
and `om-review-prs`) on top of its built-in checklist. The binding standards are docs/SPEC.md §6
and §7; docs/agents/CODING_STANDARDS.md distils them and is the `reviewChecklist` in
`.ai/agentic.config.json`. Where this file and those disagree, docs/SPEC.md wins.

## Severity

- **Blocker** - the PR must not merge as is. A layering-contract violation, a suppression, a
  removed or skipped test, a missing locale key, a missing tenant-isolation test, a hand-edited
  generated file, a new dependency, a red validation gate.
- **Should fix** - a real defect or a clear standards miss that does not break a contract:
  a `console.log`, a nested ternary, a default export outside a route module, an untested branch
  the ticket names, a smell from the baseline that the author cannot justify.
- **Nit** - style or naming with no behavioural consequence. Never blocks; batched into one comment.

A red required check or a conflicted head is reported as a blocker together with the full code
review, never instead of it.

## Blockers: the floor

These are mechanical and admit no judgement. The pre-migration pipeline enforced them with a
floor guard script; the review now does.

1. **No new suppressions.** Any added `@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
   `eslint-disable-next-line` or `eslint-disable-line` is a blocker, whatever the comment says.
2. **No skipped or narrowed tests.** Any added `.skip`, `.only`, `.todo`, `.fixme`, `xit`,
   `xdescribe` or `xtest` in a test file is a blocker.
3. **No deleted test files.** A removed `*.test.ts`, `*.test.tsx`, `*.spec.ts` or `e2e/**/*.ts`
   spec is a blocker unless the code it tested was deleted in the same PR and the PR body says so.
4. **Generated files are never hand-edited.** A diff in `src/routeTree.gen.ts` must be exactly what
   `pnpm generate-routes` produces; a diff in `drizzle/` exactly what `pnpm db:generate` produces.
   `bash .ai/scripts/check-generated.sh` proves it.
5. **The stack is pinned.** A change to `dependencies` or `devDependencies` in `package.json`, or
   a `pnpm-lock.yaml` diff not explained by an existing dependency's transitive update, is a blocker
   (docs/SPEC.md §3). Dependabot PRs carry `dependencies` and are the one exception.

## Layering contract (blockers)

- **SQL only in `src/server/repos`**, through the tenant-scoped base repository; the tenant filter
  must not be removable. The stated exceptions are three, and closed (SPEC §6): `src/server/auth/provisioning.ts` (Better Auth identity tables `user`, `organization`, `member` only, never imported from the tenant schema, with the participation anchor written through `auth/participation.ts`; a fourth table is a blocker), the `…Unscoped` shape below and `src/server/catalog` (global tables, one
  reminder discovery read, the erasure catalog with ids-only discovery and system-actor cleanup and one ids-only tenant audit retention
  discovery read, docs/SPEC.md §5 and §6). The one other writer is `src/server/auth/participation.ts`, the auth layer's write-only `INSERT OR IGNORE` into `workspace_participants` (SPEC §5, ADR 0043): it is no precedent for any other table. SQL anywhere else is a blocker. An `…Unscoped` function in `src/server/repos` may instead take a plain `Database` under SPEC §5 FU-3: an `Unscoped` suffix, a file-header justification, one named production caller per function, and a narrow projection that cannot return tenant content. Grep `Unscoped` callers; any caller outside the named one is a blocker.
- Better Auth's own tables reached through its adapter (`ctx.context.adapter`, as the passkey plugin does for the user-keyed `passkey` table) are not application SQL and not an exception: SPEC §6. Raw SQL against an auth table outside `auth/provisioning.ts` is still a blocker.
- **Every new or changed repo method has a tenant-isolation test**: a row of another organisation
  must be invisible to the call. No test, blocker.
- **A guard added to one writer reaches every sibling writer of that surface in the same PR.** A
  trip, role or ownership check on one money, booking or transport writer is applied to the others
  that take the same ids, or the PR body names each one left out with its issue. A sibling a lower
  role can still reach is a blocker; otherwise a should-fix. The guard also ships with a tenant and a
  member isolation test (#880, #921, #934, #1029, #1032, #1043: #836 -> #837 -> #878 -> #1027 -> #923
  each found the next unguarded sibling).
- **Routes call server functions (`src/server/fns`); server functions call repos.** A route with
  a query in it, or a server function called from inside another server function's handler
  (`scripts/check-server-fn-manifest.mjs` explains why that ships broken), is a blocker.
- **Zod on every server-function input.** An input typed by hand or trusted from the client is a
  blocker.
- **A server-function input schema only gains optional fields.** A new `.string()` or `.number()`
  that is required makes every tab loaded before the deploy fail its next save; make it `.optional()`
  and default it in the handler, and make it required one release later (BACKWARD_COMPATIBILITY.md
  §2: only optional inputs are non-breaking). A required new field is a blocker in code (#972) and a
  should-fix in a spec (#846).
- **`src/components/ui` never fetches data and never imports from `src/server`.**
- **`src/server/public` returns named, column-whitelisted, read-only projections**, with the tenant
  scope derived from the resolved share or feed record; feed scopes are built only by
  `openFeedScope` from the repo-branded `ResolvedFeed`.
- **`src/server/email` imports no Worker binding**; `src/server/auth/email.ts` owns the message
  union; `src/server/queue/handlers/email.ts` delivers.
- **D1 migrations are additive** - a running Worker must survive the migrate-then-deploy window.
  See BACKWARD_COMPATIBILITY.md.

## Mutation recovery (should fix)

- **A failed response or follow-up does not prove the write failed.** Distinguish a committed write,
  a refusal and an unknown outcome before offering a retry; review a lost-response or failed
  activation/reload case to ensure the UI reconciles persisted state without inviting a duplicate
  (#987, #1251, #1207).
- **A server refusal must recover from the client state that caused it.** Review a stale opening
  snapshot through the refusal, a current-state re-read (including its failure), a visible localised
  explanation with usable focus, and the next permitted action; retry must not silently reuse intent
  invalidated by the refusal (#1241, #1251, #1207).
- **A result is applied only to the state it was started from.** A save, reload or loader refresh
  that settles after the user moved on (another dialog open, a second write, a different session)
  must not overwrite what is on screen: capture a generation or session counter when the request
  starts and compare it when it settles, seed a draft when its dialog opens rather than from loader
  object identity, and let a local "succeeded" value stand until the loader changes. The test holds
  the first request on a deferred promise, acts again, then resolves it (#1337, #1466;
  #1241 and #1251 were the same shape in a money write).
- **A control its own action disables or removes hands focus to a named target.** A disabled button
  cannot keep focus and a removed one drops it to `body`, so the fix names where focus goes (the
  trigger once the request settles, the surviving sibling, or the heading) and a test asserts
  `document.activeElement` on the confirm and the retry path, not only the direct one: jsdom does not
  blur on disable, so the direct path alone passes. A keyboard user who loses their place is a
  blocker when the focused control leaves the DOM (#1439, WCAG 2.4.3) and a should-fix otherwise
  (#1297, #1391, #1430, #1488).

## Concurrent writes (should fix)

- **A write whose condition was read by an earlier statement binds that condition into the writing
  statement.** A guard that reads a row, decides, then writes by id is racy on D1: two calls both
  pass the check and the later write undoes the earlier. Put the condition in the `WHERE` of the
  `UPDATE` or `DELETE` (status, version, owner, the id list the user confirmed), or in the same
  `batch`, and check that a row actually changed; a read-modify-write of a whole record puts a version
  in the `WHERE` or becomes per-field writes. A destructive confirmation, an ownership change or a
  seat count that can be lost this way is a major, and the PR carries a test that races two calls
  (#1439 a major; #1308 is the same shape, waived there because its spec documents last-write-wins, so a documented last-write-wins is the exception; #1391, #1426, #1430 and #1250 found the same shape; the `Promise.allSettled`
  test in `member-roles.test.ts` is the pattern).

## Localisation (blocker)

User-facing copy is never hardcoded. A new string means a new key in `en` and in every other locale
under `src/lib/i18n/messages/` in the same PR; the parity test enforces the set. Rendering a literal
string, or adding a key to `en` only, is a blocker. Procedure: the `i18n-messages` skill;
contract: docs/SPEC.md §9. RTL (`ar`) layouts use logical properties, never `left`/`right`; the safe-area insets (`gutter-x`, `px-safe`) are the exception, because they belong to the screen and not to the reading direction.
The one bounded exception is server refusal copy (§9 rule 10): a new name in
`AUTHORED_ERROR_NAMES` without the same PR amending that rule is a blocker.

## Style (should fix)

- TypeScript strict. No `any`; no non-null `!` on a value that can genuinely be null.
- Named exports only; default exports only in route modules.
- `cn()` from `src/lib/cn.ts` for class merging.
- No nested ternaries. Switch or if/else chains.
- No TODOs, placeholder copy, `console.log`, or commented-out code.
- Conventional Commits, in English.

## Tests (should fix)

New logic has tests at the seams the ticket names, not implementation-coupled and not tautological.
Component tests run in the `ui` vitest project, server code in `server`, and tooling and policy
files in `tooling` (vitest.config.ts). A new e2e journey belongs in `e2e/` and must run against the
3030-3040 port range that `playwright.config.ts` insists on.

An assertion on the order of rows a test wrote itself holds only if the query's `ORDER BY` puts
those rows in that order. Rows written in the same millisecond tie on `created_at` and on `newId()`'s
time prefix, so their order is random: assert a set, or give the rows distinct instants (#500, #510).
Two forms keep returning: sorting ids in the test with `localeCompare`, which orders the random tail
differently from SQLite's binary `ORDER BY id` (a blocker in #1250, red about 3 runs in 10), and
writing a batch of rows with no pause between them (#1271, 52 posts in one millisecond).

A constant, fixture or contract that encodes what a vendor returns or refuses (what a parameter
means, which fields a product carries, the first date a range accepts) is checked against one live
answer for a place and date whose real value the author knows, not against the parameter's name or a
recorded fixture. NASA's `T2M_MAX_AVG` is the hottest hour of the month, so Tokyo in October read
27.5 / 9.1 against about 22 / 14 and two review rounds missed it (#1204); NASA answers 422 before
1981 and the refusal was cached for every workspace (#1192, a major, because the entry is shared);
MET's `compact` product carries no chance of rain, found only by calling it (#1046). A PR that
pins vendor behaviour with no live sample in the PR body is a should-fix finding.

A layout-shift assertion in an e2e journey counts the shifts of the section under test, attributing
each entry by `sources`, and reports the rest. The app shell shifts 0.0005 to 0.0007 on a slow CI
runner (font swap, badge counts), so a zero-tolerance assertion over the whole page is green locally
and red in CI (#1185 failed three times). #1209 met the same 0.00073 shell shift locally and scoped
its window to the weather request instead, on a test-engineer verdict; that is how docs/SPEC.md's
"zero layout shift after paint" is measured.

When a layout-shift test uses a fake clock, mark the observed entry count rather than comparing a
virtual `performance.now()` with native `PerformanceEntry.startTime`.
Prove the assertion detects an intentional shift inside its measured section and window; a green
check without that failing probe is a should-fix (#1209, #1283).

## Docs and CI (should fix)

- **A change updates every document that states what it changes.** A PR that adds, renames, retires
  or re-routes a label, workflow, automation, skill, guard, runner variable or gate step greps the old
  name and count across `AGENTS.md`, `SDLC.md`, `docs/agents/`, `docs/adr/` and the workflow
  comments, and fixes each statement it makes false in the same PR (#542, #543, #498, #563, #653,
  #657, #772, #775). The PR body's "Docs grep" box lists the terms searched; a ticked box with
  no terms counts as unchecked.
- **The docs grep covers what code says too.** A PR that renames, deletes or changes the behaviour of a
  function, module, constant or rule greps its name and the claim it made across the waiting specs
  in `.ai/specs/` (a spec still telling a ticket to delete what is already gone), `CONTEXT.md`, and the
  docblocks and comments in `src/` - not only `docs/`. Leaving one stale is a should-fix, and a
  "none" in the PR body's grep box on a PR that changed behaviour counts as unchecked (#880, #925,
  #964, #977, #798; waiting specs also in #682's and #819's runs). The grep also covers the OLD
  text, not only the new name: a PR that rewrites a user-facing sentence or label greps a distinctive
  phrase of the old one over `e2e/` and the test files (`e2e/journeys.spec.ts` still asserted the old sentence in #1366, found only by the product-owner review; a surface moved to the catalogue broke
  tests that found it by English labels in #1549), an invariant by its constant name as well as the
  feature's words (`DEAD_KEYS` sat in a waiting spec the feature grep missed, #1314), and a count a
  skill override repeats is searched in the overrides too (#1434). A `docs/plans/` file headed
  "Migrated" and "frozen" is not edited (#968 reverted it): the stale statement goes in the PR body.
- **Widening what an unattended run accepts names every input it now admits.** A PR that drops or
  loosens a filter, trusted-author list or trigger of an automation, schedule or `afk-*` skill
  (`authors`, labels, who may comment, which issue sources) lists the input classes the old filter
  excluded - bot and dependency PRs, a stranger's comment, a Sentry-filed issue, a spec-only diff -
  and shows each is still refused or handled. An input that can then reach Bash or a merge without a
  person is a blocker (#772 a blocker, #775 majors; the `authors` gate is a security gate, SDLC.md § Automations).
- **A job moved to another runner is proven there.** A `runs-on` change shows a run of that job on
  the new runner, and every tool the job calls (`pnpm`, `gh`, what an action unpacks itself with) is
  installed by a step in the workflow rather than assumed from the image; for a required check or a
  shipping job (deploy, rollback) a gap is a blocker (#497, #563).

## Specs (should fix)

A spec that says a design is "bounded", "atomic" or "works by construction" names the platform or
library limit it rests on and shows it was read, not remembered: D1's bound parameters per statement
(a test harness refuses oversized ones), the Queues message size, what a Better Auth hook does and does
not fire, which store an optimistic overlay updates. A claim contradicted by the limit is a
should-fix finding, not a nit (#846, #847, #875, #877, #827).

## Definition of done (docs/SPEC.md §7)

The reviewer confirms the PR body's checklist against the diff:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean with no new suppressions.
3. New logic has tests and `pnpm test` passes.
4. UI changes are visually verified light and dark, desktop and mobile, by the blind A/B pair
   from `scripts/visual/capture.mjs`; both frames are attached to the PR (`om-auto-qa-pr`
   produces them). A UI diff without the pair carries `needs-qa` and cannot merge without it.
5. No TODOs, placeholder copy, `console.log`, or commented-out code.
6. Files outside the ticket's ownership are untouched; anything noticed elsewhere goes under
   "Noticed but not touching" in the PR body.

## Smell baseline (judgement)

The Fowler smell baseline in docs/agents/CODING_STANDARDS.md applies as labelled heuristics
("possible Feature Envy"), never as hard violations, and never where a documented standard endorses
the shape. Skip anything `pnpm lint` already reports.
