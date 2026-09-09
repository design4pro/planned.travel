/**
 * The trip tabs' own copy, in the source locale.
 *
 * `docs/SPEC.md` §8 reserves this namespace by name; it was one of the five it
 * named and nobody wrote. This file covers the tab shells — the header, the
 * stat tiles and the failure titles — for the itinerary, collab, bookings and
 * transports tabs. The modules those tabs render have their own namespace.
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
  'error.transports': 'The transports did not load',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinerary',
  'plan.places': 'Places',
  /* ------------------------------------------------- a day's own notes */
  /**
   * The note affordances. `add` is the control's own label; `addForDay` is the
   * dashed target inside a day, which says which day it writes to because a
   * reader looking at a ten-day plan is looking at four of these at once.
   */
  'plan.note.add': 'Add a note',
  'plan.note.addForDay': 'Add a note for this day',
  /**
   * The disclosure, which exists only on a note that carries a detail. Two
   * messages rather than one with a state suffix: several of the twenty-three
   * change more than a word between "more" and "less".
   */
  'plan.note.showMore': 'Show more',
  'plan.note.showLess': 'Show less',
  'plan.note.moveUp': 'Move up',
  'plan.note.moveDown': 'Move down',
  'plan.note.edit': 'Edit note',
  'plan.note.delete': 'Delete note',
  /* ------------------------------------------------------- the editor */
  'plan.note.dialog.createTitle': 'Add a note',
  'plan.note.dialog.editTitle': 'Edit note',
  'plan.note.field.body': 'Note',
  'plan.note.field.bodyHint': 'One line. This is what the day shows.',
  'plan.note.field.detail': 'Details',
  /**
   * The markdown subset `01-S2a` ships, named as a list of what a writer can
   * reach for rather than as the word "markdown", which is jargon in every
   * locale including this one.
   */
  'plan.note.field.detailHint':
    'Headings, lists, links, quotes, code and tables.',
  'plan.note.field.time': 'Time',
  'plan.note.field.timeHint': 'Optional, 24-hour.',
  'plan.note.field.icon': 'Icon',
  'plan.note.tab.write': 'Write',
  'plan.note.tab.preview': 'Preview',
  'plan.note.previewEmpty': 'Nothing to preview yet',
  'plan.note.save': 'Save note',
  'plan.note.cancel': 'Cancel',
  'plan.note.confirmDelete': 'Delete this note?',
  'plan.note.confirmDeleteBody':
    'The note and its details are removed from this day.',
  /* ------------------------------------------------------ what happened */
  'plan.note.toast.created': 'Note added',
  'plan.note.toast.updated': 'Note saved',
  'plan.note.toast.deleted': 'Note deleted',
  'plan.note.error.save': 'The note did not save',
  'plan.note.error.delete': 'The note was not deleted',
  'plan.note.error.move': 'That move did not save',
  'plan.note.error.retry': 'Try it again in a moment.',
  /**
   * The icon vocabulary, as a reader hears it rather than as the picker stores
   * it: `train-front` is a name in the icon set, "Train" is a word. Each is the
   * accessible name of one radio in the picker, so it has to stand alone.
   */
  'plan.note.icon.alarmClock': 'Reminder',
  'plan.note.icon.clock': 'Time',
  'plan.note.icon.flashlight': 'Torch',
  'plan.note.icon.footprints': 'Walk',
  'plan.note.icon.info': 'Info',
  'plan.note.icon.luggage': 'Luggage',
  'plan.note.icon.package': 'Package',
  'plan.note.icon.ticket': 'Tickets',
  'plan.note.icon.trainFront': 'Train',
  'plan.note.icon.wifi': 'Wi-Fi',
  'plan.note.icon.stickyNote': 'Note',
  'plan.note.icon.utensils': 'Food',
  'plan.note.icon.bus': 'Transport',
  'plan.note.icon.bedDouble': 'Stay',
  'plan.note.icon.camera': 'Photo',
  'plan.note.icon.mapPin': 'Place',
  'plan.note.icon.wallet': 'Money',
  'plan.note.icon.umbrella': 'Rain',
  'plan.note.icon.triangleAlert': 'Warning',
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
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Transports',
  'transports.empty': 'Nothing recorded yet',
  /**
   * The header's two tallies, joined by the component with a middle dot. The
   * distance beside it is a figure and not a sentence, so it needs no message
   * of its own - it comes out of `formatDistance` already in the reader's
   * units and grouping.
   */
  'transports.count.transports': {
    one: '{transports} transport',
    other: '{transports} transports',
  },
  'transports.distance': 'Distance travelled',
  /**
   * The distance read as something a body can picture. `{times}` arrives
   * already rounded to two places, and the multiplication sign is the message's
   * own so a locale that writes it differently can.
   */
  'transports.equator': '≈ {times}× around the equator',
  'transports.noGrouping': 'Nothing grouped yet',
  /**
   * `{mode}` is a mode label from the transports module's own vocabulary, so
   * the word a reader sees here is the same word the mode radio group offers -
   * one owner for the name of a way of travelling.
   */
  'transports.mostly': 'mostly {mode}',
  'transports.confirmed': 'Confirmed',
  'transports.stillPending': {
    one: '{pending} still pending',
    other: '{pending} still pending',
  },
  'transports.spent': 'Spent on travel',
  'transports.noPrices': 'No prices recorded',
  'transports.priced': {
    one: 'across {priced} priced transport',
    other: 'across {priced} priced transports',
  },
} as const satisfies NamespaceMessages

export default messages
