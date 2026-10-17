import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { cn } from '#/lib/cn'
import {
  COLLAB_SECTIONS,
  collabLayout,
  visibleCollabSections,
} from '#/lib/collab-sections'
import type { CollabSectionId, CollabSections } from '#/lib/collab-sections'
import { useLocale, useTranslate } from '#/lib/i18n'
import { TRIP_RAIL_STICKY_CLASS } from '#/lib/atlas/layout'
import { ModulePanel } from '../shared'
import { Thread } from './thread'
import { NotesBoard } from './notes-board'
import { PollsBoard } from './polls-board'
import { COLLAB_SECTION_PRESENTATION } from './sections'
import type { CollabPerson, MessageData, NoteData, PollData } from './types'

export interface CollabScreenData {
  readonly sections: CollabSections
  readonly messages: ReadonlyArray<MessageData>
  readonly notes: ReadonlyArray<NoteData>
  readonly polls: ReadonlyArray<PollData>
  readonly people: ReadonlyArray<CollabPerson>
  readonly viewerUserId: string
  readonly timeZone: string
}

/** Owns draft retention and focus as the stored record changes under a traveller. */
export function CollabScreen({
  data,
  tripId,
  canModerate,
  ownWrite,
}: {
  data: CollabScreenData
  tripId: string
  canModerate: boolean
  ownWrite: RefObject<boolean>
}) {
  const t = useTranslate()
  const locale = useLocale()
  const baseId = useId()
  const [withDraft, setWithDraft] = useState<ReadonlySet<CollabSectionId>>(
    () => new Set(),
  )
  const drafts = useRef(withDraft)
  useLayoutEffect(() => {
    drafts.current = withDraft
  }, [withDraft])
  const [newNoteOpen, setNewNoteOpen] = useState(false)
  const [newPollOpen, setNewPollOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const wrappers = useRef<Partial<Record<CollabSectionId, HTMLElement>>>({})
  const previous = useRef(data.sections)
  const previousVisible = useRef<ReadonlyArray<CollabSectionId>>([])
  const focused = useRef<CollabSectionId | null>(null)
  const visible = visibleCollabSections(data.sections, withDraft)
  const visibleKey = visible.join(',')
  const storedKey = COLLAB_SECTIONS.map(({ id }) =>
    Number(data.sections[id]),
  ).join(',')
  const split = collabLayout(visible) === 'split'
  const hidden = COLLAB_SECTIONS.some(({ id }) => !data.sections[id])

  const dirty = useCallback((id: CollabSectionId, value: boolean) => {
    setWithDraft((current) => {
      if (current.has(id) === value) return current
      const next = new Set(current)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])
  const conversationDirty = useCallback(
    (value: boolean) => dirty('conversation', value),
    [dirty],
  )
  const notesDirty = useCallback(
    (value: boolean) => dirty('notes', value),
    [dirty],
  )
  const pollsDirty = useCallback(
    (value: boolean) => dirty('polls', value),
    [dirty],
  )

  useLayoutEffect(() => {
    const changed = COLLAB_SECTIONS.some(
      ({ id }) => previous.current[id] !== data.sections[id],
    )
    previous.current = data.sections
    if (!changed) return
    setAnnouncement('')
    if (ownWrite.current) return
    const kept = COLLAB_SECTIONS.some(
      ({ id }) => !data.sections[id] && drafts.current.has(id),
    )
    const timer = setTimeout(() => {
      const stillKept = COLLAB_SECTIONS.some(
        ({ id }) => !data.sections[id] && drafts.current.has(id),
      )
      if (kept && !stillKept) return
      setAnnouncement(
        t(
          stillKept
            ? 'trips.collab.sections.turnedOff'
            : 'trips.collab.sections.changed',
        ),
      )
    }, 50)
    return () => clearTimeout(timer)
  }, [storedKey, ownWrite, t])

  useLayoutEffect(() => {
    const leaving = previousVisible.current.filter(
      (id) => !visible.includes(id),
    )
    previousVisible.current = visible
    if (leaving.length === 0) return
    setAnnouncement('')
    const active = document.activeElement
    if (
      active !== document.body &&
      !leaving.includes(focused.current as CollabSectionId)
    )
      return
    // Run after portal close autofocus as well as after the leaving wrapper unmounts.
    const timer = setTimeout(() => {
      const target = visible[0]
      if (target !== undefined) wrappers.current[target]?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [visibleKey])

  function section(id: CollabSectionId, content: ReactNode) {
    if (!visible.includes(id)) return null
    const heading = `${baseId}-${id}`
    return (
      <section
        key={id}
        ref={(node) => {
          if (node) wrappers.current[id] = node
          else delete wrappers.current[id]
        }}
        tabIndex={-1}
        aria-labelledby={heading}
        className={cn(
          'min-w-0 focus-ring',
          id === 'conversation' && [
            'xl:sticky xl:self-start',
            TRIP_RAIL_STICKY_CLASS,
          ],
        )}
        onFocusCapture={() => {
          focused.current = id
        }}
        onBlurCapture={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            focused.current = null
        }}
      >
        {!data.sections[id] ? (
          <p className="mb-3 text-caption text-ink-3">
            {t('trips.collab.sections.turnedOff')}
          </p>
        ) : null}
        <h2 id={heading} className="sr-only">
          {t(COLLAB_SECTION_PRESENTATION[id].label)}
        </h2>
        {content}
      </section>
    )
  }

  return (
    <>
      {hidden ? (
        <p className="text-caption text-ink-3">
          {t('trips.collab.sections.someHidden')}
        </p>
      ) : null}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      <div
        className={cn(
          'grid gap-6 xl:gap-8',
          split ? 'xl:grid-cols-[24rem_minmax(0,1fr)]' : 'grid-cols-1',
        )}
      >
        {section(
          'conversation',
          <ModulePanel
            label={t('trips.collab.conversation')}
            count={
              data.messages.length === 0
                ? undefined
                : new Intl.NumberFormat(locale).format(data.messages.length)
            }
            className={cn(
              'xl:sticky xl:max-h-[calc(100svh-var(--impersonation-h)-var(--nav-h)-1px-var(--subnav-h)-1px-12rem)]',
              TRIP_RAIL_STICKY_CLASS,
            )}
            bodyClassName="flex min-h-0 flex-col px-5 py-3"
          >
            <Thread
              key={tripId}
              tripId={tripId}
              messages={data.messages}
              people={data.people}
              viewerUserId={data.viewerUserId}
              canModerate={canModerate}
              timeZone={data.timeZone}
              onDirtyChange={conversationDirty}
              turnedOff={!data.sections.conversation}
            />
          </ModulePanel>,
        )}
        <div
          hidden={!visible.includes('notes') && !visible.includes('polls')}
          className="flex min-w-0 flex-col gap-6"
        >
          {section(
            'notes',
            <NotesBoard
              tripId={tripId}
              notes={data.notes}
              people={data.people}
              newNoteOpen={newNoteOpen}
              onNewNoteOpenChange={setNewNoteOpen}
              onDirtyChange={notesDirty}
              turnedOff={!data.sections.notes}
            />,
          )}
          {section(
            'polls',
            <PollsBoard
              tripId={tripId}
              polls={data.polls}
              viewerUserId={data.viewerUserId}
              newPollOpen={newPollOpen}
              onNewPollOpenChange={setNewPollOpen}
              onDirtyChange={pollsDirty}
              turnedOff={!data.sections.polls}
            />,
          )}
        </div>
      </div>
    </>
  )
}
