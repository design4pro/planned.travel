import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { issueFromTask, mayContinue } from '../pipeline-control.mjs'

describe('pipeline control', () => {
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
})
