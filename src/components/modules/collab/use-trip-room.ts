/**
 * The browser's end of a trip's realtime room.
 *
 * The room (`src/server/do/trip-room.ts`) is one Durable Object per trip: every
 * write mirrors a commit into it, so a viewer who is not the author learns about a
 * change without polling. This hook opens the socket, joins, keeps presence, and
 * tells the screen when to re-read its loader.
 *
 * Three properties matter more than the feature itself:
 *
 * - **D1 is still the truth.** A commit frame is a *signal*, not data: the hook
 *   invalidates the router and the loader answers. Nothing on screen is ever
 *   assembled from a socket frame, so a dropped connection cannot leave the screen
 *   showing something the database does not agree with.
 * - **It reconnects, and says so.** `partysocket` handles the backoff; the status
 *   is surfaced so the screen can be honest about being behind rather than quietly
 *   stale, and a manual retry is always available.
 * - **It never leaks a socket.** The hook closes on unmount and clears its
 *   keepalive with it. It must only be mounted on the client — see `PresenceBar`,
 *   which is the component that owns that decision.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import useWebSocket from 'partysocket/use-ws'

import {
  TRIP_ROOM_CLOSED_REASON,
  TRIP_ROOM_PING_INTERVAL_MS,
  TRIP_ROOM_PROTOCOL_VERSION,
  parseServerMessage,
} from '#/server/do/protocol'

import type { WebSocket as ReconnectingWebSocket } from 'partysocket'
import type { PresenceMember } from '#/server/do/protocol'

export type RoomStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

export interface TripRoomConnection {
  readonly status: RoomStatus
  /** Everyone currently in the room, including the viewer. */
  readonly peers: ReadonlyArray<PresenceMember>
  /** The viewer's own connection, once the room has acknowledged the join. */
  readonly you: PresenceMember | null
  /** The room's monotonic version, as last observed. */
  readonly version: number
  /** Commits observed since this connection opened. */
  readonly changes: number
  /** Forces a fresh connection attempt now, resetting the backoff. */
  readonly reconnect: () => void
}

/** How many failed attempts before the hook stops trying on its own. */
const MAX_RETRIES = 8

export function useTripRoom(
  tripId: string,
  options: { readonly onCommit?: () => void } = {},
): TripRoomConnection {
  const [status, setStatus] = useState<RoomStatus>('connecting')
  const [peers, setPeers] = useState<ReadonlyArray<PresenceMember>>([])
  const [you, setYou] = useState<PresenceMember | null>(null)
  const [version, setVersion] = useState(0)
  const [changes, setChanges] = useState(0)

  // Held in a ref so the socket's handlers never close over a stale callback and
  // the hook does not need the caller to memoise anything.
  const onCommit = useRef(options.onCommit)
  onCommit.current = options.onCommit

  /**
   * The version the client has already applied. Sent with `hello` so a reconnect
   * asks for a delta rather than the whole room, and read from a ref because the
   * `open` handler must see the latest value without re-creating the socket.
   */
  const applied = useRef(0)

  /**
   * The socket, reachable from the handlers below.
   *
   * `useWebSocket`'s handlers are invoked long after this render, but they are
   * declared inside the call that produces the socket, so they cannot close over
   * the binding directly. The ref is filled immediately after the call.
   */
  const socketRef = useRef<ReconnectingWebSocket | null>(null)

  const socket = useWebSocket(
    () => {
      const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${scheme}//${window.location.host}/api/trip-room/${encodeURIComponent(tripId)}`
    },
    undefined,
    {
      maxRetries: MAX_RETRIES,
      // Long enough that a slow cold start is not read as a failure, short enough
      // that a genuinely dead route is reported rather than spun on.
      connectionTimeout: 8000,
      minReconnectionDelay: 500,
      maxReconnectionDelay: 15_000,
      onOpen: () => {
        setStatus('live')
        socketRef.current?.send(
          JSON.stringify({
            t: 'hello',
            protocol: TRIP_ROOM_PROTOCOL_VERSION,
            sinceVersion: applied.current,
          }),
        )
      },
      onMessage: (event: MessageEvent) => {
        if (typeof event.data !== 'string') {
          return
        }
        const parsed = parseServerMessage(event.data)
        if (!parsed.ok) {
          return
        }
        const message = parsed.value

        switch (message.t) {
          case 'welcome': {
            setStatus('live')
            setYou(message.you)
            setPeers([message.you, ...message.peers])
            setVersion(message.version)
            applied.current = message.version
            // A reconnect that caught up on commits is a change like any other.
            if ((message.commits?.length ?? 0) > 0) {
              setChanges((count) => count + 1)
              onCommit.current?.()
            }
            return
          }
          case 'presence': {
            setPeers(message.peers)
            return
          }
          case 'commit': {
            setVersion(message.version)
            applied.current = message.version
            setChanges((count) => count + 1)
            onCommit.current?.()
            return
          }
          case 'error': {
            // A protocol mismatch means a deploy moved under this tab. Reloading
            // is the reader's call, so the status simply stops claiming to be live.
            if (message.code === 'protocol-mismatch') {
              setStatus('offline')
            }
            return
          }
          default:
            return
        }
      },
      onClose: (event: CloseEvent) => {
        // The room closed this socket because the viewer's role or the trip's
        // state changed. The reconnect re-checks access, but the screen's own
        // controls come from the loader, so it is re-read too: a promoted member
        // gets the edit controls, a removed one gets the not-found state.
        if (event.reason === TRIP_ROOM_CLOSED_REASON) {
          onCommit.current?.()
        }
        setPeers([])
        setYou(null)
        setStatus((current) =>
          current === 'offline' ? 'offline' : 'reconnecting',
        )
      },
      onError: () => {
        setStatus((current) =>
          current === 'offline' ? 'offline' : 'reconnecting',
        )
      },
    },
  )

  socketRef.current = socket

  /**
   * Keepalive. The room answers `ping` with `pong` as a hibernation
   * auto-response, so this costs nothing on the server and stops an intermediary
   * from closing an idle socket.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ t: 'ping' }))
      }
    }, TRIP_ROOM_PING_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [socket])

  /**
   * `partysocket` gives up after `maxRetries`. Once it has, the status must say
   * so rather than sitting on "reconnecting" for ever.
   */
  useEffect(() => {
    if (socket.retryCount >= MAX_RETRIES) {
      setStatus('offline')
    }
  }, [socket.retryCount])

  const reconnect = useCallback(() => {
    setStatus('connecting')
    socket.reconnect()
  }, [socket])

  return { status, peers, you, version, changes, reconnect }
}
