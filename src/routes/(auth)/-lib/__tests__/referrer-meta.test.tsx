/**
 * The three sign-in pages carry a `?redirect=` query that can hold a join-link secret. A same-origin
 * request made from one of them sends the whole URL as `Referer`, query included, unless the page
 * says otherwise - and `strict-origin` is the one value that still sends the origin.
 */

import { describe, expect, it, vi } from 'vitest'

// The loaders reach the Worker's bindings, which a jsdom test cannot load; the head never calls them.
vi.mock('../../-server/config', () => ({
  loadAuthConfig: vi.fn(),
  loadVerificationState: vi.fn(),
}))
const { Route: LoginRoute } = await import('../../login')
const { Route: RegisterRoute } = await import('../../register')
const { Route: VerifyEmailRoute } = await import('../../verify-email')

const routes = {
  login: LoginRoute,
  register: RegisterRoute,
  'verify-email': VerifyEmailRoute,
}

describe('sign-in pages referrer policy', () => {
  it.each(Object.entries(routes))(
    '%s sends the strict-origin referrer meta',
    (_name, route) => {
      const head = route.options.head
      if (head === undefined) throw new Error('Missing route head')

      // The head option reads only the route's own context; none of it is used by these routes.
      const { meta } = head({} as Parameters<typeof head>[0]) ?? {}

      expect(meta).toContainEqual({
        name: 'referrer',
        content: 'strict-origin',
      })
    },
  )
})
