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
