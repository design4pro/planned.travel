/**
 * The claim only protects anything while `src/start.ts` registers it.
 *
 * The middleware's own test drives its handler directly, so deleting it from the Start instance
 * would leave every test green and switch the whole guard off. This pins the registration.
 */

import { describe, expect, it, vi } from 'vitest'

const redaction = vi.hoisted(() => ({ name: 'failureRedactionMiddleware' }))

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({ client: () => ({ name: 'workspaceClaim' }) }),
  createCsrfMiddleware: () => ({ name: 'csrf' }),
  createStart: (options: () => unknown) => options(),
}))
vi.mock('#/server/errors/middleware', () => ({
  failureRedactionMiddleware: redaction,
}))

describe('src/start.ts', () => {
  it('registers the workspace claim for every server function', async () => {
    const { startInstance } = (await import('../../start')) as unknown as {
      startInstance: { functionMiddleware: Array<unknown> }
    }

    expect(startInstance.functionMiddleware).toContainEqual({
      name: 'workspaceClaim',
    })
    expect(startInstance.functionMiddleware).toContain(redaction)
  })
})
