// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { PlaceDialog, emptyDraft } from '../plan-actions'

import type { PlaceDialogProps } from '../plan-actions'

/**
 * The way out of a failed place write sits inside the form's own alert.
 *
 * The form traps focus, and on a phone it opens over a modal sheet, so a toast beside it cannot
 * be reached; the alert is inside the dialog, which is the one place the reader can act.
 */

const MESSAGES = await loadCatalogue('en')

function render(props: Pick<PlaceDialogProps, 'error' | 'errorAction'>) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      <PlaceDialog
        open
        onOpenChange={() => {}}
        mode="create"
        categories={[]}
        days={[]}
        initial={emptyDraft}
        saving={false}
        onSubmit={() => {}}
        {...props}
      />
    </I18nProvider>,
  )
}

describe('PlaceDialog — error action', () => {
  it('offers the action beside the message and runs it on press', async () => {
    const onSelect = vi.fn()
    render({
      error: 'Limit reached.',
      errorAction: { label: 'See plans', onSelect },
    })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Limit reached.')
    await userEvent.click(screen.getByRole('button', { name: 'See plans' }))

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('shows no button for an error without an action', () => {
    render({ error: 'Try again.', errorAction: null })

    expect(screen.getByRole('alert').textContent).toContain('Try again.')
    expect(screen.queryByRole('button', { name: 'See plans' })).toBeNull()
  })
})
