/**
 * The completion marker of the participation backfill (ADR 0043). The erasure engine refuses to run
 * until it exists, because before the backfill an anchor row can be missing for a person who left.
 *
 * The value names the run that finished and when; it has no expiry. Only the handler that handled
 * the last workspace of a chain writes it, so a chain that failed part-way leaves no marker.
 */

export const PARTICIPANT_BACKFILL_MARKER_KEY = 'erasure:participants-backfilled'

export interface ParticipantBackfillMarker {
  readonly runId: string
  readonly completedAt: string
}

interface MarkerStore {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string) => Promise<void>
}

export async function writeParticipantBackfillMarker(
  kv: MarkerStore,
  runId: string,
  completedAt: Date,
): Promise<void> {
  const marker: ParticipantBackfillMarker = {
    runId,
    completedAt: completedAt.toISOString(),
  }
  await kv.put(PARTICIPANT_BACKFILL_MARKER_KEY, JSON.stringify(marker))
}

/**
 * Where one run has got to: the last organization id it visited, `''` once the run has started and
 * visited none. The completion marker is written only by a message whose cursor equals this value,
 * so a message that starts past the end, or skips part of the id range, cannot finish a run.
 */
export function participantBackfillRunKey(runId: string): string {
  return `erasure:participants-backfill-run:${runId}`
}

export async function readParticipantBackfillRunCursor(
  kv: Pick<MarkerStore, 'get'>,
  runId: string,
): Promise<string | null> {
  return kv.get(participantBackfillRunKey(runId))
}

export async function writeParticipantBackfillRunCursor(
  kv: Pick<MarkerStore, 'put'>,
  runId: string,
  cursor: string,
): Promise<void> {
  await kv.put(participantBackfillRunKey(runId), cursor)
}

export async function readParticipantBackfillMarker(
  kv: MarkerStore,
): Promise<ParticipantBackfillMarker | null> {
  const raw = await kv.get(PARTICIPANT_BACKFILL_MARKER_KEY)
  if (raw === null) return null
  const parsed: unknown = JSON.parse(raw)
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'runId' in parsed &&
    'completedAt' in parsed &&
    typeof parsed.runId === 'string' &&
    typeof parsed.completedAt === 'string'
  ) {
    return { runId: parsed.runId, completedAt: parsed.completedAt }
  }
  return null
}
