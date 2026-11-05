import type { MascotCandidate } from '#/lib/mascot-prompts'

export async function loadMascotCandidates(sources: {
  notifications: () => Promise<Array<MascotCandidate>>
  scheduled: () => Promise<{
    candidates: Array<MascotCandidate>
    partial: boolean
  }>
}) {
  const results = await Promise.allSettled([
    sources.notifications(),
    sources.scheduled(),
  ])
  const notifications = results[0]
  const scheduled = results[1]
  return {
    candidates: [
      ...(notifications.status === 'fulfilled' ? notifications.value : []),
      ...(scheduled.status === 'fulfilled' ? scheduled.value.candidates : []),
    ],
    partial:
      notifications.status === 'rejected' ||
      scheduled.status === 'rejected' ||
      scheduled.value.partial,
  }
}
