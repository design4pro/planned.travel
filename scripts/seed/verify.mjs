#!/usr/bin/env node

/**
 * Reads the seeded data back out of local D1 and checks that it is internally consistent.
 *
 *   node scripts/seed/verify.mjs [--remote]
 *
 * Three things are checked, because they are the three that would silently ruin the demo:
 *
 * 1. **Row counts** per table, so an empty screen can be traced to missing rows rather than a bug.
 * 2. **Split integrity** — every expense's shares must sum to exactly its amount.
 * 3. **Balances** per trip and traveller: `paid − share + settled out − settled in`. The sum across a
 *    trip must equal minus the total of any expense nobody has claimed, and nothing else.
 *
 * Local D1 caps a compound `SELECT` at a handful of terms, so the count query is issued in small
 * batches rather than as one 50-way `UNION ALL`.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const DATABASE = 'planned-travel-db'
const BATCH_SIZE = 5

const COUNTERS = [
  ['trips', 'trips'],
  ['trip_members', 'trip_members'],
  ['days', 'days'],
  ['day_notes', 'day_notes'],
  ['places', 'places'],
  ['place_tags', 'place_tags'],
  ['tags', 'tags'],
  ['categories', 'categories'],
  ['day_assignments', 'day_assignments'],
  ['assignment_participants', 'assignment_participants'],
  ['day_accommodations', 'day_accommodations'],
  ['transports', 'transports'],
  ['reservations', 'reservations'],
  ['budget_items', 'budget_items'],
  ['expenses', 'expenses'],
  ['expense_shares', 'expense_shares'],
  ['settlements', 'settlements'],
  ['packing_lists', 'packing_lists'],
  ['packing_items', 'packing_items'],
  ['packing_items_done', 'packing_items WHERE is_done = 1'],
  ['trip_files', 'trip_files'],
  ['collab_messages', 'collab_messages'],
  ['collab_message_reactions', 'collab_message_reactions'],
  ['collab_notes', 'collab_notes'],
  ['collab_polls', 'collab_polls'],
  ['collab_poll_votes', 'collab_poll_votes'],
  ['journeys', 'journeys'],
  ['journey_entries', 'journey_entries'],
  ['journey_photos', 'journey_photos'],
  ['journey_moods', 'journey_moods'],
  ['collections', 'collections'],
  ['collection_places', 'collection_places'],
  ['collection_labels', 'collection_labels'],
  ['collection_place_labels', 'collection_place_labels'],
  ['visited_countries', 'visited_countries'],
  ['visited_regions', 'visited_regions'],
  ['bucket_list_items', 'bucket_list_items'],
  ['travel_stats', 'travel_stats'],
  ['vacay_plans', 'vacay_plans'],
  ['vacay_plan_members', 'vacay_plan_members'],
  ['vacay_years', 'vacay_years'],
  ['vacay_user_years', 'vacay_user_years'],
  ['vacay_entries', 'vacay_entries'],
  ['vacay_company_holidays', 'vacay_company_holidays'],
  ['vacay_holiday_calendars', 'vacay_holiday_calendars'],
  ['vacay_user_colours', 'vacay_user_colours'],
  ['notifications', 'notifications'],
  ['notifications_unread', 'notifications WHERE is_read = 0'],
  ['notifications_read', 'notifications WHERE is_read = 1'],
  ['notification_preferences', 'notification_preferences'],
  ['audit_log', 'audit_log'],
  ['subscriptions', 'subscriptions'],
  ['usage_records', 'usage_records'],
  ['organization_settings', 'organization_settings'],
  ['user_settings', 'user_settings'],
  ['user', 'user'],
  ['member', 'member'],
]

const SPLIT_INTEGRITY_SQL = `
SELECT COUNT(*) AS mismatches FROM (
  SELECT e.id FROM expenses e
  JOIN expense_shares s ON s.expense_id = e.id
  GROUP BY e.id HAVING SUM(s.share_minor) <> e.amount_minor
)`

const BALANCES_SQL = `
WITH paid AS (SELECT trip_id, paid_by AS uid, SUM(amount_minor) AS v FROM expenses GROUP BY trip_id, paid_by),
     shr  AS (SELECT trip_id, user_id AS uid, SUM(share_minor) AS v FROM expense_shares GROUP BY trip_id, user_id),
     sent AS (SELECT trip_id, from_user_id AS uid, SUM(amount_minor) AS v FROM settlements GROUP BY trip_id, from_user_id),
     recv AS (SELECT trip_id, to_user_id AS uid, SUM(amount_minor) AS v FROM settlements GROUP BY trip_id, to_user_id),
     ppl  AS (SELECT uid, trip_id FROM paid WHERE uid IS NOT NULL UNION SELECT uid, trip_id FROM shr)
SELECT t.title AS trip, t.currency AS cur, u.name AS person,
       COALESCE(p.v,0) AS paid, COALESCE(s.v,0) AS share,
       COALESCE(o.v,0) AS sent, COALESCE(i.v,0) AS recv,
       COALESCE(p.v,0) - COALESCE(s.v,0) + COALESCE(o.v,0) - COALESCE(i.v,0) AS balance
FROM ppl
JOIN trips t ON t.id = ppl.trip_id
JOIN user u ON u.id = ppl.uid
LEFT JOIN paid p ON p.trip_id = ppl.trip_id AND p.uid = ppl.uid
LEFT JOIN shr  s ON s.trip_id = ppl.trip_id AND s.uid = ppl.uid
LEFT JOIN sent o ON o.trip_id = ppl.trip_id AND o.uid = ppl.uid
LEFT JOIN recv i ON i.trip_id = ppl.trip_id AND i.uid = ppl.uid
ORDER BY t.title, balance DESC`

const UNCLAIMED_SQL = `
SELECT t.title AS trip, COALESCE(SUM(e.amount_minor), 0) AS unclaimed
FROM trips t LEFT JOIN expenses e ON e.trip_id = t.id AND e.paid_by IS NULL
GROUP BY t.id ORDER BY t.title`

function out(text) {
  process.stdout.write(`${text}\n`)
}

/** Runs one statement through wrangler and returns its rows. */
async function query(sql, remote) {
  const args = [
    'wrangler',
    'd1',
    'execute',
    DATABASE,
    remote ? '--remote' : '--local',
    '--json',
    '--command',
    sql,
  ]
  const { stdout } = await run('pnpm', ['exec', ...args], { maxBuffer: 32 * 1024 * 1024 })
  const start = stdout.indexOf('[')
  if (start === -1) {
    throw new Error(`wrangler returned no JSON for: ${sql.slice(0, 80)}`)
  }
  const parsed = JSON.parse(stdout.slice(start))
  const first = parsed[0]
  if (first === undefined || first.success !== true) {
    throw new Error(`Query failed: ${JSON.stringify(first?.error ?? first)}`)
  }
  return first.results
}

async function counts(remote) {
  const rows = []
  for (let index = 0; index < COUNTERS.length; index += BATCH_SIZE) {
    const batch = COUNTERS.slice(index, index + BATCH_SIZE)
    const sql = batch
      .map(([name, source]) => `SELECT '${name}' AS tbl, COUNT(*) AS n FROM ${source}`)
      .join(' UNION ALL ')
    rows.push(...(await query(sql, remote)))
  }
  return rows
}

async function main() {
  const remote = process.argv.includes('--remote')
  out(`planned.travel demo data — ${remote ? 'remote' : 'local'} D1\n`)

  out('Row counts')
  let empty = 0
  for (const row of await counts(remote)) {
    if (row.n === 0) empty += 1
    out(`  ${String(row.tbl).padEnd(26)} ${row.n}`)
  }
  out(`\n  ${empty} of ${COUNTERS.length} counters are zero.`)

  const [{ mismatches }] = await query(SPLIT_INTEGRITY_SQL, remote)
  out(`\nSplit integrity: ${mismatches === 0 ? 'every expense sums to its shares' : `${mismatches} MISMATCHES`}`)

  const unclaimed = new Map(
    (await query(UNCLAIMED_SQL, remote)).map((row) => [row.trip, Number(row.unclaimed)]),
  )

  out('\nBalances (paid − share + settled out − settled in)')
  const header = ['trip', 'cur', 'person', 'paid', 'share', 'sent', 'recv', 'balance']
  out(
    `  ${header[0].padEnd(24)}${header[1].padEnd(5)}${header[2].padEnd(14)}` +
      `${header[3].padStart(11)}${header[4].padStart(11)}${header[5].padStart(9)}` +
      `${header[6].padStart(9)}${header[7].padStart(12)}`,
  )

  const balances = await query(BALANCES_SQL, remote)
  const byTrip = new Map()
  for (const row of balances) {
    byTrip.set(row.trip, [...(byTrip.get(row.trip) ?? []), row])
  }

  let ok = mismatches === 0
  for (const [trip, rows] of byTrip) {
    for (const row of rows) {
      out(
        `  ${String(row.trip).slice(0, 23).padEnd(24)}${String(row.cur).padEnd(5)}` +
          `${String(row.person).slice(0, 13).padEnd(14)}${String(row.paid).padStart(11)}` +
          `${String(row.share).padStart(11)}${String(row.sent).padStart(9)}` +
          `${String(row.recv).padStart(9)}${String(row.balance).padStart(12)}`,
      )
    }
    const total = rows.reduce((sum, row) => sum + Number(row.balance), 0)
    const expected = -(unclaimed.get(trip) ?? 0)
    const consistent = total === expected
    ok = ok && consistent
    out(
      `  ${''.padEnd(24)}${''.padEnd(5)}${'sum'.padEnd(14)}${''.padStart(40)}` +
        `${String(total).padStart(12)}  ${consistent ? `ok (unclaimed ${-expected})` : `EXPECTED ${expected}`}`,
    )
  }

  out(`\n${ok ? 'All money checks passed.' : 'MONEY CHECKS FAILED.'}`)
  if (!ok) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
