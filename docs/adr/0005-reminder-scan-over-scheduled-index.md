# 0005. Pre-departure reminders are a scan, not a scheduled index

Status: accepted
Date: 2026-08-27

## Context

Pre-departure reminders ("your trip to Lisbon starts in 3 days") were designed as a schedule-at-write index: `scheduleReminder()` wrote a KV key whose zero-padded due time sorted lexicographically, `cancelReminder()` removed it, and the `*/15` cron listed the head of the range. Neither writer ever had a caller, so the sweep had run every fifteen minutes over an empty index and had never delivered anything.

Giving that model a caller means giving every write path one. A registered reminder is a _copy_ of the trip's dates: each time `start_date` or `reminder_days` moves — create, edit, archive, delete, restore, import — the old key must be cancelled from the pre-write anchor and a new one written, and any path that forgets leaves an orphan that fires on a date the trip no longer has. The reminder is derivable from two columns that already exist, so the copy buys nothing but the ways it can go stale.

## Decision

Reminders are discovered by scanning `trips`, not by registering anything.

- `src/server/catalog/reminders.ts` asks D1, once per tick, which trips are due now: `reminderDueAt()` is a pure function of `start_date` and `reminder_days` (08:00 UTC on `start_date − reminder_days`), and a trip is due when that instant falls in the 24 hours ending at the tick. The 24-hour test _is_ the grace period — a missed tick or a deploy over 08:00 still delivers, and a reminder more than a day late is dropped rather than sent on the wrong morning.
- **No write path schedules, cancels or re-registers anything.** A scheduler call added to one is a defect, not an optimisation.
- The discovery query crosses tenants, so it lives in `server/catalog` (ADR 0002's single stated exception) rather than being handed a fabricated `TenantScope`. This stretches the carve-out — §5 writes it in terms of the nine tables with no `organization_id`, and `trips` is tenant data — so the projection is what keeps it honest: the scan answers with scheduling coordinates only (trip id, organization id, due instant). Every field a reminder says out loud is read afterwards by `src/server/queue/reminders.ts` through a `TenantScope` bound to that one organization, under a real member of the trip.
- The cross-tenant read is bounded by a `start_date` window (`REMINDER_SCAN_DAYS`) and walked by keyset pages, because `trips_org_start_date_idx` leads with `organization_id` and D1 bills rows scanned.
- Sending once is two independent guards: a `reminded:<orgId>:<tripId>:<dueInstant>` KV marker written _after_ dispatch, and the queue's own envelope id. An unreadable marker means "not yet sent", so a KV outage costs a duplicate inbox row rather than a silently skipped morning.

## Consequences

A moved start date needs no undo: it is simply a different due instant on the next tick, and a different envelope id, so the reminder still arrives. There is no orphan key to leak and no per-write bookkeeping to forget.

One thing this record deliberately does not do: `docs/SPEC.md` §5 and §6 still write the carve-out in terms of the nine tables with no `organization_id`, and guard it with an explicit platform actor plus a `platform_audit_log` write. The discovery query satisfies neither clause. Reconciling the two is an amendment to that contract — the way `platform_audit_log` joined the list in Faza B — and is left as one rather than taken on the way past.

The other costs are stated rather than discovered. A tick reads rows proportional to trips departing inside the window, so the window is load-bearing and a lead time longer than `REMINDER_SCAN_DAYS` never surfaces — widening the product's choice past 30 days means widening that constant in the same change, and a unit test pins the boundary. The row bound is reported, never silently truncated. In-app rows can duplicate where emails cannot, which is the cheaper of the two failures. And the sweep runs under a scope resolved from trip membership, so a trip whose members have all left the workspace is skipped rather than reminded as nobody.
