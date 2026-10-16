// @vitest-environment jsdom
import './test-env'

import * as React from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Button } from '../button'
import { IconButton } from '../icon-button'

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

describe.each(['button', 'icon'] as const)('%s loading interaction', (kind) => {
  function control(
    props: React.ComponentPropsWithoutRef<'button'> & { loading?: boolean },
  ) {
    return kind === 'button' ? (
      <Button {...props}>Save</Button>
    ) : (
      <IconButton icon={<span />} label="Save" {...props} />
    )
  }

  it('retains focus and blocks click, Enter and Space before handlers or submit', async () => {
    const click = vi.fn()
    const key = vi.fn()
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const view = render(
      <form onSubmit={submit}>
        {control({ type: 'submit', onClick: click, onKeyDown: key })}
      </form>,
    )
    const button = screen.getByRole('button')
    button.focus()
    view.rerender(
      <form onSubmit={submit}>
        {control({
          type: 'submit',
          loading: true,
          onClick: click,
          onKeyDown: key,
        })}
      </form>,
    )
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(document.activeElement).toBe(button)
    await userEvent.click(button)
    await userEvent.keyboard('{Enter} ')
    expect(click).not.toHaveBeenCalled()
    expect(key).not.toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()
    view.rerender(
      <form onSubmit={submit}>
        {control({ type: 'submit', onClick: click })}
      </form>,
    )
    await userEvent.keyboard('{Enter}')
    expect(click).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('keeps explicit disabled native while loading', () => {
    render(control({ disabled: true, loading: true }))
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  })

  it.each([
    { loading: true, disabled: false },
    { loading: true, disabled: true },
    { loading: false, disabled: true },
  ])(
    'blocks slotted handlers before execution (%j)',
    async ({ loading, disabled }) => {
      const click = vi.fn()
      const key = vi.fn()
      const capture = vi.fn()
      const child = (
        <a
          href="#destination"
          onClick={click}
          onKeyDown={key}
          onClickCapture={capture}
          aria-disabled={false}
          aria-busy={false}
        >
          Save
        </a>
      )
      render(
        kind === 'button' ? (
          <Button asChild loading={loading} disabled={disabled}>
            {child}
          </Button>
        ) : (
          <IconButton
            asChild
            loading={loading}
            disabled={disabled}
            icon={<span />}
            label="Save"
          >
            {child}
          </IconButton>
        ),
      )
      const link = screen.getByRole('link')
      link.focus()
      await userEvent.click(link)
      await userEvent.keyboard('{Enter} ')
      expect(click).not.toHaveBeenCalled()
      expect(key).not.toHaveBeenCalled()
      expect(capture).not.toHaveBeenCalled()
      expect(link.getAttribute('aria-disabled')).toBe('true')
      expect(link.getAttribute('aria-busy')).toBe(loading ? 'true' : null)
      expect(document.activeElement).toBe(link)
      expect(window.location.hash).not.toBe('#destination')
    },
  )
})
