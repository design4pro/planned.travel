#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Preserve evidence for failures, recovered failures and incomplete reports. */
export function keepDiagnostics(outcome, report) {
  return (
    outcome !== 'success' ||
    !report?.stats ||
    typeof report.stats.flaky !== 'number' ||
    report.stats.flaky > 0 ||
    typeof report.stats.unexpected !== 'number' ||
    report.stats.unexpected > 0
  )
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let report
  try {
    report = JSON.parse(readFileSync('test-results/results.json', 'utf8'))
  } catch {
    console.error(
      '::warning::Playwright JSON is unavailable; retaining available diagnostics.',
    )
  }
  console.log(`upload=${keepDiagnostics(process.env.TEST_OUTCOME, report)}`)
}
