import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { formatWeekday } from '#/lib/format'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import En from '#/lib/i18n/messages/en/modules'
import Pl from '#/lib/i18n/messages/pl/modules'
import { Thread } from '../thread'

import type { Catalogue } from '#/lib/i18n'
import type { CollabPerson, MessageData } from '../types'

vi.mock('#/server/fns/collab-thread', () => ({
  deleteMessageFn: vi.fn(),
  editMessageFn: vi.fn(),
  postMessageFn: vi.fn(),
  toggleReactionFn: vi.fn(),
}))

afterEach(cleanup)

const PEOPLE: ReadonlyArray<CollabPerson> = [
  { userId: 'user-1', name: 'Ada Viewer', image: null },
  { userId: 'user-2', name: 'Bruno Peer', image: null },
]

function message(
  id: string,
  userId: string,
  createdAt: string,
  body: string,
): MessageData {
  return {
    id,
    userId,
    body,
    replyToId: null,
    editedAt: null,
    createdAt,
    reactions: [],
  }
}

function mount(
  locale: 'en' | 'pl',
  messages: Catalogue,
  thread: ReadonlyArray<MessageData> = [],
): void {
  render(
    <I18nProvider locale={locale} messages={messages}>
      <Thread
        tripId="trip-1"
        messages={thread}
        people={PEOPLE}
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

describe('the transcript', () => {
  it("shows a run's author once and lets the continuation carry the body alone", () => {
    mount('en', namespaceCatalogue('modules', En), [
      message('m1', 'user-2', '2026-06-23T09:00:00Z', 'Dinner at eight?'),
      message('m2', 'user-2', '2026-06-23T09:02:00Z', 'I booked it'),
      message('m3', 'user-2', '2026-06-23T09:30:00Z', 'Back after a break'),
    ])
    // The third message is past the five-minute window and opens a new run.
    expect(screen.getAllByText('Bruno Peer', { selector: 'p' })).toHaveLength(2)
    expect(screen.getByText('I booked it')).toBeTruthy()
  })

  it('renders one to three emoji large and without a bubble', () => {
    mount('en', namespaceCatalogue('modules', En), [
      message('m1', 'user-2', '2026-06-23T09:00:00Z', '🎉'),
      message('m2', 'user-2', '2026-06-23T09:10:00Z', 'a word 🎉'),
    ])
    const jumbo = screen.getByText('🎉', { selector: 'div' })
    expect(jumbo.className).toContain('text-title')
    expect(jumbo.className).not.toContain('bg-surface-2')
    const bubble = screen.getByText('a word 🎉')
    expect(bubble.className).toContain('bg-surface-2')
    expect(bubble.className).not.toContain('text-title')
  })

  it('writes the day heading in the active locale', () => {
    mount('pl', namespaceCatalogue('modules', Pl), [
      message('m1', 'user-2', '2026-06-23T09:00:00Z', 'Cześć'),
    ])
    const expected = formatWeekday('2026-06-23', 'pl')
    expect(expected).not.toBeNull()
    expect(screen.getByText(expected ?? '')).toBeTruthy()
    expect(screen.queryByText('Tuesday 23 Jun')).toBeNull()
    expect(expected).not.toBe(formatWeekday('2026-06-23', 'en'))
  })

  it('draws one divider per day', () => {
    mount('en', namespaceCatalogue('modules', En), [
      message('m1', 'user-2', '2026-06-23T09:00:00Z', 'one'),
      message('m2', 'user-1', '2026-06-23T10:00:00Z', 'two'),
      message('m3', 'user-2', '2026-06-24T09:00:00Z', 'three'),
    ])
    expect(
      screen.getAllByText(formatWeekday('2026-06-23', 'en') ?? ''),
    ).toHaveLength(1)
    expect(
      screen.getAllByText(formatWeekday('2026-06-24', 'en') ?? ''),
    ).toHaveLength(1)
  })
})
