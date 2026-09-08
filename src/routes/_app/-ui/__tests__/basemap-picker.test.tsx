import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '#/lib/i18n'
import settings from '#/lib/i18n/messages/en/settings'
import { BasemapPicker } from '../basemap-picker'

import type { Catalogue } from '#/lib/i18n'

/** The shipped catalogue, namespaced the way the provider expects. */
const EN: Catalogue = Object.fromEntries(
  Object.entries(settings).map(([key, message]) => [
    `settings.${key}`,
    message,
  ]),
)

/**
 * The appearance screen in miniature, and specifically the one thing about it
 * that makes the in-flight state dangerous: `persist()` calls `setBusy(true)`
 * *before* its first `await`, so `busy` is already true in the same commit as
 * the pick that started the save.
 */
function Harness({ onPick }: { onPick: (next: string) => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <BasemapPicker
      value={value}
      busy={busy}
      onValueChange={(next) => {
        onPick(next)
        setValue(next)
        setBusy(true)
      }}
    />
  )
}

function mount(onPick: (next: string) => void = () => {}) {
  render(
    <I18nProvider locale="en" messages={EN}>
      <Harness onPick={onPick} />
    </I18nProvider>,
  )
  return screen.getAllByRole('radio')
}

function group(): HTMLElement {
  return screen.getByRole('radiogroup', { name: 'Map style' })
}

/**
 * Arrow keys move *and* select in a Radix radio group, but the selection rides
 * on the key still being down: the group flags the arrow on `keydown`, roving
 * focus moves in a `setTimeout`, and the newly focused item selects itself only
 * while that flag is set — which `keyup` clears. A real hand holds a key for
 * milliseconds; `user.keyboard('{ArrowRight}')` presses and releases inside one
 * task, so the release wins and the group moves without selecting. Holding is
 * what reproduces the human timing.
 */
async function arrowRight(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard('{ArrowRight>}')
  await user.keyboard('{/ArrowRight}')
}

describe('BasemapPicker while a save is in flight', () => {
  /**
   * The regression this test exists for. A group-level `disabled` reaches every
   * item, each item is a native `<button>`, and the browser blurs a button the
   * moment it is disabled — so the first arrow key disabled the button it had
   * just moved to, focus fell to the document, and the whole group left the tab
   * order with nothing to put it back. One keystroke, and a member navigating by
   * keyboard is stranded.
   */
  it('keeps every option focusable, so the keyboard does not lose the group', async () => {
    const user = userEvent.setup()
    const options = mount()

    options[0]?.focus()
    await arrowRight(user)

    expect(group().getAttribute('aria-busy')).toBe('true')
    for (const option of options) {
      expect(option.hasAttribute('disabled')).toBe(false)
    }
    expect(group().contains(document.activeElement)).toBe(true)

    // …and reachable on purpose, not merely still focused by accident: a
    // disabled button cannot take focus at all.
    const last = options.at(-1)
    last?.focus()
    expect(document.activeElement).toBe(last)
  })

  it('announces itself busy and unavailable instead of silently swallowing input', async () => {
    const user = userEvent.setup()
    const options = mount()

    expect(group().getAttribute('aria-busy')).toBe('false')
    expect(group().hasAttribute('aria-disabled')).toBe(false)

    options[0]?.focus()
    await arrowRight(user)

    expect(group().getAttribute('aria-disabled')).toBe('true')
  })

  /**
   * The guard that replaces the dropped `disabled`. Without it two saves race,
   * and the screen rolls back to the value it captured before the *first* one —
   * so a first write that fails would undo the second pick.
   */
  it('ignores a second pick until the first save lands', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const options = mount(onPick)

    options[0]?.focus()
    await arrowRight(user)
    expect(onPick).toHaveBeenCalledTimes(1)

    await arrowRight(user)
    if (options[3]) await user.click(options[3])
    expect(onPick).toHaveBeenCalledTimes(1)
  })
})
