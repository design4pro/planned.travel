# Administration

The workspace console: who is in a workspace and how they got there, what the workspace has done, and
which role is allowed to do what.

Read `docs/SPEC.md`, `DESIGN.md` and `docs/ARCHITECTURE.md` first. The stage shape is fixed by
`TEMPLATE.md`, the container rule by `12-verification-protocol.md` §1, and the clean-room rule and
shared-file protocol by `README.md`. Nothing below restates them.

## Area brief

### What this area is on disk, measured at HEAD

- **The console exists and is read-only.** `src/routes/_app/admin.tsx` (357 lines) loads
  `loadAdmin` (`src/routes/_app/-server/overview.ts:430-451`) and renders a `PageHeader`, an
  outstanding-invitations `Alert`, four `StatCard`s, a quotas panel with 70%/90% tone steps, a
  members `Table`, a 25-row activity list and a busiest-actions panel. It is gated at
  `src/routes/_app/admin.tsx:69` on `shell.session.user.isAdmin`, which
  `src/routes/_app/-server/shell.ts:129` derives as `roleSatisfies(role, 'admin')`. Not one control
  on the screen writes anything.
- **The console is one page, reachable from one place.** The only link into it is the account-menu
  item at `src/components/layout/user-menu.tsx:95-102`, rendered only when `user.isAdmin` is true.
  There is no per-tab URL, so no part of the console can be bookmarked, linked to a colleague or
  reached with the browser's back button; and the settings section index
  (`src/routes/_app/-ui/settings-nav.tsx:42-79`) lists six sections and does not mention the console
  at all.
- **The membership repository is complete and almost entirely unreached.**
  `src/server/repos/members.ts` already implements `listMemberProfiles` (`:118`), `changeMemberRole`
  (`:171`), `removeMember` (`:187`), `createInvitation` (`:257`), `setInvitationStatus` (`:289`) and
  `cancelInvitation` (`:299`), each of the writes behind `assertCanAdminister`. No server function
  exposes any of them. `src/routes/_app/settings/organization.tsx` lists members and pending
  invitations read-only, and `src/routes/_app/-server/settings.ts` exposes exactly two workspace
  functions — `loadOrganizationSettings` (`:331`) and `saveWorkspaceDefaults` (`:385`).
- **The invitation-acceptance screen is finished and unreachable.**
  `src/routes/(auth)/accept-invitation.$invitationId.tsx` (379 lines) resolves five distinct states
  through `src/routes/(auth)/-server/invitation.ts` — anonymous, wrong account, unavailable,
  unverified, ready — and accepts or declines through Better Auth at `:120` and `:136`. Nothing in
  the product can produce the invitation it reads.
- **The audit table is read by a screen no production write path feeds.**
  `src/server/repos/audit.ts` implements `recordAudit` (`:60`), a keyset-paged `listAuditLog`
  (`:93`), `listEntityHistory` (`:111`), `countAuditActions` (`:126`) and `pruneAuditLog` (`:141`).
  Every `audit_log` row in a running workspace today comes from the dev seeder, which inserts
  through the repository object directly (`src/routes/api/dev/-seed/apply.ts:669-676`).
- **Authorisation has exactly one implementation, and it is small.** `src/server/repos/context.ts`
  ranks three roles (`:15-16`) and offers `hasAtLeastRole` (`:117`), `assertRole` (`:122`) and
  `assertCanAdminister` (`:136`). Repository-wide, the only module that calls any of them is
  `src/server/repos/members.ts`. The only role read inside a component is
  `shell.role !== 'member'` at `src/routes/_app/trips/$tripId/collab.tsx:86`, and it hides an
  affordance rather than guarding a write.

### The rows this plan closes

| Row      | Stage   | Wave | Status         |
| -------- | ------- | ---- | -------------- |
| `ADM-02` | `10-S1` | 3    | absent → done  |
| `ADM-04` | `10-S2` | 1    | partial → done |
| `ADM-01` | `10-S3` | 4    | partial → done |
| `ADM-03` | `10-S4` | 5    | absent → done  |

`ADM-05` is **excluded from this plan** and is not closed by any stage here. It is instance-scoped
by construction — one deployment is one tenant upstream, and every item in it (database backup and
restore, instance-wide user administration, mail-channel configuration, demo mode, a release feed)
either has no multi-tenant meaning or belongs to platform operations rather than to a product
surface. The argument, the hosted equivalents and the disposition live in
`docs/plans/11-boundaries-and-blockers.md`, which owns that row.

### Reading order is not wave order here, deliberately

`TEMPLATE.md` has a plan run its stages lowest wave first. This file puts `10-S1` first instead, and
says so rather than leaving a reader to notice:

- Member administration is this plan's spine. It is the record every other stage in the file reads —
  the audit trail resolves an actor to a member profile, the console's Members tab is its surface,
  and the permission matrix decides which role may perform its writes — so reading it second, third
  or fourth means reading three stages that refer forward.
- It is also the highest-leverage row in the file by the measurement `README.md` publishes:
  transitive in-degree 10, third of all 89 rows, and `01-trips-core.md` names it as the supplier its
  own `01-S6` waits on.

Execution order is unaffected and is not a matter of reading order: every stage below states the wave
it may start in on its `### Stage id` line, and that field — not the position of the block in this
file — is what an orchestrator schedules against. In wave order the file runs `10-S2` (1), `10-S1`
(3), `10-S3` (4), `10-S4` (5).

### One authorization boundary, and the one thing a route may do about it

Three of the four stages below add a role assertion to a repository read or write, so the rule they
share is written once here instead of four times, and each stage points at it.

- **The repository decides, and nothing else does.** Every assertion in this plan —
  `assertCanAdminister` today, `assertAction` after `10-S4` — is called inside the repository
  function, before the query, in the same preamble as the tenant filter and the quota check. No
  route, `beforeLoad`, loader, server function or component in this plan decides whether a caller
  may do something.
- **A loader may skip a call it knows will be refused, and that skip is not a decision.** It changes
  what is rendered, never what is permitted: the server function stays reachable without the route
  that renders its UI, and calling it anyway still ends in the repository's `ForbiddenError`.
- **Why that distinction is load-bearing here rather than pedantic.** The console's loader is
  unconditional today — `loader: () => loadAdmin()` (`src/routes/_app/admin.tsx:54`) runs for
  everyone, and `loadAdmin` reads the audit trail at
  `src/routes/_app/-server/overview.ts:450` — while the designed locked state is a component-level
  check that only runs once the loader has already resolved (`src/routes/_app/admin.tsx:69-87`). Add
  an assertion to `listAuditLog` without touching that loader and a non-admin who opens `/admin`
  gets the route's red error panel instead of the sentence explaining what happened. `10-S2`
  therefore makes the console's loader conditional on the admin flag the `_app` route already puts
  on the router context (`src/routes/_app/route.tsx:20-32`), returns `null` for a non-admin, and
  keeps the locked state drawn exactly as it is; `10-S3` carries the same shape into every tab route
  it creates. That is the only route-level change either stage makes, and it is stated in both.
- **It also closes something that reads as a defect today.** A non-admin's browser currently
  receives the entire admin payload — every member profile, twenty-five audit rows, the workspace's
  quota usage — and then renders a locked state over the top of it. After `10-S2` the payload is
  never fetched for them at all.

### What this plan does not own

None of the six shared paths of `README.md` is claimed by any stage here. Two consequences are
carried in the stages that need them: the audit **write** path is `00-foundations.md`'s `00-S3` and
is a dependency of `10-S2`, not a thing `10-S2` builds; and the one additive column `10-S4` needs is
stated as a wave-0 requirement under that stage's **Data and migration** heading rather than written
by it.

One section that `TEMPLATE.md` does not describe closes this file: **Cross-plan collisions**, the
verbatim output of `scripts/ultrabuild/check-plan-collisions.mjs`. It is here because the
measurement has to travel with the file it is about — a judgement re-made by hand each round is
eventually made wrong.

## Stage 10-S1 — Everyone in the workspace, and the invitation that puts them there

### Stage id

`10-S1` · Wave 3 · effort **M**. The write half of workspace membership: roles, removal, and an
invitation that can actually be sent.

### Reference rows

- `ADM-02` absent → **done**.

Sourced from `wiki: Admin-Users-and-Invites` for the behaviour set — a list of people with a role
each, a role that can be changed in place, removal that is confirmed rather than immediate, and a
pending-invitation list with revocation. Described here in planned.travel's own vocabulary against
the tables that already exist.

**The receiving screen already ships, and this stage is what reaches it.**
`src/routes/(auth)/accept-invitation.$invitationId.tsx` is finished: it resolves the five states
listed in the area brief through `src/routes/(auth)/-server/invitation.ts`, and accepts or declines
through Better Auth's own organization API (`:120`, `:136`). The invitation row this stage mints is
the row that screen reads, addressed by the same id in the same `invitation` table, so the accept
path is not rebuilt, not duplicated and not touched. The one thing missing between the two today is
a way to create the row, and that is this stage.

**The organization plugin's limits are respected, never re-derived.** They are already configured at
`src/server/auth/index.ts:234-254` and this stage reads them rather than inventing a second set:

| Configured limit                     | Value                                    | How this stage respects it                                                                  |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `invitationExpiresIn`                | `INVITATION_TTL_SECONDS`, 7 days (`:37`) | The expiry this stage stamps is computed from that constant, exported for the purpose.      |
| `invitationLimit`                    | 50                                       | The outstanding-invitation ceiling; the seat quota below is stricter and refuses first.     |
| `membershipLimit`                    | 100                                      | The outer envelope on members; the seat quota below is stricter and refuses first.          |
| `creatorRole`                        | `owner`                                  | Why a workspace always has at least one owner, which is what the last-owner guards protect. |
| `cancelPendingInvitationsOnReInvite` | `true`                                   | Re-inviting an address refreshes the pending row rather than minting a second one.          |
| `sendInvitationEmail`                | queues `auth.organization-invitation`    | The same message kind and template this stage enqueues, so one email exists, not two.       |

Rows unblocked: `TRP-11` (`01-trips-core.md`, `01-S6`, wave 4) directly. That stage names this stage's row in its own
`dependsOn`, and its Reference rows and Blockers both name it as the path a person outside the
workspace travels before a trip can seat them. `ADM-01` and `ADM-03` are also downstream of it.

### Owned paths

- `src/routes/_app/-server/administration.ts` — new. The stage's server functions.
- `src/server/repos/members.ts` — edit. Two read helpers, one expiry write and one guard, all named
  under **Server** below: three added functions, plus a single-line role ceiling inside three
  existing ones — `addMember` (`:165`), `changeMemberRole` (`:177`) and `createInvitation` (`:281`).
  No existing function's signature changes and no existing caller moves. **This file is touched by
  one other plan, in an earlier wave, and it is named here as the shared-path protocol requires:**
  `09-account-and-settings.md` `09-S3`, wave 1, which adds `deleteWorkspace` to it. That addition is
  a fourth function in the same module, disjoint from these three and from the three guard lines, and
  the waves are sequential, so the second writer appends to what the first left. `10-S4` in wave 5 is
  the third writer; what it changes there — seven `assertCanAdminister` call sites, three of which
  sit above these guard lines rather than on them — is stated in its own **Owned paths**.
- `src/server/auth/index.ts` — edit, and it is an export change only: `INVITATION_TTL_SECONDS`,
  `ORGANIZATION_MEMBERSHIP_LIMIT` and `ORGANIZATION_INVITATION_LIMIT` become named exports and the
  plugin configuration reads them from the same declarations. No behaviour changes, no plugin option
  is added or removed. **This file is touched by the same sibling stage and is named here for the
  same reason:** `09-account-and-settings.md` `09-S3`, wave 1, which enables two `user` capabilities
  in the same configuration object. Neither edit moves the other's lines, and the waves are
  sequential.
- `src/components/administration/members-panel.tsx` — new. The member list and its row actions.
- `src/components/administration/invitations-panel.tsx` — new. Pending invitations and their
  actions.
- `src/components/administration/invite-member-dialog.tsx` — new. The invite form.
- `src/components/administration/__tests__/invite-member-dialog.test.tsx` — new.
- `src/routes/_app/admin.tsx` — edit. Mounts the two panels. In wave 4 `10-S3` replaces this file
  with the console's route folder and re-mounts the same two components unchanged; that is why they
  are components under `src/components/administration/` and not markup inside the route.
- `src/server/repos/__tests__/members.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block, under
  the append-only exception `README.md` grants.
- `e2e/administration.visual.spec.ts` — append. This plan's own spec file, created by `10-S2` in
  wave 1; this stage adds one `test.describe` named for it.
- `e2e/__screenshots__/administration.visual.spec.ts/` — append. Its own baselines.

No route file is added, so `pnpm generate-routes` is not a step of this stage.
`src/routeTree.gen.ts` is not an owned path here or anywhere in this plan.

### Data and migration

**None.** Both tables exist in `src/server/db/auth-schema.ts` and are already migrated:

- `member` (`:206-227`) — `organization_id` NOT NULL with `ON DELETE CASCADE`, `user_id`, `role`,
  `created_at`. `organization_id` is the leading column of `member_organization_id_user_id_unique`
  and carries its own index.
- `invitation` (`:229-250`) — `organization_id` NOT NULL with `ON DELETE CASCADE`, `email`, `role`,
  `status`, `inviter_id`, `expires_at` (`timestamp_ms`), `created_at`, and
  `invitation_organization_id_idx`.

No column, no index, no migration, nothing to backfill. Instants stay epoch milliseconds; ids stay
`newId()`; there is no money and no date text on this surface.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/members.ts`.** All SQL for this stage lives here and nowhere
  else, and every query is built through `createTenantRepository` / `tenantFilter()` from
  `src/server/repos/base.ts`, so `organization_id = <scope>` is the leading predicate of every read
  and is stamped onto every write. Existing functions are reused as they stand: `listMemberProfiles`
  (`:118`), `countMembers` (`:140`), `changeMemberRole` (`:171`), `removeMember` (`:187`),
  `listPendingInvitations` (`:249`), `createInvitation` (`:257`), `cancelInvitation` (`:299`).
  Three additions:
  - `getInvitation(scope, invitationId)` — one row by id inside the tenant, for the resend path.
  - `listInvitationsWithInviter(scope)` — pending invitations with the inviting member's display
    name, joined through `member`/`user` under the same tenant predicate `listMemberProfiles`
    already uses, so the join can only reach people who are in this workspace.
  - `refreshInvitationExpiry(scope, invitationId, expiresAt)` — moves a pending row's expiry
    forward on a resend, behind `assertCanAdminister`. This is the stage's only new write, and it
    exists so a re-invitation refreshes the existing row instead of minting a second one, which is
    what `cancelPendingInvitationsOnReInvite: true` intends.
- **Server functions — `src/routes/_app/-server/administration.ts`.** Each builds its scope with
  `appScope()` from `src/routes/_app/-server/context.ts`, the same way every other module in this
  directory does.
  - `loadAdministration` — `createServerFn({ method: 'GET' })`. Returns member profiles, pending
    invitations with inviter names and expiry instants, the seat usage and ceiling from
    `resolveQuotas(scope)`, and the caller's own member id and role so the UI knows which row is
    theirs. No input.
  - `inviteMemberFn` — `POST`. Returns the created invitation.
  - `resendInvitationFn` — `POST`. Refreshes the expiry and re-enqueues the email.
  - `revokeInvitationFn` — `POST`. Delegates to `cancelInvitation`.
  - `changeMemberRoleFn` — `POST`. Delegates to `changeMemberRole`.
  - `removeMemberFn` — `POST`. Removes through `auth.api.removeMember`, not the repository
    `removeMember`, so the after-hook that queues room eviction runs (`docs/ACCESS.md` §2.6, #1010).
    "Leave this workspace" is `organization/leave`, which stays open over HTTP.
- **Zod v4.** Every input is a `z.strictObject`, so an unknown key is a rejection rather than a
  silently ignored field:
  - `inviteMemberFn`: `{ email: z.email({ error: 'Enter the address to invite.' }), role: z.enum(ORGANIZATION_ROLES) }`.
  - `resendInvitationFn` / `revokeInvitationFn`: `{ invitationId: z.string().trim().min(1).max(64) }`.
  - `changeMemberRoleFn`: `{ memberId: …, role: z.enum(ORGANIZATION_ROLES) }`.
  - `removeMemberFn`: `{ memberId: … }`.
    The expiry is **never** accepted from the client: no input schema above carries an `expiresAt`
    field, and because every one is a `z.strictObject` a client that sends one is rejected rather
    than ignored. It is computed server-side as `now + INVITATION_TTL_SECONDS`. Validation here is
    shape only.

  **Why the constant has to become an export, stated because it is the one line of this stage that
  touches a file outside the module.** `createInvitationInput` requires `expiresAt`
  (`src/server/repos/members.ts:52-56`: `instantSchema`, not optional and with no default), so
  something above the repository must supply the instant. Today the only thing that knows the
  window is the plugin configuration, where `INVITATION_TTL_SECONDS` is a module-private constant
  (`src/server/auth/index.ts:37`) read at `:240` and `:251`. The alternative — a second seven-day
  literal in the server function — is exactly how the invitation email's stated expiry and the row's
  real expiry drift apart, so the constant is exported and read from its one declaration.

- **Authorisation is decided in the repository, and only there.** `createInvitation`,
  `cancelInvitation`, `changeMemberRole`, `removeMember` and the new `refreshInvitationExpiry` each
  call `assertCanAdminister(scope.ctx, …)` before they touch a row, and `removeMember` additionally
  permits the caller to remove themselves. The server functions decide nothing: a well-formed
  `memberId` from the client is not an authorised one, and a server function is reachable without
  the route that renders its UI. The two last-owner guards (`:180-182`, `:192-194`) are the
  repository's, and the UI only mirrors them by disabling a control it knows will be refused.
  The one exception is removal: `removeMemberFn` calls `auth.api.removeMember` so room eviction runs,
  and the repository `removeMember` has no eviction hook, no owner ceiling for an admin and no audit
  entry (#1010).
- **A granted role may never outrank the granter. This is the third guard, and it is the one thing
  in this stage that has to be written rather than reused.** Measured at HEAD, nothing enforces it:
  `addMember` stamps `values.role ?? 'member'` (`src/server/repos/members.ts:165`),
  `changeMemberRole` writes `roleSchema.parse(role)` (`:177`) and `createInvitation` stamps
  `values.role ?? 'member'` (`:281`), each behind `assertCanAdminister`, which admits `admin` as well
  as `owner` (`src/server/repos/context.ts:136-140`). So an administrator can seat an `owner` today —
  by inviting an address they control and accepting it — and that is a privilege escalation with no
  guard in front of it. This stage adds one line to each of the three, and only those three, because
  they are the only functions in the codebase that write a role:

  ```
  if (!hasAtLeastRole(scope.ctx, granted)) {
    throw new ForbiddenError(`grant the ${granted} role`, rolesAtOrAbove(granted))
  }
  ```

  `hasAtLeastRole` (`src/server/repos/context.ts:117`) is the one implementation of the role
  comparison and is imported, not re-written; `ForbiddenError` is the error the layer already raises
  for an insufficient role, and its `required` argument renders as "requires one of: owner", which is
  the true answer to "who could have done this". `rolesAtOrAbove` is a one-line local helper in
  `members.ts` — `ORGANIZATION_ROLES.slice(0, ORGANIZATION_ROLES.indexOf(granted) + 1)` — and it is
  written that way rather than over `ROLE_RANK` for a reason worth one clause: `ROLE_RANK` is
  module-private in `context.ts` (`:16`), so reaching it would mean exporting it, and `context.ts` is
  a file no stage in this plan owns. `ORGANIZATION_ROLES` is already exported from
  `src/server/db/auth-schema.ts:26`, is already imported by `members.ts` (`:17`), and is already
  ordered most-privileged first — `['owner', 'admin', 'member']` — which is the ordering the helper
  needs and the same one the UI's select renders in.

- **The ceiling sits on the mint, not on the accept, and that placement is load-bearing.** An
  invitation is accepted through Better Auth's own organization API
  (`src/routes/(auth)/accept-invitation.$invitationId.tsx:120`), which reads the role off the
  `invitation` row and writes the `member` row itself without passing through this repository. A
  ceiling applied only at acceptance would therefore never run. Checking the role at the moment it is
  written onto the invitation is what makes the row safe wherever it is later redeemed.
- **What the ceiling deliberately does not cover.** Removal is not bounded by it: an admin may remove
  an owner, which gains the admin nothing, and the last-owner guard (`:192-194`) already stops the
  only version of that with teeth — removing every owner. Self-removal stays permitted at every role.
  Stating the exclusion is the point; a guard whose edges are not written down grows one silently.
- **Role change landed ahead of this stage (#995), with a stricter owner-row rule.** The
  `changeMemberRole` ceiling and its server function shipped before wave 3, so a workspace owner can
  promote a second owner from the Workspace console, which the platform console's delete refusal
  tells the operator to expect. What is delivered differs from the sketch above in four ways this
  stage reads rather than redoes:
  - The ceiling is `assignableRoles(callerRole, currentRole)` in `src/server/repos/members.ts`, not a
    `hasAtLeastRole` line: an `owner` may set any role, an `admin` may move a row that does not hold
    `owner` between `admin` and `member`, a `member` may set none. So an admin can neither grant
    `owner` **nor change an owner row** (the stricter rule: demoting an owner is an owner's act),
    and the repository refuses before it writes. The last-owner guard is unchanged. The same helper
    feeds each member row's `assignableRoles`, so the control and the repository cannot disagree.
  - `changeMemberRoleFn` lives in `src/server/fns/members.ts` (logic in `member-role-writes.ts`), not
    in `administration.ts`; this stage adds the other functions there and leaves it where it is. Its
    input is a `z.strictObject({ memberId, role })` with one enum role, and it throws the
    impersonation `AuthRequirementError` before any read (`docs/ACCESS.md` §6.4).
  - It writes one `member.role_changed` audit entry on a change that alters the role, and none for a
    no-op or a refusal.
  - Better Auth's `organization/update-member-role` and `organization/remove-member` are closed over
    HTTP (`docs/ACCESS.md` §2.6); the in-process calls stay. `removeMemberFn` (#1008) removes through
    `auth.api.removeMember` so room eviction runs.
    The control is `src/components/layout/member-role-control.tsx`, mounted on `/admin` in the members
    table; this stage's `members-panel.tsx` takes that cell over unchanged. `addMember` and
    `createInvitation` still need their own ceiling line.
- **Email, never inline.** The invitation email is enqueued on `TASKS` through `queueAuthEmail`
  (`src/server/auth/email.ts:286`) with the existing `auth.organization-invitation` message kind
  (`:44`), whose subject, HTML and plain-text bodies already render. Nothing is sent from the
  request path.
- **No in-app notification is written, and the reason is not an omission.** An invitee is by
  definition not yet a member of the workspace, the notification inbox is tenant-scoped, and a row
  written into a workspace the recipient cannot open is a notification nobody can read. The
  preference matrix already carries `organization.invited`
  (`src/routes/_app/-lib/notifications.ts`, `NOTIFICATION_EVENTS`), and the channel it resolves to
  for a non-member is email — which is the channel this stage uses. The dispatch composition layer
  `00-S2` builds (`src/server/notifications/dispatch.ts`) is therefore not called from here.
- **Audit.** Every write records one entry through `trail()` from `00-S3`
  (`src/server/audit/trail.ts`), with the action keys listed in `10-S2`. An audit failure never
  fails the member action it describes.
- **Realtime.** None. Membership is not per-trip state, so nothing goes through `TripRoom`.

### UI (route, components)

- **Route.** No new route file. In wave 3 the two panels mount into the existing single-page console
  at `src/routes/_app/admin.tsx`, whose loader and admin gate are unchanged; SSR stays at the
  default. In wave 4 `10-S3` gives them `/admin/members` and imports the identical components.
- **Components reused from `src/components/ui`, named because a second implementation of one is a
  defect:** `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Avatar`,
  `Badge`, `Button`, `IconButton`, `Card`, `Dialog` and its `DialogHeader`/`DialogBody`/
  `DialogFooter`, `DropdownMenu` with `DropdownMenuItem` and `DropdownMenuSeparator`, `SimpleSelect`,
  `Field`, `Input`, `Alert`, `EmptyState`, `Skeleton`, `SkeletonText`, `Separator`, `SectionLabel`,
  `Tooltip`, and `toast` from `sonner`. New product components are the three under
  `src/components/administration/` listed in **Owned paths**; they take data as props and never
  import from `server/`.
- **The member list.** One row per person: `Avatar` plus name and email, a role control, the joined
  date, and a row menu. The role control is a `SimpleSelect` listing the roles at or below the
  caller's own, in `ORGANIZATION_ROLES` order — an owner sees Owner / Admin / Member, an admin sees
  Admin / Member — which mirrors the repository's ceiling and decides nothing; a row already held by
  someone senior to the caller renders their role as a `Badge` rather than as a control. It is
  disabled with a `Tooltip` reason when the row is the workspace's last owner or when the caller is
  not an admin. The row menu offers "Change role" (focuses the select), "Remove from workspace", and — on
  the caller's own row — "Leave workspace" instead. Removal opens a destructive `Dialog` naming the
  person and stating what they lose; the confirm button carries `loading` while the request is in
  flight and the dialog stays mounted until it resolves, so the spinner is visible rather than the
  dialog vanishing mid-action.
- **The invitations list.** One row per pending invitation: address, role `Badge`, who invited them,
  and the expiry as a relative string with `tabular-nums`. An invitation whose `expires_at` has
  passed is rendered as an expired row with `warning` tone and its only action is Resend. Actions
  are Resend and Revoke; Revoke confirms in the same destructive `Dialog` pattern.
- **The invite form.** A `Dialog` with an email `Field`, a role `SimpleSelect` defaulting to Member
  and offering only the roles at or below the caller's own — the same mirror of the same ceiling —
  and a seat line reading "4 of 10 seats used" in `tabular-nums`, which switches to `warning` tone at
  the last seat and to `danger` with the submit button disabled when the plan is full — the same
  ceiling `assertQuota` will enforce, shown before the request rather than after it. A duplicate
  address, a malformed address and a quota refusal each surface as inline field errors, not as a
  toast.
- **States, per list.**
  - _Members — empty:_ the list cannot be empty, because the caller is always in it; the designed
    empty state that does exist is "You are the only person here", drawn on `--color-surface-2` with
    a `Users` glyph and an "Invite someone" button as its action.
  - _Members — skeleton:_ six `SkeletonText` rows at the table's own row height inside the table
    shell, on `--color-surface-2`, so the panel does not change height when data lands.
  - _Members — error:_ an `Alert` with `tone="danger"` on `--color-surface-2` reading "The member
    list did not load", with a Retry button that re-invalidates the route.
  - _Invitations — empty:_ "Nobody is waiting on an invitation" on `--color-surface-2`, with a
    single line explaining that an invitation counts against a seat while it is outstanding, and an
    "Invite someone" action.
  - _Invitations — skeleton:_ three `SkeletonText` rows on `--color-surface-2`.
  - _Invitations — error:_ the same `Alert` pattern, scoped to the panel so the member list stays
    usable.
- **Responsive.** At 360px both tables become a stacked list of cards — avatar, name, email, role
  badge, and one menu button per card — rather than a horizontally scrolled table; the invite action
  becomes a full-width button under the panel header. At 1280px the two panels stack in the console's
  main column. At 2560px they sit in the console's content measure and do not stretch: the member
  row's information does not become more legible at 2000px of line length.
- **Motion.** Dialog enter 220ms on `--ease-out-quint`, exit 150ms, transform and opacity only. A
  removed row leaves with an opacity fade over `--duration-fast`. `prefers-reduced-motion: reduce`
  collapses both to opacity, and the row fade to nothing.
- **Keyboard and a11y.** The role select, the row menu and both dialogs are Radix-backed and keep
  their arrow-key, Escape and focus-return behaviour. Every icon-only control carries an accessible
  name naming the person it acts on ("Actions for Ada Okafor"), never a bare "More". The destructive
  confirm is not the dialog's default focus; the cancel action is.
- **Tokens.** No new token. Colour, spacing, radius, shadow and easing come from
  `src/styles/tokens.css` through the primitives; seat counts, dates and expiry strings carry
  `tabular-nums`.

### Quota

This stage's writes consume **`members`**, the metric the catalogue sells as seats.

- The metric already exists: `METRIC_FOR_QUOTA` maps `seats → members`
  (`src/server/billing/limits.ts:75-79`), `resolveLimits()` resolves it, and the published numbers
  are 1 seat on free, 1 on the single-traveller plan and 10 on the shared plan
  (`src/lib/plans.ts:239`, `:285`, `:335`). Nothing is added to `resolveLimits()` or to
  `PLAN_QUOTAS`, and no case is added to `src/server/billing/__tests__/limits.test.ts`.
- The assertion sites already exist and are inside the repository, before the write:
  `addMember` calls `assertQuota(scope, 'members', await countMembers(scope))`
  (`src/server/repos/members.ts:160`), and `createInvitation` asserts against **members plus
  outstanding invitations** (`:272-277`), so a workspace cannot oversubscribe its plan by inviting
  more people than it can seat. `refreshInvitationExpiry` creates no row and asserts nothing.
- The plugin's `membershipLimit` of 100 and `invitationLimit` of 50 are the outer envelope. The plan
  quota is stricter on every published plan, so the quota is what refuses and the published number
  is the enforced number.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block. In
organization A's scope, against organization B's rows:

- `changeMemberRole` with B's member id → `NotFoundError`; B's member keeps its role.
- `removeMember` with B's member id → `NotFoundError`; B's member still exists.
- `getInvitation`, `refreshInvitationExpiry` and `cancelInvitation` with B's invitation id →
  `NotFoundError` each; B's invitation keeps its status and its expiry.
- `listMemberProfiles` and `listInvitationsWithInviter` in A never return a row belonging to B, and
  the inviter join never resolves a name from B's `member` rows.
- `createInvitation` in A for an address that already has a pending invitation in B mints a **new**
  row in A rather than returning or re-scoping B's.
- `countMembers` in A counts only A, so the seat assertion cannot be widened by B's growth.

Functions covered: `listMemberProfiles`, `listInvitationsWithInviter`, `getInvitation`,
`createInvitation`, `refreshInvitationExpiry`, `cancelInvitation`, `changeMemberRole`,
`removeMember`, `countMembers`.

### Verification

- **Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- **Unit tests — `src/server/repos/__tests__/members.test.ts`:** the last owner cannot have their
  role changed away (`RepositoryError` with code `LAST_OWNER`) and cannot be removed; a member may
  remove themselves without being an admin; a non-admin calling `changeMemberRole` gets
  `ForbiddenError`; re-inviting an address with a pending invitation returns the existing row rather
  than a second one; `refreshInvitationExpiry` moves `expires_at` forward and leaves `status`
  untouched; the expiry stamped by the server function equals `now + INVITATION_TTL_SECONDS` read
  from the plugin's own constant.
- **Unit tests for the role ceiling, in the same file, named separately because they are the guard
  this stage adds rather than one it inherits:** an `admin` scope calling `createInvitation` with
  `role: 'owner'` raises `ForbiddenError`, the error names `owner` as the role required, and
  `listInvitations` afterwards returns no new row — the refusal is before the write, not a rollback
  after it; the same admin scope may still invite at `admin` and at `member`; an `owner` scope may
  invite at every role; `changeMemberRole` from an `admin` scope to `owner` raises `ForbiddenError`
  and the member's stored role is unchanged, while the same call to `admin` succeeds; `addMember`
  refuses the same way, which is what keeps the ceiling true for the one caller outside this stage
  (`src/routes/api/dev/-seed/bootstrap.ts:336`, which runs in an owner scope and is therefore
  unaffected); and removal is proved **not** to be bounded by the ceiling — an `admin` scope may
  remove an `owner` who is not the last one, because the guard is about granting authority and not
  about ranking people.
- **Unit test — `src/components/administration/__tests__/invite-member-dialog.test.tsx`:** the
  submit button is disabled while the seat count equals the ceiling; a malformed address surfaces as
  a field error and no request is made; the pending state disables the form rather than the dialog
  unmounting; the role select offers exactly the roles at or below the caller's own, so an admin's
  options are Admin and Member and an owner's are all three.
- **Browser evidence.** Route `/admin` (wave 4 onward `/admin/members`), at 360px, 1280px and
  2560px, in light and dark — twelve frames, plus the interaction states below, which are the point
  of this stage and are not visible at rest:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/administration.visual.spec.ts

  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/admin" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/10-S1" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
    --click '[data-part="invite-member"]' --state invite-dialog
  ```

  The declared states and their selectors, each of which is published by the product as a stable
  `data-part` attribute rather than a class name: `[data-part="invite-member"]` (the invite dialog),
  `[data-part="member-row-menu"]` (the row menu open), `[data-part="remove-member-confirm"]` (the
  destructive confirm). **Each selector is verified against a running server before capture** by
  asserting `page.locator(sel)` resolves to exactly one element inside this stage's own spec;
  reading the JSX is not a verification, and a selector that resolves to nothing makes the capture
  throw.

- **Clock.** `PT_SERVER_TODAY=2026-08-20` on every capture — the same `BASELINE_DAY` the gate sends.
  The invitation expiry is a relative string, so the entry `10-S2` adds to `RELATIVE_TIME_SITES`
  covers this panel too; this stage adds no second entry and calls
  `auditServerClock(page, ADMINISTRATION_ROUTES)` through the table `10-S2` declares.
- **Console must be silent.** `watchConsole(page, route)` is attached before navigation in every
  test in this stage's `describe`, including the frame-only ones, and the report's `fatal` list is
  asserted empty at the end of each. `TOLERATED_CONSOLE_WARNINGS` is not extended.
- **Layout shift after paint**, which `12-verification-protocol.md` §6 requires of every stage
  alongside the console verdict, and which nothing in `e2e/` or `capture.mjs` measures today. The
  shape is fixed there and is not re-derived here: a `PerformanceObserver` for `layout-shift`
  installed as an **init script** before the document exists, accumulating `entry.value` only where
  `hadRecentInput` is false; `visit()` then `settle()`; `performance.now()` read as the mark;
  and the sum of entries after the mark asserted to be `0`. The budget is zero **after the settle
  mark**, never from navigation.
  The seam is built by whichever of this plan's stages runs first — `10-S2` in wave 1 — and lives in
  `e2e/administration.visual.spec.ts`, which every stage here shares; this stage calls it rather than
  writing a second one. What this stage exercises after the mark is the state it declares: opening the
  invite dialog and opening the row menu must move nothing behind them. Reported per engine, with the
  WebKit reading stated as a **skip and not a pass** — measured there, `layout-shift` is absent from
  `PerformanceObserver.supportedEntryTypes` and `observe()` does not throw, so a WebKit score of
  `0` means "unsupported".
- **Comparison budget.** `maxDiffPixelRatio` is not raised, not globally, not per project, not per
  call.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

On top of those, the `docs/SPEC.md` §2 clauses, ticked against every surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states —
      including the role select, both destructive confirms and the invite submit.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2`.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive at 360px, 1280px and 2560px, where the 360px layout is a designed stacked list and
      not a squeezed desktop table.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names that say whom a control
      acts on, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on the seat
      count and every date.

### Blockers

None that stop the stage. Two dependencies, the freeze, one inherited harness precondition and one
cross-plan requirement, all stated before scheduling rather than discovered mid-run:

- The audit write path is `00-S3` (`00-foundations.md`, wave 0), which closes before wave 1 opens.
- The notification preference matrix that lists `organization.invited` ships with `ACC-05`
  (`09-account-and-settings.md`, wave 2); this stage needs the switch to exist, not the dispatch
  layer, and the switch is already on disk.
- No package outside the `docs/SPEC.md` §3 pinned set is needed, no binding is added to
  `wrangler.jsonc`, and no third-party service is introduced.
- **Inherited harness precondition — `12-verification-protocol.md` §7.1, and it is blocking for this
  stage's baselines rather than for its code.** That section names `/admin` explicitly: it is one of
  two screens printing a `formatRelative` string, and the instants those strings are derived from are
  seeded from a single `new Date()` in `applySeed()` (`src/routes/api/dev/-seed/apply.ts:232`), so
  they move on every re-seed. Neither pin reaches them — `x-pt-server-today` answers a **calendar
  day** through `serverToday()` while these are epoch-millisecond columns, and `FROZEN_NOW` holds an
  in-page `Date.now()`. Confirmed still true at HEAD: `src/routes/_app/admin.tsx:303` renders
  `formatRelative(row.createdAt, now)` against `now = Date.now()` taken at `:67`, and `/admin`
  appears in no route table under `e2e/` today, so nothing has ever baselined it. §7.1's status is
  **deferred, blocking for the first stage that baselines `/admin`** — which this plan is. Designing
  the seam is not this stage's side effect to take on; what this stage owes is to name it, and to keep
  the unpinned string out of the comparison the way §5 permits and only that way: through the
  `relativeTime` declaration and the `RELATIVE_TIME_SITES` entry `10-S2` adds, which pins the
  string first so the excluded rectangle is constant on every run. A widened mask or a raised
  `maxDiffPixelRatio` is not the remedy and is forbidden.
- **Cross-plan requirement.** `src/routes/_app/settings/organization.tsx` keeps a read-only member
  list once this stage ships the writable one in the console. A cross-link from that screen to the
  console's Members tab belongs to the plan that owns the settings area,
  `09-account-and-settings.md`, and is recorded here so it is not silently left as two lists with one
  set of controls.

## Stage 10-S2 — A trail with real entries in it, and a way to read them

### Stage id

`10-S2` · Wave 1 · effort **M**. The reading surface for the audit table, and the naming contract for
what gets recorded.

### Reference rows

- `ADM-04` partial → **done**.

Sourced from `wiki: Instance-Audit-Log` for the behaviour set — a chronological table of significant
actions with actor, action key, resource, address and structured detail, filterable and paged.

**Its dependency is a write path this stage does not build.** `00-foundations.md`'s `00-S3` (wave 0)
supplies `trail()` in `src/server/audit/trail.ts`: a non-throwing wrapper over `recordAudit` that
resolves the request's IP and user agent, swallows its own failures so an audit write can never fail
the action it records, and takes the actor from the scope rather than from the caller. Until it
lands, this screen reads a trail that only the dev seeder appends to
(`src/routes/api/dev/-seed/apply.ts:669-676`) — which is the exact condition this row exists to end.
Wave 0 closes before wave 1 opens, so by the time this stage runs the trail has production rows in
it.

**Which product actions record an entry.** Action keys are lowercase and dotted, entity first, which
is the shape `recordAuditInput` already enforces with a regex
(`src/server/repos/audit.ts:29-42`) — anything else is refused at the boundary. Three groups:

| Recorded by                    | Action keys                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `00-S3`, already landed        | `file.uploaded`, `file.deleted`, `reservation.created`, `reservation.updated`, `reservation.deleted`, `workspace.defaults_changed` |
| `10-S1`, member administration | `member.invited`, `member.invitation_resent`, `member.invitation_revoked`, `member.role_changed`, `member.removed`, `member.left`  |
| `10-S4`, the permission matrix | `permissions.updated`, `permissions.reset`                                                                                         |

Those fourteen are what this plan can guarantee, because they are the writes this plan and its
wave-0 supplier own. The trail is deliberately open-ended beyond them: any stage in any plan that
adds a consequential write records it with a key of the same shape, and this screen renders it with
no code change, because the action column reads the stored string rather than a closed enumeration.
This stage does not reach into another plan's files to add a call site.

**Pruning policy.** Audit entries are kept for **180 days** and then dropped. `pruneAuditLog(scope,
before)` (`src/server/repos/audit.ts:141`) is the only deletion path and it already exists; nothing
in the product deletes a single entry, and the console offers no delete control at all, because a
trail an administrator can edit is not evidence of anything. The retention window is stated on the
panel itself, so the horizon of the table is never a surprise to the person reading it. The sweep
runs from the weekly retention cron already declared in `wrangler.jsonc` — the trigger exists and its
handler currently only logs, so wiring `pruneAuditLog` into it is a requirement on
`00-foundations.md`, which owns `src/server/worker.ts`. It is recorded under **Blockers** below and
is not a thing this stage writes. Until it lands, retention is a stated policy that no job enforces,
which is worth knowing rather than assuming.

Rows unblocked: none directly. `ADM-01` and `ADM-03` both read this table and inherit a trail with
real rows in it.

### Owned paths

- `src/server/repos/audit.ts` — edit. A date range on the list input, an actor vocabulary and a
  total count, named under **Server** below.
- `src/routes/_app/-server/audit.ts` — new. The stage's server functions.
- `src/components/administration/audit-trail.tsx` — new. The paged, filterable table.
- `src/components/administration/audit-entry-sheet.tsx` — new. One entry in full.
- `src/components/administration/console-locked.tsx` — new, and it is a move rather than a design:
  the `EmptyState` currently written inline at `src/routes/_app/admin.tsx:69-87` becomes a props-free
  component with the same glyph, the same sentence and the same link. It is extracted here because
  two files need it after this stage — this route now that the gate reads `null` loader data, and
  `10-S3`'s console layout in wave 4 — and because inline route markup cannot be tested or asserted
  against. Nothing about it changes visually.
- `src/components/administration/__tests__/audit-trail.test.tsx` — new.
- `src/components/administration/__tests__/console-locked.test.tsx` — new.
- `src/routes/_app/admin.tsx` — edit. Two changes. It replaces the 25-row activity list with the
  trail panel; and it makes the route's loader conditional on the session's admin flag, so the
  designed locked state survives the assertion this stage adds to the repository — the rule is in
  the area brief and the mechanics are under **Server** below. In wave 4 `10-S3` moves the same
  component to `/admin/audit` unchanged and inherits the same loader shape.
- `src/server/repos/__tests__/audit.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block, distinct
  from `00-S3`'s: that one covers `recordAudit` and the existing reads, this one covers the two
  reads this stage adds.
- `e2e/helpers/shoot.ts` — edit. One `RELATIVE_TIME_SITES` entry, argued under **Verification**.
  **This file is touched by one other plan, in another wave, and it is named here as the
  shared-path protocol requires:** `01-trips-core.md` `01-S5`, wave 2. No stage in wave 1 claims it,
  so there is no same-wave collision; the check at the foot of this file is the measurement.
- `e2e/administration.visual.spec.ts` — new. This plan's spec file, created here because this is the
  plan's earliest wave; later stages append a `describe` to it.
- `e2e/__screenshots__/administration.visual.spec.ts/` — new. Its own baseline directory, which
  `snapshotPathTemplate` guarantees cannot collide with an existing baseline.

No route file is added, so `pnpm generate-routes` is not a step of this stage.

### Data and migration

**None.** `audit_log` exists and is migrated, with `organization_id`, `actor_user_id`, `action`,
`entity_type`, `entity_id`, `metadata` (JSON, a flat record), `ip`, `user_agent` and `created_at`.
Ids are `newId()`, whose base36-timestamp prefix is what makes the existing keyset paging in
`auditLogRepository.page()` correct without a second sort column. No column, no index, no migration,
no backfill.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/audit.ts`.** All SQL for this stage lives here. Every read is
  built on `tenantFilter(scope, auditLog, …)`, so `organization_id = <scope>` is the leading
  predicate and no filter a caller supplies can widen it — `listAuditLog` already composes the
  caller's filters with `and()` under that predicate (`:93-108`), and the additions keep the same
  shape. Reused as they stand: `listAuditLog` (`:93`), `countAuditActions` (`:126`),
  `pruneAuditLog` (`:141`). Three additions:
  - `listAuditInput` gains `after` and `before`, both `z.iso.datetime()`, compared against
    `created_at` — the date-range filter the table offers.
  - `listAuditActors(scope)` — the distinct `actor_user_id` values present in the trail, so the
    actor filter offers only people who have actually done something.
  - `countAuditEntries(scope)` — the tenant's total row count, which `10-S3` uses to replace the
    console's "Audit entries" figure. Measured: that `StatCard` today renders `data.audit.length`
    (`src/routes/_app/admin.tsx:147-152`), which is the length of a 25-row page and therefore stops
    counting at 25.
- **Server functions — `src/routes/_app/-server/audit.ts`,** both scoped through `appScope()`.
  - `loadAuditPage` — `createServerFn({ method: 'GET' })`. Takes the filters and the cursor, returns
    the page, the next cursor, the total, and the actor profiles for the ids on the page resolved
    through `listUserProfiles` (`src/server/repos/members.ts:210`), which is tenant-scoped — so an
    actor who has left the workspace renders as their shortened id rather than as a name from
    nowhere.
  - `loadAuditFilters` — `GET`. The actor vocabulary and the action vocabulary for the two filter
    controls.
- **Zod v4.** `z.strictObject({ action: …optional(), actorUserId: …optional(), entityType:
…optional(), after: z.iso.datetime().optional(), before: z.iso.datetime().optional(), cursor:
…nullish(), limit: z.number().int().min(1).max(100).optional() })`. The repository re-parses the
  same input, and that redundancy is kept: a server function is not the only way into a repository.
- **Authorisation is asserted in the repository, and the console's loader is changed so the
  designed locked state survives it.** Reading the trail is an administrator's action:
  `listAuditLog`, `listAuditActors`, `countAuditActions` and `countAuditEntries` each call
  `assertCanAdminister(scope.ctx, 'read the audit trail')` before they query. `listEntityHistory`
  keeps its current behaviour and is not changed by this stage.

  That assertion has one consequence outside the repository, and this stage is the one that must
  handle it, in a file it already owns. Measured at HEAD: `loadAdmin`
  (`src/routes/_app/-server/overview.ts:430-451`) calls `listAuditLog` at `:450` and
  `countAuditActions` at `:451`, and the console's route loads it unconditionally —
  `loader: () => loadAdmin()` (`src/routes/_app/admin.tsx:54`) — while the locked state is a
  component-level check that runs only after the loader resolved (`:69-87`). Left alone, a
  non-admin's visit to `/admin` would throw in the loader and render the route's `errorComponent`
  (`:56-60`) instead of the explanation that `10-S3` keeps and photographs. So this stage changes
  the loader to
  `loader: ({ context }) => (context.shell.session.user.isAdmin ? loadAdmin() : null)` — the flag is
  already on the router context, put there by the `_app` route's own `beforeLoad`
  (`src/routes/_app/route.tsx:20-32`) — and the component's guard becomes a check on `null` loader
  data rather than on the flag, with the `EmptyState` markup unchanged.

  **That is a skip, not a second authorization path**, per the area brief: `loadAuditPage` and
  `loadAdmin` stay reachable without the route, and a non-admin who calls either directly still gets
  `ForbiddenError` from the repository. The test that proves it is named under **Verification**.
  Skipping the fetch also stops shipping the whole admin payload to a browser that is about to
  render a locked state over it.

  **The floor stays fixed at `admin` and is deliberately outside `10-S4`'s matrix.** The trail is
  evidence about what administrators did, so who may read it is not itself an administrable setting:
  an owner who could raise `audit.read` above `admin` could hide their own actions from the people
  the trail exists to hold accountable. `audit.read` is therefore not one of the catalogue's sixteen
  keys, and `assertCanAdminister` keeps these four callers after `10-S4`. They are not the only ones
  it keeps, and the exact count matters enough to state here rather than leave to that stage:
  `deleteWorkspace`, which `09-account-and-settings.md` `09-S3` adds to `src/server/repos/members.ts`
  in wave 1, calls it too and also stays outside the catalogue, so the helper ends the plan with five
  callers in two modules rather than becoming a parallel mechanism with nothing left to do. `10-S4`
  enumerates all five.

- **Nothing slow, nothing realtime.** No queue message, no `TripRoom` patch. The trail is a read.

### UI (route, components)

- **Route.** No new route file. In wave 1 the panel replaces the activity list in the console's
  aside at `src/routes/_app/admin.tsx` and becomes the console's main-column panel, keeping the
  route's default SSR. The route's loader gains the one conditional described under **Server**, and
  the admin gate itself is kept: the same `EmptyState` with the same `ShieldCheck` glyph, the same
  sentence and the same link back to the dashboard, reached now from `null` loader data rather than
  from the flag. Nothing about that surface changes visually, which is what lets `10-S3` move it
  into the console layout and photograph it. In wave 4 `10-S3` mounts the identical trail component
  at `/admin/audit`.
- **Components reused from `src/components/ui`:** `Table` and its parts, `Card`, `Badge`, `Avatar`,
  `Button`, `IconButton`, `Sheet` with `SheetHeader`/`SheetBody`, `Combobox`, `SimpleSelect`,
  `DateRangePicker`, `Chip`, `EmptyState`, `Alert`, `Skeleton`, `SkeletonText`, `ScrollArea`,
  `SectionLabel`, `Separator`, `Tooltip`. `DateRangePicker` is on disk and currently consumed by no
  screen; this is its first consumer, which is reuse rather than a new primitive.
- **The table.** Columns: time (absolute date plus a relative string, `tabular-nums`), actor
  (`Avatar` and name, falling back to a shortened id), action (a monospace `Badge`), and resource
  (entity type plus shortened entity id). A row opens `audit-entry-sheet.tsx` — the full entry as a
  `<dl>`: exact instant, actor with email, action, entity type and full id, IP address, user agent,
  and the JSON detail rendered as key/value rows rather than a dumped blob. The sheet is the details
  affordance at every width, so the mobile layout is not a second implementation.
- **Filters.** Actor (`Combobox` over `loadAuditFilters`), action (`SimpleSelect`), and date range
  (`DateRangePicker`). Active filters render as removable `Chip`s above the table with a "Clear all"
  action, so the difference between "nothing happened" and "nothing matches" is visible before the
  reader looks at the empty state.
- **Paging.** Keyset cursor paging with Older / Newer buttons, each disabled at its end of the
  range, and a "showing 1–25 of 412" line in `tabular-nums`. The `Pagination` primitive is
  deliberately **not** used: it addresses pages by number, and `auditLogRepository.page()` is a
  keyset cursor with no page number to address. Saying so here is cheaper than a reviewer asking.
- **States.**
  - _Empty, unfiltered:_ "Nothing has been recorded yet" on `--color-surface-2` with a `ScrollText`
    glyph and one line naming the 180-day retention window — an empty trail reads as new, not
    broken.
  - _Empty, filtered:_ a distinct state, "No entries match these filters", on `--color-surface-2`,
    whose action is "Clear filters" rather than a link away.
  - _Skeleton:_ eight `SkeletonText` rows at the table's row height on `--color-surface-2`, with the
    filter row rendered live so the controls do not appear late.
  - _Error:_ an `Alert` with `tone="danger"` on `--color-surface-2` reading "The audit trail did not
    load", with Retry re-invalidating the route. Reached in the spec with `page.route()` failing the
    request the panel reads, so the state is photographed rather than asserted.
- **Responsive.** At 360px each entry is a card — time and action on the first line, actor and
  resource beneath, tap for the sheet — never a horizontally scrolled table. Filters collapse behind
  a "Filters" button that opens a `Sheet`, with a count `Badge` when any are active. At 1280px the
  four columns are the table. At 2560px the table holds the console's content measure and the
  detail sheet is the only thing that grows.
- **Motion.** Sheet enter on `--ease-drawer`, exit 150ms, transform and opacity only. The filter
  chips enter with a 20ms stagger capped at eight. `prefers-reduced-motion: reduce` collapses both
  to opacity.
- **Keyboard and a11y.** Rows are buttons, not click-handling divs, so the sheet is reachable with
  Return and focus returns to the row on close. The table carries a caption naming it. IP addresses
  and ids use a monospace face at `--color-ink-2`, checked for AA in both themes.
- **Tokens.** No new token. `tabular-nums` on every timestamp, count and range figure.

### Quota

**This stage creates no countable row, and audit entries are deliberately unmetered.** Metering a
compliance record would give a tenant a reason to act in ways that produce fewer entries, which is
precisely backwards. Nothing is added to `resolveLimits()`, nothing to `PLAN_QUOTAS`, and no case to
`src/server/billing/__tests__/limits.test.ts`. Growth is bounded by the 180-day retention above,
enforced through `pruneAuditLog`.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block, covering the
reads this stage adds — `00-S3`'s block covers `recordAudit` and the existing list, and this one does
not repeat it. In A's scope:

- `listAuditLog` with `after`/`before` spanning B's entries returns only A's rows; the date range
  cannot widen the tenant predicate.
- `listAuditLog` with `actorUserId` set to a user who is a member of B only returns an empty page,
  never B's entries.
- `listAuditActors` in A returns only actors who have entries in A.
- `countAuditEntries` in A counts only A's rows, and is unchanged after B writes ten entries.
- `countAuditActions` in A tallies only A's rows, so B's busiest actions can never appear in A's
  panel.
- A non-admin scope in A calling any of the four raises `ForbiddenError` before any query runs, and
  B's data is untouched after every case.

Functions covered: `listAuditLog`, `listAuditActors`, `countAuditActions`, `countAuditEntries`.

### Verification

- **Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- **Unit tests — `src/server/repos/__tests__/audit.test.ts`:** the date range is inclusive at both
  ends and rejects a `before` earlier than its `after`; the cursor returns the next page with no
  overlap and no gap; `listAuditActors` de-duplicates; `countAuditEntries` counts rows the filters
  would exclude, because it is a total and not a filtered count; a non-admin scope raises
  `ForbiddenError` from all four of the reads this stage gates.
- **Unit test — `src/components/administration/__tests__/audit-trail.test.tsx`:** the unfiltered
  empty state and the filtered empty state are different components with different actions; Older is
  disabled when the page has no next cursor; an entry with null IP and null user agent renders the
  sheet without empty rows.
- **The loader conditional is tested from the side that can be tested, and the side that cannot is
  named rather than claimed.** It is the one change this stage makes outside a repository, so it
  gets its own evidence:
  - `src/server/repos/__tests__/audit.test.ts` — a non-admin scope calling `listAuditLog`,
    `listAuditActors`, `countAuditActions` or `countAuditEntries` raises `ForbiddenError` before any
    query runs. This is what proves the skip is not what protects the data: delete the loader
    conditional and the rendering changes, the permission does not.
  - `src/components/administration/__tests__/console-locked.test.tsx` — the extracted locked state
    renders its heading, its explanation and a link to `/dashboard`, and renders no workspace data
    of any kind. That is the assertion the inline markup could never carry.
  - **What cannot be photographed today, measured rather than assumed.** The harness holds exactly
    one session, the demo owner's: `e2e/auth.setup.ts` caches `DEMO_EMAIL`
    (`e2e/helpers/shoot.ts:136`) and the seeder mints a signable password for the owner alone —
    `src/routes/api/dev/-seed/bootstrap.ts:11-15` says so in as many words ("the collaborators are
    deliberately created without a credential account … cannot sign in"), so no member-role account
    can sign in. A frame of the
    locked state therefore needs a fixture that does not exist. It is recorded under **Blockers**
    as a harness requirement on the seeder, which this plan does not own, and it is the only
    declared state in this stage with no frame attached.
- **Browser evidence.** Route `/admin` (wave 4 onward `/admin/audit`), at 360px, 1280px and 2560px,
  in light and dark. Three declared non-resting states, each with its selector verified against a
  running server by asserting a count of exactly one inside this stage's own spec before capture:
  `[data-part="audit-entry-sheet"]` (an entry open), `[data-part="audit-filters"]` (filters applied,
  showing the chip row and the filtered-empty state), and the error surface reached with
  `page.route()` failing `loadAuditPage`.

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/administration.visual.spec.ts

  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/admin" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/10-S2" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
    --click '[data-part="audit-row"]' --state entry-sheet
  ```

- **The spec file and its route declaration.** `e2e/administration.visual.spec.ts` is new, per the
  split rule: this plan never appends to `e2e/visual.spec.ts`. It declares its own `RouteCase` table,
  `ADMINISTRATION_ROUTES`, and calls `auditServerClock(page, ADMINISTRATION_ROUTES)` once in a
  `describe` of its own — the only check that reads the `relativeTime` declaration against the
  streamed payload, and the one the calendar cannot move. Measured: `/admin` appears in no route
  table in `e2e/` today, so it is audited by nothing until this table exists.
- **The `RELATIVE_TIME_SITES` entry, and why this stage owns `e2e/helpers/shoot.ts`.** The trail
  prints a clock-derived string — "2 hours ago" — of a shape not among the three hand-written
  entries in `RELATIVE_TIME_SITES`, which cover a trip-card countdown, a dashboard hero stat and a
  journey backlog line. Without an entry, `pinRelativeTime()` writes nothing on this screen, the
  mask covers nothing, and the string sits inside the comparison at full size, so the baseline fails
  on a morning nobody designed. This stage adds one entry — `source`, `within`, `region`, `drifts`,
  `variants`, `fixed`, `pinned` — scoped to the trail's own time cell, and claims the helper file.
  The only other claimant in the plan set is `01-trips-core.md` `01-S5` in wave 2, so the file has
  one writer per wave; a further stage that wants it declares a module-local helper instead.
- **The third thing a spec with a `relativeTime` route owes, and the one that is easiest to skip
  because it asserts nothing: `auditRelativeTime()`'s report is read, not discarded.** It returns
  sentences rather than failing, deliberately — how many clock-derived strings a screen shows is the
  calendar's decision, so counting them cannot tell a moved fixture apart from a deleted string. A
  non-empty return therefore means that run's exclusion covered nothing and the whole frame was
  compared, and that has exactly two causes: a legitimate one, where the pinned day sits past the
  rows carrying the string, and a defect, where the string was quietly removed. **This stage's
  evidence says which of the two it is**, in words, rather than presenting the run as green.
  `auditServerClock(page, ADMINISTRATION_ROUTES)` is the half that does fail, in both directions,
  and it is what proves the declaration against the streamed payload.
- **Console must be silent.** `watchConsole(page, route)` attached before navigation in every test,
  `fatal` asserted empty at the end of each, `TOLERATED_CONSOLE_WARNINGS` not extended.
- **Layout shift after paint**, which `12-verification-protocol.md` §6 requires of every stage
  alongside the console verdict, and which nothing in `e2e/` or `capture.mjs` measures today. The
  shape is fixed there and is not re-derived here: a `PerformanceObserver` for `layout-shift`
  installed as an **init script** before the document exists, accumulating `entry.value` only where
  `hadRecentInput` is false; `visit()` then `settle()`; `performance.now()` read as the mark;
  and the sum of entries after the mark asserted to be `0`. The budget is zero **after the settle
  mark**, never from navigation.
  This stage is the plan's earliest wave and therefore **builds the seam**, in
  `e2e/administration.visual.spec.ts` and nowhere else — it is a few lines of init script in this
  plan's own spec file, not a change to `e2e/helpers/shoot.ts`, so it cannot disturb another plan's
  measurement. What it exercises after the mark is the trail's own risk: applying a filter and paging
  Older must not move the table under the reader's cursor, and the skeleton must occupy the row height
  the real rows land in. Reported per engine, with the WebKit reading stated as a skip because
  `layout-shift` is a Chromium-only entry type and `observe()` fails silently there.
- **Comparison budget.** `maxDiffPixelRatio` is not raised.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged, as listed in `10-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the trail, the filters, the sheet and the paging:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states —
      including both paging buttons at their ends of the range and every filter control.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2`, and the unfiltered empty state reads as "nothing has happened yet"
      rather than as a failure.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive at 360px, 1280px and 2560px, where the 360px layout is a designed card list and not
      a horizontally scrolled desktop table.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes including the monospace action and address text.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every
      timestamp and count.

### Blockers

None that stop the stage. Two dependencies, one requirement on another plan, and one inherited
harness precondition:

- `00-S3` (`00-foundations.md`, wave 0) supplies `trail()` and the first production call sites. Wave
  0 closes before wave 1 opens.
- The 180-day sweep needs `pruneAuditLog` called from the weekly retention cron. The cron trigger is
  already declared, but its handler lives in `src/server/worker.ts`, one of the six shared paths, so
  this is a **foundations requirement** on `00-foundations.md` and not a file this stage touches.
  Until it lands the retention window is policy without enforcement, which is a stated gap rather
  than a hidden one.
- **Inherited harness precondition — `12-verification-protocol.md` §7.1, and it is blocking for this
  stage's baselines rather than for its code.** That section names `/admin` explicitly: it is one of
  two screens printing a `formatRelative` string, and the instants those strings are derived from are
  seeded from a single `new Date()` in `applySeed()` (`src/routes/api/dev/-seed/apply.ts:232`), so
  they move on every re-seed. Neither pin reaches them — `x-pt-server-today` answers a **calendar
  day** through `serverToday()` while these are epoch-millisecond columns, and `FROZEN_NOW` holds an
  in-page `Date.now()`. Confirmed still true at HEAD: `src/routes/_app/admin.tsx:303` renders
  `formatRelative(row.createdAt, now)` against `now = Date.now()` taken at `:67`, and `/admin`
  appears in no route table under `e2e/` today, so nothing has ever baselined it. §7.1's status is
  **deferred, blocking for the first stage that baselines `/admin`** — which this plan is. Designing
  the seam is not this stage's side effect to take on; what this stage owes is to name it, and to keep
  the unpinned string out of the comparison the way §5 permits and only that way: through the
  `relativeTime` declaration and the `RELATIVE_TIME_SITES` entry `10-S2` adds, which pins the
  string first so the excluded rectangle is constant on every run. A widened mask or a raised
  `maxDiffPixelRatio` is not the remedy and is forbidden.
- **Harness requirement — a member-role fixture that can sign in.** The locked state this stage
  keeps, and that `10-S3` mounts in the console layout, cannot be photographed by anyone: the seeder
  creates the four collaborators without a credential account on purpose
  (`src/routes/api/dev/-seed/bootstrap.ts:11-15`) and the suite caches one session, the owner's
  (`e2e/auth.setup.ts`). One seeded person with a signable password and the `member` role, plus a
  second cached storage state, would make the state photographable in this plan and in every other
  plan that hides an affordance behind a role. Both files belong to the seeder and the harness, which
  this plan does not own, so it is recorded here and carried out of the file as a contract extension
  rather than reached into. It blocks a frame, not the stage: the state's behaviour is asserted by
  the repository and component tests named under **Verification**.
- No package outside the `docs/SPEC.md` §3 pinned set, no binding added to `wrangler.jsonc`, no
  third-party service.

## Stage 10-S3 — The console becomes a place with rooms, and a way back into them

### Stage id

`10-S3` · Wave 4 · effort **M**. The tabbed shell and the entry point, over surfaces two earlier
stages already built.

### Reference rows

- `ADM-01` partial → **done**.

Sourced from `wiki: Admin-Panel-Overview` for the behaviour set — one operator surface that gathers
workspace administration into a tab strip, with the entry point absent for anyone who cannot use it
rather than a locked page presented to everyone.

**The admin surface already ships, and this stage does not rebuild it.** Measured:
`src/routes/_app/admin.tsx` is a working read-only console gated at `:69` on
`shell.session.user.isAdmin`, rendering a page header, an outstanding-invitations alert, four stat
cards, a quotas panel with tone steps at 70% and 90%, a members table, an activity list and a
busiest-actions panel, all from `loadAdmin`. The four stat cards, the quotas panel and the
busiest-actions panel are kept exactly as they are and moved, not rewritten.

**What is actually missing, stated as three things and no more:**

1. **A URL per room.** The console is one page. An administrator cannot link a colleague to the
   audit trail, cannot bookmark the member list, and the back button does not step between them.
2. **A home for the surfaces the other stages ship.** `10-S1` and `10-S2` mounted their panels into
   the single page because the tab shell does not exist before this wave. Each is a component under
   `src/components/administration/`, so this stage moves an import and not a screen.
3. **A way in from where an administrator already is.** The only path into the console is the
   account-menu item at `src/components/layout/user-menu.tsx:95-102`. The settings section index
   (`src/routes/_app/-ui/settings-nav.tsx:42-79`) lists six sections and none of them is the
   console, so the person managing workspace defaults has no route to the workspace's
   administration.

**One deviation from the sourced behaviour, argued rather than slipped in.** Upstream a non-admin
sees no entry point and the page does not exist for them. Here the entry point is likewise absent
from every navigation surface for a non-admin — that part matches — but a direct hit on `/admin` or
on a tab URL keeps the explanatory locked state that `src/routes/_app/admin.tsx:69-87` already
renders, rather than becoming a bare not-found. The reason is that tab URLs are linkable by design
after this stage, so the most likely visitor to a console URL without the role is a member an
administrator just sent a link to, and "ask an owner to change your role" is the answer they need.

Rows unblocked: `ADM-03` (`10-S4`, wave 5), which mounts a tab into the shell this stage builds.

### Owned paths

- `src/routes/_app/admin.tsx` — delete. Replaced by the route folder below; the same URL, `/admin`,
  is served by the new layout plus its index child, which is the shape
  `src/routes/_app/settings/route.tsx` and `settings/index.tsx` already use.
- `src/routes/_app/admin/route.tsx` — new. The console layout: page header, admin gate, tab strip,
  `<Outlet />`. The gate renders `10-S2`'s `console-locked.tsx` rather than re-writing the markup a
  third time.
- `src/routes/_app/admin/index.tsx` — new. The Overview tab: the four stat cards and the quotas
  panel, moved unchanged.
- `src/routes/_app/admin/members.tsx` — new. Mounts `10-S1`'s two panels.
- `src/routes/_app/admin/audit.tsx` — new. Mounts `10-S2`'s trail.
- `src/routes/_app/admin/-ui/console-tabs.tsx` — new. The declarative tab list and the strip that
  renders it. `10-S4` (wave 5) adds its own entry to this file; the two stages are in different
  waves, so the file has one writer at a time.
- `src/routes/_app/admin/-ui/__tests__/console-tabs.test.tsx` — new. The active-tab matcher's test,
  named under **Verification**.
- `src/routes/_app/-server/overview.ts` — edit, and the edit is confined to `loadAdmin`
  (`:430-451`): the audit page it fetches for a stat count is replaced by `countAuditEntries` from
  `10-S2`, because that card renders `data.audit.length` today and therefore stops counting at 25.
  **This file is touched by four other stages, in other waves, and every one of them is named here as
  the shared-path protocol requires:** `00-foundations.md` `00-S5` (wave 0), `01-trips-core.md`
  `01-S1` (wave 1), `09-account-and-settings.md` `09-S7` (wave 2, which exposes the notification
  answer and its actionable list) and `01-trips-core.md` `01-S7` (wave 5). This stage is wave 4 and
  shares the file with none of them concurrently; the check output at the foot of this file is the
  measurement, and `09-S7` names `10-S3` reciprocally at `docs/plans/09-account-and-settings.md:1852-1855`.
- `src/routes/_app/-ui/settings-nav.tsx` — edit. One conditional entry, described under **UI**.
  **This file is touched by two other plans, one in an earlier wave and one in a later wave, and both
  are named here as the shared-path protocol requires:** `09-account-and-settings.md` `09-S8`
  (wave 3), which lands the responsive settings shell this stage's seventh entry sits inside, and
  `02-places-and-maps.md` `02-S10` (wave 5), which adds an entry of its own. This stage is wave 4, so
  the shell exists before the entry is added to it and the later entry is added after both; no two of
  the three ever run together. `09-account-and-settings.md` names `10-S3` reciprocally at
  `docs/plans/09-account-and-settings.md:2210-2212`.
- `e2e/administration.visual.spec.ts` — append. One `test.describe` and the three new routes added
  to `ADMINISTRATION_ROUTES`.
- `e2e/__screenshots__/administration.visual.spec.ts/` — append.

`src/routeTree.gen.ts` is **not** an owned path and is never hand-edited. `pnpm generate-routes` is a
step of this stage — see **UI** — and the regenerated tree travels in the diff, which is the one
mechanical exception `README.md` grants.

### Data and migration

**None.** This stage adds no table, no column, no index and no migration. It composes reads that
already exist and moves markup between files.

### Server (repo, server function, Zod)

- **Repository.** No new repository module and no new SQL. The one repository call this stage
  introduces to an existing function is `countAuditEntries` from `10-S2`
  (`src/server/repos/audit.ts`), which is tenant-scoped through `tenantFilter()` like every other
  read in that module.
- **Server function.** No new server function. `loadAdmin`
  (`src/routes/_app/-server/overview.ts:430`) is edited in place: it stops fetching a 25-row audit
  page for a count and reads the count instead, and it keeps every other field it returns, so the
  Overview tab's payload shape is unchanged apart from that one figure. `10-S1`'s
  `loadAdministration` and `10-S2`'s `loadAuditPage` become the loaders of the Members and Audit
  tabs respectively, unchanged.
- **Zod.** No new input. The tab routes take no search parameters and no path parameters.
- **Authorisation.** Unchanged and still not decided here. The console's admin gate is UX: it
  decides what to render, not what may be read. Every server function behind every tab builds its
  scope with `appScope()` and every repository it calls asserts its own role floor —
  `assertCanAdminister` today, the matrix's action key after `10-S4`. A tab route's `beforeLoad` is
  never a data boundary and this stage adds none.
- **Each tab's loader carries the conditional `10-S2` established, and for the same reason.** The
  repository refuses an administrator's read to a member, so a loader that fetches anyway turns the
  layout's locked state into three error panels. Every tab loader here is therefore
  `({ context }) => (context.shell.session.user.isAdmin ? load…() : null)`, reading the flag the
  `_app` route puts on the router context (`src/routes/_app/route.tsx:20-32`), and the layout renders
  `console-locked.tsx` — `10-S2`'s extraction of the markup that ships today — instead of the
  `<Outlet />` when the flag is false. Per the area brief this is a skip and not a second
  authorization path: each of those server functions stays reachable without its route, and calling
  one still ends in `ForbiddenError`.
- Nothing slow, nothing queued, nothing realtime.

### UI (route, components)

- **Routes.** `/admin` (index), `/admin/members`, `/admin/audit`. `src/routes/_app/admin/route.tsx`
  is the layout for all three and holds the gate, so a non-admin reaching any tab URL gets one
  explanatory surface rather than three. All are the default SSR: they are behind the app shell,
  read D1 through server functions, and have nothing that needs to be client-only.
  **`pnpm generate-routes` is a step of this stage**, run after the four route files land and before
  the gate; the generated tree is committed with the diff and never edited by hand.
- **The tab strip.** `Tabs` with `TabsList` and `TabsTrigger` from `src/components/ui/tabs.tsx`, in
  the `underline` variant, with each trigger rendered `asChild` around a router `Link` —
  `TabsTriggerProps` extends Radix's own trigger props (`src/components/ui/tabs.tsx:157-163`), so
  `asChild` is available and no second tab implementation is written. The active value is derived
  from the matched pathname, so the strip is a view of the URL rather than a second source of truth.
  Tabs are declared once in `console-tabs.tsx` as `{ to, label, icon }`, which is what lets `10-S4`
  add one line rather than edit a strip.

  **One constraint on that composition, measured rather than assumed, because getting it wrong costs
  a run.** `asChild` puts a Radix `Slot` in the trigger's place and a `Slot` accepts exactly one
  child. `TabsTrigger` renders up to three — an icon wrapper when `icon` is passed, the children, and
  a badge wrapper when `badge` is passed (`src/components/ui/tabs.tsx:197-206`). So the tab's glyph
  is rendered **inside the `Link`**, next to the label, and the trigger's own `icon` prop is left
  unset; passing both `asChild` and `icon` hands `Slot` two children and throws at render. The
  declaration's `icon` field is therefore consumed by `console-tabs.tsx` when it builds the `Link`'s
  contents, not forwarded to `TabsTrigger`. `badge` is unused by this plan for the same reason;
  a stage that later wants a count on a tab puts it inside the `Link` too.

- **The entry point.** `src/routes/_app/-ui/settings-nav.tsx` gains a seventh entry, "Workspace
  admin", with a `ShieldCheck` glyph and the caption "Members, activity and permissions", rendered
  only when the session's admin flag is true — the same flag `src/routes/_app/-server/shell.ts:129`
  computes as `roleSatisfies(role, 'admin')`, so there is no new plumbing and no second notion of who
  is an admin. It sits below a `Separator` at the end of the list, because it leaves the settings
  area rather than being a section of it. For a non-admin the entry is absent, not disabled.

  **Two things about that file that decide how the entry is written, both measured, because the
  obvious approach reaches outside this stage's ownership.**

  1. `SettingsNav()` takes **no props** (`src/routes/_app/-ui/settings-nav.tsx:110`) and its only
     caller is `src/routes/_app/settings/route.tsx:39`, which is **not** an owned path of this stage
     and must not be edited to thread a flag through. The flag is therefore read inside
     `settings-nav.tsx` with `useRouteContext({ from: '/_app' })`, which reaches the `shell` the
     `_app` route puts on the context in its own `beforeLoad` (`src/routes/_app/route.tsx:20-32`) —
     the same accessor `AppShell` uses at `:43`. The component keeps its zero-prop signature and the
     caller stays untouched.
  2. `SettingsSectionLink['to']` is a closed union of the six settings paths
     (`src/routes/_app/-ui/settings-nav.tsx:28-34`), deliberately so that each entry type-checks
     against the generated route tree rather than against a string. Adding the console means widening
     that union with `'/admin'`, which is a one-line change in the same file and is only valid after
     `pnpm generate-routes` has published the route. The union is kept closed; it is not relaxed to
     `string`.

  The gate this entry reads is UX and nothing more: it decides what to render. What may actually be
  read behind the console is decided in the repository, per `10-S4`.

- **Components reused:** `Tabs`, `TabsList`, `TabsTrigger`, `Card`, `StatCard`, `Progress`, `Alert`,
  `Button`, `Separator`, `SectionLabel`, `EmptyState`, `Skeleton`, `ScrollArea`, plus
  `PageHeader`, `AppFrame` and `AppSections` from `src/components/layout`, and from
  `src/components/administration/` the two panels `10-S1` built, the trail `10-S2` built and
  `console-locked.tsx`. No new primitive and no new product component.
- **States.**
  - _Tab content pending:_ each tab route ships its own `pendingComponent` reusing the existing
    `HeaderSkeleton`, `StatsSkeleton` and `RowsSkeleton` scaffolding from
    `src/routes/_app/-ui/scaffold.tsx`, on `--color-surface-2`, so the
    strip stays put and only the panel below it changes — that is the whole point of moving the gate
    and the header into the layout.
  - _Tab content error:_ each tab route ships an `errorComponent` using `ErrorPanel`
    (`src/components/layout/error-state.tsx`) with a title
    naming that tab, drawn on `--color-surface-2`, so a failing audit query does not blank the
    console.
  - _Not an admin:_ the layout's designed locked state, `console-locked.tsx`, which is the markup
    shipping today at `src/routes/_app/admin.tsx:69-87` extracted by `10-S2` and mounted here
    unchanged — an `EmptyState` with a `ShieldCheck` glyph, the reason, and a link back to the
    dashboard. One surface for all four tab URLs, because the layout holds it.
  - _Empty:_ the console itself has no list of its own; the lists belong to the tabs and carry the
    empty states their stages designed.
- **Responsive.** At 360px the tab strip is a horizontally scrollable row with momentum and no
  scrollbar, each tab at least 44px tall, and the page header collapses to title plus one action.
  At 1280px the strip sits under the header at full width. At 2560px the console holds the content
  measure the rest of the app uses; the tabs do not spread to the window's edges.
- **Motion.** The active underline scales from its centre — transform only, so nothing in the row is
  laid out twice — which is the behaviour `TabsTrigger` already implements at
  `src/components/ui/tabs.tsx:185-187` with the `duration-base` and `ease-out-quint` utilities.
  Measured, and stated because it is the kind of thing a plan gets wrong from memory: **there is no
  `--duration-base` token.** `duration-base` is a project `@utility`
  (`src/styles/styles.css:688-690`) that resolves to `var(--duration)`, the 220ms token declared at
  `src/styles/tokens.css:696`; the siblings are `duration-fast` → `--duration-fast` (150ms) and
  `duration-slow` → `--duration-slow` (320ms). This stage adds no motion of its own to the strip.
  Tab content crossfades over `--duration-fast`. Reduced motion removes both.
- **Keyboard and a11y.** The strip is a `nav` with an accessible name; because the triggers are
  links, Tab moves through them and Return follows, which is the correct model for tabs that are
  routes. The active tab carries `aria-current="page"`. Focus lands in the tab panel after
  navigation, not back at the top of the document.
- **Tokens.** No new token.

### Quota

**This stage creates no countable row.** It adds no write path of any kind: every tab is a
composition of reads that already exist. Nothing is added to `resolveLimits()`, nothing to
`PLAN_QUOTAS`, and no case to `src/server/billing/__tests__/limits.test.ts`.

### Tenant isolation test

**No new case, and the reason is that this stage adds no repository function.** Every read behind the
three tabs is covered by an existing block: `10-S1`'s for the member and invitation reads, `10-S2`'s
for the audit reads and `countAuditEntries`, and the pre-existing cases for `getOrganization`,
`resolveQuotas` and the dashboard summary that `loadAdmin` composes. A stage that adds a repository
function and no isolation case is not done; this stage adds none, and says so rather than adding a
case that would restate another stage's.

### Verification

- **Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. The
  route regeneration runs before the gate: `pnpm generate-routes`.
- **Unit test — `src/routes/_app/admin/-ui/__tests__/console-tabs.test.tsx`,** listed under **Owned
  paths**. The strip has exactly one piece of logic worth a test and the test covers that and nothing
  else: `activeTabFor(pathname)`, a pure function exported from `console-tabs.tsx` alongside the
  declarative list, resolves `/admin` to the Overview tab, `/admin/members` and `/admin/audit` to
  their own, an unknown `/admin/…` path to Overview rather than to nothing, and a deeper path such as
  `/admin/audit` against a hypothetical `/admin/audit/…` child to the deepest match. It is a pure
  function precisely so it can be tested without rendering a router. The declarative tab list beside
  it is data and is not asserted key by key; a test that restates a literal has tested the test.
- **Browser evidence.** Three routes — `/admin`, `/admin/members`, `/admin/audit` — at 360px, 1280px
  and 2560px, in light and dark. That is eighteen frames, and the stage owes them because it ships
  three surfaces. Two declared non-resting states, each with its selector verified against a running
  server by asserting a count of exactly one in this stage's spec: `[data-part="console-tabs"]` with
  the strip scrolled to its end at 360px, and `[data-part="console-tab-panel"]` after a tab
  navigation, which is what the layout-shift reading below is taken against. The locked state is the
  third state this stage renders and it is **not** in that list: no member-role account can sign in
  against the current fixture (`src/routes/api/dev/-seed/bootstrap.ts:11-15`), so it is covered by
  `10-S2`'s component test and carried as the harness requirement that stage records under
  **Blockers**. Declaring a capture the harness cannot take would make the run look greener than it
  is.

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/administration.visual.spec.ts

  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/admin/members" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/10-S3" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth
  ```

- **Route declaration.** The three routes join `ADMINISTRATION_ROUTES` in
  `e2e/administration.visual.spec.ts`, each with its `ready` selector and its `relativeTime` flag —
  true for Overview and Audit, false for Members until an expiry string is on screen, in which case
  it is true. `auditServerClock(page, ADMINISTRATION_ROUTES)` already runs over the table `10-S2`
  declared and now covers all three, and it fails in both directions, so a wrong flag is reported
  rather than assumed.
- **Console must be silent.** `watchConsole(page, route)` attached before navigation in every test,
  `fatal` asserted empty at the end of each. A React hydration report is not tolerable and cannot be
  tolerated: the route split is exactly the kind of change that produces one.
- **Layout shift after paint**, which `12-verification-protocol.md` §6 requires of every stage
  alongside the console verdict, and which nothing in `e2e/` or `capture.mjs` measures today. The
  shape is fixed there and is not re-derived here: a `PerformanceObserver` for `layout-shift`
  installed as an **init script** before the document exists, accumulating `entry.value` only where
  `hadRecentInput` is false; `visit()` then `settle()`; `performance.now()` read as the mark;
  and the sum of entries after the mark asserted to be `0`. The budget is zero **after the settle
  mark**, never from navigation.
  It matters more here than anywhere else in the plan: this stage splits one route into four, and the
  tab strip is the element most able to move a panel after paint. What it exercises after the mark is
  a navigation between two tabs — the strip must not shift when the panel below it changes, which is
  the whole reason the gate and the page header moved into the layout. The seam is `10-S2`'s, in this
  plan's shared spec file. Reported per engine, WebKit stated as a skip.
- **Comparison budget.** `maxDiffPixelRatio` is not raised. The route split moves pixels; the
  baselines for `/admin` are re-recorded with `--update-snapshots` **as a stated decision**, because
  the URL that produced them now serves a different composition, and the re-recorded frames travel
  in this stage's diff for an auditor to read.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged, as listed in `10-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the layout, the strip, the three tabs and the settings
entry:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states —
      including every tab link and the new settings-nav entry.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2`; the console's own pending and error surfaces keep the strip visible.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive at 360px, 1280px and 2560px, where the 360px strip is a designed scrolling row with
      44px targets and not a squeezed desktop tab bar.
- [ ] Keyboard navigable end to end, sensible focus order, `aria-current` on the active tab,
      accessible names, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every stat
      numeral moved into the Overview tab.

### Blockers

None that stop the stage. Two ordering facts, one file-sharing note and one inherited harness
precondition:

- `10-S1` (wave 3) and `10-S2` (wave 1) must have landed, because this stage mounts their components
  rather than writing them. Both are in earlier waves, which is what the wave order guarantees.
- `src/routes/_app/-server/overview.ts` is shared with `00-S5` (wave 0), `01-S1` (wave 1), `09-S7`
  (wave 2) and `01-S7` (wave 5), and `src/routes/_app/-ui/settings-nav.tsx` with `09-S8` (wave 3) and
  `02-S10` (wave 5) — every one of them in a wave other than this stage's wave 4. The check at the foot of this file is
  the measurement, not a reading of the sibling plans, and this stage's edit to `overview.ts` is
  confined to the one stat count inside `loadAdmin`.
- **Inherited harness precondition — `12-verification-protocol.md` §7.1, and it is blocking for this
  stage's baselines rather than for its code.** That section names `/admin` explicitly: it is one of
  two screens printing a `formatRelative` string, and the instants those strings are derived from are
  seeded from a single `new Date()` in `applySeed()` (`src/routes/api/dev/-seed/apply.ts:232`), so
  they move on every re-seed. Neither pin reaches them — `x-pt-server-today` answers a **calendar
  day** through `serverToday()` while these are epoch-millisecond columns, and `FROZEN_NOW` holds an
  in-page `Date.now()`. Confirmed still true at HEAD: `src/routes/_app/admin.tsx:303` renders
  `formatRelative(row.createdAt, now)` against `now = Date.now()` taken at `:67`, and `/admin`
  appears in no route table under `e2e/` today, so nothing has ever baselined it. §7.1's status is
  **deferred, blocking for the first stage that baselines `/admin`** — which this plan is. Designing
  the seam is not this stage's side effect to take on; what this stage owes is to name it, and to keep
  the unpinned string out of the comparison the way §5 permits and only that way: through the
  `relativeTime` declaration and the `RELATIVE_TIME_SITES` entry `10-S2` adds, which pins the
  string first so the excluded rectangle is constant on every run. A widened mask or a raised
  `maxDiffPixelRatio` is not the remedy and is forbidden.
- No package outside the `docs/SPEC.md` §3 pinned set, no binding added to `wrangler.jsonc`, no
  third-party service.

## Stage 10-S4 — One place that decides what a role may do, and one place that enforces it

### Stage id

`10-S4` · Wave 5 · effort **L**. The action catalogue, the per-workspace overrides, the enforcement
primitive and the screen that edits it.

### Reference rows

- `ADM-03` absent → **done**.

Sourced from `wiki: Role-and-Action-Permission-Matrix` for the behaviour set — a fixed catalogue of
named actions, a minimum role per action, a visible marker on any row a workspace has changed, one
save for the whole grid, and a reset to defaults that asks twice.

**Enforcement sits at the repository boundary, beside the tenant scope and the quota check, and
nowhere else.** This is the single most important sentence in this stage, because a permission
matrix is the one feature in this plan that can accidentally become a second authorization system.
Measured, the repository boundary is already where both of the other two invariants live:
`tenantFilter()` in `src/server/repos/base.ts` makes `WHERE organization_id = ?` inexpressible to
forget, and `assertQuota(scope, metric, current)` is called inside the repository before the write in
all eight places a plan can run out of something. Authorisation joins them there:
`assertAction(scope, actionKey)` is called inside the repository function, before the query, in the
same three-line preamble.

**A second authorization path is forbidden, explicitly and by name.**

- **No route decides.** A `beforeLoad`, a loader guard or a `redirect` is UX. A server function is a
  public endpoint reachable without the route that renders its UI, so a route-level check protects
  nothing, and this stage adds none. The one thing a loader in this plan does — skipping a call it
  knows the repository will refuse, so the reader gets the designed locked state instead of an error
  panel — is not an exception to that: it changes what is rendered, never what is permitted, the
  server function stays reachable without its route, and the call still ends in `ForbiddenError` if
  it is made. The area brief states the rule; `10-S2` and `10-S3` are the two stages that apply it.
- **No component decides.** Nothing under `src/components/**` may import from `server/`, and a
  component that hides a control has hidden a control, not prevented a write.
- **No server function decides.** A server function builds a scope with `appScope()` and calls a
  repository. It may not branch on `scope.ctx.role`, and it may not pre-check an action to produce a
  nicer error: the repository's `ForbiddenError` is the error, mapped for display.
- **Role reads in the UI are presentation, and each one has a server-side counterpart.** Two exist
  today. `shell.session.user.isAdmin` (`src/routes/_app/-server/shell.ts:129`) hides the console
  entry and renders the console's locked state; its counterpart is the action key each administration
  repository asserts. `shell.role !== 'member'`
  (`src/routes/_app/trips/$tripId/collab.tsx:86`) hides a moderation affordance; its counterpart is
  the `collab.moderate` key, whose assertion belongs to the collaboration repository that
  `07-collaboration-and-sharing.md` owns and is stated to that plan rather than reached into here.
- **`assertCanAdminister` is not extended into a parallel mechanism; most of its call sites move.**
  It is the only role assertion with callers in the repository layer today, and all six of them are
  in `src/server/repos/members.ts` (`:81`, `:153`, `:176`, `:190`, `:261`, `:303`). Two more arrive
  in that same file before this stage runs, and the count has to be taken at wave 5 rather than at
  HEAD, because a stage that plans against the wrong number edits a line that is no longer the only
  one of its kind:

  | Call site in `members.ts` at wave 5 | Arrives with                          | Wave | This stage     |
  | ----------------------------------- | ------------------------------------- | ---- | -------------- |
  | `updateOrganization` (`:81`)        | on disk at HEAD                       | —    | moves          |
  | `addMember` (`:153`)                | on disk at HEAD                       | —    | moves          |
  | `changeMemberRole` (`:176`)         | on disk at HEAD                       | —    | moves          |
  | `removeMember` (`:190`)             | on disk at HEAD                       | —    | moves          |
  | `createInvitation` (`:261`)         | on disk at HEAD                       | —    | moves          |
  | `cancelInvitation` (`:303`)         | on disk at HEAD                       | —    | moves          |
  | `refreshInvitationExpiry`           | `10-S1`, this plan                    | 3    | moves          |
  | `deleteWorkspace`                   | `09-S3`, `09-account-and-settings.md` | 1    | **left alone** |

  Eight sites, seven moved. Each of the seven governs an action the catalogue sells, so each becomes
  `await assertAction(scope, '<key>')` — that is this stage's whole edit to `members.ts`, listed in
  **Owned paths** and mapped key by key under **Server**.

  **The eighth is `deleteWorkspace`, and it stays on `assertCanAdminister` for the same reason the
  audit reads do.** Destroying the workspace is not an administrable setting: a floor a workspace can
  lower is a floor an attacker inside the workspace can lower, and there is no undo behind this one —
  the `organization` row cascades all fifty-seven domain tables. `workspace.delete` is therefore not
  one of the catalogue's sixteen keys, exactly as `audit.read` is not, and the function keeps the
  fixed assertion `09-S3` wrote. Two consequences are stated rather than assumed:
  - **After this stage `assertCanAdminister` has five callers, in two modules** — the four audit
    reads `10-S2` added to `src/server/repos/audit.ts`, and `deleteWorkspace` in
    `src/server/repos/members.ts`. It is not left as a wrapper nothing needs, and this plan never
    claims it is down to four.
  - **One discrepancy inside `09-S3` is named and not repaired here.** That stage's tenant-isolation
    case reads "a scope whose role is not `owner` is refused by `assertCanAdminister`"
    (`docs/plans/09-account-and-settings.md`), while the helper admits `admin` as well
    (`src/server/repos/context.ts:136-140`). Whether workspace deletion is owner-only or
    administrator-level is a decision belonging to the stage that mints the function, in wave 1, not
    to a wave-5 edit from another plan reaching into a line it did not write. It is carried out of
    this file as a cross-plan note.

  So the boundary carries two assertions and one rule for choosing between them — an action in the
  catalogue is asserted with `assertAction`, an action deliberately outside it with
  `assertCanAdminister` — and one implementation of the role comparison underneath both, which is
  `hasAtLeastRole` (`src/server/repos/context.ts:117`). What there is not, anywhere, is a second
  place that decides.

Rows unblocked: none. This is the last stage in the plan.

### Owned paths

- `src/lib/permissions.ts` — new. The action catalogue: sixteen keys, their labels, their grouping
  and their default minimum role. Isomorphic and pure data — it imports nothing from `server/`, so
  the matrix screen can render labels without a round trip.
- `src/lib/__tests__/permissions.test.ts` — new.
- `src/server/repos/permissions.ts` — new. The repository module for the stored overrides and the
  enforcement primitive. It imports `hasAtLeastRole` and `ForbiddenError` from
  `src/server/repos/context.ts` and adds no second role comparison. **`context.ts` is deliberately
  not an owned path:** `assertCanAdminister` cannot resolve a stored matrix without becoming
  asynchronous and taking a scope rather than a context, which would change the signature of the one
  helper the whole repository layer shares. Moving seven call sites is a smaller and more honest
  change than re-typing a shared helper, and it leaves that helper with real callers rather than as
  a wrapper nothing needs.
- `src/server/repos/members.ts` — edit, and the edit is seven single-line call-site changes and
  nothing else: each `assertCanAdminister(scope.ctx, …)` becomes `await assertAction(scope, '<key>')`
  per the mapping table under **Server**. Measured, because whether this is a one-line change or a
  refactor depends on it: every function holding one of those calls is already `async` and already
  returns a promise — `updateOrganization` (`:77`), `addMember` (`:152`), `changeMemberRole` (`:171`),
  `removeMember` (`:187`), `createInvitation` (`:257`), `cancelInvitation` (`:299`) — so no signature
  changes, no caller changes, and no route, server function or component is touched. The seventh site
  is inside `refreshInvitationExpiry`, which `10-S1` adds as an `async` function in wave 3. **An
  eighth call site exists in this file at wave 5 and is deliberately not touched:**
  `deleteWorkspace`, added by `09-S3` in wave 1, keeps its `assertCanAdminister` because workspace
  deletion is outside the catalogue — the reasoning is under **Server**. So the diff to this file is
  seven lines changed, one line of the same shape left exactly as it stands, and no line added.
  **This file is touched by two other stages, both in earlier waves, and both are named here as the
  shared-path protocol requires:** `10-S1` (this plan, wave 3), which adds three functions and one
  role-ceiling line inside each of `addMember`, `changeMemberRole` and `createInvitation`, and
  `09-account-and-settings.md` `09-S3` (wave 1), which appends `deleteWorkspace`. This stage is wave
  5 and therefore the last of the three writers. The three writes are disjoint line by line:
  `09-S3`'s is a new function, `10-S1`'s guards sit inside the function bodies **below** the
  assertion line, and this stage's seven changes are the assertion lines themselves — so each writer
  meets what the previous one left and none of them re-flows another's hunk.
- `src/server/repos/__tests__/permissions.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `src/routes/_app/admin/-server/permissions.ts` — new. The stage's two server functions.
- `src/routes/_app/admin/permissions.tsx` — new. The route.
- `src/routes/_app/admin/-ui/console-tabs.tsx` — edit. One entry added to the declarative tab list
  `10-S3` created in wave 4.
- `src/components/administration/permission-matrix.tsx` — new. The grid and its save bar.
- `src/components/administration/__tests__/permission-matrix.test.tsx` — new.
- `e2e/administration.visual.spec.ts` — append. One `test.describe` and one route added to
  `ADMINISTRATION_ROUTES`.
- `e2e/__screenshots__/administration.visual.spec.ts/` — append.

`src/routeTree.gen.ts` is **not** an owned path. `pnpm generate-routes` is a step of this stage
because it adds a route file, and the regenerated tree travels in the diff.

### Data and migration

One additive column is needed, and **this stage does not write it**. It is stated here so it becomes
a wave-0 requirement in `00-foundations.md`, which owns `src/server/db/schema.ts`:

- **Table:** `organization_settings`, which exists (`src/server/db/schema.ts:1804-1825`), is
  tenant-scoped by `organization_id` with a unique index on it, and already holds one singleton row
  per workspace created on demand by `ensureOrganizationSettings`.
- **Column:** `permissions`, `text('permissions', { mode: 'json' })` typed as `JsonRecord`,
  **nullable, no default**. Additive only: nothing is dropped, renamed or narrowed, and a rollback
  keeps working because a Worker that does not know the column simply never reads it.
- **Meaning of NULL:** the workspace has never customised the matrix, and every action resolves to
  its catalogue default. Absence is the default rather than a written copy of it, so a later change
  to a default reaches every workspace that never disagreed with it.
- **No CHECK constraint,** because the value is a JSON record rather than an enum column; validity is
  a Zod concern at both the write and the read, and an unrecognised key is ignored rather than
  fatal — see the forward-compatibility test below.
- **No new index.** The row is always reached by the existing `organization_id` unique index.
- **Migration:** the name is whatever `pnpm db:generate` produces in `00-foundations.md`'s wave-0
  series. **It backfills nothing.**

**Why not the column that already exists.** `organization_settings.features` is a `JsonRecord` too,
and it would fit mechanically. It is not used, because it is the workspace feature-flag record that
`getEffectiveSettings` returns to every screen (`src/server/repos/settings.ts:284`), and putting two
vocabularies in one flat record makes an action key and a feature flag collide on a name with no way
to tell which one an entry was.

### Server (repo, server function, Zod)

- **The catalogue — `src/lib/permissions.ts`.** Sixteen action keys, each with a label, a one-line
  description, a group and a default minimum role. They name actions the product actually performs:
  `trip.create`, `trip.edit`, `trip.delete`, `trip.archive`, `place.edit`, `booking.edit`,
  `expense.edit`, `list.edit`, `file.upload`, `file.delete`, `share.create`, `collab.moderate`,
  `member.invite`, `member.role_change`, `member.remove`, `workspace.settings`. Keys are lowercase
  and dotted, entity first, the same shape the audit action regex enforces, so an action and its
  audit entry read alike. The module is pure data plus two pure functions —
  `defaultMinimumRole(key)` and `mergeOverrides(defaults, stored)` — and imports nothing from
  `server/`.
- **The sixteen defaults are fixed here, and every one reproduces what the product does today**, so
  installing the matrix changes no workspace's behaviour until an administrator edits it. They are
  measured off HEAD rather than chosen, which is also what makes the "unset column" test case
  meaningful:

  | Default  | Keys                                                                                                                                                               | Why that is today's behaviour                                                                                                                                                                                                                                                                                         |
  | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `member` | `trip.create`, `trip.edit`, `trip.delete`, `trip.archive`, `place.edit`, `booking.edit`, `expense.edit`, `list.edit`, `file.upload`, `file.delete`, `share.create` | No role gate stands on any of these eleven paths. Outside `src/server/repos/context.ts` itself, the only module calling any of its three role helpers is `src/server/repos/members.ts`, and `RequireOrgOptions.role` (`src/server/auth/tenant.ts:108-110`) defaults to `member` with no product call site raising it. |
  | `admin`  | `collab.moderate`                                                                                                                                                  | The affordance is already hidden from members, by `shell.role !== 'member'` at `src/routes/_app/trips/$tripId/collab.tsx:86`. The key is the server-side counterpart that check has never had.                                                                                                                        |
  | `admin`  | `member.invite`, `member.role_change`, `member.remove`, `workspace.settings`                                                                                       | The six `assertCanAdminister` call sites in `members.ts` map onto these four keys, and that helper floors at `admin` (`src/server/repos/context.ts:136-140`).                                                                                                                                                         |

  A default is a starting floor and not a fixed point: any of the sixteen may be raised as far as
  `owner`, and any except the three the invariants below pin may be lowered as far as `member`.

- **Repository — `src/server/repos/permissions.ts`.** All SQL for this stage lives here. It reads
  and writes exactly one column of one row, and it reaches that row only through
  `organizationSettingsRepository` and `ensureOrganizationSettings` from `./settings`, so there is
  one place that knows how the settings row is scoped and created and this module is not a second
  data path onto the table. Every read and write therefore carries
  `organization_id = <scope>` as its leading predicate through `tenantFilter()`.
  - `getPermissionMatrix(scope)` — the effective matrix: catalogue defaults with the stored
    overrides merged on top, plus a `customised` flag per row for the badge.
  - `savePermissionMatrix(scope, input)` — validates, writes the whole record in one update, and
    records `permissions.updated` through `trail()`. Behind `assertAction(scope, 'workspace.settings')`.
  - `resetPermissionMatrix(scope)` — writes NULL, records `permissions.reset`. Same floor.
  - `assertAction(scope, actionKey)` — resolves the workspace's floor for the key and raises
    `ForbiddenError(actionKey, allowedRoles)` when `hasAtLeastRole` (`context.ts:117`) is false. It
    is `async`, because resolving a floor reads a row. This is the enforcement primitive, and it is
    the only one.
- **The seven call sites this stage moves, key by key.** They are the whole of the edit to
  `src/server/repos/members.ts`:

  | Call site                                   | Today                                              | After                                             |
  | ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
  | `updateOrganization` (`:81`)                | `assertCanAdminister(ctx, 'rename the workspace')` | `await assertAction(scope, 'workspace.settings')` |
  | `addMember` (`:153`)                        | `assertCanAdminister(ctx, 'add a member')`         | `await assertAction(scope, 'member.invite')`      |
  | `changeMemberRole` (`:176`)                 | `assertCanAdminister(ctx, 'change a member role')` | `await assertAction(scope, 'member.role_change')` |
  | `removeMember` (`:190`)                     | `assertCanAdminister(ctx, 'remove a member')`      | `await assertAction(scope, 'member.remove')`      |
  | `createInvitation` (`:261`)                 | `assertCanAdminister(ctx, 'invite a member')`      | `await assertAction(scope, 'member.invite')`      |
  | `cancelInvitation` (`:303`)                 | `assertCanAdminister(ctx, 'cancel an invitation')` | `await assertAction(scope, 'member.invite')`      |
  | `refreshInvitationExpiry` (`10-S1`, wave 3) | `assertCanAdminister(ctx, …)`                      | `await assertAction(scope, 'member.invite')`      |

  `member.invite` governs the invitation lifecycle as a whole — mint, resend, revoke — because a role
  that may invite may undo its own mistake, and a workspace that had to grant "invite" and "revoke"
  separately would grant both anyway. It governs **which** roles may invite and never **at what role**
  they may seat someone: that second question is answered by `10-S1`'s ceiling, one line below each of
  these three assertions in the same functions, and the matrix has no row that can move it. `removeMember`'s self-removal branch (`:189-191`) is untouched
  and stays outside the matrix: leaving a workspace is not an administrative action and no floor may
  make it one.

- **The read is memoised per scope, and it needs no change to `base.ts`.** `assertAction` runs before
  writes that are already doing D1 work, but it must not add a round trip to each of them. The
  resolved matrix is held in a module-level `WeakMap<TenantScope, Promise<ResolvedMatrix>>` inside
  `src/server/repos/permissions.ts`, keyed by the scope object itself. That works, and works without
  touching a shared file, because `createScope()` returns a fresh frozen object per call
  (`src/server/repos/base.ts:51-53`) and `appScope()` builds exactly one of them per server-function
  invocation (`src/routes/_app/-server/context.ts`) — so the key's lifetime is the call's lifetime and
  the entry is collectable the moment the call ends. Stated precisely rather than generously: a
  request that builds two scopes reads the row twice, which is one extra indexed single-row read on a
  page that is already reading several. It is **not** cached in KV: a permission change that takes 60
  seconds to bind is a permission change that did not happen while the administrator was watching.
- **Server functions — `src/routes/_app/admin/-server/permissions.ts`,** both scoped through
  `appScope()`.
  - `loadPermissionMatrix` — `GET`. The effective matrix, the defaults, and which rows are
    customised.
  - `savePermissionMatrixFn` — `POST`. The whole grid in one call, because the row wants one save
    and not sixteen.
- **Zod v4.** `savePermissionMatrixFn` takes
  `z.strictObject({ entries: z.array(z.strictObject({ action: z.enum(ACTION_KEYS), minimumRole: z.enum(ORGANIZATION_ROLES) })).min(1).max(16) })`,
  with `z.enum(ACTION_KEYS)` closing the key space at the boundary. `resetPermissionMatrixFn` takes
  `z.strictObject({ confirm: z.literal(true, { error: 'Confirm the reset.' }) })`, which is the
  second of the two steps and is not a UI-only ceremony. Validation is shape; permission is the
  repository's.
- **Three invariants the matrix may not violate, enforced in the repository at write time, and one
  guard that is not the matrix's to lift.** Each of the three is refused inside
  `savePermissionMatrix` before the write, with a `RepositoryError` carrying a code the screen
  renders as a field error on the offending row.
  1. **`member.role_change` and `member.remove` may never fall below `admin`.** A workspace that
     lets a member change roles has let a member hand themselves every other floor in the catalogue.
  2. **`workspace.settings` may never fall below `admin`.** It is the key that governs
     `savePermissionMatrix` and `resetPermissionMatrix` themselves, so lowering it hands the whole
     grid — every other floor at once — to the role it was lowered to. A key that can lower its own
     floor is not a setting, it is a hole; this is the same reasoning that keeps `audit.read` and
     `workspace.delete` out of the catalogue entirely, applied to the one key that cannot be kept
     out because saving the matrix has to be governed by something.
  3. **No action may be raised above `owner`,** which would be an action nobody in the workspace can
     perform.

  **The fourth guard is the role ceiling, it lives outside the matrix, and it is what makes lowering
  `member.invite` safe.** `10-S1` (wave 3) makes `addMember`, `changeMemberRole` and
  `createInvitation` refuse a role that outranks `scope.ctx.role`. That comparison is between the
  actor and the role being granted; no floor can express it and therefore no floor can relax it, so
  it is not a row in this grid and cannot be edited from this screen. The two guards are independent
  and an escalation needs both to fail:

  | Workspace setting                        | What a `member` can then do      | What still stops the escalation                                |
  | ---------------------------------------- | -------------------------------- | -------------------------------------------------------------- |
  | `member.invite` at `admin` (default)     | nothing — `assertAction` refuses | the matrix floor                                               |
  | `member.invite` lowered to `member`      | mint an invitation at `member`   | `10-S1`'s ceiling refuses `admin` and `owner` on the same call |
  | `member.role_change` — cannot be lowered | —                                | invariant 1                                                    |
  | `workspace.settings` — cannot be lowered | —                                | invariant 2                                                    |

  So `member.invite` stays lowerable, which is the point of selling a matrix at all: a workspace that
  wants its members to bring colleagues in can have that, and the worst a member can do with it is
  seat another member. Without the ceiling this row would have to be locked at `admin` like
  invariant 1, and the plan would be shipping a grid whose most-wanted row is disabled. The
  permission tests name both halves of the pair, and neither is assumed from the other.

- **Audit.** `permissions.updated` carries the changed keys and their new floors in the entry's flat
  metadata record; `permissions.reset` carries the count of rows that were customised. Both go
  through `trail()` and neither can fail the write.
- Nothing slow, nothing queued, nothing realtime.

### UI (route, components)

- **Route.** `/admin/permissions`, at `src/routes/_app/admin/permissions.tsx`, a fourth child of the
  console layout `10-S3` built. Default SSR. **`pnpm generate-routes` is a step of this stage**, run
  after the route file lands and before the gate; the generated tree travels in the diff and is
  never hand-edited.
- **Components reused from `src/components/ui`:** `Card`, `RadioGroup` and its items, `SimpleSelect`,
  `Badge`, `Button`, `Alert`, `Dialog` with its header/body/footer, `Separator`, `SectionLabel`,
  `Skeleton`, `SkeletonText`, `EmptyState`, `Tooltip`, `ScrollArea`, and `toast` from `sonner`. One
  new product component, `permission-matrix.tsx`, which takes the matrix as a prop and calls back on
  change.
- **The grid.** One row per action, grouped by the catalogue's groups with a `SectionLabel` per
  group. Each row is a `RadioGroup` of three options — Member, Admin, Owner — with the action's
  label as the group's accessible name, so a screen reader hears "Delete a trip: Admin, selected"
  rather than a column position. A row whose value differs from its default carries a "Customised"
  `Badge`. The three rows invariant 1 and invariant 2 pin — `member.role_change`, `member.remove`
  and `workspace.settings` — render their Member option disabled with a `Tooltip` giving that row's
  own reason, rather than silently refusing on save. `member.invite` is **not** one of them and its
  Member option is live, with a hint under the row stating what a member may then do: invite at
  Member only, because nobody can grant a role above their own.
- **Batch save.** Changes are local until saved. A save bar appears at the foot of the panel when the
  grid is dirty — "3 changes", a Discard button, and a Save button with `loading` — pinned within the
  panel rather than floating over the page, so it never covers a row it is about to change. Saving
  disables the whole grid, not just the button.
- **Two-step reset.** "Reset to defaults" opens a `Dialog` that names how many rows will change and
  requires an explicit confirm; the confirm is not the dialog's default focus. The second step is
  also the `confirm: true` field the server function validates, so the two steps are one contract
  rather than a UI convention.
- **States.**
  - _Empty:_ the catalogue is fixed at sixteen rows and cannot be empty. The empty state that does
    exist belongs to the summary strip above the grid — "No customisations. Every action is at its
    default." — drawn on `--color-surface-2`, and it is what the reset returns the screen to.
  - _Skeleton:_ sixteen `SkeletonText` rows in the grid's own row rhythm, grouped as the real grid
    is, on `--color-surface-2`, so the group headings do not appear late.
  - _Error:_ an `Alert` with `tone="danger"` on `--color-surface-2` reading "The permission matrix
    did not load", with Retry re-invalidating the route. A save that is refused surfaces on the
    offending row as a field error and leaves the grid dirty, so nothing the administrator typed is
    lost.
- **Responsive.** At 360px the three-column grid becomes one card per action — label, description,
  and a `SimpleSelect` of the minimum role — which is a designed layout for the width and not a grid
  with its columns crushed. The save bar becomes a sticky full-width footer above the safe-area
  inset. At 1280px the grid is three columns with a fixed-width control column, so every row's radio
  set starts at the same left edge. At 2560px the grid holds the console's content measure; a
  sixteen-row grid at 2000px of line length is harder to read, not easier.
- **Motion.** The save bar enters with a 220ms transform-and-opacity rise on `--ease-out-quint` and
  leaves in 150ms. The "Customised" badge fades in over `--duration-fast`. The dialog uses the
  standard enter and exit. `prefers-reduced-motion: reduce` collapses all three to opacity.
- **Keyboard and a11y.** Arrow keys move within a row's radio group and Tab moves between rows, which
  is the native radiogroup model. The save bar is in the DOM after the grid so it is the next stop
  from the last row. Every disabled option states its reason through the tooltip's accessible
  description, not through colour alone.
- **Tokens.** No new token. The "Customised" badge uses `--color-brand-subtle` with `--color-brand`
  text, checked for AA in both themes.

### Quota

**This stage creates no countable row.** It writes one column of the singleton
`organization_settings` row, which `ensureOrganizationSettings` already creates on first use and
which is not sold by any plan. Nothing is added to `resolveLimits()`, nothing to `PLAN_QUOTAS`, and
no case to `src/server/billing/__tests__/limits.test.ts`. The action catalogue is fixed at sixteen
keys in code, so a workspace cannot grow it.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block. In A's scope,
against B's rows:

- `savePermissionMatrix` in A raises `member.remove` to `owner`; B's matrix is still every default,
  and `getPermissionMatrix` in B reports no customisation.
- `getPermissionMatrix` in A never returns B's stored record, before or after B saves its own.
- Asking `organizationSettingsRepository` in A for B's settings row by id → `NotFoundError`; B's
  `permissions` column is unchanged afterwards.
- `resetPermissionMatrix` in A leaves B's stored record intact.
- `assertAction` in B resolves B's floors, not A's: with A having raised `file.upload` to `owner`, an
  admin in B may still upload.
- The moved call sites resolve per tenant too: with A having lowered `member.invite` to `member`, a
  member scope in B calling `createInvitation` still raises `ForbiddenError` and B gains no
  invitation row — a customisation cannot leak across the boundary through the assertion any more
  than through a query.

Functions covered: `getPermissionMatrix`, `savePermissionMatrix`, `resetPermissionMatrix`,
`assertAction`, and through it `createInvitation`, `cancelInvitation`, `changeMemberRole`,
`removeMember`, `addMember` and `updateOrganization` in `src/server/repos/members.ts`.

### Verification

- **Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  with `pnpm generate-routes` run first because this stage adds a route file.
- **Permission test cases — `src/server/repos/__tests__/permissions.test.ts`,** named because a
  matrix nobody tested is a matrix nobody can trust:
  1. an unset column resolves every one of the sixteen keys to its catalogue default;
  2. a stored override that raises a floor refuses the role below it with `ForbiddenError`, and the
     error names the action key;
  3. a stored override that lowers a floor admits the role it names, and the write proceeds;
  4. an unrecognised key in the stored record is ignored and the rest of the record still resolves,
     so a rollback to a Worker with a smaller catalogue keeps working;
  5. lowering `member.role_change`, `member.remove` or `workspace.settings` below `admin` is refused
     at the write — three cases, not one — and the stored record is unchanged after each;
  6. raising any action above `owner` is refused at the write;
  7. a batch save is all-or-nothing: one invalid entry rejects the submission and the stored record
     is byte-for-byte what it was;
  8. the seven moved call sites resolve through the matrix — a workspace that lowers `member.invite`
     to `member` lets a member call `createInvitation` and `cancelInvitation`, and one that has not
     still refuses both with `ForbiddenError` naming the key; `removeMember` still lets a member
     remove themselves at every setting, because self-removal is outside the matrix;
  9. **the lowered `member.invite` does not become an escalation path, proved as a pair rather than
     inferred from `10-S1`:** in a workspace that has lowered it, a `member` scope calling
     `createInvitation` with `role: 'member'` succeeds, the same scope calling it with `role: 'admin'`
     and with `role: 'owner'` raises `ForbiddenError` from `10-S1`'s ceiling and writes no row, and
     `changeMemberRole` from that scope is still refused by the matrix at its pinned `admin` floor —
     so neither guard is standing in for the other;
  10. `assertCanAdminister` is unchanged and still refuses a member on the five callers that keep it
      — the four audit reads and `deleteWorkspace` — whatever the matrix says, so a fixed floor
      cannot be lowered by a customisation;
  11. the matrix is read once per scope: two `assertAction` calls against one scope object issue one
      query, and a second scope issues a second one — the `WeakMap` is keyed by scope identity and
      the test asserts both halves rather than only the cheap one.
- **Catalogue test — `src/lib/__tests__/permissions.test.ts`:** all sixteen keys match the dotted
  regex the audit boundary enforces; keys are unique; every key has a label, a description, a group
  and a default; `mergeOverrides` is pure and never mutates its inputs.
- **Component test — `src/components/administration/__tests__/permission-matrix.test.tsx`:** the
  save bar appears only when the grid is dirty and reports the exact change count; Discard restores
  every row; the three pinned rows have their Member option disabled with the reason exposed as an
  accessible description, and `member.invite`'s Member option is asserted **not** to be among them,
  so a later tightening of the grid cannot quietly disable the row this stage argues must stay open;
  the reset dialog's confirm is not the initially focused control.
- **Browser evidence.** `/admin/permissions` at 360px, 1280px and 2560px in light and dark — six
  frames at rest — plus three declared non-resting states, each with its selector verified against a
  running server by asserting a count of exactly one in this stage's spec before capture:
  `[data-part="permission-save-bar"]` (the grid dirty, the bar risen),
  `[data-part="permission-reset-dialog"]` (the second step open), and
  `[data-part="permission-row-error"]` (a refused save on the offending row).

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/administration.visual.spec.ts

  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/admin/permissions" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/10-S4" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
    --click '[data-part="permission-option-member-trip-delete"]' --state dirty-save-bar
  ```

- **Route declaration.** `/admin/permissions` joins `ADMINISTRATION_ROUTES` with `relativeTime:
false` — the screen prints no clock-derived string — and is covered by the existing
  `auditServerClock` call, which fails in both directions, so the false declaration is audited rather
  than assumed.
- **Console must be silent.** `watchConsole(page, route)` attached before navigation in every test,
  `fatal` asserted empty at the end of each, including the frame-only tests, because a warning that
  only appears in dark at 360px is exactly the kind nobody finds by hand.
- **Layout shift after paint**, which `12-verification-protocol.md` §6 requires of every stage
  alongside the console verdict, and which nothing in `e2e/` or `capture.mjs` measures today. The
  shape is fixed there and is not re-derived here: a `PerformanceObserver` for `layout-shift`
  installed as an **init script** before the document exists, accumulating `entry.value` only where
  `hadRecentInput` is false; `visit()` then `settle()`; `performance.now()` read as the mark;
  and the sum of entries after the mark asserted to be `0`. The budget is zero **after the settle
  mark**, never from navigation.
  What this stage exercises after the mark is the save bar: it rises when the grid becomes dirty, and
  a bar that reflows the last rows of a sixteen-row grid is exactly the defect this clause is about —
  which is why it is pinned within the panel rather than floating. The seam is `10-S2`'s, in this
  plan's shared spec file. Reported per engine, WebKit stated as a skip.
- **Comparison budget.** `maxDiffPixelRatio` is not raised.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged, as listed in `10-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the grid, the save bar and the reset dialog:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states —
      including every radio option, the disabled options with their reasons, and the save button.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2`; the grid's empty state is the "no customisations" summary.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive at 360px, 1280px and 2560px, where the 360px layout is one card per action and not
      a crushed three-column grid.
- [ ] Keyboard navigable end to end, arrow keys within a row and Tab between rows, accessible names
      that name the action, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on the change
      count and the customised-row count.

### Blockers

None that stop the stage. One foundations requirement, one cross-plan requirement, one inherited
precondition that turns out **not** to apply, and the freeze:

- **Foundations requirement:** the nullable `permissions` JSON column on `organization_settings`,
  specified under **Data and migration**. `src/server/db/schema.ts` is one of the six shared paths,
  so the column is written by `00-foundations.md` in wave 0 and this stage consumes it. A stage that
  planned around the missing column by overloading `features` would have made the two vocabularies
  collide, which is why the alternative is refused rather than kept in reserve.
- **Cross-plan requirement:** the `collab.moderate` assertion behind the moderation affordance at
  `src/routes/_app/trips/$tripId/collab.tsx:86` belongs to the collaboration repository, which
  `07-collaboration-and-sharing.md` owns. It is stated to that plan and is not reached into from
  here; until it lands, that affordance is hidden by the UI and enforced by the collaboration
  repository's own existing rules, which is the status quo and not a regression this stage
  introduces.
- **`12-verification-protocol.md` §7.1 does not reach this stage, and the reason is checked rather
  than assumed.** §7.1 is blocking for a stage that baselines `/admin`, `/notifications` or any
  surface printing a `formatRelative` string, and `10-S1`, `10-S2` and `10-S3` each carry it. This
  stage baselines `/admin/permissions` only. The grid prints no instant of any kind — no timestamp
  column, no expiry, no "last changed" line — and the console layout it renders inside is a page
  header and a tab strip, neither of which prints one either; the two `formatRelative` call sites in
  the product are `src/routes/_app/notifications.tsx` and `src/routes/_app/admin.tsx:303`, and the
  second is the activity list `10-S2` replaces and `10-S3` moves to `/admin/audit`. That is why this
  stage's route declares `relativeTime: false`, and why `auditServerClock()` — which fails in both
  directions — is what proves the declaration rather than a reading of the JSX.
- No package outside the `docs/SPEC.md` §3 pinned set is needed, no binding is added to
  `wrangler.jsonc`, and no third-party service is introduced.

## Cross-plan collisions

Both checks are run at the time of writing and pasted verbatim, because a judgement re-made by hand
every round is eventually made wrong. First, `node scripts/ultrabuild/check-plan-collisions.mjs 10`:

```
plans 13 · stages 91 · owned paths 541

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (5) — legal; each plan must name the other:
  src/routes/_app/-server/overview.ts
      00-foundations.md  00-S5  wave 0  (edit)
      01-trips-core.md  01-S1  wave 1  (edit)
      01-trips-core.md  01-S7  wave 5  (edit)
      09-account-and-settings.md  09-S7  wave 2  (edit)
      10-administration.md  10-S3  wave 4  (edit)
  e2e/helpers/shoot.ts
      01-trips-core.md  01-S5  wave 2  (edit)
      10-administration.md  10-S2  wave 1  (edit)
  src/routes/_app/-ui/settings-nav.tsx
      02-places-and-maps.md  02-S10  wave 5  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
      10-administration.md  10-S3  wave 4  (edit)
  src/server/auth/index.ts
      09-account-and-settings.md  09-S3  wave 1  (edit)
      10-administration.md  10-S1  wave 3  (edit)
  src/server/repos/members.ts
      09-account-and-settings.md  09-S3  wave 1  (edit)
      10-administration.md  10-S1  wave 3  (edit)
      10-administration.md  10-S4  wave 5  (edit)
```

Then `node scripts/ultrabuild/check-plan-refs.mjs 10`:

```
plan 10: 0 dangling stage reference(s), 0 plan(s) missing a Playwright invocation
```

Reading them:

- **Zero dangling stage references.** Every `NN-Sn` token this file cites is defined by a `## Stage`
  heading in the plan whose prefix it carries — `01-S6`, `00-S2`, `00-S3`, `00-S5`, `09-S3`, `09-S7`,
  `09-S8`, `02-S10`, `01-S1`, `01-S5`, `01-S7`, `04-S2`, `11-S1`–`11-S3` and this file's own four.
  The check is also what proves the four stages this file names as unparseable still exist under the
  ids it gives them. And it reports no plan missing a Playwright invocation, which for this file is
  the four `pnpm exec playwright test` blocks under the four **Verification** headings.
- **No same-wave exclusive collision involves this plan.** No stage here shares an exclusive
  disposition on a file with another stage in the same wave, inside this plan or across the thirteen
  plans the check now reads. Note the shape of that guarantee: the check is over stages that state a
  wave, so the line above it is part of the same reading and not a footnote.
- **Five paths are touched by more than one plan in different waves, which is legal, and every one of
  them is named in the stage that owns it here, with the sibling stage id and its wave.**

  | Path                                   | Owned here by           | Named siblings                                    |
  | -------------------------------------- | ----------------------- | ------------------------------------------------- |
  | `src/routes/_app/-server/overview.ts`  | `10-S3`, wave 4         | `00-S5` w0 · `01-S1` w1 · `09-S7` w2 · `01-S7` w5 |
  | `e2e/helpers/shoot.ts`                 | `10-S2`, wave 1         | `01-S5` w2                                        |
  | `src/routes/_app/-ui/settings-nav.tsx` | `10-S3`, wave 4         | `09-S8` w3 · `02-S10` w5                          |
  | `src/server/auth/index.ts`             | `10-S1`, wave 3         | `09-S3` w1                                        |
  | `src/server/repos/members.ts`          | `10-S1` w3 · `10-S4` w5 | `09-S3` w1                                        |

  Each of those is named in the stage's **Owned paths**, not only in this table, because that is the
  list an orchestrator fans out against.

  Two lines moved since the previous run of this check, and both moved for a reason worth stating
  rather than for a reason worth hiding:

  - `src/server/repos/members.ts` now carries a third claimant, `10-S4` in wave 5. That is this
    round's correction: the stage's enforcement design always required moving seven
    `assertCanAdminister` call sites in that file, and the file was missing from its ownership, which
    made the stage unimplementable without a violation. Wave 3 then wave 5 inside one plan is
    sequential by construction, and `09-S3` in wave 1 precedes both.
  - `src/routes/_app/-ui/settings-nav.tsx` gained `02-S10` in wave 5, because
    `02-places-and-maps.md` was written after this file's previous draft. That is the protocol
    working rather than an exception to it: the plan written second names the sibling, and re-running
    the check is how the second writer finds out.

  What did **not** move is as load-bearing: `src/server/repos/base.ts` and
  `src/server/repos/context.ts` appear in no stage's ownership here. An earlier draft of `10-S4`
  needed both — a memo field on the scope and an asynchronous `assertCanAdminister` — and both
  requirements were designed out rather than claimed, because a stage that edits the file every
  repository in the codebase imports is a stage that collides with everything eventually.

- **The four stages the check cannot read are not this plan's.** `04-S2` is in
  `04-budget-and-currencies.md`; `11-S1`, `11-S2` and `11-S3` are in
  `11-boundaries-and-blockers.md`. A stage with no parseable wave is **invisible to the check rather
  than proven safe**, so the "no same-wave exclusive collisions" line above is clean only with
  respect to the stages that do state one: if one of those four later declares a wave and claims a
  path this plan owns in that same wave, the collision was always there and merely became visible.
  Giving them a wave belongs to the plans that own them and is not a thing this plan may edit —
  it is carried out of this file as a contract extension. All four of **this** plan's stages state a
  wave on their `### Stage id` line — `10-S1` wave 3, `10-S2` wave 1, `10-S3` wave 4, `10-S4`
  wave 5 — so every one of them is inside the check.
- `src/server/repos/__tests__/tenant-isolation.test.ts` is claimed by the three stages here that add
  a repository function — `10-S1`, `10-S2` and `10-S4` — and by stages in every other plan, and is
  absent from both lists because every claimant marks it `append`, which is the documented
  cooperative pattern and not a collision. `10-S3` adds no repository function and therefore claims
  it not at all. The same append pattern covers `e2e/administration.visual.spec.ts`, which `10-S2`
  creates in wave 1 and the other three add a `test.describe` to.
- **The counts in the pasted output move between rounds, and that is expected rather than alarming.**
  `plans 13 · stages 91 · owned paths 541` is what was measured on 2026-08-25 for this file, against
  `553` on the previous round's run of the same command, and against eight plans with 48 stages a
  round before that. This file's own contribution is **49 owned-path bullets, unchanged by this
  round's edits** — the same 49 the check parses from the previous commit's copy, measured by running
  the check's own parser over both versions — so the whole of the difference is sibling plans being
  edited while this one is. Measured directly during this round: three runs of the command inside one
  hour returned `538`, `540` and `541` while the two lists below the counts came back byte-identical
  every time, and `ls -lT docs/plans` put four sibling plans' modification times inside the same hour.
  A total that moves is therefore not by itself a finding; the lists are the guarantee, and both were
  re-read against the run pasted above. A later round re-runs the command and re-pastes it, and
  a path that appears then is named by whichever plan is written second.
