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
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Pencil, SendHorizontal, SmilePlus, Trash2, X } from 'lucide-react'

import {
  Alert,
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
  toast,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { THREAD_PAGE_SIZE } from '#/lib/collab'
import { readPublicFailure } from '#/lib/errors'
import { formatWeekday } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'

import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import { dayKeyIn, todayKeyIn } from '#/lib/time'
import {
  deleteMessageFn,
  editMessageFn,
  postMessageFn,
  toggleReactionFn,
} from '#/server/fns/collab-thread'
import { ConfirmDialog, RowMenu, useAction, useOptimistic } from '../shared'

import { useThreadHistory } from './use-thread-history'
import {
  editMessage,
  removeMessage,
  setViewerReaction,
  groupThread,
  isJumboGlyphs,
} from './thread-model'

import type { ConfirmRequest } from '../shared'
import type { CollabPerson, MessageData } from './types'

const MAX_LENGTH = 4000

/** A viewer this close to the bottom is reading the live edge, so it follows. */
const FOLLOW_THRESHOLD_PX = 48

/** The reactions a travel thread actually uses. Six, not an emoji keyboard. */
const REACTIONS: ReadonlyArray<{ emoji: string; label: MessageKey }> = [
  { emoji: '👍', label: 'modules.collab.reaction.agree' },
  { emoji: '❤️', label: 'modules.collab.reaction.love' },
  { emoji: '😂', label: 'modules.collab.reaction.funny' },
  { emoji: '🎉', label: 'modules.collab.reaction.celebrate' },
  { emoji: '🙏', label: 'modules.collab.reaction.thanks' },
  { emoji: '👀', label: 'modules.collab.reaction.looking' },
]

const LOCALE = 'en-GB'

/**
 * The clock is pinned to the trip's zone rather than the machine's.
 *
 * Without an explicit `timeZone` the same message reads `14:00` in the server's
 * HTML and `23:00` after hydration, which React reports as a mismatch and
 * recovers from by discarding the whole transcript. Pinning also makes the
 * transcript mean one thing: every time in it is destination wall-clock time, so
 * two travellers in two countries read the same number for the same plan.
 */
function clockFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * The day divider's label, from the frozen locale tables. The zone-local day key
 * is what gets formatted: the instant would be read in UTC by the tables and
 * could land on the neighbouring day.
 */
function formatDayHeading(
  iso: string,
  todayKey: string,
  timeZone: string,
  locale: Locale,
  t: Translate,
): string {
  const key = dayKeyIn(iso, timeZone)
  if (key === todayKey) {
    return t('modules.collab.thread.today')
  }
  return formatWeekday(key, locale) ?? key
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
  readonly onDirtyChange?: (dirty: boolean) => void
  readonly turnedOff?: boolean
}

export function Thread({
  tripId,
  messages: window,
  people,
  viewerUserId,
  canModerate,
  timeZone,
  onDirtyChange,
  turnedOff = false,
}: ThreadProps) {
  const { messages, exhausted, loadOlder, patchHeld } = useThreadHistory(
    tripId,
    window,
  )
  const [replyTo, setReplyTo] = useState<MessageData | null>(null)
  const t = useTranslate()
  const locale = useLocale()
  const [editing, setEditing] = useState<MessageData | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const loadButtonRef = useRef<HTMLButtonElement>(null)
  const startRef = useRef<HTMLParagraphElement>(null)
  const loadFailedId = useId()
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const loadBusy = useRef(false)
  const wasLoading = useRef(false)
  const prepend = useRef<{
    firstId: string | undefined
    height: number
    top: number
  } | null>(null)
  const reading = useRef<{
    opened: boolean
    lastId: string | undefined
    nearBottom: boolean
  }>({ opened: false, lastId: undefined, nearBottom: true })
  const paged =
    window.length >= THREAD_PAGE_SIZE || messages.length > window.length

  /**
   * The transcript scrolls its own box and never the page. It opens on the newest
   * message, keeps the reader's place when an older page is put above them (WebKit
   * has no scroll anchoring), and follows a live message only for a reader at the
   * bottom or for the viewer's own message: a reader of history is not yanked.
   */
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (scroller === null) return
    const seen = reading.current
    const lastId = messages.at(-1)?.id
    const toBottom = () => {
      scroller.scrollTop = scroller.scrollHeight
      seen.nearBottom = true
    }
    if (!seen.opened) {
      seen.opened = true
      toBottom()
    } else if (
      prepend.current !== null &&
      messages[0]?.id !== prepend.current.firstId
    ) {
      scroller.scrollTop =
        prepend.current.top + (scroller.scrollHeight - prepend.current.height)
      prepend.current = null
    } else if (lastId !== undefined && lastId !== seen.lastId) {
      const arrived = messages.filter(
        (message) => seen.lastId === undefined || message.id > seen.lastId,
      )
      if (
        seen.nearBottom ||
        arrived.some((message) => message.userId === viewerUserId)
      )
        toBottom()
    }
    seen.lastId = lastId
  }, [messages, viewerUserId])

  function trackBottom(scroller: HTMLDivElement): void {
    reading.current.nearBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
      FOLLOW_THRESHOLD_PX
  }

  async function loadEarlier(): Promise<void> {
    const scroller = scrollerRef.current
    if (loadBusy.current || scroller === null) return
    loadBusy.current = true
    setLoadingOlder(true)
    prepend.current = null
    const firstId = messages[0]?.id
    try {
      await loadOlder(() => {
        prepend.current = {
          firstId,
          height: scroller.scrollHeight,
          top: scroller.scrollTop,
        }
      })
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    } finally {
      loadBusy.current = false
      setLoadingOlder(false)
    }
  }

  // The button stays inert while it loads, so on settle focus goes where the
  // reader can act next: the control, or the line that replaced it.
  useEffect(() => {
    if (loadingOlder) {
      wasLoading.current = true
      return
    }
    if (!wasLoading.current) return
    wasLoading.current = false
    const target = exhausted ? startRef.current : loadButtonRef.current
    target?.focus({ preventScroll: true })
  }, [loadingOlder, exhausted])

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
  const grouped = useMemo(
    () => groupThread(messages, timeZone),
    [messages, timeZone],
  )
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

    void reactionOverlay.claim([[message.id, next]], async () => {
      const result = await toggle.run({
        data: { tripId, messageId: message.id, emoji },
      })
      if (result !== null)
        patchHeld((rows) =>
          setViewerReaction(
            rows,
            message.id,
            viewerUserId,
            emoji,
            result.added,
          ),
        )
      return result
    })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {paged ? (
        <div className="flex shrink-0 flex-col items-center gap-1.5 pb-2">
          {exhausted ? (
            <p
              ref={startRef}
              tabIndex={-1}
              className="text-caption text-ink-4 focus-ring"
            >
              {t('modules.collab.thread.start')}
            </p>
          ) : (
            <>
              {loadFailed ? (
                <p id={loadFailedId} className="text-caption text-danger">
                  {t('modules.collab.thread.loadOlderFailed')}
                </p>
              ) : null}
              <Button
                ref={loadButtonRef}
                data-part="thread-load-older"
                aria-describedby={loadFailed ? loadFailedId : undefined}
                variant="subtle"
                size="sm"
                loading={loadingOlder}
                loadingLabel={t('modules.collab.thread.loadingOlder')}
                onClick={() => void loadEarlier()}
              >
                {t(
                  loadFailed
                    ? 'modules.collab.thread.retry'
                    : 'modules.collab.thread.loadOlder',
                )}
              </Button>
            </>
          )}
        </div>
      ) : null}
      <div
        ref={scrollerRef}
        data-part="thread-scroller"
        onScroll={(event) => trackBottom(event.currentTarget)}
        className="max-h-[70svh] min-h-0 flex-1 overflow-y-auto px-1 xl:max-h-none"
      >
        {messages.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<SendHorizontal />}
            title={t('modules.collab.thread.empty')}
            description={t('modules.collab.thread.emptyBody')}
          />
        ) : (
          <ol className="flex flex-col gap-1 py-1">
            {grouped.map(({ message, startsRun, startsDay }) => {
              const mine = message.userId === viewerUserId
              const claimed = reactionOverlay.get(message.id)

              return (
                <li key={message.id} className="min-w-0">
                  {startsDay ? (
                    <div className="flex items-center gap-3 py-3">
                      <span aria-hidden className="h-px flex-1 bg-edge-faint" />
                      <span className="shrink-0 text-micro font-semibold tracking-label text-ink-4 uppercase">
                        {formatDayHeading(
                          message.createdAt,
                          todayKey,
                          timeZone,
                          locale,
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
                    runs={!startsRun}
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
                        onConfirm: async () => {
                          const result = await remove.run({
                            data: { tripId, messageId: message.id },
                          })
                          if (result !== null)
                            patchHeld((rows) => removeMessage(rows, message.id))
                        },
                      })
                    }
                  />
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <Composer
        tripId={tripId}
        messages={messages}
        onEdited={(id, body) =>
          patchHeld((rows) =>
            editMessage(rows, id, body, new Date().toISOString()),
          )
        }
        viewerUserId={viewerUserId}
        onDirtyChange={onDirtyChange}
        turnedOff={turnedOff}
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
  const jumbo = isJumboGlyphs(message.body)

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
              'max-w-[18rem] break-words sm:max-w-[22rem]',
              jumbo
                ? 'px-1 text-title'
                : [
                    'rounded-lg px-3 py-2 text-label leading-relaxed',
                    mine
                      ? 'rounded-ee-sm bg-brand text-brand-on'
                      : 'rounded-es-sm bg-surface-2 text-ink',
                  ],
            )}
          >
            {message.body}
          </div>

          {/* Always visible on touch; hover and focus reveal actions for fine
              pointers. Opacity keeps the controls in the keyboard tab order. */}
          <span
            className={cn(
              'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-fast ease-out-quint',
              'group-hover/message:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100',
            )}
          >
            <ReactionPicker onPick={onReact} mine={myReactions} />
            <RowMenu
              label={t('modules.collab.message.actionsFor', { name })}
              size="sm"
              items={[
                {
                  label: t('modules.collab.message.reply'),
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
            <Tooltip key={reaction.emoji} content={t(reaction.label)}>
              <button
                type="button"
                aria-pressed={mine.includes(reaction.emoji)}
                aria-label={t(reaction.label)}
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
  messages,
  viewerUserId,
  replyTo,
  editing,
  people,
  onClearReply,
  onEdited,
  onClearEditing,
  onDirtyChange,
  turnedOff,
}: {
  tripId: string
  messages: ReadonlyArray<MessageData>
  viewerUserId: string
  replyTo: MessageData | null
  editing: MessageData | null
  people: ReadonlyArray<CollabPerson>
  onClearReply: () => void
  onEdited: (id: string, body: string) => void
  onClearEditing: () => void
  onDirtyChange?: (dirty: boolean) => void
  turnedOff: boolean
}) {
  const t = useTranslate()
  const [body, setBody] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const sending = useRef(false)
  const [coarsePointer, setCoarsePointer] = useState(false)
  const [focused, setFocused] = useState(false)
  const hintId = useId()
  const failureId = useId()
  const [failed, setFailed] = useState<{
    kind: 'post' | 'edit'
    draft: string
    body: string
    newestId: string
  } | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarsePointer(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  // A later loader window can prove a post landed despite a lost response.
  useEffect(() => {
    if (failed?.kind !== 'post') return
    const landed = messages.some(
      (message) =>
        message.userId === viewerUserId &&
        message.body === failed.body &&
        message.id > failed.newestId,
    )
    if (landed) {
      setFailed(null)
      setBody((current) => (current === failed.draft ? '' : current))
      onClearReply()
    }
  }, [failed, messages, viewerUserId, onClearReply])
  const off = useRef(turnedOff)
  off.current = turnedOff
  useEffect(() => {
    onDirtyChange?.(body.length > 0 || editing !== null || failed !== null)
  }, [body, editing, failed, onDirtyChange])

  const post = useAction(postMessageFn, {
    failure: t('modules.collab.toast.notSent'),
    fallback: t('modules.collab.toast.notSentBody'),
  })
  // Transport errors are diagnostics; authored server failures keep their copy.
  async function saveEdit(input: Parameters<typeof editMessageFn>[0]) {
    try {
      return await editMessageFn(input)
    } catch (cause) {
      const failure = readPublicFailure(cause)
      if (failure.kind === 'unexpected' && failure.reference === undefined) {
        throw new Error(t('modules.collab.toast.editFailedBody'))
      }
      throw cause
    }
  }

  const edit = useAction(saveEdit, {
    success: () =>
      t(
        off.current
          ? 'trips.collab.sections.savedHidden'
          : 'modules.collab.toast.messageUpdated',
      ),
    failure: t('modules.collab.toast.editFailed'),
    fallback: t('modules.collab.toast.editFailedBody'),
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

  async function send(retry = false): Promise<void> {
    if (!canSend || sending.current) return
    sending.current = true
    const attempt = {
      kind: editing === null ? ('post' as const) : ('edit' as const),
      draft: body,
      body: trimmed,
      newestId: messages.reduce(
        (latest, message) => (message.id > latest ? message.id : latest),
        '',
      ),
    }
    try {
      const result =
        editing === null
          ? await post.run({
              data: { tripId, body: trimmed, replyToId: replyTo?.id ?? '' },
            })
          : await edit.run({
              data: { tripId, messageId: editing.id, body: trimmed },
            })
      if (result !== null) {
        if (editing === null && off.current)
          toast.success(t('trips.collab.sections.savedHidden'))
        setFailed(null)
        setBody((current) => (current === attempt.draft ? '' : current))
        if (editing === null) onClearReply()
        else {
          onEdited(editing.id, trimmed)
          onClearEditing()
        }
      } else if (fieldRef.current?.value.length) {
        setFailed(attempt)
      }
    } finally {
      sending.current = false
      if (retry) fieldRef.current?.focus()
    }
  }

  function cancel(): void {
    setFailed(null)
    setBody('')
    onClearEditing()
    onClearReply()
  }

  return (
    <div className="shrink-0 border-t border-edge-faint pt-3">
      {failed === null ? null : (
        <Alert
          id={failureId}
          tone="danger"
          size="sm"
          role={undefined}
          aria-live={undefined}
          className="mb-2"
          title={t(
            failed.kind === 'post'
              ? 'modules.collab.toast.notSent'
              : 'modules.collab.toast.editFailed',
          )}
          actions={
            <Button
              size="sm"
              loading={action.pending}
              disabled={!trimmed}
              onClick={() => void send(true)}
            >
              {t('modules.collab.compose.retry')}
            </Button>
          }
        >
          {t(
            failed.kind === 'post'
              ? 'modules.collab.toast.notSentBody'
              : 'modules.collab.toast.editFailedBody',
          )}
        </Alert>
      )}
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
            onChange={(event) => {
              setBody(event.target.value)
              if (event.target.value.length === 0) setFailed(null)
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-describedby={cn(hintId, failed !== null && failureId)}
            onKeyDown={(event) => {
              if (
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229
              )
                return
              if (event.key === 'Enter' && !event.shiftKey && !coarsePointer) {
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
        <p id={hintId} className="sr-only">
          {t(
            coarsePointer
              ? 'modules.collab.compose.keysHintTouch'
              : 'modules.collab.compose.keysHint',
          )}
          {editing === null && replyTo === null
            ? null
            : ` ${t('modules.collab.compose.keysHintEsc')}`}
        </p>
        <p
          aria-hidden="true"
          className={cn(
            'min-h-5 text-caption text-ink-4',
            (!focused || coarsePointer) && 'invisible',
          )}
        >
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
