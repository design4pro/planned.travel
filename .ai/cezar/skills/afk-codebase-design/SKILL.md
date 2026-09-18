---
name: afk-codebase-design
description: planned.travel's own half of the codebase-design skill - its house idiom, seams, dependency examples, test layout and risk-high interfaces. Overrides the kit-rendered base of the same name; read that base for the vocabulary and the rules.
---

# AFK codebase design in planned.travel

**Read `.ai/skills/afk-codebase-design/SKILL.md` first.** That file is the shared half, rendered by the agent kit into every repository that uses this pipeline: the vocabulary (module, interface, depth, seam, adapter, leverage, locality), the five rules, the dependency-category skeleton, the design-it-twice procedure and the done-when. `afk-triage`, `afk-to-tickets` and `afk-architecture-review` read that path literally, so those terms are guaranteed to be the same everywhere.

This file is the other half: what is true only here. It shadows the rendered file by name in the cockpit's registry - `.ai/cezar/skills` is scanned before `.ai/skills` and the first of a name wins - so an agent that loads the skill by name gets **this** file and must read the rendered one alongside it. Neither half is complete on its own.

## The house idiom: a Runtime assembled in one place

This repo has one dominant seam shape, and a new seam should match it before inventing another: **a `Runtime` (or `Ports`) object of narrow structural types, assembled in a single `bindings.ts` or `runtime.cloudflare.ts`, injected into logic that is otherwise pure.**

It is not a style preference. The `server` Vitest project cannot import `cloudflare:workers` at all (`vitest.config.ts`), so a module that reaches for a binding directly is a module that cannot be tested. Bindings arrive as arguments. `src/server/billing/runtime.cloudflare.ts` is the worked example: it is the only module under `src/server/billing/**` permitted to import `cloudflare:workers`.

Two conventions that come with it:

- **Name the port for the role, not the vendor.** `src/server/billing/types.ts` calls them `provider*`, not `polar*`, so swapping the vendor does not rename the seam.
- **A missing credential is a `null` port, not a crash.** `GeocodeRuntime.provider` and `TransitClient` may both be `null`, and the refusal is made one line before the allowance is spent (`src/server/transit/search.ts`). A deployment with no vendor key degrades instead of failing.

**There is no DI container.** Dependencies are plain object literals passed as arguments. Do not introduce a framework-level injection mechanism.

## Dependency categories (where to put the seam)

| Category             | Example in planned.travel                                                                             | Test with                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| In-process           | plan and quota constants (`src/lib/plans.ts`), i18n interpolation and pluralisation (`src/lib/i18n/`) | the real code                                                                                         |
| Local, substitutable | the D1 handle, an R2 bucket, KV                                                                       | in-memory SQLite through `src/server/repos/__tests__/harness.ts`; an `ObjectStore` fake is four lines |
| Remote you own       | Durable Objects `TripRoom` / `SandcastleRegistry`, the `TASKS` queue                                  | a narrow structural namespace (`TripRoomNamespace`) filled with a stub                                |
| True external        | Polar, Resend, HERE, Geoapify, Sentry                                                                 | the vendor port in the area's `bindings.ts`, filled with a stub or `null`                             |

## Seams planned.travel already has

Build on these before inventing new ones.

| Seam                                                                                  | What varies across it                                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TenantScope` / `TenantRepository` (`src/server/repos/base.ts`)                       | the `Database` handle. **Not** the tenant filter: forgetting it is deliberately not expressible, and `ListOptions.where` is ANDed with it, never instead of it (ADR 0002) |
| `BillingRuntime` (`src/server/billing/types.ts`)                                      | provider client, subscription store, usage reader, cache, task queue, logger, and `now()`                                                                                 |
| `GeocodeRuntime`, `TransitSearchRuntime` (`src/server/geo/`, `src/server/transit/`)   | the vendor, its cache, the per-org ceiling, the clock                                                                                                                     |
| `OutboundRuntime` + `callProvider` (`src/server/metering/outbound.ts`)                | `db` may be `null`, and metering then no-ops with the gate left open                                                                                                      |
| `ObjectStore` (`src/server/storage/objects.ts`)                                       | the R2 bucket, passed as a parameter and never looked up; structural, so the real binding satisfies it                                                                    |
| `TripRoomNamespace` / `TripRoomStub` (`src/server/do/trip-room-client.ts`)            | the Durable Object namespace                                                                                                                                              |
| `TilesRuntime` (`src/routes/api/tiles/-lib/serve.ts`)                                 | object store, cache, archive key, `waitUntil`, `onError`. Held to 85% coverage                                                                                            |
| The queue envelope: `TASK_KINDS` + `taskEnvelopeSchema` (`src/server/queue/types.ts`) | a job kind is one union member plus one handler. The consumer is the trust boundary; its three outcomes map to ack, dead-letter and retry                                 |
| The server-function boundary: `appScope()` and friends (`src/server/fns/context.ts`)  | every server function starts here, and handlers are stripped from the client bundle                                                                                       |
| `requirePermission` (`src/server/auth/guard.ts`)                                      | the only authorization predicate, synchronous by construction                                                                                                             |
| `dispatch` / `dispatchQuietly` (`src/server/notifications/dispatch.ts`)               | recipients derive only from trip members, and a dispatch failure never fails the save                                                                                     |
| Email templates (`src/server/email/`)                                                 | brand arrives as a prop, so a template touches no Worker binding and renders under plain Node                                                                             |
| `failureRedactionMiddleware` (`src/server/errors/middleware.ts`)                      | the one place a thrown value becomes browser-visible                                                                                                                      |

## Where the tests go

Four things decide the project a test lands in, and they are not interchangeable:

- `ui` - jsdom, for `src/components/**` and `src/lib/**`.
- `server` - plain Node, for `src/server/**`. **No `cloudflare:workers` import.**
- `tooling` - policy outside `src/**`: `scripts/`, `.ai/scripts/`, `.claude/hooks/`, config files, e2e helpers.
- Playwright (`e2e/`) - journeys only, chromium and mobile-safari, behind `.ai/scripts/e2e.sh`.

Tests are colocated in `__tests__/` beside the code they cover.

## What is risk-high here

From SDLC.md: **auth, sessions, data scoping, money, schema migrations, shared contract surfaces, or broad cross-cutting edits.** When signals conflict, pick the higher label and say why.

Three layering rules are blockers in CODE_REVIEW.md and constrain where a seam may go:

- SQL lives only in `src/server/repos`, through the tenant-scoped base repository. **Every new or changed repository method needs a tenant-isolation test.**
- Routes call server functions; server functions call repositories. Zod validates every server-function input.
- `src/components/ui` never fetches and never imports `src/server`. `src/server/email` imports no Worker binding.
- D1 migrations are additive: the Worker must survive the window between migrating and deploying.

## Design it twice: which interfaces

Run the design-it-twice procedure from the shared file when a new or changed interface touches the tenant repository base, the billing runtime, a D1 migration, the queue envelope or the auth guard.
