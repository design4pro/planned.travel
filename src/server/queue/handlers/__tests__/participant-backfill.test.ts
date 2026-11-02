/**
 * The `participant-backfill` chain (ADR 0043): one workspace per message, a deterministic id for the
 * next message, the completion marker only from the message that finds no workspace left, and
 * nothing in this release that enqueues the kind.
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PARTICIPANT_BACKFILL_MARKER_KEY,
  participantBackfillRunKey,
  readParticipantBackfillMarker,
} from '#/server/erasure/participant-backfill-marker'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import {
  modulesUnder,
  SOURCE_ROOT,
} from '#/server/catalog/__tests__/module-graph'
import { taskHandlers } from '../../consumer'
import { buildTaskEnvelope } from '../../jobs'
import {
  TaskConfigurationError,
  TaskRetryableError,
  participantBackfillPayloadSchema,
} from '../../types'
import {
  createParticipantBackfillHandler,
  handleParticipantBackfill,
  participantBackfillMessageId,
} from '../participant-backfill'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TaskBindings, TaskContext, TaskEnvelope } from '../../types'

const NOW = Date.parse('2026-10-18T10:00:00.000Z')

interface Fakes {
  readonly env: TaskBindings
  readonly sent: Array<TaskEnvelope>
  readonly kv: Map<string, string>
}

function fakes(): Fakes {
  const sent: Array<TaskEnvelope> = []
  const kv = new Map<string, string>()
  const env: TaskBindings = {
    KV: {
      get: async (key) => kv.get(key) ?? null,
      put: async (key, value) => {
        kv.set(key, value)
      },
      delete: async (key) => {
        kv.delete(key)
      },
      list: async () => ({ keys: [], list_complete: true }),
    },
    FILES: {
      get: async () => null,
      put: async () => undefined,
      head: async () => null,
      delete: async () => undefined,
      list: async () => ({ objects: [], truncated: false }),
    },
    TASKS: {
      send: async (body) => {
        sent.push(body as TaskEnvelope)
      },
      sendBatch: async () => undefined,
    },
    DB: {} as TaskBindings['DB'],
  }
  return { env, sent, kv }
}

function context(env: TaskBindings): TaskContext {
  return {
    env,
    logger: createLogger({ level: 'info', sink: createMemorySink() }),
    now: () => NOW,
    attempt: 1,
    taskId: 'task-under-test',
    orgId: 'system',
    callProvider: (_label, send) => send(),
  }
}

let harness: Harness
let alpha: SeededTenant
let beta: SeededTenant
let ordered: Array<string>

const run = (env: TaskBindings, after: string | null) =>
  createParticipantBackfillHandler(() => harness.db)(
    { runId: 'run-1', after },
    context(env),
  )

const anchors = () =>
  (
    harness.sqlite
      .prepare('select organization_id, user_id from workspace_participants')
      .all() as Array<{ organization_id: string; user_id: string }>
  ).map((row) => `${row.organization_id}/${row.user_id}`)

beforeEach(async () => {
  harness = await createHarness()
  alpha = await harness.seedTenant('alpha')
  beta = await harness.seedTenant('beta')
  ordered = [alpha.organizationId, beta.organizationId].sort()
})

afterEach(() => {
  harness.close()
})

describe('the participant-backfill envelope', () => {
  it('is registered, strict, and carries no user or organization id', () => {
    expect(taskHandlers['participant-backfill']).toBe(handleParticipantBackfill)
    expect(
      participantBackfillPayloadSchema.safeParse({ runId: 'r', after: null })
        .success,
    ).toBe(true)
    expect(
      participantBackfillPayloadSchema.safeParse({
        runId: 'r',
        after: null,
        userId: 'u',
      }).success,
    ).toBe(false)
    expect(
      buildTaskEnvelope({
        kind: 'participant-backfill',
        orgId: 'system',
        payload: { runId: 'r', after: null },
      }).kind,
    ).toBe('participant-backfill')
  })

  it('has no producer: nothing outside the handler and the tests names the kind', () => {
    const offenders = modulesUnder(SOURCE_ROOT, { tests: false })
      .filter((file) =>
        readFileSync(file, 'utf8').includes("'participant-backfill'"),
      )
      .map((file) => file.slice(SOURCE_ROOT.length + 1))
      .sort()
    expect(offenders).toEqual([
      'server/queue/consumer.ts',
      'server/queue/handlers/participant-backfill.ts',
      'server/queue/types.ts',
    ])
  })
})

describe('the chain', () => {
  it('handles the first workspace, anchors its people and hands on with a deterministic id', async () => {
    const { env, sent, kv } = fakes()

    await run(env, null)

    expect(anchors().every((row) => row.startsWith(`${ordered[0]}/`))).toBe(
      true,
    )
    expect(anchors().length).toBeGreaterThan(0)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      id: participantBackfillMessageId('run-1', ordered[0]),
      orgId: 'system',
      kind: 'participant-backfill',
      payload: { runId: 'run-1', after: ordered[0] },
    })
    expect(kv.has(PARTICIPANT_BACKFILL_MARKER_KEY)).toBe(false)
    expect(kv.get(participantBackfillRunKey('run-1'))).toBe(ordered[0])
  })

  it('writes the marker only from the message that finds no workspace left', async () => {
    const { env, sent, kv } = fakes()

    await run(env, null)
    await run(env, ordered[0])
    expect(kv.has(PARTICIPANT_BACKFILL_MARKER_KEY)).toBe(false)
    expect(sent).toHaveLength(2)

    await run(env, ordered[1])

    expect(sent).toHaveLength(2)
    expect(await readParticipantBackfillMarker(env.KV)).toEqual({
      runId: 'run-1',
      completedAt: new Date(NOW).toISOString(),
    })
    expect(anchors().sort()).toEqual(
      [
        `${alpha.organizationId}/${alpha.ownerUserId}`,
        `${beta.organizationId}/${beta.ownerUserId}`,
      ].sort(),
    )
  })

  it('leaves no marker when a message in the middle fails', async () => {
    const { env, kv } = fakes()
    await run(env, null)
    harness.sqlite.exec('drop table workspace_participants')

    await expect(run(env, ordered[0])).rejects.toThrow()

    expect(kv.has(PARTICIPANT_BACKFILL_MARKER_KEY)).toBe(false)
  })

  it('is idempotent on redelivery and on a full rerun under a new run id', async () => {
    const { env } = fakes()
    await run(env, null)
    await run(env, ordered[0])
    const first = anchors().sort()

    await run(env, null)
    await run(env, ordered[0])
    await run(env, ordered[1])
    expect(anchors().sort()).toEqual(first)

    const again = (after: string | null) =>
      createParticipantBackfillHandler(() => harness.db)(
        { runId: 'run-2', after },
        context(env),
      )
    await again(null)
    await again(ordered[0])
    await again(ordered[1])
    expect(anchors().sort()).toEqual(first)
    expect((await readParticipantBackfillMarker(env.KV))?.runId).toBe('run-2')
  })

  it('lets a retried message through after an earlier attempt got as far as recording its workspace', async () => {
    const { env, sent } = fakes()
    await run(env, null)
    await run(env, null)

    expect(sent).toHaveLength(2)
    expect(sent[1]).toMatchObject({
      id: sent[0].id,
      payload: sent[0].payload,
    })
  })

  it('writes no marker for a message that starts past the end of a run that never began, and fails it so it retries', async () => {
    const { env, sent, kv } = fakes()

    await expect(run(env, ordered[1])).rejects.toBeInstanceOf(
      TaskRetryableError,
    )

    expect(kv.size).toBe(0)
    expect(sent).toHaveLength(0)
    expect(anchors()).toHaveLength(0)
  })

  it('writes no marker when a run is told it has reached the end without having visited the workspaces', async () => {
    const { env, sent, kv } = fakes()
    await run(env, null)

    await expect(run(env, ordered[1])).rejects.toBeInstanceOf(
      TaskRetryableError,
    )

    expect(kv.has(PARTICIPANT_BACKFILL_MARKER_KEY)).toBe(false)
    expect(sent).toHaveLength(1)
  })

  it('fails a message that skips part of the id range', async () => {
    const { env, sent, kv } = fakes()
    const gamma = await harness.seedTenant('gamma')
    const all = [
      alpha.organizationId,
      beta.organizationId,
      gamma.organizationId,
    ].sort()
    await run(env, null)
    await expect(run(env, all[1])).rejects.toBeInstanceOf(TaskRetryableError)

    expect(sent).toHaveLength(1)
    expect(kv.get(participantBackfillRunKey('run-1'))).toBe(all[0])
  })

  it('does not strand a run on a stale read of its cursor: the message fails and the retry goes through', async () => {
    const { env, sent, kv } = fakes()
    await run(env, null)
    const current = kv.get(participantBackfillRunKey('run-1'))
    kv.delete(participantBackfillRunKey('run-1'))

    await expect(run(env, ordered[0])).rejects.toBeInstanceOf(
      TaskRetryableError,
    )

    kv.set(participantBackfillRunKey('run-1'), current ?? '')
    await run(env, ordered[0])
    expect(sent).toHaveLength(2)
  })

  it('does nothing for a duplicate of a message the run has moved past', async () => {
    const { env, sent, kv } = fakes()
    await run(env, null)
    await run(env, ordered[0])
    const before = [...sent]
    const beforeKv = new Map(kv)
    const beforeAnchors = anchors()
    const beforeChanges = harness.sqlite
      .prepare('SELECT total_changes() AS count')
      .get()
    const put = vi.spyOn(env.KV, 'put')
    const sink = createMemorySink()
    const metrics = await createParticipantBackfillHandler(() => harness.db)(
      { runId: 'run-1', after: null },
      { ...context(env), logger: createLogger({ level: 'info', sink }) },
    )
    expect(sink.records).toEqual([
      expect.objectContaining({
        level: 'warn',
        msg: 'participation backfill message already handled',
      }),
    ])
    expect(put).not.toHaveBeenCalled()
    expect(
      harness.sqlite.prepare('SELECT total_changes() AS count').get(),
    ).toEqual(beforeChanges)
    expect(kv).toEqual(beforeKv)
    expect(kv.has(PARTICIPANT_BACKFILL_MARKER_KEY)).toBe(false)
    expect(anchors()).toEqual(beforeAnchors)

    expect(metrics).toEqual({ organizations: 0, participants: 0, complete: 0 })
    expect(sent).toEqual(before)
  })

  it('refuses to run without the D1 binding', async () => {
    const { env } = fakes()
    await expect(
      createParticipantBackfillHandler(() => harness.db)(
        { runId: 'run-1', after: null },
        context({ ...env, DB: undefined }),
      ),
    ).rejects.toBeInstanceOf(TaskConfigurationError)
  })
})
