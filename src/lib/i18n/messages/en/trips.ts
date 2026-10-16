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
  'notFound.title': "We can't find this trip",
  'notFound.body':
    "It isn't among the trips you can open in the workspace you're in now. It may have been deleted, or you may not have access to it.",
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Add a place to this trip',
  'plan.editor.editTitle': 'Edit this place',
  'plan.editor.createDescription':
    'Give it a name now and a position later - an unplanned place waits in the places panel until you drop it on a day.',
  'plan.editor.editDescription':
    'Changes apply everywhere this place appears: the map, every day it is on, and the trip’s inventory.',
  'plan.editor.nameRequired': 'A place needs a name',
  'plan.editor.nameExample': 'e.g. Fushimi Inari Taisha',
  'plan.editor.city': 'City',
  'plan.editor.cityExample': 'e.g. Kyoto',
  'plan.editor.addressExample': 'e.g. 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'How long there',
  'plan.editor.rating': 'Worth it?',
  'plan.editor.latitude': 'Latitude',
  'plan.editor.longitude': 'Longitude',
  'plan.editor.positionHint': 'Or close this and pick the spot on the map.',
  'plan.editor.latitudeError': 'Between -90 and 90',
  'plan.editor.longitudeError': 'Between -180 and 180',
  'plan.editor.positionError': 'A position needs both numbers',
  'plan.editor.day': 'Put it on a day',
  'plan.editor.dayHint': 'Leave this unset to keep it in the places panel.',
  'plan.editor.unplanned': 'Leave it unplanned',
  'plan.editor.dayNamed': 'Day {day} · {title}',
  'plan.editor.stopFallback': 'This stop',
  'plan.editor.dayNumber': 'Day {day}',
  'plan.editor.visited': 'Already been',
  'plan.editor.visitedHint': 'Marks the pin with a tick.',
  'plan.editor.saving': 'Saving the place',
  'plan.editor.save': 'Save changes',
  'plan.editor.noCategory': 'No category',
  'plan.editor.arrive': 'Arrive',
  'plan.editor.leave': 'Leave',
  'plan.editor.timeError': 'Later than the arrival, please',
  'plan.editor.booking': 'Booking',
  'plan.editor.note': 'Note for this stop',
  'plan.editor.noteExample': 'Go early - the queue past 9am is an hour.',
  'plan.editor.savingTimes': 'Saving the times',
  'plan.editor.saveTimes': 'Save',
  'plan.editor.duration0': 'No fixed length',
  'plan.editor.duration30': '30 minutes',
  'plan.editor.duration45': '45 minutes',
  'plan.editor.duration60': '1 hour',
  'plan.editor.duration90': '1½ hours',
  'plan.editor.duration120': '2 hours',
  'plan.editor.duration180': '3 hours',
  'plan.editor.duration240': 'Half a day',
  'plan.editor.duration480': 'A full day',
  'plan.editor.rating0': 'Not rated',
  'plan.editor.rating1': '★ 1 - skip it',
  'plan.editor.rating2': '★ 2 - if there is time',
  'plan.editor.rating3': '★ 3 - worth it',
  'plan.editor.rating4': '★ 4 - really good',
  'plan.editor.rating5': '★ 5 - do not miss',
  'plan.editor.bookingNone': 'No booking needed',
  'plan.editor.bookingPending': 'Still to book',
  'plan.editor.bookingConfirmed': 'Booked and confirmed',
  'plan.editor.bookingCompleted': 'Been and done',
  'plan.editor.bookingCancelled': 'Cancelled',
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
  'error.people': 'The people did not load',
  /* ------------------------------------ the band every trip tab opens with */
  /**
   * The trip's length beside its dates, and how many days the itinerary holds.
   * `{days}` arrives already grouped for the locale; `count` only selects the
   * plural branch.
   */
  'header.length': {
    one: '{days} day',
    other: '{days} days',
  },
  'header.planned': {
    one: '{days} day planned',
    other: '{days} days planned',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinerary',
  'plan.places': 'Places',
  'plan.readOnly.archived': 'This trip is archived, so the plan is read-only.',
  'plan.readOnly.role':
    'You can read this plan. Only the trip’s owner and editors can change it.',
  /* --------------------------------------------------- the day's sequence */
  /**
   * The dashed drop target a day shows when its **whole sequence** is empty — no
   * places and no notes. It names both kinds because both land here: a day is one
   * list, and a target that only mentioned places would describe half of it.
   */
  'plan.day.empty': 'Nothing planned — drop a place or a note here',
  /* ------------------------------------------------- a refused or questioned move */
  /**
   * Why a drag changed nothing, said twice over: a toast for a reader watching the
   * rail, and a sentence for the live region a keyboard reader is listening to.
   * Without the second one a refused keyboard drag is silence — the row simply
   * stays where it was and nothing explains it.
   *
   * `{name}` is the place or the note's headline. The two `notInIdeas` /
   * `notInAnotherDay` refusals are product statements rather than failures: the
   * ideas rail is the trip's unscheduled *place* inventory, and a note belongs to
   * the day it was written for.
   */
  'plan.move.refused.duplicate': '{name} is already on that day',
  'plan.move.refused.duplicateBody':
    'A place can only appear once per day. Move it to another day instead.',
  'plan.move.refused.notInIdeas': 'A note stays in the day',
  'plan.move.refused.notInIdeasBody':
    'Ideas are places waiting for a day. A note belongs to the day it was written on.',
  'plan.move.refused.notInAnotherDay': 'A note stays on its own day',
  'plan.move.refused.notInAnotherDayBody':
    'Notes cannot be moved between days yet. Edit the note, or write it on the other day.',
  /**
   * The same three sentences a journey needs, said in its own words.
   *
   * A journey cannot borrow the note's: "a note belongs to the day it was written on"
   * is true of a note and false of a train, whose day is its timetable's and not the
   * reader's. `{name}` is the journey said in words — "Tokyo to Kyoto".
   */
  'plan.move.refused.journeyNotInIdeas': 'A journey stays in the day',
  'plan.move.refused.journeyNotInIdeasBody':
    'Ideas are places waiting for a day. A journey belongs to the day it happens on.',
  'plan.move.refused.journeyNotInAnotherDay': 'A journey stays on its own day',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'A journey’s day comes from its dates. Change them on the Transports tab.',
  'plan.move.refused.journeyTimed': '{name} leaves at {time}',
  'plan.move.refused.journeyTimedBody':
    'A departure time is the timetable’s, not the plan’s. Put the journey where its clock belongs.',
  'plan.move.spoken.duplicate':
    '{name} was not moved. That day already has it.',
  'plan.move.spoken.notInIdeas':
    '{name} was not moved. A note stays in the day.',
  'plan.move.spoken.notInAnotherDay':
    '{name} was not moved. A note stays on its own day.',
  'plan.move.spoken.timed': '{name} carries {time}. Asking whether to drop it.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} was not moved. A journey stays in the day.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} was not moved. A journey stays on its own day.',
  'plan.move.spoken.journeyTimed': '{name} was not moved. It leaves at {time}.',
  'plan.move.error.save': 'That move did not save',
  'plan.move.error.retry': 'Try it again in a moment.',
  /**
   * The question a timed item asks before it moves against its own clock.
   *
   * A time outranks a position (PRD #104 decision 9), so the board will not quietly
   * reorder a row that carries one — but refusing outright would make a legitimate
   * "actually, this is not at 14:30 any more" impossible from the rail. So it asks,
   * and agreeing clears the time in the very same write.
   *
   * The confirm names the consequence rather than saying "OK": the reader is losing
   * a time, and that is the part a two-word button would hide.
   */
  'plan.move.dropTime.title': 'Move {name} and drop its {time}?',
  'plan.move.dropTime.body':
    'This position contradicts the time on it. Moving it here clears the time — the new order and the cleared time are saved together.',
  'plan.move.dropTime.confirm': 'Move and drop the time',
  'plan.move.dropTime.cancel': 'Keep it where it is',
  /* ------------------------------------------------- a day's own notes */
  /**
   * The note affordances. `add` is the control's own label; `addForDay` is the
   * dashed target inside a day, which says which day it writes to because a
   * reader looking at a ten-day plan is looking at four of these at once.
   *
   * `{day}` is that day's own title — a custom one, or `Day 3` — so the name is
   * the one thing that differs between the four, and it is appended rather than
   * declined: several of the twenty-three would need a case the title cannot
   * supply, the same reason `atlas.actions.visit.add.name` appends.
   */
  'plan.note.add': 'Add a note',
  'plan.note.addForDay': 'Add a note for {day}',
  /* ---------------------------------------------- adding a place */
  /**
   * The rail's add control and its menu, the day footer's own add control
   * (`forDayNamed` is its accessible name, so ten days are ten distinguishable
   * buttons). The footer control shows `label`, which is the name's own opening
   * words in every locale — WCAG 2.5.3, Label in Name — the note control's pattern.
   */
  'plan.addPlace.label': 'Add a place',
  'plan.addPlace.more': 'More ways to add a place',
  'plan.addPlace.option.map': 'Place it on the map',
  'plan.addPlace.forDayNamed': 'Add a place to {day}',
  'plan.addPlace.quota':
    'You’ve reached your plan’s limit on places. Upgrade to add more.',
  'plan.addPlace.quotaAction': 'See plans',
  /* ---------------------------------------------- a stay on the day */
  /**
   * What a day header says about a stay covering it: `checkIn` on its first
   * day, `checkOut` on its last, both on a one-day stay, and the property's
   * own name on every day. `addStay` is the day panel's accessible name for
   * the control whose visible label is `addStayShort`, so ten days are ten
   * distinguishable buttons. The visible label is the name's own opening words
   * in every locale — WCAG 2.5.3, Label in Name — the note control's pattern.
   */
  'plan.stay.checkIn': 'Check in',
  'plan.stay.checkOut': 'Check out',
  'plan.day.addStay': 'Add a stay for {day}',
  'plan.day.addStayShort': 'Add a stay',
  /**
   * The map hand-off: links from a stop and from a day's footer into the reader's own
   * map application. `{service}` is a brand name carried as data (`MAP_SERVICE_NAME`), never
   * translated. Every name opens with its control's visible label (WCAG 2.5.3) and says it
   * opens a new tab. `directionsPartial` is shown when a day is over the link's waypoint
   * limit, in words that need no plural so no locale has to branch on `{total}`.
   */
  'plan.handoff.stop': 'Open {place} in {service} (opens in a new tab)',
  'plan.handoff.day.directions': 'Directions in {service}',
  'plan.handoff.day.directionsName':
    'Directions in {service} for {day} (opens in a new tab)',
  'plan.handoff.day.directionsPartial': 'Stops: first {carried} of {total}',
  'plan.handoff.day.directionsPartialName':
    'Directions in {service} for {day}, stops: first {carried} of {total} (opens in a new tab)',
  'plan.handoff.day.point': 'Show on {service}',
  'plan.handoff.day.pointName':
    'Show on {service}: the one mapped stop of {day} (opens in a new tab)',
  /**
   * Dropping a pin on the map: the empty map's hint, the arming banner and its
   * stop button, the provisional pin's name, and what a refused drop says.
   */
  'plan.drop.hint':
    'Right-click the map, or press and hold, to add a place right there.',
  'plan.drop.armed':
    'Click the map where it goes, or move the map and press Enter to drop it in the middle.',
  'plan.drop.stop': 'Stop placing a new pin',
  'plan.drop.pin': 'New place',
  'plan.drop.lookingUp': 'Finding the address…',
  'plan.drop.error': 'The pin could not be dropped. Try it again in a moment.',
  /**
   * The place form's coordinate pair, after a pasted position was read.
   * `{lat}` and `{lng}` are the numbers exactly as the fields now hold them — a
   * `.` decimal point in every locale, because the fields require one. Keep it
   * to two caption lines at 360px with both numbers at `-151.215312`.
   */
  'plan.place.pastedPosition': 'Read as latitude {lat}, longitude {lng}',
  /**
   * The disclosure, which exists only on a note that carries a detail. Two
   * messages rather than one with a state suffix: several of the twenty-three
   * change more than a word between "more" and "less".
   */
  'plan.note.showMore': 'Show more',
  'plan.note.showLess': 'Show less',
  'plan.note.moveUp': 'Move up',
  'plan.note.moveDown': 'Move down',
  /**
   * The note's drag handle, named as an action rather than a thing: it is the
   * control's whole accessible name, and a screen reader that has just heard the
   * note's text needs to know what pressing this does, not what it is called.
   */
  'plan.note.drag': 'Reorder note',
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
  /* ------------------------------------------------- a journey on the board */
  /**
   * What one day of a journey is called, and how a journey is named.
   *
   * Three triples rather than one, because a flight departing is not a hire car being
   * picked up, and a reader who sees "Departs / In the air / Lands" on an aeroplane
   * learns nothing from "Starts / Under way / Ends". `flight` takes the air triple,
   * `car` the hire triple, and the other ten modes the generic one — a bus, a ferry
   * and a walk all simply start, go on and end.
   *
   * A one-day journey shows none of them: naming a part only makes sense when there
   * is more than one. `label` is the row's accessible name, so a drag announcement
   * names a journey the way it names a stop.
   */
  'plan.transport.phase.flight.departing': 'Departs',
  'plan.transport.phase.flight.travelling': 'In the air',
  'plan.transport.phase.flight.arriving': 'Lands',
  'plan.transport.phase.hire.departing': 'Pick-up',
  'plan.transport.phase.hire.travelling': 'On hire',
  'plan.transport.phase.hire.arriving': 'Drop-off',
  'plan.transport.phase.journey.departing': 'Starts',
  'plan.transport.phase.journey.travelling': 'Under way',
  'plan.transport.phase.journey.arriving': 'Ends',
  'plan.transport.label': '{from} to {to}',
  /**
   * The journey's drag handle, named as an action the way the note's is — and naming
   * the journey too, because the row's own text already says "Tokyo to Kyoto" and a
   * handle that says only that is indistinguishable from the words beside it.
   *
   * `{journey}` is `plan.transport.label` as the row renders it, which makes it a
   * phrase rather than a noun — "Von Tokyo nach Kyoto", "Từ Tokyo đến Kyoto". So the
   * action leads and the journey is appended after the separator each locale uses in
   * `atlas.actions.visit.add.name`, the same construction: run together instead, half
   * the twenty-three read as a second preposition ("Ändra ordning på Från…") or stack
   * a particle onto one ("…京都 へ を並べ替える"), and Arabic turns into the wrong verb
   * altogether — "reordering *from* Tokyo *to* Kyoto" is a move, not a reorder.
   */
  'plan.transport.drag': 'Reorder, {journey}',
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
  /* ---------------------------------------------------- the people tab */
  'people.title': 'People',
  'people.description': 'Who is on this trip, and who can find it',
  /* -------------------------------------------------- the members list */
  'people.members.title': 'On this trip',
  /**
   * The list is empty only in one way: every remaining member has left the
   * workspace, so each of them is dropped rather than rendered nameless. It is
   * a degenerate state to be honest about, not a call to action - which is why
   * this is a sentence and not an empty state with a button.
   */
  'people.members.empty': 'Nobody on this trip is in this workspace any more',
  'people.role.label': 'Role',
  'people.role.owner': 'Owner',
  'people.role.editor': 'Editor',
  'people.role.viewer': 'Viewer',
  'people.you': 'You',
  /**
   * What a sole owner's own row says where the role control and the leave
   * affordance would be. Both are absent because the last-owner guard refuses
   * every move they could start, so the row says why rather than going quiet.
   */
  'people.owner.hint': 'A trip always keeps at least one owner',
  /* ------------------------------------- taking somebody off, and leaving */
  /**
   * `{name}` is the person's name from their workspace profile. It is in the
   * action as well as in the dialog title because the action is an icon button,
   * and a list of identical "Remove" labels is a list a screen reader cannot
   * tell apart.
   */
  'people.remove.action': 'Remove {name} from this trip',
  'people.remove.title': 'Remove {name} from this trip?',
  'people.remove.body':
    'They lose access to the plan straight away. What they added stays on the trip.',
  'people.remove.confirm': 'Remove',
  'people.leave.action': 'Leave this trip',
  'people.leave.title': 'Leave this trip?',
  'people.leave.body':
    'You lose access to the plan until somebody on the trip adds you back.',
  'people.leave.confirm': 'Leave',
  /**
   * Namespace-local on purpose: the catalogue has no shared action namespace -
   * `modules.action.cancel` and `console.dialog.cancel` are each their own -
   * and inventing one is a cross-cutting change this tab does not own.
   */
  'people.cancel': 'Cancel',
  /* ------------------------------------------------- the invite control */
  'people.invite.title': 'Add somebody',
  'people.invite.placeholder': 'Search the people in this workspace',
  'people.invite.action': 'Add to trip',
  'people.invite.role': 'They join as',
  'people.invite.empty': 'Everybody in this workspace is already on this trip',
  'people.invite.emptyHint':
    'Somebody new joins the workspace first, in Settings',
  /* ------------------------------------------------- the visibility card */
  'people.visibility.title': 'Who can find this trip',
  'people.visibility.switch': 'Visible to everyone in the workspace',
  /**
   * The switch has two positions and the column stores three values, so the
   * stored state is said in words beneath it - including the third, which this
   * control reports and refuses to move rather than silently downgrading.
   */
  'people.visibility.private': 'Only the people listed here can see this trip',
  'people.visibility.organization':
    'Anyone in this workspace can open this trip',
  'people.visibility.public': 'This trip is shared with a public link',
  /* -------------------------------------------- the three named refusals */
  /**
   * The client picks one of these three from the refusal's `reason` code; the
   * server never composes a sentence. The last-owner line answers both verbs -
   * removing the last owner and demoting them - because from the reader's side
   * it is one rule.
   */
  'people.error.lastOwner':
    'A trip keeps at least one owner. Make somebody else an owner first.',
  'people.error.notInWorkspace': 'That person is not in this workspace',
  'people.error.alreadyOnTrip': 'That person is already on this trip',
  'people.guests.title': 'Travelling with you',
  'people.guests.description': 'People on this trip who do not have an account',
  'people.guests.empty': 'Nobody yet',
  'people.guests.emptyHint':
    'A guest is somebody travelling with you who does not need an account. Add them by name.',
  'people.guest.badge': 'Guest',
  'people.guest.add.label': 'Their name',
  'people.guest.add.placeholder': 'Anna',
  'people.guest.add.action': 'Add a guest',
  'people.guest.rename.action': 'Rename {name}',
  'people.guest.rename.title': 'Rename {name}',
  'people.guest.rename.confirm': 'Rename',
  'people.guest.remove.action': 'Remove {name} from this trip',
  'people.guest.remove.title': 'Remove {name} from this trip?',
  'people.guest.remove.body':
    'The guest goes. Nothing else on the trip changes.',
  'people.guest.remove.confirm': 'Remove',
  'people.guest.merge.action': '{name} is now…',
  'people.guest.merge.title': '{name} is now one of the people on this trip',
  'people.guest.merge.body':
    'Everything assigned to {name} moves to the person you choose, and the guest goes. This cannot be undone.',
  'people.guest.merge.inherits':
    '{member} inherits everything assigned to {name}.',
  'people.guest.merge.placeholder': 'Choose somebody on this trip',
  'people.guest.merge.confirm': 'Merge',
  'people.guest.merge.done': '{name} is now {member}',
  'people.guest.merge.nothingMoved': 'Nothing was assigned to them yet',
  'people.error.guestNameTaken': 'A guest named {name} is already on this trip',
  'people.error.guestLimit':
    'A trip holds at most {limit} guests, because a longer list makes the participant pickers and the split arithmetic hard to read',
  'people.error.guestMergeTarget':
    'Choose somebody who is already on this trip',
  'plan.weather.badge.forecast': 'Forecast: {condition}, high {max}, low {min}',
  'plan.weather.badge.forecastNoCondition': 'Forecast: high {max}, low {min}',
  'plan.weather.badge.unavailable': 'Weather unavailable for this day',
  'plan.weather.badge.loading': 'Loading weather',
  'plan.weather.badge.recorded': 'Recorded: high {max}, low {min}',
  'plan.weather.badge.recordedHigh': 'Recorded: high {max}',
  'plan.weather.badge.recordedLow': 'Recorded: low {min}',
  'plan.weather.badge.estimate': 'Estimate: typical high {max}, low {min}',
  'plan.weather.badge.estimateHigh': 'Estimate: typical high {max}',
  'plan.weather.badge.estimateLow': 'Estimate: typical low {min}',
  'plan.weather.badge.notYetRecorded': 'Not yet recorded',
  'plan.weather.condition.clear': 'Clear',
  'plan.weather.condition.fair': 'Fair',
  'plan.weather.condition.partlyCloudy': 'Partly cloudy',
  'plan.weather.condition.cloudy': 'Cloudy',
  'plan.weather.condition.fog': 'Fog',
  'plan.weather.condition.rain': 'Rain',
  'plan.weather.condition.heavyRain': 'Heavy rain',
  'plan.weather.condition.sleet': 'Sleet',
  'plan.weather.condition.snow': 'Snow',
  'plan.weather.condition.thunder': 'Thunder',
  'plan.weather.panel.title': 'Weather for {date}',
  'plan.weather.panel.temperature': 'High / low',
  'plan.weather.panel.precipitation': 'Precipitation',
  'plan.weather.panel.precipitationTypical': 'Typical precipitation per day',
  'plan.weather.panel.probability': '{percent} chance',
  'plan.weather.panel.wind': 'Wind',
  'plan.weather.panel.sunrise': 'Sunrise',
  'plan.weather.panel.sunset': 'Sunset',
  'plan.weather.panel.noSunrise': 'No sunrise',
  'plan.weather.panel.noSunset': 'No sunset',
  'plan.weather.panel.slots': 'Through the day',
  'plan.weather.panel.slot.night': 'Night',
  'plan.weather.panel.slot.morning': 'Morning',
  'plan.weather.panel.slot.afternoon': 'Afternoon',
  'plan.weather.panel.slot.evening': 'Evening',
  'plan.weather.panel.high': 'High',
  'plan.weather.panel.low': 'Low',
  'plan.weather.panel.recordedNote': 'Measured values for this day.',
  'plan.weather.panel.temperatureTypical': 'Typical high / low',
  'plan.weather.panel.estimateNote':
    'A long-term average for this month, not a forecast.',
  'plan.weather.attribution.metNorway': 'Forecast data: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Data: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Resize itinerary',
  'plan.workspace.resizePlaces': 'Resize places',
  'plan.workspace.toggleDay': 'Expand or collapse {day}',
  'plan.workspace.days': 'Days',
  'plan.workspace.showPanel': 'Show the {label} panel',
  'plan.workspace.hidePanel': 'Hide the {label} panel',
  'plan.workspace.narrowPanel': 'Narrow {label}',
  'plan.workspace.widenPanel': 'Widen {label}',
} as const satisfies NamespaceMessages

export default messages
