import { beforeEach, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { prepareRevert } from '../revert-release.mjs'

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }))
const healthy = 'a'.repeat(40)
const failed = 'b'.repeat(40)
const input = { repo: 'owner/repo', healthy, failed, incident: 123 }
let schemaChanged = false
beforeEach(() => {
  schemaChanged = false
  vi.mocked(execFileSync)
    .mockReset()
    .mockImplementation((command, args) => {
      if (command === 'gh' && args[1] === 'list') return '[]'
      if (command === 'gh' && args[1] === 'create')
        return 'https://github.com/owner/repo/pull/124'
      if (args[0] === 'rev-parse') return failed
      if (args[0] === 'rev-list')
        return args.includes('--parents')
          ? `${failed} ${healthy} ${'c'.repeat(40)}`
          : failed
      if (args[0] === 'diff' && args.includes('--name-only'))
        return schemaChanged ? 'drizzle/0001.sql' : ''
      return ''
    })
})
it('reverts release merges once against develop and opens a draft with the incident reference', () => {
  expect(prepareRevert(input)).toContain('/pull/124')
  const args = vi.mocked(execFileSync).mock.calls.map((call) => call[1])
  expect(args).toContainEqual(['revert', '--no-commit', '-m', '1', failed])
  expect(
    args.find((row) => row[0] === 'worktree' && row[1] === 'add').at(-1),
  ).toBe('origin/develop')
  expect(args.find((row) => row[0] === 'pr' && row[1] === 'create')).toContain(
    '--draft',
  )
  expect(args.filter((row) => row[0] === 'push')).toHaveLength(1)
})
it('never pushes a schema reversal, and cleans up its temporary worktree on failure', () => {
  schemaChanged = true
  expect(() => prepareRevert(input)).toThrow(
    'Recovery must not revert schema or bindings',
  )
  const args = vi.mocked(execFileSync).mock.calls.map((call) => call[1])
  expect(args.some((row) => row[0] === 'push')).toBe(false)
  expect(args.some((row) => row[0] === 'worktree' && row[1] === 'remove')).toBe(
    true,
  )
})
