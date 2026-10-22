/**
 * The sign-in pages carry a `?redirect=` query that can hold a join-link secret. A same-origin
 * request made from one of them sends the whole URL as `Referer`, query included, unless the page
 * says otherwise - and `strict-origin` is the one value that still sends the origin.
 */

import { describe, expect, it, vi } from 'vitest'

import { signInHead } from '../head'

// The loaders reach the Worker's bindings, which a jsdom test cannot load; the head never calls them.
vi.mock('#/components/layout/visitor-language-switcher', () => ({
  VisitorLanguageSwitcher: () => null,
}))
vi.mock('../../-server/config', () => ({
  loadAuthConfig: vi.fn(),
  loadVerificationState: vi.fn(),
}))
const { Route: LoginRoute } = await import('../../login')
const { Route: RegisterRoute } = await import('../../register')
const { Route: VerifyEmailRoute } = await import('../../verify-email')
const { Route: TwoFactorRoute } = await import('../../two-factor')

const routes = {
  login: LoginRoute,
  register: RegisterRoute,
  'verify-email': VerifyEmailRoute,
  'two-factor': TwoFactorRoute,
}

describe('sign-in pages referrer policy', () => {
  it('is the strict-origin referrer meta', () => {
    expect(signInHead().meta).toContainEqual({
      name: 'referrer',
      content: 'strict-origin',
    })
  })

  it.each(Object.entries(routes))('%s uses it', (_name, route) => {
    expect(route.options.head).toBe(signInHead)
  })
})
