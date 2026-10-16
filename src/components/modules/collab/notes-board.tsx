/** The notes board: a shared note can be created, edited, pinned and removed. */
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Pin, PinOff, Plus, StickyNote, Trash2 } from 'lucide-react'

import { Badge, Button, Chip, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import { paintFor } from '#/lib/swatches'
import { useTranslate } from '#/lib/i18n'

import type { Translate } from '#/lib/i18n'
import { deleteNoteFn, updateNoteFn } from '#/server/fns/collab-notes'
import {
  ConfirmDialog,
  FilterRow,
  ModulePanel,
  RowMenu,
  useAction,
  useOptimistic,
} from '../shared'
import { NoteDialog } from './note-dialog'

import type { ConfirmRequest } from '../shared'
import type { CollabPerson, NoteData } from './types'

const LOCALE = 'en-GB'
const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
})

function formatWhen(iso: string): string {
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? '' : dateFormatter.format(parsed)
}

function nameFor(
  people: ReadonlyArray<CollabPerson>,
  userId: string,
  t: Translate,
): string {
  return (
    people.find((person) => person.userId === userId)?.name ??
    t('costs.person.removed')
  )
}

export function NotesBoard({
  tripId,
  notes,
  people,
  newNoteOpen,
  onNewNoteOpenChange,
  onDirtyChange,
  turnedOff = false,
}: {
  tripId: string
  notes: ReadonlyArray<NoteData>
  people: ReadonlyArray<CollabPerson>
  newNoteOpen: boolean
  onNewNoteOpenChange: (open: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
  turnedOff?: boolean
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState<NoteData | null>(null)
  useEffect(() => {
    onDirtyChange?.(newNoteOpen || editing !== null)
  }, [newNoteOpen, editing, onDirtyChange])
  const [category, setCategory] = useState<string>('all')
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const pins = useOptimistic<boolean>()

  const save = useAction(updateNoteFn, {
    failure: t('modules.form.saveError'),
  })
  const remove = useAction(deleteNoteFn, {
    success: t('modules.collab.toast.noteRemoved'),
    failure: t('modules.collab.toast.noteRemoveFailed'),
    onSuccess: () => setConfirm(null),
  })

  const categories = useMemo(() => {
    const tally = new Map<string, number>()
    for (const note of notes) {
      const key = note.category?.trim() ?? ''
      if (key.length > 0) {
        tally.set(key, (tally.get(key) ?? 0) + 1)
      }
    }
    return [...tally.entries()].sort((left, right) =>
      left[0].localeCompare(right[0], LOCALE),
    )
  }, [notes])

  const rendered = useMemo(
    () =>
      notes.map((note) => {
        const claimed = pins.get(note.id)
        return claimed === undefined ? note : { ...note, isPinned: claimed }
      }),
    [notes, pins],
  )

  const visible = rendered
    .filter((note) => category === 'all' || note.category === category)
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1
      }
      return right.createdAt.localeCompare(left.createdAt)
    })

  function togglePin(note: NoteData): void {
    const next = !note.isPinned
    void pins.claim([[note.id, next]], () =>
      save.run({
        data: {
          tripId,
          noteId: note.id,
          title: note.title,
          body: note.body ?? '',
          category: note.category ?? '',
          colour: note.colour ?? '',
          isPinned: next,
        },
      }),
    )
  }

  return (
    <ModulePanel
      label={t('modules.field.notes')}
      count={notes.length === 0 ? undefined : String(notes.length)}
      action={
        <Button
          variant="primary"
          size="sm"
          shape="pill"
          onClick={() => onNewNoteOpenChange(true)}
        >
          <Plus aria-hidden strokeWidth={2.5} />
          {t('modules.collab.note.new')}
        </Button>
      }
      toolbar={
        categories.length < 2 ? undefined : (
          <FilterRow>
            <Chip
              selected={category === 'all'}
              count={notes.length}
              onClick={() => setCategory('all')}
            >
              {t('modules.filter.all')}
            </Chip>
            {categories.map(([value, count]) => (
              <Chip
                key={value}
                selected={category === value}
                count={count}
                onClick={() => setCategory(value)}
              >
                {value}
              </Chip>
            ))}
          </FilterRow>
        )
      }
    >
      {notes.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<StickyNote />}
          title={t('modules.collab.notes.empty.title')}
          description={t('modules.collab.notes.empty.body')}
          action={
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={() => onNewNoteOpenChange(true)}
            >
              {t('modules.collab.notes.empty.action')}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((note) => (
            <li key={note.id} className="min-w-0 only:sm:col-span-2">
              <article
                className={cn(
                  'flex h-full min-w-0 flex-col gap-2 rounded-lg border border-edge-faint bg-surface-2/60 p-4',
                  'transition-[border-color,box-shadow] duration-base ease-out-quint hover:border-edge-strong',
                )}
              >
                <div className="flex min-w-0 items-start gap-2">
                  {/* The colour used to be a 3px slab down the card's left
                      edge. It made a filed note louder than a pinned one, it
                      shifted the text two pixels against its uncoloured
                      neighbours in the same grid, and on hover three sides went
                      to `edge-strong` while the fourth stayed. A dot says the
                      same thing without touching the box — and it is the device
                      the lists board already uses for the very same field, so
                      the colour now means one thing in both places. */}
                  {note.colour === null ? null : (
                    <span
                      aria-hidden
                      className="mt-1 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: paintFor(note.colour) }}
                    />
                  )}
                  <h3 className="min-w-0 flex-1 text-label font-semibold text-ink">
                    {note.title}
                  </h3>
                  {note.isPinned ? (
                    <Badge tone="warning" size="sm" className="shrink-0">
                      {t('modules.collab.badge.pinned')}
                    </Badge>
                  ) : null}
                  <RowMenu
                    label={t('modules.actionsFor', { name: note.title })}
                    size="sm"
                    items={[
                      {
                        label: t('modules.collab.note.menu.edit'),
                        icon: <Pencil aria-hidden />,
                        onSelect: () => setEditing(note),
                      },
                      {
                        label: t(
                          note.isPinned
                            ? 'modules.collab.note.menu.unpin'
                            : 'modules.collab.note.menu.pin',
                        ),
                        icon: note.isPinned ? (
                          <PinOff aria-hidden />
                        ) : (
                          <Pin aria-hidden />
                        ),
                        onSelect: () => togglePin(note),
                      },
                      {
                        label: t('modules.collab.note.remove'),
                        icon: <Trash2 aria-hidden />,
                        tone: 'danger',
                        separated: true,
                        onSelect: () =>
                          setConfirm({
                            title: t('modules.remove.confirmTitle', {
                              name: note.title,
                            }),
                            description: t('modules.collab.note.removeBody'),
                            confirmLabel: t('modules.collab.note.remove'),
                            onConfirm: () =>
                              remove.run({ data: { tripId, noteId: note.id } }),
                          }),
                      },
                    ]}
                  />
                </div>

                {note.category === null ? null : (
                  <Badge tone="outline" size="sm" className="self-start">
                    {note.category}
                  </Badge>
                )}

                {note.body === null || note.body.length === 0 ? null : (
                  <p className="text-caption leading-relaxed whitespace-pre-line text-ink-2">
                    {note.body}
                  </p>
                )}

                <p className="mt-auto pt-1 text-caption text-ink-4">
                  {nameFor(people, note.createdBy, t)} ·{' '}
                  {formatWhen(note.createdAt)}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      <NoteDialog
        turnedOff={turnedOff}
        tripId={tripId}
        note={editing ?? undefined}
        categories={categories.map(([value]) => value)}
        open={newNoteOpen || editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null)
            onNewNoteOpenChange(false)
          }
        }}
      />

      <ConfirmDialog
        request={confirm}
        pending={remove.pending}
        onOpenChange={(next) => {
          if (!next) {
            setConfirm(null)
          }
        }}
      />
    </ModulePanel>
  )
}
