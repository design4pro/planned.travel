import { enabledCollabSections } from '#/lib/collab-sections'
import { formatNumber } from '#/lib/format'
import type { Locale, Translate } from '#/lib/i18n'
import type { CollabScreenData } from './collab-screen'

/**
 * The collaboration header's description: one tally per enabled section, joined by a middle dot.
 *
 * A list, not a sentence: each tally agrees on its own count. The conversation tally is the size
 * of the whole thread (`messageCount`), never the window `messages` carries; it is left out while
 * that count is null.
 */
export function collabSummary(
  data: CollabScreenData,
  t: Translate,
  locale: Locale,
): string {
  const enabled = enabledCollabSections(data.sections)
  if (
    enabled.length === 3 &&
    data.messageCount === 0 &&
    data.notes.length === 0 &&
    data.polls.length === 0
  ) {
    return t('trips.collab.empty')
  }

  const tallies = {
    conversation:
      data.messageCount === null
        ? null
        : t('trips.collab.count.messages', {
            count: data.messageCount,
            messages: formatNumber(data.messageCount, locale),
          }),
    notes: t('trips.collab.count.notes', {
      count: data.notes.length,
      notes: formatNumber(data.notes.length, locale),
    }),
    polls: t('trips.collab.count.polls', {
      count: data.polls.length,
      polls: formatNumber(data.polls.length, locale),
    }),
  }
  return enabled
    .map((id) => tallies[id])
    .filter((tally) => tally !== null)
    .join(' · ')
}
