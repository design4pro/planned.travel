#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { shardStats } from './test-report.mjs'

/** Preserve evidence for failures, recovered failures and incomplete reports. */
export function keepDiagnostics(outcome, report) {
  const stats = shardStats(report)
  return (
    outcome !== 'success' || !stats || stats.flaky !== 0 || stats.failed !== 0
  )
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let report
  try {
    report = JSON.parse(readFileSync('.e2e/browser/report.json', 'utf8'))
  } catch {
    console.error(
      '::warning::e2e-inc JSON is unavailable; retaining available diagnostics.',
    )
  }
  console.log(`upload=${keepDiagnostics(process.env.TEST_OUTCOME, report)}`)
}
