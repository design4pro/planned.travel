import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  issueFromTask,
  mayContinue,
  claimWork,
  reusableEvidence,
} from '../pipeline-control.mjs'

describe('pipeline control', () => {
  it('allows restart by the owner but refuses a second run and keeps stages separate', () => {
    const store = mkdtempSync(join(tmpdir(), 'pipeline-claim-'))
    try {
      expect(claimWork(store, 'issue-7', 'run-a')).toBe(true)
      expect(claimWork(store, 'issue-7', 'run-a')).toBe(true)
      expect(claimWork(store, 'issue-7', 'run-b')).toBe(false)
      expect(claimWork(store, 'pr-7', 'run-b')).toBe(true)
      expect(() => claimWork(store, '../issue-8', 'run-b')).toThrow()
    } finally {
      rmSync(store, { recursive: true, force: true })
    }
  })

  it('invalidates evidence when head, base or policy changes', () => {
    const current = { head: 'abc', base: 'def', policy: 'v1' }
    const record = {
      ...current,
      kind: 'review',
      result: 'passed',
      source: 'report',
    }
    expect(reusableEvidence(record, current)).toBe(true)
    for (const key of Object.keys(current))
      expect(reusableEvidence(record, { ...current, [key]: 'new' })).toBe(false)
    expect(reusableEvidence({ ...record, result: 'pending' }, current)).toBe(
      false,
    )
    expect(reusableEvidence(null, current)).toBe(false)
  })
  it('accepts only issue tasks and never interpolates free text into Bash', () => {
    expect(issueFromTask('Implement issue #123.')).toBe(123)
    expect(issueFromTask('#123')).toBe(123)
    expect(issueFromTask('')).toBeNull()
    expect(() => issueFromTask('Implement issue #123; exit 0')).toThrow()
    expect(() => issueFromTask('99999999999999999999')).toThrow()
  })

  it('stops on anchored evidence and fails closed for a missing issue or empty STOP', () => {
    expect(mayContinue('ISSUE: #7\nSTOP: Already delivered\n')).toBe(false)
    expect(mayContinue('ISSUE: #7\nA quoted `STOP:` is not a stop.')).toBe(true)
    expect(() => mayContinue('No evidence')).toThrow()
    expect(() => mayContinue('ISSUE: #7\nSTOP:')).toThrow()
    expect(() => mayContinue('ISSUE: #7\nISSUE: #8')).toThrow()
  })

  it('routes STOP around validation, PR and merge without starting an agent', () => {
    const workflow = readFileSync(
      new URL('../../cezar/workflows/implement-ticket.yml', import.meta.url),
      'utf8',
    )
    expect(workflow).toContain('version: 2')
    for (const node of [
      'preflight',
      'after-implement',
      'before-pr',
      'before-merge',
    ]) {
      expect(workflow).toContain(`from: ${node}-ready.false, to: noop`)
      expect(workflow).toContain(`ref: ${node}.output`)
    }
    expect(workflow).toContain('from: after-implement-ready.true, to: gate')
    expect(workflow).toContain('from: before-pr-ready.true, to: pr')
    expect(workflow).toContain('from: before-merge-ready.true, to: merge')
  })

  it('settles merge outcomes without treating a blocked PR as success', () => {
    const workflow = readFileSync(
      new URL('../../cezar/workflows/implement-ticket.yml', import.meta.url),
      'utf8',
    )
    const merge = workflow
      .split('  - id: merge\n')[1]
      .split('  - id: after-implement\n')[0]
    expect(merge).toContain('verdicts: [merged, blocked, skipped, ready]')
    expect(merge).not.toContain('CEZ:DONE')
    expect(merge).toContain('CEZ:VERDICT merged')
    expect(merge).toContain('CEZ:VERDICT blocked')
    expect(merge).toContain('CEZ:VERDICT skipped')
    expect(workflow).toContain('from: merge.merged, to: confirm-merge')
    expect(workflow).toContain('from: merge.blocked, to: failed')
    expect(workflow).toContain('from: merge.skipped, to: noop')
    expect(workflow).toContain('from: merge.failed, to: failed')
    expect(workflow).not.toContain('from: merge.done, to: done')
  })
})
