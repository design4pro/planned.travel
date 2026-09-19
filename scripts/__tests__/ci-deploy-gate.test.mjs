/**
 * The gate in front of `deploy-staging` and `deploy-production` in `.github/workflows/ci.yml`.
 *
 * Before #531 both jobs carried no status function in their `if`, so GitHub applied an implicit
 * `success()` that reads every ancestor in the `needs` graph. `e2e-report` descends from `scope`,
 * which runs on pull requests only, so a push skipped `scope`, the skip travelled down, and both
 * deploys were skipped on every push to `develop` and `main` - behind a green run (push run
 * 35005130640). #531 spelled the gate out: `!cancelled()` plus each direct `needs` result equal to
 * `success`. Drop any one clause while tidying the condition and the failure comes back just as
 * silently, so the cases below hold every clause in place.
 *
 * Read as text, like the sibling workflow tests: the repository pins no YAML parser, and the `if`
 * is one line.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')

const REQUIRED = [
  '!cancelled()',
  "needs.verify.result == 'success'",
  "needs.test.result == 'success'",
  "needs.e2e-report.result == 'success'",
]

/**
 * The gate clauses `job`'s job-level `if` lacks, or null when the job or its `if` is not found.
 * The job block runs from its two-space-indented key to the next one, so a step-level `if` further
 * down another job is never read in its place.
 */
function missingClauses(workflow, job) {
  const block = workflow.match(
    new RegExp(`^  ${job}:\\n((?:(?!  \\S).*\\n?)*)`, 'm'),
  )
  const condition = block?.[1].match(/^ {4}if: (.*)$/m)
  if (!condition) return null
  return REQUIRED.filter((clause) => !condition[1].includes(clause))
}

describe('ci.yml deploy gate', () => {
  it.each(['deploy-staging', 'deploy-production'])(
    '%s keeps every gate clause',
    (job) => {
      expect(missingClauses(WORKFLOW, job)).toEqual([])
    },
  )

  it('reports every clause the pre-#531 gate lacked', () => {
    const before = [
      'jobs:',
      '  deploy-staging:',
      '    needs: [verify, test, e2e-report]',
      "    if: github.event_name == 'push' && github.ref == 'refs/heads/develop'",
      '    uses: ./.github/workflows/deploy-staging.yml',
      '',
    ].join('\n')
    expect(missingClauses(before, 'deploy-staging')).toEqual(REQUIRED)
  })
})
