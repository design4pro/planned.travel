// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render as mount, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { PlaceDialog, emptyDraft } from '../plan-actions'

/**
 * "Paste a position" on the place form (stage `02-S5`).
 *
 * The parser's notations are pinned in `src/lib/geo`; what is worth proving here is
 * the behaviour around it: a paste that reads fills both fields and says what it
 * read, a paste that does not is left to the browser, and the hint is associated
 * with both inputs so it is announced rather than merely visible.
 */

const MESSAGES = await loadCatalogue('en')

function render() {
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
        error={null}
        onSubmit={() => {}}
      />
    </I18nProvider>,
  )
}

function field(part: 'place-lat' | 'place-lng'): HTMLInputElement {
  const input = document.querySelector(`[data-part="${part}"]`)
  if (!(input instanceof HTMLInputElement)) throw new Error(`no ${part}`)
  return input
}

/** Pastes `text` and reports whether the handler took the paste over. */
function paste(input: HTMLInputElement, text: string): boolean {
  return !fireEvent.paste(input, {
    clipboardData: {
      getData: (type: string) => (type === 'text/plain' ? text : ''),
    },
  })
}

describe('PlaceDialog — paste a position', () => {
  it('fills both fields from a geo: URI pasted into latitude and moves focus on', () => {
    render()

    expect(paste(field('place-lat'), 'geo:34.9671,135.7727')).toBe(true)

    expect(field('place-lat').value).toBe('34.9671')
    expect(field('place-lng').value).toBe('135.7727')
    expect(
      screen.getByText('Read as latitude 34.9671, longitude 135.7727'),
    ).toBeDefined()
    expect(document.activeElement).toBe(field('place-lng'))
  })

  it('fills both fields from a paste into longitude too', () => {
    render()

    paste(field('place-lng'), `33°51'24.48"S 151°12'55.08"W`)

    expect(field('place-lat').value).toBe('-33.8568')
    expect(field('place-lng').value).toBe('-151.2153')
  })

  it('leaves a paste that does not parse to the browser', () => {
    render()

    expect(paste(field('place-lat'), '34.9671')).toBe(false)
    expect(paste(field('place-lat'), '151.2153, -33.8568')).toBe(false)

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('clears the hint once a field is edited by hand', async () => {
    render()
    paste(field('place-lat'), 'geo:34.9671,135.7727')

    await userEvent.type(field('place-lng'), '1')

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('describes both inputs with the hint', () => {
    render()
    const hintId = screen.getByRole('status').id

    for (const part of ['place-lat', 'place-lng'] as const) {
      expect(
        field(part).getAttribute('aria-describedby')?.split(' '),
      ).toContain(hintId)
    }
  })
})
