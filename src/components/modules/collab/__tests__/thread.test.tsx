import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import En from '#/lib/i18n/messages/en/modules'
import Pl from '#/lib/i18n/messages/pl/modules'
import { Thread } from '../thread'

import type { Catalogue } from '#/lib/i18n'

vi.mock('#/server/fns/collab', () => ({
  deleteMessageFn: vi.fn(),
  editMessageFn: vi.fn(),
  postMessageFn: vi.fn(),
  toggleReactionFn: vi.fn(),
}))

afterEach(cleanup)

function mount(locale: 'en' | 'pl', messages: Catalogue): void {
  render(
    <I18nProvider locale={locale} messages={messages}>
      <Thread
        tripId="trip-1"
        messages={[]}
        people={[]}
        viewerUserId="user-1"
        canModerate={false}
        timeZone="UTC"
      />
    </I18nProvider>,
  )
}

describe('the new-message composer', () => {
  it('reads its placeholder from the catalogue in English', () => {
    mount('en', namespaceCatalogue('modules', En))
    const field = screen.getByRole('textbox', { name: 'Message the trip' })
    expect(field.getAttribute('placeholder')).toBe(
      'Say something to the group…',
    )
  })

  it('reads its placeholder from the catalogue in another locale', () => {
    mount('pl', namespaceCatalogue('modules', Pl))
    const field = screen.getByRole('textbox', {
      name: Pl['collab.compose.placeholder'],
    })
    expect(field.getAttribute('placeholder')).toBe(
      Pl['collab.compose.placeholderText'],
    )
    expect(field.getAttribute('placeholder')).not.toBe(
      'Say something to the group…',
    )
  })
})
