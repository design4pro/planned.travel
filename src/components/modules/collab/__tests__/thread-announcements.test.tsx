import '#/components/ui/__tests__/test-env'

import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

import { TooltipProvider } from '#/components/ui'
import { THREAD_PAGE_SIZE } from '#/lib/collab'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import En from '#/lib/i18n/messages/en/modules'
import { loadOlderMessagesFn } from '#/server/fns/collab-thread'
import { Thread } from '../thread'

import type { CollabPerson, MessageData } from '../types'

vi.mock('#/server/fns/collab-thread', () => ({
  deleteMessageFn: vi.fn(),
  editMessageFn: vi.fn(),
  loadOlderMessagesFn: vi.fn(),
  postMessageFn: vi.fn(),
  toggleReactionFn: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: async () => {} }),
}))

const PEOPLE: ReadonlyArray<CollabPerson> = [
  { userId: 'user-1', name: 'Ada Viewer', image: null },
  { userId: 'user-2', name: 'Bruno Peer', image: null },
  { userId: 'user-3', name: 'Cleo Peer', image: null },
]

function message(id: string, userId = 'user-2', body = id): MessageData {
  return {
    id,
    userId,
    body,
    replyToId: null,
    editedAt: null,
    createdAt: '2026-06-23T09:00:00Z',
    reactions: [],
  }
}

/** `count` rows with ids `m<start>` upwards, oldest first. */
function rows(start: number, count: number): MessageData[] {
  return Array.from({ length: count }, (_, index) =>
    message(`m${String(start + index).padStart(4, '0')}`),
  )
}

function tree(messages: ReadonlyArray<MessageData>) {
  return (
    <I18nProvider locale="en" messages={namespaceCatalogue('modules', En)}>
      <TooltipProvider>
        <Thread
          canWrite={true}
          tripId="trip-1"
          messages={messages}
          people={PEOPLE}
          viewerUserId="user-1"
          canModerate={false}
          timeZone="UTC"
        />
      </TooltipProvider>
    </I18nProvider>
  )
}

const region = () =>
  document.querySelector<HTMLElement>('[data-part="thread-status"]')!
const control = () =>
  document.querySelector<HTMLButtonElement>('[data-part="thread-load-older"]')!
const scroller = () =>
  document.querySelector<HTMLElement>('[data-part="thread-scroller"]')!
const fullWindow = () => rows(1000, THREAD_PAGE_SIZE)
const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(`li[data-message-id="${id}"]`)!

/** Lets the status region clear and refill, and the live-message group close. */
async function settle(ms = 1100): Promise<void> {
  // Step by step, each in its own act: inside one act React would batch the
  // clear and the write into a single commit, which no browser does.
  for (let elapsed = 0; elapsed < ms; elapsed += 50)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
}

/** What the region held after every change to it, so a clear before a write is visible. */
function recordRegion(): string[] {
  const seen: string[] = []
  new MutationObserver(() => seen.push(region().textContent ?? '')).observe(
    region(),
    { childList: true, characterData: true, subtree: true },
  )
  return seen
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(loadOlderMessagesFn).mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the status region', () => {
  it('is a polite status, visually hidden, mounted and empty on the server', () => {
    const html = renderToString(tree(rows(1000, 3)))
    const host = document.createElement('div')
    host.innerHTML = html
    const server = host.querySelector('[data-part="thread-status"]')!
    expect(server.getAttribute('role')).toBe('status')
    expect(server.className).toContain('sr-only')
    expect(server.textContent).toBe('')
  })

  it('is empty after the first render and puts no live region on the list', async () => {
    render(tree(fullWindow()))
    await settle()
    expect(region().textContent).toBe('')
    expect(scroller().querySelector('[aria-live], [role="log"]')).toBeNull()
    expect(scroller().closest('[aria-live], [role="log"]')).toBeNull()
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)
  })

  it('says how many earlier messages loaded, with the plural form', async () => {
    vi.mocked(loadOlderMessagesFn).mockResolvedValueOnce({
      messages: rows(900, 3),
      exhausted: false,
    })
    render(tree(fullWindow()))
    fireEvent.click(control())
    await settle()
    expect(region().textContent).toBe('Loaded 3 earlier messages')

    vi.mocked(loadOlderMessagesFn).mockResolvedValueOnce({
      messages: rows(800, 1),
      exhausted: false,
    })
    fireEvent.click(control())
    await settle()
    expect(region().textContent).toBe('Loaded 1 earlier message')
  })

  it('clears the region before every write, so the same text twice is still read', async () => {
    vi.mocked(loadOlderMessagesFn)
      .mockResolvedValueOnce({ messages: rows(900, 3), exhausted: false })
      .mockResolvedValueOnce({ messages: rows(800, 3), exhausted: false })
    render(tree(fullWindow()))
    const seen = recordRegion()
    fireEvent.click(control())
    await settle()
    fireEvent.click(control())
    await settle()
    const text = 'Loaded 3 earlier messages'
    expect(seen.filter((entry) => entry === text)).toHaveLength(2)
    expect(seen[seen.indexOf(text) + 1]).toBe('')
  })

  it('announces a failed load once, through the region and not the visible line', async () => {
    vi.mocked(loadOlderMessagesFn).mockRejectedValueOnce(new Error('offline'))
    render(tree(fullWindow()))
    const seen = recordRegion()
    fireEvent.click(control())
    await settle()
    const text = En['collab.thread.loadOlderFailed']
    expect(region().textContent).toBe(text)
    expect(seen.filter((entry) => entry === text)).toHaveLength(1)
    const line = document.getElementById(
      control().getAttribute('aria-describedby')!,
    )!
    expect(line.textContent).toBe(text)
    expect(line.closest('[role="status"]')).toBeNull()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  it('says the page did not load when a peer moved the window while it was in flight', async () => {
    let finish!: (page: { messages: MessageData[]; exhausted: boolean }) => void
    vi.mocked(loadOlderMessagesFn).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { rerender } = render(tree(fullWindow()))
    fireEvent.click(control())
    rerender(
      tree([...rows(1001, THREAD_PAGE_SIZE - 1), message('m2000', 'user-1')]),
    )
    await act(async () => {
      finish({ messages: rows(900, 3), exhausted: false })
      await vi.advanceTimersByTimeAsync(0)
    })
    await settle()
    expect(region().textContent).toBe(En['collab.thread.loadOlderFailed'])
  })

  it('announces a second identical failure again', async () => {
    vi.mocked(loadOlderMessagesFn).mockRejectedValue(new Error('offline'))
    render(tree(fullWindow()))
    const seen = recordRegion()
    fireEvent.click(control())
    await settle()
    fireEvent.click(control())
    await settle()
    expect(
      seen.filter((entry) => entry === En['collab.thread.loadOlderFailed']),
    ).toHaveLength(2)
  })

  it('does not announce the start when focus moved to the exhausted line', async () => {
    vi.mocked(loadOlderMessagesFn).mockResolvedValueOnce({
      messages: rows(900, 2),
      exhausted: true,
    })
    render(tree(fullWindow()))
    const seen = recordRegion()
    fireEvent.click(control())
    await settle()
    const line = document.querySelector('p[tabindex="-1"]')!
    expect(document.activeElement).toBe(line)
    expect(seen.join('|')).not.toContain(En['collab.thread.start'])
    expect(region().textContent).toBe('Loaded 2 earlier messages')
  })

  it('announces the start once, after the count, when the reader kept focus elsewhere', async () => {
    let finish: (page: {
      messages: MessageData[]
      exhausted: boolean
    }) => void = () => {}
    vi.mocked(loadOlderMessagesFn).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(tree(fullWindow()))
    const seen = recordRegion()
    fireEvent.click(control())
    const composer = document.querySelector<HTMLTextAreaElement>('textarea')!
    composer.focus()
    await act(async () => {
      finish({ messages: rows(900, 2), exhausted: true })
    })
    await settle(3000)
    expect(document.activeElement).toBe(composer)
    const texts = seen.filter((entry) => entry !== '')
    expect(texts).toEqual([
      'Loaded 2 earlier messages',
      En['collab.thread.start'],
    ])
  })

  it('announces the start alone when the last page is empty and focus stayed elsewhere', async () => {
    let finish: (page: {
      messages: MessageData[]
      exhausted: boolean
    }) => void = () => {}
    vi.mocked(loadOlderMessagesFn).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(tree(fullWindow()))
    const seen = recordRegion()
    fireEvent.click(control())
    document.querySelector<HTMLTextAreaElement>('textarea')!.focus()
    await act(async () => {
      finish({ messages: [], exhausted: true })
    })
    await settle(3000)
    expect(seen.filter((entry) => entry !== '')).toEqual([
      En['collab.thread.start'],
    ])
  })
})

describe('a peer’s live message', () => {
  const peer = (id: string, userId = 'user-2', body = 'a secret plan') =>
    message(id, userId, body)

  it('is announced by name after the group window, never with its text', async () => {
    const { rerender } = render(tree(rows(1000, 5)))
    rerender(tree([...rows(1000, 5), peer('m1010')]))
    await settle(900)
    expect(region().textContent).toBe('')
    await settle(200)
    expect(region().textContent).toBe('New message from Bruno Peer')
    expect(region().textContent).not.toContain('secret')
  })

  it('groups several within 1000 ms into one count', async () => {
    const { rerender } = render(tree(rows(1000, 5)))
    const seen = recordRegion()
    rerender(tree([...rows(1000, 5), peer('m1010')]))
    await settle(400)
    rerender(tree([...rows(1000, 5), peer('m1010'), peer('m1011', 'user-3')]))
    await settle(400)
    rerender(
      tree([
        ...rows(1000, 5),
        peer('m1010'),
        peer('m1011', 'user-3'),
        peer('m1012'),
      ]),
    )
    await settle(1200)
    expect(seen.filter((entry) => entry !== '')).toEqual(['3 new messages'])
  })

  it('starts a new group after the window closes', async () => {
    const { rerender } = render(tree(rows(1000, 5)))
    const seen = recordRegion()
    rerender(tree([...rows(1000, 5), peer('m1010')]))
    await settle(1200)
    rerender(tree([...rows(1000, 5), peer('m1010'), peer('m1011', 'user-3')]))
    await settle(1200)
    expect(seen.filter((entry) => entry !== '')).toEqual([
      'New message from Bruno Peer',
      'New message from Cleo Peer',
    ])
  })

  it('is announced even when the transcript did not scroll for it', async () => {
    const { rerender } = render(tree(rows(1000, 5)))
    Object.defineProperty(scroller(), 'scrollHeight', { value: 2000 })
    fireEvent.scroll(scroller())
    const before = scroller().scrollTop
    rerender(tree([...rows(1000, 5), peer('m1010')]))
    await settle()
    expect(scroller().scrollTop).toBe(before)
    expect(region().textContent).toBe('New message from Bruno Peer')
  })

  it('is never announced for the viewer’s own message', async () => {
    const { rerender } = render(tree(rows(1000, 5)))
    rerender(tree([...rows(1000, 5), peer('m1010', 'user-1')]))
    await settle()
    expect(region().textContent).toBe('')
  })

  it('counts only the peers when the viewer’s own message arrives with theirs', async () => {
    const { rerender } = render(tree(rows(1000, 5)))
    rerender(
      tree([
        ...rows(1000, 5),
        peer('m1010', 'user-1'),
        peer('m1011', 'user-2'),
      ]),
    )
    await settle()
    expect(region().textContent).toBe('New message from Bruno Peer')
  })

  it('is not announced for a prepend, only the load is', async () => {
    vi.mocked(loadOlderMessagesFn).mockResolvedValueOnce({
      messages: rows(900, 3),
      exhausted: false,
    })
    render(tree(fullWindow()))
    const seen = recordRegion()
    fireEvent.click(control())
    await settle()
    expect(seen.filter((entry) => entry !== '')).toEqual([
      'Loaded 3 earlier messages',
    ])
  })
})

describe('the entrance of a live row', () => {
  it('is carried only by rows that arrived live', () => {
    const { rerender } = render(tree(rows(1000, 3)))
    for (const id of ['m1000', 'm1001', 'm1002'])
      expect(rowOf(id).className).not.toContain('starting:')
    rerender(tree([...rows(1000, 3), message('m1010', 'user-2')]))
    const live = rowOf('m1010').className
    expect(live).toContain('starting:opacity-0')
    expect(live).toContain('starting:translate-y-1.5')
    expect(live).toContain('duration-base')
    expect(live).toContain('ease-out-quint')
    expect(rowOf('m1002').className).not.toContain('starting:')
  })

  it('drops the rise under reduced motion, a backstop to the global reduced-motion rule', () => {
    const { rerender } = render(tree(rows(1000, 3)))
    rerender(tree([...rows(1000, 3), message('m1010', 'user-2')]))
    const live = rowOf('m1010').className
    expect(live).toContain('motion-reduce:starting:translate-y-0')
    expect(live).not.toContain('motion-reduce:starting:opacity')
  })

  it('animates the viewer’s own live row too', () => {
    const { rerender } = render(tree(rows(1000, 3)))
    rerender(tree([...rows(1000, 3), message('m1010', 'user-1')]))
    expect(rowOf('m1010').className).toContain('starting:opacity-0')
  })

  it('never animates an older page', async () => {
    vi.mocked(loadOlderMessagesFn).mockResolvedValueOnce({
      messages: rows(900, 3),
      exhausted: false,
    })
    render(tree(fullWindow()))
    fireEvent.click(control())
    await settle()
    expect(rowOf('m0900')).not.toBeNull()
    for (const li of scroller().querySelectorAll('li'))
      expect(li.className).not.toContain('starting:')
  })

  it('animates the first message of an empty conversation', () => {
    const { rerender } = render(tree([]))
    rerender(tree([message('m1010', 'user-2')]))
    expect(rowOf('m1010').className).toContain('starting:opacity-0')
  })

  it('carries no entrance in the server render', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(tree(rows(1000, 3)))
    expect(host.innerHTML).not.toContain('starting:')
  })
})
