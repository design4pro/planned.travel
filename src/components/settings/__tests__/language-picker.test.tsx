// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SUPPORTED_LOCALES } from '#/lib/i18n'
import {
  FOLLOW_WORKSPACE,
  LanguagePicker,
  LanguagePickerSkeleton,
} from '../language-picker'

import type { LocaleChoice } from '../language-picker'

afterEach(cleanup)

const COPY = {
  label: 'Language',
  followWorkspaceLabel: 'Follow the workspace',
} as const

function renderPicker(
  overrides: Partial<React.ComponentProps<typeof LanguagePicker>> = {},
) {
  const onSelect = vi.fn()
  const result = render(
    <LanguagePicker
      value="en"
      workspaceDefault="pl"
      onSelect={onSelect}
      {...COPY}
      {...overrides}
    />,
  )
  return { onSelect, ...result }
}

const chip = (choice: LocaleChoice): HTMLElement =>
  screen.getByTestId(`locale-chip-${choice}`)

describe('LanguagePicker — the catalogue it renders', () => {
  it('renders all 23 shipped locales plus the follow-the-workspace option', () => {
    renderPicker()
    expect(SUPPORTED_LOCALES).toHaveLength(23)
    expect(screen.getAllByRole('radio')).toHaveLength(24)
  })

  it('gives every option its own lang, and only Arabic a dir', () => {
    renderPicker()
    for (const descriptor of SUPPORTED_LOCALES) {
      const option = chip(descriptor.tag)
      expect(option.getAttribute('lang')).toBe(descriptor.tag)
      expect(option.getAttribute('dir')).toBe(
        descriptor.dir === 'rtl' ? 'rtl' : null,
      )
    }
    expect(chip('ar').getAttribute('dir')).toBe('rtl')
    expect(chip('ko').getAttribute('lang')).toBe('ko')
    expect(chip('zh-Hans').getAttribute('lang')).toBe('zh-Hans')
    expect(chip('zh-Hant').getAttribute('lang')).toBe('zh-Hant')
  })

  it('shows the native name alone — no flag, no tag, no English exonym', () => {
    renderPicker()
    expect(chip('ja').textContent).toBe('日本語')
    expect(chip('pt-BR').textContent).toBe('Português (Brasil)')
    expect(chip('cs').textContent).toBe('Čeština')
    expect(chip('el').textContent).toBe('Ελληνικά')
  })

  it('names the workspace default in its own script on the follow option', () => {
    renderPicker({ workspaceDefault: 'ar' })
    const option = chip(FOLLOW_WORKSPACE)
    expect(option.textContent).toContain('Follow the workspace')
    const name = option.querySelector('[lang="ar"]')
    expect(name?.textContent).toBe('العربية')
    expect(name?.getAttribute('dir')).toBe('rtl')
  })

  it('keeps the auto margin off the element that carries dir', () => {
    // `ms-auto` is `margin-inline-start`, which resolves against the element's
    // own direction. On the element that also carries `dir="rtl"` it becomes
    // `margin-right: auto` and parks العربية against the label instead of at
    // the end of the chip — measured in Chromium at 1440px. The auto margin
    // therefore lives on the trailing group, which has no direction of its own,
    // and the language span sits inside it.
    renderPicker({ workspaceDefault: 'ar' })
    const option = chip(FOLLOW_WORKSPACE)
    const trailing = option.querySelector('.ms-auto')
    expect(trailing).not.toBeNull()
    expect(trailing?.getAttribute('dir')).toBeNull()
    expect(trailing?.getAttribute('lang')).toBeNull()
    expect(trailing?.querySelector('[dir="rtl"]')?.textContent).toBe('العربية')
  })
})

describe('LanguagePicker — the mark slot', () => {
  /** The 16px well every option reserves at its trailing edge. */
  const slot = (choice: LocaleChoice): Element => {
    const well = chip(choice).querySelector('span.size-4')
    if (!well) throw new Error(`no mark slot on ${choice}`)
    return well
  }

  it('reserves the well on every option so a commit cannot re-measure a name', () => {
    renderPicker({ value: 'en' })
    for (const descriptor of SUPPORTED_LOCALES) {
      expect(slot(descriptor.tag)).toBeDefined()
    }
    expect(slot(FOLLOW_WORKSPACE)).toBeDefined()
  })

  it('draws a mark on the selected option and nothing on the other 23', () => {
    renderPicker({ value: 'pl' })
    expect(slot('pl').querySelector('svg')).not.toBeNull()
    for (const tag of ['en', 'ar', 'ja', 'zh-Hant'] as const) {
      expect(slot(tag).innerHTML).toBe('')
    }
  })

  it('swaps the mark for a spinner on the option being written', () => {
    renderPicker({ value: 'en', pending: 'ja' })
    expect(slot('ja').querySelector('svg')).not.toBeNull()
    expect(slot('ja').textContent).toBe('')
    expect(slot('en').querySelector('svg')).not.toBeNull()
  })

  it('hides the mark from assistive tech — aria-checked already says it', () => {
    renderPicker({ value: 'pl' })
    expect(slot('pl').getAttribute('aria-hidden')).toBe('true')
  })
})

describe('LanguagePicker — one control, not 23 buttons', () => {
  it('takes its accessible name from the section label', () => {
    renderPicker()
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeDefined()
  })

  it('is a single tab stop, owned by the checked option', async () => {
    const user = userEvent.setup()
    renderPicker({ value: 'de' })

    expect(chip('de').getAttribute('tabindex')).toBe('0')
    expect(chip('en').getAttribute('tabindex')).toBe('-1')
    expect(chip(FOLLOW_WORKSPACE).getAttribute('tabindex')).toBe('-1')

    await user.tab()
    expect(document.activeElement).toBe(chip('de'))
    await user.tab()
    expect(document.activeElement).not.toBe(chip('es'))
  })

  it('exposes the active option through aria-checked and nothing else', () => {
    renderPicker({ value: 'pl' })
    expect(chip('pl').getAttribute('aria-checked')).toBe('true')
    expect(chip('en').getAttribute('aria-checked')).toBe('false')
    expect(chip('pl').getAttribute('aria-pressed')).toBeNull()
    expect(chip('pl').getAttribute('aria-selected')).toBeNull()
  })
})

describe('LanguagePicker — keyboard traversal never writes', () => {
  it('moves focus with the arrow keys without committing anything', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker({ value: FOLLOW_WORKSPACE })

    chip(FOLLOW_WORKSPACE).focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(chip('ar'))
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(document.activeElement).toBe(chip('cs'))
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(chip('ca'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('wraps at both ends and jumps with Home and End', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker()

    chip(FOLLOW_WORKSPACE).focus()
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(chip('zh-Hant'))
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(chip(FOLLOW_WORKSPACE))

    await user.keyboard('{End}')
    expect(document.activeElement).toBe(chip('zh-Hant'))
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(chip(FOLLOW_WORKSPACE))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('steps a row with ArrowDown and ArrowUp', async () => {
    // jsdom reports `offsetTop: 0` for every chip, so the picker reads the grid
    // as a single row and a vertical press moves one chip — the same answer a
    // container wide enough for all twenty-three would give. The multi-row case
    // is measured in the browser, where the grid resolves to five columns.
    const user = userEvent.setup()
    const { onSelect } = renderPicker()

    chip('ca').focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(chip('cs'))
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(document.activeElement).toBe(chip('ar'))
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(chip(FOLLOW_WORKSPACE))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('moves the roving tab stop with the focus', async () => {
    const user = userEvent.setup()
    renderPicker({ value: 'en' })

    chip('en').focus()
    await user.keyboard('{ArrowRight}')
    expect(chip('es').getAttribute('tabindex')).toBe('0')
    expect(chip('en').getAttribute('tabindex')).toBe('-1')
  })
})

describe('LanguagePicker — commit', () => {
  it('commits the focused option on Enter', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker({ value: 'en' })

    chip('en').focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(document.activeElement).toBe(chip('fr'))

    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('fr')
  })

  it('commits the focused option on Space', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker({ value: 'en' })

    chip('en').focus()
    await user.keyboard('{ArrowLeft}')
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledWith('el')
  })

  it('commits on click, including the follow-the-workspace option', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker({ value: 'pl' })

    await user.click(chip(FOLLOW_WORKSPACE))
    expect(onSelect).toHaveBeenCalledWith(FOLLOW_WORKSPACE)
  })

  it('does not re-write the option that is already selected', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker({ value: 'pl' })

    await user.click(chip('pl'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('LanguagePicker — the busy lock', () => {
  it('refuses every commit while a write is in flight', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker({ value: 'en', pending: 'ja' })

    await user.click(chip('de'))
    await user.click(chip('ja'))
    chip('en').focus()
    await user.keyboard('{ArrowRight}{Enter}')

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('marks only the chip being written as busy', () => {
    renderPicker({ value: 'en', pending: 'ja' })
    expect(chip('ja').getAttribute('aria-busy')).toBe('true')
    expect(chip('de').getAttribute('aria-busy')).toBeNull()
    expect(chip('de').getAttribute('aria-disabled')).toBe('true')
  })

  it('turns a double click into exactly one write', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    function Harness() {
      const [value, setValue] = React.useState<LocaleChoice>('en')
      const [pending, setPending] = React.useState<LocaleChoice | null>(null)
      return (
        <LanguagePicker
          value={value}
          workspaceDefault="pl"
          pending={pending}
          onSelect={(choice) => {
            onSelect(choice)
            // What a host route does: latch the write, then settle it.
            setPending(choice)
            setValue(choice)
          }}
          {...COPY}
        />
      )
    }

    render(<Harness />)
    await user.dblClick(chip('sv'))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('sv')
    expect(chip('sv').getAttribute('aria-checked')).toBe('true')
  })
})

describe('LanguagePicker — the loading shape', () => {
  it('holds the grid open without announcing a thing', () => {
    const { container } = render(<LanguagePickerSkeleton />)
    const root = container.firstElementChild
    expect(root?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })
})

describe('LanguagePicker — disabled', () => {
  it('disables every option and commits nothing', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker({ disabled: true })

    for (const option of screen.getAllByRole('radio')) {
      expect((option as HTMLButtonElement).disabled).toBe(true)
    }
    await user.click(chip('de'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
