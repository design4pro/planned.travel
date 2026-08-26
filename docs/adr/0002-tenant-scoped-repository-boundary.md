# 0002. Tenant isolation is enforced at the repository boundary

Status: accepted (backfill — the decision predates this record)
Date: 2026-08-26

## Context

Every product table carries an `organization_id`. A single forgotten `WHERE organization_id = ?` is a cross-tenant data leak, and prose rules do not survive hundreds of agent sessions.

## Decision

All SQL lives in `src/server/repos`, and every query passes through the tenant-scoped base repository, which prepends the tenant predicate from a `TenantScope`. Callers can add predicates but cannot remove the tenant one — forgetting the tenant filter is not expressible. `server/catalog` is the single stated exception (global tables with no `organization_id`), guarded instead by `requirePermission` plus a platform audit-log write. Quota is enforced at the same boundary.

## Consequences

The repository layer is the deep module of this codebase: a small interface hiding tenancy, quota and SQL. Tests wrap this boundary (see the tenant-isolation suite). Any new data access that bypasses it is a contract violation, not a style issue.
