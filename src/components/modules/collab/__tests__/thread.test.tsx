import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

import { TooltipProvider } from '#/components/ui'
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
      <TooltipProvider>
        <Thread
          tripId="trip-1"
          messages={thread}
          people={PEOPLE}
          viewerUserId="user-1"
          canModerate={false}
          timeZone="UTC"
        />
      </TooltipProvider>
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

  it("renders the viewer's own emoji without the brand bubble", () => {
    mount('en', namespaceCatalogue('modules', En), [
      message('m1', 'user-1', '2026-06-23T09:00:00Z', '👍'),
    ])
    const jumbo = screen.getByText('👍', { selector: 'div' })
    expect(jumbo.className).toContain('text-title')
    expect(jumbo.className).not.toContain('bg-brand')
  })

  it('writes the day heading in the active locale', () => {
    mount('pl', namespaceCatalogue('modules', Pl), [
      message('m1', 'user-2', '2026-06-23T09:00:00Z', 'Cześć'),
    ])
    const expected = formatWeekday('2026-06-23', 'pl')
    expect(expected).not.toBeNull()
    expect(screen.getByText(expected ?? '')).toBeTruthy()
    const english = formatWeekday('2026-06-23', 'en') ?? ''
    expect(expected).not.toBe(english)
    expect(screen.queryByText(english)).toBeNull()
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

describe('translated conversation controls', () => {
  it('reads the English empty description from the catalogue', () => {
    mount('en', namespaceCatalogue('modules', En))
    expect(screen.getByText(En['collab.thread.emptyBody'])).toBeTruthy()
  })
  it('reads the empty description from the active catalogue', () => {
    mount('pl', namespaceCatalogue('modules', Pl))
    expect(screen.getByText(Pl['collab.thread.emptyBody'])).toBeTruthy()
  })

  it('translates every reaction name and tooltip', async () => {
    const user = userEvent.setup()
    mount('pl', namespaceCatalogue('modules', Pl), [
      message('m1', 'user-1', '2026-06-23T09:00:00Z', 'Hello'),
    ])
    await user.click(
      screen.getByRole('button', { name: Pl['collab.message.react'] }),
    )
    for (const key of [
      'agree',
      'love',
      'funny',
      'celebrate',
      'thanks',
      'looking',
    ] as const) {
      const label = Pl[`collab.reaction.${key}`]
      const button = screen.getByRole('button', { name: label })
      expect(button.getAttribute('aria-label')).not.toContain('modules.collab.')
      act(() => button.focus())
      await waitFor(() =>
        expect(screen.getByRole('tooltip').textContent).toBe(label),
      )
      act(() => button.blur())
    }
  })

  it('keeps actions reachable by touch and keyboard and translates Reply', async () => {
    const user = userEvent.setup()
    mount('pl', namespaceCatalogue('modules', Pl), [
      message('m1', 'user-1', '2026-06-23T09:00:00Z', 'Hello'),
    ])
    const react = screen.getByRole('button', {
      name: Pl['collab.message.react'],
    })
    const actions = react.parentElement
    expect(actions?.classList.contains('group-hover/message:opacity-100')).toBe(
      true,
    )
    expect(actions?.classList.contains('focus-within:opacity-100')).toBe(true)
    expect(actions?.classList.contains('pointer-coarse:opacity-100')).toBe(true)
    expect(react.tabIndex).toBe(0)
    const menu = screen.getByRole('button', {
      name: Pl['collab.message.actionsFor'].replace('{name}', 'Ada Viewer'),
    })
    expect(menu.tabIndex).toBe(0)
    await user.click(menu)
    expect(
      screen.getByRole('menuitem', { name: Pl['collab.message.reply'] }),
    ).toBeTruthy()
    expect(
      screen.getByRole('menuitem', { name: Pl['collab.message.menuEdit'] }),
    ).toBeTruthy()
    expect(
      screen.getByRole('menuitem', { name: Pl['collab.message.delete'] }),
    ).toBeTruthy()
  })
})
