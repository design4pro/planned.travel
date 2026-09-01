/**
 * The travel journal's copy, in the source locale.
 *
 * `docs/SPEC.md` §8 reserves this namespace by name. It was one of the five the
 * contract named and nobody wrote, so every word on a journey page reached all
 * twenty-three locales in English.
 *
 * **What belongs here.** What the journal screens say on their own behalf. Not
 * the writer's own words — a journey title, an entry body, a photo caption and a
 * mood label are content, and content is never a message.
 *
 * **Still English on these screens, and why.** `humaniseToken()` turns a stored
 * `status` or `visibility` into a label by title-casing the token, which is
 * English with extra steps. Fixing it needs a key per token value rather than a
 * key per label, so it is its own change; this file does not pretend otherwise.
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* ----------------------------------------------------- shared values */
  /**
   * Stands in for a date a journey has not been given. Shared by the cover
   * figure and the side panel, so one absent date reads the same in both.
   */
  'value.notSet': 'Not set',
  /* -------------------------------------------------- the journey page */
  'story.error': 'This journey did not load',
  /**
   * Returns to the journal index. The chevron beside it mirrors in `ar`.
   */
  'story.back': 'All journeys',
  /**
   * Announced while the page is still a set of skeletons. Screen-reader only —
   * a sighted reader has the skeletons themselves.
   */
  'story.loading': 'Loading',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Entries',
  'figure.photos': 'Photos',
  'figure.dates': 'Dates',
  'figure.visibility': 'Visibility',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'This journey has no entries yet',
  /**
   * Written to be read once. It names what an entry actually is, because a
   * journal with nothing in it cannot show you.
   */
  'entries.empty.body':
    'Each entry is one moment: a date, a few lines, a place and the photographs you took there. Write the first one while you still remember the smell of it.',
  /**
   * The photo tally on an entry card. `{photos}` is already grouped for the
   * locale and is all the reader sees; `count` selects the branch.
   */
  'entry.photos.count': {
    one: '{photos} photo',
    other: '{photos} photos',
  },
  /**
   * A photograph the writer gave no caption.
   */
  'photo.untitled': 'Untitled photograph',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'This journey',
  'side.status': 'Status',
  'side.started': 'Started',
  'side.ended': 'Ended',
  'side.loosePhotos': 'Loose photos',
  'moods.label': 'Moods',
  'authors.label': 'Written by',
  /**
   * How many people wrote in this journey. `{authors}` is already grouped for
   * the locale; `count` selects the branch.
   */
  'authors.count': {
    one: '{authors} author',
    other: '{authors} authors',
  },
} as const satisfies NamespaceMessages

export default messages
