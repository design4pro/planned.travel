/**
 * The cross-run claim lock's regression test. It guards a failure that is silent by
 * construction: nothing throws when two sandcastle runs claim the same issue — they simply both
 * build it, and the operator finds out from two branches and a merge conflict an hour later. That
 * is what happened the night this was written, so the cases below are that night's shapes: a live
 * run holding ids, a crashed one that must not hold anything, and two planners racing inside the
 * same window.
 *
 * Liveness is driven with real pids rather than a mock — `process.pid` for alive, and a pid
 * obtained by spawning a process and awaiting its exit for dead, which is the only way to name a
 * pid that is certainly gone. A mocked `isAlive` would assert the test's own model of liveness and
 * stay green if the real signal-0 probe broke.
 */
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { claim, claimedElsewhere, claimsPath, isAlive } from '../claims'

const roots: string[] = []

function makeLogsRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'sandcastle-claims-'))
  roots.push(root)
  return root
}

/** A run directory as `main.ts` lays one out: a pid lock, optionally some claims. */
function seedRun(
  logsRoot: string,
  runId: string,
  opts: { pid: number; claims?: string[] | string },
): void {
  mkdirSync(join(logsRoot, `run-${runId}`), { recursive: true })
  writeFileSync(join(logsRoot, `run-${runId}`, 'run.lock'), String(opts.pid))
  if (opts.claims !== undefined) {
    writeFileSync(
      join(logsRoot, `run-${runId}`, 'claims.json'),
      typeof opts.claims === 'string'
        ? opts.claims
        : JSON.stringify(opts.claims),
    )
  }
}

/** A pid that is certainly dead: spawn, wait for exit, keep the number. */
function deadPid(): number {
  const done = spawnSync(process.execPath, ['-e', ''])
  if (done.pid === undefined) throw new Error('could not spawn a probe process')
  return done.pid
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('claimedElsewhere', () => {
  it('reports the ids a live run holds', async () => {
    const root = makeLogsRoot()
    seedRun(root, '20260829-1', { pid: process.pid, claims: ['106', '108'] })
    mkdirSync(join(root, 'run-20260829-2'), { recursive: true })

    const held = await claimedElsewhere(root, '20260829-2')

    expect([...held.entries()].sort()).toEqual([
      ['106', '20260829-1'],
      ['108', '20260829-1'],
    ])
  })

  it('never reports the caller its own claims', async () => {
    const root = makeLogsRoot()
    seedRun(root, '20260829-1', { pid: process.pid, claims: ['106'] })

    expect(await claimedElsewhere(root, '20260829-1')).toEqual(new Map())
  })

  it('releases the claims of a crashed run', async () => {
    const root = makeLogsRoot()
    seedRun(root, '20260829-1', { pid: deadPid(), claims: ['106', '108'] })

    // The whole point: a crash must cost the operator nothing, so the next run
    // picks the work up rather than treating it as forever taken.
    expect(await claimedElsewhere(root, '20260829-2')).toEqual(new Map())
  })

  it('ignores a half-written claims file rather than throwing', async () => {
    const root = makeLogsRoot()
    seedRun(root, '20260829-1', { pid: process.pid, claims: '["106", "10' })

    expect(await claimedElsewhere(root, '20260829-2')).toEqual(new Map())
  })

  it('ignores a run that has not claimed anything yet', async () => {
    const root = makeLogsRoot()
    seedRun(root, '20260829-1', { pid: process.pid })

    expect(await claimedElsewhere(root, '20260829-2')).toEqual(new Map())
  })
})

describe('claim', () => {
  it('keeps and publishes ids nobody else holds', async () => {
    const root = makeLogsRoot()
    seedRun(root, '20260829-1', { pid: process.pid })

    expect(await claim(root, '20260829-1', ['106', '108'])).toEqual([
      '106',
      '108',
    ])
    expect(
      JSON.parse(readFileSync(claimsPath(root, '20260829-1'), 'utf8')),
    ).toEqual(['106', '108'])
  })

  it('yields an id a live run already holds', async () => {
    const root = makeLogsRoot()
    seedRun(root, '20260829-1', { pid: process.pid, claims: ['106'] })
    seedRun(root, '20260829-2', { pid: process.pid })

    expect(await claim(root, '20260829-2', ['106', '117'])).toEqual(['117'])
    // The published claim is narrowed too, so a third run sees the truth.
    expect(
      JSON.parse(readFileSync(claimsPath(root, '20260829-2'), 'utf8')),
    ).toEqual(['117'])
  })

  it('gives a contested id to exactly one of two racing runs', async () => {
    const root = makeLogsRoot()
    seedRun(root, '20260829-1', { pid: process.pid })
    seedRun(root, '20260829-2', { pid: process.pid })

    // Both planners returned the same plan and both claim it — the exact race
    // that produced two fleets on #106 and #108. Interleaved as it happens:
    // each writes, then each re-reads and sees the other.
    const [first, second] = await Promise.all([
      claim(root, '20260829-1', ['106', '108']),
      claim(root, '20260829-2', ['106', '108']),
    ])

    // Whoever wins, no id may be built twice and none may be silently dropped.
    expect([...first, ...second].sort()).toEqual(['106', '108'])
  })

  it('resolves the race the same way from either side', async () => {
    const root = makeLogsRoot()
    seedRun(root, '20260829-1', { pid: process.pid, claims: ['106'] })
    seedRun(root, '20260829-2', { pid: process.pid, claims: ['106'] })

    // Run 2 defers to run 1; run 1 does not defer to run 2. Asymmetry is the
    // property — a symmetric rule has both politely abandoning the issue.
    expect(await claim(root, '20260829-2', ['106'])).toEqual([])
    expect(await claim(root, '20260829-1', ['106'])).toEqual(['106'])
  })
})

describe('isAlive', () => {
  it('sees this process', () => {
    expect(isAlive(process.pid)).toBe(true)
  })

  it('does not see an exited process', () => {
    expect(isAlive(deadPid())).toBe(false)
  })
})
