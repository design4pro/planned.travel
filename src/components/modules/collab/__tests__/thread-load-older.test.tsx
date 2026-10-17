import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

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
]

/** jsdom has no layout: every row is 100 px tall inside a 300 px box at the viewport's top. */
const ROW_HEIGHT = 100
const CLIENT_HEIGHT = 300

const layout = { top: 0 }
const writes: number[] = []

const original = {
  scrollHeight: Object.getOwnPropertyDescriptor(
    Element.prototype,
    'scrollHeight',
  ),
  clientHeight: Object.getOwnPropertyDescriptor(
    Element.prototype,
    'clientHeight',
  ),
  scrollTop: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'),
}
const originalRect = Element.prototype.getBoundingClientRect

function isScroller(element: Element): boolean {
  return element.getAttribute('data-part') === 'thread-scroller'
}

function stubLayout(): void {
  Object.defineProperty(Element.prototype, 'scrollHeight', {
    configurable: true,
    get(this: Element) {
      return isScroller(this)
        ? this.querySelectorAll('li').length * ROW_HEIGHT
        : (original.scrollHeight?.get?.call(this) ?? 0)
    },
  })
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get(this: Element) {
      return isScroller(this)
        ? CLIENT_HEIGHT
        : (original.clientHeight?.get?.call(this) ?? 0)
    },
  })
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get(this: Element) {
      return isScroller(this)
        ? layout.top
        : (original.scrollTop?.get?.call(this) ?? 0)
    },
    set(this: Element, value: number) {
      if (isScroller(this)) {
        writes.push(value)
        layout.top = value
      } else original.scrollTop?.set?.call(this, value)
    },
  })
}

/** A row's box follows from its index and the scroller's offset; everything else is empty. */
function stubRects(): void {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (!this.matches('li[data-message-id]')) return new DOMRect()
    const items = document.querySelectorAll(
      '[data-part="thread-scroller"] li[data-message-id]',
    )
    const index = Array.from(items).indexOf(this)
    return new DOMRect(0, index * ROW_HEIGHT - layout.top, 0, ROW_HEIGHT)
  }
}

function restoreLayout(): void {
  Element.prototype.getBoundingClientRect = originalRect
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop'] as const) {
    const descriptor = original[key]
    if (descriptor) Object.defineProperty(Element.prototype, key, descriptor)
  }
}

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

const scroller = () =>
  document.querySelector<HTMLElement>('[data-part="thread-scroller"]')!
const control = () =>
  document.querySelector<HTMLButtonElement>('[data-part="thread-load-older"]')
const fullWindow = () => rows(1000, THREAD_PAGE_SIZE)

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle
    reject = fail
  })
  return { promise, resolve, reject }
}

let focus: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  layout.top = 0
  writes.length = 0
  stubLayout()
  stubRects()
  vi.mocked(loadOlderMessagesFn).mockReset()
  focus = vi.spyOn(HTMLElement.prototype, 'focus')
})
afterEach(() => {
  cleanup()
  restoreLayout()
  vi.restoreAllMocks()
})

describe('the load-earlier control', () => {
  it('sits above the scroller, outside it, and rests on the catalogue label', () => {
    render(tree(fullWindow()))
    const button = control()!
    expect(button.textContent).toBe(En['collab.thread.loadOlder'])
    expect(scroller().contains(button)).toBe(false)
    expect(
      scroller().previousElementSibling?.contains(button) ||
        scroller().previousElementSibling === button,
    ).toBe(true)
  })

  it('is absent while the window is shorter than a page', () => {
    render(tree(rows(1000, THREAD_PAGE_SIZE - 1)))
    expect(control()).toBeNull()
    expect(screen.queryByText(En['collab.thread.start'])).toBeNull()
  })

  it('shows the loading label without changing the visible one and fires once', async () => {
    const page = deferred<{ messages: MessageData[]; exhausted: boolean }>()
    vi.mocked(loadOlderMessagesFn).mockReturnValue(page.promise)
    render(tree(fullWindow()))
    const button = control()!
    fireEvent.click(button)
    fireEvent.click(button)
    expect(loadOlderMessagesFn).toHaveBeenCalledTimes(1)
    expect(loadOlderMessagesFn).toHaveBeenCalledWith({
      data: { tripId: 'trip-1', cursor: 'm1000' },
    })
    await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'))
    expect(button.textContent).toContain(En['collab.thread.loadOlder'])
    expect(button.textContent).toContain(En['collab.thread.loadingOlder'])
    expect(button.querySelector('.invisible')?.textContent).toBe(
      En['collab.thread.loadOlder'],
    )
    await act(async () => {
      page.resolve({ messages: rows(900, 3), exhausted: false })
      await page.promise
    })
    fireEvent.click(control()!)
    expect(loadOlderMessagesFn).toHaveBeenCalledTimes(2)
  })

  it('prepends the page, focuses the control without scrolling the page', async () => {
    vi.mocked(loadOlderMessagesFn).mockResolvedValue({
      messages: rows(900, 3),
      exhausted: false,
    })
    render(tree(fullWindow()))
    focus.mockClear()
    fireEvent.click(control()!)
    await waitFor(() => expect(screen.getByText('m0900')).toBeTruthy())
    await waitFor(() => expect(document.activeElement).toBe(control()))
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true })
    expect(control()?.getAttribute('aria-busy')).toBeNull()
    expect(screen.queryByText(En['collab.thread.start'])).toBeNull()
  })

  it('says it failed, keeps the rows and focuses "Try again"', async () => {
    vi.mocked(loadOlderMessagesFn)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ messages: rows(900, 2), exhausted: false })
    render(tree(fullWindow()))
    layout.top = 250
    writes.length = 0
    focus.mockClear()
    fireEvent.click(control()!)
    await waitFor(() =>
      expect(
        screen.getByText(En['collab.thread.loadOlderFailed']),
      ).toBeTruthy(),
    )
    expect(control()?.textContent).toBe(En['collab.thread.retry'])
    const failure = screen.getByText(En['collab.thread.loadOlderFailed'])
    expect(failure.closest('[role="status"]')).not.toBeNull()
    expect(control()?.getAttribute('aria-describedby')).toBe(failure.id)
    expect(document.querySelector('[role="alert"]')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(control()))
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true })
    expect(writes).toEqual([])
    expect(screen.getAllByRole('listitem')).toHaveLength(THREAD_PAGE_SIZE)

    fireEvent.click(control()!)
    await waitFor(() => expect(screen.getByText('m0900')).toBeTruthy())
    expect(screen.queryByText(En['collab.thread.loadOlderFailed'])).toBeNull()
    expect(control()?.textContent).toBe(En['collab.thread.loadOlder'])
    expect(control()?.getAttribute('aria-describedby')).toBeNull()
  })

  it('replaces the control with a focused line after the last page', async () => {
    vi.mocked(loadOlderMessagesFn).mockResolvedValue({
      messages: rows(900, 2),
      exhausted: true,
    })
    render(tree(fullWindow()))
    focus.mockClear()
    fireEvent.click(control()!)
    const line = await screen.findByText(En['collab.thread.start'])
    expect(control()).toBeNull()
    expect(line.getAttribute('tabindex')).toBe('-1')
    expect(scroller().contains(line)).toBe(false)
    await waitFor(() => expect(document.activeElement).toBe(line))
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true })
  })

  it('puts no live region on the transcript list', () => {
    render(tree(fullWindow()))
    expect(scroller().querySelector('[aria-live], [role="log"]')).toBeNull()
  })
})

describe('where the transcript scrolls', () => {
  it('bounds the scroller below xl', () => {
    render(tree(rows(1000, 3)))
    expect(scroller().className).toContain('max-h-[70svh]')
    expect(scroller().className).toContain('xl:max-h-none')
  })

  it('writes the bottom once on mount and never scrolls the page', () => {
    const intoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    const toWindow = vi.spyOn(window, 'scrollTo')
    const { rerender } = render(tree(rows(1000, 3)))
    expect(writes).toEqual([3 * ROW_HEIGHT])
    rerender(tree(rows(1000, 3)))
    expect(writes).toEqual([3 * ROW_HEIGHT])
    expect(intoView).not.toHaveBeenCalled()
    expect(toWindow).not.toHaveBeenCalled()
  })

  it('keeps the readers place across a prepend', async () => {
    vi.mocked(loadOlderMessagesFn).mockResolvedValue({
      messages: rows(900, 4),
      exhausted: false,
    })
    render(tree(fullWindow()))
    layout.top = 120
    fireEvent.scroll(scroller())
    writes.length = 0
    fireEvent.click(control()!)
    await waitFor(() => expect(screen.getByText('m0900')).toBeTruthy())
    expect(writes).toEqual([120 + 4 * ROW_HEIGHT])
  })

  describe('a live message', () => {
    const own = message('m1010', 'user-1')
    const peer = message('m1010', 'user-2')

    function readerAt(distanceFromBottom: number) {
      const view = render(tree(rows(1000, 5)))
      layout.top = 5 * ROW_HEIGHT - CLIENT_HEIGHT - distanceFromBottom
      fireEvent.scroll(scroller())
      writes.length = 0
      return view
    }

    it('scrolls to the bottom when the reader was within 48 px of it', () => {
      const { rerender } = readerAt(48)
      rerender(tree([...rows(1000, 5), peer]))
      expect(writes).toEqual([6 * ROW_HEIGHT])
    })

    it('leaves a reader of history where they are', () => {
      const { rerender } = readerAt(49)
      rerender(tree([...rows(1000, 5), peer]))
      expect(writes).toEqual([])
    })

    it('puts the first row in view back when the loader window slides past the oldest row', () => {
      const { rerender } = render(tree(rows(1000, THREAD_PAGE_SIZE)))
      layout.top = 20 * ROW_HEIGHT
      fireEvent.scroll(scroller())
      writes.length = 0
      rerender(tree([...rows(1001, THREAD_PAGE_SIZE - 1), message('m1099')]))
      expect(writes).toEqual([19 * ROW_HEIGHT])
    })

    it("always scrolls for the viewer's own message", () => {
      const { rerender } = readerAt(400)
      rerender(tree([...rows(1000, 5), own]))
      expect(writes).toEqual([6 * ROW_HEIGHT])
    })
  })
})
