import { useCallback, useEffect, useRef, useState } from 'react'
import type { UploadQueueState } from './upload-queue'

/** A paste owns one initial reveal and one completion correction, until the reader moves on. */
export function usePasteQueueScroll(queue: UploadQueueState) {
  const queueListRef = useRef<HTMLUListElement>(null)
  const intent = useRef<{
    ids: ReadonlyArray<string>
    revealed: boolean
  } | null>(null)
  const frame = useRef<number | null>(null)
  const [request, setRequest] = useState(0)

  useEffect(() => {
    const cancel = () => {
      intent.current = null
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    for (const input of inputs)
      window.addEventListener(input, cancel, { capture: true, passive: true })
    return () => {
      cancel()
      for (const input of inputs)
        window.removeEventListener(input, cancel, true)
    }
  }, [])

  useEffect(() => {
    const current = intent.current
    if (!current) return
    const reveal = () =>
      queueListRef.current?.scrollIntoView({
        behavior: 'instant',
        block: 'center',
      })
    if (!current.revealed) {
      reveal()
      current.revealed = true
    }
    const complete = current.ids.every((id) => {
      const task = queue.tasks.find((entry) => entry.id === id)
      return task && task.status !== 'queued' && task.status !== 'uploading'
    })
    if (!complete) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      if (intent.current !== current) return
      reveal()
      intent.current = null
    })
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [queue, request])

  const revealPaste = useCallback((ids: ReadonlyArray<string>) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    intent.current = ids.length ? { ids, revealed: false } : null
    setRequest((previous) => previous + 1)
  }, [])

  return { queueListRef, revealPaste }
}
