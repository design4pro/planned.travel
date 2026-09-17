# 0016. Critical journeys replace the visual gate, and the blind pair is the whole visual judgement

Status: accepted
Date: 2026-09-03
Supersedes: ADR 0004 (the visual gate).
Amends: ADR 0014 (e2e's share of the ladder), ADR 0015 (the `needs-e2e` label).

## Context

ADR 0014 measured e2e at 60% of the sandcastle ladder and treated that as a cost of the
orchestrator. It is not. It is the shape of the test suite: an inverted pyramid, with the weight at
the top.

**What the two sides actually cost.** The whole unit suite - 199 files, 4995 tests across `ui`,
`server` and `tooling` - is 20 s of wall clock and ~3 min of runner. The visual gate was twelve CI
shards at ~5 min each: **~60 min of runner per event**, twenty times the unit suite's, to hold 152
PNGs weighing 48 MB.

**16 of those 152 were never compared with anything.** `snapshotPathTemplate` carries `{platform}`,
so Playwright looked for `-linux` and `-darwin` names; the four impersonation-bar frames were
committed without the suffix, and the self-check written to catch exactly that class of failure
(`visual.spec.ts:2253`, asserting the four files exist) was green over them for as long as they
existed. A gate cannot police its own coverage, and this one demonstrably did not.

**The gate had also started spending its budget on itself.** The comment on `settleMutations()`
records that for an unknown period every frame was caught on the timeout cap rather than on a quiet
document, because the wait measured elapsed time with a `Date` the gate itself had frozen - "the
gate simply had no quiet guarantee at all and was paying 1.65 s a frame to have none". Nothing went
red.

**The judgement it was supposed to deliver is delivered elsewhere.** SPEC §8.814 makes the blind A/B
pair the thing an item is judged on. The baselines photographed two viewports at rest;
`scripts/visual/capture.mjs` photographs three widths across two themes, in the state the change is
actually about, and writes outside the repository. Two mechanisms, one judgement, and the one that
decides is not the one that costs an hour of runner.

**Meanwhile the code that carries the risk had no coverage at all.** `src/server/do/trip-room.ts` is
899 lines of WebSocket hibernation, `alarm()` rescheduling and prefix-scanned storage GC. Its only
appearance in any test is the empty stub `TripRoom: class TripRoom {}` in
`src/server/__tests__/worker.test.ts:40`. Queue retry and DLQ semantics, and KV/R2 binding
behaviour, are the same. Bugs were being hunted in 6315 lines of e2e and living in the Worker.

The geometry the atlas suite asserted is a case in point: `placeCountrySurface()`,
`surfaceAreas()` and `chromeFreeAreas()` are already asserted against themselves in
`src/components/atlas/__tests__/country-overlay.test.tsx`, 1670 lines of it. Four e2e tests were
paying for a browser to re-derive an answer a pure function already gives.

## Decision

**1. No screenshot is compared anywhere in CI.** `toHaveScreenshot`, `e2e/__screenshots__`,
`snapshotPathTemplate`, `pnpm e2e:update` and `.github/workflows/update-snapshots.yml` are gone.
The `e2e/helpers` determinism machinery that existed only to make a pixel comparison stable - time
masking, the calendar audit, `captureMode`, `fitViewportToDocument` - went with them: `shoot.ts`
was 2590 lines and the five modules that replaced it are 1242.

**2. The blind A/B critic is the whole of the visual judgement.** `scripts/visual/capture.mjs` was
already the mechanism SPEC §8.814 names. It is now the only one.

**3. Playwright keeps nineteen declarations, and the bar for one is explicit:** a test earns its place
in `e2e/` only if its failure mode cannot be produced in a lower layer. What survives is routing,
sessions, hydration, WebGL, real hit-testing, sequential focus and the request pipeline. Fifty
declarations became fourteen in `journeys.spec.ts`, plus three in `trips-core.spec.ts` and two
browser-free HTTP claims in `csrf.spec.ts`.

**4. The console is the net the pixels used to be.** Every journey attaches `watchConsole()` before
it navigates and fails on any `pageerror`, any `console.error` and any `console.warn` outside two
anchored, narrowly-scoped patterns. React reports a hydration mismatch through both channels, so
that class of defect still fails a run.

**5. The weight moves down.** A workerd vitest layer takes the Durable Object, the queue consumer,
the KV/R2 paths, `SELF.fetch()` and the i18n runtime parity check that today boots
`wrangler unstable_dev` from inside a Playwright test with a 180 s timeout. That layer is separate
work, this ADR does not wait on it, and it does not decide here how the layer is built: whether
`createTestHarness()` from the already-installed `wrangler` suffices, or whether
`@cloudflare/vitest-plugin` is needed and SPEC §3's dependency freeze has to be amended for it, is
a measurement that belongs to that work rather than an assumption made here.

**6. The suite runs on every PR again.** Two shards, ~10 min of runner, no `needs-e2e` label and no
`types: [labeled]` trigger. It needs no basemap - measured, see below - so it reads no R2 credential
and runs on a fork.

## Consequences

### What is given up, stated plainly

**Nothing fails a run any more because a screen changed shape.** A shifted card, a lost shadow, a
retuned colour, a swapped font, a grid that breaks at 1440x900 - all go green into `develop` unless
a human or the blind critic looks. That is a real class of defect and **this repository shipped
them**: the mobile dev-toolbar trigger sat over the "Trips" tab in five approved frames, six native
selects on `/settings` were photographed empty, an avatar's initials rendered as an empty circle.
The gate found all three. Nothing that runs unattended would find them today.

**The replacement is not equivalent and must not be described as one.** The blind critic runs at
review, not at commit; it judges the screens of its own change, not every screen; and it is a
model's judgement, not a byte comparison. A refactor with no intended visual change - a Tailwind
bump, a token retune, an edit to a shared layout - is exactly the case the baselines were best at
and the critic is worst at. Whoever makes such a change is responsible for looking at it.

**What still fails a run:** a route that 500s, a route that never hydrates, a React hydration
mismatch, an uncaught exception after paint, a console error or an unlisted warning, a map that
never finishes drawing, a tab bar something else is intercepting, a cross-site POST reaching a
server function.

### The cost, honestly

|                   | Before                                             | After                                                                                                                                                      |
| ----------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e` runner time | 12 x ~5.0 min = **~60 min**                        | **~22 min**, measured green on the 2-vCPU runner (run 33806080237): jobs of 9m44s and 11m58s, being 2-3 min of fixed cost plus 6m41s and 9m59s of journeys |
| Trigger           | push to `develop`/`main`, or the `needs-e2e` label | **every PR**                                                                                                                                               |
| R2 credentials    | required; the job skipped without them             | none; runs on a fork                                                                                                                                       |

Per event that is a **~63% cut**, and the first CI run corrected the estimate this table used to
carry. A local run at two workers suggested ~4.5 min a shard; the runner took 6m41s and 9m59s, plus
2-3 min of fixed cost that no worker count shortens. Both shards were then killed by a
`timeout-minutes: 10` sized from the wrong number - shard 1 seconds after its last test passed,
shard 2 mid-suite - which is now 20, with the config's `globalTimeout` at 15 so it stays the one
that fires first. The same three-times-slower runner also blew the 30 s per-test budget on `the
click surface never takes the reader's input`, three attempts out of three, so `timeout` is now
`isCI ? 60_000 : 30_000`. Every number in this table was wrong in the same direction, and all of
them were wrong because they were taken on a laptop.

**The saving is not banked; it is spent on frequency, and then some.** At ~6 PR events per merge,
6 x ~22 min ≈ **132 min against the ~60 the post-merge net cost**. The aggregate roughly doubles.
The earlier draft of this table said "about flat" on an estimate, and the measurement did not
support it. What is bought is the feedback loop - a regression is found on the PR that causes it
rather than after it lands on `develop` - and it is bought, not free. Whether that trade is worth
~70 extra minutes of runner a merge is a judgement this ADR states rather than hides; the lever if
the answer is no is the trigger, not the shard count (four shards halve the test time and pay the
fixed cost twice more, for about the same total).

_Amended by ADR 0022: the answer was no, and the lever pulled was neither of those two. A pull
request now pays for `chromium` alone - `mobile-safari` was measured as the larger half of every
event and the half that ran out of wall clock, and it moved to a nightly workflow. Every number in
the table above describes the arrangement that change replaced._

### Measurements taken for this decision

- **The atlas journeys need no basemap.** Run against an empty `.e2e-tiles/`, all six are green.
  `src/lib/map/world.ts` draws land, water and borders from Natural Earth 1:110m in the bundle
  precisely because the PMTiles archive is "routinely absent in development and on a cold bucket",
  and `map-canvas.tsx` probes the archive once and builds the map either way. `data-map-ready`
  latches on MapLibre's `idle` with or without tiles, and no journey asserts a coverage note or a
  street. So the ~480 MB `actions/cache` restore, the R2 download step and the credential gate all
  go. The cache-restore timing that would have decided this is moot and was not taken.
- **`hideDevChrome()` stays.** On WebKit at 393x659 and 393x852 the dev-toolbar trigger's own box
  lands over the "Trips" destination at 0,595, 98x64, where it takes the press. Hiding it is no
  longer tidiness for a photograph; it is what keeps the tab bar pressable. The finding is now
  asserted from the product's side, inside `a finger reaches the same facts on a phone`.
- **`workers: isCI ? 1` is not re-measured and stays, and the local evidence now supports it
  directly.** On a 16-core laptop, `a member reaches every screen behind the session` runs in 23 s
  alone on mobile-safari and 186 s at `--workers=2` - past its own 180 s budget, from one extra
  worker with fifteen cores idle. The contention is for the single dev server's SSR and the single
  software WebGL renderer, which is what PR #84 (run 33155138232: hydration outrunning a 10 s action
  timeout on 17 tests, 12 flaky) measured on the 2-vCPU runner. Fewer tests do not relieve it.

### What the thinner layer found on its first full run

The console being the whole net has a consequence nobody planned: TanStack Start warns once per
dev-server process that server functions are not behind `createCsrfMiddleware`, and with the
baselines gone that warning landed in whichever journey ran first and failed it. The gap was real -
nothing in the repository registered one - and it is fixed in the same branch (`src/start.ts`,
`e2e/csrf.spec.ts`). A suite that grades what the engine says finds things a suite that compares
pixels does not.

The same relay then bit the fix's own test: a same-origin probe to an invented server-function id
reaches dispatch, the Worker throws, and the throw lands in whichever journey was open. That half of
the claim is asserted by `trips-core.spec.ts` instead, which writes through a server function on our
own origin and reads it back from a second page - and the reasoning is written into
`e2e/csrf.spec.ts` so nobody adds the probe back.

### Documentation

ADR 0004's visual-gate bullet, ADR 0014's `needs-e2e` sentence, ADR 0015's label list and ADR 0003's
"visual e2e" are historical records and are not edited; each gets a one-line pointer here. The
fourteen plans under `docs/plans/` carry ~230 Verification blocks naming a gate that no longer
exists; two of them are frozen. Rewriting them would be a lie about what was decided when, so
`docs/plans/README.md` carries one banner and `12-verification-protocol.md`, which binds every stage
of every plan and is not frozen, is amended in place.

## Alternatives rejected

**Keep the baselines and shrink the matrix.** Six shards instead of twelve, one viewport instead of
two. It halves a cost that is twenty times the unit suite's and keeps every structural problem: the
16 uncompared frames, the self-check that could not see them, the 1500 lines of determinism
machinery, and the judgement still being made somewhere else.

**Migrate the suite to Stagehand.** Investigated and rejected on facts, not taste. It is not a test
runner - no `test()`, no fixtures, no workers, no sharding, no reporters, and `page.screenshot()`
returns a `Buffer` with nothing to compare it to. It is Chromium-only, so the `mobile-safari`
project could not move at all. Running it inside `@playwright/test` is undocumented and unexampled.
And its central benefit does not apply here: the selectors in this repository are not brittle - 41
`data-part`/`data-testid`, 15 `getByRole`, **zero** `getByText`, and the atlas interactions are
geometric (8 `page.mouse.*` over a WebGL canvas, 14 `boundingBox()`). Worth revisiting for
exploratory agent QA, as its own ticket.

**Tolerate the CSRF advisory instead of fixing it.** It would have been one line in
`TOLERATED_CONSOLE_WARNINGS`, and it would have made that table - whose whole documented invariant
is that no entry is the application talking - into a place to put inconvenient truths.
