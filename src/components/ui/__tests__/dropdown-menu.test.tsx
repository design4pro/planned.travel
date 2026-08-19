// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu'
import { Button } from '../button'

afterEach(cleanup)

function Fixture({ onDelete = () => {} }: { onDelete?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Trip actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Trip</DropdownMenuLabel>
        <DropdownMenuItem shortcut="⌘D">Duplicate</DropdownMenuItem>
        <DropdownMenuCheckboxItem checked>
          Show weather
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          Delete trip
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('DropdownMenu', () => {
  it('opens on the trigger and exposes a menu', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Trip actions' }))
    expect(screen.getByRole('menu')).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: /Duplicate/ })).not.toBeNull()
  })

  it('reports the checkbox item state', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Trip actions' }))
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Show weather' })
        .getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('highlights items with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Trip actions' }))
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: /Duplicate/ }),
    )
  })

  it('runs an item on Enter and closes', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<Fixture onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: 'Trip actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete trip' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Trip actions' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('tints a destructive item and renders a shortcut hint', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Trip actions' }))
    expect(
      screen.getByRole('menuitem', { name: 'Delete trip' }).className,
    ).toContain('text-danger')
    expect(screen.getByText('⌘D')).not.toBeNull()
  })

  it('skips a disabled item', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Trip actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled onSelect={onSelect}>
            Export PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await user.click(screen.getByRole('button', { name: 'Trip actions' }))
    const item = screen.getByRole('menuitem', { name: 'Export PDF' })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    await user.click(item)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
