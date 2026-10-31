import '#/components/ui/__tests__/test-env'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TooltipProvider } from '#/components/ui'
import { THREAD_PAGE_SIZE } from '#/lib/collab'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Modules from '#/lib/i18n/messages/en/modules'
import type { CollabScreenData } from '../collab-screen'
import { CollabScreen } from '../collab-screen'
import * as ThreadWrites from '#/server/fns/collab-thread'
import * as NoteWrites from '#/server/fns/collab-notes'
import * as PollWrites from '#/server/fns/collab-polls'

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: async () => {} }),
}))
vi.mock('#/server/fns/collab-thread', () => ({
  deleteMessageFn: vi.fn(),
  editMessageFn: vi.fn(),
  loadOlderMessagesFn: vi.fn(),
  postMessageFn: vi.fn(),
  toggleReactionFn: vi.fn(),
}))
vi.mock('#/server/fns/collab-notes', () => ({
  createNoteFn: vi.fn(),
  updateNoteFn: vi.fn(),
  deleteNoteFn: vi.fn(),
}))
vi.mock('#/server/fns/collab-polls', () => ({
  createPollFn: vi.fn(),
  castVoteFn: vi.fn(),
  closePollFn: vi.fn(),
  deletePollFn: vi.fn(),
}))
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

const catalogue = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('modules', Modules),
}

const base: CollabScreenData = {
  sections: { conversation: true, notes: true, polls: true },
  messages: [
    {
      id: 'm1',
      userId: 'u',
      body: 'Hello',
      replyToId: null,
      editedAt: null,
      createdAt: '2026-10-16T09:00:00Z',
      reactions: [{ emoji: '👍', count: 1, userIds: ['u'] }],
    },
  ],
  messageCount: 1,
  notes: [
    {
      id: 'n1',
      title: 'A note',
      body: 'Read me',
      category: null,
      colour: null,
      isPinned: false,
      createdBy: 'u',
      createdAt: '2026-10-16T09:00:00Z',
    },
  ],
  polls: [
    {
      id: 'p1',
      question: 'Where?',
      options: [
        { id: 'a', label: 'Here' },
        { id: 'b', label: 'There' },
      ],
      allowMultiple: false,
      isClosed: false,
      createdBy: 'u',
      totalVotes: 0,
      tally: [
        { optionId: 'a', label: 'Here', votes: 0, userIds: [] },
        { optionId: 'b', label: 'There', votes: 0, userIds: [] },
      ],
    },
  ],
  people: [],
  viewerUserId: 'u',
  timeZone: 'UTC',
}

function screenOf(data: CollabScreenData, canModerate = true) {
  return (
    <I18nProvider locale="en" messages={catalogue}>
      <TooltipProvider>
        <CollabScreen
          data={data}
          tripId="trip"
          canModerate={canModerate}
          ownWrite={{ current: false }}
        />
      </TooltipProvider>
    </I18nProvider>
  )
}

describe('collaboration read-only interactions', () => {
  it.each([
    ['viewer', false, false],
    ['organization reader and workspace admin', false, false],
    ['archived owner', false, true],
    ['archived editor', false, true],
    ['old payload', undefined, undefined],
  ] as const)(
    'prevents every write for %s while keeping content readable',
    (_, canWrite, isArchived) => {
      render(screenOf({ ...base, canWrite, isArchived }))
      expect(screen.getByText('Hello')).toBeTruthy()
      expect(screen.getByText('Read me')).toBeTruthy()
      expect(screen.getByText('Where?')).toBeTruthy()
      expect(
        screen.getByText(
          isArchived
            ? 'This trip is archived. Collaboration is read-only.'
            : 'Only trip owners and editors can change the conversation, notes and polls.',
        ),
      ).toBeTruthy()
      const field = screen.getByRole('textbox', { name: 'Message the trip' })
      expect(field.hasAttribute('disabled')).toBe(true)
      fireEvent.change(field, { target: { value: 'Forbidden' } })
      const form = field.closest('form')
      expect(form).not.toBeNull()
      if (form) fireEvent.submit(form)
      for (const button of document.querySelectorAll(
        'button:not([role=tab])',
      )) {
        if (button.getAttribute('role') !== 'tab') {
          expect(button.hasAttribute('disabled')).toBe(true)
          fireEvent.click(button)
        }
      }
      for (const fn of [
        ...Object.values(ThreadWrites),
        ...Object.values(NoteWrites),
        ...Object.values(PollWrites),
      ]) {
        expect(fn).not.toHaveBeenCalled()
      }
    },
  )

  it('keeps writing available for a writable payload', () => {
    render(screenOf({ ...base, canWrite: true, isArchived: false }, false))
    expect(
      screen
        .getByRole('textbox', { name: 'Message the trip' })
        .hasAttribute('disabled'),
    ).toBe(false)
    expect(
      screen.getByRole('button', { name: 'New note' }).hasAttribute('disabled'),
    ).toBe(false)
    expect(
      screen.getByRole('button', { name: 'New poll' }).hasAttribute('disabled'),
    ).toBe(false)
  })
  it.each([false, true])(
    'keeps message ownership separate from workspace moderation (%s)',
    async (canModerate) => {
      const user = userEvent.setup()
      render(
        screenOf(
          {
            ...base,
            canWrite: true,
            messages: base.messages.map((message) => ({
              ...message,
              userId: 'peer',
            })),
            people: [{ userId: 'peer', name: 'Peer', image: null }],
          },
          canModerate,
        ),
      )
      await user.click(
        screen.getByRole('button', {
          name: 'Actions for the message from Peer',
        }),
      )
      expect(
        screen.queryByRole('menuitem', { name: 'Edit message…' }),
      ).toBeNull()
      expect(
        screen.queryByRole('menuitem', { name: 'Delete message' }) !== null,
      ).toBe(canModerate)
      expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeTruthy()
    },
  )

  it('still loads older messages for a read-only viewer', async () => {
    vi.mocked(ThreadWrites.loadOlderMessagesFn).mockResolvedValue({
      messages: [],
      exhausted: true,
    })
    render(
      screenOf({
        ...base,
        canWrite: false,
        messages: Array.from({ length: THREAD_PAGE_SIZE }, (_, index) => ({
          id: `m${index}`,
          userId: 'peer',
          body: 'History',
          replyToId: null,
          editedAt: null,
          createdAt: '2026-10-16T09:00:00Z',
          reactions: [],
        })),
      }),
    )
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Load earlier messages' }))
    expect(ThreadWrites.loadOlderMessagesFn).toHaveBeenCalledWith({
      data: { tripId: 'trip', cursor: 'm0' },
    })
  })

  it('can post and vote when the loader allows writing', async () => {
    vi.mocked(ThreadWrites.postMessageFn).mockResolvedValue({ messageId: 'm2' })
    vi.mocked(PollWrites.castVoteFn).mockResolvedValue({ totalVotes: 1 })
    const user = userEvent.setup()
    render(screenOf({ ...base, canWrite: true }))
    const field = screen.getByRole('textbox', { name: 'Message the trip' })
    await user.type(field, 'Allowed')
    const form = field.closest('form')
    if (form) fireEvent.submit(form)
    expect(ThreadWrites.postMessageFn).toHaveBeenCalledWith({
      data: { tripId: 'trip', body: 'Allowed', replyToId: '' },
    })
    await user.click(screen.getByRole('button', { name: /Here.*0/ }))
    expect(PollWrites.castVoteFn).toHaveBeenCalledWith({
      data: { tripId: 'trip', pollId: 'p1', optionId: 'a' },
    })
  })
})
