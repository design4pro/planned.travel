/**
 * The trip tabs' own copy, in the source locale.
 *
 * `docs/SPEC.md` §8 reserves this namespace by name; it was one of the five it
 * named and nobody wrote. This file covers the tab shells — the header, the
 * stat tiles and the failure titles — for the itinerary, collab and bookings
 * tabs. The modules those tabs render have their own namespace.
 *
 * **Composed sentences are messages, not concatenation.** The header
 * descriptions used to be template literals: `${pluralise(total, 'booking')} ·
 * ${confirmed} confirmed`. English word order was baked into the join, and
 * `pluralise`'s two-form shorthand is pinned to `en` by construction. Each part
 * is its own message now, and the component joins them with the middle dot —
 * because that join is a list, not grammar.
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  /**
   * One title per tab rather than one with the module name substituted in:
   * "the plan" and "the bookings" take different articles and different verb
   * agreement in most of the twenty-three, and a slot would fix English word
   * order on all of them.
   */
  'error.trip': 'This trip did not load',
  'error.plan': 'The plan did not load',
  'error.costs': 'The costs did not load',
  'error.collab': 'The conversation did not load',
  'error.book': 'The bookings did not load',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinerary',
  'plan.places': 'Places',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Collab',
  'collab.empty': 'Nothing shared yet',
  'collab.conversation': 'Conversation',
  /**
   * The three tallies in the collab header, joined by the component with a
   * middle dot. Three messages rather than one sentence, because the join is a
   * list and not grammar — and each noun agrees on its own count.
   */
  'collab.count.messages': {
    one: '{messages} message',
    other: '{messages} messages',
  },
  'collab.count.notes': {
    one: '{notes} note',
    other: '{notes} notes',
  },
  'collab.count.polls': {
    one: '{polls} poll',
    other: '{polls} polls',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Bookings',
  'book.empty': 'Nothing booked yet',
  'book.count.bookings': {
    one: '{bookings} booking',
    other: '{bookings} bookings',
  },
  /**
   * Reads as "3 confirmed", agreeing with the bookings it counts. English has
   * one form; most of the catalogue does not.
   */
  'book.count.confirmed': {
    one: '{confirmed} confirmed',
    other: '{confirmed} confirmed',
  },
  /**
   * The progress ring's accessible name. `{total}` selects the branch: the
   * noun agrees with the total, not with how many of them are confirmed.
   */
  'book.progressLabel': {
    one: '{confirmed} of {total} booking confirmed',
    other: '{confirmed} of {total} bookings confirmed',
  },
  /**
   * The quiet half of "12 of 30". A fragment on purpose — the figure beside
   * it is set in a different size and weight.
   */
  'book.ofTotal': 'of {total}',
  'book.confirmed': 'Confirmed',
  'book.awaiting': 'Awaiting confirmation',
  'book.nothingHanging': 'Nothing hanging',
  'book.chase': 'Chase these before you fly',
  'book.committed': 'Committed',
  'book.committedCaption': 'Across every booking on this trip',
  'book.onItinerary': 'On the itinerary',
  'book.pinnedCaption': 'Pinned to a day of the plan',
} as const satisfies NamespaceMessages

export default messages
