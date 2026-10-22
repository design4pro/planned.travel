// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Fab } from '../fab'

afterEach(cleanup)

const icon = <svg data-testid="icon" />

/** The same control rendered two ways: a native button, or a slotted element. */
const modes = [
  ['native button', 'button', { asChild: false }],
  ['asChild', 'link', { asChild: true }],
] as const

describe.each(modes)('Fab (%s) busy state', (_name, role, mode) => {
  function renderFab(props: { loading?: boolean; disabled?: boolean } = {}) {
    render(
      <Fab icon={icon} label="Add stop" {...mode} {...props}>
        {mode.asChild ? <a href="/add">Add</a> : null}
      </Fab>,
    )
    return screen.getByRole(role, { name: 'Add stop' })
  }

  it('exposes aria-busy while loading', () => {
    expect(renderFab({ loading: true }).getAttribute('aria-busy')).toBe('true')
  })

  it('has no aria-busy attribute when not loading', () => {
    expect(renderFab().hasAttribute('aria-busy')).toBe(false)
  })

  it('does not report busy for a merely disabled control', () => {
    expect(renderFab({ disabled: true }).hasAttribute('aria-busy')).toBe(false)
  })
})

describe('Fab asChild loading', () => {
  it('keeps its accessible name and aria-disabled while loading', () => {
    render(
      <Fab asChild loading icon={icon} label="Add stop">
        <a href="/add">Add</a>
      </Fab>,
    )
    const link = screen.getByRole('link', { name: 'Add stop' })
    expect(link.getAttribute('aria-disabled')).toBe('true')
  })
})
