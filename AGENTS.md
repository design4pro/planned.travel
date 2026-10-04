# planned.travel

Multi-tenant SaaS travel planner on Cloudflare Workers (TanStack Start + React 19, D1/Drizzle, KV, R2, Durable Objects, Queues). Package manager: pnpm. Stack is pinned — see docs/SPEC.md §3 before adding or changing any dependency.

## Commands

- `pnpm worktree:bootstrap` — **run this first in a fresh checkout or worktree.** Secrets, local D1, basemap, demo workspace, dev server. Without it `/login` answers 500 and the whole app behind it is unreachable
- `pnpm dev` — dev server on :3000
- `pnpm typecheck` / `pnpm lint` / `pnpm test` — the fast feedback loop while you work. They are **not** the gate: the gate is `validation.commands` in `.ai/agentic.config.json`, and every PR passes it in full
- `pnpm build` — production build
- `pnpm e2e` — Playwright critical journeys + i18n parity (needs local D1 migrations; no basemap, ADR 0016)
- `pnpm generate-routes` — regenerate the route tree; `src/routeTree.gen.ts` is generated, never hand-edit
- `pnpm db:generate` — generate Drizzle migrations; `drizzle/` is generated, never hand-edit
- `pnpm generate-spec-index` — regenerate `.ai/specs/README.md` from the metadata table in each spec; generated, never hand-edit

## Rules

- All SQL lives in `server/repos` and goes through the tenant-scoped base repository; `server/catalog` is the single stated exception. Full contract: docs/SPEC.md §6.
- `components/ui` never fetches data and never imports from `server/`.
- Validate every server-function input with Zod. Named exports only (route modules excepted).
- Definition of done for any task: docs/SPEC.md §7. Decomposition rule ("one concept, one owner"): docs/SPEC.md §8.
- User-facing copy is never hardcoded — it lives in the 23-locale catalogue, and a new key lands in every locale in the same change (the parity test enforces this; procedure: the `i18n-messages` skill, contract: docs/SPEC.md §9).
- A spec's directory is its state — `.ai/specs/` waiting, `implemented/`, `archived/` — and the table under its `H1` names the issue and the pull requests behind it. Move with `git mv`, change `Status` in the same commit, regenerate the index. Rules: `.ai/specs/AGENTS.md`; the guard: `scripts/specs/__tests__/spec-registry.test.ts`.
- Commits: Conventional Commits, in English.
- Run the grep that CODE_REVIEW.md "Docs and CI" asks for ("a change updates every document that states what it changes") yourself, before opening the PR and again on every later head. Review is where that rule is checked, not where the grep is first done (#653, #657, #711, #717). The PR template's last Definition-of-done box asks for the terms you searched; the grep was skipped again on #772 and #775.
- An agent run changes a PR or issue (labels, title, body, assignees) through the `gh api` REST calls in `.ai/trackers/github.md`, never `gh pr edit` or `gh issue edit`. While `gh --version` is below 2.82.1 (this host: 2.46.0) those abort before writing with a `Projects (classic)` error, and `--json closingIssuesReferences` is an unknown field; four runs rediscovered it (#750, #756, #757, #779). The `gh issue edit` hold-label commands in docs/agents/issue-tracker.md are a person's, on a current `gh`.
- A command `permissions.deny` in `.claude/settings.json` refuses ends an unattended run: under `--permission-mode dontAsk` the first denial stops it (run d232173a in money-tracker.online died on an improvised `git reset --hard origin/<branch>`). Never try one; use the allowed equivalent. To move a worktree to a PR head: check `git status --short` is clean and `git log origin/<head>..HEAD` is empty, then `git fetch origin <head>` and `git checkout -B <head> origin/<head>` - never `git reset --hard`. `checkout -B` refuses only when it would overwrite a local change, and it resets an existing local branch, dropping its unpushed commits from the branch. A branch you rebased: never force-push (denied, `--force-with-lease` included); merge the base instead, or push a new branch. Never `--no-verify`: fix what the hook reports. `.ai/scripts/__tests__/deny-safe-workflows.test.mjs` keeps the workflow steps clear of denied commands.
- Reading a file `permissions.deny` lists under `Read(...)` (`.env*`, `.dev.vars*`, `.ai/qa/test-env.env`, `.e2e-tiles/`) is refused through Bash too - `cat`, `sed` and the like, redacted or not - and ends an unattended run the same way (run b6eb30ef in planned.travel died on `cat .ai/qa/test-env.env | sed 's/=.*/=<redacted>/'`). Never open one. A test-env login is a reference: the role and its `passwordEnv` variable name are in `.ai/qa/test-env.json` (`credentials`); load the values with `set -a; . "$(jq -r .credentialsFile .ai/qa/test-env.json)"; set +a` and write `"$TEST_DEMO_PASSWORD"` in the command (`om-auto-qa-pr` `references/boot-env.md`). Sourcing the file is allowed; printing a value is not. `deny-safe-workflows.test.mjs` checks this line names every `Read(...)` deny.

## Domain

Domain vocabulary lives in CONTEXT.md — a glossary and nothing else. Architecture decisions live in docs/adr/.

## Agent skills

Configuration for the skills in `.claude/skills/` — the project's own, plus the two vendored from mattpocock/skills (see docs/agents/ATTRIBUTION.md):

- **Issue tracker**: GitHub Issues on `design4pro/planned.travel` — see docs/agents/issue-tracker.md
- **Triage labels**: see docs/agents/triage-labels.md
- **Domain docs**: see docs/agents/domain.md
- **Reference product** (feature and quality benchmark; clean-room rule applies): see docs/agents/reference.md
- **Cezar orchestration** (workflows, automations, hooks in agent mode, housekeeping, host cutover): see docs/agents/cezar.md
- **Pipeline runtime documents** read by every `om-*` skill: `.ai/agentic.config.json`, `SDLC.md` (labels, Definition of Ready, QA gate), `CODE_REVIEW.md`, `BACKWARD_COMPATIBILITY.md`; repo-specific rules for a skill live in `.ai/skills/om-<name>/SKILL.md`

Sentry findings enter the backlog through `pnpm sentry-triage` (report-only; `--file-issues` writes) as `bug` + `priority-high`; their body quotes production data, so a person reads one and starts a run on it from the cockpit, and the Reconciler never implements one (ADR 0032).

New work flows (ADR 0018, ADR 0032), and no label starts any of it: the Open Mercato labels are the whole vocabulary. Issue form → the cezar `triage` run (`afk-triage`) verifies the issue, sets its SDLC labels, checks the SLC scoping rule and writes an Agent Brief - or puts `blocked` on it with a `🤖 HUMAN-ONLY:` comment naming the one thing a person must do; removing `blocked` leaves it to be triaged again, and a hold an agent set without that marker is lifted by `afk-unblock` on a specialist's verdict. An issue with a brief, its SDLC labels and every `Blocked by` closed is **ready**: `implement-ticket` takes the issue `node .ai/scripts/backlog-status.mjs --next` names (highest priority, then oldest; nothing while three PRs wait for a person: `needs-qa` without `qa-approved`, `risk-high`, `security`, `blocked`), implements it test-first and ends with `om-pr-autopilot --allow-merge` squash-merging the reviewed PR into `develop` (`om-approve-merge-pr`; `needs-qa` needs `qa-approved`) → `housekeeping` closes the issue (`Closes #n`). A request too large for a few slices is briefed as a spec task: `implement-ticket` writes the spec, a person merges the spec PR, and `afk-to-tickets` slices it into tickets whose body is their brief. A host cron, the Reconciler (ADR 0033, `docs/agents/cezar.md`), starts all of that: it asks `node .ai/scripts/backlog-status.mjs --plan` every ten minutes what there is to start - up to three ranked candidates each of implement, unblock and triage, at most one each of slice and write-spec; no cockpit automation starts them - and the last one, `plan-to-spec`, writes the spec for a stage of `docs/plans/` nothing covers yet, which a specialist panel reviews and the pipeline merges. `risk-high` and `security` work is claimed only on a security and tenancy specialist's approving verdict (`SDLC.md` § Delegated decisions), and a `risk-high` PR waits for the owner's `qa-approved`. Nothing merges into `main`: the promotion PR carries `do-not-merge`. A person can start any workflow from the cockpit on any issue - `issue-groom` (`om-auto-manage-issues`, then `afk-triage`), `issue-autofix` (`om-auto-fix-issue`; locally `/om-auto-fix-issue <issue>`), `spec` (`om-auto-write-spec`, a design-only PR that says `Refs #n`, so the FR stays open and is the implementation ticket), `implement-spec`, `implement-ticket` with an issue number. Thinking before an issue exists is `/om-brainstorm`. Verification ladder: see the `verifying-changes` skill; the gate the skills run is `validation.commands` in `.ai/agentic.config.json`.

Every `afk-*` skill runs with no one to ask, so where a person would be consulted it hands the question to an independent specialist sub-agent (`.ai/skills/afk-decide/SKILL.md`), applies the verdict and records it in a **Resolved assumptions** table (`# | Question | Applied default | Why`) in the brief, spec or PR body it writes, then continues the work. Overturning one of those rows is an ordinary review finding.

The agent layer — the `afk-*` skills, `.ai/cezar/`, `.ai/scripts/`, `.claude/hooks/`, `.claude/settings.json`, `.ai/trackers/github.md`, `scripts/ci/`, the former Claude `.github/workflows/` — used to be rendered here from `design4pro/agent-kit` and hashed in a lock file, so a correction to any of it was a two-repository round trip. **It is vendored now** (ADR 0025): every one of those files is an ordinary file, editable on the branch that needs it, and the check that enforced the hashes is gone from the validation gate. Nothing detects a hand edit any more — review does. `money-tracker.online` carries a layer that started as a copy of this one and is no longer kept in step with it, by anything or on purpose: each repository tunes its own, and a fix that genuinely belongs in both is written in both as two ordinary changes.

A fix to how one skill behaves (a push, a claim, a label) lands in every skill that behaves the same way. Before writing it, grep that behaviour across `.claude/skills/*/SKILL.md`, their `references/`, and the `.ai/skills/` overrides, then cover every hit or name the uncovered ones in a follow-up issue (#733, #735).

## Generated TanStack guidance

The block below is owned by `@tanstack/intent` and written between its own markers; do not
edit it by hand. Run the matching command before editing TanStack-adjacent files. Everything
above the markers is this repository's own and the generator leaves it alone.

<!-- intent-skills:start -->

# TanStack Intent - before editing files, run the matching guidance command.

tanstackIntent:

- id: "@tanstack/devtools#devtools-app-setup"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-app-setup"
  for: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
- id: "@tanstack/devtools#devtools-marketplace"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-marketplace"
  for: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
- id: "@tanstack/devtools#devtools-plugin-panel"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-plugin-panel"
  for: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
- id: "@tanstack/devtools#devtools-production"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-production"
  for: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
- id: "@tanstack/devtools-event-client#devtools-bidirectional"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-bidirectional"
  for: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
- id: "@tanstack/devtools-event-client#devtools-event-client"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-event-client"
  for: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
- id: "@tanstack/devtools-event-client#devtools-instrumentation"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-instrumentation"
  for: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
- id: "@tanstack/devtools-vite#devtools-vite-plugin"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-vite#devtools-vite-plugin"
  for: "Configure @tanstack/devtools-vite for source inspection (data-tsd-source, inspectHotkey, ignore patterns), console piping (client-to-server, server-to-client, levels), enhanced logging, server event bus (port, host, HTTPS), production stripping (removeDevtoolsOnBuild), editor integration (launch-editor, custom editor.open). Must be FIRST plugin in Vite config. Vite ^6 || ^7 only."
- id: "@tanstack/react-start#lifecycle/migrate-from-nextjs"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-start#lifecycle/migrate-from-nextjs"
  for: "Step-by-step migration from Next.js App Router to TanStack Start: route definition conversion, API mapping, server function conversion from Server Actions, middleware conversion, data fetching pattern changes."
- id: "@tanstack/react-start#react-start"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-start#react-start"
  for: "React bindings for TanStack Start: createStart, StartClient, StartServer, React-specific imports, re-exports from @tanstack/react-router, full project setup with React, useServerFn hook."
- id: "@tanstack/react-start#react-start/server-components"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-start#react-start/server-components"
  for: "Implement, review, debug, and refactor TanStack Start React Server Components in React 19 apps. Use when tasks mention @tanstack/react-start/rsc, renderServerComponent, createCompositeComponent, CompositeComponent, renderToReadableStream, createFromReadableStream, createFromFetch, Composite Components, React Flight streams, loader or query owned RSC caching, router.invalidate, structuralSharing: false, selective SSR, stale names like renderRsc or .validator, or migration from Next App Router RSC patterns. Do not use for generic SSR or non-TanStack RSC frameworks except brief comparison."
- id: "@tanstack/router-core#router-core"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core"
  for: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
- id: "@tanstack/router-core#router-core/auth-and-guards"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/auth-and-guards"
  for: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
- id: "@tanstack/router-core#router-core/code-splitting"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/code-splitting"
  for: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
- id: "@tanstack/router-core#router-core/data-loading"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/data-loading"
  for: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
- id: "@tanstack/router-core#router-core/navigation"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/navigation"
  for: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
- id: "@tanstack/router-core#router-core/not-found-and-errors"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/not-found-and-errors"
  for: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
- id: "@tanstack/router-core#router-core/path-params"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/path-params"
  for: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
- id: "@tanstack/router-core#router-core/search-params"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/search-params"
  for: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
- id: "@tanstack/router-core#router-core/ssr"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/ssr"
  for: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
- id: "@tanstack/router-core#router-core/type-safety"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/type-safety"
  for: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
- id: "@tanstack/router-plugin#router-plugin"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-plugin#router-plugin"
  for: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
- id: "@tanstack/start-client-core#start-core"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core"
  for: "Core overview for TanStack Start: tanstackStart() Vite plugin, getRouter() factory, root route document shell (HeadContent, Scripts, Outlet), client/server entry points, routeTree.gen.ts, tsconfig configuration. Entry point for all Start skills."
- id: "@tanstack/start-client-core#start-core/auth-server-primitives"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/auth-server-primitives"
  for: "Server-side authentication primitives for TanStack Start: session cookies (HttpOnly, Secure, SameSite, __Host- prefix), session read/issue/destroy via createServerFn and middleware, OAuth authorization-code flow with state and PKCE, password-reset enumeration defense, CSRF for non-GET RPCs, rate limiting auth endpoints, session rotation on privilege change. Pairs with router-core/auth-and-guards for the routing side."
- id: "@tanstack/start-client-core#start-core/deployment"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/deployment"
  for: "Deploy to Cloudflare Workers, Netlify, Vercel, Node.js/Docker, Bun, Railway. Selective SSR (ssr option per route), SPA mode, static prerendering, ISR with Cache-Control headers, SEO and head management."
- id: "@tanstack/start-client-core#start-core/execution-model"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/execution-model"
  for: "Isomorphic-by-default principle, environment boundary functions (createServerFn, createServerOnlyFn, createClientOnlyFn, createIsomorphicFn), ClientOnly component, useHydrated hook, import protection, dead code elimination, environment variable safety (VITE_ prefix, process.env)."
- id: "@tanstack/start-client-core#start-core/middleware"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/middleware"
  for: "createMiddleware, request middleware (.server only), server function middleware (.client + .server), context passing via next({ context }), sendContext for client-server transfer, global middleware via createStart in src/start.ts, middleware factories, method order enforcement, fetch override precedence."
- id: "@tanstack/start-client-core#start-core/server-functions"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-functions"
  for: "createServerFn (GET/POST), validator (Zod or function), useServerFn hook, server context utilities (getRequest, getRequestHeader, setResponseHeader, setResponseStatus), error handling (throw errors, redirect, notFound), streaming, FormData handling, file organization (.functions.ts, .server.ts)."
- id: "@tanstack/start-client-core#start-core/server-routes"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-routes"
  for: "Server-side API endpoints using the server property on createFileRoute, HTTP method handlers (GET, POST, PUT, DELETE), createHandlers for per-handler middleware, handler context (request, params, context), request body parsing, response helpers, file naming for API routes."
- id: "@tanstack/start-server-core#start-server-core"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-server-core#start-server-core"
  for: "Server-side runtime for TanStack Start: createStartHandler, request/response utilities (getRequest, setResponseHeader, setCookie, getCookie, useSession), three-phase request handling, AsyncLocalStorage context."
- id: "@tanstack/virtual-file-routes#virtual-file-routes"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/virtual-file-routes#virtual-file-routes"
  for: "Programmatic route tree building as an alternative to filesystem conventions: rootRoute, index, route, layout, physical, defineVirtualSubtreeConfig. Use with TanStack Router plugin's virtualRouteConfig option."

<!-- intent-skills:end -->
