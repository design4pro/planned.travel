/** Component-owned snapshots of the older pages a reader has loaded. */
import { useRef, useState } from 'react'
import { THREAD_PAGE_SIZE } from '#/lib/collab'
import { loadOlderMessagesFn } from '#/server/fns/collab-thread'
import { mergeThread } from './thread-model'
import type { MessageData } from './types'

export function useThreadHistory(
  tripId: string,
  window: ReadonlyArray<MessageData>,
) {
  const identity = useRef({ tripId, generation: 0 })
  if (identity.current.tripId !== tripId)
    identity.current = { tripId, generation: identity.current.generation + 1 }
  const [state, setState] = useState({
    tripId,
    window,
    messages: window,
    exhausted: false,
    active: false,
  })
  let current = state
  if (state.tripId !== tripId || state.window !== window) {
    const reset =
      state.tripId !== tripId ||
      (window[0]?.id ?? '') > (state.messages.at(-1)?.id ?? '')
    const active = state.active && !reset
    const messages = active ? mergeThread(state.messages, window) : window
    current = {
      active,
      tripId,
      window,
      messages,
      exhausted: reset ? false : state.exhausted,
    }
    setState(current)
  }
  const latest = useRef(current)
  latest.current = current
  const flight = useRef(false)
  const exhausted = window.length < THREAD_PAGE_SIZE || current.exhausted

  async function loadOlder(): Promise<void> {
    const cursor = latest.current.messages[0]?.id
    if (
      flight.current ||
      latest.current.window.length < THREAD_PAGE_SIZE ||
      latest.current.exhausted ||
      cursor === undefined
    )
      return
    flight.current = true
    const requestedTrip = latest.current.tripId
    const generation = identity.current.generation
    try {
      const page = await loadOlderMessagesFn({
        data: { tripId: requestedTrip, cursor },
      })
      const now = latest.current
      if (
        identity.current.generation !== generation ||
        now.tripId !== requestedTrip ||
        now.messages[0]?.id !== cursor
      )
        return
      setState((previous) => {
        if (
          previous.tripId !== requestedTrip ||
          previous.messages[0]?.id !== cursor
        )
          return previous
        const rows = new Map(page.messages.map((row) => [row.id, row]))
        for (const row of previous.messages) rows.set(row.id, row)
        return {
          ...previous,
          messages: [...rows.values()].sort((a, b) =>
            a.id < b.id ? -1 : Number(a.id > b.id),
          ),
          exhausted: page.exhausted,
          active: true,
        }
      })
    } finally {
      flight.current = false
    }
  }

  function patchHeld(
    patch: (rows: ReadonlyArray<MessageData>) => ReadonlyArray<MessageData>,
  ): void {
    setState((previous) => {
      if (previous.tripId !== tripId) return previous
      const oldest = previous.window[0]?.id
      if (oldest === undefined) return previous
      const held = previous.messages.filter((row) => row.id < oldest)
      return {
        ...previous,
        messages: [
          ...patch(held),
          ...previous.messages.filter((row) => row.id >= oldest),
        ],
      }
    })
  }
  return { messages: current.messages, exhausted, loadOlder, patchHeld }
}
