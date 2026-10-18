import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Modules from '#/lib/i18n/messages/en/modules'
import type { CollabScreenData } from '../collab-screen'
import { CollabScreen } from '../collab-screen'
import { toast } from '#/components/ui'

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: async () => {} }),
}))
vi.mock('#/server/fns/collab-thread', () => ({
  deleteMessageFn: vi.fn(),
  editMessageFn: vi.fn(async () => ({})),
  postMessageFn: vi.fn(async () => ({})),
  toggleReactionFn: vi.fn(),
}))
vi.mock('#/server/fns/collab-notes', () => ({
  createNoteFn: vi.fn(async () => ({})),
  updateNoteFn: vi.fn(async () => ({})),
  deleteNoteFn: vi.fn(),
}))
vi.mock('#/server/fns/collab-polls', () => ({
  createPollFn: vi.fn(async () => ({})),
  castVoteFn: vi.fn(),
  closePollFn: vi.fn(),
  deletePollFn: vi.fn(),
}))
afterEach(cleanup)
const messages = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('modules', Modules),
}
const data: CollabScreenData = {
  sections: { conversation: true, notes: true, polls: true },
  messages: [],
  notes: [],
  polls: [],
  people: [],
  viewerUserId: 'u',
  timeZone: 'UTC',
}
function setup(initial = data) {
  const props = {
    data: initial,
    tripId: 'trip',
    canModerate: false,
    ownWrite: { current: false },
  }
  const tree = (next = initial) => (
    <I18nProvider locale="en" messages={messages}>
      <CollabScreen {...props} data={next} />
    </I18nProvider>
  )
  const view = render(tree())
  return {
    ownWrite: props.ownWrite,
    update: (next: CollabScreenData) => view.rerender(tree(next)),
    user: userEvent.setup(),
    peer: (section: 'conversation' | 'notes' | 'polls') =>
      view.rerender(
        tree({
          ...initial,
          sections: { ...initial.sections, [section]: false },
        }),
      ),
    ...view,
  }
}
/** The screen's own status region, not the one the conversation owns. */
function screenStatus(): HTMLElement {
  const own = screen
    .getAllByRole('status')
    .filter((region) => region.getAttribute('data-part') !== 'thread-status')
  expect(own).toHaveLength(1)
  return own[0]!
}
it('keeps a composer and its live messages until cleared, then repairs focus silently', async () => {
  const { user, peer, update } = setup()
  expect(screenStatus().textContent).toBe('')
  const composer = screen.getByRole('textbox', { name: 'Message the trip' })
  await user.type(composer, 'Unsent plan')
  peer('conversation')
  update({
    ...data,
    sections: { ...data.sections, conversation: false },
    messages: [
      {
        id: 'live',
        userId: 'peer',
        body: 'A new live message',
        createdAt: '2026-10-16T09:00:00Z',
        editedAt: null,
        replyToId: null,
        reactions: [],
      },
    ],
  })
  expect(screen.getByText('A new live message')).toBeTruthy()
  expect((composer as HTMLTextAreaElement).value).toBe('Unsent plan')
  expect(document.activeElement).toBe(composer)
  await waitFor(() =>
    expect(screenStatus().textContent).toContain('This section was turned off'),
  )
  await user.clear(composer)
  await waitFor(() =>
    expect(
      screen.queryByRole('textbox', { name: 'Message the trip' }),
    ).toBeNull(),
  )
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('tabpanel', { name: 'Notes' }),
    ),
  )
  expect(screenStatus().textContent).toBe('')
})
it('shows the saved-hidden toast when sending a retained composer', async () => {
  const success = vi.spyOn(toast, 'success').mockImplementation(() => '')
  const { user, peer } = setup()
  await user.type(
    screen.getByRole('textbox', { name: 'Message the trip' }),
    'Keep this',
  )
  peer('conversation')
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() =>
    expect(success).toHaveBeenCalledWith(Trips['collab.sections.savedHidden']),
  )
})
it.each(['notes', 'polls'] as const)(
  'keeps an open %s dialog and repairs focus after Escape',
  async (section) => {
    const { user, peer } = setup()
    const label =
      section === 'notes'
        ? Modules['collab.note.new']
        : Modules['collab.poll.dialog.addTitle']
    await user.click(screen.getAllByRole('button', { name: label })[0])
    const dialog = screen.getByRole('dialog')
    const field = dialog.querySelector('input') as HTMLInputElement
    await user.type(field, 'Unsent decision')
    peer(section)
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(field.value).toBe('Unsent decision')
    expect(dialog.textContent).toContain(Trips['collab.sections.turnedOff'])
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('tabpanel', { name: 'Conversation' }),
      ),
    )
  },
)

it('keeps an edited message with its content until discard and then repairs focus', async () => {
  const initial = {
    ...data,
    messages: [
      {
        id: 'm',
        userId: 'u',
        body: 'Original plan',
        createdAt: '2026-10-16T09:00:00Z',
        editedAt: null,
        replyToId: null,
        reactions: [],
      },
    ],
  }
  const { user, peer } = setup(initial)
  await user.click(
    screen.getByRole('button', { name: /Actions for the message from/ }),
  )
  await user.click(
    screen.getByRole('menuitem', { name: Modules['collab.message.menuEdit'] }),
  )
  const field = screen.getByRole('textbox', {
    name: Modules['collab.compose.editPlaceholder'],
  })
  await user.type(field, ' revised')
  peer('conversation')
  expect((field as HTMLTextAreaElement).value).toBe('Original plan revised')
  expect(screen.getByText('Original plan', { selector: 'div' })).toBeTruthy()
  expect(document.activeElement).toBe(field)
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('tabpanel', { name: 'Notes' }),
    ),
  )
})
it('announces each peer record change again, but keeps own writes silent', async () => {
  const { update, ownWrite } = setup()
  const changed = {
    ...data,
    sections: { conversation: true, notes: false, polls: true },
  }
  update(changed)
  await waitFor(() =>
    expect(screenStatus().textContent).toBe(Trips['collab.sections.changed']),
  )
  update(data)
  expect(screenStatus().textContent).toBe('')
  await waitFor(() =>
    expect(screenStatus().textContent).toBe(Trips['collab.sections.changed']),
  )
  ownWrite.current = true
  update(changed)
  await new Promise((resolve) => setTimeout(resolve, 80))
  expect(screenStatus().textContent).toBe('')
})
it.each(['notes', 'polls'] as const)(
  'saves an open %s dialog with the hidden-section toast',
  async (section) => {
    const success = vi.spyOn(toast, 'success').mockImplementation(() => '')
    const { user, peer } = setup()
    const label =
      section === 'notes'
        ? Modules['collab.note.new']
        : Modules['collab.poll.dialog.addTitle']
    await user.click(screen.getAllByRole('button', { name: label })[0])
    const dialog = screen.getByRole('dialog')
    const fields = dialog.querySelectorAll('input')
    await user.type(fields[0], 'Shared decision')
    if (section === 'polls') {
      await user.type(fields[1], 'Option A')
      await user.type(fields[2], 'Option B')
    }
    peer(section)
    const submit = dialog.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement
    await user.click(submit)
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        Trips['collab.sections.savedHidden'],
        { description: '' },
      ),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('tabpanel', { name: 'Conversation' }),
      ),
    )
  },
)

it('saves an edited message from a retained section and repairs focus', async () => {
  const success = vi.spyOn(toast, 'success').mockImplementation(() => '')
  const initial = {
    ...data,
    messages: [
      {
        id: 'm',
        userId: 'u',
        body: 'Original plan',
        createdAt: '2026-10-16T09:00:00Z',
        editedAt: null,
        replyToId: null,
        reactions: [],
      },
    ],
  }
  const { user, peer } = setup(initial)
  await user.click(
    screen.getByRole('button', { name: /Actions for the message from/ }),
  )
  await user.click(
    screen.getByRole('menuitem', { name: Modules['collab.message.menuEdit'] }),
  )
  const field = screen.getByRole('textbox', {
    name: Modules['collab.compose.editPlaceholder'],
  })
  await user.type(field, ' revised')
  peer('conversation')
  await user.click(
    screen.getByRole('button', { name: Modules['collab.compose.save'] }),
  )
  await waitFor(() =>
    expect(success).toHaveBeenCalledWith(Trips['collab.sections.savedHidden'], {
      description: undefined,
    }),
  )
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('tabpanel', { name: 'Notes' }),
    ),
  )
})

it('retains text when typing and a peer record arrive in the same batch', () => {
  const { peer } = setup()
  const field = screen.getByRole('textbox', { name: 'Message the trip' })
  field.focus()
  act(() => {
    fireEvent.change(field, { target: { value: 'Last-moment draft' } })
    peer('conversation')
  })
  expect(field.isConnected).toBe(true)
  expect((field as HTMLTextAreaElement).value).toBe('Last-moment draft')
  expect(document.activeElement).toBe(field)
})

it('announces a peer change when an unrelated draft begins before delivery', async () => {
  const { peer } = setup()
  const field = screen.getByRole('textbox', { name: 'Message the trip' })
  peer('notes')
  fireEvent.change(field, { target: { value: 'Starting a draft' } })
  await waitFor(() =>
    expect(screenStatus().textContent).toBe(Trips['collab.sections.changed']),
  )
})

it('stays silent when a retained draft is discarded before the announcement', async () => {
  const { peer } = setup()
  const field = screen.getByRole('textbox', { name: 'Message the trip' })
  fireEvent.change(field, { target: { value: 'Unsent draft' } })
  peer('conversation')
  fireEvent.change(field, { target: { value: '' } })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
  })
  expect(screenStatus().textContent).toBe('')
})

it('repairs focus to the active tab when the tab is rendered by the DOM', async () => {
  const { user, peer } = setup()
  const tab = screen.getByRole('tab', { name: 'Notes' })
  const rects = vi
    .spyOn(tab, 'getClientRects')
    .mockReturnValue([{ width: 100, height: 44 }] as unknown as DOMRectList)
  const composer = screen.getByRole('textbox', { name: 'Message the trip' })
  await user.click(composer)
  peer('conversation')
  await waitFor(() => expect(document.activeElement).toBe(tab))
  rects.mockRestore()
})

it('keeps loaded panel spacing aligned with the pending grid through the tab slot', () => {
  setup()
  for (const panel of screen.getAllByRole('tabpanel', { hidden: true })) {
    expect(panel.classList.contains('mt-0')).toBe(true)
    expect(panel.classList.contains('mt-5')).toBe(false)
  }
})

it('preserves the app section spacing around a hidden-section notice', () => {
  const { container } = setup({
    ...data,
    sections: { conversation: false, notes: true, polls: true },
  })
  const root = container.querySelector('[data-slot="collab-root"]')
  expect(root?.classList.contains('flex')).toBe(true)
  expect(root?.classList.contains('flex-col')).toBe(true)
  expect(root?.classList.contains('gap-6')).toBe(true)
  expect(root?.classList.contains('lg:gap-8')).toBe(true)
})
