/**
 * The files screen: a drop and paste target, a live upload queue and a library.
 *
 * Three things make this real rather than a rendering of a table:
 *
 * - **The bytes actually go to R2.** `uploadFile` posts each file to its server
 *   function over `XMLHttpRequest`, so the progress bars measure the request body
 *   leaving the machine rather than animating while a promise is pending.
 * - **The plan's storage entitlement is enforced twice.** The same policy runs in
 *   the browser as a pre-flight — so a file that will not fit is refused instantly
 *   with the reason — and again on the server, which is the one that counts.
 * - **The queue is one file at a time.** Sequential rather than parallel, because
 *   the quota is checked per request: ten simultaneous uploads would each be told
 *   there is room and together there would not be.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  CloudUpload,
  Download,
  FileImage,
  FileText,
  HardDrive,
  Map as MapIcon,
  Paperclip,
  Pencil,
  ReceiptText,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'

import {
  Alert,
  Badge,
  Button,
  Chip,
  EmptyState,
  IconButton,
  KbdSequence,
  Progress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
  useHasMounted,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { resolve } from '../shared/deferred-message'
import { formatRelative } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatStorage } from '#/lib/plans'
import { ACCEPT_ATTRIBUTE, MAX_FILE_BYTES } from '#/server/fns/file-policy'
import { deleteTripFileFn } from '#/server/fns/files'
import {
  ConfirmDialog,
  FilterRow,
  ModulePanel,
  RowMenu,
  messageOf,
  useAction,
} from '../shared'
import { downloadTripFile } from './download'
import { FileDetailsDialog } from './file-dialogs'
import { filesFromClipboard, nameForPaste, shouldTakePaste } from './paste'
import { describeRejection, kindForFile, screenFiles } from './screening'
import { uploadFile } from './upload'
import {
  activeTasks,
  announcementsFor,
  emptyUploadQueue,
  failedTasks,
  nextQueued,
  overallProgress,
  pendingBytes,
  settledTasks,
  uploadQueueReducer,
} from './upload-queue'

import type { LucideIcon } from 'lucide-react'
import type { MessageKey, Translate } from '#/lib/i18n'
import type { ConfirmRequest } from '../shared'
import type { FileData, FilePerson } from './types'
import type { UploadQueueAction } from './upload-queue'

const KIND_ICON: Record<string, LucideIcon> = {
  document: FileText,
  image: FileImage,
  ticket: Ticket,
  receipt: ReceiptText,
  map: MapIcon,
  other: Paperclip,
}

function iconFor(kind: string): LucideIcon {
  return KIND_ICON[kind] ?? Paperclip
}

const KIND_LABEL: Record<string, MessageKey> = {
  document: 'modules.files.kind.document',
  image: 'modules.files.kind.photo',
  ticket: 'modules.files.kind.ticket',
  receipt: 'modules.files.kind.receipt',
  map: 'modules.files.kind.map',
  other: 'modules.files.kind.other',
}

function kindLabel(kind: string): MessageKey {
  return KIND_LABEL[kind] ?? 'modules.files.kind.other'
}

function nameFor(
  people: ReadonlyArray<FilePerson>,
  userId: string,
  t: Translate,
): string {
  return (
    people.find((person) => person.userId === userId)?.name ??
    t('costs.person.removed')
  )
}

let taskSequence = 0

/** True for a drag that carries files; selected text and links dragged over the page do not. */
function carriesFiles(data: DataTransfer): boolean {
  return Array.from(data.types).includes('Files')
}

/* ------------------------------------------------------------------ screen */

export interface FileLibraryProps {
  readonly tripId: string
  readonly files: ReadonlyArray<FileData>
  readonly people: ReadonlyArray<FilePerson>
  /** Bytes the whole workspace holds, and the plan's ceiling. */
  readonly workspaceBytes: number
  readonly limitBytes: number
  /** Opens the file picker from the module header's primary action. */
  readonly pickRequestedAt: number
}

export function FileLibrary({
  tripId,
  files,
  people,
  workspaceBytes,
  limitBytes,
  pickRequestedAt,
}: FileLibraryProps) {
  const [queue, dispatch] = useReducer(uploadQueueReducer, emptyUploadQueue)
  const [dragging, setDragging] = useState(false)
  /**
   * Enters minus leaves. A browser fires `dragenter` on every element the pointer crosses onto and
   * `dragleave` on the one it left, so a plain boolean flickers off each time the pointer reaches
   * the button; the zone is left only when the count returns to zero. Zeroed by a drop.
   */
  const dragDepth = useRef(0)
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [editing, setEditing] = useState<FileData | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  /** Bumped by each paste that brought files; the queue is scrolled to once it has rendered. */
  const [scrollRequest, setScrollRequest] = useState(0)
  const hintMounted = useHasMounted()
  const t = useTranslate()
  const locale = useLocale()
  const [now, setNow] = useState(() => Date.now())

  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const queueListRef = useRef<HTMLUListElement>(null)
  /** Pasted screenshots named per second, for the screen's whole life: names stay unique across pastes. */
  const pastedPerSecond = useRef(new Map<string, number>())
  /** The controller for the upload actually in flight, so Cancel can abort it. */
  const controllers = useRef(new Map<string, AbortController>())
  /** Files by task id, held outside the reducer: a `File` is not state. */
  const payloads = useRef(new Map<string, File>())
  const pumping = useRef(false)
  /** Coalesces the loader refresh so a batch of uploads costs one re-read. */
  const refreshTimer = useRef<number | null>(null)

  const scheduleRefresh = useCallback((): void => {
    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current)
    }
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      void router.invalidate()
    }, 250)
  }, [router])

  useEffect(
    () => () => {
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current)
      }
    },
    [],
  )

  const remove = useAction(deleteTripFileFn, {
    success: t('modules.files.toast.removed'),
    failure: t('modules.files.toast.removeFailed'),
    onSuccess: () => setConfirm(null),
  })
  const download = useAction(downloadTripFile, {
    success: (result) =>
      t('modules.files.status.downloadingOf', { name: result.filename }),
    failure: t('modules.files.toast.downloadFailed'),
  })

  // Relative timestamps are only honest if they move. One minute is the coarsest
  // grain the column shows, so that is how often it is recomputed.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // The header's primary action lives outside this component, so it asks for the
  // picker by bumping a counter rather than by reaching for a ref.
  useEffect(() => {
    if (pickRequestedAt > 0) {
      inputRef.current?.click()
    }
  }, [pickRequestedAt])

  const add = useCallback(
    (incoming: ReadonlyArray<File>): void => {
      if (incoming.length === 0) {
        return
      }
      const { accepted, rejected } = screenFiles(incoming, {
        usedBytes: workspaceBytes,
        limitBytes,
        pendingBytes: pendingBytes(queue),
      })

      for (const entry of rejected) {
        taskSequence += 1
        dispatch({
          type: 'reject',
          id: `task-${taskSequence}`,
          filename: entry.file.name,
          sizeBytes: entry.file.size,
          message: entry.message,
        })
      }

      const tasks = accepted.map((file) => {
        taskSequence += 1
        const id = `task-${taskSequence}`
        payloads.current.set(id, file)
        return { id, filename: file.name, sizeBytes: file.size }
      })
      dispatch({ type: 'enqueue', tasks })
    },
    [workspaceBytes, limitBytes, queue],
  )

  /**
   * Paste, anywhere on this screen, not only on the drop panel: a traveller who copies a screenshot,
   * opens Files and presses the shortcut expects it to land without first clicking into a panel.
   * The listener lives only while this screen does, so a paste elsewhere never uploads to this trip.
   * It stands down for the details dialog and the confirmation (a paste there is text), and cancels
   * the browser's default only when it found files, so pasting text behaves as it always did.
   */
  useEffect(() => {
    if (editing !== null || confirm !== null) {
      return
    }
    const onPaste = (event: ClipboardEvent): void => {
      if (!shouldTakePaste(event) || event.clipboardData === null) {
        return
      }
      const pasted = filesFromClipboard(event.clipboardData)
      if (pasted.length === 0) {
        return
      }
      event.preventDefault()
      add(nameForPaste(pasted, new Date(), pastedPerSecond.current))
      setScrollRequest((count) => count + 1)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [add, editing, confirm])

  // After the render that shows the pasted rows: the list only exists once the queue holds a task,
  // so the handler itself has nothing to scroll to on a first paste. On a long library this is what
  // lets the traveller see the upload begin instead of pasting a second time.
  useEffect(() => {
    if (scrollRequest > 0) {
      queueListRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [scrollRequest])

  /**
   * The pump. One upload at a time, restarted whenever the queue changes, guarded
   * so two renders cannot start the same task twice.
   */
  useEffect(() => {
    if (pumping.current) {
      return
    }
    const task = nextQueued(queue)
    if (task === undefined) {
      return
    }
    const file = payloads.current.get(task.id)
    if (file === undefined) {
      dispatch({
        type: 'fail',
        id: task.id,
        message: t('modules.files.toast.gone'),
      })
      return
    }

    pumping.current = true
    const controller = new AbortController()
    controllers.current.set(task.id, controller)
    dispatch({ type: 'start', id: task.id })

    /**
     * Releases the pump and *then* records the outcome.
     *
     * The order is the whole point. Dispatching first would schedule React's
     * re-render as a microtask, and that render — and this effect with it — would
     * run while the guard was still set, so the next file in the batch would never
     * be picked up. Clearing the flag before the dispatch means the effect that
     * observes the new queue always sees a free pump.
     */
    const settle = (outcome: UploadQueueAction): void => {
      controllers.current.delete(task.id)
      payloads.current.delete(task.id)
      pumping.current = false
      dispatch(outcome)
      // Coalesced rather than immediate: a batch of twelve files should cost one
      // re-read of the library, not twelve.
      scheduleRefresh()
    }

    void uploadFile({
      file,
      tripId,
      kind: kindForFile(file),
      onProgress: (fraction) =>
        dispatch({ type: 'progress', id: task.id, value: fraction }),
      signal: controller.signal,
    })
      .then((answer) => {
        if (answer.ok) {
          settle({ type: 'succeed', id: task.id })
          return
        }
        settle(
          answer.code === 'aborted'
            ? { type: 'cancel', id: task.id }
            : {
                type: 'fail',
                id: task.id,
                message: describeRejection(
                  answer.code,
                  answer.params,
                  answer.message,
                ),
              },
        )
      })
      .catch((cause: unknown) => {
        // `uploadFile` resolves rather than rejects, so reaching here means
        // something outside it threw; the queue must still be released.
        settle({
          type: 'fail',
          id: task.id,
          message: messageOf(cause, t('modules.files.toast.uploadFailed')),
        })
      })
  }, [queue, tripId, scheduleRefresh])

  /**
   * The confirmation an upload owes the reader.
   *
   * Every other write on these screens ends in a toast; uploading was the one that
   * finished in silence, leaving "did that work?" answerable only by reading the
   * table. Reported per *batch* rather than per file — a drop of twelve files is one
   * action, and the queue panel already narrates each file's progress — which is why
   * it waits for the queue to drain and remembers what it has already announced.
   */
  const announced = useRef(new Set<string>())
  useEffect(() => {
    if (activeTasks(queue).length > 0) return

    const fresh = settledTasks(queue).filter(
      (task) => !announced.current.has(task.id),
    )
    if (fresh.length === 0) return
    for (const task of fresh) announced.current.add(task.id)

    for (const line of announcementsFor(fresh)) {
      const say = line.kind === 'success' ? toast.success : toast.error
      say(resolve(line.title, t), {
        description:
          typeof line.description === 'string'
            ? line.description
            : resolve(line.description, t),
      })
    }
  }, [queue])

  const kinds = useMemo(() => {
    const tally = new Map<string, number>()
    for (const file of files) {
      tally.set(file.kind, (tally.get(file.kind) ?? 0) + 1)
    }
    return [...tally.entries()].sort((left, right) => right[1] - left[1])
  }, [files])

  const visible = files.filter(
    (file) => kindFilter === 'all' || file.kind === kindFilter,
  )
  const running = activeTasks(queue)
  const failed = failedTasks(queue)
  const ratio = limitBytes <= 0 ? 0 : workspaceBytes / limitBytes
  const full = Number.isFinite(limitBytes) && ratio >= 1

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => {
          add([...(event.target.files ?? [])])
          // Cleared so choosing the same file twice in a row still fires.
          event.target.value = ''
        }}
      />

      {full ? (
        <Alert tone="danger" title={t('modules.files.storage.full')}>
          {t('modules.files.storage.used', {
            used: formatStorage(workspaceBytes),
            limit: formatStorage(limitBytes),
          })}
        </Alert>
      ) : null}

      <ModulePanel
        label={t('modules.files.action.add')}
        count={t('modules.files.storage.perFile', {
          size: formatStorage(MAX_FILE_BYTES),
        })}
        action={
          queue.tasks.length === 0 ? undefined : (
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => dispatch({ type: 'clearSettled' })}
            >
              {t('modules.files.queue.clear')}
            </Button>
          )
        }
      >
        <div
          data-part="file-drop"
          data-state={dragging ? 'active' : 'idle'}
          onDragEnter={(event) => {
            if (!carriesFiles(event.dataTransfer)) {
              return
            }
            event.preventDefault()
            dragDepth.current += 1
            setDragging(true)
          }}
          onDragOver={(event) => {
            if (!carriesFiles(event.dataTransfer)) {
              return
            }
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(event) => {
            // No files check: the count only rises under a files drag, and some browsers report
            // other types on a leave, which would otherwise strand the zone active.
            event.preventDefault()
            dragDepth.current = Math.max(0, dragDepth.current - 1)
            if (dragDepth.current === 0) {
              setDragging(false)
            }
          }}
          onDrop={(event) => {
            event.preventDefault()
            dragDepth.current = 0
            setDragging(false)
            add([...event.dataTransfer.files])
          }}
          className="relative flex flex-col items-center gap-3 rounded-lg border border-dashed border-edge-strong/60 bg-surface-2/40 px-6 py-9 text-center"
        >
          {/*
            The drag-over fill. Only its opacity moves, so nothing repaints or reflows while a drag
            crosses the zone, and it sits behind the icon, the text and the button (each is
            `relative`, the button by its base class, which paints them after this positioned sibling) so "Drop to upload" keeps the
            ink-on-brand-subtle pair in both themes. `-inset-px` lets its hairline cover the dashed
            border. The global reduced-motion rule already collapses the transition.
          */}
          <span
            aria-hidden
            data-part="file-drop-overlay"
            className={cn(
              'pointer-events-none absolute -inset-px rounded-lg border border-brand bg-brand-subtle',
              'transition-opacity duration-base ease-out-quint',
              dragging ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span
            className={cn(
              'relative grid size-12 place-items-center rounded-full',
              dragging ? 'bg-brand text-brand-on' : 'bg-surface-2 text-ink-3',
            )}
          >
            <CloudUpload aria-hidden className="size-5" />
          </span>
          <div className="relative">
            <p className="text-label font-semibold text-ink">
              {dragging
                ? t('modules.files.drop.active')
                : t('modules.files.drop.idle')}
            </p>
            <p className="mt-1 text-caption text-ink-3">
              {t('modules.files.empty.hint')}
            </p>
            {/*
              Key caps first, then the verb, in every locale. The line is absent on touch, where a
              screen reader would otherwise read a shortcut nobody can press. Its height is reserved
              from the first paint (`min-h-5`, the cap's own height) and it fades in by opacity once
              mounted, so the Ctrl-to-⌘ swap moves nothing.
            */}
            <p
              className={cn(
                'mt-2 flex min-h-5 items-center justify-center gap-1.5 text-caption text-ink-3',
                'transition-opacity duration-base ease-out-quint',
                '[@media(hover:none)]:hidden pointer-coarse:hidden',
                hintMounted ? 'opacity-100' : 'opacity-0',
              )}
              data-part="file-paste-hint"
            >
              <KbdSequence keys={['Mod', 'V']} size="sm" />
              <span className="text-center">
                {t('modules.files.drop.pasteHint')}
              </span>
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            shape="pill"
            onClick={() => inputRef.current?.click()}
          >
            {t('modules.files.action.choose')}
          </Button>
        </div>

        {queue.tasks.length === 0 ? null : (
          <div className="mt-4 flex flex-col gap-3">
            {running.length === 0 ? null : (
              <Progress
                value={overallProgress(queue)}
                max={1}
                size="sm"
                tone="brand"
                label={t('modules.files.status.uploadingCount', {
                  count: running.length,
                })}
                valueText={`${Math.round(overallProgress(queue) * 100)}%`}
              />
            )}
            <ul
              ref={queueListRef}
              className="flex flex-col gap-2"
              data-part="file-queue"
            >
              {queue.tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex min-w-0 items-center gap-3 rounded-md border border-edge-faint bg-surface px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-baseline gap-2">
                      <span className="min-w-0 truncate text-caption font-medium text-ink">
                        {task.filename}
                      </span>
                      <span className="shrink-0 text-caption tabular-nums text-ink-4">
                        {formatStorage(task.sizeBytes)}
                      </span>
                    </p>
                    {task.status === 'uploading' ? (
                      <Progress
                        value={task.progress}
                        max={1}
                        size="xs"
                        tone="brand"
                        className="mt-1.5"
                        aria-label={t('modules.files.status.uploadingOf', {
                          name: task.filename,
                        })}
                      />
                    ) : task.message === null ? null : (
                      <p className="mt-0.5 text-caption text-danger">
                        {typeof task.message === 'string'
                          ? task.message
                          : resolve(task.message, t)}
                      </p>
                    )}
                  </div>
                  <TaskBadge status={task.status} />
                  {task.status === 'uploading' || task.status === 'queued' ? (
                    <IconButton
                      variant="ghost"
                      size="sm"
                      label={t('modules.files.action.cancelUploadOf', {
                        name: task.filename,
                      })}
                      icon={<X aria-hidden />}
                      onClick={() => {
                        controllers.current.get(task.id)?.abort()
                        dispatch({ type: 'cancel', id: task.id })
                      }}
                    />
                  ) : (
                    <IconButton
                      variant="ghost"
                      size="sm"
                      label={t('modules.files.action.dismissOf', {
                        name: task.filename,
                      })}
                      icon={<X aria-hidden />}
                      onClick={() => dispatch({ type: 'dismiss', id: task.id })}
                    />
                  )}
                </li>
              ))}
            </ul>
            {failed.length === 0 ? null : (
              <p className="text-caption text-ink-3">
                {t('modules.files.queue.someFailed', {
                  count: failed.length,
                })}
              </p>
            )}
          </div>
        )}
      </ModulePanel>

      {files.length === 0 ? (
        <EmptyState
          variant="dashed"
          size="lg"
          tone="brand"
          icon={<Paperclip />}
          title={t('modules.files.empty.title')}
          description={t('modules.files.empty.body')}
        />
      ) : (
        <ModulePanel
          label={t('modules.files.heading')}
          count={`${visible.length} of ${files.length}`}
          toolbar={
            kinds.length < 2 ? undefined : (
              <FilterRow>
                <Chip
                  selected={kindFilter === 'all'}
                  count={files.length}
                  onClick={() => setKindFilter('all')}
                >
                  {t('modules.filter.all')}
                </Chip>
                {kinds.map(([kind, count]) => {
                  const Icon = iconFor(kind)
                  return (
                    <Chip
                      key={kind}
                      selected={kindFilter === kind}
                      count={count}
                      icon={<Icon aria-hidden />}
                      onClick={() => setKindFilter(kind)}
                    >
                      {t(kindLabel(kind))}
                    </Chip>
                  )
                })}
              </FilterRow>
            )
          }
          flush
          bodyClassName="p-0"
        >
          <Table label={t('modules.files.tableCaption')} fixed>
            <TableHeader>
              <TableRow>
                <TableHead>{t('modules.files.column.file')}</TableHead>
                <TableHead className="w-28">
                  {t('modules.lists.field.kind')}
                </TableHead>
                <TableHead className="w-24" numeric>
                  {t('modules.files.column.size')}
                </TableHead>
                <TableHead className="hidden w-36 sm:table-cell">
                  {t('modules.files.column.addedBy')}
                </TableHead>
                <TableHead className="hidden w-24 sm:table-cell">
                  {t('modules.files.column.when')}
                </TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">
                    {t('console.users.column.actions')}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((file) => {
                const Icon = iconFor(file.kind)
                return (
                  <TableRow key={file.id}>
                    <TableCell truncate>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          aria-hidden
                          className="size-4 shrink-0 text-ink-4"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {file.filename}
                          </span>
                          {file.description === null ? null : (
                            <span className="block truncate text-caption text-ink-3">
                              {file.description}
                            </span>
                          )}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge tone="neutral" size="sm">
                        {t(kindLabel(file.kind))}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>
                      {formatStorage(file.sizeBytes)}
                    </TableCell>
                    <TableCell truncate muted className="hidden sm:table-cell">
                      {nameFor(people, file.uploadedBy, t)}
                    </TableCell>
                    <TableCell muted className="hidden sm:table-cell">
                      {formatRelative(file.createdAt, now, locale) ?? '—'}
                    </TableCell>
                    <TableCell>
                      <RowMenu
                        label={t('modules.actionsFor', {
                          name: file.filename,
                        })}
                        size="sm"
                        items={[
                          {
                            label: t('modules.files.menu.download'),
                            icon: <Download aria-hidden />,
                            disabled: download.pending,
                            onSelect: () => {
                              void download.run({
                                tripId,
                                fileId: file.id,
                                filename: file.filename,
                              })
                            },
                          },
                          {
                            label: t('modules.files.menu.rename'),
                            icon: <Pencil aria-hidden />,
                            onSelect: () => setEditing(file),
                          },
                          {
                            label: t('modules.files.menu.remove'),
                            icon: <Trash2 aria-hidden />,
                            tone: 'danger',
                            separated: true,
                            onSelect: () =>
                              setConfirm({
                                title: t('modules.remove.confirmTitle', {
                                  name: file.filename,
                                }),
                                description: t('modules.files.remove.body', {
                                  size: formatStorage(file.sizeBytes),
                                }),
                                confirmLabel: t('modules.files.menu.remove'),
                                onConfirm: () =>
                                  remove.run({
                                    data: { tripId, fileId: file.id },
                                  }),
                              }),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ModulePanel>
      )}

      {editing === null ? null : (
        <FileDetailsDialog
          tripId={tripId}
          file={editing}
          open
          onOpenChange={(next) => {
            if (!next) {
              setEditing(null)
            }
          }}
        />
      )}

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

function TaskBadge({ status }: { status: string }) {
  const t = useTranslate()

  if (status === 'done') {
    return (
      <Badge tone="success" size="sm">
        {t('modules.files.status.uploaded')}
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge tone="danger" size="sm">
        {t('modules.files.status.failed')}
      </Badge>
    )
  }
  if (status === 'cancelled') {
    return (
      <Badge tone="neutral" size="sm">
        {t('modules.files.status.cancelled')}
      </Badge>
    )
  }
  if (status === 'uploading') {
    return (
      <Badge tone="brand" size="sm">
        {t('modules.files.status.uploading')}
      </Badge>
    )
  }
  return (
    <Badge tone="outline" size="sm">
      {t('modules.files.status.waiting')}
    </Badge>
  )
}

/** The screen's primary action, for the module header. */
export function UploadFilesAction({ onClick }: { onClick: () => void }) {
  const t = useTranslate()

  return (
    <Button
      variant="primary"
      size="sm"
      shape="pill"
      icon={<CloudUpload aria-hidden strokeWidth={2.5} />}
      onClick={onClick}
    >
      {t('modules.files.action.upload')}
    </Button>
  )
}

/** A storage meter for the module header. */
export function StorageMeter({
  usedBytes,
  limitBytes,
}: {
  usedBytes: number
  limitBytes: number
}) {
  const ratio = limitBytes <= 0 ? 0 : Math.min(usedBytes / limitBytes, 1)
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-full bg-surface-2 px-3 text-caption font-medium tabular-nums text-ink-2">
      <HardDrive aria-hidden className="size-3.5 text-ink-4" />
      {formatStorage(usedBytes)} of{' '}
      {Number.isFinite(limitBytes) ? formatStorage(limitBytes) : 'unlimited'}
      <span
        aria-hidden
        className={cn(
          'ms-0.5 inline-block h-1.5 w-10 overflow-hidden rounded-full bg-surface-inset',
        )}
      >
        <span
          className={cn(
            'block h-full rounded-full',
            ratio > 0.9 ? 'bg-danger' : ratio > 0.7 ? 'bg-warning' : 'bg-brand',
          )}
          style={{ width: `${Math.max(ratio * 100, 2)}%` }}
        />
      </span>
    </span>
  )
}
