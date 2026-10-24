# 0002. Tenant isolation is enforced at the repository boundary

Status: accepted (backfill — the decision predates this record)
Date: 2026-08-26

## Context

Every product table carries an `organization_id`. A single forgotten `WHERE organization_id = ?` is a cross-tenant data leak, and prose rules do not survive hundreds of agent sessions.

## Decision

All SQL lives in `src/server/repos`, and every query passes through the tenant-scoped base repository, which prepends the tenant predicate from a `TenantScope`. Callers can add predicates but cannot remove the tenant one — forgetting the tenant filter is not expressible. `server/catalog` is the single stated exception (global tables with no `organization_id`), guarded instead by `requirePermission` plus a platform audit-log write. Quota is enforced at the same boundary.

## Consequences

The repository layer is the deep module of this codebase: a small interface hiding tenancy, quota and SQL. Tests wrap this boundary (see the tenant-isolation suite). Any new data access that bypasses it is a contract violation, not a style issue.

### Amendment, 2026-10-24 - the stated exceptions are three, and closed

The Decision above names `server/catalog` as the single stated exception. `docs/SPEC.md` §6 now names three, and closes the list: `server/catalog`, the bounded `…Unscoped` repository shape, and the identity-table SQL of `src/server/auth/provisioning.ts` (`user` read, `organization` and `member` written; a create has no tenant scope yet, so there is none to pass). The module predates the rule's wording and the contract is brought into line with the code rather than the writes being moved (#989). Adding a table to that module is a contract change.
