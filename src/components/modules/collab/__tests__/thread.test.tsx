import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

import { editMessageFn, postMessageFn } from '#/server/fns/collab-thread'
import { TooltipProvider, toast } from '#/components/ui'
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

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: async () => {} }),
}))

beforeEach(() => {
  vi.mocked(postMessageFn).mockReset().mockResolvedValue({ messageId: 'm9' })
  vi.mocked(editMessageFn).mockReset().mockResolvedValue({ messageId: 'm1' })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function composerTree(
  messages: ReadonlyArray<MessageData> = [],
  onDirtyChange = vi.fn(),
) {
  return (
    <I18nProvider locale="en" messages={namespaceCatalogue('modules', En)}>
      <TooltipProvider>
        <Thread
          tripId="trip-1"
          messages={messages}
          people={PEOPLE}
          viewerUserId="user-1"
          canModerate={false}
          timeZone="UTC"
          onDirtyChange={onDirtyChange}
        />
      </TooltipProvider>
    </I18nProvider>
  )
}

async function chooseContext(mode: 'reply' | 'edit') {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', {
      name: En['collab.message.actionsFor'].replace('{name}', 'Ada Viewer'),
    }),
  )
  await user.click(
    screen.getByRole('menuitem', {
      name: mode === 'reply' ? 'Reply' : En['collab.message.menuEdit'],
    }),
  )
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

describe('safe composer sends', () => {
  it.each([{ isComposing: true }, { keyCode: 229 }])(
    'ignores composing Enter: %o',
    (composition) => {
      render(composerTree())
      const field = screen.getByRole('textbox')
      fireEvent.change(field, { target: { value: '東京' } })
      fireEvent.keyDown(field, { key: 'Enter', ...composition })
      expect(postMessageFn).not.toHaveBeenCalled()
    },
  )

  it.each(['reply', 'edit'] as const)(
    'ignores composing Escape in %s mode',
    async (mode) => {
      render(
        composerTree([
          message('m1', 'user-1', '2026-06-23T09:00:00Z', 'Original'),
        ]),
      )
      const field = await chooseContext(mode)
      fireEvent.change(field, { target: { value: '東京' } })
      for (const composition of [{ isComposing: true }, { keyCode: 229 }]) {
        fireEvent.keyDown(field, { key: 'Escape', ...composition })
        expect(field.value).toBe('東京')
        expect(
          screen.getByRole('button', {
            name:
              mode === 'reply'
                ? En['collab.compose.cancelReply']
                : En['collab.compose.cancelEdit'],
          }),
        ).toBeTruthy()
      }
      fireEvent.keyDown(field, { key: 'Escape' })
      expect(field.value).toBe('')
    },
  )

  it('sends once on fine Enter, leaves Shift+Enter alone and preserves typing during flight', async () => {
    const request = deferred<{ messageId: string }>()
    vi.mocked(postMessageFn).mockReturnValue(request.promise)
    render(composerTree())
    const field = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(field, { target: { value: '  Dinner?  ' } })
    expect(fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })).toBe(
      true,
    )
    expect(postMessageFn).not.toHaveBeenCalled()
    act(() => {
      fireEvent.keyDown(field, { key: 'Enter' })
      fireEvent.keyDown(field, { key: 'Enter' })
    })
    expect(postMessageFn).toHaveBeenCalledTimes(1)
    fireEvent.change(field, { target: { value: 'And breakfast?' } })
    await act(async () => request.resolve({ messageId: 'm9' }))
    expect(field.value).toBe('And breakfast?')
  })

  it('uses the send button on a coarse pointer', async () => {
    const original = window.matchMedia
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...original(query),
      matches: query === '(pointer: coarse)',
    }))
    render(composerTree())
    const field = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(field, { target: { value: 'Dinner?' } })
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(true)
    expect(postMessageFn).not.toHaveBeenCalled()
    const description = document.getElementById(
      field.getAttribute('aria-describedby') ?? '',
    )
    expect(description?.textContent).toBe('Use the send button to send.')
    fireEvent.click(
      screen.getByRole('button', { name: En['collab.compose.send'] }),
    )
    await waitFor(() => expect(field.value).toBe(''))
    expect(postMessageFn).toHaveBeenCalledTimes(1)
  })

  it('reserves a silent hint row and describes keys even without focus', async () => {
    render(
      composerTree([
        message('m1', 'user-1', '2026-06-23T09:00:00Z', 'Original'),
      ]),
    )
    const field = screen.getByRole('textbox')
    const id = field.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(id)?.textContent).toBe(
      'Press Enter to send, Shift and Enter for a new line.',
    )
    const hint = screen
      .getByText(En['collab.hint.sends'], { exact: false })
      .closest('p')
    expect(hint?.getAttribute('aria-hidden')).toBe('true')
    expect(hint?.className).toContain('invisible')
    fireEvent.focus(field)
    expect(hint?.className).not.toContain('invisible')
    fireEvent.blur(field)
    expect(hint?.className).toContain('invisible')
    await chooseContext('reply')
    expect(document.getElementById(id)?.textContent).toContain(
      'Press Escape to cancel.',
    )
  })

  it('keeps a silent catalogue failure, retries current text once, then restores focus', async () => {
    const errorToast = vi.spyOn(toast, 'error')
    vi.mocked(postMessageFn).mockRejectedValueOnce(
      new Error('untranslated diagnostic'),
    )
    const dirty = vi.fn()
    render(composerTree([], dirty))
    const field = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(field, { target: { value: 'Dinner?' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(field.value).toBe('Dinner?')
    expect(errorToast).toHaveBeenCalledTimes(1)
    const alert = document.getElementById(
      field.getAttribute('aria-describedby')?.split(' ')[1] ?? '',
    )
    expect(alert?.textContent).toContain(En['collab.toast.notSentBody'])
    expect(alert?.textContent).not.toContain('untranslated diagnostic')
    expect(alert?.hasAttribute('role')).toBe(false)
    expect(alert?.hasAttribute('aria-live')).toBe(false)
    const request = deferred<{ messageId: string }>()
    vi.mocked(postMessageFn).mockReturnValue(request.promise)
    fireEvent.change(field, { target: { value: 'Lunch instead?' } })
    fireEvent.click(retry)
    fireEvent.click(retry)
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(postMessageFn).toHaveBeenCalledTimes(2)
    expect(postMessageFn).toHaveBeenLastCalledWith({
      data: { tripId: 'trip-1', body: 'Lunch instead?', replyToId: '' },
    })
    expect(retry.getAttribute('aria-busy')).toBe('true')
    expect(retry.hasAttribute('disabled')).toBe(false)
    await act(async () => request.resolve({ messageId: 'm9' }))
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(field.value).toBe('')
    expect(document.activeElement).toBe(field)
    expect(dirty).toHaveBeenLastCalledWith(false)
  })

  it.each([false, true])(
    'reconciles only a newer own matching post, preserving a changed draft: %s',
    async (changed) => {
      vi.mocked(postMessageFn).mockRejectedValueOnce(new Error('offline'))
      const old = message('m2', 'user-1', '2026-06-23T09:00:00Z', 'Dinner?')
      const view = render(composerTree([old]))
      const field = screen.getByRole('textbox') as HTMLTextAreaElement
      fireEvent.change(field, { target: { value: '  Dinner?  ' } })
      fireEvent.keyDown(field, { key: 'Enter' })
      await screen.findByRole('button', { name: 'Try again' })
      if (changed) fireEvent.change(field, { target: { value: 'Breakfast?' } })
      view.rerender(
        composerTree([old, message('m3', 'user-2', old.createdAt, 'Dinner?')]),
      )
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
      view.rerender(
        composerTree([old, message('m4', 'user-1', old.createdAt, 'Dinner?')]),
      )
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull(),
      )
      expect(field.value).toBe(changed ? 'Breakfast?' : '')
      expect(postMessageFn).toHaveBeenCalledTimes(1)
    },
  )

  it('clears failure when emptied and reports empty edits as dirty', async () => {
    vi.mocked(postMessageFn).mockRejectedValueOnce(new Error('offline'))
    const dirty = vi.fn()
    render(
      composerTree(
        [message('m1', 'user-1', '2026-06-23T09:00:00Z', 'Original')],
        dirty,
      ),
    )
    const field = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(field, { target: { value: 'Draft' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    await screen.findByRole('button', { name: 'Try again' })
    expect(dirty).toHaveBeenLastCalledWith(true)
    fireEvent.change(field, { target: { value: '' } })
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(dirty).toHaveBeenLastCalledWith(false)
    await chooseContext('edit')
    fireEvent.change(field, { target: { value: '' } })
    expect(dirty).toHaveBeenLastCalledWith(true)
  })

  it('keeps failed edits with catalogue copy and preserves new typing on retry success', async () => {
    const errorToast = vi.spyOn(toast, 'error')
    vi.mocked(editMessageFn).mockRejectedValueOnce(new Error(''))
    render(
      composerTree([
        message('m1', 'user-1', '2026-06-23T09:00:00Z', 'Original'),
      ]),
    )
    const field = await chooseContext('edit')
    fireEvent.change(field, { target: { value: 'Updated' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(errorToast).toHaveBeenCalledWith(En['collab.toast.editFailed'], {
      description:
        'Your changes are still in the box. Check your connection, then try again.',
    })
    expect(
      screen.getByText(
        'Your changes are still in the box. Check your connection, then try again.',
      ),
    ).toBeTruthy()
    const request = deferred<{ messageId: 'm1' }>()
    vi.mocked(editMessageFn).mockReturnValue(request.promise)
    fireEvent.click(retry)
    fireEvent.change(field, { target: { value: 'Another thought' } })
    await act(async () => request.resolve({ messageId: 'm1' }))
    expect(field.value).toBe('Another thought')
    expect(document.activeElement).toBe(field)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('invites the first message without moving focus', () => {
    render(composerTree())
    expect(screen.getByText('Say the first thing')).toBeTruthy()
    expect(document.activeElement).not.toBe(screen.getByRole('textbox'))
  })
})
