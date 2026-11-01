import { describe, expect, it } from 'vitest'
import { readParticipantBackfillMarker } from '../participant-backfill-marker'

const store = (value: string | null) => ({
  get: async () => value,
  put: async () => undefined,
})

describe('readParticipantBackfillMarker', () => {
  it.each([
    null,
    '',
    '{',
    'null',
    '[]',
    'true',
    '"marker"',
    '{}',
    '{"runId":1,"completedAt":"time"}',
    '{"runId":"run"}',
    '{"runId":"run","completedAt":null}',
  ])('treats invalid content %s as absent', async (value) => {
    await expect(
      readParticipantBackfillMarker(store(value)),
    ).resolves.toBeNull()
  })

  it('projects valid markers without changing accepted string values', async () => {
    await expect(
      readParticipantBackfillMarker(
        store(
          JSON.stringify({
            runId: '',
            completedAt: 'time',
            extra: true,
          }),
        ),
      ),
    ).resolves.toEqual({ runId: '', completedAt: 'time' })
  })

  it('propagates storage failures', async () => {
    const failure = new Error('KV unavailable')
    await expect(
      readParticipantBackfillMarker({
        get: async () => {
          throw failure
        },
        put: async () => undefined,
      }),
    ).rejects.toBe(failure)
  })
})
