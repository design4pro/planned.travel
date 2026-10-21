import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SUPPORTED_LOCALES } from '#/lib/i18n'
import { LanguagePicker } from '../language-picker'

afterEach(cleanup)

function mount() {
  const onSelect = vi.fn()
  render(
    <LanguagePicker
      value="en"
      label="Language"
      onSelect={onSelect}
      columnMin="9rem"
    />,
  )
  return onSelect
}
const chip = (tag: string) => screen.getByTestId(`locale-chip-${tag}`)

describe('LanguagePicker without a workspace row', () => {
  it('renders exactly the shipped languages and supports a narrower column minimum', () => {
    mount()
    expect(screen.getAllByRole('radio')).toHaveLength(23)
    expect(screen.queryByTestId('locale-chip-workspace')).toBeNull()
    expect(
      screen
        .getByRole('radiogroup')
        .style.getPropertyValue('--language-column-min'),
    ).toBe('9rem')
    expect(chip('ar').getAttribute('dir')).toBe('rtl')
    expect(chip('ar').getAttribute('lang')).toBe('ar')
  })

  it('uses the shown first and last languages for Home, End and wrapping in both directions', async () => {
    const user = userEvent.setup()
    const select = mount()
    chip('en').focus()
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(chip('ar'))
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(chip('zh-Hant'))
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(chip('ar'))
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(chip('zh-Hant'))
    expect(select).not.toHaveBeenCalled()
  })

  it('steps real rows from index zero and clamps Up on the first row', async () => {
    const user = userEvent.setup()
    const select = mount()
    screen.getAllByRole('radio').forEach((node, index) => {
      Object.defineProperty(node, 'offsetTop', {
        value: Math.floor(index / 2) * 52,
      })
    })
    chip('ar').focus()
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(chip('ar'))
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(chip(SUPPORTED_LOCALES[2].tag))
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(chip('ar'))
    chip('ca').focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(chip(SUPPORTED_LOCALES[3].tag))
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(document.activeElement).toBe(chip('ar'))
    chip('zh-Hant').focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(chip('zh-Hant'))
    expect(select).not.toHaveBeenCalled()
  })

  it('rebuilds the list when the follow row is removed and keeps single-row stepping', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { rerender } = render(
      <LanguagePicker
        value="en"
        label="Language"
        onSelect={onSelect}
        followWorkspaceLabel="Follow"
        workspaceDefault="pl"
      />,
    )
    rerender(<LanguagePicker value="en" label="Language" onSelect={onSelect} />)
    chip('ar').focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(chip('ca'))
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(document.activeElement).toBe(chip('ar'))
    expect(screen.getAllByRole('radio')).toHaveLength(23)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('keeps a tab stop when removing the selected workspace row after End navigation', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { rerender } = render(
      <LanguagePicker
        value="workspace"
        label="Language"
        onSelect={onSelect}
        followWorkspaceLabel="Follow"
        workspaceDefault="pl"
      />,
    )
    chip('workspace').focus()
    await user.keyboard('{End}')
    rerender(
      <LanguagePicker value="workspace" label="Language" onSelect={onSelect} />,
    )
    const stops = screen
      .getAllByRole('radio')
      .filter((node) => node.tabIndex === 0)
    expect(stops).toHaveLength(1)
    expect(stops[0]).toBe(chip('ar'))
  })

  it('mirrors horizontal traversal in an Arabic group and commits Arabic normally', async () => {
    const user = userEvent.setup()
    const select = mount()
    screen.getByRole('radiogroup').style.direction = 'rtl'
    chip('ar').focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(chip('zh-Hant'))
    await user.keyboard('{ArrowLeft}{Enter}')
    expect(select).toHaveBeenCalledExactlyOnceWith('ar')
  })
})
