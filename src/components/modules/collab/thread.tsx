/**
 * The trip's conversation.
 *
 * A thread you can read but not answer is a screenshot of a product. This one
 * sends, replies, reacts, edits and deletes, and it does the small things that make
 * a transcript readable: consecutive messages from one person share an avatar and a
 * name, the day changes are marked, and the reactions sit under the bubble they
 * belong to rather than beside the timestamp.
 *
 * Reactions are optimistic — a tap on an emoji has to feel like nothing at all —
 * and roll back through the same claim/settle overlay every other tick uses.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, SendHorizontal, SmilePlus, Trash2, X } from 'lucide-react'

import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
  Tooltip,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'

import type { Translate } from '#/lib/i18n'
import { dayKeyIn, todayKeyIn } from '#/lib/time'
import {
  deleteMessageFn,
  editMessageFn,
  postMessageFn,
  toggleReactionFn,
} from '#/server/fns/collab-thread'
import { ConfirmDialog, RowMenu, useAction, useOptimistic } from '../shared'

import type { ConfirmRequest } from '../shared'
import type { CollabPerson, MessageData } from './types'

const MAX_LENGTH = 4000

/** The reactions a travel thread actually uses. Six, not an emoji keyboard. */
const REACTIONS: ReadonlyArray<{ emoji: string; label: string }> = [
  { emoji: '👍', label: 'modules.collab.reaction.agree' },
  { emoji: '❤️', label: 'modules.collab.reaction.love' },
  { emoji: '😂', label: 'modules.collab.reaction.funny' },
  { emoji: '🎉', label: 'modules.collab.reaction.celebrate' },
  { emoji: '🙏', label: 'modules.collab.reaction.thanks' },
  { emoji: '👀', label: 'modules.collab.reaction.looking' },
]

const LOCALE = 'en-GB'

/**
 * Both formatters are pinned to the trip's zone rather than the machine's.
 *
 * Without an explicit `timeZone` the same message reads `14:00` in the server's
 * HTML and `23:00` after hydration, which React reports as a mismatch and
 * recovers from by discarding the whole transcript. Pinning also makes the
 * transcript mean one thing: every time in it is destination wall-clock time, so
 * two travellers in two countries read the same number for the same plan.
 */
function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

function clockFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDayHeading(
  iso: string,
  todayKey: string,
  timeZone: string,
  t: Translate,
): string {
  const key = dayKeyIn(iso, timeZone)
  if (key === todayKey) {
    return t('modules.collab.thread.today')
  }
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime())
    ? key
    : dayFormatter(timeZone).format(parsed)
}

function formatClock(iso: string, timeZone: string): string {
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime())
    ? ''
    : clockFormatter(timeZone).format(parsed)
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

function imageFor(
  people: ReadonlyArray<CollabPerson>,
  userId: string,
): string | null {
  return people.find((person) => person.userId === userId)?.image ?? null
}

/* ------------------------------------------------------------------- thread */

export interface ThreadProps {
  readonly tripId: string
  readonly messages: ReadonlyArray<MessageData>
  readonly people: ReadonlyArray<CollabPerson>
  readonly viewerUserId: string
  /** `true` when the viewer may delete other people's messages. */
  readonly canModerate: boolean
  /** IANA zone every timestamp in the transcript is read in. */
  readonly timeZone: string
}

export function Thread({
  tripId,
  messages,
  people,
  viewerUserId,
  canModerate,
  timeZone,
}: ThreadProps) {
  const [replyTo, setReplyTo] = useState<MessageData | null>(null)
  const t = useTranslate()
  const [editing, setEditing] = useState<MessageData | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const lastId = messages.at(-1)?.id ?? null

  /**
   * A transcript that does not follow the conversation is a transcript nobody
   * reads. Scrolls the newest message into view whenever one arrives — including
   * one that arrived over the socket rather than from this tab.
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [lastId])

  const reactionOverlay = useOptimistic<ReadonlyArray<string>>()

  const toggle = useAction(toggleReactionFn, {
    failure: t('modules.collab.toast.reactionFailed'),
  })
  const remove = useAction(deleteMessageFn, {
    success: t('modules.collab.toast.messageDeleted'),
    failure: t('modules.collab.toast.deleteFailed'),
    onSuccess: () => setConfirm(null),
  })

  const todayKey = useMemo(() => todayKeyIn(timeZone), [timeZone])
  const byId = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  )

  function react(message: MessageData, emoji: string): void {
    const current = message.reactions
      .filter((entry) => entry.userIds.includes(viewerUserId))
      .map((entry) => entry.emoji)
    const claimed = reactionOverlay.get(message.id) ?? current
    const next = claimed.includes(emoji)
      ? claimed.filter((entry) => entry !== emoji)
      : [...claimed, emoji]

    void reactionOverlay.claim([[message.id, next]], () =>
      toggle.run({ data: { tripId, messageId: message.id, emoji } }),
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        {messages.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<SendHorizontal />}
            title={t('modules.collab.thread.empty')}
            description="Everyone on this trip shares one thread. Decisions made here stay with the trip rather than scattering across group chats."
          />
        ) : (
          <ol className="flex flex-col gap-1 py-1">
            {messages.map((message, index) => {
              const previous = index === 0 ? null : messages[index - 1]
              const newDay =
                previous === null ||
                dayKeyIn(previous.createdAt, timeZone) !==
                  dayKeyIn(message.createdAt, timeZone)
              const runs =
                previous !== null &&
                !newDay &&
                previous.userId === message.userId
              const mine = message.userId === viewerUserId
              const claimed = reactionOverlay.get(message.id)

              return (
                <li key={message.id} className="min-w-0">
                  {newDay ? (
                    <div className="flex items-center gap-3 py-3">
                      <span aria-hidden className="h-px flex-1 bg-edge-faint" />
                      <span className="shrink-0 text-micro font-semibold tracking-label text-ink-4 uppercase">
                        {formatDayHeading(
                          message.createdAt,
                          todayKey,
                          timeZone,
                          t,
                        )}
                      </span>
                      <span aria-hidden className="h-px flex-1 bg-edge-faint" />
                    </div>
                  ) : null}

                  <MessageRow
                    timeZone={timeZone}
                    message={message}
                    replyTarget={
                      message.replyToId === null
                        ? undefined
                        : byId.get(message.replyToId)
                    }
                    people={people}
                    viewerUserId={viewerUserId}
                    mine={mine}
                    runs={runs}
                    myReactions={
                      claimed ??
                      message.reactions
                        .filter((entry) => entry.userIds.includes(viewerUserId))
                        .map((entry) => entry.emoji)
                    }
                    optimistic={claimed !== undefined}
                    canDelete={mine || canModerate}
                    onReact={(emoji) => react(message, emoji)}
                    onReply={() => setReplyTo(message)}
                    onEdit={() => setEditing(message)}
                    onDelete={() =>
                      setConfirm({
                        title: t('modules.collab.message.deleteTitle'),
                        description: t('modules.collab.message.deleteBody'),
                        confirmLabel: t('modules.collab.message.delete'),
                        onConfirm: () =>
                          remove.run({
                            data: { tripId, messageId: message.id },
                          }),
                      })
                    }
                  />
                </li>
              )
            })}
          </ol>
        )}
        <div ref={bottomRef} aria-hidden />
      </div>

      <Composer
        tripId={tripId}
        replyTo={replyTo}
        editing={editing}
        people={people}
        onClearReply={() => setReplyTo(null)}
        onClearEditing={() => setEditing(null)}
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
    </div>
  )
}

/* ---------------------------------------------------------------- one row */

function MessageRow({
  timeZone,
  message,
  replyTarget,
  people,
  viewerUserId,
  mine,
  runs,
  myReactions,
  optimistic,
  canDelete,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: {
  timeZone: string
  message: MessageData
  replyTarget: MessageData | undefined
  people: ReadonlyArray<CollabPerson>
  viewerUserId: string
  mine: boolean
  runs: boolean
  myReactions: ReadonlyArray<string>
  optimistic: boolean
  canDelete: boolean
  onReact: (emoji: string) => void
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useTranslate()
  const name = nameFor(people, message.userId, t)

  /**
   * The tallies, with the viewer's own claim folded in — so a tap changes the
   * count under the bubble immediately rather than after the round trip. The
   * viewer's vote is applied as a delta against what the server last said, which
   * is what keeps other people's counts untouched.
   */
  const tallies = useMemo(() => {
    const rows = new Map<
      string,
      { emoji: string; count: number; mine: boolean }
    >()

    for (const entry of message.reactions) {
      const wasMine = entry.userIds.includes(viewerUserId)
      const nowMine = myReactions.includes(entry.emoji)
      const delta = (nowMine ? 1 : 0) - (wasMine ? 1 : 0)
      rows.set(entry.emoji, {
        emoji: entry.emoji,
        count: entry.count + delta,
        mine: nowMine,
      })
    }

    for (const emoji of myReactions) {
      if (!rows.has(emoji)) {
        rows.set(emoji, { emoji, count: 1, mine: true })
      }
    }

    return [...rows.values()].filter((row) => row.count > 0)
  }, [message.reactions, myReactions, viewerUserId])

  return (
    <div
      className={cn(
        'group/message flex min-w-0 gap-2.5',
        mine && 'flex-row-reverse',
      )}
    >
      <span className="w-6 shrink-0 self-end">
        {runs ? null : (
          <Avatar
            name={name}
            src={imageFor(people, message.userId)}
            size="sm"
          />
        )}
      </span>

      <div className={cn('flex min-w-0 flex-col gap-1', mine && 'items-end')}>
        {runs || mine ? null : (
          <p className="px-1 text-caption font-medium text-ink-3">{name}</p>
        )}

        {replyTarget === undefined ? null : (
          <p
            className={cn(
              'max-w-[18rem] truncate rounded-md border-s px-2 py-1 text-caption text-ink-3',
              mine
                ? 'border-brand/40 bg-brand-subtle/60'
                : 'border-edge-strong bg-surface-2/70',
            )}
          >
            <span className="font-semibold">
              {nameFor(people, replyTarget.userId, t)}
            </span>
            {': '}
            {replyTarget.body}
          </p>
        )}

        <div className={cn('flex items-end gap-1', mine && 'flex-row-reverse')}>
          <div
            className={cn(
              'max-w-[18rem] rounded-lg px-3 py-2 text-label leading-relaxed break-words sm:max-w-[22rem]',
              mine
                ? 'rounded-ee-sm bg-brand text-brand-on'
                : 'rounded-es-sm bg-surface-2 text-ink',
            )}
          >
            {message.body}
          </div>

          {/* The row's own actions. Hidden until the row is hovered or something
              inside it has focus, so a long thread is quiet — but always in the tab
              order, so the keyboard never loses them. */}
          <span
            className={cn(
              'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-fast ease-out-quint',
              'group-hover/message:opacity-100 focus-within:opacity-100',
            )}
          >
            <ReactionPicker onPick={onReact} mine={myReactions} />
            <RowMenu
              label={t('modules.collab.message.actionsFor', { name })}
              size="sm"
              items={[
                {
                  label: 'Reply',
                  icon: <SendHorizontal aria-hidden />,
                  onSelect: onReply,
                },
                ...(mine
                  ? [
                      {
                        label: t('modules.collab.message.menuEdit'),
                        icon: <Pencil aria-hidden />,
                        onSelect: onEdit,
                      },
                    ]
                  : []),
                ...(canDelete
                  ? [
                      {
                        label: t('modules.collab.message.delete'),
                        icon: <Trash2 aria-hidden />,
                        tone: 'danger' as const,
                        separated: true,
                        onSelect: onDelete,
                      },
                    ]
                  : []),
              ]}
            />
          </span>
        </div>

        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5 px-1',
            mine && 'flex-row-reverse',
          )}
        >
          <span className="text-caption tabular-nums text-ink-4">
            {formatClock(message.createdAt, timeZone)}
          </span>
          {message.editedAt === null ? null : (
            <span className="text-caption text-ink-4">
              {t('modules.collab.message.edited')}
            </span>
          )}
          {tallies.map((row) => (
            <button
              key={row.emoji}
              type="button"
              aria-pressed={row.mine}
              aria-label={t(
                row.mine
                  ? 'modules.collab.reaction.tallyMine'
                  : 'modules.collab.reaction.tally',
                { emoji: row.emoji, count: row.count },
              )}
              onClick={() => onReact(row.emoji)}
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full border px-1.5 text-caption focus-ring',
                'transition-[background-color,border-color] duration-fast ease-out-quint',
                row.mine
                  ? 'border-brand/40 bg-brand-subtle text-brand'
                  : 'border-transparent bg-surface-2 text-ink-2 hover:border-edge-strong',
                optimistic && 'opacity-80',
              )}
            >
              <span aria-hidden>{row.emoji}</span>
              <span className="tabular-nums">{row.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReactionPicker({
  onPick,
  mine,
}: {
  onPick: (emoji: string) => void
  mine: ReadonlyArray<string>
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          variant="ghost"
          size="sm"
          label={t('modules.collab.message.react')}
          icon={<SmilePlus aria-hidden />}
        />
      </PopoverTrigger>
      <PopoverContent align="center" className="w-auto p-1.5">
        <div className="flex items-center gap-0.5">
          {REACTIONS.map((reaction) => (
            <Tooltip key={reaction.emoji} content={reaction.label}>
              <button
                type="button"
                aria-pressed={mine.includes(reaction.emoji)}
                aria-label={reaction.label}
                onClick={() => {
                  onPick(reaction.emoji)
                  setOpen(false)
                }}
                className={cn(
                  'grid size-8 place-items-center rounded-md text-body focus-ring',
                  'transition-[background-color,transform] duration-fast ease-out-quint',
                  'hover:scale-110 hover:bg-hover motion-reduce:hover:scale-100',
                  mine.includes(reaction.emoji) && 'bg-brand-subtle',
                )}
              >
                <span aria-hidden>{reaction.emoji}</span>
              </button>
            </Tooltip>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* --------------------------------------------------------------- composer */

function Composer({
  tripId,
  replyTo,
  editing,
  people,
  onClearReply,
  onClearEditing,
}: {
  tripId: string
  replyTo: MessageData | null
  editing: MessageData | null
  people: ReadonlyArray<CollabPerson>
  onClearReply: () => void
  onClearEditing: () => void
}) {
  const t = useTranslate()
  const [body, setBody] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  const post = useAction(postMessageFn, {
    failure: t('modules.collab.toast.notSent'),
    fallback: t('modules.collab.toast.notSentBody'),
  })
  const edit = useAction(editMessageFn, {
    success: t('modules.collab.toast.messageUpdated'),
    failure: t('modules.collab.toast.editFailed'),
  })
  const action = editing === null ? post : edit

  // Entering edit mode loads the message into the field and puts the caret in it.
  useEffect(() => {
    if (editing !== null) {
      setBody(editing.body)
      fieldRef.current?.focus()
    }
  }, [editing])

  useEffect(() => {
    if (replyTo !== null) {
      fieldRef.current?.focus()
    }
  }, [replyTo])

  const trimmed = body.trim()
  const canSend =
    trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !action.pending

  async function send(): Promise<void> {
    if (!canSend) {
      return
    }
    if (editing !== null) {
      const result = await edit.run({
        data: { tripId, messageId: editing.id, body: trimmed },
      })
      if (result !== null) {
        setBody('')
        onClearEditing()
      }
      return
    }
    const result = await post.run({
      data: { tripId, body: trimmed, replyToId: replyTo?.id ?? '' },
    })
    if (result !== null) {
      setBody('')
      onClearReply()
    }
  }

  function cancel(): void {
    setBody('')
    onClearEditing()
    onClearReply()
  }

  return (
    <div className="shrink-0 border-t border-edge-faint pt-3">
      {editing === null && replyTo === null ? null : (
        <div className="mb-2 flex min-w-0 items-center gap-2 rounded-md border-s border-brand bg-brand-subtle/60 px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate text-caption text-ink-2">
            <span className="font-semibold">
              {editing === null
                ? t('modules.collab.compose.replyingTo', {
                    name: nameFor(people, replyTo?.userId ?? '', t),
                  })
                : t('modules.collab.compose.editingYours')}
            </span>
            {' · '}
            {(editing ?? replyTo)?.body}
          </span>
          <IconButton
            variant="ghost"
            size="sm"
            label={t(
              editing === null
                ? 'modules.collab.compose.cancelReply'
                : 'modules.collab.compose.cancelEdit',
            )}
            icon={<X aria-hidden />}
            onClick={cancel}
          />
        </div>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            ref={fieldRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            // Enter sends and Shift+Enter breaks the line, which is what every
            // reader's fingers already expect from a thread like this one.
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
              if (
                event.key === 'Escape' &&
                (editing !== null || replyTo !== null)
              ) {
                event.preventDefault()
                cancel()
              }
            }}
            rows={2}
            autoResize
            maxRows={6}
            maxLength={MAX_LENGTH}
            size="sm"
            aria-label={
              editing === null
                ? t('modules.collab.compose.placeholder')
                : t('modules.collab.compose.editPlaceholder')
            }
            placeholder={
              editing === null
                ? t('modules.collab.compose.placeholderText')
                : t('modules.collab.compose.editPlaceholderText')
            }
            className="min-w-0 flex-1"
          />
          {editing === null ? (
            <IconButton
              type="submit"
              variant="brand"
              size="md"
              shape="pill"
              icon={<SendHorizontal aria-hidden />}
              label={t('modules.collab.compose.send')}
              disabled={!canSend}
              loading={post.pending}
            />
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              shape="pill"
              disabled={!canSend}
              loading={edit.pending}
              loadingLabel={t('modules.collab.compose.savingEdit')}
            >
              {t('modules.collab.compose.save')}
            </Button>
          )}
        </div>
        <p className="text-caption text-ink-4">
          <Kbd>Enter</Kbd> {t('modules.collab.hint.sends')} · <Kbd>Shift</Kbd>
          <Kbd>Enter</Kbd> {t('modules.collab.hint.addsLine')}
          {editing === null && replyTo === null ? null : (
            <>
              {' · '}
              <Kbd>Esc</Kbd> {t('modules.collab.hint.cancels')}
            </>
          )}
        </p>
      </form>
    </div>
  )
}
