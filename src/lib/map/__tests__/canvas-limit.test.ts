import { expect, it } from 'vitest'
import { mapCanvasLimit } from '../canvas-limit'

it('supports a high-density desktop without using the entire GPU maximum', () => {
  expect(mapCanvasLimit(16384, 16384)).toBe(8192)
})
it('respects the smaller texture or renderbuffer limit', () => {
  expect(mapCanvasLimit(4096, 8192)).toBe(4096)
  expect(mapCanvasLimit(8192, 2048)).toBe(2048)
})
it.each([undefined, null, NaN, Infinity, 0, -1, '8192'])(
  'retains the previous cap for an unreliable answer: %s',
  (answer) => {
    expect(mapCanvasLimit(answer, 8192)).toBe(4096)
    expect(mapCanvasLimit(8192, answer)).toBe(4096)
  },
)
