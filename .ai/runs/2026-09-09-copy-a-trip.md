# Execution plan — copy a trip (`01-S1d`)

Source doc: `.ai/specs/2026-09-07-copy-a-trip.md`
Tracker: issue #111 (FR), spec PR #309 (merged), parent PRD #104.

## Goal

Ship the trip copy: a dialog, a synchronous half that mints the trip inside one round trip, a
`trip-copy` queue handler that duplicates the source's inventory afterwards, and a copier registry
other stages extend without editing this one.

## Scope

Six edited files and three new ones, all inside `01-S1d`'s owned paths, plus the 23-locale copy and
the tests each step names. A copy reproduces the **plan** — days, places, place tags, day
assignments, day notes — and never the **record**.

- `src/server/storage/objects.ts` — `copyObject`, `ObjectStore` widened with optional `get`/`put`.
- `src/server/repos/trips.ts` — `MAX_BOUND_PARAMETERS`, `startTripCopy`, `copyTripContents`,
  `registerTripCopier` and the copier types.
- `src/server/queue/types.ts` — one `TASK_KINDS` member and its payload schema.
- `src/server/queue/consumer.ts` — the `case` **and** the `taskHandlers` entry.
- `src/server/queue/handlers/trip-copy.ts` — new.
- `src/routes/_app/-server/trip-lifecycle.ts` — `copyTripInputSchema`, `copyTripFn`.
- `src/routes/_app/-server/overview.ts` — `TripCard.copyPending`, so the tile can read the state.
- `src/routes/_app/-ui/trip-copy-dialog.tsx` — new.
- `src/routes/_app/-ui/trip-actions.tsx` — the Copy menu item.
- `src/routes/_app/-ui/trip-card.tsx` — the copying state.
- `src/lib/i18n/messages/*/shell.ts` — 23 locales.
- Tests: storage, `trip-lifecycle.test.ts`, `trip-copy.test.ts`, `consumer.test.ts`,
  `tenant-isolation.test.ts`, `member-isolation.test.ts`, component tests, `e2e/trips-core.spec.ts`.

## Non-goals

- Copying the record: reservations, transports, expenses, files, conversations, share links, people.
- Copiers for other areas' tables — they arrive through the registry in `04-*` and `05-*`.
- A migration. `trips.copy_pending_at` shipped in `drizzle/0006_mighty_nehzno.sql`.
- Any change to `src/server/repos/base.ts`, `src/components/ui/**`, `src/styles/tokens.css`,
  `src/routeTree.gen.ts`, `drizzle/**`, `wrangler.jsonc`, `package.json`.
- Removing `trips.is_favourite` (issue #206) or fixing the five unregistered task kinds (issue #304 —
  step 6 only adds the walking test with an explicit allow-list citing it).

## Risks

- **`trips.ts` is the riskiest edit** — every trip reader goes through it. This stage only adds; no
  existing export changes signature.
- **The chunk bound.** `insertMany` does not chunk, and D1 refuses more than 100 bound parameters.
  Held by a unit test that copies more rows than one chunk carries, not by a comment.
- **Retry correctness.** Each attempt clears what a previous one wrote before copying, because
  `placeIds` cannot be rebuilt from a partial target. The stamp is the handler's last write.
- **Tenant isolation** is the security surface: the handler's scope comes from an envelope, not a
  request. Asserted in both directions, twice.
- The i18n parity test blocks the branch until all 23 locales carry every new key.

## Implementation Plan

Each step leaves the application working and is verified by `pnpm typecheck && pnpm lint && pnpm test`
at minimum; the steps that name a browser add `pnpm build && pnpm e2e`.

### Phase 1 — the two halves and the handler

Leaves the app working and ships nothing user-visible: no UI, so no user can reach it.

### Phase 2 — the dialog and the tile

Turns it on: the menu item, the dialog, the copying state, the 23-locale copy, and the e2e block.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: the two halves and the handler

- [x] 1.1 `copyObject` in `src/server/storage/objects.ts` — 8786a1a1
- [x] 1.2 `MAX_BOUND_PARAMETERS` and the chunk helper in `trips.ts` — e77391df
- [x] 1.3 `startTripCopy` — e77391df
- [x] 1.4 The copier registry — e77391df
- [x] 1.5 `copyTripContents` — e77391df
- [x] 1.6 The `trip-copy` kind, the consumer `case` and its registry entry — 0688df4a
- [x] 1.7 `src/server/queue/handlers/trip-copy.ts` — 0688df4a
- [x] 1.8 `copyTripFn` and its Zod input — 48cd98a9
- [x] 1.9 Tenant and member isolation tests — 5e18c217

### Phase 2: the dialog and the tile

- [x] 2.1 The 23-locale copy — 36254696
- [x] 2.2 `TripCopyDialog` — 36254696
- [x] 2.3 The Copy menu item in `trip-actions.tsx` — 36254696
- [x] 2.4 The copying tile state in `trip-card.tsx` (with `TripCard.copyPending` in `overview.ts`) — 36254696
- [ ] 2.5 The e2e block in `e2e/trips-core.spec.ts`
- [ ] 2.6 The blind A/B pair for `/trips` and `/`
