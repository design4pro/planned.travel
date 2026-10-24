/**
 * Who else is looking at this trip, and whether this tab is actually listening.
 *
 * This is the only component that opens the realtime socket, and it is mounted by
 * the collaboration screen after hydration — the hook must never run on the
 * server, and keeping that decision in one place is what guarantees it. When a
 * commit arrives it invalidates the router, so the screen's loader answers and
 * every panel updates from the database rather than from a socket frame.
 *
 * The status is stated plainly. A collaborative screen that has quietly stopped
 * listening is worse than one that says it is reconnecting. A tab whose workspace was changed in
 * another tab says the one thing that is true there - live updates stopped here, and a retry cannot
 * fix it - and offers the way out (`workspace-changed`). It is a pill and a button, not a modal: a
 * background socket event must not take focus from a field the reader is typing in, and the
 * reload it offers never starts by itself.
 */
import { useCallback, useEffect, useId, useMemo, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { ArrowRightLeft, RotateCw, Wifi, WifiOff } from 'lucide-react'

import {
  CURRENT_WORKSPACE_BUTTON_CLASS,
  useOpenCurrentWorkspace,
} from '#/components/layout/use-open-current-workspace'
import { Avatar, Button, Tooltip } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { useTripRoom } from './use-trip-room'

import type { PresenceMember } from '#/server/do/protocol'
import type { MessageKey } from '#/lib/i18n'
import type { RoomStatus } from './use-trip-room'

const STATUS_COPY: {
  readonly [K in RoomStatus]: {
    readonly labelKey: MessageKey
    readonly hintKey: MessageKey
  }
} = {
  connecting: {
    labelKey: 'modules.presence.connecting.title',
    hintKey: 'modules.presence.connecting.body',
  },
  live: {
    labelKey: 'modules.presence.live.title',
    hintKey: 'modules.presence.live.body',
  },
  reconnecting: {
    labelKey: 'modules.presence.reconnecting.title',
    hintKey: 'modules.presence.reconnecting.body',
  },
  offline: {
    labelKey: 'modules.presence.offline.title',
    hintKey: 'modules.presence.offline.body',
  },
  'workspace-changed': {
    labelKey: 'modules.presence.workspaceChanged.title',
    hintKey: 'modules.presence.workspaceChanged.body',
  },
}

/** Each state has its own tone, so none of them reads as another (grey is `offline` alone). */
const PILL_TONE: { readonly [K in RoomStatus]: string } = {
  connecting: 'bg-warning-soft text-warning',
  live: 'bg-success-soft text-success',
  reconnecting: 'bg-warning-soft text-warning',
  offline: 'bg-surface-2 text-ink-3',
  'workspace-changed': 'bg-info-soft text-info',
}

function StatusGlyph({ status }: { status: RoomStatus }) {
  if (status === 'offline') return <WifiOff aria-hidden className="size-3.5" />
  if (status === 'workspace-changed') {
    return <ArrowRightLeft aria-hidden className="size-3.5" />
  }
  return (
    <span className="relative grid size-3.5 place-items-center">
      <Wifi aria-hidden className="size-3.5" />
      {status === 'live' ? null : (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse-soft rounded-full bg-current/20"
          // This ring is the whole difference between "connecting" and
          // "connected": it is drawn only while the room is not live.
          // Frozen, it becomes a halo that means nothing, and the bar
          // claims a settled state it has not reached.
          data-motion-loop=""
        />
      )}
    </span>
  )
}

interface Person {
  id: string
  /** `null` when the person has no display name; the label is worded at render time. */
  name: string | null
  image: string | null
  tabs: number
}

/** One entry per person, however many tabs they have open. */
function uniquePeople(peers: ReadonlyArray<PresenceMember>): Array<Person> {
  const byUser = new Map<string, Person>()
  for (const peer of peers) {
    const existing = byUser.get(peer.user.id)
    if (existing === undefined) {
      byUser.set(peer.user.id, {
        id: peer.user.id,
        name: peer.user.name,
        image: peer.user.avatarUrl ?? null,
        tabs: 1,
      })
    } else {
      existing.tabs += 1
    }
  }
  return [...byUser.values()]
}

export function PresenceBar({
  tripId,
  className,
}: {
  tripId: string
  className?: string
}) {
  const t = useTranslate()

  const router = useRouter()

  const onCommit = useCallback(() => {
    void router.invalidate()
  }, [router])

  const room = useTripRoom(tripId, { onCommit })
  const people = useMemo(() => uniquePeople(room.peers), [room.peers])
  const copy = STATUS_COPY[room.status]
  const unnamed = t('modules.collab.presence.unnamed')

  const currentWorkspace = useOpenCurrentWorkspace({ guardUnsentText: true })
  const workspaceChanged = room.status === 'workspace-changed'
  const captionId = useId()
  const cancelButton = useRef<HTMLButtonElement>(null)
  const openButton = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const { confirming } = currentWorkspace

  // The confirmation takes focus to the safe choice, so Enter pressed twice backs out; Cancel
  // unmounts while focused, so focus goes back to the button it came from.
  useEffect(() => {
    if (confirming) cancelButton.current?.focus()
    else if (wasConfirming.current) openButton.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-3', className)}>
      <Tooltip content={t(copy.hintKey)}>
        <span
          tabIndex={0}
          role="status"
          className={cn(
            // Wraps instead of overflowing: a translated title is several times the English one.
            'inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold focus-ring',
            PILL_TONE[room.status],
          )}
        >
          <StatusGlyph status={room.status} />
          {t(copy.labelKey)}
        </span>
      </Tooltip>

      {people.length === 0 ? null : (
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex items-center">
            {people.slice(0, 5).map((person) => {
              const name = person.name ?? unnamed
              return (
                <Tooltip
                  key={person.id}
                  content={
                    person.tabs > 1
                      ? t('modules.collab.presence.tabsOpen', {
                          name,
                          count: person.tabs,
                        })
                      : name
                  }
                >
                  <span
                    tabIndex={0}
                    className="-ms-1.5 rounded-full first:ms-0 focus-ring"
                  >
                    <Avatar
                      name={name}
                      initials={person.name === null ? '?' : undefined}
                      src={person.image}
                      size="sm"
                      className="ring-2 ring-surface"
                    />
                  </span>
                </Tooltip>
              )
            })}
            {people.length > 5 ? (
              <span className="-ms-1.5 inline-flex size-6 items-center justify-center rounded-full bg-surface-2 text-micro font-semibold tabular-nums text-ink-3 ring-2 ring-surface">
                +{people.length - 5}
              </span>
            ) : null}
          </span>
          <span className="text-caption text-ink-3">
            {t('modules.collab.presence.viewingNow')}
          </span>
        </span>
      )}

      {room.status === 'offline' ? (
        <Button
          variant="secondary"
          size="sm"
          shape="pill"
          onClick={room.reconnect}
        >
          <RotateCw aria-hidden />
          {t('modules.presence.reconnect')}
        </Button>
      ) : null}

      {workspaceChanged ? (
        <>
          {/* The reason as text, readable without hovering: a phone cannot open the tooltip. */}
          <span
            id={captionId}
            aria-live="polite"
            className="min-w-0 basis-full text-caption text-ink-2 sm:basis-auto"
          >
            {t('modules.presence.workspaceChanged.body')}
            {currentWorkspace.confirming
              ? ` ${t('modules.presence.workspaceChanged.discard')}`
              : null}
          </span>
          {currentWorkspace.confirming ? (
            // The safe choice sits where the first press was, so a second quick tap on the same
            // spot backs out instead of discarding the draft.
            <Button
              ref={cancelButton}
              variant="secondary"
              shape="pill"
              className={CURRENT_WORKSPACE_BUTTON_CLASS}
              aria-describedby={captionId}
              onClick={currentWorkspace.cancel}
            >
              {t('modules.action.cancel')}
            </Button>
          ) : null}
          <Button
            ref={openButton}
            variant={currentWorkspace.confirming ? 'danger' : 'secondary'}
            shape="pill"
            className={CURRENT_WORKSPACE_BUTTON_CLASS}
            aria-describedby={captionId}
            onClick={currentWorkspace.open}
            loading={currentWorkspace.opening}
          >
            {currentWorkspace.confirming
              ? t('modules.presence.workspaceChanged.confirm')
              : t('shell.session.openCurrentWorkspace')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
