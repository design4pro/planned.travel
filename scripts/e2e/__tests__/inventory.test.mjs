import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cwd = fileURLToPath(new URL('../../../', import.meta.url))
const inventory = JSON.parse(
  readFileSync(
    new URL('../../../docs/testing/e2e-inventory.json', import.meta.url),
    'utf8',
  ),
)
const collect = (config) =>
  JSON.parse(
    execFileSync(
      'pnpm',
      [
        'exec',
        'e2e',
        'list',
        '--config',
        config,
        '--target',
        'chromium',
        '--reporter',
        'json',
      ],
      {
        cwd,
        env: {
          ...process.env,
          E2E_BASE_URL: 'http://127.0.0.1:3030',
          PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3030',
        },
        encoding: 'utf8',
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
      },
    ),
  ).pairs

describe('the migration preserves every recorded regression', () => {
  it('collects every original browser behavior and every native replacement', () => {
    const pairs = [
      ...collect('e2e.config.ts'),
      ...collect('e2e.browser.config.ts'),
    ]
    for (const file of inventory.files) {
      expect(file.runner, file.currentFile).toBe('e2e-inc')
      const current = pairs.filter(
        (pair) => pair.file === file.currentFile && pair.kind === 'test',
      )
      if (file.engine === 'browser-journey') {
        expect(
          current.map((pair) => pair.title).sort(),
          file.currentFile,
        ).toEqual(file.tests.map((test) => test.title).sort())
      }
      for (const replacement of file.nativeTests) {
        const pair = current.find(
          (pair) =>
            JSON.stringify(pair.titlePath) ===
            JSON.stringify(replacement.titlePath),
        )
        expect(
          pair,
          `${file.currentFile}: ${replacement.titlePath.join(' > ')}`,
        ).toBeDefined()
        if (
          file.currentFile.endsWith('trip-weather.e2e.ts') &&
          replacement.titlePath.includes('DOC-08 — evidence')
        )
          expect(['run', 'skip']).toContain(pair.disposition)
        else expect(pair.disposition).toBe('run')
      }
    }
    expect(
      readdirSync(new URL('../../../e2e/', import.meta.url)).filter((name) =>
        name.endsWith('.spec.ts'),
      ),
    ).toEqual([])
  }, 130_000)
})
