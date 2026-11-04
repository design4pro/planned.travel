import type { MascotCandidate } from '#/lib/mascot-prompts'

export async function loadMascotCandidates(sources: {
  notifications: () => Promise<Array<MascotCandidate>>
  scheduled: () => Promise<Array<MascotCandidate>>
}) {
  const results = await Promise.allSettled([
    sources.notifications(),
    sources.scheduled(),
  ])
  return {
    candidates: results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    ),
    partial: results.some((result) => result.status === 'rejected'),
  }
}
