---
name: afk-codebase-design
description: Shared vocabulary and rules for designing deep modules in planned.travel - module, interface, depth, seam, adapter, leverage, locality, the deletion test. Use when designing or changing a module's interface, choosing where a seam or test goes, judging whether an abstraction earns its keep, or when another skill (afk-architecture-review, afk-to-tickets) needs this vocabulary.
---

# AFK codebase design

**These instructions are already in your system prompt.** Never call the `Skill` tool for an `afk-*` skill - a repo-local skill is not in the agent's registry, so the call fails with `Unknown skill`.

Adapted from mattpocock/skills `codebase-design` for unattended runs. Use these words exactly in designs, briefs, review findings and PR bodies. Do not substitute "component", "service", "API" or "boundary".

## Vocabulary

- **Module**: anything with an interface and an implementation, at any scale: a function, a file, a route, a repository.
- **Interface**: everything a caller must know to use the module correctly: types, invariants, ordering, error modes, required state, performance. Not just the TypeScript signature.
- **Implementation**: the code behind the interface.
- **Depth**: behaviour a caller or test can exercise per unit of interface it must learn. Deep = small interface, lots of behaviour. Shallow = interface nearly as complex as what it hides.
- **Seam**: the place where behaviour can change without editing that place; where an interface lives.
- **Adapter**: a concrete thing that fills a seam.
- **Leverage**: what callers gain from depth.
- **Locality**: what maintainers gain from depth: change, bugs and verification concentrate in one place.

## Rules

- **Deletion test.** Imagine deleting the module. If the complexity vanishes, it was a pass-through: inline it. If the complexity reappears across callers, it earns its keep.
- **The interface is the test surface.** Tests cross the same seam callers do. Needing to test past the interface means the module is the wrong shape.
- **One adapter is a hypothetical seam; two adapters are a real one.** Do not add a seam until something actually varies across it.
- **Accept dependencies, return results.** Pass collaborators in and return values rather than mutating shared state, so the seam is testable.
- **Replace, don't layer.** When you deepen a module, delete the shallow tests it makes redundant instead of keeping both.

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

## Design it twice (risk-high interfaces only)

Use this when a new or changed interface touches the tenant repository base, the billing runtime, a D1 migration, the queue envelope or the auth guard.

1. Dispatch two child tasks with `cez task create`. Constrain one to the smallest possible interface and the other to the most common caller's convenience.
2. Compare their designs on depth, locality and seam placement. Pick one, or a merge of both.
3. Record the choice and the rejected design as a row in the Resolved assumptions table.

If dispatch is unavailable, write both designs yourself, in sequence, before choosing.

## Done when

The design or finding names the module, its interface, and its seam in these terms, and states which rule above justifies the change.
