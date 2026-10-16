import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../-server/trip', () => ({ loadTripFiles: vi.fn() }))
vi.mock('#/components/modules/files', () => ({}))
vi.mock('../../../../-ui/trip-header', () => ({}))
const { Route } = await import('../../files')

describe('Files route export search validator', () => {
  it('keeps a queue id and drops malformed or non-string values without an error', () => {
    const validator = Route.options.validateSearch
    if (validator === undefined || !('parse' in validator))
      throw new Error('Missing route validator')
    expect(validator.parse({ export: 'task-1' })).toEqual({ export: 'task-1' })
    for (const value of [
      '../other',
      '<img>',
      '',
      'a'.repeat(129),
      123,
      ['task'],
    ]) {
      expect(validator.parse({ export: value })).toEqual({ export: undefined })
    }
    expect(validator.parse({})).toEqual({})
  })
})
