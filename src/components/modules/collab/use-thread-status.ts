/**
 * What a screen reader is told about a long conversation: one polite status
 * region owned by the thread, written one text at a time.
 *
 * The region is emptied before every write. A live region only speaks when its
 * text changes, so the same sentence twice in a row (two failed loads, two
 * pages of the same size) would otherwise be heard once.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/** How long the region stays empty before a text goes in. */
const CLEAR_MS = 100

/** How long a text stays before the next queued one replaces it, so none is cut off. */
const HOLD_MS = 1000

/** Peer messages arriving within this window are announced as one count. */
export const ARRIVAL_GROUP_MS = 1000

export function useStatusRegion(): {
  readonly text: string
  readonly announce: (text: string) => void
} {
  const [text, setText] = useState('')
  const queue = useRef<string[]>([])
  const busy = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const step = useCallback(() => {
    const following = queue.current.shift()
    if (following === undefined) {
      busy.current = false
      return
    }
    setText('')
    timer.current = setTimeout(() => {
      setText(following)
      timer.current = setTimeout(step, HOLD_MS)
    }, CLEAR_MS)
  }, [])

  const announce = useCallback(
    (next: string) => {
      queue.current.push(next)
      if (busy.current) return
      busy.current = true
      step()
    },
    [step],
  )

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      queue.current = []
      busy.current = false
    },
    [],
  )

  return { text, announce }
}

/**
 * Collects the names of peers whose messages arrive and hands them over once,
 * {@link ARRIVAL_GROUP_MS} after the first: a burst becomes one announcement,
 * not one per message.
 */
export function useArrivalGroup(
  onGroup: (names: ReadonlyArray<string>) => void,
): (name: string) => void {
  const names = useRef<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(onGroup)
  latest.current = onGroup

  useEffect(() => () => clearTimeout(timer.current), [])

  return useCallback((name: string) => {
    names.current.push(name)
    if (timer.current !== undefined) return
    timer.current = setTimeout(() => {
      timer.current = undefined
      const group = names.current
      names.current = []
      latest.current(group)
    }, ARRIVAL_GROUP_MS)
  }, [])
}
