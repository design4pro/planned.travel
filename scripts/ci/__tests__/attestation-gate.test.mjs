/**
 * What lets `verify` and `unit tests` be skipped on a pull request is one clause in `ci.yml`, and
 * dropping it while tidying the condition fails in two opposite ways: without
 * `needs.attestation.outputs.valid != 'true'` the jobs never skip and the attestation saves nothing,
 * without `!cancelled()` a push (where `attestation` is skipped) skips them too and the deploys,
 * which need both, never run. Read as text, like `ci-deploy-gate.test.mjs`.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')

const block = (job) =>
  WORKFLOW.match(new RegExp(`^  ${job}:\\n((?:(?!  \\S).*\\n?)*)`, 'm'))?.[1] ??
  ''

describe('ci.yml attestation gate', () => {
  it.each(['verify', 'test'])(
    '%s skips only behind a valid attestation',
    (job) => {
      const text = block(job)
      expect(text).toMatch(/^ {4}needs: attestation$/m)
      const condition = text.match(/^ {4}if: (.*)$/m)?.[1] ?? ''
      expect(condition).toContain('!cancelled()')
      expect(condition).toContain("needs.attestation.outputs.valid != 'true'")
    },
  )

  it('judges pull requests only, so a push always runs the full gate', () => {
    expect(block('attestation')).toContain(
      "if: github.event_name == 'pull_request'",
    )
  })

  it('judges the pull request head, not the merge commit', () => {
    expect(block('attestation')).toContain(
      'ref: ${{ github.event.pull_request.head.sha }}',
    )
  })

  it.each(['attestation', 'scope', 'e2e-report'])(
    '%s prepares its tools before checkout and control commands',
    (job) => {
      const text = block(job)
      const packages =
        job === 'scope' ? 'git tar gzip xz-utils' : 'git gh tar gzip xz-utils'
      expect(text).toContain('sudo apt-get update')
      expect(text).toContain(
        `sudo apt-get install -y --no-install-recommends ${packages}`,
      )
      expect(text).toContain('uses: actions/setup-node@v7')
      expect(text).toContain('node-version: 24.x')
      expect(text.indexOf('sudo apt-get install')).toBeLessThan(
        text.indexOf('uses: actions/setup-node@v7'),
      )
      expect(text.indexOf('uses: actions/setup-node@v7')).toBeLessThan(
        text.indexOf('uses: actions/checkout@v7'),
      )
    },
  )

  it.each(['attestation', 'scope', 'e2e-report'])(
    '%s uses the existing RUNNER_CI routing and recovery expression',
    (job) => {
      expect(block(job).match(/^ {4}runs-on: (.*)$/m)?.[1]).toBe(
        '${{ fromJSON(vars.RUNNER_CI || \'["self-hosted","linux","X64","ci"]\') }}',
      )
    },
  )
})
