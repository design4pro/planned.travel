import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DashboardLayout } from '../dashboard-layout'

afterEach(cleanup)
it('keeps one instance of each region and removes an empty rail while retaining controls', () => {
  const parts = {
    hero: <h1>Next trip</h1>,
    stats: 'Statistics',
    controls: <button>Widgets</button>,
    trips: 'Trips',
  }
  const { container, rerender } = render(
    <DashboardLayout {...parts} widgets={<aside>Clock</aside>} />,
  )
  expect(container.querySelectorAll('h1')).toHaveLength(1)
  expect(container.querySelectorAll('aside')).toHaveLength(1)
  expect(container.querySelector('[data-has-widgets]')).not.toBeNull()
  rerender(<DashboardLayout {...parts} />)
  expect(container.querySelector('.dashboard-rail')).toBeNull()
  expect(container.querySelector('[data-has-widgets]')).toBeNull()
  expect(container.querySelector('button')?.textContent).toBe('Widgets')
})
