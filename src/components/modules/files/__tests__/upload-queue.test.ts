import { describe, expect, it } from 'vitest'

import {
  activeTasks,
  announcementsFor,
  emptyUploadQueue,
  failedTasks,
  isUploading,
  nextQueued,
  overallProgress,
  pendingBytes,
  settledTasks,
  uploadQueueReducer,
} from '../upload-queue'

import type {
  UploadQueueAction,
  UploadQueueState,
  UploadTask,
} from '../upload-queue'

function reduce(
  state: UploadQueueState,
  ...actions: Array<UploadQueueAction>
): UploadQueueState {
  return actions.reduce(uploadQueueReducer, state)
}

function withTwo(): UploadQueueState {
  return reduce(emptyUploadQueue, {
    type: 'enqueue',
    tasks: [
      { id: 'a', filename: 'a.pdf', sizeBytes: 1000 },
      { id: 'b', filename: 'b.pdf', sizeBytes: 1000 },
    ],
  })
}

describe('uploadQueueReducer', () => {
  it('enqueues files as queued with no progress', () => {
    const state = withTwo()

    expect(state.tasks).toHaveLength(2)
    expect(state.tasks[0]).toMatchObject({
      id: 'a',
      status: 'queued',
      progress: 0,
      message: null,
    })
  })

  it('ignores an empty enqueue', () => {
    expect(
      uploadQueueReducer(emptyUploadQueue, { type: 'enqueue', tasks: [] }),
    ).toBe(emptyUploadQueue)
  })

  it('records a file refused before it was sent, with its reason', () => {
    const state = uploadQueueReducer(emptyUploadQueue, {
      type: 'reject',
      id: 'x',
      filename: 'run.exe',
      sizeBytes: 10,
      message: 'Not a file type this workspace accepts.',
    })

    expect(state.tasks[0]).toMatchObject({
      status: 'failed',
      message: 'Not a file type this workspace accepts.',
    })
    expect(nextQueued(state)).toBeUndefined()
  })

  it('starts one file at a time, oldest first', () => {
    const state = reduce(withTwo(), { type: 'start', id: 'a' })

    expect(state.tasks[0]?.status).toBe('uploading')
    expect(state.tasks[1]?.status).toBe('queued')
    expect(nextQueued(state)?.id).toBe('b')
    expect(isUploading(state)).toBe(true)
  })

  it('tracks progress only while a file is uploading', () => {
    const uploading = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'progress', id: 'a', value: 0.4 },
    )
    expect(uploading.tasks[0]?.progress).toBeCloseTo(0.4)

    // `b` has not started, so a stray progress event for it changes nothing.
    const stray = uploadQueueReducer(uploading, {
      type: 'progress',
      id: 'b',
      value: 0.9,
    })
    expect(stray.tasks[1]?.progress).toBe(0)
  })

  it('clamps a progress value that arrives out of range', () => {
    const state = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'progress', id: 'a', value: 3 },
    )
    expect(state.tasks[0]?.progress).toBe(1)

    const negative = uploadQueueReducer(state, {
      type: 'progress',
      id: 'a',
      value: -1,
    })
    expect(negative.tasks[0]?.progress).toBe(0)
  })

  it('finishes a file at full progress', () => {
    const state = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'progress', id: 'a', value: 0.5 },
      { type: 'succeed', id: 'a' },
    )
    expect(state.tasks[0]).toMatchObject({ status: 'done', progress: 1 })
  })

  it('lets one file fail without touching the others', () => {
    const state = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'fail', id: 'a', message: 'The connection dropped.' },
    )

    expect(state.tasks[0]).toMatchObject({
      status: 'failed',
      message: 'The connection dropped.',
    })
    expect(state.tasks[1]?.status).toBe('queued')
    expect(nextQueued(state)?.id).toBe('b')
    expect(failedTasks(state).map((task) => task.id)).toEqual(['a'])
  })

  it('does not start a file that was cancelled while it waited', () => {
    const state = reduce(
      withTwo(),
      { type: 'cancel', id: 'b' },
      { type: 'start', id: 'b' },
    )
    expect(state.tasks[1]?.status).toBe('cancelled')
  })

  it('stops reporting progress once a file is cancelled', () => {
    const state = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'cancel', id: 'a' },
      { type: 'progress', id: 'a', value: 0.8 },
    )
    expect(state.tasks[0]).toMatchObject({ status: 'cancelled', progress: 0 })
  })

  it('refuses to resurrect a settled file', () => {
    const done = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'succeed', id: 'a' },
    )
    const after = reduce(
      done,
      { type: 'fail', id: 'a', message: 'too late' },
      { type: 'cancel', id: 'a' },
    )
    expect(after.tasks[0]?.status).toBe('done')
  })

  it('dismisses one row and leaves the rest', () => {
    const state = uploadQueueReducer(withTwo(), { type: 'dismiss', id: 'a' })
    expect(state.tasks.map((task) => task.id)).toEqual(['b'])
  })

  it('is stable when dismissing something that is not there', () => {
    const state = withTwo()
    expect(uploadQueueReducer(state, { type: 'dismiss', id: 'zz' })).toBe(state)
  })

  it('clears everything settled and keeps what is still going', () => {
    const state = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'succeed', id: 'a' },
      { type: 'start', id: 'b' },
      { type: 'clearSettled' },
    )
    expect(state.tasks.map((task) => task.id)).toEqual(['b'])
  })

  it('is stable when there is nothing settled to clear', () => {
    const state = withTwo()
    expect(uploadQueueReducer(state, { type: 'clearSettled' })).toBe(state)
  })
})

describe('what a finished batch says', () => {
  const task = (
    overrides: Partial<UploadTask> & { readonly id: string },
  ): UploadTask => ({
    filename: `${overrides.id}.pdf`,
    sizeBytes: 1024,
    status: 'done',
    progress: 1,
    message: null,
    ...overrides,
  })

  it('names the file when exactly one landed', () => {
    expect(announcementsFor([task({ id: 'a', filename: 'visa.pdf' })])).toEqual([
      { kind: 'success', title: 'File uploaded', description: 'visa.pdf' },
    ])
  })

  it('counts a batch and totals what it added', () => {
    const said = announcementsFor([
      task({ id: 'a', sizeBytes: 500_000 }),
      task({ id: 'b', sizeBytes: 500_000 }),
    ])
    expect(said).toHaveLength(1)
    expect(said[0].title).toBe('2 files uploaded')
    expect(said[0].description).toContain('added to this trip')
  })

  it('carries the reason when a single file was refused', () => {
    const said = announcementsFor([
      task({ id: 'a', status: 'failed', message: 'Bigger than 25 MB' }),
    ])
    expect(said).toEqual([
      {
        kind: 'error',
        title: 'That file did not upload',
        description: 'Bigger than 25 MB',
      },
    ])
  })

  it('says both halves when a batch part-failed', () => {
    const said = announcementsFor([
      task({ id: 'a' }),
      task({ id: 'b' }),
      task({ id: 'c', status: 'failed', message: 'Too big' }),
      task({ id: 'd', status: 'failed', message: 'Out of room' }),
    ])
    expect(said.map((line) => line.kind)).toEqual(['success', 'error'])
    expect(said[1].title).toBe('2 files did not upload')
  })

  it('says nothing about a file the reader cancelled', () => {
    expect(announcementsFor([task({ id: 'a', status: 'cancelled' })])).toEqual(
      [],
    )
  })
})

describe('selectors', () => {
  it('reports which tasks are still going', () => {
    const state = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'succeed', id: 'a' },
    )
    expect(activeTasks(state).map((task) => task.id)).toEqual(['b'])
    expect(isUploading(state)).toBe(false)
  })

  it('reports what has settled, which is how a batch knows it is over', () => {
    const running = reduce(withTwo(), { type: 'start', id: 'a' })
    expect(settledTasks(running)).toEqual([])

    const half = reduce(running, { type: 'succeed', id: 'a' })
    expect(settledTasks(half).map((task) => task.id)).toEqual(['a'])
    expect(activeTasks(half)).toHaveLength(1)

    const drained = reduce(
      half,
      { type: 'start', id: 'b' },
      { type: 'fail', id: 'b', message: 'Too big' },
    )
    expect(settledTasks(drained).map((task) => task.status)).toEqual([
      'done',
      'failed',
    ])
    expect(activeTasks(drained)).toEqual([])
  })

  it('weights overall progress by file size', () => {
    const state = reduce(
      uploadQueueReducer(emptyUploadQueue, {
        type: 'enqueue',
        tasks: [
          { id: 'big', filename: 'big.pdf', sizeBytes: 9000 },
          { id: 'small', filename: 'small.pdf', sizeBytes: 1000 },
        ],
      }),
      { type: 'start', id: 'small' },
      { type: 'succeed', id: 'small' },
    )
    expect(overallProgress(state)).toBeCloseTo(0.1)
  })

  it('counts a partly-sent file at its own fraction', () => {
    const state = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'progress', id: 'a', value: 0.5 },
    )
    expect(overallProgress(state)).toBeCloseTo(0.25)
  })

  it('leaves cancelled files out of the overall figure', () => {
    const state = reduce(
      withTwo(),
      { type: 'cancel', id: 'b' },
      { type: 'start', id: 'a' },
      { type: 'succeed', id: 'a' },
    )
    expect(overallProgress(state)).toBe(1)
  })

  it('reports no progress for an empty queue rather than dividing by zero', () => {
    expect(overallProgress(emptyUploadQueue)).toBe(0)
  })

  it('adds up the bytes still to be sent, for the quota pre-flight', () => {
    const state = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'succeed', id: 'a' },
    )
    expect(pendingBytes(state)).toBe(1000)
  })

  it('counts nothing pending once the queue has drained', () => {
    const state = reduce(
      withTwo(),
      { type: 'start', id: 'a' },
      { type: 'succeed', id: 'a' },
      { type: 'start', id: 'b' },
      { type: 'fail', id: 'b', message: 'nope' },
    )
    expect(pendingBytes(state)).toBe(0)
  })
})
