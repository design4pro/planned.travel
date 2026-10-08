/**
 * The booking import job, end to end, on the client.
 *
 * One confirmation file's life — dropped, uploaded, started, read, then ready, refused or stalled,
 * partly written, confirmed or dismissed — used to be split between a hook in the widget, three
 * handlers in the dialog and the `arrived` case of the selection reducer. Three fixes in a row
 * landed in how those called each other (`3c18b4b1`, `81464f2c`, `329e3056`). This module owns all
 * of it, so the widget and the dialog only render what it says and send what the reader did.
 *
 * **The job is written to `localStorage` and the store is mounted by whoever shows it.** The dialog
 * that starts an import is on one trip's desk; the reading takes as long as a model takes. So the
 * jobs are in a register, and the widget is mounted in the application shell: closing the dialog,
 * walking to another trip and reloading the page all leave the work running and still visible.
 * Confirming, or a Dismiss, is what ends a job.
 *
 * **Why it polls.** The frozen plan expects the trip room to carry the signal, but `useTripRoom` is
 * per trip and is mounted on one screen, while the widget is global and deliberately outlives the
 * trip route — it has no trip to subscribe to. So the store asks, every {@link POLL_INTERVAL_MS},
 * for at most {@link POLL_BUDGET_MS} per job, and then stops and offers **Check again**. Bounded,
 * with a manual escape, rather than an unbounded poll against a queue.
 *
 * **One store per owner, one poll per job.** The widget and the dialog read the same store through
 * {@link useBookImports}, so a staged record is read once per tick however many components show it.
 * The store is module-level and not a provider on purpose: the widget lives in the shell and the
 * dialog on a trip desk, and a provider would bind one to the other.
 *
 * **Nothing here imports the server at run time.** The widget is in the bundle of every screen, so
 * the port's default adapter loads the server functions (and the upload helper, which imports one)
 * with `import()` on first use. Types are erased, so `import type` is fine.
 */
import { useSyncExternalStore } from 'react'

import { acceptedImportRows, groupImportDrafts } from './import-drafts'

import type { ImportFileDrafts, ImportSelection } from './import-drafts'
import type {
  BookingImportDraft,
  BookingImportStatus,
  BookingImportView,
  ConfirmedBookingImport,
  StartedBookingImport,
} from '#/server/fns/booking-import'

/* ------------------------------------------------------------------ the register */

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

/** One reading in flight: enough to poll it, name it and get back to it. */
export interface BookImportJob {
  readonly jobId: string
  readonly tripId: string
  readonly filename: string
  /**
   * How long the queue was told to sit on this job before starting it.
   *
   * A drop is staggered server-side, which hands each file's delay back in the start answer, so the
   * fourth file is not dequeued for a minute after the first. {@link POLL_BUDGET_MS} is measured on top of this,
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
  } catch {
    // A register that cannot be written costs the widget after a reload, not the import: the job is
    // already enqueued and the store that started it still holds it for as long as the page lives.
  }
}

/* --------------------------------------------------------------------- the port */

/**
 * What the job needs from the server: four verbs, nothing else.
 *
 * Failures reject, and the store decides what a rejection means for each — a failed `view` is a call
 * that was not an answer, a failed `start` or `confirm` is handed back to the caller to word.
 */
export interface BookImportPort {
  /** The id of the stored file, or `null` when it did not upload. Never rejects in practice. */
  readonly upload: (input: {
    readonly file: File
    readonly tripId: string
    readonly onProgress: (fraction: number) => void
  }) => Promise<{ readonly fileId: string } | null>
  readonly start: (input: {
    readonly tripId: string
    readonly fileId: string
    readonly index: number
  }) => Promise<StartedBookingImport>
  readonly view: (input: {
    readonly tripId: string
    readonly jobId: string
  }) => Promise<BookingImportView>
  readonly confirm: (input: {
    readonly tripId: string
    readonly jobId: string
    readonly accept: Array<number>
  }) => Promise<ConfirmedBookingImport>
}

/**
 * Loaded on first use rather than at the top of the file: a static import put the server functions
 * and their schema graph in the bundle of every screen, whether or not a job was ever registered.
 * A chunk that fails to load is a call that failed, and is treated as one.
 */
const importServerFns = () => import('#/server/fns/booking-import')
let serverFns: ReturnType<typeof importServerFns> | undefined

/**
 * One load shared by every call that is waiting for it, the poll's and a drop's alike. A load that
 * fails is forgotten, so the next call tries the chunk again.
 */
function loadServerFns(): ReturnType<typeof importServerFns> {
  serverFns ??= importServerFns().catch((cause: unknown) => {
    serverFns = undefined
    throw cause
  })
  return serverFns
}

const serverPort: BookImportPort = {
  upload: async ({ file, tripId, onProgress }) => {
    const { uploadFile } = await import('../files/upload')
    const answer = await uploadFile({ file, tripId, onProgress })
    return answer.ok ? { fileId: answer.file.id } : null
  },
  start: async (data) => {
    const { startBookingImportFn } = await loadServerFns()
    return startBookingImportFn({ data })
  },
  view: async (data) => {
    const { getBookingImportFn } = await loadServerFns()
    return getBookingImportFn({ data })
  },
  confirm: async (data) => {
    const { confirmBookingImportFn } = await loadServerFns()
    return confirmBookingImportFn({ data })
  },
}

/* --------------------------------------------------------------------- the view */

/** What the store knows about one job. `stalled` is the poll's budget spent, not a failure. */
export type BookImportProgress = BookingImportStatus | 'stalled'

/** One job as a component renders it. */
export interface BookImportEntry {
  readonly job: BookImportJob
  readonly status: BookImportProgress
  /** Why the server refused the file, as a code the catalogue words. */
  readonly refusal: BookingImportView['refusal']
  /** The staged record's row count, written rows included; `0` until it has been read. */
  readonly count: number
  /**
   * The rows still on offer: the staged rows a confirm has not written yet.
   *
   * This is the only place that rule lives. The server's `staged.drafts` keeps listing every row and
   * `staged.written` names the ones a confirm took, so a retry after a partial failure offers, and
   * writes, only the rest.
   */
  readonly drafts: ReadonlyArray<BookingImportDraft>
}

export interface BookImportSnapshot {
  readonly entries: ReadonlyArray<BookImportEntry>
}

/** What a server render and the first client render see: no register, because there is no browser. */
const EMPTY_SNAPSHOT: BookImportSnapshot = { entries: [] }

/** How a drop ended. A failure names the file the drop stopped at; the jobs before it keep running. */
export type StartDropOutcome =
  | { readonly kind: 'started' }
  | { readonly kind: 'uploadFailed'; readonly filename: string }
  | {
      readonly kind: 'startFailed'
      readonly filename: string
      readonly cause: unknown
    }

export interface StartDropInput {
  readonly tripId: string
  readonly files: ReadonlyArray<File>
  /** `0`–`1` across the whole drop, not one file. */
  readonly onProgress?: (fraction: number) => void
  /** Awaited after each accepted start, once its job is registered — the loaders' refresh. */
  readonly afterStart?: () => Promise<void>
}

export interface ConfirmInput {
  readonly tripId: string
  readonly selection: ImportSelection
  /** Awaited after the last write and before the jobs are re-read or forgotten. */
  readonly afterWritten?: () => Promise<void>
}

export interface ConfirmOutcome {
  readonly written: number
  /** Accepted rows still to write, the ones whose call was rejected included. */
  readonly left: number
  /** Why each rejected call failed, for the caller to word. */
  readonly failures: ReadonlyArray<unknown>
}

export interface BookImportJobs {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => BookImportSnapshot
  readonly getServerSnapshot: () => BookImportSnapshot
  /** Uploads and starts each file, registering each job as it starts. */
  readonly startDrop: (input: StartDropInput) => Promise<StartDropOutcome>
  /** One call per file with rows ticked; re-reads after a partial write, forgets after a full one. */
  readonly confirm: (input: ConfirmInput) => Promise<ConfirmOutcome>
  /**
   * Gives a job a fresh budget and asks again. For one trip's jobs, or for all of them.
   *
   * What the server last said about a job stays on screen until the new answer replaces it.
   */
  readonly recheck: (tripId?: string) => void
  /**
   * Another file: forgets the refused jobs, of one trip when named.
   *
   * Only the refusals. A reader who takes one file's refusal away has said nothing about the
   * others, and the register is the only handle there is on a job id: forgetting a `ready` job
   * would put a reading the workspace has already paid for out of reach before anyone saw it, and
   * a `stalled` one is not finished at all — it is a client-side budget running out while the queue
   * is still working.
   */
  readonly forgetRefused: (tripId?: string) => void
  /**
   * Dismiss: forgets the refused and the stalled jobs ({@link isDismissible}).
   *
   * A stalled job is dismissible too, and that is not a convenience. The register is in
   * `localStorage` and only a dismissal or a confirm takes an entry out of it, so a job that never
   * answers — a staged record that expired, a read that was dead-lettered — would otherwise hold
   * the widget on every screen of the product for good, with **Check again** as the only thing a
   * reader could press.
   */
  readonly dismiss: () => void
  /** Stops polling and lets go of every listener. For teardown. */
  readonly dispose: () => void
}

/* --------------------------------------------------------------------- the store */

interface Answer {
  readonly status: BookImportProgress
  readonly view: BookingImportView | undefined
}

/**
 * Whether Dismiss may forget the entry: a refusal, or a stall with nothing left to write.
 *
 * A stalled job that still has rows on offer is a confirm's re-read that has not been answered, not
 * a job that never answered: the register is the only handle on its job id, so forgetting it would
 * put rows the reader has not written out of reach. **Check again** is what such a job offers.
 */
export function isDismissible(entry: BookImportEntry): boolean {
  return (
    entry.status === 'refused' ||
    (entry.status === 'stalled' && entry.drafts.length === 0)
  )
}

function isOpen(answer: Answer | undefined): boolean {
  return answer === undefined || answer.status === 'working'
}

/**
 * A store for one owner's register.
 *
 * @param owner a {@link bookImportsOwner}
 * @param port the server, or a fake of it
 */
export function createBookImportJobs(
  owner: string,
  port: BookImportPort,
): BookImportJobs {
  const listeners = new Set<() => void>()
  const answers = new Map<string, Answer>()
  const startedAt = new Map<string, number>()
  let register: ReadonlyArray<BookImportJob> = readBookImports(owner)
  let timer: ReturnType<typeof setInterval> | undefined
  // Bumped whenever the poll is re-armed or stopped, so an answer to a question asked before is
  // dropped instead of written over the state that replaced it.
  let generation = 0

  function build(): BookImportSnapshot {
    return {
      entries: register.map((job) => {
        const answer = answers.get(job.jobId)
        const staged = answer?.view?.staged
        const written = new Set(staged?.written)
        return {
          job,
          status: answer?.status ?? 'working',
          refusal: answer?.view?.refusal,
          count: staged?.count ?? 0,
          drafts:
            staged?.drafts.filter((draft) => !written.has(draft.index)) ?? [],
        }
      }),
    }
  }

  let snapshot = build()

  function emit(): void {
    snapshot = build()
    for (const listener of [...listeners]) {
      listener()
    }
  }

  function stop(): void {
    generation += 1
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  /**
   * Asks about every job that has not settled, one after another.
   *
   * One interval for the whole register rather than one per job: the answers are independent but
   * the cadence is not, and a reader who dropped five files should see one rhythm.
   */
  async function ask(mine: number): Promise<void> {
    const now = Date.now()
    for (const job of register) {
      if (!isOpen(answers.get(job.jobId))) {
        continue
      }
      const since = startedAt.get(job.jobId) ?? now
      startedAt.set(job.jobId, since)

      const view = await port
        .view({ tripId: job.tripId, jobId: job.jobId })
        .catch(() => null)
      // Checked after the answer and nowhere else: a store nobody is watching must not be written
      // to, and the loop is abandoned rather than continued because every remaining job is in the
      // same position.
      if (mine !== generation) {
        return
      }
      // A call that failed is not an answer: the next tick asks again, and the budget is what stops
      // that from going on forever — for a rejected call as much as for a slow queue. Offline, an
      // expired session, a trip that was deleted: all of them reject on every tick, and a job pinned
      // at `working` by them is a card with no button on it on every screen of the product, for
      // good, because the register outlives the page.
      const spent = now - since >= POLL_BUDGET_MS + (job.delayMs ?? 0)
      const status: BookImportProgress =
        spent && (view === null || view.status === 'working')
          ? 'stalled'
          : (view?.status ?? 'working')
      answers.set(job.jobId, {
        status,
        view: view ?? answers.get(job.jobId)?.view,
      })
      emit()
    }
    if (
      mine === generation &&
      !register.some((job) => isOpen(answers.get(job.jobId)))
    ) {
      stop()
    }
  }

  /** (Re)starts the poll from now: an immediate ask, then one per interval, while anything is open. */
  function arm(): void {
    stop()
    if (
      listeners.size === 0 ||
      !register.some((job) => isOpen(answers.get(job.jobId)))
    ) {
      return
    }
    const mine = generation
    void ask(mine)
    timer = setInterval(() => {
      void ask(mine)
    }, POLL_INTERVAL_MS)
  }

  function setRegister(jobs: ReadonlyArray<BookImportJob>): void {
    register = jobs
    writeBookImports(owner, jobs)
    const kept = new Set(jobs.map((job) => job.jobId))
    for (const jobId of [...answers.keys()]) {
      if (!kept.has(jobId)) {
        answers.delete(jobId)
        startedAt.delete(jobId)
      }
    }
    emit()
    arm()
  }

  function forgetWhere(forgets: (entry: BookImportEntry) => boolean): void {
    const gone = new Set(
      snapshot.entries.filter(forgets).map((entry) => entry.job.jobId),
    )
    if (gone.size === 0) {
      return
    }
    setRegister(register.filter((job) => !gone.has(job.jobId)))
  }

  function addJobs(jobs: ReadonlyArray<BookImportJob>): void {
    const added = new Set(jobs.map((job) => job.jobId))
    setRegister([...register.filter((job) => !added.has(job.jobId)), ...jobs])
  }

  /** Another tab wrote the register: `storage` fires only in the tabs that did not. */
  function onStorage(event: StorageEvent): void {
    if (event.key !== null && event.key !== bookImportsKey(owner)) {
      return
    }
    register = readBookImports(owner)
    emit()
    arm()
  }

  function offeredFiles(tripId: string): Array<ImportFileDrafts> {
    return groupImportDrafts(
      snapshot.entries
        .filter((entry) => entry.job.tripId === tripId)
        .map((entry) => ({
          jobId: entry.job.jobId,
          filename: entry.job.filename,
          drafts: entry.drafts,
        })),
    )
  }

  function recheck(tripId?: string): void {
    for (const job of register) {
      if (tripId !== undefined && job.tripId !== tripId) {
        continue
      }
      startedAt.delete(job.jobId)
      answers.set(job.jobId, {
        status: 'working',
        view: answers.get(job.jobId)?.view,
      })
    }
    emit()
    arm()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        // Another tab may have written while nobody was watching.
        register = readBookImports(owner)
        snapshot = build()
        window.addEventListener('storage', onStorage)
        arm()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          window.removeEventListener('storage', onStorage)
          stop()
          // What the server last said is not worth keeping for a store nobody shows: the next
          // watcher starts a fresh budget and asks again, as a freshly mounted screen always did.
          answers.clear()
          startedAt.clear()
          snapshot = build()
        }
      }
    },

    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY_SNAPSHOT,

    async startDrop({ tripId, files, onProgress, afterStart }) {
      const started: Array<BookImportJob> = []
      for (const [index, file] of files.entries()) {
        const uploaded = await port
          .upload({
            file,
            tripId,
            onProgress: (fraction) => {
              onProgress?.((index + fraction) / files.length)
            },
          })
          .catch(() => null)
        if (uploaded === null) {
          return { kind: 'uploadFailed', filename: file.name }
        }
        let job: StartedBookingImport
        try {
          // The index is the queue's stagger, so five files do not all reach the model at once.
          job = await port.start({ tripId, fileId: uploaded.fileId, index })
        } catch (cause) {
          return { kind: 'startFailed', filename: file.name, cause }
        }
        // Registered as each one starts, not after the loop: a file that fails to upload returns
        // early, and the jobs already enqueued have spent the workspace's reading allowance. A
        // register written only on the way out would leave them running and invisible. For the same
        // reason it comes before the caller's hook: a hook that fails does not un-start the job.
        // The stagger goes into the register too: the stall budget is measured from the job's
        // scheduled start, and the server's answer is the only place that states it.
        started.push({
          jobId: job.jobId,
          tripId,
          filename: file.name,
          delayMs: (job.delaySeconds ?? 0) * 1_000,
        })
        addJobs(started)
        try {
          await afterStart?.()
        } catch (cause) {
          return { kind: 'startFailed', filename: file.name, cause }
        }
      }
      return { kind: 'started' }
    },

    async confirm({ tripId, selection, afterWritten }) {
      const files = offeredFiles(tripId)
      let written = 0
      let left = 0
      const failures: Array<unknown> = []
      for (const file of files) {
        const accept = acceptedImportRows(selection, file.jobId)
        if (accept.length === 0) {
          continue
        }
        try {
          const answer = await port.confirm({
            tripId,
            jobId: file.jobId,
            accept,
          })
          written += answer.written
          left += answer.remaining
        } catch (cause) {
          failures.push(cause)
          left += accept.length
        }
      }

      try {
        await afterWritten?.()
      } finally {
        // Settled whether or not the hook worked: the writes happened, and the register has to
        // say so.
        if (left > 0) {
          // The poll stops asking about a job the moment it answers anything but `working`, so
          // without this the review list keeps rendering the answer from before the confirm — every
          // row still listed and still ticked, the ones just written among them, and "Add the rest"
          // re-sending their indices. Re-arming is what turns `written` on the staged record into
          // what the reader sees, which is how a partial confirm names the rows that are actually
          // still failing.
          recheck(tripId)
        } else {
          const done = new Set(files.map((file) => file.jobId))
          forgetWhere((entry) => done.has(entry.job.jobId))
        }
      }
      return { written, left, failures }
    },

    recheck,

    forgetRefused(tripId) {
      forgetWhere(
        (entry) =>
          entry.status === 'refused' &&
          (tripId === undefined || entry.job.tripId === tripId),
      )
    },

    dismiss() {
      forgetWhere(isDismissible)
    },

    dispose() {
      listeners.clear()
      window.removeEventListener('storage', onStorage)
      stop()
    },
  }
}

/* -------------------------------------------------------------------- the registry */

const stores = new Map<string, BookImportJobs>()

/**
 * The one store for an owner, shared by every component that shows its jobs.
 *
 * On the server there is no register and nothing subscribes, so nothing is kept: a map of owners
 * that outlives the request would only be a leak.
 */
export function bookImportJobs(owner: string): BookImportJobs {
  if (typeof window === 'undefined') {
    return createBookImportJobs(owner, serverPort)
  }
  const known = stores.get(owner)
  if (known !== undefined) {
    return known
  }
  const created = createBookImportJobs(owner, serverPort)
  stores.set(owner, created)
  return created
}

/** Lets go of every store, so a test starts from an empty register and no timers. */
export function resetBookImportJobs(): void {
  for (const store of stores.values()) {
    store.dispose()
  }
  stores.clear()
}

/**
 * The owner's jobs, and the store to act on them with.
 *
 * `useSyncExternalStore`, not an effect that copies the register into state: the snapshot is the
 * same object until something changes, the server and the first client render both see the one
 * empty constant, and two components reading the same owner can never disagree.
 */
export function useBookImports(owner: string): {
  readonly entries: ReadonlyArray<BookImportEntry>
  readonly jobs: BookImportJobs
} {
  const jobs = bookImportJobs(owner)
  const { entries } = useSyncExternalStore(
    jobs.subscribe,
    jobs.getSnapshot,
    jobs.getServerSnapshot,
  )
  return { entries, jobs }
}
