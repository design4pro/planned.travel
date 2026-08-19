import * as React from 'react'

/**
 * Keyboard drag and drop, for key events that arrive without a physical code.
 *
 * `@dnd-kit`'s keyboard sensor decides everything — lift, move, drop, cancel — from
 * `KeyboardEvent.code`, the *physical* key. A hardware keyboard always sends it, so
 * a drag works. Anything that synthesises a key event does not have to:
 * `new KeyboardEvent('keydown', { key: ' ' })` reports `code === ''`, which is what
 * scripted input, some on-screen keyboards and assistive-technology bridges produce.
 * The pointer sensor never reads `code`, which is exactly why the pointer path kept
 * working on a board whose keyboard path looked dead.
 */

/**
 * `KeyboardEvent.key` → `KeyboardEvent.code`, for the keys the drag sensor reads.
 *
 * Partial on purpose: every other key falls through untouched.
 */
const CODE_FOR_KEY: Partial<Record<string, string>> = {
  ' ': 'Space',
  Spacebar: 'Space',
  Enter: 'Enter',
  Escape: 'Escape',
  Esc: 'Escape',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
}

/**
 * Fills in `code` from `key` for the keys a drag reads, while mounted.
 *
 * The stamp happens at the capture phase, before either React's root listener or
 * the sensor's own document listener sees the event. One `defineProperty` on the
 * event instance shadows the prototype getter, so the same object then reads
 * consistently for every listener — which is why this is a stamp rather than a
 * re-dispatched twin: a twin would run every other handler on the page twice. A
 * real keyboard never enters the branch at all.
 */
export function useKeyboardCodeFallback(): void {
  React.useEffect(() => {
    const stamp = (event: KeyboardEvent): void => {
      if (event.code !== '') return
      const code = CODE_FOR_KEY[event.key]
      if (code === undefined) return
      Object.defineProperty(event, 'code', { configurable: true, value: code })
    }

    document.addEventListener('keydown', stamp, { capture: true })
    return () => {
      document.removeEventListener('keydown', stamp, { capture: true })
    }
  }, [])
}
