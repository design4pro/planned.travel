# One binding-parity rule for wrangler.jsonc, and a shared JSONC reader for the tests that ask it

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #203  |
| **Spec PR**        | #627  |
| **Implementation** | none  |

## 📝 TLDR

`src/server/ai/__tests__/binding.test.ts` enforces "a named environment inherits no binding, so
every binding is declared twice" for `AI` only, and pins the literal binding inventory of both
environments as a control for a 60-line JSONC reader it hand-rolls inline. This spec moves the
reader into a shared test module, `src/server/__tests__/wrangler-config.ts`, tests it against an
inline fixture instead of the live config, and replaces the three `AI` cases and the inventory
control with one rule that holds for every binding: staging declares exactly the bindings the top
level declares, under the same names, plus a named list of staging-only ones. Test code only; no
runtime change.

## 📝 Problem Statement

- **The invariant is general, the enforcement is not.** `wrangler` does not inherit bindings into
  `env.staging` (`wrangler.jsonc:240-244` says so for `AI`). The test's own header states the rule
  for every binding, and only `AI` is checked (`binding.test.ts:177-182`, `:211-220`). A new KV
  namespace, bucket or queue producer declared at the top level and forgotten under `env.staging`
  typechecks, deploys, and fails on the first undefined read in staging — the deployment meant to
  catch it.
- **The control pins a second source of truth.** `binding.test.ts:184-209` asserts the exact sorted
  list `DB, FILES, KV, SESSIONS, TASKS, TILES, TRIP_ROOM` (and the staging list with
  `SANDCASTLE_REGISTRY`) to prove the reader works. Every stage that adds a binding now has to edit a
  test under `src/server/ai/`, which has nothing to do with it.
- **The reader is not reusable.** `parseJsonc`, `nodeAt`, `namesUnder`, `BINDING_SOURCES` and
  `ENVIRONMENTS` are private to a feature suite. The next suite that needs to ask `wrangler.jsonc` a
  question copies them. The reason the reader exists at all — `wrangler`'s own reader costs 192 MB of
  resident memory per Vitest worker (`binding.test.ts:29-31`) — applies to every such suite.
- **Two binding objects escape even the inventory.** `ai` and `version_metadata` are lone
  `{ "binding": … }` objects rather than lists, so `bindingNamesIn` does not see them
  (`binding.test.ts:150-155`). `CF_VERSION_METADATA` is declared in both environments today and is
  checked by nothing.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                                        | Applied default                                                                                                                                                                                                                                                                                                  | Why                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | How are staging-only bindings allowed — any extra name, or a named list?                                                                        | A named list, `STAGING_ONLY_BINDINGS = ['SANDCASTLE_REGISTRY']`, citing docs/adr/0009; staging must equal the top level plus that list exactly.                                                                                                                                                                  | "Top level ⊆ staging" alone passes when a binding is removed from the top level only (staging keeps it as an unexplained extra), which is the production half of the same bug. The list is of exceptions, not of the inventory, and churns only when a second environment-specific coordinator is added.                  |
| Q2  | Should `version_metadata` join `ai` as a lone-object binding source?                                                                            | Yes.                                                                                                                                                                                                                                                                                                             | It is a binding by the same mechanism, declared twice today (`wrangler.jsonc:58`, `:209`), and costs one table row. Leaving it out repeats the gap this issue is about.                                                                                                                                                   |
| Q3  | A binding **kind** the table does not know (a first `services`, `hyperdrive`, `workflows`…) would escape the rule. Guard against it?            | Yes, with one case: every top-level key of the config is either a binding source in the table or on a named `NON_BINDING_KEYS` list; an unclassified key fails with a message naming it.                                                                                                                         | Enumerating all 30-odd binding kinds in wrangler's schema is speculative code; the classification guard is finite, lists only keys the file uses today, and fails exactly on the day the table must grow.                                                                                                                 |
| Q4  | Parity compares names between environments and pins no name, so renaming `AI` identically in both would pass while `env.AI` breaks. Keep a pin? | Yes, generalised: `HAND_TYPED_BINDINGS = ['AI']` in the parity suite — bindings typed by hand in a `src/server/*/cloudflare-env.d.ts` augmentation rather than in the generated `worker-configuration.d.ts` — each must appear in the top-level set. `src/server/ai/__tests__/binding.test.ts` is still deleted. | A hand-written type is the one place a config rename is caught by nothing else (`src/server/ai/cloudflare-env.d.ts` says why the generated file cannot carry `AI`). The list churns only when a binding is typed by hand, and empties the day typegen is repaired. Bindings typed by the generated file are out of scope. |
| Q5  | Do `vars`, `triggers`, `migrations` and queue consumers get the same parity rule?                                                               | No — out of scope.                                                                                                                                                                                                                                                                                               | They are not bindings, and their staging values legitimately differ (`vars` values, a single cron, a different consumer tuning). A parity rule for them is a different design with its own exceptions.                                                                                                                    |

## 📝 Proposed Solution

1. **A shared module owns reading the config.** `src/server/__tests__/wrangler-config.ts` — the
   `src/server/db/__tests__/migration-files.ts` / `table-config.ts` pattern: a non-`.test.ts` module
   under `__tests__/` that the `server` Vitest project does not collect, imported by the suites that
   need it. It exports:
   - `parseJsonc(source: string): unknown` — moved verbatim, header comment kept (the 192 MB
     reasoning is the reason the module exists).
   - `nodeAt(config, path)` — moved verbatim.
   - `readWranglerConfig(): unknown` — `parseJsonc(readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8'))`.
   - `ENVIRONMENTS` — moved verbatim (`production` at `[]`, `staging` at `['env', 'staging']`).
   - `bindingNamesIn(config, path): Array<string>` — sorted names from `BINDING_SOURCES`. Each entry
     gains a discriminant, `{ path, key, shape: 'list' | 'object' }`: `list` reads `key` from every
     entry of the array at `path` (`d1_databases`, `kv_namespaces`, `r2_buckets`, `queues.producers`
     by `binding`; `durable_objects.bindings` by `name`), `object` reads `key` from the single object
     at `path` (`ai`, `version_metadata`, by `binding`). A non-string or absent name is skipped in
     both shapes, as `namesUnder` does today.
   - `BINDING_SOURCES` itself, so the classification guard (Q3) can read the top-level keys it owns.

   `aiBindingNameIn` is not moved; nothing needs it after the change.

2. **The reader is tested against a fixture, not the config.**
   `src/server/__tests__/wrangler-config.test.ts` holds an inline JSONC string that exercises what
   the scan must survive — a `//` inside a string (`"https://…"`), `/* */` and `//` comments, an
   escaped quote and an escaped backslash immediately before a closing quote, a brace inside a
   string, a trailing comma before `}` and before `]`, and a comment as the last thing in the
   document — and asserts `parseJsonc` returns the equivalent value with `toEqual`. A second case
   asserts `bindingNamesIn` over a small fixture object that covers every shape in `BINDING_SOURCES`,
   including an entry with a non-string name that must be skipped.

3. **One parity rule replaces the `AI` cases and the inventory control.**
   `src/server/__tests__/wrangler-bindings.test.ts`, against `readWranglerConfig()`:
   - _staging declares every top-level binding, under the same name, plus only the staging-only
     ones_ — `expect(bindingNamesIn(config, ['env', 'staging'])).toEqual([...bindingNamesIn(config, []), ...STAGING_ONLY_BINDINGS].sort())`.
     `STAGING_ONLY_BINDINGS` lives in this file with a comment pointing at docs/adr/0009.
   - _the reader found bindings at all_ — the top-level set is non-empty, so a reader that returned
     `{}` cannot make the rule pass vacuously. No literal inventory.
   - _every hand-typed binding is declared_ (Q4) — each name on `HAND_TYPED_BINDINGS` (`['AI']`) is
     in the top-level set; parity carries it to staging. The comment names
     `src/server/ai/cloudflare-env.d.ts` as the reason the entry exists.
   - _every key is classified, in every environment_ (Q3) — `it.each(ENVIRONMENTS)`: each key of the
     environment's object is the first path segment of a `BINDING_SOURCES` entry, or is on
     `NON_BINDING_KEYS` (the keys the file uses today: `$schema`, `name`, `main`,
     `compatibility_date`, `compatibility_flags`, `workers_dev`, `preview_urls`,
     `upload_source_maps`, `routes`, `placement`, `observability`, `vars`, `migrations`,
     `triggers`, `env`). Staging is scanned too, so a new kind declared under `env.staging` alone
     cannot hide from parity. The failure message names the key and the environment and says to add
     it to one list or the other.

   A failing parity assertion prints the two sorted arrays, which names the missing binding without
   a custom message.

4. **Delete `src/server/ai/__tests__/binding.test.ts`** and repoint the one comment that cites it,
   `src/server/ai/cloudflare-env.d.ts:20-21`, at `src/server/__tests__/wrangler-bindings.test.ts`.

**Alternatives considered.** _Keep the rule in `src/server/ai/`_: loses the point — a config-wide
rule in a feature directory is what made the inventory churn land there. _Import wrangler's
`unstable_readConfig`_: the measured 192 MB per worker, paid by every suite that asks. _A JSONC
dependency (`jsonc-parser`)_: docs/SPEC.md §3 pins the stack, and a 60-line reader with a fixture
test is smaller than the approval.

## 📝 Architecture

| Concept                                            | Owner (docs/SPEC.md §8)                          |
| -------------------------------------------------- | ------------------------------------------------ |
| Reading `wrangler.jsonc` in tests; binding sources | `src/server/__tests__/wrangler-config.ts`        |
| The reader's own correctness                       | `src/server/__tests__/wrangler-config.test.ts`   |
| Binding parity across environments                 | `src/server/__tests__/wrangler-bindings.test.ts` |

`src/server/__tests__/` already holds `worker.test.ts`, the other config-wide question. The
`server` project collects `src/server/**/*.test.{ts,tsx}` (`vitest.config.ts:127-131`), so both new
suites run there with no config change, and the helper module is not collected. Nothing in
`src/` imports from `__tests__/`; the helper is test-only and never reaches the Worker bundle.

## 📝 Data Model

None. `wrangler.jsonc` is read, never written.

## 📝 API Contracts

None. The exported test helpers are an internal test contract; their signatures are listed in
Proposed Solution §1.

## 📝 UI/UX

None.

## 📝 Visual change expected

None — test-only change with no route, state or rendered output.

## 📝 Copy

None — no user-facing string is added, changed or removed.

## 📝 Edge Cases & Failure Scenarios

- **A binding is added at the top level only.** Parity fails, listing both arrays; the fix is the
  staging declaration.
- **A binding is removed from the top level only.** Parity fails because staging carries a name
  that is neither top-level nor on `STAGING_ONLY_BINDINGS` (Q1).
- **The same name is declared in both, but staging points it at a different resource** (bucket,
  namespace id). Passes, deliberately: staging resources differ by design (`FILES` →
  `planned-travel-files-staging`).
- **A new binding kind** (`services`, `hyperdrive`, …) in either environment. The classification
  case fails naming the key; the implementer adds a row to `BINDING_SOURCES`, and parity then covers
  it.
- **`AI` renamed identically in both environments.** Parity passes; the `HAND_TYPED_BINDINGS` case
  fails, because `src/server/ai/cloudflare-env.d.ts` still types `env.AI`. A rename of a binding
  typed by the generated `worker-configuration.d.ts` (`DB`, `KV`, …) is not caught here — that file
  is the contract for those, and its regeneration is tracked on PRD #167.
- **A new non-binding key** (`limits`, `assets`). The classification case fails; the key goes on
  `NON_BINDING_KEYS`. This is the one list that churns, and only on a new kind of key.
- **The reader mangles the config.** Either `JSON.parse` throws (suite fails loudly) or bindings go
  missing: the non-empty case catches a total loss, and a partial loss shows as a parity or
  classification failure because the two environments would rarely lose the same names. The fixture
  test is the primary guard.
- **A staging-only binding is later also added to production.** Parity fails (the name appears
  twice in the expected list); remove it from `STAGING_ONLY_BINDINGS`.

## 📝 Risks & Impact Review

- **Blast radius:** test code only. `wrangler.jsonc`, the one `BACKWARD_COMPATIBILITY.md`-protected
  file near this change, is read and never written. No runtime, bundle or migration impact.
- **Coverage never shrinks:** every case of the deleted file is covered — `AI` declared under that
  exact name by the `HAND_TYPED_BINDINGS` case, in both environments and under the same name by
  parity, the reader by the fixture test — and parity now also covers `CF_VERSION_METADATA` and
  every list-shaped binding.
- **Rollback:** revert the PR; the deleted suite returns intact.

## 📋 Phasing

One phase. The move and the rule are one concept (config-parity checking) with one owner, and
splitting them would leave either a duplicated reader or a rule with no tested reader in between.

## 📋 Implementation Plan

**Phase 1 — shared reader and the parity rule**

1. Create `src/server/__tests__/wrangler-config.ts` with `parseJsonc`, `nodeAt`, `ENVIRONMENTS`,
   `readWranglerConfig`, the two-shape `BINDING_SOURCES` and `bindingNamesIn`; add
   `src/server/__tests__/wrangler-config.test.ts` with the fixture cases. The old suite still passes
   untouched. → `pnpm exec vitest run --project=server src/server/__tests__/wrangler-config.test.ts`
2. Add `src/server/__tests__/wrangler-bindings.test.ts` with the parity, non-empty, hand-typed and
   classification cases. Verify each fails for its reason by temporarily deleting `ai` from
   `env.staging`, then the top-level `ai`, then renaming `AI` in both environments, then adding a
   `"services": []` key under `env.staging` — and restore the file.
   → the new suite green on the unmodified config.
3. Delete `src/server/ai/__tests__/binding.test.ts`; repoint the comment in
   `src/server/ai/cloudflare-env.d.ts`. → `pnpm typecheck`, `pnpm lint`, `pnpm test`.
4. Move this spec to `.ai/specs/implemented/` with `Status: implemented` and the PR under
   `Implementation`, run `pnpm generate-spec-index`. → the full gate in
   `.ai/agentic.config.json` `validation.commands`.
