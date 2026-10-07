/**
 * The pull request comment is the evidence that the app works on one SHA, so the cases that matter
 * are the ones where it must NOT say so: a failed gate, a failed test, and shards that reported nothing.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  MARKER,
  readShardStats,
  render,
  shardStats,
  sumShards,
} from '../test-report.mjs'

const sha = 'abcdef1234567890'
const base = { sha, runUrl: 'https://example.test/run/1' }
const ok = { verify: 'success', test: 'success', e2e: 'success' }

describe('shardStats', () => {
  it('maps the Playwright stats names', () => {
    expect(
      shardStats({
        stats: { expected: 5, unexpected: 1, flaky: 2, skipped: 3 },
      }),
    ).toEqual({
      passed: 5,
      failed: 1,
      flaky: 2,
      skipped: 3,
    })
  })

  it.each([undefined, {}, { stats: { expected: 1 } }])(
    'returns null for %j',
    (report) => {
      expect(shardStats(report)).toBeNull()
    },
  )
})

describe('sumShards', () => {
  it('adds the shards and ignores one that reported nothing', () => {
    const a = { passed: 2, failed: 0, flaky: 1, skipped: 0 }
    const b = { passed: 3, failed: 1, flaky: 0, skipped: 2 }
    expect(sumShards([a, null, b])).toEqual({
      passed: 5,
      failed: 1,
      flaky: 1,
      skipped: 2,
    })
  })

  it('is null when no shard reported, never zero', () => {
    expect(sumShards([null, null])).toBeNull()
  })
})

describe('readShardStats', () => {
  const dirs = []
  const download = () => {
    const dir = mkdtempSync(join(tmpdir(), 'test-report-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true })
  })

  const a = { passed: 2, failed: 0, flaky: 1, skipped: 0 }
  const b = { passed: 3, failed: 1, flaky: 0, skipped: 2 }

  // download-artifact puts each matched artifact in its own subdirectory unless merge-multiple is
  // set, and both shards name their file `e2e-stats.json`, so flattening would overwrite one.
  it('reads the file of every artifact subdirectory', () => {
    const dir = download()
    for (const [name, stats] of [
      ['e2e-stats-1', a],
      ['e2e-stats-2', b],
    ]) {
      mkdirSync(join(dir, name))
      writeFileSync(join(dir, name, 'e2e-stats.json'), JSON.stringify(stats))
    }
    expect(sumShards(readShardStats(dir))).toEqual({
      passed: 5,
      failed: 1,
      flaky: 1,
      skipped: 2,
    })
  })

  it('reads a flat directory and keeps a shard that reported null', () => {
    const dir = download()
    writeFileSync(join(dir, 'one.json'), JSON.stringify(a))
    writeFileSync(join(dir, 'two.json'), 'null')
    expect(readShardStats(dir)).toEqual(expect.arrayContaining([a, null]))
    expect(readShardStats(dir)).toHaveLength(2)
  })

  it('is empty when nothing was downloaded', () => {
    expect(readShardStats(download())).toEqual([])
  })
})

describe('render', () => {
  const totals = { passed: 26, failed: 0, flaky: 0, skipped: 0 }

  it('carries the marker, the short SHA and the totals when everything passed', () => {
    const body = render({ ...base, results: ok, e2e: totals })
    expect(body.startsWith(MARKER)).toBe(true)
    expect(body).toContain('✅ Tests pass on `abcdef1`')
    expect(body).toContain('**26** passed, **0** failed')
  })

  it('is red when a unit test job failed', () => {
    expect(
      render({ ...base, results: { ...ok, test: 'failure' }, e2e: totals }),
    ).toContain('❌ Tests did not all pass')
  })

  it('is red when a journey failed', () => {
    expect(
      render({ ...base, results: ok, e2e: { ...totals, failed: 1 } }),
    ).toContain('❌')
  })

  it('is red, not green, when the shards reported nothing', () => {
    const body = render({ ...base, results: ok, e2e: null })
    expect(body).toContain('❌')
    expect(body).toContain('no shard reported its totals')
  })

  it('stays green for a documentation PR whose journeys were skipped on purpose', () => {
    const body = render({
      ...base,
      results: { ...ok, e2e: 'skipped' },
      e2e: null,
    })
    expect(body).toContain('✅')
    expect(body).not.toContain('no shard reported')
  })
})
