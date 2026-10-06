// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render as mount, screen } from '@testing-library/react'

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
  it('offers a link beside the message that opens in a new tab, keeping the form', () => {
    render({
      error: 'Limit reached.',
      errorAction: { label: 'See plans', href: '/settings/billing' },
    })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Limit reached.')
    const link = screen.getByRole('link', { name: 'See plans' })
    expect(link.getAttribute('href')).toBe('/settings/billing')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('shows no link for an error without an action', () => {
    render({ error: 'Try again.', errorAction: null })

    expect(screen.getByRole('alert').textContent).toContain('Try again.')
    expect(screen.queryByRole('link', { name: 'See plans' })).toBeNull()
  })
})
