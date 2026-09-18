// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DropTimeDialog, writeThenRefresh } from '../plan-actions'

/**
 * The one question the drag policy ever asks a reader.
 *
 * It is asked mid-drag, about a row the reader has just let go of, and the answer
 * either clears a stored time or leaves the day exactly as it was — so the three
 * things worth proving from the DOM are that the question names what it is about,
 * that the safe answer is the one the keyboard lands on and `Escape` gives, and
 * that agreeing fires once rather than once per render.
 */

const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      {ui}
    </I18nProvider>,
  )
}

function dialog(
  overrides: Partial<React.ComponentProps<typeof DropTimeDialog>>,
) {
  return (
    <DropTimeDialog
      open
      name="Senso-ji"
      time="11:00"
      onConfirm={() => {}}
      onDecline={() => {}}
      {...overrides}
    />
  )
}

describe('DropTimeDialog', () => {
  it('names the row it is asking about and the time at stake', () => {
    render(dialog({}))

    expect(screen.getByText('Move Senso-ji and drop its 11:00?')).toBeDefined()
  })

  it('opens with focus on the answer, not on the page behind it', () => {
    render(dialog({}))

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Move and drop the time' }),
    )
  })

  it('treats Escape as keeping the row where it was', async () => {
    const onConfirm = vi.fn()
    const onDecline = vi.fn()
    render(dialog({ onConfirm, onDecline }))

    await userEvent.keyboard('{Escape}')

    expect(onDecline).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('drops the time once when the reader agrees', async () => {
    const onConfirm = vi.fn()
    const onDecline = vi.fn()
    render(dialog({ onConfirm, onDecline }))

    await userEvent.click(
      screen.getByRole('button', { name: 'Move and drop the time' }),
    )

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onDecline).not.toHaveBeenCalled()
  })
})

/**
 * A delete lands and its journey restatement is then refused: the stop is already gone, so the
 * board has to be refreshed even though the write as a whole failed.
 */
describe('writeThenRefresh', () => {
  it('refreshes after a write that failed part-way, and still reports the failure', async () => {
    const calls: Array<string> = []
    const refusal = new Error('The journeys could not be saved.')
    const work = async () => {
      calls.push('delete')
      await Promise.resolve()
      throw refusal
    }
    const refresh = vi.fn(async () => {
      calls.push('refresh')
    })

    await expect(writeThenRefresh(work, refresh)).rejects.toBe(refusal)
    expect(calls).toEqual(['delete', 'refresh'])
  })

  it('refreshes once the write has landed', async () => {
    const calls: Array<string> = []

    await writeThenRefresh(
      async () => {
        calls.push('write')
      },
      async () => {
        calls.push('refresh')
      },
    )
    expect(calls).toEqual(['write', 'refresh'])
  })
})
