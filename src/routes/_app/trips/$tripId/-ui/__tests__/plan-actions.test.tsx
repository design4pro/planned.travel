// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DeleteDialog, DropTimeDialog } from '../plan-actions'

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

function deleteDialog(
  overrides: Partial<React.ComponentProps<typeof DeleteDialog>> = {},
) {
  return (
    <DeleteDialog
      open
      placeName="Senso-ji"
      dayCount={1}
      saving={false}
      error={null}
      onConfirm={() => {}}
      onOpenChange={() => {}}
      {...overrides}
    />
  )
}

describe('DeleteDialog', () => {
  it.each(['keep', 'close', 'escape', 'outside'] as const)(
    'allows %s dismissal only before and after saving',
    async (path) => {
      const onOpenChange = vi.fn()
      const view = render(deleteDialog({ onOpenChange }))
      const dismiss = async () => {
        if (path === 'keep')
          fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
        if (path === 'close') {
          const close = screen.queryByRole('button', { name: 'Close' })
          if (close !== null) await userEvent.click(close)
        }
        if (path === 'escape') await userEvent.keyboard('{Escape}')
        if (path === 'outside') {
          // Radix listens after the opening pointer event has finished.
          await new Promise((resolve) => setTimeout(resolve, 0))
          const overlay = document.querySelector(
            '[data-state="open"][aria-hidden="true"]',
          )
          if (overlay === null) throw new Error('Missing dialog overlay')
          fireEvent.pointerDown(overlay)
          fireEvent.click(overlay)
        }
      }
      await dismiss()
      expect(onOpenChange).toHaveBeenCalledWith(false)
      onOpenChange.mockClear()
      view.rerender(
        <I18nProvider locale="en" messages={MESSAGES}>
          {deleteDialog({ saving: true, onOpenChange })}
        </I18nProvider>,
      )
      await dismiss()
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog')).toBeDefined()
      view.rerender(
        <I18nProvider locale="en" messages={MESSAGES}>
          {deleteDialog({ onOpenChange, error: 'Delete refused' })}
        </I18nProvider>,
      )
      expect(screen.getByRole('alert').textContent).toContain('Delete refused')
      await dismiss()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    },
  )

  it('keeps keyboard focus on Keep it when saving starts and exposes its disabled state', async () => {
    const onOpenChange = vi.fn()
    const view = render(deleteDialog({ onOpenChange }))
    const keep = screen.getByRole('button', { name: 'Keep it' })
    keep.focus()
    view.rerender(
      <I18nProvider locale="en" messages={MESSAGES}>
        {deleteDialog({ saving: true, onOpenChange })}
      </I18nProvider>,
    )
    expect(keep.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(keep)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    await userEvent.keyboard('{Enter} ')
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
