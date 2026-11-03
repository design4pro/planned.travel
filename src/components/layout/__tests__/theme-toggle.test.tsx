import '#/components/ui/__tests__/test-env'

import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import { getThemeState, setThemeMode } from '#/lib/theme'
import { ThemeToggle } from '../theme-toggle'

beforeEach(() => setThemeMode('system'))
afterEach(cleanup)

function mount() {
  render(
    <I18nProvider locale="en" messages={namespaceCatalogue('shell', Shell)}>
      <ThemeToggle />
      <ThemeToggle />
    </I18nProvider>,
  )
  return userEvent.setup()
}

describe('ThemeToggle accessibility', () => {
  it('keeps a visible hidden heading, valid menu children and an instance-unique group name', async () => {
    const user = mount()
    const triggers = screen.getAllByRole('button')
    const labelIds: string[] = []
    for (const trigger of triggers) {
      trigger.focus()
      await user.keyboard('{Enter}')
      const menu = await screen.findByRole('menu')
      const allowed = [
        'group',
        'menuitem',
        'menuitemradio',
        'menuitemcheckbox',
        'separator',
      ]
      for (const child of menu.children) {
        expect(
          child.getAttribute('aria-hidden') === 'true' ||
            allowed.includes(child.getAttribute('role') ?? ''),
        ).toBe(true)
      }
      const heading = within(menu).getByText(Shell['theme.label'])
      expect(heading.getAttribute('aria-hidden')).toBe('true')
      expect(heading.hidden).toBe(false)
      expect(getComputedStyle(heading).display).not.toBe('none')
      const group = within(menu).getByRole('group', {
        name: Shell['theme.label'],
      })
      expect(heading.id).not.toBe('')
      expect(group.getAttribute('aria-labelledby')).toBe(heading.id)
      labelIds.push(heading.id)
      for (const mode of ['light', 'dark', 'system'] as const) {
        expect(
          within(group)
            .getByRole('menuitemradio', { name: Shell[`theme.${mode}`] })
            .getAttribute('aria-checked'),
        ).toBe(String(mode === 'system'))
      }
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      expect(document.activeElement).toBe(trigger)
    }
    expect(new Set(labelIds).size).toBe(2)
  })

  it('opens, navigates and selects with the keyboard while keeping theme state and focus', async () => {
    const user = mount()
    const trigger = screen.getAllByRole('button')[0]
    for (const [index, mode] of (
      ['light', 'dark', 'system'] as const
    ).entries()) {
      trigger.focus()
      await user.keyboard('{Enter}')
      await screen.findByRole('menu')
      for (let step = 0; step < index; step++)
        await user.keyboard('{ArrowDown}')
      const choice = screen.getByRole('menuitemradio', {
        name: Shell[`theme.${mode}`],
      })
      expect(document.activeElement).toBe(choice)
      await user.keyboard('{Enter}')
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      expect(getThemeState().mode).toBe(mode)
      expect(document.activeElement).toBe(trigger)
      await user.keyboard('{Enter}')
      expect(
        (
          await screen.findByRole('menuitemradio', {
            name: Shell[`theme.${mode}`],
          })
        ).getAttribute('aria-checked'),
      ).toBe('true')
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      expect(document.activeElement).toBe(trigger)
    }
  })
})
