#!/usr/bin/env node
import { readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The marker the workflow uses to find and update the one report comment on a pull request. */
export const MARKER = '<!-- ci-test-report -->'

/** The numbers a shard keeps from its e2e-inc JSON report; null when the report is unusable. */
export function shardStats(report) {
  const s = report?.run?.summary
  if (
    !s ||
    [
      'passed',
      'failed',
      'flaky',
      'skipped',
      'interrupted',
      'selected',
      'executed',
    ].some((key) => !Number.isInteger(s[key]) || s[key] < 0)
  )
    return null
  if (s.interrupted > 0 || s.executed + s.skipped < s.selected) return null
  return {
    passed: s.passed,
    failed: s.failed,
    flaky: s.flaky,
    skipped: s.skipped,
  }
}

/** Sum the shards. Null when any shard did not report, so "no data" never reads as "0 failed". */
export function sumShards(shards, expectedShards = shards.length) {
  const usable = shards.filter(Boolean)
  if (
    !Number.isInteger(expectedShards) ||
    expectedShards < 1 ||
    shards.length !== expectedShards ||
    usable.length !== expectedShards
  )
    return null
  return usable.reduce(
    (a, s) => ({
      passed: a.passed + s.passed,
      failed: a.failed + s.failed,
      flaky: a.flaky + s.flaky,
      skipped: a.skipped + s.skipped,
    }),
    { passed: 0, failed: 0, flaky: 0, skipped: 0 },
  )
}

/**
 * Every totals file under a download directory. download-artifact puts each artifact in a
 * subdirectory of its own unless merge-multiple is set, and merging would overwrite one shard's
 * `e2e-stats.json` with the other's, so the walk is recursive and the layout is not assumed.
 */
export function readShardStats(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return readShardStats(path)
    return entry.name.endsWith('.json')
      ? [JSON.parse(readFileSync(path, 'utf8'))]
      : []
  })
}

const icon = (result) =>
  result === 'success' ? '✅' : result === 'skipped' ? '⏭️' : '❌'

/**
 * The comment body. `results` holds the `needs.<job>.result` of each gate; `e2e` is the summed shard
 * totals. The verdict is green only when every gate that ran succeeded and the journeys reported
 * numbers with nothing failed, so a green comment is evidence about this SHA and nothing weaker.
 */
export function render({ sha, runUrl, results, e2e }) {
  const ran = Object.values(results).filter((r) => r !== 'skipped')
  const green =
    ran.length > 0 &&
    ran.every((r) => r === 'success') &&
    (results.e2e === 'skipped' || (e2e !== null && e2e.failed === 0))
  const lines = [
    MARKER,
    `### ${green ? '✅ Tests pass' : '❌ Tests did not all pass'} on \`${sha.slice(0, 7)}\``,
    '',
    '| Gate | Result |',
    '| --- | --- |',
    `| lint · typecheck · build | ${icon(results.verify)} ${results.verify} |`,
    `| unit tests | ${icon(results.test)} ${results.test} |`,
    `| e2e journeys | ${icon(results.e2e)} ${results.e2e} |`,
  ]
  if (e2e) {
    lines.push(
      '',
      `e2e: **${e2e.passed}** passed, **${e2e.failed}** failed, **${e2e.flaky}** flaky, **${e2e.skipped}** skipped.`,
    )
  } else if (results.e2e !== 'skipped') {
    lines.push('', 'e2e: no shard reported its totals.')
  }
  lines.push('', `[Run](${runUrl}) · commit \`${sha}\``)
  return lines.join('\n')
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, arg] = process.argv.slice(2)
  if (command === 'stats') {
    // Both engine reports are required; a missing lane never means zero failures.
    let stats = null
    try {
      const reports = ['.e2e/report.json', '.e2e/browser/report.json'].map(
        (path) => shardStats(JSON.parse(readFileSync(path, 'utf8'))),
      )
      if (reports.every(Boolean)) stats = sumShards(reports)
    } catch {
      console.error(
        '::warning::An e2e-inc report is unavailable; this shard reports no totals.',
      )
    }
    writeFileSync('e2e-stats.json', JSON.stringify(stats))
  } else if (command === 'render') {
    // Report side: every totals file under the directory, gate results from the environment.
    const shards = readShardStats(arg)
    const { SHA, RUN_URL, VERIFY, TEST, E2E } = process.env
    console.log(
      render({
        sha: SHA,
        runUrl: RUN_URL,
        results: { verify: VERIFY, test: TEST, e2e: E2E },
        e2e: sumShards(shards, Number(process.env.EXPECTED_SHARDS)),
      }),
    )
  } else {
    console.error('usage: test-report.mjs stats | render <stats-dir>')
    process.exit(2)
  }
}
