# End-to-end testing

All product E2E tests now run through e2e-inc. The portable web engine owns
20 independent behaviors; a public custom browser engine owns the remaining
229 original Chromium instances, including CDP, WebSockets, independent cookie
jars and full iPhone emulation. Playwright remains a browser driver and
standalone assertion library; its test runner and configuration are removed.
The [inventory](e2e-inventory.json) records all 240 original Chromium instances
and their replacements. See [execution evidence](e2e-verification.md).

## Run locally

Use Node 24.x (at least 24.8), matching GitHub Actions, and the committed pnpm
lockfile. A newer major can change ICU/CLDR behavior: Node 26's ICU 79 gives
Vietnamese an additional cardinal category that the shipped catalogue does not
declare. Do not change translations or relax parity tests to accommodate a
different local runtime during this migration.
Provision a fresh checkout with `pnpm worktree:bootstrap`. For an automated QA
port, run `sh .ai/scripts/test-env-up.sh --force`, then read `baseUrl` from
`.ai/qa/test-env.json` and export it as both `E2E_BASE_URL` and
`PLAYWRIGHT_BASE_URL`. Do not open the credentials file. Commands that need custom
credentials may source the descriptor's `credentialsFile` without printing it.
A manually managed `.dev.vars` is never rewritten to fit the QA port: use its
own deliberately selected server with `PLAYWRIGHT_ALLOW_ANY_PORT=1` instead.

```sh
pnpm exec e2e-web install chromium webkit
pnpm exec playwright install chromium webkit
pnpm e2e:native --target chromium
pnpm e2e:native --target webkit
pnpm e2e:browser --target chromium
pnpm e2e:browser --target mobile-safari
pnpm e2e:all
```

`e2e` and `e2e:all` run both e2e-inc configurations sequentially and preserve a
failure from either. Use `e2e:native` or `e2e:browser` for target/name filters.
`test:e2e` remains the portable engine alias. Both configurations use one owned
origin, one worker, zero retries and bounded deadlines. They refuse ports outside
3030-3040 locally unless `PLAYWRIGHT_ALLOW_ANY_PORT=1` is deliberately set.

`bash .ai/scripts/e2e.sh` provisions the owned environment and runs both Chromium
suites. An `e2e/native/` or `e2e/browser/` selector chooses its configuration;
mixed selectors are rejected. The retained `-g` alias maps to `--grep`; filter
patterns remain single arguments and are never treated as file selectors. Never
run against an arbitrary remote database.

For an `E2E_BUILD=1` preview, set `E2E_PREVIEW=1`. The fixture date is already
compiled into that build, so both engines omit the development clock header and
the browser engine does not intercept font requests. Playwright routing disables
HTTP caching; on WebKit this produces unused-preload advisories even for modules
the entry has actually imported. Development keeps the header and font workaround.
CI exports the preview flag only after building that preview. Scenario-specific
headers, initial-request observers and fatal built-asset warning checks remain active.

The portable tests live under `e2e/native/`; the browser journeys live under
`e2e/browser/`. Authentication setup fails closed and caches the owner once.
Every browser journey starts in a fresh, anonymous context unless its declared
options or session helper explicitly authenticate it. Additional contexts inherit
the complete target profile and options while keeping independent cookie jars.
The browser engine applies the existing font-origin interception to direct
navigations as well, so fixture clock headers do not break webfont preflights.
The standalone request fixture has its own cookie jar.

The custom engine uses only `e2e/engine`'s public `defineEngine` and fixture SPI.
Its fixture records each hook and journey as a resource operation. Raw driver
operations retain exact assertions and auto-waiting, but do not become portable
`screen` actions, per-action replay recordings or model tools. No raw browser
handle is exposed to an agent. Observations explicitly report truncated page
text. Failures capture all live pages with secure-field masks; timeout capture
precedes context cleanup. Cleanup failures remain failures. `pnpm e2e:verify-engine` exercises assertion,
serial-member timeout and teardown failures through the actual CLI, then checks
the real iPhone profile and independent cookies. These probes use `node:test`
outside the unit-suite glob because the unit job does not install browsers.
Both E2E jobs require them after browser installation; the iPhone probe runs
locally and in the nightly WebKit job. PR probes explicitly skip only that
WebKit-only contract when its browser is not requested.

The registration facade translates static budgets, `slow` multipliers, hooks,
serial retry units, target exclusions, attachments and context options. Each
file calls `test.finish()` after its registrations. A serial unit preserves test
order and fail-fast behavior, while each member gets its own browser context.
Missing fixture sessions are assertions, never skips. Intentional engine-only
and optional evidence exclusions remain visible in reports.

## What moved

The original 2026-11-16 baseline contains 31 spec files and 235 Chromium test
instances, plus one setup. The PR base subsequently added the five landing
comparison locale cases from #1926; they are migrated too. The current inventory
therefore covers 32 files and 240 original Chromium instances. Seven files,
representing 11 original instances, now have 20 native behaviors. The additional reports come from splitting compound CSRF, contrast
and invitation scenarios, rather than adding repeated whole-app walks.

| Original file                   | Native owner                          | Preserved coverage / optimization                                                                                                                                                     |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `csrf.spec.ts`                  | `native/csrf.e2e.ts`                  | Foreign Origin, cross-site metadata, missing proof, API exclusion, document navigation; independent HTTP outcomes.                                                                    |
| `trip-invite-link.spec.ts`      | `native/trip-invite-link.e2e.ts`      | 404, no-store, no-referrer, robots header and HTML, 429 and Retry-After; isolated address and consumed response bodies.                                                               |
| `shell-safe-gutter.spec.ts`     | `native/shell-safe-gutter.e2e.ts`     | Authenticated and public shell, base gutters and simulated safe-area insets.                                                                                                          |
| `switch-contrast.spec.ts`       | `native/switch-contrast.e2e.ts`       | Four surfaces, both themes, hover and rest; actual computed contrast is polled instead of sleeping 400 ms.                                                                            |
| `workspace-invitations.spec.ts` | `native/workspace-invitations.e2e.ts` | Create, duplicate refusal, resend recovery, revoke; independently owned UUID fixtures cleaned in teardown.                                                                            |
| `billing-return.spec.ts`        | `native/billing-return.e2e.ts`        | Automatic and manual requests omit Referer; manual mode suppresses automatic scheduling, exact-function route observation prevents false positives, and the URL query remains intact. |
| `i18n-runtime-parity.spec.ts`   | `native/i18n-runtime-parity.e2e.ts`   | Same complete bundled probe, real workerd and browser, 23 locales, key-set/minimum-field/byte parity, including nightly WebKit.                                                       |

The other 24 files now execute through `e2e.browser.config.ts`, with the same
224 original Chromium titles and assertions. Their old `.spec.ts` copies and the
Playwright runner configuration are removed. No product behavior was classified
as unnecessary. Native `webkit` covers a 393x659 viewport; the custom
`mobile-safari` target preserves the full `devices['iPhone 15']` descriptor,
including touch and device scale, with the pinned 393x659 viewport.

## Browser journey coverage

Every migrated file retains its transitive session, readiness and console checks.
The optimization column records opportunities for future owned fixtures; it
does not permit deleting assertions or narrowing the browser/theme matrix.

| Migrated file (`e2e/browser/*.e2e.ts`) | Regression evidence                                                                                | Migration optimization                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `account-and-settings`                 | WebAuthn ceremony, rename/persistence, password refusal and focus recovery.                        | Keep CDP; separate list geometry from credential lifecycle and use an owned credential.                             |
| `app-manifest`                         | Icon MIME and the actual Chromium manifest parser.                                                 | HTTP checks can move independently; JSON parsing cannot replace Page.getAppManifest.                                |
| `atlas-visit-edit`                     | Visit date/note persistence, clearing and mobile focus recovery.                                   | Own the visit fixture; split save and clear while retaining themes and map readiness.                               |
| `basemap-preference`                   | Rendered Charcoal sea and persisted workspace/default override.                                    | Keep canvas sampling and final-color polling; a selected radio does not prove map rendering.                        |
| `book-medallion-spacing`               | Responsive medallion diameter and centered date lines.                                             | Seed an owned booking through an existing safe API; keep creation in its own journey.                               |
| `budget-and-currencies.visual`         | Converted rate visibility and honest missing-rate states.                                          | Separate behavior from viewport/theme matrix; restore currency preference in teardown.                              |
| `collaboration-and-sharing`            | Anonymous link rotation/revocation and socket reauthorization after role/archive changes.          | Keep independent contexts and actual close/welcome frames; isolate trip/guest fixtures.                             |
| `costs-roles`                          | Viewer CSV/download without writes and editor write controls.                                      | Save role-specific sessions and fixture IDs; retain filename and negative permission checks.                        |
| `costs-toolbar`                        | 360px filters, longest labels and keyboard reading order.                                          | Poll measured geometry and preserve every control and Tab step.                                                     |
| `currency-converter`                   | Local amount/swap without network calls, retry recovery and stable footprint.                      | Split conversion, failure/retry, cross-tab focus and layout; use deferred responses and request counters.           |
| `dashboard-mascot`                     | Late retry focus ownership and motion inside an unmoving hit target.                               | Split recovery and motion; defer the exact RPC and await widget state instead of networkidle.                       |
| `documents-and-media`                  | Upload rejection without a request, clipboard/drop focus, feed rotation and old-link refusal.      | Split upload, calendar permissions, feeds and navigation; keep real paste and anonymous contexts.                   |
| `file-preview`                         | SVG script is rasterized to PNG; PDF/text Escape and focus restoration.                            | Retain MIME plus null script marker, actual download and selectable PDF text; visibility alone is insufficient.     |
| `journeys`                             | Public/app/console hydration and engine errors, workspace isolation, forms and harness self-tests. | Split by feature; retain injected-failure proofs that console and map guards detect regressions.                    |
| `landing-comparison-overflow`          | Five locales, actual Geist glyphs, text containment, pointer and keyboard navigation.              | Preserve the complete new-base regression and independent device contexts; no screenshot baseline or platform skip. |
| `masked-code`                          | Reveal, held pointer, outside masking and WebKit-specific focus.                                   | Retain held mouse-down and both engines; own booking and restore mask preference.                                   |
| `places-and-maps`                      | Map camera bounds, viewer permissions, map-link security and keyboard/context pins.                | Split WebGL/permissions/editing, isolate viewer data and retain camera/map-ready measurements.                      |
| `product-modules`                      | Leave persistence and collection drafts across Back/reload/logout/workspace changes.               | Split domains, own account/preferences and negotiate actual RTL locale.                                             |
| `stop-menu-reflow`                     | Scrollable destination menu and correct reorder request in pl/de/ar.                               | Own language per target; preserve RTL arrow direction, mobile tap and exact request payload.                        |
| `trip-room-sign-out`                   | One device signs out; the other reconnects without losing its unsent draft.                        | Keep real contexts, socket close/welcome and queue eviction; API seed may replace only setup.                       |
| `trip-weather`                         | Deferred weather has no layout shift, disclosure semantics and no vendor allowance spend.          | Retain Worker provider ledger as well as browser requests; scope layout-shift attribution.                          |
| `trips-core`                           | Client navigation memory versus cold default, persisted planner notes and drag recovery.           | Split navigation, editing, notes, roles and widgets; keep request-count and keyboard announcements.                 |
| `wide-layout`                          | Preference synchronizes tabs, survives denied storage and renders before hydration.                | Preserve pre-hydration evidence, three widths and Arabic; wait on the specific widget.                              |
| `workspace-claim`                      | Stale tabs cannot write; room recovery preserves mounted draft identity.                           | Keep routeWebSocket and DOM identity probes; split stale-write, notifications and verify-in-place.                  |
| `workspace-departure`                  | Last-owner refusal and recovery after committed leave/lost response with exactly one audit event.  | Keep independent contexts and the local D1 failure trigger; never aim this fixture at remote data.                  |

The full migration exposed two product invariants previously hidden by the old
setup: the normal weather reading exceeded its reserved 80px box, and a Safari
pointer activation could leave `body` as the captured dialog opener. The shared
weather slot now reserves 104px across loading and settled states, including
localized readings. Dialog
and sheet wrappers let the primitive restore its registered trigger when the
page root was active. Existing exact geometry, zero-layout-shift, provider-call
and focus assertions remain. Component regressions simulate activation without
focus; diagnostic JSON records actual geometry rather than matching CSS class
names. Focus/geometry tests wait for real fonts and scrolling to settle.

## GitHub execution and Codex

1. Existing PR, push and merge-group scope rules choose whether the E2E gate runs.
   Documentation-only exceptions and promotion/draft restrictions are unchanged.
2. Each of the two isolated shards installs the browser builds resolved by both
   e2e-web and root Playwright,
   migrates local D1, seeds its own workspace and serves an `E2E_BUILD=1` build.
   Tests do not need R2 or production credentials.
3. Each shard runs the browser journey and portable Chromium configurations.
   A failure in either fails the shard; the second suite still runs after a
   regression in the first. The
   existing required `e2e · merged report` depends on the complete shard outcome.
4. The existing nightly workflow runs both portable WebKit and full iPhone
   browser journeys against `develop`. Its schedule/dispatch still requires
   the workflow to have reached the repository's default branch (ADR 0022).
5. Portable Markdown goes into the job summary. A failure publishes only
   report JSON, JUnit, summary, redacted trace pages and screenshots for two days.
   Sessions, cache, downloads and credentials are excluded. Diagnostic upload
   failures do not change the test verdict. PR totals require complete JSON reports from both
   configurations; missing or interrupted reports cannot report zero failures.

Codex is the author and debugger, while GitHub Actions runs the tests. The
project MCP entry runs the local `pnpm exec e2e mcp --target chromium`; it never
fetches an unpinned CLI with npx. After trusting the project and starting a new
Codex session, use `open_session`, `observe`, `locate`, `run_code` and `run_tests`
to write and verify a scenario against the same checkout. A local MCP process
needs the correct `E2E_BASE_URL` environment before it starts.

No Codex login or model key is needed for deterministic CI or MCP. Local
semantic exploration is opt-in: sign in with `pnpm exec e2e login openai`, start
the CLI/MCP process with `E2E_AGENT=chatgpt` and optionally `E2E_MODEL`, and use
`pnpm exec e2e explore '<one bounded goal>' --target chromium`. The existing
subscription scaffold is disabled in CI even when that variable is inherited.
Every `agent.act` must have one goal and end with a deterministic locator or
browser assertion. Cache replays do not replace fresh assertions; use one
uncached run when changing a goal. No model-driven tests or spend were added
to the required PR lane.

For optional Codex diagnosis inside Actions, the official
[`openai/codex-action`](https://developers.openai.com/codex/github-action) can
analyze failure artifacts in a separately reviewed trusted job using an API key
from GitHub secrets. This is different from ACP executing `agent.act` inside a
test. The repository already has a Cezar owner for fixes and review, so do not
activate a second autonomous repair allocator alongside it. No such workflow or
new credential requirement is enabled by this migration.

## Additional integrations

| Integration                                       | Useful next step                                                                              | Boundary                                                                                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@e2e-dev/acp` + `@agentclientprotocol/codex-acp` | Run `agent.act` using a Codex executor with recorded step tools.                              | Separate reviewed dependency maintenance and trusted opt-in job. Authenticate the agent on that runner; desktop login does not transfer to Actions. No personal auth files in cache/artifacts or fork jobs. |
| `@e2e-dev/browser-run`                            | Cloudflare Browser Run for isolated hosted Chromium, especially staging preview smoke.        | Additional reviewed package/token, reachable preview URL; it cannot reach runner-local localhost without supported networking. Preserve the local D1 gate.                                                  |
| `@e2e-dev/html-reporter`                          | A portable report for manual review of complex failures.                                      | Optional dependency; publish selected redacted evidence only. Current Markdown/JUnit needs no extra package.                                                                                                |
| `@e2e-dev/github`                                 | Managed PR result comments and job summaries.                                                 | Requires `pull-requests: write`; current job summary works with existing permissions. Do not introduce comments/token scope by default.                                                                     |
| `@e2e-dev/decision`                               | Advisory test prioritization on large PRs, using `--changed-since`.                           | Evaluate against full-suite results first. Never exclude auth, tenancy, billing or locale invariants from the required gate on a model's judgement.                                                         |
| Bounded `e2e explore`                             | Exploratory QA of trip editing, onboarding, empty/error states, RTL and keyboard interaction. | Trusted manual or separately approved scheduled lane, disposable data, one goal and fixed time/step/spend budget; findings need reproducible tests.                                                         |

Mobile-native engine/device providers do not apply to this web/PWA repository.
Do not run the scaffolded iOS Settings app as product coverage. Additional
packages above are recommendations, not installed dependencies or activated
services/schedules. No ACP agent or exploratory workflow was enabled on GitHub.

## Resolved assumptions

| #   | Question                                                                                                         | Applied default                                                                                                                                                                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Can all existing tests move to the portable API?                                                                 | Preserve advanced assertions through the public custom-engine SPI.                                                                                                                                       | Independent test engineer and configuration guardian, high confidence: upstream documents missing APIs; deleting their assertions reduces coverage.                                                                                                                                                                                                                                                               |
| 2   | Does a PR need a model or Codex credentials?                                                                     | Deterministic tests only, existing read permissions and no new secrets.                                                                                                                                  | Configuration guardian, high confidence: both configurations can execute without a model; fork compatibility and current security boundaries remain intact.                                                                                                                                                                                                                                                       |
| 3   | Which existing tests are unnecessary?                                                                            | Retire only proven equivalent originals and unrelated generated examples.                                                                                                                                | Test engineer, high confidence: current regression behaviors have no demonstrated redundancy; both themes and browser engines protect distinct failures.                                                                                                                                                                                                                                                          |
| 4   | How should verification proceed when the host load exceeds 450?                                                  | Stop only this run's validation, preserve its non-green receipt, and complete bounded generated/build checks separately.                                                                                 | Configuration guardian, high confidence: additional full-suite retries do not provide reliable evidence under extreme contention; CI and the unchanged merge gates remain required.                                                                                                                                                                                                                               |
| 5   | How to complete migration without losing browser capabilities?                                                   | Two configurations using one e2e-inc runner and a public custom engine.                                                                                                                                  | Independent architecture specialist, high confidence: no private API, no dependency patch, full device/context isolation, explicit lifecycle and failure probes.                                                                                                                                                                                                                                                  |
| 6   | How to complete the gate on a busy host?                                                                         | `VALIDATION_MAX_WORKERS=1 GOMAXPROCS=2` with a fresh uninterrupted canonical gate.                                                                                                                       | Independent configuration guardian, high confidence: resource ceilings may only decrease; commands, assertions, timeouts and security guards remain mandatory.                                                                                                                                                                                                                                                    |
| 7   | Where should real engine probes run?                                                                             | `node:test` in the browser-equipped E2E jobs, outside the unit glob.                                                                                                                                     | Configuration guardian, high confidence: preserves mandatory negative proofs without requiring browser installation in unit validation; the iPhone probe runs in the WebKit lane.                                                                                                                                                                                                                                 |
| 8   | What is the outer CI time budget after adding probes?                                                            | 50 minutes: 30 browser, 10 portable, 5 probes, 5 setup and diagnostics.                                                                                                                                  | Configuration guardian, high confidence: only the outer job budget grows; existing internal test and runner deadlines stay unchanged.                                                                                                                                                                                                                                                                             |
| 9   | How should the pre-existing extra e2e skill coexist with the strict collection pin?                              | Preserve it byte-for-byte in `.ai/tmp/e2e-skill-preserved-ocz507p_/e2e`; use versioned `pnpm exec e2e guide` without another installed collection.                                                       | Configuration guardian, high confidence: atomic relocation preserves all nine files and modes, the SHA-256 inventory and restore instructions, while the existing manifest, lock, guard and approved collections stay unchanged.                                                                                                                                                                                  |
| 10  | How to preserve the weather layout invariant after migration exposed an 80.484px reading in an 80px reservation? | Increase only the shared minimum to 84px; retain exact geometry, zero layout shift and vendor-call assertions.                                                                                           | Architecture specialist, high confidence: a real reservation bug, reproduced in full and isolated runs; keep expansion for unusually wide temperatures and verify fresh Chromium/iPhone previews plus existing RTL/temperature UI cases.                                                                                                                                                                          |
| 11  | How should local E2E previews handle ambient Sentry configuration?                                               | Explicitly clear the client DSN and upload token for the E2E build only.                                                                                                                                 | Configuration guardian, high confidence: isolated fixtures must not send replay traffic; production observability configuration is unchanged.                                                                                                                                                                                                                                                                     |
| 12  | How should Safari keyboard traversal honor the host's native keyboard setting?                                   | Probe forward/backward traversal on ordinary buttons; use native Alt+Tab only when macOS WebKit requires it.                                                                                             | Configuration guardian, high confidence: preserve actual sequential traversal and every focus assertion without changing host preferences.                                                                                                                                                                                                                                                                        |
| 13  | How should route UI chunks avoid preloading unused error-only chunks?                                            | Group component, pending, error and not-found UI in one public TanStack split group.                                                                                                                     | Architecture and configuration reviewers: preserve loaders, guards and production server-function IDs; verify both builds and navigation.                                                                                                                                                                                                                                                                         |
| 14  | How should pasted upload rows remain visible after progress disappears?                                          | Reveal once, then correct once after the owned batch completes; cancel on subsequent user input.                                                                                                         | Architecture specialist, high confidence: explicit task ownership and cleanup prevent later scroll theft.                                                                                                                                                                                                                                                                                                         |
| 15  | How should high-density maps preserve their actual device resolution?                                            | Reuse the existing WebGL2 probe, capped at min(8192, texture limit, renderbuffer limit), with the previous 4096 fallback.                                                                                | Architecture specialist, high confidence: preserve DPR, original viewport widths, hardware limits and the warning guard.                                                                                                                                                                                                                                                                                          |
| 16  | How should built previews avoid unnecessary technical request interception?                                      | Explicit E2E_PREVIEW mode omits only the compiled clock's redundant header and font routes.                                                                                                              | Configuration guardian, high confidence: a controlled four-case WebKit probe produced 0/10/0/10 warnings for plain/routed/clock/routed-clock; HTTP assertions remain intact.                                                                                                                                                                                                                                      |
| 17  | How should the allowance refusal mock preserve WebKit caching?                                                   | Wrap this page's real fetch, rewrite only the exact same-origin terminal RPC response, and restore the owned wrapper.                                                                                    | Architecture specialist, high confidence: preserve real upload, poll, wire shape, one-substitution assertion, cleanup and empty-console checks without disabling HTTP cache.                                                                                                                                                                                                                                      |
| 18  | How should full validation handle concurrent checkout changes?                                                   | Stage owned new inputs, preserve concurrent work, and rerun the canonical gate against stable tracked and additional untracked inputs.                                                                   | Configuration guardian, high confidence: validate the actual shared checkout; compare external input hashes before and after, preserve failed receipts and never weaken fingerprint checks.                                                                                                                                                                                                                       |
| 19  | How should the obsolete candidate-only policy test follow the concurrent authorized cutover?                     | Assert the exact four definitions and execution fields; only the named dispatcher admits true, Weekly lessons must omit enabled to preserve cockpit pause, and both maintenance candidates remain false. | Configuration guardian, high confidence: update only the stale test, preserve live configuration and every security/legacy-mutation guard, and rerun the complete gate.                                                                                                                                                                                                                                           |
| 20  | How should the invite CLS guard handle impact attributed to the adjacent card?                                   | Measure sources in the verified invite aside, including text-node parents; retain the real 48px positive control, recent-input exclusion and exact zero.                                                 | Independent test engineer, high confidence: Chromium attributes the demonstrated displacement only to Add somebody in a fresh trip; completed animation waits do not change it. Preserve the bounded column, rendering flush, console checks and full browser matrix.                                                                                                                                             |
| 21  | How should dashboard geometry distinguish focus scrolling from reflow?                                           | Atomically sample viewport bounds and scroll, compare document positions, retain the 2px invariant and 20px positive control.                                                                            | Independent test engineer, high confidence: viewport bounding boxes change during real click/focus scrolling; preserve both thresholds, native interaction and finite nonempty geometry, and attach all three samples.                                                                                                                                                                                            |
| 22  | How should a conversation heading hydrate across different clocks or midnight?                                   | Serialize a required destination todayKey through the existing scoped loader and render that snapshot.                                                                                                   | Independent architect, high confidence: keep E2E clocks and zero hydration errors; verify matching/client-only days, destination midnight and invalid-zone UTC fallback; preserve permissions and refresh the snapshot only with loader data.                                                                                                                                                                     |
| 23  | Who owns focus while dashboard retry recovery replaces its error view?                                           | The surviving page retains scope-bound intent until the recovered DOM commits, then focuses its existing launcher or empty-state create-trip action.                                                     | Independent accessibility specialist, high confidence: cancel outside focus/pointer intent, loader/workspace changes and unmount; ignore automatic body focus. Three regression cases failed before the fix; ten recovery tests passed afterward. Preserve real browser focus assertions.                                                                                                                         |
| 24  | Does a finite Select height cap prevent the captured ResizeObserver error?                                       | The controlled cap stabilized height, but was removed after the error recurred during opening.                                                                                                           | Independent architect, medium initial confidence: preserve the diagnostic evidence and return to attribution when the strict console fails. No speculative height token or visible list-height change remains.                                                                                                                                                                                                    |
| 25  | How should Select position while its dialog anchor is still animating?                                           | Restore Radix's original public optimized default, preserving its reference-resize feedback protection.                                                                                                  | Independent architect, high confidence: the failing always trace identifies the Floating UI wrapper during opening, before keyboard input. Both optimized variants passed eight contexts and sixteen long/short-list checks; the speculative cap was removed. A separate closed-layer error required the lifecycle repair below.                                                                                  |
| 26  | How should a Select close when selection immediately moves its trigger?                                          | Unmount Select content on close, retaining its original opening motion, Popper sizing and native controls.                                                                                               | Independent architect, high confidence: the failing display-currency trace captures repeated resize errors on an already closed floating wrapper as available height alternates. Radix Presence retains that wrapper for the exit animation. Remove only Select's exit animation, keep shared popMotion and all other layers unchanged, and verify cleanup, native interaction, strict console and the full gate. |
| 27  | How should the documented -g helper option reach e2e-inc?                                                        | Normalize it to --grep, preserving array arguments and treating consumed patterns as data.                                                                                                               | Independent configuration guardian, high confidence: installed CLI has no short option. Browser/native regression assertions fail before and pass after the repair; common origin, mixed-selector refusal and exit status remain enforced. Record the exact tooling delta and run the full gate fresh.                                                                                                            |
| 28  | How should dated specs retain history while pointing at the current runner?                                      | Preserve their exact base bytes and centralize current E2E vocabulary and owner mapping in .ai/specs/AGENTS.md and this guide.                                                                           | Independent configuration guardian, high confidence: thirteen original bodies already fail the mandatory formatter, so appending notes would cause unrelated historical reflow. Withdraw only this migration's notes, retain normal hooks and formatter coverage, and add no ignore exception.                                                                                                                    |
| 29  | What source boundary can finish validation while the primary checkout changes?                                   | Use a complete isolated working-tree snapshot with private dependencies and unchanged before/after manifests.                                                                                            | Independent configuration guardian, high confidence: preserve concurrent work, include all additional inputs, run every configured command fresh, and qualify the local result by exact snapshot branch/path. Comment-only follow-ups need their own explicit delta and fresh gate.                                                                                                                               |
| 30  | Which changes belong in the migration-only pull request?                                                         | Include the E2E runner, CI, compatibility engine, coverage-preserving product repairs and documentation; retain base automation policy and exclude all parallel pipeline changes.                        | Independent configuration guardian, high confidence: exact extraction excludes Cezar workflows, dispatchers, leases, schedules, readiness changes and validation-executor callbacks. Revalidate the filtered worktree and preserve the primary files/index.                                                                                                                                                       |
| 31  | How should the newly merged landing regression migrate?                                                          | Register all five original locale cases through browserTest() in the public browser engine and retain every assertion.                                                                                   | Independent test engineer, high confidence: explicit context options and JSON attachments are supported; preserve Unicode and CDP glyph checks, 360/1440 geometry, pointer/keyboard activation, focus-visible and teardown. Require real Chromium and full iPhone WebKit execution before retiring the legacy file.                                                                                               |
| 32  | When may the landing regression navigate back after activating pricing?                                          | Keep both original URL assertions and additionally await the visible pricing-specific main h1#plans-heading after each activation.                                                                       | Independent test engineer, high confidence: true iPhone WebKit exposed a provisional-URL race that interrupted the next goto. Landing has an h2 with that id, so the destination h1 verifies the new view. Preserve every original assertion, profile and deadline; add no sleeps, retries or exclusions.                                                                                                         |
| 33  | How must the new-base release Git fixture run inside ordinary commit hooks?                                      | Clear Git-local environment variables only inside its existing test and restore them through the existing afterEach cleanup.                                                                             | Independent configuration guardian, high confidence: the inherited hook context let fixture git init/config escape into caller metadata. The test keeps every existing case/assertion, production release code and normal project hooks unchanged; use disposable foreign Git metadata for isolation proof.                                                                                                       |

The dashboard geometry guard samples the viewport rectangle and scroll offset
atomically, comparing document positions. Real focus scrolling remains enabled;
the original 2px invariant and injected 20px positive control remain mandatory.

Dashboard recovery focus belongs to the surviving page rather than the removed
error panel. It waits for the recovered commit without timers, observers or a
synthetic test focus. Connected outside focus and outside pointer intent cancel
the handoff; automatic body focus during removal does not. The delayed-commit
regression is reproduced independently of the intermittent browser failure.

Select retains Radix's original optimized positioning and available-height CSS.
A controlled failing trace captured the floating wrapper during opening while its
dialog anchor still had a fractional animated width. The always strategy omits
reference resize observation, bypassing Floating UI's reference-entry feedback
protection. A height cap did not prevent this error and was removed. Both optimized
variants passed eight contexts, including long/short lists, native keyboard,
typeahead and focus return; constrained viewports and RTL remain required. Console
errors stay fatal, and the complete browser matrix is the acceptance condition.

A second captured error occurred after a display-currency selection, while a
closed floating wrapper was retained for its exit animation and the updated
screen moved its trigger. Select content now unmounts on close; its opening
motion, original Popper sizing, scroll buttons and native focus behavior remain.
Shared popMotion and all other layers keep their original animations. Verify
that no closed wrapper remains, then repeat the strict currency, payment,
keyboard, RTL and complete browser checks.

Seeded account lookups use the console's real name filter before resolving a
detail link or driving impersonation. Fresh fixture accounts can move both Mika
and Jonas beyond the first page; sorting alone does not make that page an identity
lookup. The normal unfiltered console walk and all permission checks remain required.

Frozen source records in `docs/plans/01-trips-core.md` and
`docs/plans/03-reservations-and-transport.md` retain their historical CLI and
file names. The inventory above is the current owner mapping for those references. Dated
specification bodies also retain their original design text. The central
contract in `.ai/specs/AGENTS.md` resolves historical paths through the current
inventory and distinguishes existing coverage from planned destinations. This
changes no implementation-state metadata or historical source bytes.

Validation requires stable inputs. Stage this migration's new source files before
starting the canonical gate: its Git fingerprint does not include untracked files.
Preserve concurrent work and compare all additional untracked source inputs before
and after the run. If a shared checkout keeps changing, the configuration guardian
approved a complete isolated snapshot in a linked worktree, with private installed
dependencies and before/after byte, mode, link and absence manifests. Capture the
complete tracked/indexed and additional source set, not a selected subset. Run the
full configured gate fresh without `--resume`; a changed input invalidates the result.
State the snapshot branch/path explicitly: its green result does not attest later
edits in the primary checkout.

The configuration guardian also approved running the negative engine probes in
the browser-equipped E2E jobs, rather than adding a browser requirement to unit
validation. The iPhone probe is mandatory in the WebKit lane; Chromium probes
are mandatory in every shard. No new dependency, credential or permission was
introduced by this placement.

## Primary documentation

- [Playwright migration and API gaps](https://e2e.com/docs/migrate/playwright)
- [GitHub Actions](https://e2e.com/docs/ci/github-actions)
- [MCP server](https://e2e.com/docs/mcp-server)
- [Authentication and saved sessions](https://e2e.com/docs/authentication)
- [Codex / ACP executors](https://e2e.com/docs/subscriptions#use-your-coding-agent)
- [Integration packages](https://github.com/e2e-inc/e2e#integrations)

Implementation decisions use the documentation shipped with the installed
versions; the online documentation may describe newer releases.
