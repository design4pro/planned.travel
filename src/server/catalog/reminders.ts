/**
 * Due pre-departure reminders, read across every tenant in one pass.
 *
 * ADR 0005 replaced the schedule-at-write model with a scan: nothing registers a reminder when a
 * trip is saved, and the quarter-hourly cron asks D1 which trips are due *now*. The two models differ in
 * what can go wrong. A registered reminder is a copy of the trip's dates that has to be cancelled
 * and rewritten every time either date moves, and every write path that forgets is an orphan that
 * fires on a date the trip no longer has. A scan holds no copy: it reads the current rows, so a
 * moved start date is a different due instant on the next tick and nothing has to be undone.
 *
 * ## Why this module is in `src/server/catalog/**`
 *
 * The sweep runs on a cron with no session, no organization and no member behind it, so there is no
 * tenant context to scope the *discovery* query with — the question is "which of every workspace's
 * trips is due", which the tenant repository layer cannot ask by construction, and handing that
 * layer a fabricated context to make it ask would destroy the guarantee it exists to give
 * (`docs/SPEC.md` §5). `server/catalog` is a stated exception to "all SQL lives in
 * `server/repos`" and `catalog/audit.ts` is the precedent: a plain {@link Database}, no
 * `TenantScope`, no reach into `src/server/repos/**` — a property of the module graph that
 * `src/server/catalog/__tests__/isolation.test.ts` walks from every module in this directory.
 *
 * It is a *stretch* of that carve-out and worth naming: §5 writes the exception in terms of eleven
 * global tables, ten of which carry no `organization_id` and the eleventh of which carries one only
 * as attribution. `trips` is not among them — it is tenant data. What keeps the boundary honest is the shape of what leaves here. This module answers with
 * scheduling coordinates and nothing else — {@link DueTripReminder} is a trip id, the organization
 * that owns it and an instant — so the cross-tenant read cannot become a cross-tenant *read of a
 * trip*. Every field a reminder actually says out loud (the title, the lead time, the members) is
 * read afterwards by `src/server/queue/reminders.ts` through a `TenantScope` bound to that one
 * organization.
 *
 * ## Cost
 *
 * The window predicate is not an optimisation that can be dropped. `trips_org_start_date_idx` leads
 * with `organization_id`, so a cross-tenant scan cannot use it and D1 bills rows scanned
 * (`ARCHITECTURE.md` §5); narrowing `start_date` to the next {@link REMINDER_SCAN_DAYS} days is what
 * keeps a tick proportional to trips departing soon rather than to trips ever created. The pages
 * are keyset, not `OFFSET`, so a large window costs one statement per {@link REMINDER_SCAN_PAGE_SIZE}
 * rows and never re-reads a prefix.
 */

import { and, asc, eq, gt, gte, isNotNull, lte, or } from 'drizzle-orm'
import { trips } from '#/server/db/schema'

import type { SQL } from 'drizzle-orm'
import type { Database } from '#/server/db/types'

/* -------------------------------------------------------------------------------------------------
 * The anchor
 * ---------------------------------------------------------------------------------------------- */

export const DAY_MS = 24 * 60 * 60 * 1000

/** The `YYYY-MM-DD` shape `trips.start_date` stores. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The hour a reminder is due, in UTC.
 *
 * `trips` carries a `timezone` column but it is nullable and unset on most rows, so a per-trip local
 * anchor is not expressible for every trip and a rule that only sometimes applies is worse than one
 * that always does. 08:00 UTC lands in the morning across Europe and before midday in the Americas,
 * and the failure directions are not symmetric: a reminder a few hours early is harmless, one that
 * arrives after departure is worthless.
 */
export const REMINDER_HOUR_UTC = 8

/**
 * How far ahead of `now` the scan looks for a `start_date`.
 *
 * Derived, not chosen. A reminder is due in the 24 hours after 08:00 UTC on
 * `start_date − reminder_days`, so a trip that is due *now* starts between today and
 * `reminder_days` days from today. `TRP-04` sells presets of 1, 3 and 9 days and a custom choice of
 * 1–30, so 31 covers every lead time the product offers with a day of margin.
 *
 * The consequence is stated rather than discovered: `trips.reminder_days` accepts up to 365
 * (`src/server/repos/trips.ts`), and a trip carrying a lead time longer than this window never
 * surfaces here and therefore never reminds. Widening the product's choice past 30 days means
 * widening this constant in the same change. A unit test pins the boundary so it cannot drift
 * silently.
 */
export const REMINDER_SCAN_DAYS = 31

/** Rows per keyset page. One statement per page; the window is usually smaller than one page. */
export const REMINDER_SCAN_PAGE_SIZE = 500

/**
 * The hard bound on rows read in one tick.
 *
 * Reached only by a deployment with more than this many trips departing inside the window, which is
 * far past anything wave 0 ships to. The caller logs when a scan fills it, because a bound that
 * truncates silently reads as "there was nothing else due".
 */
export const REMINDER_SCAN_MAX_ROWS = 5_000

/** The two `trips` columns the due instant is a function of, and nothing else. */
export interface ReminderAnchor {
  readonly startDate: string | null
  readonly reminderDays: number
}

/** One trip that is due right now: where to send, and which instant it is being sent for. */
export interface DueTripReminder {
  readonly tripId: string
  readonly organizationId: string
  /** 08:00 UTC on `start_date − reminder_days`, in epoch milliseconds. */
  readonly dueAt: number
}

/** The `YYYY-MM-DD` an instant falls on in UTC — the string form the column stores. */
function utcDay(instant: number): string {
  return new Date(instant).toISOString().slice(0, 10)
}

/**
 * The due instant for an anchor, or `null` when the anchor asks for no reminder.
 *
 * Pure and time-independent: it does not know or care whether the instant it returns is in the
 * past. That is the caller's window test, and keeping the two apart is what lets the same function
 * answer for a trip that departed last year — which is how {@link listDueTripReminders} can filter
 * in code against a rule the tests can state directly.
 *
 * `reminder_days = 0` is a stored value the column's non-negative `CHECK` allows and it means "no
 * reminder", not "the morning of departure": answering `null` is what makes the preference
 * expressible at all.
 */
export function reminderDueAt(anchor: ReminderAnchor): number | null {
  const { startDate, reminderDays } = anchor
  if (
    startDate === null ||
    !Number.isInteger(reminderDays) ||
    reminderDays <= 0
  ) {
    return null
  }
  if (!ISO_DATE.test(startDate)) {
    return null
  }
  const startOfDay = Date.parse(`${startDate}T00:00:00.000Z`)
  // The round-trip is the range check, and it is not redundant: `Date.parse` rolls `2026-02-30`
  // forward to 2 March rather than rejecting it, so a reminder for a date the calendar does not
  // have would be anchored two days off instead of declining to fire. The scan reads the column
  // raw, without the `z.iso.date()` the write path applies, so the guard belongs here.
  if (Number.isNaN(startOfDay) || utcDay(startOfDay) !== startDate) {
    return null
  }
  return startOfDay - reminderDays * DAY_MS + REMINDER_HOUR_UTC * 60 * 60 * 1000
}

/* -------------------------------------------------------------------------------------------------
 * The scan
 * ---------------------------------------------------------------------------------------------- */

export interface ReminderScanOptions {
  readonly pageSize?: number
  readonly maxRows?: number
}

export interface ReminderScan {
  readonly due: ReadonlyArray<DueTripReminder>
  /** Rows the window returned, due or not — what the tick actually cost. */
  readonly scanned: number
  /** `true` when {@link ReminderScanOptions.maxRows} stopped the walk before the window ended. */
  readonly truncated: boolean
}

/** The four columns the scan reads. Written out because the walk is self-referential — the cursor
 * for the next page is built from the current one, which leaves Drizzle's inferred row type circular. */
interface ScanRow {
  readonly tripId: string
  readonly organizationId: string
  readonly startDate: string | null
  readonly reminderDays: number
}

/** The keyset predicate: everything strictly after `(startDate, id)` in the scan's own ordering. */
function after(
  cursor: { startDate: string; id: string } | null,
): SQL | undefined {
  if (cursor === null) return undefined
  return or(
    gt(trips.startDate, cursor.startDate),
    and(eq(trips.startDate, cursor.startDate), gt(trips.id, cursor.id)),
  )
}

/**
 * Every trip whose reminder falls due in the 24 hours ending at `now`, across every tenant.
 *
 * The window predicate lives in SQL and the due test lives in code, deliberately. `start_date` is a
 * `YYYY-MM-DD` string and the lead time is a column, so expressing `dueAt ≤ now < dueAt + 24h` in
 * SQL means date arithmetic in the SQLite dialect — untestable outside a database, and a second
 * statement of {@link reminderDueAt}'s rule that can drift from the one the unit tests pin. So SQL
 * narrows to a window it can express with two string comparisons, and the one function that knows
 * what a due instant is decides which of those rows is actually due.
 *
 * The 24-hour test *is* the grace period: a tick that never ran, a Worker that was down for an
 * afternoon, or a deploy over 08:00 UTC still delivers, and a reminder more than a day late is
 * dropped rather than sent on the wrong morning.
 */
export async function listDueTripReminders(
  db: Database,
  now: number,
  options: ReminderScanOptions = {},
): Promise<ReminderScan> {
  if (!Number.isFinite(now)) {
    return { due: [], scanned: 0, truncated: false }
  }
  const pageSize = Math.max(1, options.pageSize ?? REMINDER_SCAN_PAGE_SIZE)
  const maxRows = Math.max(1, options.maxRows ?? REMINDER_SCAN_MAX_ROWS)

  const scanWindow = and(
    isNotNull(trips.startDate),
    gt(trips.reminderDays, 0),
    eq(trips.isArchived, false),
    gte(trips.startDate, utcDay(now)),
    lte(trips.startDate, utcDay(now + REMINDER_SCAN_DAYS * DAY_MS)),
  )

  const due: Array<DueTripReminder> = []
  let cursor: { startDate: string; id: string } | null = null
  let scanned = 0

  while (scanned < maxRows) {
    const take = Math.min(pageSize, maxRows - scanned)
    const rows: Array<ScanRow> = await db
      .select({
        tripId: trips.id,
        organizationId: trips.organizationId,
        startDate: trips.startDate,
        reminderDays: trips.reminderDays,
      })
      .from(trips)
      .where(and(scanWindow, after(cursor)))
      .orderBy(asc(trips.startDate), asc(trips.id))
      .limit(take)

    scanned += rows.length
    for (const row of rows) {
      // Unreachable — `isNotNull` is in the predicate — but the column's type still admits null
      // and a non-null assertion on a genuinely nullable column is not something this codebase
      // writes, so the cursor falls back to a string the ordering can carry.
      const startDate = row.startDate ?? ''
      cursor = { startDate, id: row.tripId }
      const dueAt = reminderDueAt({
        startDate: row.startDate,
        reminderDays: row.reminderDays,
      })
      if (dueAt !== null && dueAt <= now && now < dueAt + DAY_MS) {
        due.push({
          tripId: row.tripId,
          organizationId: row.organizationId,
          dueAt,
        })
      }
    }

    // A short page is the end of the window: there is no next key to ask for.
    if (rows.length < take) {
      return { due, scanned, truncated: false }
    }
  }

  // The only other way out of the loop is `maxRows`, so reaching here is the bound biting. It
  // reports truncation for a window that happens to hold exactly `maxRows` rows too — the cheap
  // direction, since the alternative is one more statement per tick to prove there is nothing left.
  return { due, scanned, truncated: true }
}
