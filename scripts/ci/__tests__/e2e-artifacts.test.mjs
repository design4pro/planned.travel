import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const workflows = ['ci.yml', 'e2e-webkit.yml']

describe.each(workflows)('%s artifact-independent verdict', (name) => {
  const source = readFileSync(
    new URL(`../../../.github/workflows/${name}`, import.meta.url),
    'utf8',
  )
  it('reports directly and never transports blobs or coverage HTML', () => {
    expect(source).not.toContain('--reporter=blob')
    expect(source).not.toContain('actions/download-artifact')
    expect(source).not.toContain('path: coverage')
    expect(source).toContain(
      'PLAYWRIGHT_JSON_OUTPUT_NAME: test-results/results.json',
    )
    expect(source).toContain('--reporter=list,github,json')
  })
  it('retains only selected diagnostics, for two days, without affecting the verdict', () => {
    expect(source).toContain('retention-days: 2')
    expect(source).toContain('test-results/**/trace.zip')
    expect(source).not.toMatch(/path: test-results\s*$/m)
    expect(source).toContain('continue-on-error: true')
    expect(source).toContain('github.run_attempt')
  })
  it('retains evidence when JSON is missing and does not forgive failed tests', () => {
    const testStep = source
      .split('        id: tests')[1]
      .split('      - name:')[0]
    expect(testStep).not.toContain('continue-on-error')
    expect(source).toContain("steps.diagnostics.outputs.upload != 'false'")
    if (name === 'ci.yml') {
      expect(source).toContain("needs.scope.outputs.e2e != 'false'")
      expect(source).toContain(
        "needs.scope.result == 'success' && needs.scope.outputs.e2e == 'false'",
      )
    }
  })
  it('has a verdict job that needs no checkout or toolchain', () => {
    const id = name === 'ci.yml' ? 'e2e-report' : 'e2e-webkit-report'
    const job = source.split(`\n  ${id}:`)[1].split(/\n  [a-z][a-z-]*:/)[0]
    expect(job).not.toContain('uses:')
    expect(job).toContain('if: ${{ !cancelled() }}')
    const script = job
      .split('run: |\n')[1]
      .split('\n')
      .filter((line) => line.startsWith('          '))
      .map((line) => line.slice(10))
      .join('\n')
    for (const result of ['success', 'failure', 'cancelled', 'skipped']) {
      let status = 0
      try {
        execFileSync('bash', ['-c', script], {
          env: { ...process.env, SHARDS_RESULT: result, SKIP_ALLOWED: 'false' },
          stdio: 'pipe',
        })
      } catch (error) {
        status = error.status
      }
      expect(status === 0, result).toBe(result === 'success')
    }
    if (name === 'ci.yml') {
      expect(() =>
        execFileSync('bash', ['-c', script], {
          env: {
            ...process.env,
            SHARDS_RESULT: 'skipped',
            SKIP_ALLOWED: 'true',
          },
          stdio: 'pipe',
        }),
      ).not.toThrow()
    }
  })
})
