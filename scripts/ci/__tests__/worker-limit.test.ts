import { describe, expect, it } from 'vitest'
import { validationWorkerLimit } from '../worker-limit'

describe('validation worker resource ceiling', () => {
  it('keeps the existing default and permits reducing concurrency', () => {
    expect(validationWorkerLimit(2)).toBe(2)
    expect(validationWorkerLimit(2, '1')).toBe(1)
  })
  it.each(['0', '-1', '3', '1.5', '1x', '01', '', 'Infinity'])(
    'rejects %s instead of raising or disabling the ceiling',
    (value) => {
      expect(() => validationWorkerLimit(2, value)).toThrow(
        'VALIDATION_MAX_WORKERS',
      )
    },
  )
})
