import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MenuContent,
  MenuDangerItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from '../menu'

afterEach(cleanup)

describe('chrome menu focus indicator', () => {
  it('keeps an inset outline and the existing tint on every highlighted item', async () => {
    const user = userEvent.setup()
    render(
      <MenuRoot>
        <MenuTrigger>Open menu</MenuTrigger>
        <MenuContent>
          <MenuItem>Regular action</MenuItem>
          <MenuDangerItem>Danger action</MenuDangerItem>
          <MenuRadioGroup value="theme">
            <MenuRadioItem value="theme">Theme choice</MenuRadioItem>
          </MenuRadioGroup>
        </MenuContent>
      </MenuRoot>,
    )

    await user.tab()
    await user.keyboard('{Enter}')
    const items = [
      screen.getByRole('menuitem', { name: 'Regular action' }),
      screen.getByRole('menuitem', { name: 'Danger action' }),
      screen.getByRole('menuitemradio', { name: 'Theme choice' }),
    ]

    for (const [index, item] of items.entries()) {
      if (index > 0) await user.keyboard('{ArrowDown}')
      expect(document.activeElement).toBe(item)
      expect(item.hasAttribute('data-highlighted')).toBe(true)
      const classes = item.className.split(/\s+/)
      expect(classes).toEqual(
        expect.arrayContaining([
          'data-[highlighted]:outline-2',
          'data-[highlighted]:outline-solid',
          'data-[highlighted]:-outline-offset-2',
          'data-[highlighted]:outline-ring',
          index === 1
            ? 'data-[highlighted]:bg-danger-soft'
            : 'data-[highlighted]:bg-hover',
        ]),
      )
    }
  })
})
