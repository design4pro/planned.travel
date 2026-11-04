import { describe, expect, it } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { refreshMascotDashboard } from '../../-lib/mascot-refresh'

describe('dashboard router revalidation', () => {
  it('reports failure when the real router records a loader error', async () => {
    let fail = false
    const root = createRootRoute()
    const layout = createRoute({ getParentRoute: () => root, id: '_app' })
    const dashboard = createRoute({
      getParentRoute: () => layout,
      path: '/dashboard',
      loader: () => {
        if (fail) throw new Error('access lost')
        return { ok: true }
      },
    })
    const router = createRouter({
      routeTree: root.addChildren([layout.addChildren([dashboard])]),
      history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
      isServer: false,
    })
    await router.load()
    expect(await refreshMascotDashboard(router)).toBe(true)
    fail = true
    expect(await refreshMascotDashboard(router)).toBe(false)
  })
})
