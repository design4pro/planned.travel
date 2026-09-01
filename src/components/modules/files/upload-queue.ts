/**
 * The upload queue's state machine.
 *
 * Uploads are the one place on these screens where several writes are in flight at
 * once and each one has its own progress, its own cancellation and its own failure
 * message. That is a reducer, not a scattering of `useState`, and it is a reducer
 * worth testing: the properties that matter — a failed file never blocks the
 * others, a cancelled file stops reporting progress, the queue knows when it is
 * finished — are exactly the ones that are invisible in a screenshot.
 */

import { formatStorage } from '#/lib/plans'

import type { DeferredMessage } from '../shared/deferred-message'

export type UploadStatus =
  'queued' | 'uploading' | 'done' | 'failed' | 'cancelled'

export interface UploadTask {
  readonly id: string
  readonly filename: string
  readonly sizeBytes: number
  readonly status: UploadStatus
  /** `0`–`1`. Only meaningful while `uploading`. */
  readonly progress: number
  /** Why it failed, or why it was refused before it was sent. */
  readonly message: DeferredMessage | string | null
}

export interface UploadQueueState {
  readonly tasks: ReadonlyArray<UploadTask>
}

export type UploadQueueAction =
  | {
      readonly type: 'enqueue'
      readonly tasks: ReadonlyArray<{
        readonly id: string
        readonly filename: string
        readonly sizeBytes: number
      }>
    }
  | {
      readonly type: 'reject'
      readonly id: string
      readonly filename: string
      readonly sizeBytes: number
      readonly message: DeferredMessage | string
    }
  | { readonly type: 'start'; readonly id: string }
  | { readonly type: 'progress'; readonly id: string; readonly value: number }
  | { readonly type: 'succeed'; readonly id: string }
  | { readonly type: 'fail'; readonly id: string; readonly message: string }
  | { readonly type: 'cancel'; readonly id: string }
  | { readonly type: 'dismiss'; readonly id: string }
  /** Clears everything that has finished, whichever way it finished. */
  | { readonly type: 'clearSettled' }

export const emptyUploadQueue: UploadQueueState = { tasks: [] }

/** Statuses a task can no longer move on from. */
const TERMINAL: ReadonlyArray<UploadStatus> = ['done', 'failed', 'cancelled']

function isTerminal(status: UploadStatus): boolean {
  return TERMINAL.includes(status)
}

function patch(
  state: UploadQueueState,
  id: string,
  change: (task: UploadTask) => UploadTask,
): UploadQueueState {
  const index = state.tasks.findIndex((task) => task.id === id)
  if (index === -1) {
    return state
  }
  const tasks = [...state.tasks]
  tasks[index] = change(tasks[index])
  return { tasks }
}

export function uploadQueueReducer(
  state: UploadQueueState,
  action: UploadQueueAction,
): UploadQueueState {
  switch (action.type) {
    case 'enqueue': {
      if (action.tasks.length === 0) {
        return state
      }
      return {
        tasks: [
          ...state.tasks,
          ...action.tasks.map((task) => ({
            ...task,
            status: 'queued' as const,
            progress: 0,
            message: null,
          })),
        ],
      }
    }

    case 'reject':
      return {
        tasks: [
          ...state.tasks,
          {
            id: action.id,
            filename: action.filename,
            sizeBytes: action.sizeBytes,
            status: 'failed',
            progress: 0,
            message: action.message,
          },
        ],
      }

    case 'start':
      // A task cancelled while it was still queued must not be started by the
      // pump that was already walking the queue.
      return patch(state, action.id, (task) =>
        task.status === 'queued'
          ? { ...task, status: 'uploading', progress: 0 }
          : task,
      )

    case 'progress':
      return patch(state, action.id, (task) =>
        task.status === 'uploading'
          ? {
              ...task,
              progress: Math.min(Math.max(action.value, 0), 1),
            }
          : task,
      )

    case 'succeed':
      return patch(state, action.id, (task) =>
        isTerminal(task.status)
          ? task
          : { ...task, status: 'done', progress: 1, message: null },
      )

    case 'fail':
      return patch(state, action.id, (task) =>
        isTerminal(task.status)
          ? task
          : { ...task, status: 'failed', message: action.message },
      )

    case 'cancel':
      return patch(state, action.id, (task) =>
        isTerminal(task.status)
          ? task
          : { ...task, status: 'cancelled', message: null },
      )

    case 'dismiss': {
      const tasks = state.tasks.filter((task) => task.id !== action.id)
      return tasks.length === state.tasks.length ? state : { tasks }
    }

    case 'clearSettled': {
      const tasks = state.tasks.filter((task) => !isTerminal(task.status))
      return tasks.length === state.tasks.length ? state : { tasks }
    }
  }
}

/* -------------------------------------------------------------- selectors */

export function activeTasks(
  state: UploadQueueState,
): ReadonlyArray<UploadTask> {
  return state.tasks.filter((task) => !isTerminal(task.status))
}

/**
 * Everything that has finished, whichever way it finished.
 *
 * The counterpart to {@link activeTasks}: together they are how a caller knows a
 * batch has drained and what it can now report.
 */
export function settledTasks(
  state: UploadQueueState,
): ReadonlyArray<UploadTask> {
  return state.tasks.filter((task) => isTerminal(task.status))
}

export function isUploading(state: UploadQueueState): boolean {
  return state.tasks.some((task) => task.status === 'uploading')
}

/** The next task the pump should pick up, or `undefined` when there is none. */
export function nextQueued(state: UploadQueueState): UploadTask | undefined {
  return state.tasks.find((task) => task.status === 'queued')
}

export function failedTasks(
  state: UploadQueueState,
): ReadonlyArray<UploadTask> {
  return state.tasks.filter((task) => task.status === 'failed')
}

/**
 * Overall progress across the whole queue, weighted by file size — so a 5 MB file
 * finishing moves the bar further than a 4 KB one, which is what a person watching
 * a batch upload expects.
 */
export function overallProgress(state: UploadQueueState): number {
  const counted = state.tasks.filter((task) => task.status !== 'cancelled')
  const total = counted.reduce(
    (sum, task) => sum + Math.max(task.sizeBytes, 1),
    0,
  )
  if (total === 0) {
    return 0
  }
  const done = counted.reduce((sum, task) => {
    const weight = Math.max(task.sizeBytes, 1)
    if (task.status === 'done') {
      return sum + weight
    }
    if (task.status === 'uploading') {
      return sum + weight * task.progress
    }
    return sum
  }, 0)
  return Math.min(done / total, 1)
}

/* ------------------------------------------------------------ what to say */

/** One thing the screen should tell the reader about a finished batch. */
export interface UploadAnnouncement {
  readonly kind: 'success' | 'error'
  readonly title: DeferredMessage
  /** A message, or a filename — which is data and needs no translating. */
  readonly description: DeferredMessage | string
}

/**
 * What a drained batch owes the reader, as data rather than as toasts.
 *
 * A batch, not a file: dropping twelve files is one action, and the queue panel
 * already narrates each file on its own row. Cancelled files say nothing — the
 * reader cancelled them, so a toast would only tell them what they just did — and
 * a batch that both succeeded and failed says both, because "eleven uploaded" and
 * "one was too big" are two different pieces of news.
 *
 * Pure, so the wording is testable without a browser, a router or an upload.
 */
export function announcementsFor(
  tasks: ReadonlyArray<UploadTask>,
): ReadonlyArray<UploadAnnouncement> {
  const uploaded = tasks.filter((task) => task.status === 'done')
  const failed = tasks.filter((task) => task.status === 'failed')
  const said: Array<UploadAnnouncement> = []

  if (uploaded.length === 1) {
    said.push({
      kind: 'success',
      title: { key: 'modules.files.toast.uploadedOne' },
      description: uploaded[0].filename,
    })
  } else if (uploaded.length > 1) {
    const bytes = uploaded.reduce((sum, task) => sum + task.sizeBytes, 0)
    said.push({
      kind: 'success',
      title: {
        key: 'modules.files.toast.uploadedMany',
        params: { count: uploaded.length },
      },
      description: {
        key: 'modules.files.toast.uploadedManyBody',
        params: { size: formatStorage(bytes) },
      },
    })
  }

  if (failed.length === 1) {
    said.push({
      kind: 'error',
      title: { key: 'modules.files.toast.failedOne' },
      description: failed[0].message ?? failed[0].filename,
    })
  } else if (failed.length > 1) {
    said.push({
      kind: 'error',
      title: {
        key: 'modules.files.toast.failedMany',
        params: { count: failed.length },
      },
      description: { key: 'modules.files.toast.failedManyBody' },
    })
  }

  return said
}

/** Bytes this queue still intends to add, for the pre-flight budget. */
export function pendingBytes(state: UploadQueueState): number {
  return state.tasks
    .filter((task) => task.status === 'queued' || task.status === 'uploading')
    .reduce((sum, task) => sum + task.sizeBytes, 0)
}
