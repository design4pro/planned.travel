# planned.travel - Access, Audit and Impersonation

Companion to `docs/SPEC.md` §5 (Platform roles, Global-catalogue carve-out) and `docs/SPEC.md` §6
(repo conventions). This document owns the authorisation contract: the statement dictionary, the
role grid, what a stranger may see, what gets audited, and what impersonation is allowed to be.

Everything below is a decision, not a suggestion. Where a case was left open by the plan, it is
closed here by name. A change to any list in this document is a change to the contract, not a
judgement call a builder makes on the way past.

Two role vocabularies coexist and are never conflated, exactly as SPEC §5 states. **Organization
roles** (`owner`, `admin`, `member`, from Better Auth's `organization` plugin) describe standing
inside one workspace and keep their present meaning; the existing `isAdmin` helper stays an
organization concept. **Platform roles** (`admin`, `curator`, `user`) describe standing on the
product itself. This document is about platform roles only.

---

## 1. The access statement

The dictionary lives in `src/server/auth/access.ts` - isomorphic, no server imports, so the
console, the guard and the MCP server all read the same object. It is Better Auth's
`defaultStatements` from the pinned `better-auth@1.7.1` `admin` plugin, extended with five
resources of ours.

### 1.1 Printed in full

```ts
// src/server/auth/access.ts
import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/admin/access'

export const statement = {
  ...defaultStatements,
  catalog: ['read', 'write', 'publish'],
  pack: ['read', 'write', 'publish'],
  source: ['read', 'run'],
  share: ['read', 'revoke'],
  sandcastle: ['read'],
} as const

export const ac = createAccessControl(statement)
```

Spread and literal must agree. This is what `defaultStatements` contains in `better-auth@1.7.1`
(`node_modules/better-auth/dist/plugins/admin/access/statement.mjs`), and it is the frozen value
the grid in §2 is written against:

```ts
user: [
  'create',
  'list',
  'set-role',
  'ban',
  'impersonate',
  'impersonate-admins',
  'delete',
  'set-password',
  'set-email',
  'get',
  'update',
]
session: ['list', 'revoke', 'delete']
```

Together with our five resources, the complete dictionary is:

| Resource     | Actions                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `user`       | `create` · `list` · `set-role` · `ban` · `impersonate` · `impersonate-admins` · `delete` · `set-password` · `set-email` · `get` · `update` |
| `session`    | `list` · `revoke` · `delete`                                                                                                               |
| `catalog`    | `read` · `write` · `publish`                                                                                                               |
| `pack`       | `read` · `write` · `publish`                                                                                                               |
| `source`     | `read` · `run`                                                                                                                             |
| `share`      | `read` · `revoke`                                                                                                                          |
| `sandcastle` | `read`                                                                                                                                     |

**The dictionary is closed at seven resources.** An eighth resource, or a new action on an existing
one, is an edit to this document and to the grid in §2 in the same commit. Authority that has no
statement of its own is expressed with the statements above - see §2.4 for MCP tokens.

**A drift test is mandatory.** The spread is convenient and it is also how a dependency bump could
silently widen our grid: a future `better-auth` that adds a `user` action would grant it to
whichever roles enumerate `user` actions by spread. So a unit test deep-equals
`statement.user` and `statement.session` against the two literal arrays printed above. A bump that
changes the upstream dictionary fails that test and forces a decision here, rather than shipping a
statement nobody in this document has ruled on.

### 1.2 What our five resources cover

| Resource     | Tables it governs                                                    | `read`                                                                                                                              | `write`                                                                      | `publish` / `run` / `revoke`                                    |
| ------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `catalog`    | `catalog_places`, `catalog_ingest`, `catalog_place_sources`          | See rows that are not `published` - the review queue, retired records, raw ingest payloads                                          | Create and update a catalogue record; promote, merge or reject an ingest row | `publish`: move a record's `status` to `published` or `retired` |
| `pack`       | `place_packs`, `place_pack_places`                                   | See packs that are not `published`                                                                                                  | Create and update a pack, set its places and their order                     | `publish`: publish or retire a pack                             |
| `source`     | `catalog_sources`, `catalog_runs`                                    | See sources and their run history                                                                                                   | -                                                                            | `run`: enable or disable a source, and start a run now          |
| `share`      | `share_links` (every tenant's), through the moderation surface only  | The moderation list defined in §3.4, reached the one legal way §2.4 specifies                                                       | -                                                                            | `revoke`: stamp `revoked_at` on a share link                    |
| `sandcastle` | No table at all - the `SandcastleRegistry` Durable Object (ADR 0009) | The run registry as `/console/sandcastle` shows it: live runs, the issues each holds, orphaned WIP branches, recently finished runs | -                                                                            | -                                                               |

A `published` catalogue or pack row needs **no** statement: it is readable by an entitled tenant
through `src/server/catalog`, and readable without a session only through the whitelisted
projections in `src/server/public/**` (§3). The statements gate everything that is not published,
and every mutation.

### 1.3 Role resolution, before any statement is consulted

1. `session.user.banned === true` → every statement is denied, whatever the role says. A ban is
   not a role change; it is a veto on top of one.
2. `session.user.role` is `NULL` → resolve as `user`. Better Auth 1.7.1 declares the column
   `{ type: 'string', required: false, input: false }` with **no** `defaultValue`
   (`dist/plugins/admin/schema.mjs`); `defaultRole` is applied by the plugin at signup, so the
   migration that adds the column leaves every pre-existing row `NULL`. `requirePermission` reads
   `NULL` as `user` and never as "unset, therefore permissive".
3. `session.user.role` is a string that is not one of the three → resolve as `user`. Deny by
   default; an unrecognised role is never an escalation.
4. `session.impersonatedBy` is set → apply §6.4 before anything else.

`defaultRole: 'user'`. The five columns the plugin adds - `user.role`, `user.banned`,
`user.ban_reason`, `user.ban_expires`, `session.impersonated_by` - are all `input: false` and
never writable from the client.

Those four steps are the whole resolution because there is no fifth input, and there is no fifth
input only because of the rule below. Without it the grid in §2 is not total.

### 1.4 `adminUserIds` is empty, and stays empty

The pinned plugin carries a second way to be an administrator that has nothing to do with
`user.role`. It is the first line of its own permission check, read from
`node_modules/better-auth/dist/plugins/admin/has-permission.mjs` rather than recalled:

```ts
const hasPermission = (input) => {
  if (input.userId && input.options?.adminUserIds?.includes(input.userId))
    return true
  if (!input.permissions) return false
  // …only now is the role read and the access controller consulted
}
```

It returns `true` before `input.permissions` is so much as examined. An id in that list therefore
holds **every** statement in §1.1 - `user:ban`, `user:delete`, `session:revoke`, and
`user:impersonate-admins`, which §2.4 grants to no role at all - and holds them with no `role`
value anywhere: the account reads as a plain `user` in the console's user list, in
`session.user.role`, and in the `actor_role` column of every `platform_audit_log` row it writes
(§4.1). The grid in §2 enumerates roles. This list is not a role. Seventy-two cells of literal yes
and no describe the entire authorisation surface **only while the list is empty**, which is why
emptiness is a rule here and not an accident of configuration.

Three clauses, in force together:

- **The option is never set.** `adminUserIds` does not appear in the `betterAuth` options in
  `src/server/auth/index.ts`. Absent, not `[]` with a comment beside it - an empty array in source
  is a slot, and a slot gets filled at 2 a.m. A unit test asserts the key is absent from the
  resolved admin-plugin options, the same shape as §1.1's and §2.6's drift tests, so adding one
  entry is a failing test rather than a quiet commit.
- **`requirePermission` never consults it.** Our guard (§2.5) reads `session.user.banned`,
  `session.user.role` and `session.impersonatedBy`, and reaches the grid through `ac` and
  `statement`. It does not call the plugin's `hasPermission`, and it must never be re-expressed as
  a wrapper around `auth.api.userHasPermission`: that one refactor would import this bypass
  directly into the only place authorisation is decided.
- **It is not a break-glass and does not function as one.** Because our guard ignores it and §2.6
  answers all fifteen plugin HTTP paths with `404`, an id added to the list opens no console
  screen and no MCP tool. What it would still do is satisfy the plugin's _second_, internal check
  inside the `auth.api.*` calls our console makes **after** our guard has already approved them
  (`dist/plugins/admin/routes.mjs`, one `hasPermission` call at the head of each endpoint). So its
  only live effect is to stand ready for the day a server function is written without the guard
  call: it grants nothing while the code is correct and everything the moment it is not. That is
  the worst possible shape for a security control.

The list has one other use in the pinned version, and it is a hardening rather than a widening:
`routes.mjs:588` treats an impersonation _target_ whose id is in the list as an admin target, so
impersonating it would additionally require `user:impersonate-admins`. With the list empty the
branch never fires, and §2.4 has already denied that statement to every role in any case.

**The supported recovery when no `admin` exists is §8.1's SQL grant**, and the difference is not
stylistic. A `role = 'admin'` value is greppable, readable back with one query, visible in the
console's own user list, attributable in `actor_role` on every row that account writes, and
removable by the same statement that set it. An `adminUserIds` entry is none of those things: no
query finds it, no audit row explains it, and the account it empowers is indistinguishable from
any other. `docs/DEPLOY.md` §14.1 currently presents the list as the recovery instrument and its
§16 checklist tolerates "a single entry that is deliberate and dated"; both contradict this
section, both are outside this document's ownership, and both are recorded as **FU-5** in §7.

---

## 2. The grid

Every statement, every action, all three roles, as a literal yes or no. There is no fourth column,
no conditional cell and no footnote that turns a no into a yes.

### 2.1 `user`

| Action               | `admin` | `curator` | `user` |
| -------------------- | ------- | --------- | ------ |
| `create`             | yes     | no        | no     |
| `list`               | yes     | no        | no     |
| `set-role`           | yes     | no        | no     |
| `ban`                | yes     | no        | no     |
| `impersonate`        | yes     | no        | no     |
| `impersonate-admins` | **no**  | no        | no     |
| `delete`             | yes     | no        | no     |
| `set-password`       | yes     | no        | no     |
| `set-email`          | yes     | no        | no     |
| `get`                | yes     | no        | no     |
| `update`             | yes     | no        | no     |

### 2.2 `session`

| Action   | `admin` | `curator` | `user` |
| -------- | ------- | --------- | ------ |
| `list`   | yes     | no        | no     |
| `revoke` | yes     | no        | no     |
| `delete` | yes     | no        | no     |

### 2.3 `catalog`, `pack`, `source`, `share`

| Statement         | `admin` | `curator` | `user` |
| ----------------- | ------- | --------- | ------ |
| `catalog:read`    | yes     | yes       | no     |
| `catalog:write`   | yes     | yes       | no     |
| `catalog:publish` | yes     | yes       | no     |
| `pack:read`       | yes     | yes       | no     |
| `pack:write`      | yes     | yes       | no     |
| `pack:publish`    | yes     | yes       | no     |
| `source:read`     | yes     | yes       | no     |
| `source:run`      | yes     | yes       | no     |
| `share:read`      | yes     | yes       | no     |
| `share:revoke`    | yes     | yes       | no     |

Twenty-five statements, three roles, seventy-five literal cells. The `user` column is `no` in every
one of them: **`user` holds nothing platform-level.** It is not a reduced console; there is no
console. The console route tree denies a `user` session at its own guard before a statement is
ever consulted, and the entry point in the user menu is not rendered for that role.

Those seventy-five cells are the **whole** authorisation surface, and they are the whole surface
because §1.4 keeps the plugin's `adminUserIds` list empty. One id in that list is a seventy-sixth
position that this table cannot express: every cell `yes`, in no column, under no role name. The
grid and that rule are read together or neither is true.

### 2.3a `sandcastle`

| Statement         | `admin` | `curator` | `user` |
| ----------------- | ------- | --------- | ------ |
| `sandcastle:read` | yes     | **no**    | no     |

The one statement in the grid that is `no` for a curator and `yes` for an admin without being about
accounts or sessions, so it is stated on its own rather than folded into §2.3.

**What it gates.** `/console/sandcastle` and the server function behind it: the read of the
`SandcastleRegistry` Durable Object (ADR 0009) that keeps two agent fleets off one issue. Which runs
are live, on which machine, in which stage, holding which issues; which branches were left behind by
a run that died. It gates a **read and nothing else** - the registry is written by the agent loop
through `/api/sandcastle/*` under a bearer token, never by a console session, so there is no
`sandcastle:write` to grant and none to withhold.

**Why a curator is refused.** The curator role is the catalogue: places, packs, sources, share
moderation. Which machine is building which ticket is an operational fact about how this repository
is developed, and it names hosts, branches and run ids. A curator has no call on it, and there is no
half of it worth showing them.

**Why it is not folded into `user:list`.** That was the cheaper option and it was rejected: gating a
page about agent runs on "may list accounts" makes the console's authorisation model say something
untrue about the page, and the untrue thing is the part a later reader would rely on. The dictionary
is closed (§1.1) precisely so that widening it is a decision recorded here.

**On a deployment that is not the coordinator, the statement still holds and the page still opens.**
The registry binding exists on staging alone - one coordinator is the whole point - so on production
the page renders "this deployment is not the coordinator" rather than an empty fleet. Authority and
availability are different questions, and answering the second with a permission error would tell an
admin they lack a statement they hold.

### 2.4 The cases the plan left open, closed by name

**A `curator` may revoke another user's share link - yes.** `share:revoke` is in the curator
column and it is deliberate: SPEC §5 gives the curator "share moderation", and moderation that
cannot stop a link is a report button. The scope of the power is narrow and stated here so it is
not widened later: `share:read` returns the moderation projection in §3.4 - owning organization,
resource kind, who created it, view count, timestamps - and **never** the shared payload. A
curator can see that a link exists and kill it; a curator cannot read the trip behind it. Revoking
writes a `platform_audit_log` entry carrying the organization id and the link id, and the owning
organization is notified through the existing notification path, because a link going dark without
explanation is indistinguishable from a bug.

**How that is legal, stated because the obvious route is forbidden.** `share_links` is tenant data.
It carries `organization_id`, it lives in `src/server/repos`, and every reader of it today goes
through `createTenantRepository()`, which ANDs `organization_id = ?` onto every predicate a caller
supplies. A curator moderating a stranger's link holds no tenant context for that stranger's
workspace and may not invent one: §3.7 rule 2 and SPEC §5 both forbid exactly that, and it is the
single thing `src/server/repos/base.ts` exists to make inexpressible. Nor is the table reachable
through `src/server/catalog/repo.ts`: that door serves eight of the twelve global tables of SPEC §5's
carve-out, and `share_links` is not one of them. So the surface is built the way the one existing
session-less path in this codebase is already built, and named the same way:

- Two functions in `src/server/repos/shares.ts` - `listShareLinksForModerationUnscoped(db, …)` and
  `revokeShareLinkUnscoped(db, …)` - taking a plain `Database` rather than a `TenantScope`, exactly
  as `findSubscriptionByOrganizationUnscoped` and its four siblings in
  `src/server/repos/billing.ts` do for session-less provider resolution or platform billing inspection. SQL stays in
  `src/server/repos` (SPEC §6); what changes is the scope argument, not the layer.
- The `Unscoped` suffix carries the weight. It is grep-able, it reads as an alarm at every call
  site, and the file header states in one paragraph why the exception exists and what bounds it -
  the form the billing repository's header already takes.
- They return the §3.4 projection and a revocation, and nothing else: no trip row, no place, no
  member, no file, no message. A curator cannot reach tenant content through this door because
  there is no other room behind it. This mirrors the reasoning the billing header already gives
  for its own family - those functions return billing rows only, so a mis-signed webhook cannot
  read a tenant's content.
- They are called from exactly one place, `src/server/fns/console/shares.ts`, after
  `requirePermission(session, { share: ['read'] })` or `{ share: ['revoke'] }`. A test asserts no
  other module imports them, the way §2.6's drift test asserts its own list.

SPEC §5 FU-3 now names this bounded `…Unscoped` shape; SQL remains in repos, and the
closed list of exactly two catalog members is unchanged (ADR 0041).

**A `curator` may not issue or revoke MCP tokens - admin-only.** The dictionary is closed at six
resources (§1.1), so token authority is expressed with existing statements rather than a seventh:

- issuing a token into `staff_api_tokens` requires `user:create`, because minting a bearer that
  carries a platform role is materially the act of creating a platform credential;
- revoking one requires `session:revoke`, because a live token is a live session by another name.

Both are `admin`-only in §2.1 and §2.2, so `console/tokens` is an admin surface. A curator uses a
token; a curator does not mint one, cannot mint one for itself, and cannot revoke the token of
another curator.

**`impersonate-admins` is granted to no role at all, including our `admin` - no.** It is a
separate statement in `defaultStatements`, and Better Auth's own `adminAc` does **not** carry it:
`adminAc` grants ten `user` actions and omits exactly this one. We define our roles from
`statement` rather than inheriting `adminAc`, so the omission would not have followed
automatically - the decision is made here, and it is the same one. Reasoning: admin-on-admin
impersonation is the single action with no accountability path left, because the impersonator
acquires full platform authority under a second identity that also holds full platform authority.
An admin who has to reproduce another admin's report demotes that account to `user` first, then
impersonates, then restores the role: three audited events, all attributable, instead of one
invisible one. The statement stays in the dictionary so the guard denies it explicitly rather than
falling through an unknown key, and `allowImpersonatingAdmins` is left unset (falsy) in the plugin
options so Better Auth's own check cannot bypass ours.

### 2.5 Where the decision is made

`requirePermission(session, { catalog: ['write'] })` in `src/server/auth/guard.ts` is the only
implementation of "may this actor do this", used identically by console server functions and by the
MCP server (SPEC §5, SPEC §6). Consequences that are not negotiable:

- No route, component or server function decides authorisation for itself. A component may hide a
  control it believes is unavailable; hiding is a courtesy and the guard is the boundary.
- **The dependency does not get a vote either.** Better Auth's `admin` plugin ships an
  authorisation implementation of its own and publishes it over HTTP. §2.6 closes that surface, and
  §1.4 empties `adminUserIds`, the one input to that implementation which answers `true` before any
  role or statement is read. Without those two sections every sentence in this list is an
  aspiration rather than a boundary.
- The client is never asked. `platformRole` reaching the browser session object is for rendering,
  and a forged one buys nothing because no server path reads it.
- Every catalogue mutation passes the guard **before** it touches a row and writes
  `platform_audit_log` in the same call (§4).
- A denied MCP call returns a JSON-RPC error, not an HTTP 403; a missing or invalid bearer returns
  HTTP 401. Absent credentials and insufficient credentials are different answers.
- Tests cover this boundary the way tenant-isolation tests cover the repository boundary: a
  `curator` session is asserted to fail on every `user:*` and `session:*` statement, and an
  unaudited mutation is a failing test.

### 2.6 The plugin's own HTTP surface is closed

Registering Better Auth's `admin` plugin does not only hand us `hasPermission` and five columns. It
publishes fifteen HTTP endpoints, and `src/routes/api/auth/$.ts` mounts every Better Auth route
under `basePath: '/api/auth'` for all seven methods - so all fifteen would be live and reachable by
`fetch` from any browser holding a session cookie. The paths, read from `better-auth@1.7.1`
(`dist/plugins/admin/routes.mjs`) rather than recalled:

`/admin/list-users` · `/admin/get-user` · `/admin/create-user` · `/admin/update-user` ·
`/admin/remove-user` · `/admin/set-role` · `/admin/set-user-password` · `/admin/ban-user` ·
`/admin/unban-user` · `/admin/impersonate-user` · `/admin/stop-impersonating` ·
`/admin/list-user-sessions` · `/admin/revoke-user-session` · `/admin/revoke-user-sessions` ·
`/admin/has-permission`

Left open, that surface does not weaken three claims in this document - it falsifies them:

- §2.5 says `requirePermission` is the only implementation of "may this actor do this". These
  endpoints authorise themselves, against the plugin's `defaultRoles`, and never consult our grid.
  That is a second implementation with a public URL.
- §4.3 says ban and impersonation are always audited. The plugin knows nothing about
  `platform_audit_log` and writes no row to it. An `admin` who posts to `/api/auth/admin/ban-user`
  from a devtools console bans an account and leaves nothing behind.
- §6.4 says an impersonated session performs no platform mutation. That veto lives inside
  `requirePermission`, which these endpoints do not call, so an impersonated session wearing an
  account that holds a platform role would walk straight past it.

**The closure: all fifteen paths are listed in `disabledPaths` in the `betterAuth` options.** The
mechanics, verified in the pinned version rather than assumed:

- `disabledPaths` is matched in the router's `onRequest` against the request path with `basePath`
  already stripped, so the entries are written `/admin/set-role` and not
  `/api/auth/admin/set-role`.
- A match returns a bare `404 Not Found` before rate limiting, before any plugin `onRequest`, and
  before the endpoint function is entered. The surface is removed, not guarded - there is no
  handler left to reason about.
- `auth.api` is built by `getEndpoints()` and never passes through `router()`
  (`dist/auth/base.mjs`), so `disabledPaths` shuts the browser door while leaving
  `auth.api.setRole({ body, headers })` fully available to our own server code.

That third property is why `disabledPaths` is the instrument and a `hooks.before` guard is not.
`hooks.before` runs inside `dispatchAuthEndpoint`, which wraps `auth.api` as well as the HTTP
router, so a hook rejecting `/admin/*` would reject our own server functions along with the
browser and leave no way to perform the action at all. One mechanism, chosen because it is the one
that can tell "over HTTP from a stranger" apart from "in process, behind our guard".

Every admin action therefore has exactly one route, and it is ours:

```
console screen
  → server function in src/server/fns/console/*
  → requirePermission (§2.5)  →  the §6.4 impersonation veto
  → auth.api.<endpoint>({ body, headers })          // in process, no HTTP
  → platform_audit_log (§4)
```

One trap comes with that route and is named here so it is not discovered in staging. Impersonating
and un-impersonating are cookie operations: the plugin swaps the session cookie and sets the signed
`admin_session` cookie beside it. An in-process `auth.api` call returns data, so those `Set-Cookie`
headers are dropped unless the call asks for them - `returnHeaders: true` (or `asResponse: true`)
and the resulting headers merged into the server function's own response. A server function that
forgets this reports success, changes nothing, and looks like a Better Auth bug for an afternoon.

Four consequences that are part of this contract, not implementation taste:

- **`adminClient()` is never registered** in `src/lib/auth/client.ts`, which today carries
  `twoFactorClient()` and `organizationClient()` and must keep carrying only those two. The console
  talks to our server functions; giving the browser bundle an admin vocabulary would be building
  against fifteen paths that answer `404`.
- **Leaving impersonation goes through us as well.** `/admin/stop-impersonating` is disabled with
  the other fourteen, so the **End impersonation** action in §6.1 calls our server function, which
  appends `platform.user.impersonation_ended` and then calls `auth.api.stopImpersonating` in
  process.
  Leaving that one path open was the cheap option and would have made §4.3's "without exception"
  false for half of the impersonation lifecycle.
- **A drift test is mandatory**, the same shape as §1.1's. Better Auth exposes a `path` string on
  every endpoint object - it is how `getEndpoints()` registers them - so the test enumerates the
  admin plugin's `endpoints`, keeps every `path` beginning `/admin/`, and asserts that set equals
  `disabledPaths` exactly. A dependency bump that adds a sixteenth admin endpoint fails that test
  and forces a decision here, instead of publishing an unaudited sixteenth door.
- **The closure is tested from the outside too.** One integration test drives `auth.handler` with a
  real `admin`-role session cookie and asserts `404` from every one of the fifteen paths. It is the
  cheapest possible proof that the surface is shut, it does not care how it was shut, and it keeps
  passing if a later round replaces `disabledPaths` with something better.

`disabledPaths` closes the fifteen paths the `admin` plugin adds. It is not a licence to close
others: the `organization`, `twoFactor` and `passkey` endpoints already in use stay open, because
they are organization-level and user-level surfaces that Better Auth authorises correctly and this
document does not govern - with four exceptions. Two are closed by the plugin's own options and not
by `disabledPaths`: `organization/create`, which §2.7 closes with `allowUserToCreateOrganization: false`,
and `organization/delete`, closed with `disableOrganizationDeletion: true`. The other two are closed by
`disabledPaths` through its own list (`DISABLED_ORGANIZATION_PATHS` in
`src/server/auth/admin-options.ts`, merged with the fifteen admin paths into `DISABLED_PATHS`, which is
what `src/server/auth/index.ts` passes). `organization/update-member-role` writes a role without an
audit row, accepts a comma-joined role such as `admin,owner`, and lets an admin grant `owner`, none of
which the product-owned `changeMemberRoleFn` (§6.4, #995) allows. `organization/remove-member` deletes
the `member` row for an owner or an admin with no audit entry and no refusal during impersonation
(#1010). The in-process `auth.api.updateMemberRole` and `auth.api.removeMember` are not HTTP paths and
stay callable; the product-owned removal (#1008) must remove members through `auth.api.removeMember`
and not through the repository's `removeMember`, because the plugin's after-hook is what queues the
removed person's room eviction, and the repository function has neither that hook, an owner ceiling
for an admin nor an audit entry. `organization/leave` stays open, because the leave screen needs it
(closing it to an impersonated session is #1402), so until #1008 ships a workspace has no way to
remove a member over HTTP. The deletion flag is checked before
the session is looked up, so the endpoint answers `404` with `ORGANIZATION_DELETION_DISABLED` to an
owner and to an anonymous caller alike (and refuses the in-process call too). Left open it would let
an owner delete the `organization` row, cascade over every tenant table - other members' private
trips included - and leave the provider subscription billing, the R2 objects orphaned and the audit
log silent. A workspace therefore has no HTTP deletion path until the product-owned one (#1000)
exists, and that change must decide the flag explicitly: a deletion done through repository SQL keeps
it, one that moved to the plugin's endpoint would have to remove it.
`src/server/auth/__tests__/auth-handler-closure.test.ts` pins the closure against the real handler.

### 2.7 Creating a workspace

Creating a workspace is an organization action, not a platform one, and it is the one place the
organization roles of the header are given a floor by this document. **`admin` is the minimum
organization role that may create a workspace**; a `member` is refused with the `role-required`
reason and is never shown the upgrade prompt, because they cannot pay. The role is the caller's role
in the workspace they are currently in, re-read from `member` on every request like any other.

The rule lives in `createWorkspace` (`src/server/fns/workspace-writes.ts`), which is the only way to
create one: Better Auth's own `POST /api/auth/organization/create` answers `403` to a signed-in caller
and `401` to an anonymous one (`allowUserToCreateOrganization: false`), because the plugin's endpoint
carries none of the rules below. `disabledPaths` gains no entry for it, and `organization/set-active` still
answers. In order, `createWorkspace` checks the role, then refuses an impersonated session (§6.4),
then the limit of twenty workspaces per account, which it reads from the same constant as the
plugin's `organizationLimit` because the plugin enforces that limit only inside its own endpoint,
and then the plan (Free keeps the one workspace it was provisioned with). The limit runs before the
plan so that an admin who already belongs to twenty workspaces is told so, not sent to pay for a
create that would still be refused.
`src/server/auth/__tests__/workspace-access.test.ts` pins this section to the constant the code
uses.

---

## 3. What an unauthenticated visitor may see

Four surfaces are reachable without a session beyond the marketing landing, the pricing page and
the legal pages. Each one gets an explicit visible list and an explicit never-visible list. A field
that appears in neither list is never-visible: the projections are whitelists, so silence is a
denial.

A Trip export is a downloadable snapshot for trip members. An owner or editor may include confirmation codes explicitly; the option is off by default, and a file shared outside the workspace should leave it off.

### 3.1 Shared trip - `/share/$token`

| Visible                                                                                               | Never visible                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Trip name, date range, cover image, destination summary                                               | Any organization identity: name, slug, id, logo, member list                                                                      |
| Day structure and per-day notes, within the `scopes` granted on the link                              | Any user identity beyond a display name and avatar on content the scopes already expose - never an email address, never a user id |
| Places on the itinerary with their exact coordinates, address and opening hours                       | Any other trip in the same organization, and any place not on this trip                                                           |
| Reservations, packing lists, budget totals and files - **each only if its own `scopes` flag is true** | Budget line-level notes, expense shares, settlements and payer identities when the `budget` scope is false                        |
| Collaboration messages when the `collab` scope is true                                                | Reservation confirmation codes, ticket numbers and booking references - redacted even when the `reservations` scope is true       |
| -                                                                                                     | The share token of any other link, `view_count`, `last_viewed_at`, `created_by`                                                   |
| -                                                                                                     | Anything from `subscriptions`, `usage_records`, `audit_log`, `notifications`, `user_settings`                                     |

`scopes` is the `ShareScopes` JSON already on `share_links` (`map`, `itinerary`, `reservations`,
`lists`, `budget`, `collab`, `files`). A false flag removes the data from the projection, not from
the rendered page - the payload never leaves the Worker.

### 3.2 Shared atlas - `/share/$token`, `resource_kind = 'atlas'`

The atlas variant of `ShareScopes` carries its own flags - `countries`, `stats`, `bucketList` - and
they gate the rows below exactly the way the trip flags gate §3.1.

| Visible                                                                           | Never visible                                                    |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Visited countries and regions as map fill, and the counts derived from them       | The owner's email, user id, organization name or organization id |
| Aggregate statistics: countries, regions, continents, trip count, distance totals | Any journey entry text, journal photo or mood record             |
| Bucket-list items, when the atlas scope variant grants them                       | Per-trip dates, itineraries or place lists behind those visits   |
| A display name and avatar for attribution                                         | Home coordinates or any residential location                     |
| -                                                                                 | `view_count`, `last_viewed_at`, `created_by`, the token itself   |

### 3.3 Public pack page - `/packs` and `/packs/$slug`

| Visible                                                                                              | Never visible                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Pack slug, name, description, cover image, country codes, place count, price, currency               | Any place that is not in the published sample - the rest of the pack is the product                                 |
| A sample of at most **10** places: name, kind, city, region, country code, a curator-written summary | `catalog_places.notes`-class internal fields, `verified_by`, `verified_at`, `dedupe_key`, `status`, ingest payloads |
| **Approximate** coordinates for the sample only - see the decision below                             | Exact `lat` / `lng` of any catalogue place, sampled or not                                                          |
| Amenity chips from the closed vocabulary, season window, capacity                                    | Contact details a source publishes but we do not re-publish: `email`, `phone`                                       |
| Source attribution per place: `source_name`, `source_url`, licence note                              | Any pack whose `status` is not `published`, and any place whose `status` is not `published`                         |
| -                                                                                                    | `polar_product_id`, sales counts, entitlement holders, any `pack_entitlements` row                                  |

**Do place coordinates appear in a public pack sample? No - not the exact ones.** The sample map
draws from coordinates rounded to two decimal places, and the precise columns are not in the
projection at all: the catalogue read behind the projection selects `round(lat, 2)` and
`round(lng, 2)` in its own SELECT list, so the exact value never becomes a JavaScript value
anywhere on the sessionless path. Two decimal places is about 1.1 km north-to-south and about
0.7 km east-to-west at 52°N - enough to show a buyer that a pack is clustered along one coast
rather than scattered across a continent, and not enough to navigate to a pitch. The whole
commercial proposition of a pack is that its coordinates are correct; handing ten exact ones away
per pack, across every pack, is the catalogue with extra steps.

The contrast with §3.1 is deliberate and not an inconsistency. A shared trip shows exact
coordinates because they are the owner's own rows, and an owner who mints a share link is choosing
to hand them to whoever holds the link. A pack sample shows blurred ones because those rows are our
inventory and nobody has chosen anything.

### 3.4 The moderation projection (`share:read`)

Named here because §2.4 leans on it. It returns, per active link: link id, `resource_kind`, owning
organization id and name, creating user's display name, `created_at`, `expires_at`, `view_count`,
`last_viewed_at`, and the boolean `scopes` flags. It returns no resource content of any kind, and
it never returns the token - a moderator identifies a link by its id, not by a credential that
would let them open it.

It is read by `listShareLinksForModerationUnscoped` in `src/server/repos/shares.ts` and by nothing
else; §2.4 states why that function is allowed to run without a tenant scope and what bounds it.
`resource_kind` is the one field here that has no column behind it yet - see FU-4 in §7.

### 3.4a Calendar feed — `/api/feed/<secret>.ics`

A session-less, owner-bound, read-only calendar link is a bearer credential. The trip feed is
available through GET and HEAD. It reaches its tenant through exactly one `…Unscoped` repository
read: `findLiveFeedByDigestUnscoped` in `src/server/repos/calendar-feeds.ts`, called only by
`src/server/public/calendar-feed.ts`. Its projection is coordinates only; `ResolvedFeed` is branded
next to repo `openFeedScope`, which alone constructs the scope. The handler holds no SQL.

| Visible | Never visible |
| --- | --- |
| Trip title and dates; stop names, addresses, times and notes; day titles and notes; stay names and addresses; reservation and transport titles; leg endpoints and service numbers; event ids and edit timestamps; the app address of the trip (login required) | Confirmation numbers, booking references, seats, prices, provider URLs, participants, emails, user ids, workspace identity, files, other trips' data |

Only a person on the trip may create its feed, even when the trip is organization-visible.
Only the feed's owner may manage, rotate or revoke it; a trip owner cannot see or revoke another
person's feeds. Every live read checks the owner's current workspace membership and active ban,
and the trip membership for a trip feed. `COALESCE(rotated_at, created_at)` must be at least the
current workspace `member.created_at` and, for a trip feed, `trip_members.created_at`.
A missing membership, active ban, revoked link or inaccessible trip returns the same byte-identical
`404` as an unknown secret (subject to the refusal budget). Leaving and rejoining the workspace
or trip keeps the old link dead: the person creates a fresh one. Equality is allowed; a lifted
or expired ban restores a link because the membership row survives. No leave hook or offboarding
revocation write is needed. Removing a member or taking them off the trip is the workspace owner's
remedy for that member's leaked link. Already downloaded calendar data cannot be recalled.

The revealed region is Replay-blocked and provider handoffs are built at click time, rather than
stored in anchors. A handoff deliberately gives the secret to the selected calendar provider;
the browser's history may retain and sync the opened URL. Rotation or revocation stops subsequent
fetches, not copies already held by a provider or browser.

**Residual platform telemetry and merge condition.** Application-controlled Sentry events,
transactions, spans, breadcrumbs and logs must redact the secret; handler logs carry only the feed
id and never use `requestFields`. Cloudflare invocation logs **and OTLP platform trace export**
can carry the request URL outside repository redaction when enabled. The 2026-10-17 control
record below disables both channels in production and staging. Previously retained telemetry
may still contain live secrets; production-derived Sentry triage can copy retained data to GitHub.
Before merge, independently renewed security approval requires an explicit **OWNER** decision
accepting that exposure with restricted access, disabling invocation logs in both production and
staging while separately addressing OTLP exposure, or arranging account-side scrubbing for both
channels. The owner must also arrange a Cloudflare zone rate limit on `/api/feed/*`, since refusal
classification itself costs D1 reads. Panel `qa-approved` alone does not settle these conditions.
The Phase 2 PR carries the telemetry decision and zone rule on explicit lines and retains
`do-not-merge` unless that owner decision and zone protection are already recorded. Phase 4 must
restate the decision for the wider workspace feed. This is this credential surface's explicit
merge prerequisite, not a change to general workflow policy.

### 3.5 Indexing

- `/share/$token` is **`noindex`**. It is delivered twice, because a token URL is fetchable as
  something other than an HTML document: `<meta name="robots" content="noindex, nofollow">` from
  the route's `head`, and an `X-Robots-Tag: noindex, nofollow` response header on every response
  from that route. `robots.txt` deliberately does **not** `Disallow: /share/` - a disallowed path
  is never fetched, so the crawler would never read the directive that deindexes it.
- `/packs` and `/packs/$slug` are **indexable**: `index, follow`, a self-referencing canonical URL,
  Open Graph and Twitter card tags, and inclusion in the sitemap. Only packs whose `status` is
  `published` are listed in the sitemap; retiring a pack removes it from the sitemap in the same
  write that changes its status.

- `/api/feed/*` sends `X-Robots-Tag: noindex, nofollow` on every response, with
  `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer`; do not disallow it in
  `robots.txt`, because a crawler must fetch the header.

- `/join/$token` (§3.8) is **`noindex`** the same two ways as `/share/$token`: `<meta name="robots"
  content="noindex, nofollow">` from the route's `head`, and `X-Robots-Tag: noindex, nofollow` from
  its `headers`, together with `Cache-Control: private, no-store` and `Referrer-Policy:
  no-referrer`, on every response, found or not. Its title and description are generic (no trip, no
  inviter) and the route writes no trip-specific Open Graph or Twitter tag. Do not disallow it in
  `robots.txt`.

### 3.6 Rate limiting, by token and by IP

For share surfaces, counters live in KV with a 60 s TTL under versioned keys, one keyed by the hashed token and one by
the client IP:

| Budget                           | Limit                                    | Key                                 |
| -------------------------------- | ---------------------------------------- | ----------------------------------- |
| Per share token                  | 60 requests / minute                     | `public:rl:<v>:tok:<sha256(token)>` |
| Per IP, share public routes        | 120 requests / minute                    | `public:rl:<v>:ip:<ip>`             |
| Per IP, failed token resolutions | 20 / minute, then the IP budget is spent | `public:rl:<v>:miss:<ip>`           |

Over budget is `429` with `Retry-After`. An unknown, revoked or expired token returns exactly the
same `404` as a token that never existed, so the surface is not an oracle for guessing tokens, and
that miss also counts against the third budget above. If KV is unavailable the limiter fails
**open** and the request proceeds: the limiter is a courtesy control, and it is not the
authorisation boundary. Token resolution is the boundary and it never fails open - an unresolvable
token is a `404`, whatever KV is doing. `view_count` and `last_viewed_at` are updated
asynchronously through the queue, never inline, so a crawler cannot make a public read cost a D1
write per request.

The trip invite link (§3.8) spends three of these, in this order, and a dead link of any kind
spends the miss budget:

| Budget                                      | Limit          | Key                                           |
| ------------------------------------------- | -------------- | --------------------------------------------- |
| Per IP, all public routes                   | 120 / minute   | `public:rl:v1:ip:<ip>:<minute>`               |
| Per IP, failed resolutions ("misses")       | 20 / minute    | `public:rl:v1:invite-miss:<ip>:<minute>`      |
| Per resolved link                           | 60 / minute    | `public:rl:v1:invite:<sha256(secret)>:<minute>` |

Over budget is `429` with `Retry-After` on the **document** (the page renders the neutral
`join.error.busy` card: a shared NAT or hotel wifi can spend the miss budget, and the copy blames
nobody). The router derives a document's status only from its own state, so the loader answers
`busy` with a 200 view and the route's middleware turns the response into the 429 once the page
has rendered (`src/routes/join/-lib/busy.ts`). Every `/join` request costs one to three KV writes.
The authenticated join submit has its own two rows (`join-user`, `join-ip`) when that write lands.

Calendar providers share IPs, so calendar feeds use separate approximate minute counters:
60 requests/minute per live feed id (never digest), and 20/minute per IP for refusals only.
A live feed never spends or is refused by the shared-IP budget, including the 120/minute share
budget above. Unknown, revoked, rotated-away, owner-gone/banned and trip-unreadable resolutions
spend the refusal budget identically; malformed-but-shaped credentials do too. Wrong-shape paths
are rejected before resolution. Refusal timing is not claimed equal. Over budget is `429` with
`Retry-After`. Keys are `public:rl:v1:feed:<id>:<minute>` and
`public:rl:v1:miss:<ip>:<minute>` with 120 s TTL at HEAD. KV has no atomic increment, so these
are approximate and fail open on KV failure; credential resolution never fails open.
A counter spend costs one KV read and one write. The edge zone rule is required separately.

The calendar route is the bounded exception to queue-only access stamps: `touchFeed` runs in
`waitUntil` only when `last_served_at` is null or at least an hour old, at most one background
stamp per feed per hour under ordinary polling, not a D1 write per fetch. Enable and rotation
reset the stamp. `readFeedSource` is nine statements (one trip and eight content reads); a valid
trip poll also has the digest lookup, membership/ban read and indexed trip-membership check.

### 3.7 `src/server/public/**` is the only sessionless read path

Public share, published catalog, calendar and trip invite link projections use this path; the
bounded billing, moderation and cron discovery exceptions remain as stated in SPEC §5/§6. Three rules, all testable:

1. **Column whitelists only.** Every response is a named read-only projection that enumerates the
   columns a stranger may see. A field is not omitted by a `delete` after the fact and not hidden
   by a serializer - it is never selected, so leaking it is inexpressible rather than merely
   forbidden. Adding a field to a public surface means editing the projection, which means editing
   the visible list in §3.1-§3.4a in the same commit.
2. **No fabricated tenant context, ever.** A tenant repository must never be called from this path
   with an empty, placeholder or invented context. `src/server/repos/base.ts` exists so that
   forgetting the tenant filter is not expressible, and handing it a fake context to reach a row
   destroys the one guarantee it was built to give. The scope passed from this path is always the
   one derived from the share, feed or trip invite link record that was just resolved by token, and never constructed from a
   request parameter. A lint-level test asserts that no module under `src/server/public/**`
   constructs a tenant scope itself. For feeds only repo `openFeedScope` accepts the
   adjacent branded `ResolvedFeed` and constructs the owner-bound scope. A trip invite link reaches
   its row through one `…Unscoped` read, `findLiveTripInviteByDigestUnscoped` in
   `src/server/repos/invites.ts`, called only by `src/server/public/trip-invite.ts`, which returns
   coordinates and constructs no scope (ADR 0042). Repositories may import the pure secret module
   `src/server/security/secret.ts` (derive, digest, shape guard); they never import
   `src/server/public/**`.
3. **It holds no SQL of its own** (SPEC §6). Token-resolved tenant resources go through
   `src/server/repos`; published global rows go through `src/server/catalog`. This module owns the
   whitelist and nothing else.

### 3.8 Trip invite link - `/join/$token`

A session-less **read** of a bearer credential, with a session read only to decide what the page
shows. The route lives outside `_app`, so no auth guard runs and an anonymous visitor is never
bounced. It reaches its tenant through two `…Unscoped` repository reads, both in
`src/server/repos/invites.ts` and called only by `src/server/public/trip-invite.ts`:
`findLiveTripInviteByDigestUnscoped` (coordinates only) and `readInvitePreviewUnscoped` (the
projection below). The handler holds no SQL, builds no scope and calls no auth helper: the
visitor's session is read by the route's server function (`src/routes/join/-server/join.ts`) and
handed in as data (`{ id, banned }`). **`src/server/public/**` stays read-only here, and a
`GET` of `/join/<secret>` writes nothing**: no `use_count`, no `trip_members` row, no stamp. The
write that puts a person on a trip is a separate authenticated server function.

| Visitor                                             | Visible                                                                                              | Never visible                                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Anonymous                                           | Trip title, the inviter's display name and avatar, the role the link offers                          | Dates, destination, cover, the workspace's name, slug, id or logo, the inviter's email or user id, every id               |
| Signed in, member of the link's workspace           | The above, plus the trip's dates and destination; or "already on this trip" with a link to the trip  | `use_count`, `created_by`, the digest, the secret; the trip and workspace ids unless the viewer is already on the trip    |
| Signed in, **not** a member of the link's workspace | Trip title, the inviter's display name, and the visitor's own signed-in email                        | Dates, destination, the workspace in any form                                                                             |
| Anything else (all dead links, a banned viewer)     | One identical 404 page                                                                               | Which of unknown, switched off, replaced, archived or creator-gone killed it                                              |

The projections are whitelists: a field in neither column is never selected. A signed-in visitor
who is a member of the link's workspace is the only one shown dates and destination, because a
forwarded URL reaches people the owner never picked and name plus dates plus destination plus a
real name is the most sensitive combination on the page. A dead link throws `notFound()` from the
loader, so the document is a 404 with the same body whoever asks; its `Cache-Control`,
`X-Robots-Tag` and `Referrer-Policy` are those of a live link (§3.5). Rate limits are §3.6.

The guest chrome is the marketing frame with its `minimal` variant (logo and theme toggle; no
"Sign in", "Start free" or "See pricing"): those links would drop the `?redirect=` that brings the
visitor back to the link. The sign-in action is `/login?redirect=/join/<secret>`, and the sign-in
pages carry a `strict-origin` referrer meta so a `redirect` carrying the link is not sent onward in
a `Referer`.

**Telemetry.** The secret is redacted from every Sentry channel (`docs/DEPLOY.md` §17.2), logs for
this surface carry the link id and the outcome and never the path, and the session recorder does not
run on a join location - the page itself and a sign-in page whose `redirect` or `callbackURL`
carries the link, at any encoding depth (`src/lib/sentry-replay.ts`). The "Report a problem" button is
not offered there either: a screenshot is an attachment no scrub can read
(`src/components/layout/feedback-widget.tsx`).

---

## 4. Audit

### 4.1 `platform_audit_log` - the global table

Twelve columns, and this is the whole list. `docs/CATALOG.md` §2.12 depends on this table and does
not own it, and deliberately reproduces none of it: it points here for the columns, the indexes and
the retention rather than restating them, so there is one list and it is this one.

| Column          | Type                                                   | Null | Notes                                                                                                                                                            |
| --------------- | ------------------------------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | `pk()`                                                 | no   | nanoid, house convention                                                                                                                                         |
| `actor_user_id` | `userRef('actor_user_id')`                             | yes  | The human, or the owner of the MCP token. `NULL` only when `actor_kind = 'system'`                                                                               |
| `actor_kind`    | text, `enumCheck()`                                    | no   | `human` · `agent` · `system`                                                                                                                                     |
| `actor_role`    | text                                                   | yes  | The platform role held **at the moment of the action**: `admin`, `curator` or `user`. `NULL` only when `actor_kind = 'system'`                                   |
| `token_id`      | text, FK → `staff_api_tokens.id`, `on delete restrict` | yes  | The credential the call arrived on. Non-`NULL` exactly when `actor_kind = 'agent'`, and `NULL` for every other kind                                              |
| `action`        | text                                                   | no   | Lowercase dotted verb from the closed list in §4.2                                                                                                               |
| `entity_type`   | text                                                   | no   | `catalog_place` · `catalog_ingest` · `place_pack` · `catalog_source` · `user` · `session` · `staff_api_token` · `share_link` · `provider`. The mapping to `action` is in §4.2 |
| `entity_id`     | text                                                   | yes  | The row the action touched. `NULL` only for an action whose entity does not exist yet or no longer does                                                          |
| `changes`       | text, JSON                                             | yes  | `{ before, after }` - the fields that moved, on both sides                                                                                                       |
| `ip`            | text                                                   | yes  | The request IP, bounded (§4.1a). `NULL` for `system`                                                                                                             |
| `user_agent`    | text                                                   | yes  | The request's `User-Agent` header and nothing else, bounded (§4.1a). `NULL` when the request sent none                                                           |
| `created_at`    | `createdAt()`                                          | no   | Append time                                                                                                                                                      |

This shape adopts the change `docs/CATALOG.md` files as its §13.9 and sketches in its §2.12 - a
real `token_id` foreign key in place of a token identity smuggled through `user_agent`. That
document now says the same thing in prose as well as in shape: its §2.12 closes by recording that
there is nothing left to propose, and its §13.9 records the item as settled. The two files agreed
on the columns before they agreed on the wording; they agree on both now, which is why **FU-6** in
§7 is closed.

Four invariants are `CHECK` constraints rather than prose, because each is the kind of rule that
decays into a convention the first time a caller is in a hurry:

- `actor_kind = 'agent'` implies `token_id is not null`
- `actor_kind = 'system'` implies `actor_user_id is null` **and** `actor_role is null` **and**
  `token_id is null`
- `token_id is not null` implies `actor_kind = 'agent'` - the other half of the Notes column's
  "non-`NULL` exactly when", without which a console action can wear a credential
- `actor_kind <> 'system'` implies `actor_user_id is not null` **and** `actor_role is not null` -
  the other half of "`NULL` only when `actor_kind = 'system'`", without which the log can hold a
  row with no actor

**Why four and not the two this paragraph used to name.** Faza B shipped the two, and the round's
auditor then ran the emitted SQL into `node:sqlite` and inserted against it rather than reading it:
a `human` row carrying a `token_id` was accepted, and so were `human` and `agent` rows with a
`NULL` `actor_user_id`. All three contradict the Notes column above. Prose that the schema does
not enforce is a convention, and this table is the one place in the product where a convention is
not enough. The two extra constraints landed while migration `0005` had still never left its
worktree, which is the only window in which the shape of this table is free to change: SQLite
cannot add a `CHECK` to an existing table, so `docs/DEPLOY.md` §register would have had to carry a
non-additive recreate instead.

`actor_kind` additionally carries the ordinary single-column `enumCheck()` named in the type
column, so five constraints ship in total.

### 4.1a Why `ip` and `user_agent` are bounded rather than verbatim

The two columns hold attacker-controlled request headers and this table is append-only with
400-day retention, so "verbatim" as an unqualified promise meant an unbounded write on every
platform mutation. Faza B's auditor demonstrated the cost with a probe rather than an argument.
Both are therefore capped, and a value that exceeds the cap is stored truncated **with an explicit
mark**, never silently shortened and never replaced by `NULL`: `NULL` on `user_agent` already
means "the request sent none", and collapsing a refusal into that value would make the row report
the wrong fact about a request thirteen months later, when the log line explaining it has long
aged out.

Two consequences worth stating, because both were found by measurement:

- A client can send a header that already ends with the truncation mark, so a forged
  "this was truncated" row is not distinguishable from a genuine one by the mark alone. The mark
  is a reader's aid, not evidence; nothing in the product may branch on it.
- The bound belongs to the writer, not to the schema. Changing it is a code change, not a
  migration, which is the reason it is expressed here as a rule rather than as a column type.

**`entity_type` is narrowed in TypeScript, not in SQL, and that is deliberate.** The type column
above says plain `text` for it while marking `actor_kind` as `text, enumCheck()`, and the
distinction is the point: §4.2's entity list grows by amendment in the commit that adds the code
writing it, and a `CHECK` would price each of those amendments at a table recreate. The narrowing
that does exist is `$type<PlatformAuditEntityType>()` on the column, so a value outside the nine
fails `pnpm typecheck`. The same reasoning governs `action`, whose vocabulary in §4.2 is closed and
grows the same way. A schema that drops the `CHECK` without adding the `$type` has narrowed the
column nowhere at all, which is what the first attempt did.

Indexes: `(entity_type, entity_id, created_at)` for the timeline query in §4.4,
`(actor_user_id, created_at)`, `(action, created_at)`, `(token_id)`, and `(created_at)` for the
prune. The timeline query in §4.4 filters on `(entity_type, entity_id)` and orders by
`created_at`, so the three-column index above serves it whole; no two-column index is created
beside it. `docs/CATALOG.md` §2.12 lists no index of its own and reads this list from here.

**Why `actor_role` and `token_id` are columns and not fields inside `changes`.** Both are asked
about in queries rather than read off a row somebody already found: "everything a curator did last
week", "everything that arrived on the token we just revoked". A JSON field cannot carry the
`(token_id)` index that second question needs, and it cannot carry the foreign key that makes a
revoked token's history traceable after the token row is gone. `actor_role` is recorded as a value
for a sharper reason: `user.role` is mutable. A log that resolves the role by joining `user` at
query time reports every past action of a promoted account under the role it holds today, which
silently rewrites the record of what a curator was allowed to do. The role at the time is a fact
about the event and is stored with it.

**`user_agent` carries a User-Agent and nothing else.** An earlier form of this table packed the
MCP token's name and id into that column because an MCP call has no browser UA. That is the shape
of leak that makes a log untrustworthy: a column whose meaning depends on the value of another
column cannot be indexed, cannot be filtered, and cannot be read by anyone who has not read this
paragraph. The credential now lives in `token_id`, the role in `actor_role`, and an `agent` row
simply has a `NULL` `user_agent` when the client sent no header.

It carries **no** `organization_id`. It is platform content, and SPEC §5's carve-out list now
names it as the ninth of nine - the amendment FU-2 in §7 asked for, made in Faza B by the round
that owns that file.

`actor_kind` in three sentences. `human` is a signed-in platform role acting through the console.
`agent` is an MCP call authenticated by a `staff_api_tokens` bearer, attributed to the token's
owner in `actor_user_id` and to the credential in `token_id`. `system` is the platform itself - the
weekly scrape cron, the ingest matcher, the retention prune - with no user and no credential behind
it.

### 4.2 The action vocabulary: one regex, one shape, one closed list

`action` is validated by the identical rule the tenant audit log already enforces:

```
/^[a-z0-9]+(?:[._][a-z0-9]+)*$/   // 'must be a lowercase dotted action', trimmed, 1..64 chars
```

It is **imported**, not re-declared. Its home is `src/server/db/audit-action.ts`, a leaf module
that imports nothing, and both `src/server/repos/audit.ts` and `src/server/catalog/audit.ts` read
it from there.

**Why it lives in a third place rather than in the tenant log that declared it.** Faza B's first
attempt imported it straight from `src/server/repos/audit.ts`, which satisfies the sentence above
and quietly breaks SPEC §5: that module imports `./base` and calls `createTenantRepository()` at
module-evaluation time, so importing the constant drags the tenant repository into the global
table's module graph - the one graph SPEC §5 says must never reach it. A leaf module satisfies both
rules at once, and it is the only arrangement that does: re-declaring the regex breaks this section,
and importing it across the layer boundary breaks that one.

But a shared regex only prevents two spellings of a
character class; it happily accepts `catalog_place.published` and `place.published` as
two different verbs for one event, and a log with two names for one event answers no question
correctly. So the shape and the list are fixed here too.

**The last segment is the verb, in the past tense; every segment before it is the prefix, and the
prefix names the entity.** Underscores are ordinary characters on both sides of that split. They
occur inside an entity name - `catalog_place`, `place_pack` - and inside a compound verb -
`role_changed`, `places_set` - and the imported regex permits them in any segment. What
distinguishes the two prefix forms is the segment count, never the underscore.

There are exactly two prefix forms, and the entity decides which one an action takes. A catalogue
action is the two-segment `<entity_type>.<verb>` form, and its prefix is the `entity_type` spelled
verbatim. Two segments is also the shape of every audit action name any code path in this
repository writes today - nine of them, from `trip.created` to `billing.plan_changed` - which is
the whole of what precedent settles here. Nine is what a grep of the `action:` literals
demonstrates, and the claim is deliberately no wider than the grep: `member.role_changed`, the
second example in the JSDoc at `src/server/repos/audit.ts:30`, is a tenth name this codebase
mentions and nothing writes, and it is two segments as well - so it moves the count and never the
shape. Precedent settles no more than that: none of the nine is written by a production path,
seven being seed rows in `src/routes/api/dev/-seed/dataset/workspace.ts` and the other two,
`place.created` and `trip.hijacked`, appearing only under `src/server/repos/__tests__/`;
and one of them, `billing.plan_changed`, is recorded against `entity_type: 'subscription'`, so the
prefix-equals-`entity_type` rule is declared by the table below rather than inherited from them.

An action on a user, a session, a credential or a share takes the three-segment
`platform.<entity>.<verb>`, because those entities are named identically in the tenant log of §4.5
and a bare `user.created` read out of an operational view spanning both tables would be
attributable to neither. Eighteen of the thirty-four actions below take the first form and sixteen
take the second; no third form exists.

Everything before the verb fixes the `entity_type` written beside it, so §4.4's query never has to
guess which prefix belongs to which table:

| Action prefix        | `entity_type`     |
| -------------------- | ----------------- |
| `catalog_place.*`    | `catalog_place`   |
| `catalog_ingest.*`   | `catalog_ingest`  |
| `place_pack.*`       | `place_pack`      |
| `catalog_source.*`   | `catalog_source`  |
| `platform.user.*`    | `user`            |
| `platform.session.*` | `session`         |
| `platform.token.*`   | `staff_api_token` |
| `platform.share.*`   | `share_link`      |
| `provider.*`         | `provider`        |

**The list is closed.** Every action this platform can ever write is below. A new action is an
edit to this table, in the commit that adds the code that writes it.

`docs/CATALOG.md` §8.4 owns the catalogue actions an MCP tool can emit. Its thirteen names -
declared across that tool table, its status-transition table (§7.2) and its licence rule (§5.4) -
are reproduced below character for character rather than paraphrased, and this section claims no
authority over them: where the two files ever disagree about **one of those thirteen**, that one is
right.

The deference is to the thirteen names and to nothing wider. Closing the catalogue vocabulary in
§8.4 closes the set of catalogue actions the MCP surface emits, not the set of catalogue actions
this platform writes: `place_pack.retired`, `catalog_source.enabled` and `catalog_source.disabled`
are reachable only from the console, no MCP tool can produce them, and they are therefore declared
here and are legal here. Those three and every `platform.*` action are what this section owns, and
they are marked "here" in the last column.

| Action                                | Written when                                                                                                          | Declared in                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `catalog_place.created`               | A catalogue record is created                                                                                         | `docs/CATALOG.md` §8.4             |
| `catalog_place.updated`               | A catalogue record's fields change                                                                                    | `docs/CATALOG.md` §8.4             |
| `catalog_place.published`             | A record moves to `published`                                                                                         | `docs/CATALOG.md` §8.4             |
| `catalog_place.retired`               | A record moves to `retired`                                                                                           | `docs/CATALOG.md` §8.4, §7.2       |
| `catalog_place.status_changed`        | Any other status transition                                                                                           | `docs/CATALOG.md` §8.4, §7.2       |
| `catalog_place.licence_escalated`     | A new source forces a stricter licence and unpublishes the record                                                     | `docs/CATALOG.md` §5.4 rule 3      |
| `catalog_ingest.promoted`             | An ingest row becomes a new catalogue record                                                                          | `docs/CATALOG.md` §8.4             |
| `catalog_ingest.merged`               | An ingest row is merged into an existing record                                                                       | `docs/CATALOG.md` §8.4             |
| `catalog_ingest.rejected`             | An ingest row is rejected with a reason                                                                               | `docs/CATALOG.md` §8.4             |
| `place_pack.created`                  | A pack is created                                                                                                     | `docs/CATALOG.md` §8.4             |
| `place_pack.places_set`               | A pack's member places or their order change                                                                          | `docs/CATALOG.md` §8.4             |
| `place_pack.published`                | A pack moves to `published`                                                                                           | `docs/CATALOG.md` §8.4             |
| `catalog_source.run_started`          | A source run is started, by a curator or by the weekly cron                                                           | `docs/CATALOG.md` §8.4             |
| `place_pack.retired`                  | A pack moves to `retired` - console-only; no MCP tool retires a pack                                                  | here (`pack:publish`, §1.2)        |
| `catalog_source.enabled`              | A source is enabled - console-only                                                                                    | here (`source:run`, §1.2)          |
| `catalog_source.disabled`             | A source is disabled - console-only                                                                                   | here (`source:run`, §1.2)          |
| `platform.user.created`               | An account is created from the console                                                                                | here (`user:create`)               |
| `platform.user.updated`               | An account's profile fields are changed from the console                                                              | here (`user:update`)               |
| `platform.user.role_changed`          | A platform role is set; `changes` carries before and after                                                            | here (`user:set-role`)             |
| `platform.user.banned`                | An account is banned; `changes` carries reason and expiry                                                             | here (`user:ban`)                  |
| `platform.user.unbanned`              | A ban is lifted                                                                                                       | here (`user:ban`)                  |
| `platform.user.deleted`               | An account is deleted; refused for the only owner of a workspace other people belong to (`target-sole-owner`, no row) | here (`user:delete`)               |
| `platform.user.password_set`          | An administrator sets a password; the value is never in `changes`                                                     | here (`user:set-password`)         |
| `platform.user.email_set`             | An administrator changes an address                                                                                   | here (`user:set-email`)            |
| `platform.user.impersonation_started` | Impersonation begins; `entity_id` is the target                                                                       | here (§6)                          |
| `platform.user.impersonation_ended`   | Impersonation ends by the **End impersonation** action                                                                | here (§6)                          |
| `platform.user.impersonation_workspace_changed` | An impersonated session changes its active workspace, from `databaseHooks.session.update` (§6.4); `entity_id` is the target, the actor is the operator | here (§6.4) |
| `platform.session.revoked`            | One session of one account is revoked                                                                                 | here (`session:revoke`)            |
| `platform.session.revoked_all`        | Every session of one account is revoked                                                                               | here (`session:revoke`)            |
| `platform.token.issued`               | An MCP token is minted; the token itself is never in `changes`                                                        | here (§5)                          |
| `platform.token.revoked`              | An MCP token is revoked, by hand or by a role change                                                                  | here (§5)                          |
| `platform.share.revoked`              | A moderator revokes a share link                                                                                      | here (`share:revoke`, §2.4)        |
| `provider.limit_changed`              | A third-party call ceiling or its window is set; `changes` carries before and after                                   | here (`provider:configure`, §2.3b) |
| `provider.policy_changed`             | A provider's over-ceiling policy moves between `allow` and `block`                                                    | here (`provider:configure`, §2.3b) |

Thirty-four actions. Five notes so the list cannot be miscounted or misread:

- `catalog.run.poll` appears in `docs/CATALOG.md` §2.4 and is **not** in this list on purpose. It is
  the name of a queue task on `TASKS`, not an audit action, and nothing writes a
  `platform_audit_log` row under it. Its `catalog` prefix is not an action prefix at all - the
  prefix table above has no such row - so it cannot be mistaken for a member of this list; the note
  is here because the two vocabularies are dotted and adjacent, not because they collide.
- Reads are not audited, in the console or over MCP, for the reasons `docs/CATALOG.md` §8.3 gives.
  There is deliberately no `catalog_place.read`.
- Every **mutating** statement in §2.1 and §2.2 has exactly one action prefix here, and that is the
  point: an `admin` capability with no action name would be a capability that leaves no trace.
  `user:create` → `platform.user.created`; `user:update` → `platform.user.updated`; `user:set-role`
  → `platform.user.role_changed`; `user:ban` → `banned` and `unbanned`; `user:delete` →
  `platform.user.deleted`; `user:set-password` → `platform.user.password_set`; `user:set-email` →
  `platform.user.email_set`; `user:impersonate` → the two impersonation verbs; `session:revoke` and
  `session:delete` → `platform.session.revoked` and `platform.session.revoked_all`. The three
  read-only statements - `user:list`, `user:get`, `session:list` - have no action, per the previous
  note. `user:impersonate-admins` has none either, because §2.4 grants it to no role, so nothing can
  ever write under it.
- `platform.user.impersonation_workspace_changed` belongs to no §1.1 statement. It is not a capability
  somebody exercises: it is the trace of a session moving between workspaces while `user:impersonate`
  is in use, written by the auth layer itself (§4.3, §6.4), so it has no entry in the previous note's
  mapping and needs none.

A unit test asserts the union of the action constants exported by `src/server/catalog` and
`src/server/fns/console/*` equals this list exactly, that every one of them matches the imported
regex, and that every one of them begins with a prefix listed in the prefix table above - which is
the machine-checkable half of the shape, and the half §4.4's query depends on. A name that exists
in code and not in this table fails it; so does a name in this table that nothing writes.

### 4.3 Append-only, and never a reason to fail

- **Append-only.** Rows are never updated. The only delete path is the retention cron
  (`17 4 * * 1`) pruning by `created_at`, on a retention window of **400 days** - thirteen months,
  so a full financial year plus a month is always readable. No other code path deletes from this
  table; a console action that "removes an entry" does not exist. The prune runs on the platform
  path with an `actor_kind: 'system'` actor and does not audit itself - how many rows it removed is
  a structured log line, not a row in the table it just pruned.
- **An audit write must never be the reason a user's action fails.** This is the same rule the
  tenant log already states in its own header, and it needs care here because SPEC §5 requires the
  entry to be written "in the same call" as the mutation. Same call, not the same transaction: the
  row change commits, then the entry is appended, and a rejected append is a logging incident
  raised through `src/server/observability` - never a `500` handed to the caller, and never a
  rollback of work that already succeeded.
- **Ban and impersonation are always audited.** `platform.user.banned`, `platform.user.unbanned`,
  `platform.user.impersonation_started`, `platform.user.impersonation_ended` and
  `platform.user.impersonation_workspace_changed` are appended without exception. For the first
  four that claim rests entirely on §2.6 (the fifth rests on a different mechanism, described after
  the two stated exceptions below): `/admin/ban-user`, `/admin/unban-user`, `/admin/impersonate-user`
  and `/admin/stop-impersonating` all answer `404` over HTTP, so `src/server/fns/console/*` is the
  only caller of the endpoints behind them, and the append sits on that one path. Without §2.6
  "without exception" would mean "unless somebody opens a devtools console", and the five verbs
  here are precisely the ones nobody would think to check afterwards. If
  the append is rejected for one of these five, it is retried once and then raised at the highest
  severity the logger has - the action still stands, because reversing a completed ban because a
  log write failed is the worse of the two failures. **Two stated exceptions, both found in Faza B
  by reading the plugin rather than by trusting this sentence.** First, a _temporary_ ban lifts
  itself: `admin()`'s `session.create.before` hook writes
  `{ banned: false, banReason: null, banExpires: null }` on the next ordinary sign-in once
  `banExpires` has passed, with no console call to hang an append on. That path is audited from a
  `databaseHooks.user.update.after` tripwire as `actor_kind = 'system'`, which is why the ban
  ledger stays complete and why the hook swallows every error it can raise - see the bullet above.
  Second, impersonation **by expiry** produces no event at all: the row is deleted lazily on the
  next request, and under KV secondary storage it usually just TTLs away, so there is no moment at
  which anything could append. §4.2's entry was narrowed to the action accordingly. An impersonated
  session that simply lapses is visible as a `platform.user.impersonation_started` with no matching
  `_ended` inside 900 seconds, and that is the only signal there is. **The fifth verb is written by
  the auth layer rather than by a console call.** `platform.user.impersonation_workspace_changed` is
  appended from `databaseHooks.session.update` in `src/server/auth/index.ts`, after the session update
  has committed, because every change of `activeOrganizationId` goes through Better Auth's
  `updateSession` (set-active, accepting an invitation, leaving a workspace, and the refusals that
  clear it) and none of them goes through a server function: a hook on one URL misses the others, and
  a wrapper misses a direct `POST /api/auth/organization/set-active`. Removing the target from a
  workspace is not one of them: the plugin clears only the session of the member who makes the call,
  so the worn session keeps its workspace and the §6.4 fallback applies on the next request. It
  appends only when the update payload names `activeOrganizationId` and the session's `impersonatedBy`
  is set, so a session refresh costs nothing. It is retried once and raised at `error` like the other
  four, and like the ban tripwire it swallows every error it can raise: a switch that succeeded is
  never failed by its own audit row. **Its two stated gaps are logged at `error`, never silent:** an
  operator role that cannot be read writes no row (§6.4), and neither does an impersonated update that
  reaches the hook without a request context (`audit.impersonation-workspace.no-context`). Also always audited: `platform.user.role_changed`,
  `platform.user.deleted`, `platform.session.revoked`, `platform.session.revoked_all`,
  `platform.token.issued`, `platform.token.revoked`, and every `catalog_place.*` /
  `catalog_ingest.*` / `place_pack.*` / `catalog_source.*` / `platform.share.*` mutation in §4.2's
  table.

### 4.4 The query that makes this log worth having

```sql
select * from platform_audit_log
where entity_type = 'catalog_place' and entity_id = ?
order by created_at desc;
```

That is a place's full timeline, and the `changes` JSON on each row carries the before and after of
every field that moved. It is why there is no separate catalogue revision table: a revision table
would store the same data a second time, and the moment the two disagree there is no principled
answer to which one is true. One append-only log, one index, one range scan - and the curator
detail screen renders the timeline from it directly.

### 4.5 The tenant log is unchanged

`audit_log` (`src/server/db/schema.ts`) stays exactly as it is: `organization_id`-scoped, written
through `src/server/repos/audit.ts` on `createTenantRepository()`, with its `metadata` JSON column
and no `actor_kind`. It records what happened inside a workspace. `platform_audit_log` records what
happened to the platform. They are never merged, never joined, and never read through each other's
repository. The one place they meet is §6.4: a tenant write performed during an impersonated
session stamps the impersonator into the existing `metadata` column as `impersonatedBy: <operator
user id>`, which is a value change and not a schema change. `trail()` (`src/server/audit/trail.ts`)
does it, from the tenant context's `impersonatedBy`, which `requireOrgFrom` reads off the session; it
is implemented (#1010).

---

## 5. MCP token blast radius

**A static bearer token carries its owner's whole platform role with no scopes of any kind, so an
`admin`-owned token is a full-platform credential in a config file - which is why MCP tokens are
issued to `curator` accounts only.**

The rest follows from that sentence:

- The transport has no scope mechanism. An HTTP MCP client authenticates with one static header;
  there is nothing in the protocol that narrows what the token may reach. Authority comes from the
  owner's role through the same `requirePermission` the console uses, and from nowhere else.
- Issuance to an `admin` account is refused by the issuing surface, not by convention. A token
  whose owner later becomes `admin` is revoked by that role change, in the same call, audited as
  `platform.token.revoked` - a role promotion must not silently upgrade a credential that is
  sitting in someone's `~/.claude.json`.

  **Which phase owes this, settled in Faza B.** The revocation rides on the role change, so it
  reads like console work - but it can only revoke credentials that a surface has issued, and this
  phase issues none. Faza B creates the `staff_api_tokens` table and stops there, by the user's
  decision of 23.08: issuance, revocation and the `console/tokens` screen all land in Faza E,
  where §5's other rules already live. Until then the table is empty, so the rule above is
  vacuously satisfied rather than unimplemented. Faza B's console role-change function carries a
  header note pointing here, so the gap is a stated deferral instead of something a later reader
  has to discover. A Faza E round that ships issuance without this revocation ships a real hole.

- Tokens are stored hashed with `MCP_TOKEN_PEPPER` and shown once. Rotating the pepper invalidates
  every issued token at once, which is the break-glass control.
- Every token has an `expires_at`. A token without an expiry is not issuable.
- Every MCP mutation writes `platform_audit_log` with `actor_kind: 'agent'`, the owner in
  `actor_user_id`, the role that owner held in `actor_role`, and the credential in `token_id`
  (§4.1), so "which agent did this, on whose authority, with which token" is answerable with one
  indexed query and no log correlation. Revocation stamps `revoked_at` on the token row and never
  deletes it, which is what keeps that join intact. A `staff_api_tokens` row is never
  hard-deleted, and `token_id` is `on delete restrict`.

  The earlier `set null` was a clause that could never fire, and Faza B's auditor showed why: with
  §4.1's two token CHECKs both in force - an `agent` row must carry a token, and only an `agent`
  row may carry one - every `SET NULL` the foreign key could perform violates one of them, so the
  database refuses the parent delete either way. `restrict` is the behaviour that was already
  happening; naming it is the difference between a rule and an accident. The attribution this
  protects rests on the sentence above, that a token row is never hard-deleted, rather than on a
  fallback that cannot run.

- A token belongs in user-scope MCP configuration, never in a file that gets committed. The
  operational detail lives in `docs/DEPLOY.md` and `docs/CATALOG.md`; the rule that it is
  `curator`-only lives here.

---

## 6. Impersonation

Impersonation is the most dangerous capability in the product: it produces a session that is
indistinguishable from the user's own to every screen that does not check for it. The requirements
below are hard requirements.

### 6.1 The warning bar is mandatory

Whenever `session.impersonatedBy` is set, a persistent warning bar is visible on **every** screen.
Not most screens, not the console - every screen, rendered by the app shell above the route
outlet, so no route can omit it and no route can scroll it away.

**The bound on "every".** The app shell meant here is `AppShell` in `src/routes/_app/route.tsx`,
which wraps the authenticated tree and is the only wrapper with a session in scope. "Every screen"
therefore means every screen under `/_app`, and that is the whole of it. The `(auth)` tree and the
public marketing pages render under `RootDocument`, whose router context carries `queryClient`
alone; threading a session into it would put an auth read in front of every public page to cover a
case that should not arise, because an impersonated operator has no business on `/login` or
`/pricing`. Decided in Faza B and written down here rather than left for a builder to discover as
a gap between this sentence and the code.

It carries, at minimum: that this is an impersonated session, whose account is being acted on, who
is doing the acting, the time remaining on the session as a live countdown with
`font-variant-numeric: tabular-nums`, and an **End impersonation** action. The action is a real
button - reachable by keyboard, first in the shell's focus order, with hover, `focus-visible`,
active, disabled and loading states - and it calls our `endImpersonation` server function, which
appends `platform.user.impersonation_ended` to `platform_audit_log` and then calls
`auth.api.stopImpersonating` in process, restoring the admin's own session from the signed
`admin_session` cookie the plugin set when impersonation began. It does not call the plugin's
`/admin/stop-impersonating` endpoint directly, because §2.6 answers that path with `404`; the
detour is what makes the second half of the impersonation lifecycle auditable.

The bar is not dismissible. A dismissible warning about a live credential for someone else's
account is a warning that will be dismissed.

### 6.2 Maximum session duration

Better Auth's `impersonationSessionDuration` defaults to **3600 seconds (1 hour)** - the fallback
is `getDate(3600, 'sec')` in the plugin's impersonation route. **Our value is 900 seconds (15
minutes)**, set explicitly in the plugin options rather than left to the default. Fifteen minutes
is long enough to reproduce a support report and short enough that an unattended laptop expires
before its owner is back with coffee. When it expires the session is simply gone: the browser lands
on the login screen, the stale `admin_session` cookie is cleared on that same request rather than
left to linger, and the admin signs in again as themselves.

The 900 seconds is enforced server-side by four mechanisms, because setting the option alone does
not hold it. Better Auth's sliding refresh (`updateAge`, one day) rewrites `expiresAt` to now plus
the global 30-day `expiresIn` on the first read of any session older than that, and a 900-second
session always is. The only thing that skips the refresh is the signed `dont_remember` cookie, which
the client supplies: whoever holds the session token and leaves that cookie out would otherwise
extend the impersonation to 30 days (#1358). So:

- **The update clamp.** The session `update.before` hook in `src/server/auth/index.ts` keeps an
  impersonated session's `expiresAt` at `min(stored expiry, createdAt + 900 s)` whenever a patch
  tries to move it, and drops `expiresAt` from a patch whose session it cannot resolve (fail
  closed). Patches that do not touch `expiresAt`, such as organisation set-active, pass through, and
  ordinary sessions keep the 30-day sliding refresh.
- **The cookie guard.** A plugin `after` hook (`impersonationCookieGuard`) drops the session-token
  `Set-Cookie` the refresh would have re-issued with a 30-day `Max-Age` for an impersonated session.
- **The read-side guard, server functions.** `normaliseSession` in `src/server/auth/tenant.ts`
  returns no session for an impersonated one whose `createdAt` plus 900 s is in the past, whatever
  its row says, so a row extended before the clamp shipped stops authorising at once.
- **The read-side guard, Better Auth's own endpoints.** Every `/api/auth/*` endpoint resolves the
  session inside the library and never reaches `normaliseSession`, so a plugin `before` hook
  (`impersonationExpiryGuard`) deletes an impersonated session older than 900 s, row and KV blob,
  before the endpoint reads it; the endpoint then answers as for a signed-out caller. The hook skips
  `/sign-out`, and `/get-session` for in-process calls, where the server functions' guard applies.

One exception stays open: the trip-room WebSocket checks the session once, when the socket opens, so
a socket opened inside the 900 seconds keeps its role after them (#1374).

### 6.3 Closing the tab does not end it

Stated plainly because the intuition runs the other way. Closing the tab, closing the window or
navigating away does **not** end impersonation. Better Auth creates the impersonated session with
"don't remember me" semantics, so the cookie carries no `Max-Age` and a full browser quit does drop
it - but a closed tab in a still-running browser leaves the session live and reachable by reopening
the URL. The only two things that reliably end it are the **End impersonation** action and the
900-second server-side expiry in §6.2, which holds whether or not the client sends the
`dont_remember` cookie. This is exactly why §6.2 is short and why §6.1 is
non-dismissible.

### 6.4 May an impersonated session perform platform mutations? No.

`requirePermission` denies **every** statement in §1.1 when `session.impersonatedBy` is set,
whatever platform role the impersonated account itself holds - a curator being impersonated does
not lend its `catalog:write` to the operator wearing it. Called out by name because they are the
tempting ones: starting a nested impersonation, issuing or revoking an MCP token, changing a role,
banning an account, publishing a catalogue record or a pack, running a source, and revoking a share
link are all denied. An impersonated session is a debugging instrument, not a second set of admin
hands.

The veto is a boundary rather than a preference because §2.6 leaves it nothing to route around.
`requirePermission` is the only reachable path to any of those actions: `/admin/impersonate-user`,
`/admin/set-role`, `/admin/ban-user` and the other twelve answer `404` to a browser no matter who
holds the session, and the catalogue, pack, source and share mutations are server functions that
call the guard before they touch a row. A veto that lives in one function while the same action
also has a public URL is not a veto.

Tenant actions of the impersonated user **are** permitted, because reproducing a report often means
saving the thing that fails to save. Two are refused by name: **changing a member's role** (below) and **creating a workspace** (§2.7). The second
mints a new tenant owned by the account being worn, which is not a write to something that already
exists, and the owner's audit trail could only ever show that an operator created a workspace they
now cannot leave. `createWorkspace` throws `AuthRequirementError('impersonated')` before it reads the
plan or writes a row. Every such write appends the impersonator's user id to the
existing `metadata` column of the tenant `audit_log` as `impersonatedBy`, so a workspace owner reading
their own audit trail can see that an operator, not they, made the change. `trail()` writes it after
the caller's own keys and from the scope alone: a call site can neither forget it nor state it, a
caller-supplied `impersonatedBy` never wins, and an ordinary session's entry carries no such key
(implemented, #1010).

**Changing a member's role is refused by name too.** `changeMemberRoleFn` (`src/server/fns/members.ts`)
reads the session, and a missing session counts as impersonated (`isImpersonated`), so it throws
`AuthRequirementError('impersonated', <message key>)` before any repository read or write: a role an
operator sets outlives the 900-second session and could promote an account to `owner`. The error
carries a message key and not English prose because `AuthRequirementError` text reaches the browser
verbatim. The authorisation ceiling is the repository's, not the function's: `changeMemberRole`
refuses a `member` caller, an `admin` granting `owner` and an `admin` changing a row that holds
`owner`; only an `owner` may set any role, and the last-owner guard stays. A successful change that
alters the role writes one `member.role_changed` tenant audit entry; the change is not undone when
that write fails.

**Registering, renaming and removing a passkey are refused by name as well.** A passkey is a sign-in factor, and one an
operator registers outlives the 900-second impersonation with no audit row to show for it, which
is the second set of admin hands this section rules out. The `passkey` endpoints stay open (§2.6),
but `/passkey/register/options` and `/passkey/register/verify` answer `FORBIDDEN` with
`PASSKEY_IMPERSONATED` when `session.impersonatedBy` is set at all, an empty string included: the
raw column is read, not the `asString`-normalised value `guard.ts` sees, so these endpoints are
never weaker than the guard. `/passkey/rename` takes the same veto (ticket #1145), and so does `/passkey/delete` (ticket #1146),
before it looks the passkey up. Registration also
needs a session younger than `session.freshAge` (24 hours), for every account, because a borrowed
thirty-day session that adds a passkey would keep its access after a password reset, which revokes
sessions and not passkeys.

Successful passkey registration and actual removal enqueue an email only to the affected person's
server-resolved address (#1186). Refused operations, rename and requests that remove nothing send
no notice. Each mutation has a distinct delivery identity, retained on queue redelivery. Enqueue
or delivery failure cannot undo the credential change, and a notice is not guaranteed to arrive.
For an unrecognized change, the person should change their password, end unfamiliar sessions,
review `/passkeys` and remove unfamiliar passkeys. A password reset revokes sessions but does not
remove passkeys; removing a passkey does not end sessions it already opened.

Entering and leaving impersonation are both audited (§4.3), with the impersonator in
`actor_user_id` and the target in `entity_id`.

So is every workspace the operator moves into between the two. A change of the session's
`activeOrganizationId` inside an impersonated session appends
`platform.user.impersonation_workspace_changed` to `platform_audit_log`, in the same timeline as the
start and the end, so §4.4's query on `(entity_type, entity_id)` reads start, switches and end in
order. It is the platform log and not the tenant `audit_log`, for the reason §4.5 gives: a switch
writes nothing inside a workspace. The actor is the operator - `actor_user_id` is `impersonatedBy` and
`actor_role` is read from the operator's own `user` row at that moment, never from the worn
session - and `entity_id` is the target. `changes` is `{ before: { organizationId }, after:
{ organizationId } }` and holds ids only: no workspace name and nothing else from inside a tenant.
`after.organizationId` is `null` when the update cleared the workspace, which is what leaving a
workspace, a refused `organization/set-active` and a refused `organization/get-organization` on a
workspace the target does not belong to all do; the plugin clears it before it refuses, so a refused
request is still a switch of the session and is recorded as one. A `null` workspace means the next
request falls back to the oldest membership (`src/server/auth/session.ts`), and that fallback is
not itself recorded, nor is a per-request choice made by `requireOrg` without a session update. If
the operator's role cannot be read, no row is written and an `error` line says so: a row naming an
administrator as `user` is worse than a gap that is logged. The same holds for an impersonated
update that reaches the hook with no request context (`audit.impersonation-workspace.no-context`):
nothing pairs it with a previous workspace, so it is logged and not recorded. Creating a workspace is not a path to
this row: an impersonated session cannot reach it (§2.7).

---

## 7. Named follow-ups

**FU-1 - the warning bar has no visual token contract yet.** `DESIGN.md`'s layout token line
names `--z-nav|dropdown|overlay|modal|toast`, `--nav-h`, `--safe-top`, `--safe-bottom`. There is no
band above `--z-toast`, and there is no nav-offset companion to `--nav-h`. The bar in §6.1 has to
sit above every layer including toasts - a toast that covers the one control ending an impersonated
session is the failure this document exists to prevent - and it has to push the entire shell down
rather than overlap it. Both needs are unrepresentable in the current token set. The phase that
ships the bar adds the two tokens to `src/styles/tokens.css` and records them in `DESIGN.md`,
in the same commit, under whatever names that round's owner chooses. This document does not invent
token names for a file it does not own, and it does not let the phase-B builder assume a contract
that is not there.

**FU-2 - SPEC §5's closed table list and `platform_audit_log`. CLOSED in Faza B.** SPEC §5 called
the eight-table global list closed while the same section mandated a `platform_audit_log` write,
and this document specifies that table's columns in §4.1. It is a ninth global table. The round
that owns `docs/SPEC.md` amended the closure sentence to nine names and carved out the audit
table's writer, exactly as this note asked, rather than this document relaxing a clause it does not
own.

**FU-3 — CLOSED by the calendar feed contract amendment (issue #900, ADR 0041).**
SPEC §5/§6 now names the plain `Database`, `Unscoped` suffix, file-header justification,
one stated production caller per function, and narrow projection without tenant content.
Billing has five such functions at HEAD, not four; §2.4's moderation functions adopt the same
shape when implemented. The calendar digest resolver adds no catalog member.

**FU-4 - the moderation projection names a column that does not exist yet.** §3.2 and §3.4 both
read `resource_kind` off `share_links`. That table is trip-only today: `trip_id` is `NOT NULL` with
a foreign key to `trips` (`src/server/db/schema.ts`), and there is no discriminator column at all.
A shared atlas and a moderation list that can distinguish one kind of link from another both need
the same generalisation - a `resource_kind` column and a nullable `trip_id` - and that is a
migration belonging to the phase that ships the public share surfaces. Until it lands, §3.2 and
§3.4 describe the shape those surfaces must have rather than the schema currently on disk, and
this note exists so that no builder reads them as a description of what is already there. **Split
decided in Faza B.** The `share` resource and its two statements ship in the §1.1 dictionary now,
because that dictionary is closed and cannot grow later without amending this document;
`src/server/repos/shares.ts`, `src/server/fns/console/shares.ts` and the moderation screen wait for
the phase that lands the migration, so that they are written once against the real column rather
than twice against a hardcoded `'trip'`.

**FU-5 - _closed._ `docs/DEPLOY.md` recommended `adminUserIds`.** §1.4 rules the list permanently
empty and explains why it is not a recovery instrument on this architecture. Two places in the
runbook say otherwise and both need the round that owns that file: §14.1 offers the list as "the
escape hatch, for when there is no admin at all", and §16's closing checklist accepts
"`adminUserIds` is empty in source, or its single entry is deliberate and dated". The second half
of that checkbox is the one that has to go - "deliberate and dated" describes a bypass nobody can
query for and no audit row can attribute, and an operator following §14.1 today would add an entry
that grants nothing through our guard while standing permanently ready to grant everything through
a server function that forgets to call it. The correct replacement text is already written: §8.1's
SQL grant, which `docs/DEPLOY.md` §14.1 documents immediately above the paragraph in question.
_Closed in Faza B._ Both sites were rewritten by the round that owns `docs/DEPLOY.md`: §14.1 now
routes recovery through the same `update`, and §16's checkbox now asserts that `adminUserIds` does
not appear in `src/server/auth/index.ts` at all. The remaining half of that checkbox - that a unit
test fails on the key's presence rather than on its contents - is true of `src/server/auth/guard.ts`
today and becomes true of `index.ts` in the round that registers the plugin.

**FU-6 - _closed._ `docs/CATALOG.md` no longer calls the `user_agent` token form the standing
contract.** The item was that §4.1 here declared `actor_role` and `token_id` as real columns while
two paragraphs there still described the superseded `user_agent` form as the contract, which a
builder could have implemented. The round that owns that document replaced both: its §2.12 now
closes by recording that there is nothing left to propose because those columns already exist here,
and its §13.9 records the same as settled. Nothing remains to do. The entry is kept rather than
deleted so FU-1 … FU-5 keep their numbers and §4.1's pointer to it still resolves.

---

## 8. Provisioning the two platform roles

### 8.1 The first `admin`, by hand

There is no admin yet, so there is nobody who may authorise the grant. The bootstrap is therefore a
direct database statement, run once per environment by whoever holds the Cloudflare account:

1. Sign up through the product normally, at `/register`, and verify the email. The account is
   created with `defaultRole: 'user'` like any other.
2. Raise the role directly against D1:

   ```bash
   pnpm exec wrangler d1 execute planned-travel-db --remote \
     --command "update \"user\" set role = 'admin' where email = 'ops@planned.travel';"
   ```

3. Confirm exactly one row carries it:

   ```bash
   pnpm exec wrangler d1 execute planned-travel-db --remote \
     --command "select id, email, role from \"user\" where role is not null;"
   ```

4. Sign out and back in, so the session picks up the role, and confirm the console entry appears.

This SQL path exists once, for this reason, and is never the way a role is changed afterwards - it
writes no `platform_audit_log` entry, which is precisely why it must not become a habit. The
operational placement of these commands lives in `docs/DEPLOY.md`; the rule lives here.

### 8.2 Every `curator` afterwards, through the console

An existing `admin` opens `/_app/console/users`, finds the account, and sets its platform role to
`curator`. The action goes through a server function under `src/server/fns/console/*`: it passes
`requirePermission(session, { user: ['set-role'] })`, calls `auth.api.setRole` in process because
`/admin/set-role` answers `404` over HTTP (§2.6), and appends `platform.user.role_changed` to
`platform_audit_log` with the before and after role in `changes`.

The same screen is the only way a curator is demoted, and demotion revokes that account's MCP
tokens in the same call (§5). A curator is never created by SQL, because a role that arrives
without an audit entry is a role nobody can account for later.

### 2026-10-17 platform-control execution record

After the concrete package was presented on PR #1334, the owner instructed autonomous
completion. The approved implementation disables invocation logs and platform traces/OTLP
export for both production and staging, retaining custom logs and application instrumentation.
Live readback confirmed both settings and unchanged bindings, annotations and deployed versions.
The shared `sentry-traces` destination was retained. Free zone ruleset
`699f480b7ba0468c919cbffaf18f42f2`, rule `297bfe6ddc154c41a05cc322ab333dea`,
protects `/api/feed/*` on all zone hosts/methods: block, IP + colocation, 100 requests/10 seconds,
10-second mitigation. Repository settings preserve this policy on subsequent deployments.
This record does not itself grant security shipping approval: live enforcement verification and
renewed independent security approval remain required.
[Execution evidence](https://github.com/design4pro/planned.travel/pull/1334#issuecomment-6228009286)
records configuration readback and matching pre-Worker request traces. Runtime threshold
enforcement was not measured: staging probes were intercepted by unchanged Cloudflare Access.
