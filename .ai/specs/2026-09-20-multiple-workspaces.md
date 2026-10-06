# More than one workspace, and a way to move between them

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #640  |
| **Spec PR**        | none  |
| **Implementation** | none  |

## 📝 TLDR

A user may already belong to several workspaces - `docs/SPEC.md` §5 says so, the `member` table
allows it, and Better Auth is configured with `allowUserToCreateOrganization: true` and
`organizationLimit: 20`. The product exposes none of it: nothing calls `organization.setActive`, so
somebody who accepts an invitation is added to a workspace they can never open, and nothing calls
`organization.create`, so the personal workspace minted at sign-up is the only one there will ever
be. This spec adds a workspace switcher to the account menu (Phase 1) and a plan-gated creation path
behind it (Phase 2): Free keeps the one workspace it is provisioned with, Solo and Crew may create
more. No route gains a workspace segment, no table gains a column, no existing server function
changes shape, and `resolveQuotas` is read but not modified.

## 📝 Problem Statement

Two distinct failures, one cause.

**The invited member is stranded.** `src/routes/(auth)/accept-invitation.$invitationId.tsx:128`
calls `acceptInvitation`, which writes a `member` row, then hard-navigates. The comment on that
navigation (`:136-137`) says:

```tsx
// A document load: joining changes the active workspace, and the app shell
// reads that from the session on the server.
```

**That comment is false, and it is the whole defect.** Joining writes a `member` row and nothing
else. `session.activeOrganizationId` keeps the value it was minted with
(`src/server/db/auth-schema.ts:90-93`); `loadShell` falls back to `firstOrganizationIdFor` - the
**oldest** membership - only when that column is `null`, which it is not. So the reader is returned
to the workspace they were already in, and the invitation they just accepted is invisible. This
ships today.

**Nobody can separate their trips.** Every account gets exactly one workspace,
`provisionPersonalOrganization` (`src/server/auth/provisioning.ts:71-102`), named
`"<FirstName>'s Travel"`. A user planning a family holiday and a client's itinerary keeps both in
one tenant, where `visibility.organization` ("Everyone in the workspace",
`src/lib/i18n/messages/en/shell.ts:614`) means everyone in both.

The current workspace is named in the chrome exactly once, as a non-interactive `<p>`
(`src/components/layout/user-menu.tsx:90-94`). Meanwhile `ShellSession` already carries
`organizations: ReadonlyArray<ShellOrganization>` (`src/components/layout/session.ts:94`),
populated on every authenticated document by `listShellOrganizations()`
(`src/routes/_app/-server/shell.ts:104-117`). **The list the switcher needs is already on the wire
and is currently discarded by the renderer.**

## 📝 Proposed Solution

**Turn the workspace label into a control, and put creation behind it.**

1. **Switch.** A `WorkspaceSwitcher` renders `session.organizations` as a radio group inside the
   existing account menu. Choosing one calls `authClient.organization.setActive({ organizationId })`,
   then navigates to `/dashboard` and invalidates the router - see "Why the switch navigates" below.
2. **Create.** A "Create workspace" item opens a `Dialog` with one field, calling a new
   Zod-validated server function that gates on the caller's plan, reserves a slug, writes the
   workspace, and activates the result.

### Why switching is a mutation, and why it still navigates

The workspace is not in the URL. It is `session.activeOrganizationId`, a column on the session row,
read per request by `requireOrg()` (`src/server/auth/session.ts`) and turned into the
`TenantContext` that `appScope()` (`src/server/fns/context.ts:26-28`) hands to every repository.
There is no `/w/$slug` anywhere in `src/routes/`.

But a bare `router.invalidate()` is not enough, and this is the trap the design has to avoid.
`/trips/$tripId`, `/collections` and `/journey` are tenant-scoped **detail** routes. Invalidating
while sitting on `/trips/abc123` re-runs a loader that now resolves against the new workspace and
throws `NotFoundError` for a trip belonging to the old one. **The switch therefore navigates to
`/dashboard` first, then invalidates** - `/dashboard` is the one authenticated route whose meaning
survives any workspace change.

`BACKWARD_COMPATIBILITY.md` §4 protects every path under `src/routes/_app` because they are linked
from email, OAuth callbacks and bookmarks. Introducing a workspace segment would rename all of them
and need a redirect kept for a release. **A URL-scoped workspace is out of scope, not an
alternative** - though it is the design that would fix the two-tab limitation in Edge Cases.

### Alternatives considered, and why they lost

- **A dedicated switcher beside the `Wordmark` in `top-nav.tsx:59-65`.** More discoverable, and the
  shape most products use. It loses because it adds a third element to a bar that already hides
  `PillNav` below `lg` and "New trip" below `xl`, so it needs its own responsive story before it
  shows anything. The account menu already names the workspace. Promoting it later is a component
  move, not a redesign.
- **Creating from the client with `authClient.organization.create()`.** The plugin permits it and
  `organizationClient()` is registered (`src/lib/auth/client.ts:31`). It loses because the plan gate
  and the slug reservation would then sit on the client side of the boundary, where they are
  advisory. See "Closing the client path" for how that is prevented - **cheaply**.
- **Closing `POST /api/auth/organization/create` with `disabledPaths`.** Rejected, and the reason
  matters: `docs/ACCESS.md:447-450` says in terms that `disabledPaths` _"closes the fifteen paths
  the `admin` plugin adds. It is not a licence to close others: the `organization`, `twoFactor` and
  `passkey` endpoints already in use stay open."_ Using it here would amend a governing document and
  break three assertions in `src/server/auth/__tests__/admin-options.test.ts` (which pin the array
  at exactly 15 entries, all `/admin/`-prefixed, and forbid spreading a second array in). The
  one-line alternative below does the same job without touching any of it.
- **A `/settings/workspaces` route.** A fifth settings page for one button, and a new protected
  path.

## 📝 Architecture

| Layer           | File                                                     | Change                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provisioning    | `src/server/auth/provisioning.ts`                        | **Generalise** the existing batch into `createOrganizationFor(db, user, { name, metadata })`; `provisionPersonalOrganization` becomes its personal-workspace caller. `reserveSlug` stays private - both callers are in this module. |
| Server function | `src/routes/_app/-server/workspace.ts` (**new**)         | `createWorkspace` - Zod-validated, gates on `resolveQuotas().planId`, calls `createOrganizationFor`, activates the result.                                                                                                          |
| Auth config     | `src/server/auth/index.ts:400`                           | `allowUserToCreateOrganization: true` → `false`. One line.                                                                                                                                                                          |
| Shell UI        | `src/components/layout/workspace-switcher.tsx` (**new**) | The radio list and the create item.                                                                                                                                                                                                 |
| Shell UI        | `src/components/layout/user-menu.tsx`                    | Replace the `<p>` at `:90-94`; own the dialog's open state (see UI/UX).                                                                                                                                                             |
| Shell UI        | `src/components/layout/menu.tsx`                         | Add a `max-h`/scroll container to the switcher's list region only - see UI/UX.                                                                                                                                                      |
| Copy            | `src/lib/i18n/messages/<locale>/shell.ts`                | Eight new keys, all 23 locales.                                                                                                                                                                                                     |

**The owner module of workspace creation is `src/server/auth/provisioning.ts`**, not
`src/server/repos/members.ts`, and this is a correction to the obvious first instinct. That module
_already_ writes the `organization` row and the owner `member` row in a single `db.batch`
(`:80-97`). Adding a second implementation of that identical batch in `members.ts` would be exactly
the "one concept, one owner" failure `docs/SPEC.md` §8 describes - two modules owning one write.
Instead the existing batch is generalised and gains a second caller.

`members.ts` is deliberately **not** extended, because it cannot be: every function there takes a
`TenantScope`, including `getOrganization` (`:63`), whose docblock states that `organization` is
scoped by `id = <scope>` and that _"There is no code path that reads it without that predicate."_
Creation has no scope to be handed - the tenant it would be scoped by is the row being created - so
it belongs on the `AuthDb` side of the boundary where `provisionPersonalOrganization` already lives.

### Closing the client path

`src/routes/api/auth/$.ts` mounts Better Auth's whole REST surface as a splat, so
`POST /api/auth/organization/create` answers today. Setting `allowUserToCreateOrganization: false`
(`src/server/auth/index.ts:400`) makes the plugin refuse it at the endpoint. Nothing else changes:
`organization/set-active` stays open, `docs/ACCESS.md` §2.6 stays true as written, and
`admin-options.test.ts` is untouched.

The flag reads as a contradiction once creation exists in the product, so it carries a comment
saying creation is deliberately server-side only, and a test asserts the endpoint refuses while
`set-active` still answers.

## 📝 Data Model

**No migration. No new table, no new column, no changed constraint.**

- `organization` (`src/server/db/auth-schema.ts:220-233`) - `id`, `name`, `slug`
  (`organization_slug_unique`, `:230`), `logo`, `metadata`, timestamps.
- `member` (`:235-256`) - unique `(organizationId, userId)`.
- `session.activeOrganizationId` (`:90-93`) - `onDelete: 'set null'`.

`subscriptions` carries `uniqueIndex('subscriptions_org_unq')` (`src/server/db/schema.ts:637`), so a
created workspace has no subscription row and `planFor(null)` returns `freePlan`
(`src/lib/plans.ts:421-426`), whose `trips` cap is `2` (`:262`). **No billing write happens on
creation, and that is a user-visible consequence, not only an implementation note** - see the Copy
section.

A created workspace writes `metadata: null`; `provisionPersonalOrganization` keeps writing
`{"personal":true}`. Nothing reads the flag today. Resolved assumption 5 records that this makes the
personal workspace the only one carrying it, and what to do about that.

## 📝 API Contracts

### `createWorkspace` - `src/routes/_app/-server/workspace.ts`

```ts
export const createWorkspaceInput = z.object({
  name: z.string().trim().min(1).max(60),
})

export type CreateWorkspaceResult =
  | { readonly ok: true; readonly organizationId: string }
  | { readonly ok: false; readonly reason: 'upgrade-required' }

export const createWorkspace = createServerFn({ method: 'POST' })
  .validator(createWorkspaceInput)
  .handler(async ({ data }): Promise<CreateWorkspaceResult> => { … })
```

**The refusal is returned, not thrown, and that is a deliberate contract choice.** `src/lib/errors.ts`
documents that by the time a failure reaches the browser it is _"an `Error` with a `message` and
nothing else"_, and `readPublicFailure` decodes only `{ kind, message?, code?, reference? }`, where `code` is
the single allow-listed literal `QUOTA_EXCEEDED` (#621). There is no channel for a structured code
plus parameters. Throwing would leave two bad options: send an English
sentence from the server (forbidden - CLAUDE.md: user-facing copy is never hardcoded), or send a key
the client must then map anyway. A discriminated result keeps the refusal machine-readable, lets the
client render catalogue copy, and needs no new error machinery.

Order of operations:

1. `requireUser()` - unauthenticated is the existing auth failure, unchanged.
2. `resolveQuotas(await appScope())` - if `planId === 'free'`, return
   `{ ok: false, reason: 'upgrade-required' }` having written nothing.
3. `createOrganizationFor(auth, user, { name, metadata: null })` - slug reservation and the existing
   single `db.batch` of organization + owner member.
4. `auth.api.setActiveOrganization({ headers, body: { organizationId } })`.

**Creating a workspace is a paid capability, and the gate is the plan of the workspace the caller is
currently in.** Free means exactly one workspace - the personal one provisioned at sign-up - so a
free account cannot create a second. Solo and Crew may create without a numeric limit.

Step 2 introduces **no new query and no new constant**. `resolveQuotas` (`src/server/repos/base.ts:470`)
already reads the active organization's subscription and returns a `planId`, and it is already the
single resolver the billing domain goes through (`src/server/billing/limits.ts` is the authority
order). Gating on its answer means the workspace gate cannot drift out of step with the billing
screen, which a separate `WORKSPACE_OWNERSHIP_LIMIT` constant would have been free to do.

Two honest limits of this gate, neither of which is a reason to build something bigger here:

- **"Unlimited" means "up to the plugin's `organizationLimit: 20`"** (`src/server/auth/index.ts:401`),
  which still applies underneath. Raising it is a one-line config change and is out of scope.
- **The gate reads the _active_ workspace's plan**, not "does this user pay anywhere". A Solo
  subscriber sitting in a free workspace they were invited into cannot create from there. This is the
  reversible direction - it never grants on a technicality - and the upgrade prompt names the
  workspace the reader is in.

**Additive per `BACKWARD_COMPATIBILITY.md` §2**: no existing server function changes shape, and a
browser on the previous bundle never calls this one.

## 📝 UI/UX

`WorkspaceSwitcher` renders inside `MenuContent`, between the identity block and the first
`MenuSeparator`, replacing the `<p>` at `user-menu.tsx:90-94`. It builds on the shared
`src/components/layout/menu.tsx`, which already exports `MenuRadioGroup` (`:74`), `MenuRadioItem`
(`:80`) and `MenuLabel` (`:98`), each with the `Check` indicator. No `components/ui` change, and no
`command` primitive - this repository has none and this feature does not justify introducing one.

**One shared-primitive change is required and is not hidden.** `contentClass` (`menu.tsx:18-19`) is
`overflow-hidden` with no `max-height`, so it does not scroll. With `organizationLimit: 20` a long
list would run off the viewport. The switcher's radio group therefore gets its own
`max-h-64 overflow-y-auto` wrapper inside `MenuContent`; `contentClass` itself is left alone so no
other menu changes.

**States**

| State         | What renders                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| One workspace | `MenuLabel` ("Workspace"), one checked radio item, the "Create workspace" item.                                     |
| Several       | One radio item per `session.organizations` entry, the active one checked, in a scroll container.                    |
| Switching     | The menu **closes** (Radix's default on select) and the route transition to `/dashboard` carries the pending state. |
| Switch failed | `toast.error`; the active workspace is unchanged because nothing local was mutated.                                 |
| Free plan     | The create item stays visible and enabled; the upgrade refusal renders in the dialog.                               |

The "Switching" row is deliberately not an in-menu spinner. `MenuRadioItem` hard-codes its
`ItemIndicator`, so swapping the check for a `Spinner` would mean adding a prop to a shared
primitive for one caller - cost without benefit when the menu is about to close anyway.

The free-plan row is also deliberate. Hiding the action from free readers hides the feature from the
people it is being sold to, and leaves anybody who heard about it with nothing to click and no
explanation. Showing the upsell where they asked for the feature is both the accessible behaviour
and the commercially useful one. The item is not disabled either: a disabled control carries no
reason, and `aria-disabled` copy in a tooltip is worse than a sentence in a dialog.

**The creation dialog's open state lives in `UserMenu`, outside `MenuRoot`.** Radix unmounts
`DropdownMenu` portal content on close and selecting an item closes the menu, so a `Dialog` rendered
_inside_ `MenuContent` would unmount as it opened, and the two focus traps would fight. The create
item therefore only raises a callback; `UserMenu` owns the boolean and renders `<Dialog>` as a
sibling of `<MenuRoot>`. This is the one structural constraint of the design and the reason
`WorkspaceSwitcher` is not fully self-contained.

**Accessibility.** The radio group takes its accessible name from `MenuLabel`; the active workspace
is conveyed by the radio's checked state, not colour; the scroll container is keyboard-reachable;
the dialog is the existing focus-trapped `Dialog`, first focus on the name field.

## 📝 Visual change expected

- **Every authenticated route, account menu open** (the menu lives in `top-nav.tsx`, so all of
  `/_app`). Where one uppercase micro-label named the workspace there is now a labelled radio list
  plus a "Create workspace" item; at one workspace the menu grows by two rows. Beyond roughly six
  workspaces the list scrolls inside its own container rather than growing the menu. Light and dark,
  desktop and mobile.
- **The creation dialog** - at rest, submitting, and showing the upgrade refusal in the field's error
  slot. Light and dark, desktop (centred) and mobile.
- **`/dashboard` immediately after a switch** - the same route rendering another workspace's data.
- No other route changes at rest.

## 📝 Copy

Eight keys in the `shell` namespace beside the existing `account.*` block
(`src/lib/i18n/messages/en/shell.ts:105-112`), each landing in all 23 locales in the same change per
the `i18n-messages` skill; the parity test enforces it.

| Key (`en`)                    | Text                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `workspace.label`             | `Workspace`                                                                          |
| `workspace.switchFailed`      | `Could not switch workspace`                                                         |
| `workspace.switchFailedBody`  | `Check your connection and try again.`                                               |
| `workspace.create`            | `Create workspace`                                                                   |
| `workspace.createTitle`       | `Create a workspace`                                                                 |
| `workspace.createDescription` | `A separate space for its own trips, places and people. It starts on the Free plan.` |
| `workspace.createName`        | `Workspace name`                                                                     |
| `workspace.createUpgrade`     | `Creating more workspaces is part of a paid plan.`                                   |

`workspace.createDescription` names the Free plan because of a failure the reader would otherwise
hit blind: the new workspace has no subscription row of its own (`subscriptions_org_unq`), so it
caps at two trips **even though the reader is paying for the workspace they created it from**.
Saying so at the moment of creation is the cheapest possible fix; carrying the owner's plan across
their workspaces is the named follow-up, not this change.

`workspace.createUpgrade` is rendered with the existing `<Link to="/settings/billing">` - the same
route `user-menu.tsx:105` already links to, three rows above where this dialog opens from, so the
upsell costs no new route and no new pattern. It carries no interpolated number: the rule is
categorical ("free: one", "paid: unlimited"), so there is nothing to interpolate, and the error
channel could not carry one anyway - see API Contracts.

The radio items use each workspace's own name as their label; no `Switch to {name}` key, which would
read wrongly on the already-checked item.

## 📝 Edge Cases & Failure Scenarios

- **Switching while on a tenant-scoped detail route.** The single most common switch in the product,
  and the reason the flow navigates to `/dashboard` before invalidating rather than after. Without
  it, switching from `/trips/abc123` re-runs that loader against the new workspace and throws
  `NotFoundError` on a trip the reader can no longer see.
- **The membership disappears between render and switch.** `setActive` refuses, the toast shows, and
  the stale entry is gone after the next load. Nothing local was mutated.
- **The active workspace is removed while the user is in it.** Unchanged from today:
  `activeOrganizationId` is `onDelete: 'set null'`, `loadShell` falls back to
  `firstOrganizationIdFor`, and `shell.session.membershipRemoved` is thrown when no membership
  survives.
- **A slug collision.** `reserveSlug` retries three times with a `nanoid(6)` suffix, then falls back
  to `nanoid(12)`. Unchanged logic, second caller.
- **A name that slugifies to nothing** (`"日本"`, `"!!!"`). `slugify` returns `''`; the contract falls
  back to `'workspace'` and `reserveSlug` disambiguates. The display name is kept verbatim.
- **Two tabs, two workspaces.** Each tab's next server call resolves the _session's_ active
  workspace, so a stale tab silently starts serving the other workspace's data. Inherent to storing
  the active workspace on the session; it is the strongest argument for the URL-scoped design this
  spec rejects on compatibility grounds. Not solved here - recorded as a known limitation.
- **KV session cache.** Sessions live in `SESSIONS` KV (`src/server/auth/secondary-storage.ts`), and
  `getSession()` passes `disableCookieCache: true` **as a query parameter**
  (`src/server/auth/session.ts:70`) - the file warns at `:51-52` that the sibling-option spelling is
  silently ignored, so any test must assert the query placement. The session row is therefore re-read
  per request and a `setActive` is visible on the next call. Asserted by a test, not assumed.
- **`listOrganizations` fails.** `listShellOrganizations` already falls back to `[active]`
  (`shell.ts:104-117`), so the switcher degrades to naming the current workspace - today's
  behaviour. No change needed.

## 📝 Risks & Impact Review

**Blast radius: the tenancy boundary.** `SDLC.md` classes any diff touching `src/server/auth` as
`risk-high`, and both phases do. The failure this risks is a cross-tenant read, the most expensive
bug this codebase can ship (ADR 0002). Three existing mechanisms contain it: the plugin refuses
`setActive` for a non-member; every read still goes through `createScope` and `tenantFilter`, which
this spec does not touch; and the navigate-plus-invalidate drops every cached loader result at the
moment of the switch.

**Compatibility** (`BACKWARD_COMPATIBILITY.md`): §1 no migration; §2 additive server function only,
`ShellPayload` unchanged; §4 no route added, renamed or removed; §5 eight keys in 23 locales in the
same PR; §6 no persisted or queued shape changes.

**`docs/ACCESS.md` is not amended.** An earlier draft of this design closed
`/organization/create` via `disabledPaths`, which §2.6 forbids in terms. The
`allowUserToCreateOrganization: false` flag achieves the same closure inside the plugin's own
configuration, so the access-control document remains true as written.

**Rollback.** Phase 2 reverts cleanly: workspaces created before the revert are ordinary
`organization` rows with ordinary `member` rows, and nothing understands a shape the old code does
not. Phase 1's revert is **not** free, and the spec should not claim it is: a user who switched into
workspace B and is still there when the switcher is reverted is stranded in B with no control to
return - precisely the defect Phase 1 exists to remove, re-created by its own rollback. Reverting
Phase 1 therefore means also resetting `activeOrganizationId` to `firstOrganizationIdFor` for
affected sessions, or accepting that those users sign out and back in.

**The revenue risk is closed by construction, and the residual one is named.** The obvious hazard -
a free plan caps `trips: 2` per workspace (`plans.ts:262`), so N free workspaces would be 2N free
trips - cannot occur, because a free workspace cannot create another one at all. What remains is the
opposite exposure, and it is small: a **paying** reader can create unlimited workspaces, each of
which is itself free-capped at two trips, so the product under-delivers rather than leaks. That is
the gap the follow-up closes (see Out of scope), and it is a product decision, not a security one.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                             | Applied default                                                                                                                                                                                       | Why                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | One spec or several?                                                                                 | One spec, two phases, plus a separate issue for the three-line invitee fix.                                                                                                                           | Confirmed by a human during this run. The two phases share one component and one shell contract; the invitee defect is separable and is filed on its own because it ships without any of this.                                                                                                                                                                                                                      |
| 2   | How is the free-plan trip multiplication bounded (`plans.ts:262` caps `trips: 2` **per workspace**)? | Creating is a paid capability: `planId === 'free'` refuses, Solo and Crew create without a numeric limit. Gated on `resolveQuotas(await appScope()).planId`; `resolveQuotas` itself is **unchanged**. | Confirmed by a human during this run, replacing an earlier `WORKSPACE_OWNERSHIP_LIMIT` constant. A free workspace cannot multiply itself, so the exposure is zero rather than bounded, and no new query, constant or billing write is introduced - the gate reads the resolver the billing domain already goes through, so it cannot drift from the plan screen. Its two honest limits are stated in API Contracts. |
| 3   | Where does the switcher live?                                                                        | Inside the account menu, replacing the static label at `user-menu.tsx:90-94`.                                                                                                                         | Smallest surface: the workspace is already named there and the menu already has radio items. A trigger beside the `Wordmark` is a later component move.                                                                                                                                                                                                                                                             |
| 4   | What does a user with exactly one workspace see?                                                     | The full control: one checked item plus "Create workspace".                                                                                                                                           | That user is precisely who creation is for; hiding it from them hides the feature from almost everybody. One code path instead of two.                                                                                                                                                                                                                                                                              |
| 5   | Does a created workspace carry `metadata: {"personal":true}`?                                        | No - `metadata: null`, and `provisionPersonalOrganization` keeps writing the flag.                                                                                                                    | Nothing reads it today. This does make the personal workspace the only carrier, which turns a dead field into a meaningful one; the follow-up is to define what `personal` means or drop it from provisioning too, and neither belongs in this change.                                                                                                                                                              |
| 6   | How is the client-side `organization/create` endpoint closed?                                        | `allowUserToCreateOrganization: false` in `src/server/auth/index.ts:400`.                                                                                                                             | One line inside the plugin's own configuration. The `disabledPaths` route is forbidden by `docs/ACCESS.md:447-450` and would break three assertions in `admin-options.test.ts`.                                                                                                                                                                                                                                     |
| 7   | Switching from the client, or a server function?                                                     | `authClient.organization.setActive()`, then navigate to `/dashboard` and invalidate.                                                                                                                  | The plugin already refuses a non-member, which is the only check that matters. A server function would enforce nothing extra.                                                                                                                                                                                                                                                                                       |
| 8   | Does creating a workspace switch into it?                                                            | Yes, in the same call.                                                                                                                                                                                | A create that leaves the reader where they were shows no evidence it worked.                                                                                                                                                                                                                                                                                                                                        |

## 📋 Phasing

Phase 1 is shippable alone: a user who belongs to more than one workspace - today, only by
invitation - gains the ability to reach them. Phase 2 is not shippable without Phase 1, because
creating a workspace you cannot reach is worse than not creating it. The order is fixed.

Phase 1 serves everybody; Phase 2's write path serves paying accounts only, and its free arm is the
upsell. That asymmetry is the reason Phase 1 must not wait for Phase 2: the stranded invitee is a
defect for every reader regardless of plan.

Phase 1 does **not** repair the stale comment and missing `setActive` at
`accept-invitation.$invitationId.tsx:128-137`; that is a three-line fix filed as its own issue,
`risk-low` and shippable immediately. Phase 1 makes the workspace _reachable afterwards_; the
separate fix makes the reader land in it.

## 📋 Implementation Plan

**Phase 1: reach the workspaces you are already in**

1. **A jsdom harness for the dropdown.** There is no existing test that renders a Radix
   `DropdownMenu` (`src/components/layout/__tests__/` has no `user-menu` test at all), so this is
   new infrastructure and gets its own step rather than being assumed by the next one. Prove it by
   rendering the existing `UserMenu`, opening it, and asserting the workspace name is present.
   Verify: `pnpm test`.
2. **Copy first.** Add `workspace.label`, `workspace.switchFailed`, `workspace.switchFailedBody` to
   `src/lib/i18n/messages/en/shell.ts` and all 22 other locales. Verify: the i18n parity test.
3. **The switcher, test-first.** `src/components/layout/__tests__/workspace-switcher.test.tsx`:
   one workspace renders one checked item plus the create item; three render three with the active
   one checked; choosing another calls `setActive` with that id, then navigates to `/dashboard` and
   invalidates, **in that order**; a rejected `setActive` toasts and leaves the checked item where it
   was. Then write `workspace-switcher.tsx`. The create item renders but is inert; the test pins
   that. Verify: `pnpm test`.
4. **The scroll container.** Add `max-h-64 overflow-y-auto` to the switcher's radio group and a test
   that ten workspaces do not grow `MenuContent` past that bound. `menu.tsx`'s `contentClass` is not
   touched. Verify: `pnpm test`.
5. **Mount it.** Replace the `<p>` at `user-menu.tsx:90-94` with `<WorkspaceSwitcher …/>`. Verify:
   step 1's harness test still passes; `pnpm typecheck`.
6. **Pin the session contract.** Extend `src/components/layout/__tests__/shell-session.test.ts`
   (which already builds an `organizations: [ORGANIZATION]` fixture at `:83`) with a case asserting
   `buildShellSession` carries every entry through and marks the active one. Verify: `pnpm test`.
7. **Pin the tenant boundary.** Add a case to `src/server/repos/__tests__/tenant-isolation.test.ts`:
   with a user holding memberships in both fixture organizations (the harness at
   `src/server/repos/__tests__/harness.ts:186-225` already seeds two and exposes `addUser`), a scope
   built from A never returns B's rows and vice versa. Verify: `pnpm test`.
8. **A second seed workspace.** The demo seed resolves exactly one workspace:
   `resolveWorkspace()` in `src/routes/api/dev/-seed/bootstrap.ts:426` returns a singular
   `ResolvedWorkspace { organizationId }` (`:92-93`), threaded singularly through
   `src/routes/api/dev/-seed/apply.ts`. Making it plural is a change to `bootstrap.ts`, `apply.ts`
   and `types.ts` - **not** to `dataset/workspace.ts`, which is only the content of the one
   workspace. Verify: `pnpm worktree:bootstrap` seeds both and `scripts/seed/verify.mjs` passes.
9. **The journey.** E2E in `e2e/journeys.spec.ts`: open the account menu, switch, assert the trip
   list changes and the first workspace's trips are absent. Verify: `pnpm e2e` (note: the E2E suite
   is **not** in `validation.commands`, so this step is verified separately from the gate).

**Phase 2: create a workspace**

10. **Generalise the provisioning batch, test-first.** Extract `createOrganizationFor(db, user,
{ name, metadata })` from `provisionPersonalOrganization:71-102`, leaving the latter as its
    caller. No new constant and no new query. Tests: the personal path is byte-for-byte unchanged in
    what it writes; a name slugifying to nothing still yields a unique slug; `metadata` is written
    through as given. Verify: `pnpm test`.
11. **The server function.** `src/routes/_app/-server/workspace.ts` with `createWorkspace` as in API
    Contracts. Test all three arms: on `free` it returns `{ ok: false, reason: 'upgrade-required' }`
    **and writes nothing** - asserted against the row counts, not the return value alone; on `solo`
    and on `crew` it writes the organization and the owner `member` and sets the session's active
    organization. `resolveQuotas` is read, never modified - a test that fails if `base.ts` appears in
    the diff is not possible, so the review checklist carries it instead. Verify: `pnpm test`.
12. **Close the client path.** Flip `allowUserToCreateOrganization` to `false`
    (`src/server/auth/index.ts:400`) with the comment explaining why. Test: the endpoint refuses and
    `organization/set-active` still answers. Verify: `pnpm test` - including
    `src/server/auth/__tests__/admin-options.test.ts`, which must stay green and untouched.
13. **Copy and dialog.** Add the five `workspace.create*` keys to all 23 locales. Lift the dialog's
    open state into `user-menu.tsx` as a sibling of `MenuRoot`, wire the create item's callback, and
    flip the step-3 assertion that pinned it inert. Verify: the parity test and the switcher tests.
14. **The journey, and the gate.** Extend the E2E: create a workspace from the menu, assert the app
    lands in it and that it has no trips. **The seeded demo workspace must be on a paid plan for
    this journey to exist at all** - check what `subscriptions` row the seed writes before writing
    the test, and cover the free arm too (the dialog shows the upsell and no workspace appears).
    Verify: `pnpm e2e`, then every command in `validation.commands`.

### Out of scope

- **The stranded-invitee fix itself** - filed as its own issue; see Phasing.
- **Member and invitation management** - `createInvitation`, `changeMemberRole`, `removeMember` and
  `updateOrganization` exist in `src/server/repos/members.ts` with no caller; giving them one is
  `docs/plans/10-administration.md` stage `10-S1` (`ADM-02`).
- **Renaming, leaving or deleting a workspace** - `deleteWorkspace(scope)` is minted by
  `docs/plans/09-account-and-settings.md:944-1062`. Worth a separate look: `/organization/delete` is
  reachable today and cascades through every tenant table, with no confirmation step of the
  product's own.
- **A workspace segment in the URL**, and with it the two-tab limitation.
- **Promoting the switcher out of the account menu** into `top-nav.tsx`.
- **A `command` palette primitive.**
- **Carrying the owner's plan across their workspaces** - the named follow-up. The intended end
  state is that a paid plan's value covers every workspace its owner creates (unlimited trips in
  each), with **seats and storage as one shared pool per owner** rather than per workspace. It is
  out of scope here because it means writing in `src/server/billing` and changing what
  `resolveQuotas` resolves against - a plan resolved per _owner_, not per `subscriptions` row - and
  this spec deliberately leaves that resolver untouched. Until it lands, a created workspace is a
  Free workspace and the copy says so.
- **Per-workspace billing** beyond naming the Free plan at the moment of creation, and beyond the
  create-time plan gate.
- **Moving or copying a trip between workspaces.**
- **Raising `organizationLimit: 20`.**
