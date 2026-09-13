/**
 * The import's entry point and its review surface.
 *
 * The one rule that shapes this file: **nothing a machine read reaches the desk until a person has
 * pressed a button beside it** (ADR 0012). So the dialog does four things in order — refuse what it
 * cannot read, *there and by name*; upload what it can through the existing `uploadFile`, which
 * posts over `XMLHttpRequest` and therefore measures real bytes; show what came back; and write
 * only the rows that survived pruning.
 *
 * A refusal is worded as what it is. The extraction ceiling has its own state rather than borrowing
 * the transit search's; a format the conversion cannot read is named with the file that carried it
 * and the list that works; a price the document did not state clearly is marked and left empty.
 *
 * The dialog can be closed and the reading continues — `./import-widget` is where that lives, and
 * this file reads the same register, so reopening the dialog (or arriving from the widget's Review)
 * finds the job again.
 */
import { useEffect, useId, useReducer, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { CloudUpload, FileUp } from 'lucide-react'

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  toast,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { formatStorage } from '#/lib/plans'
import { bookingTypeLabel } from './booking-form'
import { uploadFile } from '../files/upload'
import { useAction } from '../shared/use-action'
import {
  NO_IMPORT_SELECTION,
  acceptedImportRows,
  groupImportDrafts,
  importSelectionCount,
  importSelectionReducer,
  isImportRowSelected,
} from './import-drafts'
import {
  forgetBookImports,
  registerBookImports,
  useBookImportPoll,
  useBookImports,
} from './import-widget'
import {
  IMPORT_ACCEPT_ATTRIBUTE,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_FILES,
  importFormatFor,
} from '#/server/fns/file-policy'
import {
  EXTRACTION_BUDGET_SECONDS,
  confirmBookingImportFn,
  startBookingImportFn,
} from '#/server/fns/booking-import'

import type { ImportFileDrafts } from './import-drafts'
import type { BookImportJob } from './import-widget'
import type { BookingImportDraft } from '#/server/fns/booking-import'

/** The screen's second header action, beside `NewBookingAction`. */
export function ImportBookingsAction({ onClick }: { onClick: () => void }) {
  const t = useTranslate()

  return (
    <Button
      data-part="import-bookings"
      variant="secondary"
      size="sm"
      shape="pill"
      icon={<FileUp aria-hidden strokeWidth={2.5} />}
      onClick={onClick}
    >
      {t('modules.book.import.action')}
    </Button>
  )
}

/** Everything the dialog is doing that the server is not deciding for it. */
type Stage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'uploading'; readonly progress: number }
  | { readonly kind: 'uploadFailed'; readonly filename: string }
  | { readonly kind: 'reviewing' }
  | {
      readonly kind: 'partial'
      readonly written: number
      readonly total: number
    }

export interface ImportBookingsDialogProps {
  readonly tripId: string
  /** The signed-in account the job register is keyed by — see `bookImportsKey`. */
  readonly userId: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function ImportBookingsDialog({
  tripId,
  userId,
  open,
  onOpenChange,
}: ImportBookingsDialogProps) {
  const t = useTranslate()
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [refusals, setRefusals] = useState<ReadonlyArray<string>>([])
  const [dragging, setDragging] = useState(false)
  const [selection, dispatch] = useReducer(
    importSelectionReducer,
    NO_IMPORT_SELECTION,
  )

  const registered = useBookImports(userId).filter(
    (job) => job.tripId === tripId,
  )
  const { progress, views, recheck } = useBookImportPoll(open ? registered : [])

  /*
   * The toast titles are the catalogue's generic one, because both of these failures already have a
   * surface of their own in the dialog — the upload-failed alert names the file, the partial alert
   * counts the rows. Wording them from the import's own copy meant interpolating values nobody
   * had: `“” could not be read`, and `0 of 0 bookings were added`.
   */
  const start = useAction(startBookingImportFn, {
    failure: t('modules.form.saveError'),
  })
  const confirm = useAction(confirmBookingImportFn, {
    invalidate: false,
    failure: t('modules.form.saveError'),
  })

  /*
   * A row a previous confirm already wrote is not offered again: `written` on the staged record is
   * what makes a retry after a partial failure write only the rest.
   */
  const files: Array<ImportFileDrafts> = groupImportDrafts(
    registered.flatMap((job) => {
      const staged = views.get(job.jobId)?.staged
      if (staged === undefined) {
        return []
      }
      const written = new Set(staged.written)
      return [
        {
          jobId: job.jobId,
          filename: job.filename,
          drafts: staged.drafts.filter((draft) => !written.has(draft.index)),
        },
      ]
    }),
  )

  const refusal = registered
    .map((job) => ({ job, refusal: views.get(job.jobId)?.refusal }))
    .find((row) => row.refusal !== undefined)
  const stalled = registered.some(
    (job) => progress.get(job.jobId) === 'stalled',
  )
  const working =
    registered.length > 0 &&
    registered.some(
      (job) => (progress.get(job.jobId) ?? 'working') === 'working',
    )

  // Freshly read rows arrive selected: a reader prunes what the extractor got wrong, and asking
  // them to tick seven correct rows first is a worse default than asking them to untick one.
  const shape = files
    .map((file) => `${file.jobId}:${file.drafts.length}`)
    .join(' ')
  useEffect(() => {
    if (shape.length > 0) {
      // `arrived` and not `all`: this fires again every time a later file in the same drop answers,
      // and by then a reader may have unticked rows in the one that answered first.
      dispatch({ kind: 'arrived', files })
    }
    // `shape` stands in for `files`, which is rebuilt on every poll answer.
  }, [shape])

  const selected = importSelectionCount(selection)

  /**
   * Back to the drop target, keeping whatever is still being read.
   *
   * Only the refusals are forgotten. A reader who takes one file's refusal away has said nothing
   * about the other four, and the register is the only handle there is on a job id: dropping a
   * `ready` job would put a reading the workspace has already paid for out of reach before anyone
   * saw it, and a `stalled` one is not finished at all — it is a client-side poll budget running
   * out while the queue is still working. Neither has stopped.
   *
   * The selection is left alone for the same reason. Nothing with rows in it is forgotten here, so
   * there is nothing stale to clear, and clearing it would untick the rows of a file that stays on
   * screen — with no answer arriving afterwards to put them back.
   */
  const reset = (): void => {
    setStage({ kind: 'idle' })
    setRefusals([])
    forgetBookImports(
      userId,
      registered
        .filter((job) => progress.get(job.jobId) === 'refused')
        .map((job) => job.jobId),
    )
  }

  /**
   * The boundary refusal, and then one upload per accepted file.
   *
   * Sequential rather than parallel, for the reason the files screen is: the storage entitlement is
   * checked per request, so five simultaneous uploads would each be told there is room.
   */
  const take = async (picked: ReadonlyArray<File>): Promise<void> => {
    const said: Array<string> = []
    if (picked.length > MAX_IMPORT_FILES) {
      said.push(
        t('modules.book.import.refused.tooMany', { files: MAX_IMPORT_FILES }),
      )
    }
    const usable = picked.slice(0, MAX_IMPORT_FILES).filter((file) => {
      if (importFormatFor(file.name, file.type) === null) {
        said.push(
          t('modules.book.import.refused.format', { filename: file.name }),
        )
        return false
      }
      if (file.size === 0) {
        said.push(
          t('modules.book.import.refused.empty', { filename: file.name }),
        )
        return false
      }
      if (file.size > MAX_IMPORT_BYTES) {
        said.push(
          t('modules.book.import.refused.tooLarge', {
            filename: file.name,
            size: formatStorage(file.size),
            limit: formatStorage(MAX_IMPORT_BYTES),
          }),
        )
        return false
      }
      return true
    })

    setRefusals(said)
    if (usable.length === 0) {
      return
    }

    setStage({ kind: 'uploading', progress: 0 })
    const started: Array<BookImportJob> = []
    for (const [index, file] of usable.entries()) {
      const answer = await uploadFile({
        file,
        tripId,
        onProgress: (fraction) => {
          setStage({
            kind: 'uploading',
            progress: (index + fraction) / usable.length,
          })
        },
      })
      if (!answer.ok) {
        setStage({ kind: 'uploadFailed', filename: file.name })
        return
      }
      // The index is the queue's stagger, so five files do not all reach the model at once.
      const job = await start.run({
        data: { tripId, fileId: answer.file.id, index },
      })
      if (job === null) {
        setStage({ kind: 'uploadFailed', filename: file.name })
        return
      }
      // Registered as each one starts, not after the loop: a file that fails to upload returns
      // early, and the jobs already enqueued have spent the workspace's reading allowance. A
      // register written only on the way out would leave them running and invisible.
      // The stagger goes into the register too: the widget's stall budget is measured from the
      // job's scheduled start, and only the dialog that sent the index knows what it was.
      started.push({
        jobId: job.jobId,
        tripId,
        filename: file.name,
        delayMs: index * EXTRACTION_BUDGET_SECONDS * 1_000,
      })
      registerBookImports(userId, started)
    }
    setStage({ kind: 'reviewing' })
  }

  /** One call per file, and the register is cleared only when nothing is left to write. */
  const write = async (): Promise<void> => {
    let written = 0
    let left = 0
    for (const file of files) {
      const accept = acceptedImportRows(selection, file.jobId)
      if (accept.length === 0) {
        continue
      }
      const answer = await confirm.run({
        data: { tripId, jobId: file.jobId, accept },
      })
      if (answer === null) {
        left += accept.length
        continue
      }
      written += answer.written
      left += answer.remaining
    }

    await router.invalidate()
    if (left > 0) {
      // The poll stops asking about a job the moment it answers anything but `working`, so without
      // this the review list keeps rendering the answer from before the confirm — every row still
      // listed and still ticked, the ones just written among them, and "Add the rest" re-sending
      // their indices. `router.invalidate()` does not reach it: the drafts are this hook's own
      // state, not a loader's. Re-arming is what turns `written` on the staged record into what the
      // reader sees, which is how a partial confirm names the rows that are actually still failing.
      recheck()
      setStage({ kind: 'partial', written, total: written + left })
      return
    }
    forgetBookImports(
      userId,
      files.map((file) => file.jobId),
    )
    toast.success(t('modules.book.import.toast.added', { count: written }))
    setStage({ kind: 'idle' })
    dispatch({ kind: 'none' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('modules.book.import.title')}</DialogTitle>
          <DialogDescription>
            {t('modules.book.import.description')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex min-w-0 flex-col gap-5">
            {/*
             * No title: each line already names its file and says what is wrong with it, and the
             * only heading the catalogue could lend this list is one written for something else.
             */}
            {refusals.length === 0 ? null : (
              <Alert tone="warning">
                <ul className="flex flex-col gap-1">
                  {refusals.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {refusal?.refusal === undefined ? null : (
              <ImportRefusal
                code={refusal.refusal.code}
                ceiling={refusal.refusal.ceiling}
                filename={refusal.job.filename}
                onRetry={reset}
              />
            )}

            {stage.kind === 'uploadFailed' ? (
              <Alert
                tone="danger"
                title={t('modules.book.import.uploadFailed', {
                  filename: stage.filename,
                })}
                actions={
                  <Button
                    variant="secondary"
                    size="sm"
                    shape="pill"
                    onClick={reset}
                  >
                    {t('modules.book.import.uploadRetry')}
                  </Button>
                }
              />
            ) : null}

            {stage.kind === 'partial' ? (
              <Alert
                tone="warning"
                title={t('modules.book.import.partial.title', {
                  written: stage.written,
                  total: stage.total,
                })}
              >
                {t('modules.book.import.partial.body')}
              </Alert>
            ) : null}

            {refusal === undefined && (working || stalled) ? (
              <div aria-busy="true" className="flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((row) => (
                  <Skeleton key={row} className="h-14 w-full" />
                ))}
                {stalled ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    shape="pill"
                    className="self-start"
                    onClick={recheck}
                  >
                    {t('modules.book.import.widget.check')}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {files.length > 0 ? (
              <ReviewList
                files={files}
                multiple={files.length > 1}
                isSelected={(jobId, index) =>
                  isImportRowSelected(selection, jobId, index)
                }
                onToggle={(jobId, index) => {
                  dispatch({ kind: 'toggle', jobId, index })
                }}
                onAll={() => {
                  dispatch({ kind: 'all', files })
                }}
                onNone={() => {
                  dispatch({ kind: 'none' })
                }}
              />
            ) : refusal === undefined && !working && !stalled ? (
              <DropTarget
                dragging={dragging}
                progress={stage.kind === 'uploading' ? stage.progress : null}
                onDragging={setDragging}
                onFiles={(picked) => {
                  void take(picked)
                }}
              />
            ) : null}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.book.import.review.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            shape="pill"
            disabled={selected === 0}
            title={
              selected === 0
                ? t('modules.book.import.review.confirmNone')
                : undefined
            }
            loading={confirm.pending}
            loadingLabel={t('modules.book.import.review.confirm', {
              count: selected,
            })}
            onClick={() => {
              void write()
            }}
          >
            {selected === 0
              ? t('modules.book.import.review.confirmNone')
              : stage.kind === 'partial'
                ? t('modules.book.import.partial.retry')
                : t('modules.book.import.review.confirm', { count: selected })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------- the drop target */

/**
 * A `<button>` over a visually hidden `<input type="file">`.
 *
 * The input is a sibling rather than a child: interactive content inside a `<button>` is invalid
 * HTML and a second focus stop inside a control is exactly the trap the pattern was meant to avoid.
 * The button is what the keyboard reaches and what a drag lands on, and it opens the input — which
 * is how the files screen already does it.
 */
function DropTarget({
  dragging,
  progress,
  onDragging,
  onFiles,
}: {
  readonly dragging: boolean
  readonly progress: number | null
  readonly onDragging: (dragging: boolean) => void
  readonly onFiles: (files: ReadonlyArray<File>) => void
}) {
  const t = useTranslate()
  const [input, setInput] = useState<HTMLInputElement | null>(null)

  return (
    <>
      <input
        ref={setInput}
        type="file"
        multiple
        accept={IMPORT_ACCEPT_ATTRIBUTE}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])])
          // Cleared so choosing the same file twice in a row still fires.
          event.target.value = ''
        }}
      />
      <button
        type="button"
        data-part="import-drop"
        disabled={progress !== null}
        onClick={() => input?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          onDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          onDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          onDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          onDragging(false)
          onFiles([...event.dataTransfer.files])
        }}
        className={cn(
          'flex w-full flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-9 text-center',
          'transition-[background-color,border-color] duration-base ease-out-quint',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:cursor-progress disabled:opacity-70',
          dragging
            ? 'border-brand bg-brand-subtle'
            : 'border-edge-strong/60 bg-surface-2/40 hover:border-ink-4',
        )}
      >
        <span
          className={cn(
            'grid size-12 place-items-center rounded-full',
            dragging ? 'bg-brand text-brand-on' : 'bg-surface-2 text-ink-3',
          )}
        >
          <CloudUpload aria-hidden className="size-5" />
        </span>
        <span className="text-label font-semibold text-ink">
          {dragging
            ? t('modules.book.import.drop.active')
            : t('modules.book.import.drop.idle')}
        </span>
        <span className="text-caption text-ink-3">
          {t('modules.book.import.drop.formats')}
        </span>
        <span className="text-caption tabular-nums text-ink-4">
          {t('modules.book.import.drop.limits', {
            files: MAX_IMPORT_FILES,
            size: formatStorage(MAX_IMPORT_BYTES),
          })}
        </span>
        <span className="text-caption font-medium text-accent">
          {progress === null
            ? t('modules.book.import.drop.browse')
            : `${Math.round(progress * 100)}%`}
        </span>
      </button>
    </>
  )
}

/* ----------------------------------------------------------------- the refusals */

function ImportRefusal({
  code,
  ceiling,
  filename,
  onRetry,
}: {
  readonly code: string
  readonly ceiling: number | undefined
  readonly filename: string
  readonly onRetry: () => void
}) {
  const t = useTranslate()

  if (code === 'ceiling') {
    // No allowance at all is a different sentence from an allowance that is spent: one is a plan
    // this workspace does not have, the other is a month that renews.
    return ceiling === undefined || ceiling === 0 ? (
      <Alert tone="info" title={t('modules.book.import.ceiling.none')}>
        {t('modules.book.import.ceiling.noneBody')}
      </Alert>
    ) : (
      <Alert tone="info" title={t('modules.book.import.ceiling.title')}>
        {t('modules.book.import.ceiling.body', { ceiling })}
      </Alert>
    )
  }

  if (code === 'empty') {
    return (
      <Alert
        tone="warning"
        title={t('modules.book.import.empty.title')}
        actions={
          <Button variant="secondary" size="sm" shape="pill" onClick={onRetry}>
            {t('modules.book.import.failed.retry')}
          </Button>
        }
      >
        {t('modules.book.import.empty.body', { filename })}
      </Alert>
    )
  }

  return (
    <Alert
      tone="danger"
      title={t('modules.book.import.failed.title', { filename })}
      actions={
        <Button variant="secondary" size="sm" shape="pill" onClick={onRetry}>
          {t('modules.book.import.failed.retry')}
        </Button>
      }
    >
      {t('modules.book.import.failed.body')}
    </Alert>
  )
}

/* --------------------------------------------------------------- the review list */

function ReviewList({
  files,
  multiple,
  isSelected,
  onToggle,
  onAll,
  onNone,
}: {
  readonly files: ReadonlyArray<ImportFileDrafts>
  readonly multiple: boolean
  readonly isSelected: (jobId: string, index: number) => boolean
  readonly onToggle: (jobId: string, index: number) => void
  readonly onAll: () => void
  readonly onNone: () => void
}) {
  const t = useTranslate()

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-label font-medium text-ink">
        {t('modules.book.import.review.title')}
      </legend>

      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" shape="pill" onClick={onAll}>
          {t('modules.book.import.review.selectAll')}
        </Button>
        <Button variant="ghost" size="sm" shape="pill" onClick={onNone}>
          {t('modules.book.import.review.selectNone')}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {files.map((file) => (
          <div key={file.jobId} className="flex min-w-0 flex-col gap-2">
            {multiple ? (
              <p className="min-w-0 truncate text-caption font-medium text-ink-3">
                {t('modules.book.import.review.from', {
                  filename: file.filename,
                })}
              </p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {file.drafts.map((draft, position) => (
                <li
                  key={draft.index}
                  data-motion-enter=""
                  style={{
                    animationDelay: `${Math.min(position, 7) * 25}ms`,
                  }}
                >
                  <ReviewRow
                    draft={draft}
                    checked={isSelected(file.jobId, draft.index)}
                    onChange={() => onToggle(file.jobId, draft.index)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </fieldset>
  )
}

function ReviewRow({
  draft,
  checked,
  onChange,
}: {
  readonly draft: BookingImportDraft
  readonly checked: boolean
  readonly onChange: () => void
}) {
  const t = useTranslate()
  // `useId` and not the row's index: a reader can drop five files at once, and every file's rows
  // are numbered from zero — so an index-based id repeats across groups, and a `<label for>` then
  // ticks the first row that answers to it rather than the one beside the pointer.
  const id = useId()
  const facts = [
    draft.startDate,
    draft.startTime,
    draft.location,
    draft.reference,
  ]
    .filter((fact): fact is string => fact !== null && fact.length > 0)
    .join(' · ')

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-md border px-3 py-2',
        'transition-[background-color,border-color] duration-fast ease-out-quint',
        checked
          ? 'border-accent/40 bg-accent-subtle/40'
          : 'border-edge-faint bg-surface hover:border-edge-strong',
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-caption font-semibold text-ink">
            {draft.title.length === 0
              ? t('modules.book.import.review.untitled')
              : draft.title}
          </span>
          <Badge size="sm" tone="neutral">
            {t(bookingTypeLabel(draft.type))}
          </Badge>
          {draft.needsReview ? (
            <Badge
              size="sm"
              tone="warning"
              title={t('modules.book.import.review.needsReviewHint')}
            >
              {t('modules.book.import.review.needsReview')}
            </Badge>
          ) : null}
          {draft.priceMinor === null ? (
            <Badge
              size="sm"
              tone="neutral"
              title={t('modules.book.import.review.noPriceHint')}
            >
              {t('modules.book.import.review.noPrice')}
            </Badge>
          ) : null}
        </span>
        {facts.length === 0 ? null : (
          <span className="mt-0.5 block min-w-0 truncate text-caption tabular-nums text-ink-3">
            {facts}
          </span>
        )}
      </span>
    </label>
  )
}
