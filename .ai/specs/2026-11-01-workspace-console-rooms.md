# Workspace console rooms

| Field              | Value                                   |
| ------------------ | --------------------------------------- |
| **Status**         | ready                                   |
| **Issue**          | none                                    |
| **Spec PR**        | #1696                                    |
| **Implementation** | none                                    |
| **Plan**           | 10-S3 (docs/plans/10-administration.md) |

## TLDR

Plan stage **10-S3**, from `docs/plans/10-administration.md`, gives workspace administrators linkable Overview, Members and Audit rooms and an entry from Settings. Today `/admin` contains all three on one page. The proposed change preserves the working administration controls and server authorization while splitting their presentation into nested routes.

## Verified scope and changes from the plan

Measured against the current checkout on 2026-11-01:

- `src/routes/_app/admin.tsx` already renders workspace invitations, member role and departure controls, quotas, four statistics, recent audit entries and busiest actions. `WorkspaceInvitations`, `MemberRoleControl` and `useMemberDeparture` are existing owners of those interactions.
- `loadAdmin` in `src/routes/_app/-server/overview.ts` already checks `roleSatisfies(scope.ctx.role, 'admin')` on the server and returns `null` before protected reads for a member. Its `AdminPayload` includes server-provided `now`, member-specific assignable roles and invitation roles. Preserve this behavior; the plan's client-flag gate is historical.
- The proposed predecessor components in `src/components/administration/`, `loadAdministration`, `loadAuditPage` and `countAuditEntries` do not exist at their planned paths. Extract the working inline presentation instead. This stage does not implement or claim delivery of 10-S1, 10-S2 or 10-S4.
- Audit is the existing newest 25 entries, not a complete browsing/search surface. Keep the bounded statistic but label it as recent entries. Total counting, pagination and filtering remain 10-S2's work. `countAuditActions` already provides the busiest-actions overview.
- `SettingsNav` already has seven settings destinations, including Workspace and Billing. Add a separate workspace-administration destination, not a new settings section. The platform `/console` is a distinct role system and is untouched.

No data migration, new repository function, SQL, server-function contract, quota metric, dependency, binding, queue or realtime behavior is needed. No glossary or ADR change is proposed: this is presentation of the existing Workspace console concept. Historical screenshot baselines, masking and clock-audit requirements are superseded by ADR 0016 and the current `docs/plans/12-verification-protocol.md`.

## Architecture and owned paths

| Path                                                                                    | Ownership and purpose                                                                                                                                          |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/_app/admin.tsx`                                                             | Replace with nested route files while preserving `/admin`.                                                                                                     |
| `src/routes/_app/admin/route.tsx`                                                       | Persistent workspace header, server-result gate, navigation and outlet; parent loader calls unchanged `loadAdmin`.                                             |
| `src/routes/_app/admin/index.tsx`                                                       | Overview: existing four statistics, quota panel and busiest-actions panel.                                                                                     |
| `src/routes/_app/admin/members.tsx`                                                     | Existing invitations and member roster, including all current handlers.                                                                                        |
| `src/routes/_app/admin/audit.tsx`                                                       | Existing recent activity list and its empty state.                                                                                                             |
| `src/routes/_app/admin/-ui/console-tabs.tsx`                                            | One typed declaration of the three destinations and their navigation links; owns room-navigation focus behavior.                                               |
| `src/routes/_app/admin/-ui/console-panels.tsx`                                          | Necessary extracted presentation/helpers and existing pending/locked surfaces; no new domain service.                                                          |
| `src/routes/_app/admin/-ui/__tests__/console-tabs.test.tsx`                             | Navigation matching, semantics and focus-refresh regression tests.                                                                                             |
| `src/routes/_app/-ui/settings-nav.tsx`                                                  | Conditional, separated `/admin` entry; read existing `/_app` route context internally, retain zero-prop API and closed destination types.                      |
| `src/routes/_app/-server/__tests__/admin-overview.test.ts`                              | Add boundary coverage using the existing harness and Start/context mocks.                                                                                      |
| `src/routes/_app/console/users.$userId.tsx`                                             | Comment-only correction: replace its reference to removed `admin.tsx` with the retained UI primitives or new panel owner; platform behavior remains unchanged. |
| `src/components/layout/__tests__/copy-rules.test.ts`                                    | Replace both explicit `admin.tsx` inventories with all moved route/helper files so copy scanning remains real and no deleted file is read.                     |
| `src/lib/i18n/messages/<locale>/shell.ts`, `src/lib/i18n/messages/<locale>/settings.ts` | Copy changes below, in all 23 locales.                                                                                                                         |
| `e2e/journeys.spec.ts`                                                                  | One routing/session journey covering this split; reuse current navigation, settle and console helpers.                                                         |

`src/routeTree.gen.ts` travels as generated output from `pnpm generate-routes`, staged before the gate; never hand edit it. No edit to `overview.ts`, its exported payload or the current server functions is needed. Shared plan paths `overview.ts` and `settings-nav.tsx` were historically sequenced with 00-S5, 01-S1, 09-S7, 01-S7, 09-S8 and 02-S10; implementation must recheck the current callers and preserve newer work. Do not edit sibling plans.

Reuse `AppFrame`, `AppSections`, `PageHeader`, `ErrorPanel`, scaffold skeletons and existing UI primitives. Use the established ordinary router-link model from Settings and `console/-ui/console-nav.tsx`, with the underline styling expressed in existing tokens/utilities. Do not change `components/ui` or build a navigation abstraction shared with the platform console.

### Loading and authorization

The parent is the single owner of `loadAdmin()` and its typed `AdminPayload | null` result. A null result renders the extracted existing denial state, with no outlet and no protected panel. Children read current parent loader data with a nullable guard; never copy it into long-lived local state or rely on a non-null cast. All three URLs load the parent on direct entry, reload and history navigation. No child adds a new server call.

Session `isAdmin` hides navigation only; the server result decides rendering. Preserve the live role check, workspace scope and all existing server-side mutation guards. Mutation refreshes and workspace switches revalidate the parent; a demoted caller must get the locked state, not retained roster content. Preserve current role outcomes, impersonation refusals, refresh-on-failure, departure recovery, focus references and invitation reload callbacks during extraction. Preserve the member control's associated table/focus target after moving it.

The aggregate-read cost and aggregate failure boundary stay as today: a failed audit query can fail the parent load. Parent pending/error surfaces retain the existing skeleton and retry behavior. Ordinary navigation between already resolved rooms keeps the header and links mounted; explicit revalidation may show the parent pending surface. Children provide tab-specific render-error boundaries using `ErrorPanel`. This stage does not promise independent query loading or fault isolation.

### Routes and UI/UX

| URL              | Content                                                                           |
| ---------------- | --------------------------------------------------------------------------------- |
| `/admin`         | Organization header, four statistics, quotas and busiest actions.                 |
| `/admin/members` | Invitations, roster, role changes and departure controls.                         |
| `/admin/audit`   | Recent audit list, preserving server `now` and existing relative-time formatting. |

The common header retains workspace name, plan/creation description, Workspace settings and Plan and billing links. Keep the pending-invitations alert on Overview and change its action to `/admin/members`. Move its current copy/seat caveat unchanged. Keep the existing account-menu entry pointing to `/admin`. Members and Audit each have a visible translated room heading. Overview's recent-entries card uses the new accurate label/caption below; its figure remains `audit.length` and is never advertised as a total.

The link strip is a translated `nav`, not an ARIA tablist: ordinary Tab/Enter behavior, decorative icons, visible focus and `aria-current="page"` for the active destination. Overview matches exactly, other rooms match their path or slash-delimited descendants, never lookalike prefixes. Unknown routes use the existing not-found behavior, not an Overview fallback. Use router matching rather than a second hand-written pathname parser.

After a successful in-place room navigation, focus the destination heading or labelled content container (`tabIndex={-1}`). Do not steal focus at hydration, a data-only invalidation, a failed navigation or a modified/new-tab click. Back/Forward between rooms follows the same successful-navigation rule. A single client-side focus effect belongs to the local navigation module; no global focus manager.

At 360px the links scroll horizontally with visible keyboard focus and minimum 44px targets, including RTL. At 1280px they remain below the header; at 2560px retain the app's content measure. Preserve token spacing, light/dark states and existing mobile table behavior. Motion uses existing transform/opacity utilities and honors reduced motion; no new panel animation is required. Empty states belong to the moved lists, loading to the aggregate loader, and render errors to each room.

## Visual change expected

All three room URLs change composition in light and dark at 360x800, 1280x900 and 2560x1440. Overview loses the member and audit lists; the other rooms gain those unchanged panels beneath the persistent header/navigation. Settings gains the separated admin-only link. Verify the scrolled strip, focused destination, pending/error and locked states; the locked state renders for a direct URL even though navigation is absent.

The implementation captures current `/admin` and Settings before editing, then all three completed room URLs and changed Settings states using `scripts/visual/capture.mjs`, outside the repository. Since two URLs are new, annotate that their before composition is the corresponding panel on the old `/admin`; do not invent pre-existing screens or pixel baselines. No screenshots or static mockup app are part of this design-only change.

## Copy

Implementation follows `i18n-messages` and updates every locale together. Existing moved copy remains in the catalogue, with its current key ownership. New full keys and English text:

| Key                         | English                                  |
| --------------------------- | ---------------------------------------- |
| `shell.admin.nav.label`     | Workspace administration                 |
| `shell.admin.nav.overview`  | Overview                                 |
| `shell.admin.nav.members`   | Members                                  |
| `shell.admin.nav.audit`     | Audit                                    |
| `shell.admin.members.error` | Members did not load                     |
| `shell.admin.audit.error`   | Recent activity did not load             |
| `settings.nav.admin`        | Workspace console                        |
| `settings.nav.admin.hint`   | Members, invitations and recent activity |

Change `shell.admin.stat.audit` to **Recent audit entries** and `shell.admin.stat.auditCaption` to **Up to 25 latest entries in Audit** in every locale. Reuse existing `shell.admin.error` for the aggregate error/Overview boundary and the new room-label keys as heading text. Do not promise Permissions before 10-S4 exists. Keep all interpolation and plural contracts intact. Search the previous caption **Most recent activity shown below** and the changed keys across tests, source and waiting specs.

## Verification and failure cases

- Extend the existing server harness test: plain member receives `null`; a platform operator with only a workspace-member scope receives no admin payload; an owner/admin receives only the acting tenant's roster/invitations/audit. Seed two tenants with distinct sentinel people/audit actions and assert the other tenant's values are absent. Add a role-change case that reads successfully, changes the acting scope to member, then reads `null`. No new repo/isolation suite block is needed because no new repository function is added; run existing member/invitation/audit isolation cases.
- UI tests check exactly one current link for each known URL, exact Overview matching, no `/admin/membership` false match, accessible navigation names, hidden Settings entry for members and focus preserved during refresh. Reuse project mocks; jsdom has no jest-dom matchers. Mock any import chain reaching `cloudflare:workers`.
- One focused browser journey verifies deep links/reload, normal clicks, Back/Forward, keyboard focus after a successful room change and unchanged focus on invalidation. Use available owner/member fixture roles; if a role is not available locally, prove the denial at the server/component layers and explicitly report the browser gap rather than silently skipping assertions. Attach `watchConsole` before navigation and assert no fatal output/hydration errors using the current helpers. Reuse existing browser coverage for administration mutations; verify at least one role or invitation refresh on the moved Members screen and preserve departure recovery tests.
- For a workspace switch while in Members or Audit, await shell/parent revalidation and assert only the destination workspace's records. Failed parent reads render the aggregate error; a child render failure retains the common header/navigation. No artificial child network loader is added merely to test pending states.
- Check layout stability after settle around room navigation using the current verification protocol, with no recent-input shifts counted; report unsupported engine measurement rather than inventing a pass. Visual evidence covers widths/themes and states above; ADR 0016 forbids screenshot comparisons/baseline updates.
- Implementation runs the configured gate in order: `pnpm typecheck`, `pnpm lint`, the complete test projects (server/tooling/ui, bounded/sharded as AGENTS.md requires), `bash .ai/scripts/check-generated.sh`, `pnpm build`. Stage generated route output before the generated check. Apply SPEC §7 and current e2e/QA requirements to the implementation PR; this PR is design-only.

No stored data changes, so rollback restores the original single-page composition. Retain `/admin`; new room URLs must continue to answer or redirect to `/admin` for at least one release if rolling back after deployment. Keep `loadAdmin` and its response fields unchanged for existing clients.

## Phasing and implementation plan

One cohesive implementation ticket is sufficient, with three ordered steps. Slicing must keep the route replacement, all three children, moved copy inventories and route regeneration together: half of that move is not independently valid.

1. Add regression coverage for the current server gate and two-tenant result boundary. Extract the existing panel presentation/handlers without changing the single-page output; keep all current controls, refusal/recovery paths and copy covered.
2. Replace the route atomically with the parent and three children, wire navigation/focus, move the invitation-review link, add Settings entry and all-locale copy, update copy-test inventories, regenerate/stage routes. Keep the server export and payload intact. Verify direct URLs, nullable results and no protected outlet on refusal.
3. Complete the focused navigation journey, mutation refresh/workspace-switch checks and visual comparison evidence, then run the gate. Do not add audit pagination/counting, permissions, settings defaults or a new data API to this ticket.

## Resolved assumptions

| #   | Question                                                        | Applied default                                                                                                                                   | Why                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Missing predecessor components: wait or compose today's panels? | Compose existing working panels; no predecessor functionality bundled.                                                                            | Product owner sub-agent, high confidence: navigation is a complete reversible slice; preserve all handlers, refusals and recovery.                                                                                                    |
| 2   | Is the 25-entry figure a total?                                 | Label it as recent, bounded entries; defer total/filtering/pagination to 10-S2.                                                                   | Product owner sub-agent, high confidence; `listAuditLog(scope, { limit: 25 })` is today's contract.                                                                                                                                   |
| 3   | Radix tabs or route links?                                      | Ordinary links in a labelled navigation landmark.                                                                                                 | Accessibility specialist sub-agent, high confidence: route destinations need normal Tab/Enter/history semantics; preserve focus and RTL usability.                                                                                    |
| 4   | Split aggregate server reads now?                               | One parent loader calls unchanged `loadAdmin`, nullable result gates outlet.                                                                      | Software architect sub-agent, high confidence: avoids new APIs and duplicate reads; retains aggregate loading/failure limitations.                                                                                                    |
| 5   | Refresh semantics and persistent header?                        | Parent revalidates after writes/workspace switch; ordinary resolved room navigation retains the header, explicit refresh may show parent pending. | Software architect sub-agent, high confidence: preserves authorization and existing behavior without artificial child loaders.                                                                                                        |
| 6   | Ticket and priority/risk scope?                                 | One navigation-composition ticket; design PR priority-medium/risk-low, documentation/skip-qa.                                                     | Applied default: no new storage, SQL, server API or permission model; implementation still requires security regression coverage and UI QA.                                                                                           |
| 7   | Panel: product scope and slicing?                               | Approve.                                                                                                                                          | Independent product owner, high confidence: complete room-navigation slice, predecessor functionality stays separate.                                                                                                                 |
| 8   | Panel: security and tenancy?                                    | Approve.                                                                                                                                          | Independent security/tenancy reviewer, high confidence: server gate, live scope and revalidation requirements preserved.                                                                                                              |
| 9   | Panel: UX and copy?                                             | Approve.                                                                                                                                          | Independent UX specialist, high confidence: discoverable room URLs and bounded audit copy; no conditions.                                                                                                                             |
| 10  | Panel: accessibility?                                           | Approve.                                                                                                                                          | Independent accessibility specialist, high confidence: standard link semantics and explicit focus/RTL requirements; no conditions.                                                                                                    |
| 11  | Panel: architecture and source-comment consumers?               | Approve after comment-only ownership correction.                                                                                                  | Independent software architect, high confidence: `console/users.$userId.tsx` names the removed route in a docblock; inventory now includes its correction; the same specialist re-reviewed and approved with no remaining conditions. |
