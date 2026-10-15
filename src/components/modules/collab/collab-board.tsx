/**
 * The notes board and the poll board.
 *
 * Both were read-only renderings before: a note you could see but not write, and a
 * poll with a result you could not affect. Now a note can be created, edited,
 * pinned and removed, and a poll option is a button that casts, moves or withdraws
 * your vote — optimistically, so a tap is instant, and rolled back if the server
 * disagrees.
 */
import { useMemo, useState } from 'react'
import {
  Check,
  Lock,
  Pencil,
  Pin,
  PinOff,
  Plus,
  StickyNote,
  Trash2,
  Vote,
} from 'lucide-react'

import { Badge, Button, Chip, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import { paintFor } from '#/lib/swatches'
import { useTranslate } from '#/lib/i18n'

import type { Translate } from '#/lib/i18n'
import { deleteNoteFn, updateNoteFn } from '#/server/fns/collab-notes'
import {
  castVoteFn,
  closePollFn,
  deletePollFn,
} from '#/server/fns/collab-polls'
import {
  ConfirmDialog,
  FilterRow,
  ModulePanel,
  RowMenu,
  useAction,
  useOptimistic,
} from '../shared'
import { NoteDialog, PollDialog } from './collab-dialogs'

import type { ConfirmRequest } from '../shared'
import type { CollabPerson, NoteData, PollData } from './types'

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

/* ------------------------------------------------------------------- notes */

export function NotesBoard({
  tripId,
  notes,
  people,
  newNoteOpen,
  onNewNoteOpenChange,
}: {
  tripId: string
  notes: ReadonlyArray<NoteData>
  people: ReadonlyArray<CollabPerson>
  newNoteOpen: boolean
  onNewNoteOpenChange: (open: boolean) => void
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState<NoteData | null>(null)
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

/* ------------------------------------------------------------------- polls */

export function PollsBoard({
  tripId,
  polls,
  viewerUserId,
  newPollOpen,
  onNewPollOpenChange,
}: {
  tripId: string
  polls: ReadonlyArray<PollData>
  viewerUserId: string
  newPollOpen: boolean
  onNewPollOpenChange: (open: boolean) => void
}) {
  const t = useTranslate()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  /** Keyed `pollId:optionId` — the viewer's own in-flight choice per option. */
  const votes = useOptimistic<boolean>()

  const vote = useAction(castVoteFn, {
    failure: t('modules.collab.poll.toast.voteFailed'),
    fallback: t('modules.collab.poll.toast.voteFailedBody'),
  })
  const close = useAction(closePollFn, {
    success: t('modules.collab.poll.toast.closed'),
    failure: t('modules.collab.poll.toast.closeFailed'),
  })
  const remove = useAction(deletePollFn, {
    success: t('modules.collab.poll.toast.removed'),
    failure: t('modules.collab.poll.toast.removeFailed'),
    onSuccess: () => setConfirm(null),
  })

  function castVote(poll: PollData, optionId: string, mine: boolean): void {
    if (poll.isClosed) {
      return
    }
    const key = `${poll.id}:${optionId}`
    // A single-choice poll moves the vote, so the option being left has to be
    // painted as well as the one being taken.
    const entries: Array<readonly [string, boolean]> = [[key, !mine]]
    if (!poll.allowMultiple && !mine) {
      for (const row of poll.tally) {
        if (row.optionId !== optionId && row.userIds.includes(viewerUserId)) {
          entries.push([`${poll.id}:${row.optionId}`, false])
        }
      }
    }

    void votes.claim(entries, () =>
      vote.run({ data: { tripId, pollId: poll.id, optionId } }),
    )
  }

  return (
    <ModulePanel
      label={t('modules.collab.polls.heading')}
      count={polls.length === 0 ? undefined : String(polls.length)}
      action={
        <Button
          variant="primary"
          size="sm"
          shape="pill"
          onClick={() => onNewPollOpenChange(true)}
        >
          <Plus aria-hidden strokeWidth={2.5} />
          {t('modules.collab.poll.dialog.addTitle')}
        </Button>
      }
    >
      {polls.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Vote />}
          title={t('modules.collab.polls.empty.title')}
          description={t('modules.collab.polls.empty.body')}
          action={
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={() => onNewPollOpenChange(true)}
            >
              {t('modules.collab.polls.empty.action')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-6">
          {polls.map((poll) => {
            // Recomputed from the overlay, so a tap moves the bar immediately.
            const rows = poll.tally.map((row) => {
              const wasMine = row.userIds.includes(viewerUserId)
              const claimed = votes.get(`${poll.id}:${row.optionId}`)
              const nowMine = claimed ?? wasMine
              const delta = (nowMine ? 1 : 0) - (wasMine ? 1 : 0)
              return {
                ...row,
                mine: nowMine,
                votes: Math.max(row.votes + delta, 0),
              }
            })
            const total = rows.reduce((sum, row) => sum + row.votes, 0)
            const leader = Math.max(...rows.map((row) => row.votes), 0)

            return (
              <li key={poll.id} className="min-w-0">
                <div className="mb-2.5 flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h3 className="min-w-0 flex-1 text-label font-semibold text-ink">
                    {poll.question}
                  </h3>
                  <span className="shrink-0 text-caption tabular-nums text-ink-4">
                    {t('modules.collab.poll.voteCount', { count: total })}
                  </span>
                  {poll.isClosed ? (
                    <Badge tone="neutral" size="sm">
                      {t('modules.collab.badge.closed')}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm" dot>
                      {t('modules.collab.badge.open')}
                    </Badge>
                  )}
                  {poll.allowMultiple ? (
                    <Badge tone="outline" size="sm">
                      {t('modules.collab.badge.multi')}
                    </Badge>
                  ) : null}
                  <RowMenu
                    label={t('modules.collab.poll.actionsFor', {
                      question: poll.question,
                    })}
                    size="sm"
                    items={[
                      {
                        label: t('modules.collab.poll.menu.close'),
                        icon: <Lock aria-hidden />,
                        disabled: poll.isClosed,
                        onSelect: () => {
                          void close.run({ data: { tripId, pollId: poll.id } })
                        },
                      },
                      {
                        label: t('modules.collab.poll.remove'),
                        icon: <Trash2 aria-hidden />,
                        tone: 'danger',
                        separated: true,
                        onSelect: () =>
                          setConfirm({
                            title: t('modules.collab.poll.removeTitle'),
                            description: t('modules.collab.poll.removeBody', {
                              question: poll.question,
                              count: total,
                            }),
                            confirmLabel: t('modules.collab.poll.remove'),
                            onConfirm: () =>
                              remove.run({ data: { tripId, pollId: poll.id } }),
                          }),
                      },
                    ]}
                  />
                </div>

                <ul className="flex flex-col gap-2">
                  {rows.map((row) => {
                    const share = total === 0 ? 0 : row.votes / total
                    const winning = row.votes > 0 && row.votes === leader
                    return (
                      <li key={row.optionId}>
                        <button
                          type="button"
                          aria-pressed={row.mine}
                          aria-label={t(
                            row.mine
                              ? 'modules.collab.poll.resultMine'
                              : 'modules.collab.poll.result',
                            {
                              label: row.label,
                              votes: row.votes,
                              count: total,
                            },
                          )}
                          disabled={poll.isClosed || vote.pending}
                          onClick={() => castVote(poll, row.optionId, row.mine)}
                          className={cn(
                            'group/option w-full rounded-lg border px-3 py-2 text-start focus-ring',
                            'transition-[border-color,background-color] duration-base ease-out-quint',
                            row.mine
                              ? 'border-brand bg-brand-subtle'
                              : 'border-edge-faint bg-surface-2/50 hover:border-edge-strong',
                            poll.isClosed && 'cursor-default opacity-90',
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className={cn(
                                'grid size-4.5 shrink-0 place-items-center rounded-full border',
                                row.mine
                                  ? 'border-brand bg-brand text-brand-on'
                                  : 'border-edge-strong bg-surface',
                              )}
                            >
                              {row.mine ? (
                                <Check className="size-3" strokeWidth={3} />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-label text-ink">
                              {row.label}
                            </span>
                            {winning && total > 0 ? (
                              <Badge
                                tone="brand"
                                size="sm"
                                className="shrink-0"
                              >
                                {t('modules.collab.badge.leading')}
                              </Badge>
                            ) : null}
                            <span className="shrink-0 text-caption font-semibold tabular-nums text-ink-2">
                              {Math.round(share * 100)}%
                            </span>
                          </span>
                          {/* The tally bar is drawn with spans rather than the
                              `Progress` primitive: a button may only contain
                              phrasing content, and the count is already in the
                              button's accessible name. */}
                          <span
                            aria-hidden
                            className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-surface-inset"
                          >
                            <span
                              className={cn(
                                'block h-full rounded-full transition-[width] duration-slow ease-out-quint',
                                row.mine ? 'bg-brand' : 'bg-accent',
                              )}
                              style={{ width: `${share * 100}%` }}
                            />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      )}

      <PollDialog
        tripId={tripId}
        open={newPollOpen}
        onOpenChange={onNewPollOpenChange}
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
