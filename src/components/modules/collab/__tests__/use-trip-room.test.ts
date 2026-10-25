// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  resetWorkspaceClaim,
  setWorkspaceClaim,
} from '#/lib/workspace-claim-store'
import {
  TRIP_ROOM_CLOSED_CODE,
  TRIP_ROOM_CLOSED_REASON,
  TRIP_ROOM_WORKSPACE_CHANGED_CODE,
  TRIP_ROOM_WORKSPACE_CHANGED_REASON,
} from '#/server/do/protocol'

interface SocketOptions {
  onOpen: () => void
  onMessage: (event: { data: string }) => void
  onClose: (event: { code: number; reason: string }) => void
  onError: () => void
  shouldReconnectOnClose: (event: { code: number; reason: string }) => boolean
}

const captured = vi.hoisted(() => ({
  options: null as unknown,
  url: null as unknown,
  socket: null as unknown,
}))

vi.mock('partysocket/use-ws', () => ({
  default: (url: unknown, _protocols: unknown, options: unknown) => {
    captured.options = options
    captured.url = url
    captured.socket ??= {
      readyState: 0,
      OPEN: 1,
      retryCount: 0,
      send: vi.fn(),
      reconnect: vi.fn(),
    }
    return captured.socket
  },
}))

const { useTripRoom } = await import('../use-trip-room')

function member(connectionId: string, name: string | null = 'Ada') {
  return {
    connectionId,
    user: { id: `u-${connectionId}`, name, initials: 'A', hue: 120 },
    joinedAt: 1,
    lastSeenAt: 2,
    focus: null,
  }
}

function receive(message: unknown): void {
  const { onMessage } = captured.options as SocketOptions
  act(() => onMessage({ data: JSON.stringify(message) }))
}

function close(code: number, reason: string): void {
  const { onClose } = captured.options as SocketOptions
  act(() => onClose({ code, reason }))
}

function closeForChangedWorkspace(): void {
  close(TRIP_ROOM_WORKSPACE_CHANGED_CODE, TRIP_ROOM_WORKSPACE_CHANGED_REASON)
}

describe('useTripRoom - a close that changes what the viewer may do', () => {
  beforeEach(() => {
    captured.options = null
    captured.socket = null
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

describe('useTripRoom - a tab whose workspace was changed in another tab', () => {
  beforeEach(() => {
    captured.options = null
    captured.socket = null
    resetWorkspaceClaim()
  })

  it('states the workspace the tab is showing on the socket URL, read at every connect', () => {
    setWorkspaceClaim('org-a')
    renderHook(() => useTripRoom('trip-1'))
    const url = captured.url as () => string

    expect(new URL(url()).searchParams.get('workspace')).toBe('org-a')

    setWorkspaceClaim('org-b')
    expect(new URL(url()).searchParams.get('workspace')).toBe('org-b')
  })

  it('states nothing before the shell has loaded', () => {
    renderHook(() => useTripRoom('trip-1'))
    const url = captured.url as () => string

    expect(new URL(url()).searchParams.has('workspace')).toBe(false)
  })

  it('moves to workspace-changed on the dedicated close and stops retrying', () => {
    const { result } = renderHook(() => useTripRoom('trip-1'))

    closeForChangedWorkspace()

    expect(result.current.status).toBe('workspace-changed')
    expect(result.current.peers).toEqual([])
    const { shouldReconnectOnClose } = captured.options as SocketOptions
    expect(
      shouldReconnectOnClose({
        code: TRIP_ROOM_WORKSPACE_CHANGED_CODE,
        reason: TRIP_ROOM_WORKSPACE_CHANGED_REASON,
      }),
    ).toBe(false)
  })

  it("is not live on an open the door closes at once, only on the room's welcome", () => {
    const { result } = renderHook(() => useTripRoom('trip-1'))
    const options = captured.options as SocketOptions

    act(() => options.onOpen())
    expect(result.current.status).not.toBe('live')

    closeForChangedWorkspace()
    expect(result.current.status).toBe('workspace-changed')

    act(() => options.onOpen())
    act(() =>
      options.onMessage({
        data: JSON.stringify({
          t: 'welcome',
          protocol: 1,
          you: member('c-1'),
          peers: [],
          version: 0,
        }),
      }),
    )
    expect(result.current.status).toBe('live')
  })

  it('keeps reconnecting after every other close', () => {
    const { shouldReconnectOnClose } = (() => {
      renderHook(() => useTripRoom('trip-1'))
      return captured.options as SocketOptions
    })()

    expect(shouldReconnectOnClose({ code: 1006, reason: '' })).toBe(true)
    expect(
      shouldReconnectOnClose({
        code: TRIP_ROOM_CLOSED_CODE,
        reason: TRIP_ROOM_CLOSED_REASON,
      }),
    ).toBe(true)
  })

  it('does not re-read the loader for it: the screen is not out of date, the tab is', () => {
    const onCommit = vi.fn()
    renderHook(() => useTripRoom('trip-1', { onCommit }))

    closeForChangedWorkspace()

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('stays workspace-changed through a later error or close, and a reconnect does not loop', () => {
    const { result } = renderHook(() => useTripRoom('trip-1'))
    closeForChangedWorkspace()

    act(() => (captured.options as SocketOptions).onError())
    close(1006, '')
    act(() => result.current.reconnect())

    expect(result.current.status).toBe('workspace-changed')
    expect(
      (captured.socket as { reconnect: () => void }).reconnect,
    ).not.toHaveBeenCalled()
  })

  it('does not count a failed handshake as this state', () => {
    const { result } = renderHook(() => useTripRoom('trip-1'))

    close(1006, '')

    expect(result.current.status).toBe('reconnecting')
  })
})

describe('useTripRoom - a frame whose shape the client does not understand', () => {
  beforeEach(() => {
    captured.options = null
    captured.socket = null
  })

  it('changes nothing and calls nothing, however malformed it is', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useTripRoom('trip-1', { onCommit }))
    receive({
      t: 'welcome',
      protocol: 1,
      you: member('c-1'),
      peers: [member('c-2', null)],
      version: 3,
    })
    const before = { ...result.current }
    expect(before.status).toBe('live')
    expect(before.peers.map((peer) => peer.user.name)).toEqual(['Ada', null])

    receive({ t: 'presence', peers: [member('c-3', 5 as never)] })
    receive({ t: 'welcome', protocol: 1, peers: [], version: 9 })
    receive({ t: 'commit', version: 9, entries: 'nope' })

    expect(result.current).toEqual(before)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
