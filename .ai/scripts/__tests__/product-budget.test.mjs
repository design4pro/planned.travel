import { expect, it } from 'vitest'
import { activeMinutes, productBudget } from '../product-budget.mjs'
const now = Date.parse('2026-11-03T12:00:00Z')
const events = (minutes) => [
  {
    type: 'turn.started',
    turnId: 'a',
    ts: new Date(now - minutes * 60_000).toISOString(),
  },
  { type: 'turn.completed', turnId: 'a', ts: new Date(now).toISOString() },
]
it('excludes parked CI gaps between active turns', () => {
  expect(
    activeMinutes(
      [
        { type: 'step-start', ts: new Date(now - 3600_000).toISOString() },
        ...events(2),
      ],
      now,
    ),
  ).toBe(2)
})
it('enforces 20 percent and one exploratory run, and rejects missing evidence', () => {
  const runs = [
    { id: 'a', status: 'done' },
    { id: 'b', status: 'done', productDiscovery: true },
  ]
  expect(
    productBudget(runs, (id) => events(id === 'a' ? 80 : 20), now).allowed,
  ).toBe(false)
  expect(
    productBudget(runs, (id) => events(id === 'a' ? 90 : 10), now).allowed,
  ).toBe(true)
  expect(
    productBudget([{ ...runs[1], status: 'running' }], () => events(1), now)
      .allowed,
  ).toBe(false)
  expect(() => activeMinutes(events(1).slice(1), now)).toThrow()
})
