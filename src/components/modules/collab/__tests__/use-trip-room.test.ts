// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TRIP_ROOM_CLOSED_CODE,
  TRIP_ROOM_CLOSED_REASON,
} from '#/server/do/protocol'

interface SocketOptions {
  onClose: (event: { code: number; reason: string }) => void
}

const captured = vi.hoisted(() => ({ options: null as unknown }))

vi.mock('partysocket/use-ws', () => ({
  default: (_url: unknown, _protocols: unknown, options: unknown) => {
    captured.options = options
    return {
      readyState: 0,
      OPEN: 1,
      retryCount: 0,
      send: vi.fn(),
      reconnect: vi.fn(),
    }
  },
}))

const { useTripRoom } = await import('../use-trip-room')

function close(code: number, reason: string): void {
  const { onClose } = captured.options as SocketOptions
  onClose({ code, reason })
}

describe('useTripRoom - a close that changes what the viewer may do', () => {
  beforeEach(() => {
    captured.options = null
  })

  it('re-reads the loader when the room closed the socket for an access change', () => {
    const onCommit = vi.fn()
    renderHook(() => useTripRoom('trip-1', { onCommit }))

    close(TRIP_ROOM_CLOSED_CODE, TRIP_ROOM_CLOSED_REASON)

    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('leaves the loader alone for any other close, so a protocol mismatch cannot loop', () => {
    const onCommit = vi.fn()
    renderHook(() => useTripRoom('trip-1', { onCommit }))

    close(TRIP_ROOM_CLOSED_CODE, 'Protocol mismatch')
    close(1006, '')

    expect(onCommit).not.toHaveBeenCalled()
  })
})
