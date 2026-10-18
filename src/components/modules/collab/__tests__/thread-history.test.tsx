import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadOlderMessagesFn } from '#/server/fns/collab-thread'
import { useThreadHistory } from '../use-thread-history'
import {
  mergeThread,
  removeMessage,
  editMessage,
  setViewerReaction,
} from '../thread-model'
import type { MessageData } from '../types'

vi.mock('#/server/fns/collab-thread', () => ({ loadOlderMessagesFn: vi.fn() }))
afterEach(cleanup)
const row = (id: string): MessageData => ({
  id,
  body: id,
  userId: 'viewer',
  createdAt: '2026-10-01T12:00:00Z',
  editedAt: null,
  replyToId: null,
  reactions: [],
})

describe('held conversation rows', () => {
  it('keeps slid-out rows, drops deletions inside the window and deduplicates', () => {
    expect(
      mergeThread(['01', '02', '03', '04'].map(row), ['03', '05'].map(row)).map(
        (m) => m.id,
      ),
    ).toEqual(['01', '02', '03', '05'])
    expect(
      mergeThread(['01', '02'].map(row), ['04', '05'].map(row)).map(
        (m) => m.id,
      ),
    ).toEqual(['04', '05'])
    expect(mergeThread([row('01')], [])).toEqual([])
  })
  it('patches only the viewers successful actions and keeps peers reactions', () => {
    const held = [
      {
        ...row('01'),
        reactions: [{ emoji: '👍', count: 1, userIds: ['peer'] }],
      },
      row('02'),
    ]
    expect(removeMessage(held, '02').map((m) => m.id)).toEqual(['01'])
    expect(editMessage(held, '01', 'new text', 'now')[0]).toMatchObject({
      body: 'new text',
      editedAt: 'now',
    })
    const added = setViewerReaction(held, '01', 'viewer', '👍', true)
    expect(added[0]?.reactions).toEqual([
      { emoji: '👍', count: 2, userIds: ['peer', 'viewer'] },
    ])
    expect(setViewerReaction(added, '01', 'viewer', '👍', true)).toEqual(added)
    expect(setViewerReaction(added, '01', 'viewer', '👍', false)).toEqual(held)
    expect(held[0]?.body).toBe('01')
  })
})

describe('the component history loading path', () => {
  it('allows one request and drops a stale answer after a window reset', async () => {
    let finish!: (value: {
      messages: MessageData[]
      exhausted: boolean
    }) => void
    vi.mocked(loadOlderMessagesFn).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { result, rerender } = renderHook(
      ({ messages }) => useThreadHistory('trip', messages),
      {
        initialProps: {
          messages: Array.from({ length: 50 }, (_, i) =>
            row(String(i + 50).padStart(3, '0')),
          ),
        },
      },
    )
    let pending!: Promise<number | null>
    act(() => {
      pending = result.current.loadOlder()
      void result.current.loadOlder()
    })
    expect(loadOlderMessagesFn).toHaveBeenCalledTimes(1)
    rerender({ messages: [row('200')] })
    let outcome: number | null = 0
    await act(async () => {
      finish({ messages: [row('001')], exhausted: true })
      outcome = await pending
    })
    expect(outcome).toBeNull()
    expect(result.current.messages.map((m) => m.id)).toEqual(['200'])
    expect(result.current.exhausted).toBe(true)
  })
  it('holds loaded history, retains slid-out rows and resets on a different trip', async () => {
    vi.mocked(loadOlderMessagesFn).mockResolvedValue({
      messages: [row('01')],
      exhausted: true,
    })
    const window = Array.from({ length: 50 }, (_, i) => row(String(i + 50)))
    const { result, rerender } = renderHook(
      ({ trip, messages }) => useThreadHistory(trip, messages),
      { initialProps: { trip: 'a', messages: window } },
    )
    let added: number | null = null
    await act(async () => {
      added = await result.current.loadOlder()
    })
    expect(added).toBe(1)
    expect(result.current.messages[0]?.id).toBe('01')
    rerender({ trip: 'a', messages: [...window.slice(1), row('zz')] })
    expect(result.current.messages.map((m) => m.id)).toContain('50')
    rerender({ trip: 'b', messages: window })
    expect(result.current.messages.map((m) => m.id)).not.toContain('01')
  })
})

describe('history request lifecycle', () => {
  it('rejects the previous trips answer even when its cursor is identical', async () => {
    let finish!: (value: {
      messages: MessageData[]
      exhausted: boolean
    }) => void
    vi.mocked(loadOlderMessagesFn).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const messages = Array.from({ length: 50 }, (_, i) => row(String(i + 50)))
    const { result, rerender } = renderHook(
      ({ trip }) => useThreadHistory(trip, messages),
      { initialProps: { trip: 'a' } },
    )
    let pending!: Promise<number | null>
    act(() => {
      pending = result.current.loadOlder()
    })
    rerender({ trip: 'b' })
    rerender({ trip: 'a' })
    await act(async () => {
      finish({ messages: [row('01')], exhausted: true })
      await pending
    })
    expect(result.current.messages).toEqual(messages)
    expect(result.current.exhausted).toBe(false)
  })
  it('allows retry after failure without losing the displayed rows', async () => {
    vi.mocked(loadOlderMessagesFn)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ messages: [], exhausted: true })
    const messages = Array.from({ length: 50 }, (_, i) => row(String(i + 50)))
    const { result } = renderHook(() => useThreadHistory('a', messages))
    await act(async () => {
      await expect(result.current.loadOlder()).rejects.toThrow('offline')
    })
    expect(result.current.messages).toEqual(messages)
    await act(async () => {
      await result.current.loadOlder()
    })
    expect(result.current.exhausted).toBe(true)
  })
})

it('keeps history inert until an older page is accepted', () => {
  const first = [row('01'), row('02')]
  const { result, rerender } = renderHook(
    ({ messages }) => useThreadHistory('trip', messages),
    { initialProps: { messages: first } },
  )
  rerender({ messages: [row('02'), row('03')] })
  expect(result.current.messages.map((message) => message.id)).toEqual([
    '02',
    '03',
  ])
})
