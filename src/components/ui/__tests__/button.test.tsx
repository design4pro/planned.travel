// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Button } from '../button'

afterEach(cleanup)

/**
 * The 32 / 40 / 48px ladder DESIGN.md documents. Pinned here so a refactor of
 * `buttonVariants` cannot move a rung without a test saying so.
 */
describe('Button size', () => {
  it.each([
    ['sm', 'h-8'],
    ['md', 'h-10'],
    ['lg', 'h-12'],
  ] as const)('renders %s at %s', (size, height) => {
    render(<Button size={size}>Save</Button>)
    expect(screen.getByRole('button').className).toContain(height)
  })

  it('falls back to md when no size is passed', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button').className).toContain('h-10')
  })
})
