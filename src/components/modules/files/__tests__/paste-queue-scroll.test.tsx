import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePasteQueueScroll } from '../use-paste-queue-scroll'
import type { UploadQueueState, UploadStatus } from '../upload-queue'

const frames = new Map<number, FrameRequestCallback>()
let sequence = 0
const scroll = vi.fn()
beforeEach(() => {
  frames.clear()
  scroll.mockClear()
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
    (callback) => {
      frames.set(++sequence, callback)
      return sequence
    },
  )
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
})
afterEach(cleanup)

function queue(...statuses: UploadStatus[]): UploadQueueState {
  return {
    tasks: statuses.map((status, index) => ({
      id: String(index),
      filename: 'paste.png',
      sizeBytes: 1,
      status,
      progress: 0,
      message: null,
    })),
  }
}
function mount() {
  const hook = renderHook(
    (state: UploadQueueState) => usePasteQueueScroll(state),
    { initialProps: queue('queued', 'queued') },
  )
  const list = document.createElement('ul')
  list.scrollIntoView = scroll
  hook.result.current.queueListRef.current = list
  act(() => hook.result.current.revealPaste(['0', '1']))
  return hook
}
function paint() {
  act(() => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(0)
  })
}

it('reveals immediately, then corrects once after the entire paste batch completes', () => {
  const hook = mount()
  expect(scroll).toHaveBeenCalledTimes(1)
  hook.rerender(queue('done', 'uploading'))
  paint()
  expect(scroll).toHaveBeenCalledTimes(1)
  hook.rerender(queue('done', 'failed'))
  expect(scroll).toHaveBeenCalledTimes(1)
  paint()
  expect(scroll).toHaveBeenCalledTimes(2)
  expect(scroll).toHaveBeenLastCalledWith({
    behavior: 'instant',
    block: 'center',
  })
  hook.rerender(queue('done', 'failed'))
  paint()
  expect(scroll).toHaveBeenCalledTimes(2)
})

it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])(
  'keeps the reader position after %s, including a pending correction',
  (input) => {
    const hook = mount()
    hook.rerender(queue('done', 'done'))
    act(() => window.dispatchEvent(new Event(input)))
    paint()
    expect(scroll).toHaveBeenCalledTimes(1)
  },
)

it('replaces an older paste intent and cancels pending work on unmount', () => {
  const hook = mount()
  hook.rerender(queue('done', 'done'))
  act(() => hook.result.current.revealPaste(['0']))
  paint()
  expect(scroll).toHaveBeenCalledTimes(3)
  act(() => hook.result.current.revealPaste(['1']))
  hook.unmount()
  paint()
  expect(scroll).toHaveBeenCalledTimes(4)
})
