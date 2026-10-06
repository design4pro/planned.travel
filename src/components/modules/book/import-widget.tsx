/**
 * The global import widget, and the register it reads.
 *
 * The dialog that starts an import is on one trip's desk; the reading takes as long as a model
 * takes. So the job is written to `localStorage` and the widget is mounted in the application
 * shell: closing the dialog, walking to another trip and reloading the page all leave the work
 * running and still visible. Confirming is the only thing that ends a job.
 *
 * **Why it polls.** The frozen plan expects the trip room to carry the signal, but `useTripRoom`
 * is per trip and is mounted by `PresenceBar` on one screen, while this widget is global and
 * deliberately outlives the trip route — it has no trip to subscribe to. So it asks, every
 * {@link POLL_INTERVAL_MS}, for at most {@link POLL_BUDGET_MS} per job, and then stops and offers
 * **Check again**. Bounded, with a manual escape, rather than an unbounded poll against a queue.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FileSearch } from 'lucide-react'

import { Button, Card, Progress } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'

import type {
  BookingImportStatus,
  BookingImportView,
} from '#/server/fns/booking-import'

/** The product prefix, so a reader clearing site data knows what they are clearing. */
export const BOOK_IMPORTS_PREFIX = 'planned.book-imports'

/**
 * The register's key, per signed-in account.
 *
 * One global key was enough for as long as the register was per browser, and it is not: the widget
 * is mounted in the authenticated shell, a row is dropped only by a Dismiss click or a fully
 * successful confirm, and nothing clears it on sign-out. On a shared browser that put the previous
 * account's dropped `filename` — a hotel, a city, a name — in the next reader's shell, under a
 * Review link pointing at a trip that is not theirs. The staged rows were never at risk, because
 * the poll re-checks `orgId` and `tripId` server-side; the filename never reached the server at all.
 *
 * Keyed rather than cleared on sign-out, because the sign-out handlers are not the only way an
 * account stops being the one in front of the browser: a session expires, a tab is closed, a window
 * is left open. A key nobody else reads needs no handler to have run.
 */
export function bookImportsKey(userId: string): string {
  return `${BOOK_IMPORTS_PREFIX}:${userId}`
}

/**
 * Who a register belongs to: the account and the workspace it is working in.
 *
 * A job is staged against one workspace's trip, and the poll refuses it from any other. Keyed by the
 * account alone, a reader who switched workspaces kept seeing the previous workspace's jobs, every
 * poll was refused, the row went stalled, and Dismiss then forgot a reading that was still staged.
 * The shell and the dialog both pass this as their `userId`, so a register is only ever read by the
 * workspace that wrote it, and switching back finds it where it was left.
 */
export function bookImportsOwner(
  userId: string,
  organizationId: string | null,
): string {
  return `${userId}:${organizationId ?? ''}`
}

export const POLL_INTERVAL_MS = 2_000
/**
 * Per job, and generous against the extraction budget the queue handler works to. Counted from the
 * job's scheduled start, not the drop — see {@link BookImportJob.delayMs}.
 */
export const POLL_BUDGET_MS = 20_000
/** Long enough for the done state to be read and clicked, short enough not to be furniture. */
export const DONE_LINGER_MS = 12_000

/** One reading in flight: enough to poll it, name it and get back to it. */
export interface BookImportJob {
  readonly jobId: string
  readonly tripId: string
  readonly filename: string
  /**
   * How long the queue was told to sit on this job before starting it.
   *
   * A drop is staggered server-side by `index * EXTRACTION_BUDGET_SECONDS`, so the fourth file is
   * not dequeued for a minute after the first. {@link POLL_BUDGET_MS} is measured on top of this,
   * because a file that has not been started yet is not late — and a budget that ignored the
   * stagger would mark every file but the first `stalled` on every multi-file drop.
   *
   * Optional, and absent means none: a register row written before this field existed is still a
   * job worth polling.
   */
  readonly delayMs?: number
}

function isJob(value: unknown): value is BookImportJob {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const row = value as Record<string, unknown>
  return (
    typeof row.jobId === 'string' &&
    typeof row.tripId === 'string' &&
    typeof row.filename === 'string' &&
    (row.delayMs === undefined || typeof row.delayMs === 'number')
  )
}

/**
 * The jobs in the register, or none.
 *
 * Every unreadable state collapses to an empty list — no key, a `localStorage` that throws because
 * the reader disabled it, malformed JSON, a row written by a build that shaped it differently.
 * A notifier that throws on mount takes the whole shell with it, and the cost of forgetting a job
 * is one reader pressing Import again, not a lost booking: the staged record lives in KV for a day.
 */
export function readBookImports(userId: string): Array<BookImportJob> {
  try {
    const raw = window.localStorage.getItem(bookImportsKey(userId))
    if (raw === null) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isJob) : []
  } catch {
    return []
  }
}

function writeBookImports(
  userId: string,
  jobs: ReadonlyArray<BookImportJob>,
): void {
  try {
    window.localStorage.setItem(bookImportsKey(userId), JSON.stringify(jobs))
    // Same-tab listeners: `storage` only fires in the *other* tabs, and the widget and the dialog
    // are two components in this one. The account is in the event name as well as in the key, so a
    // register written for one account does not re-read another's.
    window.dispatchEvent(new Event(bookImportsKey(userId)))
  } catch {
    // A register that cannot be written costs the widget, not the import: the job is already
    // enqueued and the dialog that started it still has the id in its own state.
  }
}

/** Adds jobs to the register, replacing any entry with the same id. */
export function registerBookImports(
  userId: string,
  jobs: ReadonlyArray<BookImportJob>,
): void {
  const added = new Set(jobs.map((job) => job.jobId))
  writeBookImports(userId, [
    ...readBookImports(userId).filter((job) => !added.has(job.jobId)),
    ...jobs,
  ])
}

/** Drops jobs from the register — a confirmed import, or a refusal the reader has dismissed. */
export function forgetBookImports(
  userId: string,
  jobIds: ReadonlyArray<string>,
): void {
  const dropped = new Set(jobIds)
  writeBookImports(
    userId,
    readBookImports(userId).filter((job) => !dropped.has(job.jobId)),
  )
}

/** Re-reads the register on mount and on every write, from either component. */
export function useBookImports(userId: string): Array<BookImportJob> {
  const [jobs, setJobs] = useState<Array<BookImportJob>>([])

  useEffect(() => {
    const channel = bookImportsKey(userId)
    const sync = (): void => {
      setJobs(readBookImports(userId))
    }
    sync()
    window.addEventListener(channel, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(channel, sync)
      window.removeEventListener('storage', sync)
    }
  }, [userId])

  return jobs
}

/** What the widget knows about one job. `stalled` is the poll's budget spent, not a failure. */
export type BookImportProgress = BookingImportStatus | 'stalled'

export interface BookImportPoll {
  readonly progress: ReadonlyMap<string, BookImportProgress>
  /** The server's last answer per job — the drafts the review list renders, and the refusal. */
  readonly views: ReadonlyMap<string, BookingImportView>
  readonly recheck: () => void
}

/**
 * Polls every job that has not settled, and stops.
 *
 * One interval for the whole set rather than one per job: the answers are independent but the
 * cadence is not, and a reader who dropped five files should see one rhythm.
 *
 * Used by the widget over the register and by the dialog over its own jobs, so while the dialog is
 * open one KV key is read twice per tick. That is the price of the widget being independent of the
 * screen that started the job — which is the whole point of it — and it is bounded by the same
 * budget as everything else here.
 */
export function useBookImportPoll(
  jobs: ReadonlyArray<BookImportJob>,
): BookImportPoll {
  const [progress, setProgress] = useState<Map<string, BookImportProgress>>(
    new Map(),
  )
  const [views, setViews] = useState<Map<string, BookingImportView>>(new Map())
  const [attempt, setAttempt] = useState(0)
  const startedAt = useRef(new Map<string, number>())
  /*
   * The answers in a ref as well as in state, because the interval's closure is armed once per job
   * list and would otherwise keep reading the empty map it was created with — a poll that renders
   * "this is taking longer than expected" and carries on asking forever.
   */
  const answered = useRef(new Map<string, BookImportProgress>())

  const key = jobs.map((job) => job.jobId).join('\u0000')

  const recheck = useCallback(() => {
    startedAt.current = new Map()
    answered.current = new Map()
    setProgress(new Map())
    setAttempt((previous) => previous + 1)
  }, [])

  useEffect(() => {
    if (jobs.length === 0) {
      return
    }
    // An `AbortController` rather than a captured boolean: five jobs are asked one after another,
    // so the flag is read after an `await` inside a loop, and a boolean the compiler can see is
    // only ever assigned in the cleanup is a boolean it reads as constant.
    const lifetime = new AbortController()

    const ask = async (): Promise<void> => {
      const now = Date.now()
      for (const job of jobs) {
        const settled = answered.current.get(job.jobId)
        if (settled !== undefined && settled !== 'working') {
          continue
        }
        const since = startedAt.current.get(job.jobId) ?? now
        startedAt.current.set(job.jobId, since)

        // Loaded on the first ask rather than at the top of the file: the widget is mounted in the
        // authenticated shell, and a static import put the server function and its schema graph in
        // the bundle of every screen, whether or not a job was ever registered. A chunk that fails
        // to load is a call that failed, and is treated as one.
        const view = await import('#/server/fns/booking-import')
          .then(({ getBookingImportFn }) =>
            getBookingImportFn({
              data: { tripId: job.tripId, jobId: job.jobId },
            }),
          )
          .catch(() => null)
        // Checked after the answer and nowhere else: an unmounted widget must not set state, and
        // the loop is abandoned rather than continued because every remaining job is in the same
        // position.
        if (lifetime.signal.aborted) {
          return
        }
        // A call that failed is not an answer: the next tick asks again, and the budget is what
        // stops that from going on forever — for a rejected call as much as for a slow queue.
        // Offline, an expired session, a trip that was deleted: all of them reject on every tick,
        // and a job pinned at `working` by them is a card with no button on it on every screen of
        // the product, for good, because the register outlives the page.
        const spent = now - since >= POLL_BUDGET_MS + (job.delayMs ?? 0)
        const answer =
          spent && (view === null || view.status === 'working')
            ? 'stalled'
            : (view?.status ?? 'working')
        answered.current.set(job.jobId, answer)
        setProgress(new Map(answered.current))
        if (view !== null) {
          setViews((previous) => new Map(previous).set(job.jobId, view))
        }
      }
    }

    void ask()
    const timer = window.setInterval(() => {
      void ask()
    }, POLL_INTERVAL_MS)
    return () => {
      lifetime.abort()
      window.clearInterval(timer)
    }
    // `key` stands in for the job list, which is a fresh array on every register read. Nothing
    // else belongs here: re-arming the interval on every answer would reset the cadence each time
    // one of five files came back.
  }, [key, attempt])

  return { progress, views, recheck }
}

/**
 * The shell's import notifier.
 *
 * Mounted once, last in the authenticated shell's subtree in `src/routes/_app/route.tsx`. It
 * renders nothing at all until a job is registered, so every screen in the product pays one empty
 * component for it — in the render and in the bundle: the server function it polls is imported
 * dynamically, on the first ask, so its schema graph stays out of the shell's chunk.
 *
 * `userId` is the register's owner, a {@link bookImportsOwner} of the shell's account and
 * workspace, so it comes from the shell's session rather than from a read of its own — see
 * {@link bookImportsKey}.
 */
export function BookImportWidget({ userId }: { readonly userId: string }) {
  const t = useTranslate()
  const navigate = useNavigate()
  const jobs = useBookImports(userId)
  const { progress, views, recheck } = useBookImportPoll(jobs)
  const [dismissed, setDismissed] = useState<ReadonlyArray<string>>([])

  const shown = jobs.filter((job) => !dismissed.includes(job.jobId))
  const statusOf = (job: BookImportJob): BookImportProgress =>
    progress.get(job.jobId) ?? 'working'

  const working = shown.filter((job) => statusOf(job) === 'working')
  const stalled = shown.filter((job) => statusOf(job) === 'stalled')
  const ready = shown.filter((job) => statusOf(job) === 'ready')
  const refused = shown.filter((job) => statusOf(job) === 'refused')
  const settled = shown.length - working.length

  const first = ready.at(0)
  const done = working.length === 0 && stalled.length === 0 && ready.length > 0

  /*
   * The done state dismisses itself; the failed state does not. A failure nobody saw is a failure
   * that gets reported as lost data, so it stays until a reader takes it away — and a reader who
   * has already opened the review does not need the badge that told them to.
   */
  useEffect(() => {
    if (!done || first === undefined) {
      return
    }
    const timer = window.setTimeout(() => {
      setDismissed((previous) => [
        ...previous,
        ...ready.map((job) => job.jobId),
      ])
    }, DONE_LINGER_MS)
    return () => {
      window.clearTimeout(timer)
    }
    // The ready set is identified by its first job: the list is rebuilt on every register read, and
    // re-arming the timer on each one would keep the done state on screen indefinitely.
  }, [done, first?.jobId])

  if (shown.length === 0) {
    return null
  }

  const failure = refused.at(0)
  const reading = working.at(0)
  const total = shown.length

  return (
    /*
     * Above the "Report a problem" actor, not beside it.
     *
     * That actor is anchored to this same corner and mirrors with the text direction, and
     * `src/routes/__root.tsx` already writes down what happens when two floating controls share
     * pixels: one of them cannot be clicked. At `lg:bottom-6` it covered the Review button
     * outright, which the blind pair caught. The terms are the actor's own, as `#sentry-feedback`
     * in `src/styles/styles.css` sets them: its row starts at `1px + 4rem + var(--safe-bottom)`
     * below `lg` and at 0 above it, and it is a 2.5rem pill inside a 1rem inset. So clearing it is
     * that row plus 3.5rem, plus 1rem of air.
     */
    <div
      aria-live="polite"
      data-part="book-import-widget"
      className="fixed end-4 bottom-[calc(var(--safe-bottom)+8.5rem)] z-dropdown w-[min(20rem,calc(100vw-2rem))] lg:bottom-[4.5rem]"
    >
      <Card
        padding="sm"
        className="flex min-w-0 flex-col gap-3 shadow-elevated"
      >
        <p className="flex min-w-0 items-center gap-2">
          <FileSearch aria-hidden className="size-4 shrink-0 text-ink-3" />
          <span className="min-w-0 truncate text-label font-semibold text-ink">
            {t('modules.book.import.widget.title')}
          </span>
        </p>

        {failure !== undefined ? (
          <p className="min-w-0 text-caption text-danger">
            {t('modules.book.import.widget.failed', {
              filename: failure.filename,
            })}
          </p>
        ) : done ? (
          <p className="text-caption text-ink-2">
            {t('modules.book.import.widget.done', {
              count: ready.reduce(
                (sum, job) => sum + (views.get(job.jobId)?.staged?.count ?? 0),
                0,
              ),
            })}
          </p>
        ) : stalled.length > 0 ? (
          <p className="text-caption text-ink-2">
            {t('modules.book.import.widget.stalled')}
          </p>
        ) : (
          <>
            <Progress
              value={settled}
              max={total}
              size="sm"
              tone="brand"
              label={t('modules.book.import.widget.working', {
                done: settled,
                total,
              })}
            />
            {reading === undefined ? null : (
              <p className="min-w-0 truncate text-caption text-ink-3">
                {t('modules.book.import.widget.file', {
                  filename: reading.filename,
                })}
              </p>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-2">
          {stalled.length > 0 && failure === undefined ? (
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={recheck}
            >
              {t('modules.book.import.widget.check')}
            </Button>
          ) : null}
          {/*
           * A stalled job is dismissible too, and that is not a convenience. The register is in
           * `localStorage` and only a dismissal or a confirm takes an entry out of it, so a job
           * that never answers — a staged record that expired, a read that was dead-lettered —
           * would otherwise hold this card on every screen of the product for good, with
           * **Check again** as the only thing a reader could press.
           */}
          {failure === undefined && stalled.length === 0 ? null : (
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => {
                forgetBookImports(
                  userId,
                  [...refused, ...stalled].map((job) => job.jobId),
                )
              }}
            >
              {t('modules.book.import.widget.dismiss')}
            </Button>
          )}
          {first === undefined ? null : (
            <Button
              variant="primary"
              size="sm"
              shape="pill"
              onClick={() => {
                void navigate({
                  to: '/trips/$tripId/book',
                  params: { tripId: first.tripId },
                  search: { import: first.jobId },
                })
              }}
            >
              {t('modules.book.import.widget.review')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
