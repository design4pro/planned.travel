# Changelog

Releases of planned.travel. A release is a `develop → main` promotion (ADR 0003), so there is no
package to version: `package.json` is `private` and carries no `version`, and the repository has no
release tags. **The topmost heading below is the version of record.**

That is deliberate rather than an omission. A deploy already has two identifiers, and both name the
exact artefact rather than a number someone typed: `VITE_SENTRY_RELEASE` is the commit SHA, read by
the client and the Worker bundle alike so Sentry sees one release per deploy, and
`CF_VERSION_METADATA` is Cloudflare's own version id for the deployed Worker. A semver in the
manifest would be a third identifier that nothing reads and nothing correlates with those two, and
`om-auto-update-changelog` resolves its default `--version` from the manifest — so a field nothing
keeps current would quietly become the next release number. One source is safer than two.

What the heading is actually used for:

- `om-auto-update-changelog` reads it to resolve `--since last-release` when drafting the next entry;
- `om-close-fixed-issues` reads it for the same argument, and it is how the housekeeping sweep knows
  how far back to look for issues whose `Closes #n` pull request merged into `develop` — GitHub does
  not close those itself, because `develop` is not the default branch. That boundary is a floor that
  only moves forward: a new heading narrows the sweep's window rather than widening it, so anything
  that merged before the topmost heading needs a one-time explicit backfill — `--since` set to the
  oldest merge still unreconciled, and a `--limit` wide enough to reach it. The seed entry below
  does not perform that backfill, and does not stand in for it.

Bump **minor** for a promotion carrying user-visible features, **patch** for one that carries only
fixes and internal work. **Major** is unused until `1.0` means something.

Entries are written by `om-auto-update-changelog` and land as an ordinary docs pull request. The
skill is run by hand at promotion time and deliberately not on a schedule: the Highlights paragraph
is written by a person. The seed entry below is the exception, and says so in its own note.

---

# 0.1.0 (2026-09-21)

## Highlights

Six weeks, from an empty repository to a multi-tenant travel planner on Cloudflare Workers. A trip
now has people on it — roles, invitations, guests who can be merged into members, and a visibility
switch — and a day inside it is one sequence of stops, notes and transports rather than three lists
that disagree. Places arrive by dropping a pin, pasting a position or asking the geocoder; the map
draws on a basemap this project publishes itself. Bookings fill themselves in from a confirmation
file and a stay covers the nights it actually covers. Around that: an atlas of travel statistics, a
dashboard with a multi-zone clock, billing on Polar with promotion codes, 23 locales with a parity
test that refuses a key missing from any of them, and Sentry wired to both runtimes with a feedback
widget that carries screenshots.

The other half of the six weeks is not a product feature and is listed as itself: the agent pipeline
that now grooms, triages, implements, reviews and QAs the work, and the CI and test net it answers to.

> **About this entry.** It is a seed, derived from the titles of the 277 pull requests merged into
> `develop` between 2026-08-08 and 2026-09-21 — 41 `feat`, 70 `fix`, 6 `perf`, 61 `docs`, 33
> `chore`, 18 `test`, 17 `refactor`, 14 `ci`, 4 sandcastle runs, 1 `revert` and 12 whose titles
> predate the Conventional Commits rule. The three user-visible categories are itemised below and
> grouped by area; the rest are documentation, the test net, refactors and delivery plumbing, which
> a reader of a changelog does not need line by line. It carries no `*(@handle)*` credits and no
> Contributors block, because it did not go through the Supersede Credit Rule's verification pass —
> entries from `0.2.0` on do.
>
> **Cutoff: `feefaecc7` (#676, 2026-09-21T05:52:57Z)** — the tip of `develop` this entry was
> enumerated against. The heading's date is not the window's end, because more merged into
> `develop` that same day: #677, #675 and #695 landed after this cutoff and belong to `0.2.0`, not
> here. `0.2.0` must start from this commit rather than from `merged:>=2026-09-21`, which would
> re-collect #674 — counted here, but not itemised, so the duplicate guard cannot see it. Every
> entry records its cutoff this way; the reason is in the repo-local `om-auto-update-changelog`
> override.

## ✨ Features

### Trips and membership

- ✨ Copy a trip — the dialog, the two-phase write, the copier registry (#367)
- ✨ The membership writers hold, and there is one read model (#453)
- ✨ Who is on this trip — the people route, roles, invitations and the visibility switch (#458)
- ✨ A guest on a trip - the record, duplicate refusal, the bound, and the merge into a member (#574)
- ✨ Read the trip list two ways, and fold the archive (01-S7) (#620)

### The planner

- ✨ A day note you can write — the guard, the detail, the icon and the editor (#388)
- ✨ Render a day as one sequence of stops and notes (#404)
- ✨ The journey in its day — a transport row in the day's one sequence (#438)
- ✨ Drop a pin on the map and it becomes a place (02-S4) (#619)

### Places and the map

- ✨ Basemap catalogue and a map preference that is finally read (#308)
- ✨ One geocoding proxy behind a provider port (fixes #281) (#363)
- ✨ Publish the planet archive and pin a live upstream build (#414)
- ✨ Paste a position into the place form (#635)

### Bookings

- ✨ The confirmation file that fills the desk in (#435)
- ✨ A stay that covers the nights it actually covers (03-S8a) (#614)

### Dashboard

- ✨ Add the reference column and its multi-zone clock (#422)

### Billing

- ✨ Promotion codes on subscribe and plan change, with a staging unlock pool (#617)

### Interface

- ✨ Reveal a masked code in place (#616)

### Localisation

- ✨ Localise the trip action menu and its two dialogs (#285)

### Data and tenancy

- ✨ The trip_guests table, ahead of the readers 01-S6b gives it (fixes #288) (#463)

### Observability

- ✨ Sentry error reporting, safe failure surfaces, and a Sentry→backlog routine (#128)
- ✨ Feedback widget with screenshots, traces drain, verified source maps (#233)

### The agent pipeline and delivery

- ✨ Pocock AI workflow — skills, guardrails, sandcastle loop with Playwright sandbox (#57)
- ✨ First staging+production deploy wiring (real resources, Access, CI dedup) (#62)
- ✨ Integration branch in its own worktree, cut automatically on start (#71)
- ✨ Advisory pixel-critic pass after green UI validation (#75)
- ✨ Pre-triage untriaged bug and maintenance issues (#85)
- ✨ Advisory deep-review stage, vendored design vocabulary, runnable architecture review (#126)
- ✨ Key each run to a numbered run id so runs can go in parallel (#150)
- ✨ Shared run coordination so two fleets never build one issue (#154)
- ✨ Resume a run by full id and wait out usage limits (#190)
- ✨ Adopt the label protocol of ADR 0015 (#249)
- ✨ Plan-area workflow with a subagent panel, Polish run conversation (#284)
- ✨ Cut over to Cezar automations running the om-* skills (stage 2) (#293)
- ✨ Resolve inline review threads from the om pipeline (#301)
- ✨ Per-skill cezar prompt templates; prune the retired automations (#310)
- ✨ Resolve blocking review threads without a human running the skill (#314)
- ✨ Declare the JSON reporter unconditionally in playwright.config.ts (#395)
- ✨ Report the landed URL instead of a list of anonymous-only routes (#396)
- ✨ Make .ai/specs say what became of every decision in it (#417)
- ✨ Let grooming hand a ready issue on, through a narrow gate (#676)

## 🐛 Fixes

### Trips and membership

- 🐛 Render the untitled-day fallback from the message catalogue (fixes #399) (#420)
- 🐛 Give the tile's star one owner, so the badge answers the press (#460)
- 🐛 Refuse a duplicate trip member with its own code (#593)

### Journeys and transports

- 🐛 Recover the unlanded sandcastle work for PRD #167 (#276)
- 🐛 Carry the trip read predicate into the journal's two readers (#455)
- 🐛 Read a journey only where its trip is readable (fixes #456) (#519)
- 🐛 Resolve journey writes and id-keyed helpers through the ADR 0020 read predicate (fixes #521) (#577)

### The planner

- 🐛 Name the day in the add-note control's accessible name (#398)
- 🐛 Name the journey row's drag handle after its action (fixes #445) (#461)
- 🐛 Take the plan board's write controls away from a viewer (fixes #392) (#508)
- 🐛 Check the day before writing the place in createPlanPlaceFn (#603)

### Bookings

- 🐛 Translate the field name in a required-booking-field error (#279)
- 🐛 Read an extensionless upload by the reader the boundary accepted it by (fixes #464) (#595)
- 🐛 Refuse a reservation that is not a booking of the named trip (#625)

### Atlas

- 🐛 Keep region_count off travel_stats year rows (fixes #139) (#430)
- 🐛 Read the stat cohort as a sub-select, not a hundred bound ids (fixes #381) (#448)
- 🐛 Name whose places each atlas place count is (fixes #241) (#505)
- 🐛 Wrap the country card's fact labels instead of truncating their qualifier (fixes #228) (#506)

### Auth and access

- 🔐 Keep paired auth actions inside the panel (fixes #598) (#610)

### Interface

- 🐛 Raise portalled poppers above the dialog scrim on their own z band (fixes #201) (#298)
- 🐛 Pair every matchMedia query with its Tailwind breakpoint in rem (fixes #423) (#424)
- 🐛 Clear the feedback actor below lg so the last row stays reachable (#579)

### Localisation

- 🌍 WebKit/workerd runtime parity (#58) + sandcastle loop hardening (#60)
- 🌍 Read the reader's locale for every rendered figure and string (#231)
- 🌍 Call a whole transport a transport, not a leg (#275)

### Content rendering

- 🐛 Bound the link scan so parse stays linear on unclosed links (#612)
- 🐛 Bound the angle-destination and title closer searches (#630)

### Data and tenancy

- 🐛 Read trip_guests off disk through the helpers #465 left behind (#473)
- 🐛 Unlink a transport's arrival day before deleting the day (fixes #186) (#504)
- 🐛 Stop the membership ordering comment promising creation order (fixes #462) (#510)

### Platform

- 🐛 Stop nesting server functions so console screens load (#163)
- 🐛 Keep console session verbs on the right side of the client boundary (#165)
- 🐛 Name the store that actually holds terminal job failures (fixes #305) (#356)
- 🐛 Let deliberate repository refusals keep their own sentence (fixes #391) (#478)
- 🐛 Handle the billing follow-ups the webhook enqueues (fixes #304) (#493)
- 🐛 Decide the authored-refusal channel contract (fixes #482) (#525)

### The agent pipeline and delivery

- 🐛 Pin the repo-root docker image tag for worktree-anchored sandboxes (#73)
- 🐛 Stop leaking worktrees, share the sandbox caches (#89)
- 🐛 Put the Claude CLI on PATH through $GITHUB_PATH (#152)
- 🐛 Keep `ready-for-agent` off PRDs and verify every published slice (#166)
- 🐛 Stop a spent Claude usage limit failing the review, mention and triage jobs (#217)
- 🐛 Stop the loop spending fix budgets on itself, then make it faster (#229)
- 🐛 Enter the reference demo in the capture, restore E2E_RETRIES (#247)
- 🐛 Inline the branch prefix into the claim's gh pr list filter (#253)
- 🐛 Hand the issue back when the setup step fails (#255)
- 🐛 Keep the dev server on 127.0.0.1 and move the port pool to 3030-3040 (#256)
- 🐛 Stop the code review passing without having read the pull request (#262)
- 🐛 Turn the devtools console relay off for the sandbox dev server (#261)
- 🐛 Let the agent's fast loop reach a root-level spec (#264)
- 🐛 Keep husky out of cezar runs and name the design4pro-agent identity (#299)
- 🐛 Split PIPELINE_LABELS portably in set_pipeline_label (#302)
- 🐛 Read a newline as a command separator in git-guardrails (#329)
- 🐛 Key the host-patch markers off the code, not the comment (#332)
- 🐛 Scope the PR label poll with is:pr instead of the mixed family (#355)
- 🐛 Widen the label-event poll window so autofix stops starving (#353)
- 🐛 Render kit 13 - upload QA evidence with gh --attach (#362)
- 🐛 Stop the UI QA rounds' scratch failing pnpm lint (#387)
- 🐛 Walk every page of review threads, not just the first (#401)
- 🐛 Stand pr-autopilot down on the promotion pull request (fixes #380) (#405)
- 🐛 Stop an e2e dev server whose checkout was removed (#406)
- 🐛 Give the atlas journeys a budget of their own (fixes #384) (#411)
- 🐛 Start every MAP-05 attempt from a clean map_style row (fixes #477) (#512)
- 🐛 Wait for a free port and exit 75 when the pool stays full (fixes #324) (#522)
- 🐛 Gate the deploys on explicit needs results so a skipped scope does not skip them (#531)
- 🐛 Claim the PR before consuming review-threads (fixes #490) (#578)
- 🐛 Pin the local Playwright worker count to two (#594)
- 🐛 Escape raw control bytes so git reads source files as text (fixes #443) (#591)
- 🐛 Release review claims a housekeeping sweep leaves behind (#597)
- 🐛 Bound settleMutations from the test process so a lost evaluate reads as the cap (#628)
- 🐛 Run the spec index generator without the tsx IPC socket (#647)

## 🛠️ Improvements

### The planner

- 🛠️ Drop the day-notes read the itinerary threw away (fixes #393) (#429)
- 🛠️ Place a day's journeys on one trip resolution and one day's rows (fixes #446) (#451)

### Data and tenancy

- 🛠️ Serve the airport prefix read from NOCASE indexes (fixes #194) (#581)

### The agent pipeline and delivery

- 🛠️ 486 s → 224 s — shard the unit suite, cache the lint (#159)
- 🛠️ Instrument stages, tune model/effort per role, halve the fix loop's e2e (#215)
- 🛠️ Stop paying agents for flakes, stale ladders and leaked containers (#236)
