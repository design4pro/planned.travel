import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  POLL_BUDGET_MS,
  POLL_INTERVAL_MS,
  bookImportJobs,
  bookImportsKey,
  createBookImportJobs,
  isDismissible,
  readBookImports,
  resetBookImportJobs,
} from '../import-jobs'

import type { Mock } from 'vitest'
import type { BookImportJobs, BookImportPort } from '../import-jobs'
import type {
  BookingImportDraft,
  BookingImportView,
} from '#/server/fns/booking-import'

/**
 * The job module, through its interface: a fake server port and a fake clock, no component.
 *
 * Everything the widget and the dialog used to decide between them is asserted here once — the
 * register, the stall budget, the staggered start, the re-read after a partial confirm and the two
 * ways a job is forgotten — so the two components can be thin enough to test as renderers.
 */
const OWNER = 'user-1:org-1'
const TRIP = 'trip-1'

const WORKING: BookingImportView = { status: 'working' }

function draft(index: number): BookingImportDraft {
  return {
    index,
    type: 'accommodation',
    title: `Row ${index}`,
    location: null,
    reference: null,
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    priceMinor: null,
    currency: null,
    needsReview: false,
  }
}

function ready(written: ReadonlyArray<number> = []): BookingImportView {
  return {
    status: 'ready',
    staged: {
      format: 'document',
      count: 2,
      written,
      drafts: [draft(0), draft(1)],
    },
  }
}

interface FakePort extends BookImportPort {
  readonly upload: Mock<BookImportPort['upload']>
  readonly start: Mock<BookImportPort['start']>
  readonly view: Mock<BookImportPort['view']>
  readonly confirm: Mock<BookImportPort['confirm']>
}

function fakePort(): FakePort {
  return {
    upload: vi.fn<BookImportPort['upload']>(),
    start: vi.fn<BookImportPort['start']>(),
    // Still reading unless a test says otherwise.
    view: vi.fn<BookImportPort['view']>().mockResolvedValue(WORKING),
    confirm: vi.fn<BookImportPort['confirm']>(),
  }
}

function register(
  jobs: ReadonlyArray<Record<string, unknown>>,
  owner = OWNER,
): void {
  window.localStorage.setItem(bookImportsKey(owner), JSON.stringify(jobs))
}

function row(name: string, extra: Record<string, unknown> = {}) {
  return {
    jobId: `booking-import:${TRIP}:${name}`,
    tripId: TRIP,
    filename: `${name}.pdf`,
    ...extra,
  }
}

const jobId = (name: string): string => `booking-import:${TRIP}:${name}`

/** A store somebody is looking at: nothing is polled for an unwatched one. */
function watched(port: FakePort, owner = OWNER): BookImportJobs {
  const jobs = createBookImportJobs(owner, port)
  jobs.subscribe(() => {})
  return jobs
}

function statusOf(jobs: BookImportJobs, name: string): string | undefined {
  return jobs
    .getSnapshot()
    .entries.find((entry) => entry.job.jobId === jobId(name))?.status
}

async function tick(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

function file(name: string): File {
  return new File(['x'], name, { type: 'application/pdf' })
}

beforeEach(() => {
  window.localStorage.clear()
  resetBookImportJobs()
  vi.useFakeTimers()
})

afterEach(() => {
  resetBookImportJobs()
  vi.useRealTimers()
})

describe('the register', () => {
  it('loads a row written by the previous bundle, which knew a delay and nothing newer', () => {
    register([row('old', { delayMs: 20_000 })])

    const jobs = createBookImportJobs(OWNER, fakePort())

    expect(jobs.getSnapshot().entries.map((entry) => entry.job)).toEqual([
      row('old', { delayMs: 20_000 }),
    ])
    expect(readBookImports(OWNER)).toHaveLength(1)
  })

  it('loads a row written before the delay existed', () => {
    register([row('older')])

    const jobs = createBookImportJobs(OWNER, fakePort())

    expect(jobs.getSnapshot().entries).toHaveLength(1)
  })

  it('collapses every unreadable state to an empty register', () => {
    window.localStorage.setItem(bookImportsKey(OWNER), '{not json')
    expect(
      createBookImportJobs(OWNER, fakePort()).getSnapshot().entries,
    ).toEqual([])

    register([{ jobId: 7 }, row('good')])
    expect(
      createBookImportJobs(OWNER, fakePort())
        .getSnapshot()
        .entries.map((entry) => entry.job.jobId),
    ).toEqual([jobId('good')])
  })

  it('keeps one register per account and workspace', () => {
    register([row('mine')])

    const other = createBookImportJobs('user-2:org-1', fakePort())

    expect(other.getSnapshot().entries).toEqual([])
    expect(readBookImports(OWNER)).toHaveLength(1)
  })

  it('re-reads the register when another tab writes it', () => {
    const jobs = watched(fakePort())
    expect(jobs.getSnapshot().entries).toEqual([])

    register([row('elsewhere')])
    window.dispatchEvent(
      new StorageEvent('storage', { key: bookImportsKey(OWNER) }),
    )

    expect(jobs.getSnapshot().entries).toHaveLength(1)
  })
})

describe('the store', () => {
  it('hands out one store per owner and a new one after a reset', () => {
    const first = bookImportJobs(OWNER)

    expect(bookImportJobs(OWNER)).toBe(first)
    expect(bookImportJobs('user-2:org-1')).not.toBe(first)

    resetBookImportJobs()
    expect(bookImportJobs(OWNER)).not.toBe(first)
  })

  it('keeps a snapshot referentially stable until something changes', async () => {
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValue(WORKING)
    const jobs = createBookImportJobs(OWNER, port)
    const notified = vi.fn()

    expect(jobs.getSnapshot()).toBe(jobs.getSnapshot())

    jobs.subscribe(notified)
    const before = jobs.getSnapshot()
    expect(jobs.getSnapshot()).toBe(before)

    await tick(0)
    const after = jobs.getSnapshot()
    expect(after).not.toBe(before)
    expect(notified).toHaveBeenCalled()
    expect(jobs.getSnapshot()).toBe(after)
  })

  it('has a server snapshot that is always the one constant', () => {
    register([row('a')])
    const jobs = createBookImportJobs(OWNER, fakePort())

    expect(jobs.getServerSnapshot()).toBe(jobs.getServerSnapshot())
    expect(jobs.getServerSnapshot().entries).toEqual([])
    expect(jobs.getServerSnapshot()).toBe(
      createBookImportJobs('user-2:org-1', fakePort()).getServerSnapshot(),
    )
  })

  it('asks about a job with its trip and job ids', async () => {
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValue(WORKING)

    watched(port)
    await tick(0)

    expect(port.view).toHaveBeenCalledWith({ tripId: TRIP, jobId: jobId('a') })
  })

  it('runs one poll per job however many components are watching', async () => {
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValue(WORKING)
    const jobs = createBookImportJobs(OWNER, port)

    jobs.subscribe(() => {})
    jobs.subscribe(() => {})
    jobs.subscribe(() => {})
    await tick(POLL_INTERVAL_MS * 3)

    // The first ask at subscription, then one per tick: three watchers did not triple it.
    expect(port.view).toHaveBeenCalledTimes(4)
  })

  it('stops asking when the last watcher leaves, and starts again for the next', async () => {
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValue(WORKING)
    const jobs = createBookImportJobs(OWNER, port)

    const leave = jobs.subscribe(() => {})
    await tick(POLL_INTERVAL_MS)
    leave()
    const asked = port.view.mock.calls.length
    await tick(POLL_INTERVAL_MS * 5)
    expect(port.view.mock.calls.length).toBe(asked)

    jobs.subscribe(() => {})
    await tick(0)
    expect(port.view.mock.calls.length).toBe(asked + 1)
  })

  it('asks nothing of an empty register', async () => {
    const port = fakePort()

    watched(port)
    await tick(POLL_INTERVAL_MS * 3)

    expect(port.view).not.toHaveBeenCalled()
  })

  it('stops asking about a job the moment it answers anything but working', async () => {
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValue(ready())

    const jobs = watched(port)
    await tick(POLL_INTERVAL_MS * 5)

    expect(statusOf(jobs, 'a')).toBe('ready')
    expect(port.view).toHaveBeenCalledTimes(1)
  })
})

describe('the stall budget', () => {
  it('stops asking when the budget is spent', async () => {
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValue(WORKING)

    const jobs = watched(port)
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)
    const asked = port.view.mock.calls.length

    expect(statusOf(jobs, 'a')).toBe('stalled')

    await tick(POLL_INTERVAL_MS * 5)
    expect(port.view.mock.calls.length).toBe(asked)
  })

  it('ends every poll rejected in a stall rather than polling a dead job forever', async () => {
    register([row('a')])
    const port = fakePort()
    port.view.mockRejectedValue(new Error('offline'))

    const jobs = watched(port)
    await tick(POLL_BUDGET_MS - POLL_INTERVAL_MS)
    expect(statusOf(jobs, 'a')).toBe('working')

    await tick(POLL_INTERVAL_MS * 2)
    expect(statusOf(jobs, 'a')).toBe('stalled')
    const asked = port.view.mock.calls.length

    await tick(POLL_INTERVAL_MS * 5)
    expect(port.view.mock.calls.length).toBe(asked)
  })

  it('counts a drop of five files from each file’s own scheduled start, not from the drop', async () => {
    // The queue sits on file n for n * 20s. A budget counted from the drop called every file but
    // the first stalled at twenty seconds, on every multi-file drop.
    register([0, 1, 2, 3, 4].map((n) => row(`f${n}`, { delayMs: n * 20_000 })))
    const port = fakePort()
    port.view.mockResolvedValue(WORKING)

    const jobs = watched(port)
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)

    expect(statusOf(jobs, 'f0')).toBe('stalled')
    for (const name of ['f1', 'f2', 'f3', 'f4']) {
      expect(statusOf(jobs, name)).toBe('working')
    }

    await tick(20_000)
    expect(statusOf(jobs, 'f1')).toBe('stalled')
    expect(statusOf(jobs, 'f2')).toBe('working')

    await tick(60_000)
    for (const name of ['f0', 'f1', 'f2', 'f3', 'f4']) {
      expect(statusOf(jobs, name)).toBe('stalled')
    }
  })

  it('without a stagger a drop of five files is stalled together at the budget', async () => {
    register([0, 1, 2, 3, 4].map((n) => row(`f${n}`)))
    const port = fakePort()
    port.view.mockResolvedValue(WORKING)

    const jobs = watched(port)
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)

    for (const name of ['f0', 'f1', 'f2', 'f3', 'f4']) {
      expect(statusOf(jobs, name)).toBe('stalled')
    }
  })

  it('recheck re-arms a stalled job with a fresh budget', async () => {
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValue(WORKING)
    const jobs = watched(port)
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)
    expect(statusOf(jobs, 'a')).toBe('stalled')

    jobs.recheck()
    expect(statusOf(jobs, 'a')).toBe('working')
    await tick(POLL_BUDGET_MS - POLL_INTERVAL_MS)
    expect(statusOf(jobs, 'a')).toBe('working')

    port.view.mockResolvedValue(ready())
    await tick(POLL_INTERVAL_MS)
    expect(statusOf(jobs, 'a')).toBe('ready')
  })

  it('recheck for one trip leaves the jobs of another trip alone', async () => {
    register([row('a'), { ...row('b'), tripId: 'trip-2' }])
    const port = fakePort()
    port.view.mockResolvedValue(WORKING)
    const jobs = watched(port)
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)

    jobs.recheck(TRIP)

    expect(statusOf(jobs, 'a')).toBe('working')
    expect(
      jobs.getSnapshot().entries.find((entry) => entry.job.tripId === 'trip-2')
        ?.status,
    ).toBe('stalled')
  })
})

describe('starting a drop', () => {
  it('uploads, starts and registers each file as it starts, with the delay the server stated', async () => {
    const port = fakePort()
    port.upload
      .mockResolvedValueOnce({ fileId: 'file-1' })
      .mockResolvedValueOnce({ fileId: 'file-2' })
    port.start
      .mockResolvedValueOnce({ jobId: jobId('1'), delaySeconds: 0 })
      .mockResolvedValueOnce({ jobId: jobId('2'), delaySeconds: 20 })
    port.view.mockResolvedValue(WORKING)
    const jobs = watched(port)
    const progress: Array<number> = []

    const outcome = await jobs.startDrop({
      tripId: TRIP,
      files: [file('first.ics'), file('second.ics')],
      onProgress: (fraction) => progress.push(fraction),
    })

    expect(outcome).toEqual({ kind: 'started' })
    // The index is the dialog’s half of the stagger; the server turns it into the delay.
    expect(port.start).toHaveBeenNthCalledWith(1, {
      tripId: TRIP,
      fileId: 'file-1',
      index: 0,
    })
    expect(port.start).toHaveBeenNthCalledWith(2, {
      tripId: TRIP,
      fileId: 'file-2',
      index: 1,
    })
    expect(readBookImports(OWNER)).toEqual([
      { jobId: jobId('1'), tripId: TRIP, filename: 'first.ics', delayMs: 0 },
      {
        jobId: jobId('2'),
        tripId: TRIP,
        filename: 'second.ics',
        delayMs: 20_000,
      },
    ])
    expect(jobs.getSnapshot().entries).toHaveLength(2)
    expect(progress).toEqual([])
  })

  it('reports the progress of the whole drop, not of one file', async () => {
    const port = fakePort()
    port.upload.mockImplementation(({ onProgress }) => {
      onProgress(0.5)
      return Promise.resolve({ fileId: 'file-x' })
    })
    port.start.mockResolvedValue({ jobId: jobId('1'), delaySeconds: 0 })
    const jobs = watched(port)
    const progress: Array<number> = []

    await jobs.startDrop({
      tripId: TRIP,
      files: [file('first.ics'), file('second.ics')],
      onProgress: (fraction) => progress.push(fraction),
    })

    expect(progress).toEqual([0.25, 0.75])
  })

  it('keeps the jobs it already started when a later file fails to upload', async () => {
    // The first file’s reading is enqueued and has spent the workspace’s allowance: a register
    // written only after the whole drop succeeded would leave it running and unreachable.
    const port = fakePort()
    port.upload
      .mockResolvedValueOnce({ fileId: 'file-1' })
      .mockResolvedValueOnce(null)
    port.start.mockResolvedValue({ jobId: jobId('1'), delaySeconds: 0 })
    const jobs = watched(port)

    const outcome = await jobs.startDrop({
      tripId: TRIP,
      files: [file('first.ics'), file('second.ics')],
    })

    expect(outcome).toEqual({ kind: 'uploadFailed', filename: 'second.ics' })
    expect(readBookImports(OWNER)).toEqual([
      { jobId: jobId('1'), tripId: TRIP, filename: 'first.ics', delayMs: 0 },
    ])
  })

  it('keeps the jobs it already started when a later start is rejected, and hands back why', async () => {
    const port = fakePort()
    const refused = new Error('allowance spent')
    port.upload.mockResolvedValue({ fileId: 'file-x' })
    port.start
      .mockResolvedValueOnce({ jobId: jobId('1'), delaySeconds: 0 })
      .mockRejectedValueOnce(refused)
    const jobs = watched(port)

    const outcome = await jobs.startDrop({
      tripId: TRIP,
      files: [file('first.ics'), file('second.ics')],
    })

    expect(outcome).toEqual({
      kind: 'startFailed',
      filename: 'second.ics',
      cause: refused,
    })
    expect(readBookImports(OWNER)).toHaveLength(1)
  })

  it('waits for the caller’s hook after a start, once the job is registered', async () => {
    const port = fakePort()
    port.upload.mockResolvedValue({ fileId: 'file-1' })
    port.start.mockResolvedValue({ jobId: jobId('1'), delaySeconds: 0 })
    const jobs = watched(port)
    const seen: Array<number> = []

    await jobs.startDrop({
      tripId: TRIP,
      files: [file('first.ics')],
      afterStart: () => {
        seen.push(readBookImports(OWNER).length)
        return Promise.resolve()
      },
    })

    expect(seen).toEqual([1])
    expect(readBookImports(OWNER)).toHaveLength(1)
  })

  it('keeps the job registered when the hook after its start rejects', async () => {
    // The start went through and spent the allowance: a hook that fails does not un-start it, and
    // a register that skipped it would leave a reading running where nothing can reach it.
    const port = fakePort()
    const cause = new Error('invalidate failed')
    port.upload.mockResolvedValue({ fileId: 'file-1' })
    port.start.mockResolvedValue({ jobId: jobId('1'), delaySeconds: 0 })
    const jobs = watched(port)

    const outcome = await jobs.startDrop({
      tripId: TRIP,
      files: [file('first.ics')],
      afterStart: () => Promise.reject(cause),
    })

    expect(outcome).toEqual({
      kind: 'startFailed',
      filename: 'first.ics',
      cause,
    })
    expect(readBookImports(OWNER).map((job) => job.jobId)).toEqual([jobId('1')])
  })

  it('treats a start answer from before the delay existed as no delay', async () => {
    const port = fakePort()
    port.upload.mockResolvedValue({ fileId: 'file-1' })
    port.start.mockResolvedValue({
      jobId: jobId('1'),
    } as unknown as Awaited<ReturnType<BookImportPort['start']>>)
    const jobs = watched(port)

    await jobs.startDrop({ tripId: TRIP, files: [file('first.ics')] })

    expect(readBookImports(OWNER)[0]?.delayMs).toBe(0)
  })

  it('starts asking about a job as soon as it is registered', async () => {
    const port = fakePort()
    port.upload.mockResolvedValue({ fileId: 'file-1' })
    port.start.mockResolvedValue({ jobId: jobId('1'), delaySeconds: 0 })
    port.view.mockResolvedValue(ready())
    const jobs = watched(port)

    await jobs.startDrop({ tripId: TRIP, files: [file('first.ics')] })
    await tick(0)

    expect(statusOf(jobs, '1')).toBe('ready')
  })
})

describe('the rows still on offer', () => {
  it('leaves out the rows a confirm already wrote', async () => {
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValue(ready([0]))

    const jobs = watched(port)
    await tick(0)

    const [entry] = jobs.getSnapshot().entries
    expect(entry?.drafts.map((d) => d.index)).toEqual([1])
    // The server’s count keeps its meaning: the widget names it, the dialog does not.
    expect(entry?.count).toBe(2)
  })

  it('offers no rows for a job that is still working or was refused', async () => {
    register([row('a'), row('b')])
    const port = fakePort()
    port.view.mockImplementation(({ jobId: id }) =>
      Promise.resolve(
        id.endsWith(':a')
          ? WORKING
          : { status: 'refused', refusal: { code: 'unreadable' } },
      ),
    )

    const jobs = watched(port)
    await tick(0)

    const [a, b] = jobs.getSnapshot().entries
    expect(a?.drafts).toEqual([])
    expect(b?.drafts).toEqual([])
    expect(b?.refusal).toEqual({ code: 'unreadable' })
  })
})

describe('confirming', () => {
  async function readyStore(port: FakePort): Promise<BookImportJobs> {
    register([row('a'), row('b')])
    port.view.mockResolvedValue(ready())
    const jobs = watched(port)
    await tick(0)
    return jobs
  }

  it('sends one call per file with the reader’s rows, ascending', async () => {
    const port = fakePort()
    const jobs = await readyStore(port)
    port.confirm.mockResolvedValue({ written: 2, failed: 0, remaining: 0 })

    await jobs.confirm({
      tripId: TRIP,
      selection: new Map([
        [jobId('a'), new Set([1, 0])],
        [jobId('b'), new Set([1])],
      ]),
    })

    expect(port.confirm).toHaveBeenCalledTimes(2)
    expect(port.confirm).toHaveBeenNthCalledWith(1, {
      tripId: TRIP,
      jobId: jobId('a'),
      accept: [0, 1],
    })
    expect(port.confirm).toHaveBeenNthCalledWith(2, {
      tripId: TRIP,
      jobId: jobId('b'),
      accept: [1],
    })
  })

  it('forgets the jobs it confirmed when nothing is left to write', async () => {
    const port = fakePort()
    const jobs = await readyStore(port)
    port.confirm.mockResolvedValue({ written: 2, failed: 0, remaining: 0 })

    const outcome = await jobs.confirm({
      tripId: TRIP,
      selection: new Map([[jobId('a'), new Set([0, 1])]]),
    })

    expect(outcome).toEqual({ written: 2, left: 0, failures: [] })
    // Both offered files go, the one with nothing ticked included: the reader was done with it.
    expect(readBookImports(OWNER)).toEqual([])
    expect(jobs.getSnapshot().entries).toEqual([])
  })

  it('does not call the server for a file with nothing ticked', async () => {
    const port = fakePort()
    const jobs = await readyStore(port)
    port.confirm.mockResolvedValue({ written: 1, failed: 0, remaining: 0 })

    await jobs.confirm({
      tripId: TRIP,
      selection: new Map([[jobId('a'), new Set([0])]]),
    })

    expect(port.confirm).toHaveBeenCalledTimes(1)
  })

  it('re-reads the staged rows after a partial confirm, so a written row stops being offered', async () => {
    // The poll stops asking about a job once it answers anything but working, so without this the
    // review list kept the answer from before the confirm: every row listed and ticked, the ones
    // just written among them.
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValueOnce(ready()).mockResolvedValue(ready([0]))
    const jobs = watched(port)
    await tick(0)
    expect(jobs.getSnapshot().entries[0]?.drafts).toHaveLength(2)
    port.confirm.mockResolvedValue({ written: 1, failed: 1, remaining: 1 })

    const outcome = await jobs.confirm({
      tripId: TRIP,
      selection: new Map([[jobId('a'), new Set([0, 1])]]),
    })
    await tick(0)

    expect(outcome).toEqual({ written: 1, left: 1, failures: [] })
    expect(port.view).toHaveBeenCalledTimes(2)
    expect(jobs.getSnapshot().entries[0]?.drafts.map((d) => d.index)).toEqual([
      1,
    ])
    // Nothing is forgotten while something is still to write.
    expect(readBookImports(OWNER)).toHaveLength(1)
  })

  it('counts a file whose call was rejected as left, and hands back each cause', async () => {
    const port = fakePort()
    const jobs = await readyStore(port)
    const cause = new Error('offline')
    port.confirm
      .mockRejectedValueOnce(cause)
      .mockResolvedValueOnce({ written: 1, failed: 0, remaining: 0 })

    const outcome = await jobs.confirm({
      tripId: TRIP,
      selection: new Map([
        [jobId('a'), new Set([0, 1])],
        [jobId('b'), new Set([0])],
      ]),
    })

    expect(outcome).toEqual({ written: 1, left: 2, failures: [cause] })
    expect(readBookImports(OWNER)).toHaveLength(2)
  })

  it('runs the caller’s hook after the writes and before the job is settled', async () => {
    const port = fakePort()
    const jobs = await readyStore(port)
    port.confirm.mockResolvedValue({ written: 2, failed: 0, remaining: 0 })
    const seen: Array<number> = []

    await jobs.confirm({
      tripId: TRIP,
      selection: new Map([[jobId('a'), new Set([0, 1])]]),
      afterWritten: () => {
        seen.push(readBookImports(OWNER).length)
        return Promise.resolve()
      },
    })

    expect(seen).toEqual([2])
    expect(readBookImports(OWNER)).toHaveLength(0)
  })

  it('settles the register even when the caller’s hook rejects', async () => {
    const port = fakePort()
    const jobs = await readyStore(port)
    port.confirm.mockResolvedValue({ written: 2, failed: 0, remaining: 0 })

    await expect(
      jobs.confirm({
        tripId: TRIP,
        selection: new Map([[jobId('a'), new Set([0, 1])]]),
        afterWritten: () => Promise.reject(new Error('invalidate failed')),
      }),
    ).rejects.toThrow('invalidate failed')

    // The rows were written, so the jobs are forgotten all the same.
    expect(readBookImports(OWNER)).toHaveLength(0)
  })

  it('confirms only the files of the trip it is asked about', async () => {
    register([row('a'), { ...row('b'), tripId: 'trip-2' }])
    const port = fakePort()
    port.view.mockResolvedValue(ready())
    const jobs = watched(port)
    await tick(0)
    port.confirm.mockResolvedValue({ written: 1, failed: 0, remaining: 0 })

    await jobs.confirm({
      tripId: TRIP,
      selection: new Map([
        [jobId('a'), new Set([0])],
        [`booking-import:trip-2:b`, new Set([0])],
      ]),
    })

    expect(port.confirm).toHaveBeenCalledTimes(1)
    expect(readBookImports(OWNER).map((job) => job.tripId)).toEqual(['trip-2'])
  })
})

describe('the two forget policies', () => {
  async function mixed(): Promise<BookImportJobs> {
    register([row('refused'), row('ready'), row('stalled')])
    const port = fakePort()
    port.view.mockImplementation(({ jobId: id }) => {
      if (id.endsWith(':refused')) {
        return Promise.resolve({
          status: 'refused',
          refusal: { code: 'unreadable' },
        })
      }
      return Promise.resolve(id.endsWith(':ready') ? ready() : WORKING)
    })
    const jobs = watched(port)
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)
    expect(statusOf(jobs, 'refused')).toBe('refused')
    expect(statusOf(jobs, 'ready')).toBe('ready')
    expect(statusOf(jobs, 'stalled')).toBe('stalled')
    return jobs
  }

  it('another file forgets the refused jobs only', async () => {
    // “Try another file” forgot every job that was not still working, so a second file that had
    // been read — billed, staged, waiting for review — lost the only handle there was on its id.
    const jobs = await mixed()

    jobs.forgetRefused(TRIP)

    expect(readBookImports(OWNER).map((job) => job.jobId)).toEqual([
      jobId('ready'),
      jobId('stalled'),
    ])
  })

  it('another file forgets the refused jobs of its own trip only', async () => {
    register([row('a'), { ...row('b'), tripId: 'trip-2' }])
    const port = fakePort()
    port.view.mockResolvedValue({
      status: 'refused',
      refusal: { code: 'unreadable' },
    })
    const jobs = watched(port)
    await tick(0)

    jobs.forgetRefused(TRIP)

    expect(readBookImports(OWNER).map((job) => job.tripId)).toEqual(['trip-2'])
  })

  it('Dismiss forgets the refused and the stalled jobs and keeps the ready one', async () => {
    const jobs = await mixed()

    jobs.dismiss()

    expect(readBookImports(OWNER).map((job) => job.jobId)).toEqual([
      jobId('ready'),
    ])
    expect(jobs.getSnapshot().entries).toHaveLength(1)
  })
})

describe('Dismiss and the rows still on offer', () => {
  it('keeps a stalled job whose rows have not been written', async () => {
    // A partial confirm re-reads the job. When every re-read is rejected the job stalls, and it
    // still holds the only handle on rows the reader has not written: Dismiss must not take it.
    register([row('a')])
    const port = fakePort()
    port.view.mockResolvedValueOnce(ready())
    const jobs = watched(port)
    await tick(0)
    port.confirm.mockResolvedValue({ written: 1, failed: 1, remaining: 1 })
    port.view.mockRejectedValue(new Error('offline'))
    await jobs.confirm({
      tripId: TRIP,
      selection: new Map([[jobId('a'), new Set([0, 1])]]),
    })
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)
    expect(statusOf(jobs, 'a')).toBe('stalled')
    expect(jobs.getSnapshot().entries[0]?.drafts.length).toBeGreaterThan(0)

    jobs.dismiss()

    expect(readBookImports(OWNER).map((job) => job.jobId)).toEqual([jobId('a')])
    expect(jobs.getSnapshot().entries.some(isDismissible)).toBe(false)
  })
})

describe('a watcher that joins a stalled store', () => {
  it('gives the stalled jobs a fresh budget instead of inheriting the stall', async () => {
    register([row('a')])
    const port = fakePort()
    const jobs = watched(port)
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)
    expect(statusOf(jobs, 'a')).toBe('stalled')
    port.view.mockResolvedValue(ready())

    jobs.subscribe(() => {})
    await tick(0)

    expect(statusOf(jobs, 'a')).toBe('ready')
  })
})

describe('answers that arrive late', () => {
  function deferred() {
    let resolve!: (view: BookingImportView) => void
    const promise = new Promise<BookingImportView>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }

  it('drops an answer that arrives after the last watcher has left', async () => {
    register([row('a')])
    const port = fakePort()
    const late = deferred()
    port.view.mockReturnValueOnce(late.promise)
    const jobs = createBookImportJobs(OWNER, port)
    const listener = vi.fn()
    const unsubscribe = jobs.subscribe(listener)
    await tick(0)

    unsubscribe()
    late.resolve(ready())
    await tick(0)

    expect(statusOf(jobs, 'a')).toBe('working')
    expect(listener).not.toHaveBeenCalled()
  })

  it('drops an answer to a question asked before a recheck', async () => {
    register([row('a')])
    const port = fakePort()
    const before = deferred()
    const after = deferred()
    port.view
      .mockReturnValueOnce(before.promise)
      .mockReturnValueOnce(after.promise)
    const jobs = watched(port)
    await tick(0)

    jobs.recheck()
    after.resolve(ready())
    await tick(0)
    before.resolve({ status: 'refused', refusal: { code: 'unreadable' } })
    await tick(0)

    expect(statusOf(jobs, 'a')).toBe('ready')
  })
})

describe('the shell chunk', () => {
  /*
   * The widget is mounted in the authenticated shell, so whatever the module imports statically is
   * in the bundle of every screen. A static import of the server function it polls put the
   * function’s schema graph there too (#483). Types are erased, so `import type` is fine; the
   * upload helper imports a server function itself, so it is loaded the same way.
   */
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..')
  const read = (name: string): string => readFileSync(join(dir, name), 'utf8')
  const source = read('import-jobs.ts')
  // The widget is the file the shell route mounts, and the reducer is imported by the dialog: a
  // static server import in either one is in the shell's chunk just the same.
  const shellFiles = ['import-jobs.ts', 'import-widget.tsx', 'import-drafts.ts']

  it.each(shellFiles)('%s has no value import from the server', (name) => {
    expect(
      read(name).match(
        /^import\s+(?!type\b)[^']*from\s+'(?:#\/server\/|\.\.\/files\/upload)/gm,
      ),
    ).toBeNull()
  })

  it('reaches the server and the upload only through a dynamic import', () => {
    expect(source).toContain("import('#/server/fns/booking-import')")
    expect(source).toContain("import('../files/upload')")
  })
})
