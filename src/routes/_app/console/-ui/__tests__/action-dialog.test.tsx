// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Console from '#/lib/i18n/messages/pl/console'
import Ui from '#/lib/i18n/messages/pl/ui'
import { ConsoleActionDialog } from '../action-dialog'

import type { Catalogue } from '#/lib/i18n'

/**
 * A non-English catalogue, because the defect is only audible in one: in `en` the page language
 * and the server's sentence agree, so a missing `lang` is invisible there. The shipped Polish
 * catalogue rather than a stub, so the fallback below is a sentence a reader would recognise.
 */
const PL: Catalogue = {
  ...namespaceCatalogue('console', Console),
  ...namespaceCatalogue('ui', Ui),
}

const FALLBACK = 'Nie udało się wykonać działania. Spróbuj za chwilę.'

afterEach(cleanup)

/** Opens the dialog, presses confirm with an action that rejects with `cause`, returns the sentence's span. */
async function refuseWith(cause: unknown): Promise<HTMLElement> {
  render(
    <I18nProvider locale="pl" messages={PL}>
      <ConsoleActionDialog
        open
        onOpenChange={() => {}}
        title="Zakończ sesje"
        description="Opis"
        confirmLabel="Zakończ"
        onConfirm={() => Promise.reject(cause)}
      />
    </I18nProvider>,
  )
  await userEvent
    .setup({ delay: null })
    .click(screen.getByRole('button', { name: 'Zakończ' }))
  return await screen.findByRole('alert')
}

function sentence(alert: HTMLElement, text: string): HTMLElement {
  const span = Array.from(alert.querySelectorAll('span')).find(
    (candidate) => candidate.textContent === text,
  )
  if (span === undefined) {
    throw new Error(`No span in the alert reads "${text}"`)
  }
  return span
}

describe('ConsoleActionDialog failure', () => {
  it('marks an authored refusal as English, inside the alert', async () => {
    const text = 'That account is banned. Lift the ban before impersonating it.'
    const alert = await refuseWith(
      new Error(encodePublicFailure({ kind: 'refusal', message: text })),
    )

    const span = sentence(alert, text)
    expect(span.matches('[lang="en"][dir="ltr"]')).toBe(true)
    // The alert itself carries neither, so it is still announced in the page language.
    expect(alert.tagName).toBe('P')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.hasAttribute('lang')).toBe(false)
    expect(alert.hasAttribute('dir')).toBe(false)
  })

  it('marks an authored validation message the same way', async () => {
    const text = 'Use at least 10 characters.'
    const alert = await refuseWith(
      new Error(encodePublicFailure({ kind: 'validation', message: text })),
    )

    expect(sentence(alert, text).matches('[lang="en"][dir="ltr"]')).toBe(true)
  })

  it('leaves the translated fallback for an unexpected envelope unmarked', async () => {
    const alert = await refuseWith(
      new Error(encodePublicFailure({ kind: 'unexpected', reference: 'r-1' })),
    )

    const span = sentence(alert, FALLBACK)
    expect(span.hasAttribute('lang')).toBe(false)
    expect(span.hasAttribute('dir')).toBe(false)
  })

  it('leaves a raw client-thrown message unmarked', async () => {
    const alert = await refuseWith(new Error('Network request failed'))

    const span = sentence(alert, 'Network request failed')
    expect(span.hasAttribute('lang')).toBe(false)
    expect(span.hasAttribute('dir')).toBe(false)
  })
})
