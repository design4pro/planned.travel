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

import { Badge, Button, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  castVoteFn,
  closePollFn,
  deleteNoteFn,
  deletePollFn,
  updateNoteFn,
} from '#/server/fns/collab'
import {
  ConfirmDialog,
  FilterRow,
  ModulePanel,
  RowMenu,
  useAction,
  useOptimistic,
} from '../shared'
import { NoteDialog, PollDialog } from './collab-dialogs'

import type { ReactNode } from 'react'
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

function nameFor(people: ReadonlyArray<CollabPerson>, userId: string): string {
  return (
    people.find((person) => person.userId === userId)?.name ??
    'Removed traveller'
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
  const [editing, setEditing] = useState<NoteData | null>(null)
  const [category, setCategory] = useState<string>('all')
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const pins = useOptimistic<boolean>()

  const save = useAction(updateNoteFn, {
    failure: 'That did not save',
  })
  const remove = useAction(deleteNoteFn, {
    success: 'Note removed',
    failure: 'The note was not removed',
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
      label="Notes"
      count={notes.length === 0 ? undefined : String(notes.length)}
      action={
        <Button
          variant="primary"
          size="sm"
          shape="pill"
          onClick={() => onNewNoteOpenChange(true)}
        >
          <Plus aria-hidden strokeWidth={2.5} />
          New note
        </Button>
      }
      toolbar={
        categories.length < 2 ? undefined : (
          <FilterRow>
            <BoardChip
              selected={category === 'all'}
              count={notes.length}
              onClick={() => setCategory('all')}
            >
              Everything
            </BoardChip>
            {categories.map(([value, count]) => (
              <BoardChip
                key={value}
                selected={category === value}
                count={count}
                onClick={() => setCategory(value)}
              >
                {value}
              </BoardChip>
            ))}
          </FilterRow>
        )
      }
    >
      {notes.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<StickyNote />}
          title="No shared notes"
          description="Restaurant recommendations, visa rules, the code for the front door — anything the whole trip needs to remember."
          action={
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={() => onNewNoteOpenChange(true)}
            >
              Write the first note
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
                style={
                  note.colour === null
                    ? undefined
                    : { borderLeftColor: note.colour, borderLeftWidth: '3px' }
                }
              >
                <div className="flex min-w-0 items-start gap-2">
                  <h4 className="min-w-0 flex-1 text-label font-semibold text-ink">
                    {note.title}
                  </h4>
                  {note.isPinned ? (
                    <Badge tone="warning" size="sm" className="shrink-0">
                      Pinned
                    </Badge>
                  ) : null}
                  <RowMenu
                    label={`Actions for ${note.title}`}
                    size="xs"
                    items={[
                      {
                        label: 'Edit note…',
                        icon: <Pencil aria-hidden />,
                        onSelect: () => setEditing(note),
                      },
                      {
                        label: note.isPinned ? 'Unpin' : 'Pin to the top',
                        icon: note.isPinned ? (
                          <PinOff aria-hidden />
                        ) : (
                          <Pin aria-hidden />
                        ),
                        onSelect: () => togglePin(note),
                      },
                      {
                        label: 'Remove note',
                        icon: <Trash2 aria-hidden />,
                        tone: 'danger',
                        separated: true,
                        onSelect: () =>
                          setConfirm({
                            title: `Remove “${note.title}”?`,
                            description:
                              'The note comes off the board for everyone on the trip.',
                            confirmLabel: 'Remove note',
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
                  {nameFor(people, note.createdBy)} ·{' '}
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
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  /** Keyed `pollId:optionId` — the viewer's own in-flight choice per option. */
  const votes = useOptimistic<boolean>()

  const vote = useAction(castVoteFn, {
    failure: 'Your vote did not save',
    fallback: 'The tally is unchanged.',
  })
  const close = useAction(closePollFn, {
    success: 'Poll closed',
    failure: 'The poll was not closed',
  })
  const remove = useAction(deletePollFn, {
    success: 'Poll removed',
    failure: 'The poll was not removed',
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
      label="Polls"
      count={polls.length === 0 ? undefined : String(polls.length)}
      action={
        <Button
          variant="primary"
          size="sm"
          shape="pill"
          onClick={() => onNewPollOpenChange(true)}
        >
          <Plus aria-hidden strokeWidth={2.5} />
          New poll
        </Button>
      }
    >
      {polls.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Vote />}
          title="No polls open"
          description="When the group cannot agree on a restaurant, put it to a vote and let the answer settle itself."
          action={
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={() => onNewPollOpenChange(true)}
            >
              Ask the group
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
                  <h4 className="min-w-0 flex-1 text-label font-semibold text-ink">
                    {poll.question}
                  </h4>
                  <span className="shrink-0 text-caption tabular-nums text-ink-4">
                    {total} vote{total === 1 ? '' : 's'}
                  </span>
                  {poll.isClosed ? (
                    <Badge tone="neutral" size="sm">
                      Closed
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm" dot>
                      Open
                    </Badge>
                  )}
                  {poll.allowMultiple ? (
                    <Badge tone="outline" size="sm">
                      Pick several
                    </Badge>
                  ) : null}
                  <RowMenu
                    label={`Actions for the poll “${poll.question}”`}
                    size="xs"
                    items={[
                      {
                        label: 'Close the poll',
                        icon: <Lock aria-hidden />,
                        disabled: poll.isClosed,
                        onSelect: () => {
                          void close.run({ data: { tripId, pollId: poll.id } })
                        },
                      },
                      {
                        label: 'Remove poll',
                        icon: <Trash2 aria-hidden />,
                        tone: 'danger',
                        separated: true,
                        onSelect: () =>
                          setConfirm({
                            title: 'Remove this poll?',
                            description: `“${poll.question}” and its ${total} vote${total === 1 ? '' : 's'} are removed for everyone.`,
                            confirmLabel: 'Remove poll',
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
                          aria-label={`${row.label} — ${row.votes} of ${total} vote${total === 1 ? '' : 's'}${row.mine ? ', including yours' : ''}`}
                          disabled={poll.isClosed || vote.pending}
                          onClick={() => castVote(poll, row.optionId, row.mine)}
                          className={cn(
                            'group/option w-full rounded-lg border px-3 py-2 text-left focus-ring',
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
                                Leading
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

function BoardChip({
  selected,
  count,
  onClick,
  children,
}: {
  selected: boolean
  count: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-caption font-semibold whitespace-nowrap focus-ring',
        'transition-[background-color,border-color,color] duration-base ease-out-quint',
        selected
          ? 'border-transparent bg-accent text-accent-on'
          : 'border-edge bg-surface text-ink-2 hover:border-edge-strong hover:text-ink',
      )}
    >
      {children}
      <span
        className={cn(
          'rounded-full px-1.5 text-[0.6875rem] leading-4 tabular-nums',
          selected ? 'bg-current/15' : 'bg-surface-2 text-ink-4',
        )}
      >
        {count}
      </span>
    </button>
  )
}
