/**
 * The trip modules' own copy, in the source locale.
 *
 * `docs/SPEC.md` §8 reserves this namespace by name; it was the largest of the
 * five it named and nobody wrote. This file covers the shared confirm dialog,
 * the realtime presence bar and the transports timeline. The rest of the module
 * layer is still English and still waiting.
 *
 * **Hand-rolled English plurals were the real find here.** The timeline had
 * three: a `count === 1 ? 'One …' : \`${count} …\`` ternary whose *verb* also
 * changed between branches, and `{n} tight connection{n === 1 ? '' : 's'}` —
 * an English suffix appended inside JSX. None of that can be right in a
 * language with four plural categories, and no amount of translating the
 * surrounding words fixes it.
 *
 * **A transport is not a leg.** `CONTEXT.md` reserves "leg" for the part of a
 * transport between two consecutive stations; a whole journey is a transport.
 * The `transports.*` copy below predated that glossary and said "leg" for both,
 * which the chain editor would have made unreadable: "Add a leg" carrying a
 * "Break this into legs" inside it. So each locale now holds two distinct
 * nouns. The first names the whole transport and is what the keys below use;
 * the second belongs to the `transports.chain.*` keys, which the chain editor
 * brought in, and to nothing else. A locale that reaches for the first noun
 * inside a `chain` key has undone the distinction this table exists to hold.
 *
 * - `ar` تنقل, leg: مرحلة
 * - `ca` trajecte, leg: tram
 * - `cs` přesun, leg: úsek
 * - `de` Transfer, leg: Etappe
 * - `el` μετακίνηση, leg: σκέλος
 * - `en` transport, leg: leg
 * - `es` trayecto, leg: tramo
 * - `fr` trajet, leg: tronçon
 * - `hu` út, leg: szakasz
 * - `id` transportasi, leg: ruas
 * - `it` spostamento, leg: tratta
 * - `ja` 移動, leg: 区間
 * - `ko` 이동, leg: 구간
 * - `nl` traject, leg: etappe
 * - `pl` przejazd, leg: odcinek
 * - `pt-BR` deslocamento, leg: trecho
 * - `ru` переезд, leg: участок
 * - `sv` färd, leg: etapp
 * - `tr` yolculuk, leg: etap
 * - `uk` переїзд, leg: ділянка
 * - `vi` lượt di chuyển, leg: chặng
 * - `zh-Hans` 交通, leg: 路段
 * - `zh-Hant` 交通, leg: 路段
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Not set',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Connecting',
  'presence.connecting.body': 'Joining the trip’s live room.',
  'presence.live.title': 'Live',
  'presence.live.body':
    'Messages, notes and votes arrive here as they are made.',
  'presence.reconnecting.title': 'Reconnecting',
  /**
   * Says the one thing that matters while a socket is down — nothing is being
   * lost. Every branch of this bar makes that promise, because the bar is the
   * only place a reader learns the connection is gone.
   */
  'presence.reconnecting.body':
    'The connection dropped. Retrying — anything you send is still saved.',
  'presence.offline.title': 'Not live',
  'presence.offline.body':
    'Live updates are off. Everything still saves; reload or retry to catch up.',
  'presence.reconnect': 'Reconnect',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Every transport',
  'transports.empty.title': 'No transports yet',
  'transports.empty.body':
    'Flights, trains, ferries and the drive from the airport all live here, with their booking codes and seat numbers to hand on the day — and each hand-over checked against the one before it.',
  'transports.empty.action': 'Add the first transport',
  'transports.filtered.title': 'No transports of that kind',
  /**
   * Names the chip that clears the filter, so the sentence and the control
   * cannot drift apart in translation: `{label}` is that chip's own message.
   */
  'transports.filtered.body':
    'Every transport on this trip travels a different way. Switch back to “{label}” to see them all.',
  'transports.filtered.action': 'Show every transport',
  /**
   * Was a hand-rolled two-branch English plural — `count === 1 ? "One …" :
   * `${count} …`` — which is only ever right in English, and whose verb also
   * changed in the tight variant ("is" against "are").
   */
  'transports.alert.impossible.title': {
    one: 'One hand-over cannot be made',
    other: '{value} hand-overs cannot be made',
  },
  'transports.alert.impossible.body':
    'A transport departs before the one before it arrives. The junctions below say which, and by how much.',
  'transports.alert.tight.title': {
    one: 'One connection is tight',
    other: '{value} connections are tight',
  },
  'transports.alert.tight.body':
    'There is time, but not much of it for the mode you are catching. The junctions below show how long each one leaves you.',
  /**
   * Was `{n} broken hand-over{n === 1 ? "" : "s"}`: an English suffix appended
   * in JSX. `{value}` arrives already grouped for the locale.
   */
  'transports.badge.impossible': {
    one: '{value} broken hand-over',
    other: '{value} broken hand-overs',
  },
  'transports.badge.tight': {
    one: '{value} tight connection',
    other: '{value} tight connections',
  },
  'transports.badge.ok': 'Every hand-over works',
  /**
   * Mentions the "Cancelled" status by name, so it moves with the status
   * labels if those are ever keyed. Deliberate: the sentence is telling the
   * reader which other control to use instead.
   */
  'transports.remove.body':
    'The transport comes off this trip for good, along with its booking reference and seat. If it is only cancelled, set its status to Cancelled instead.',
  'transports.remove.confirm': 'Remove transport',
  'transports.menu.edit': 'Edit transport…',
  'transports.field.service': 'Service',
  'transports.field.bookingRef': 'Booking reference',
  'transports.field.seat': 'Seat',
  'transports.field.distance': 'Distance',
  'transports.noTime': 'No time yet',
  'transports.toast.statusFailed.title': 'The status did not change',
  'transports.toast.statusFailed.body':
    'The transport is still in its previous state.',
  'transports.toast.removed': 'Transport removed',
  'transports.toast.removeFailed': 'The transport was not removed',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Add a transport',
  'transports.dialog.editTitle': 'Edit this transport',
  'transports.dialog.description':
    'Flights, trains, ferries and the drive from the airport. Times are the local ones printed on the ticket.',
  'transports.form.modeLegend': 'How are you travelling',
  'transports.form.timingError': 'Check the times',
  /**
   * An illustrative example, localised rather than translated — the same
   * choice `auth`'s `field.name.placeholder` makes. The bare codes beside it
   * (`LHR`, `SK983`, `21A`) stay in the component: those are what is printed on
   * the ticket, in the same class as the key legends `ui` deliberately excludes.
   */
  'transports.field.namePlaceholder': 'SAS from LHR to HND',
  /**
   * Serves both endpoints. `leg-form.ts` decides what the pair is called for
   * the mode in hand, so the field itself only needs the neutral word.
   */
  'transports.field.place': 'Place',
  'transports.field.code': 'Code',
  'transports.field.date': 'Date',
  'transports.field.time': 'Leaving after',
  'transports.field.departurePlaceholder': 'London Heathrow',
  'transports.field.arrivalPlaceholder': 'Tokyo Haneda',
  'transports.field.carrier': 'Carrier',
  'transports.field.serviceNumber': 'Service number',
  'transports.field.bookingRefHint': 'The code you will read back at the desk.',
  'transports.field.notesPlaceholder':
    'Aisle seat requested. Bags checked through to Kyoto.',
  'transports.action.add': 'Add transport',
  'transports.action.save': 'Save transport',
  'transports.action.saving': 'Saving the transport',
  'transports.toast.added': 'Transport added',
  'transports.toast.addedBody': 'It is in the travel order now.',
  'transports.toast.addFailed': 'The transport was not added',
  'transports.toast.updated': 'Transport updated',
  'transports.toast.updateFailed': 'The transport was not updated',

  /* ------------------------------- shared labels and the bookings timeline */
  /**
   * Generic field labels, shared by every module that has such a field.
   * `ui.ts`'s rule about shared keys applies here for the same reason: one key
   * means one translation, rather than transports and bookings quietly
   * disagreeing about what "Notes" is in Ukrainian.
   */
  'field.name': 'Name',
  'field.time': 'Time',
  'field.price': 'Price',
  'field.notes': 'Notes',
  'field.status': 'Status',
  'form.saveError': 'That did not save',
  'action.cancel': 'Cancel',
  'action.showCode': 'Show {label}',
  /**
   * The five stored `booking.status` values, one key each. This is the shape
   * `humaniseToken()` cannot have: a label per token rather than a title-cased
   * token, which is English with extra steps.
   */
  'book.status.none': 'No status',
  'book.status.pending': 'Pending',
  'book.status.confirmed': 'Confirmed',
  'book.status.completed': 'Done',
  'book.status.cancelled': 'Cancelled',
  'book.toast.statusFailed': 'The status did not change',
  'book.toast.statusFailedBody': 'The booking is still in its previous state.',
  'book.toast.removed': 'Booking removed',
  'book.toast.removeFailed': 'The booking was not removed',
  'book.empty.title': 'Nothing booked yet',
  'book.empty.body':
    'Stays, tables, tours and tickets belong here — with the confirmation number where you can find it at the door, and the date it lands on the timeline.',
  'book.empty.action': 'Add the first booking',
  'book.filtered.title': 'Nothing of that kind yet',
  'book.filtered.body':
    'Nothing of the kinds you picked is booked here. Clear the filter to see the rest of the desk.',
  'book.filtered.action': 'Clear filter',
  'book.panel.outstanding': 'Still to settle',
  'book.panel.outstandingEmpty':
    'Nothing outstanding — every booking here is settled.',
  'book.panel.settled': 'Settled',
  'book.panel.settledEmpty': 'Nothing settled yet — it is all still to chase.',
  'book.import.badge': 'Unchecked import',
  'book.import.hint':
    'Imported from a confirmation. Open and save it to mark it checked.',
  'book.import.action': 'Import',
  'book.import.title': 'Import bookings from a file',
  'book.import.description':
    'Drop a confirmation and we will read it. Nothing is added to the trip until you have seen it.',
  'book.import.drop.idle': 'Drop files here, or browse',
  'book.import.drop.active': 'Release to add',
  'book.import.drop.formats':
    'PDF, saved email, web page, photo, Word, Excel, calendar or JSON export.',
  'book.import.drop.limits':
    'Up to {files} files at a time, each up to {size}.',
  'book.import.drop.browse': 'Browse files',
  'book.import.refused.format':
    '“{filename}” is not a file this import can read. It reads a PDF, a saved email, a web page, a photo, a Word or Excel document, a calendar file or a JSON export.',
  'book.import.refused.tooMany':
    'Only {files} files at a time. The rest were not added.',
  'book.import.refused.tooLarge':
    '“{filename}” is {size}. An import reads files up to {limit}.',
  'book.import.refused.empty':
    '“{filename}” is empty, so there is nothing to read.',
  'book.import.ceiling.title':
    'This workspace has read all its confirmations this month',
  'book.import.ceiling.body':
    'The plan includes {ceiling} file readings a month, and the allowance renews on the first. You can still add a booking by hand.',
  'book.import.ceiling.none':
    'Reading a confirmation file is not part of this workspace’s plan',
  'book.import.ceiling.noneBody':
    'Upgrade to have a confirmation read for you. Adding a booking by hand is always available.',
  'book.import.widget.title': 'Reading confirmations',
  'book.import.widget.working': '{done} of {total} read',
  'book.import.widget.file': 'Reading “{filename}”',
  'book.import.widget.done': {
    one: 'One booking ready to review',
    other: '{count} bookings ready to review',
  },
  'book.import.widget.review': 'Review',
  'book.import.widget.failed': '“{filename}” could not be read',
  'book.import.widget.stalled': 'This is taking longer than expected',
  'book.import.widget.check': 'Check again',
  'book.import.widget.dismiss': 'Dismiss',
  'book.import.review.title': 'What we read',
  'book.import.review.from': 'From “{filename}”',
  'book.import.review.selectAll': 'Select all',
  'book.import.review.selectNone': 'Select none',
  'book.import.review.confirm': {
    one: 'Add {count} booking',
    other: 'Add {count} bookings',
  },
  'book.import.review.confirmNone': 'Select a booking to add',
  'book.import.review.cancel': 'Cancel',
  'book.import.review.needsReview': 'Needs a look',
  'book.import.review.needsReviewHint':
    'Some fields were not in the document. Open the booking after adding it.',
  'book.import.review.noPrice': 'No price read',
  'book.import.review.noPriceHint':
    'The document did not state one clearly, so it was left empty rather than guessed.',
  'book.import.review.untitled': 'Untitled booking',
  'book.import.empty.title': 'We could not find a booking in that file',
  'book.import.empty.body':
    '“{filename}” had nothing that looks like a confirmation. Try another file, or add the booking by hand.',
  'book.import.failed.title': '“{filename}” could not be read',
  'book.import.failed.body':
    'The file opened but nothing could be made of it. Try another file, or add the booking by hand.',
  'book.import.failed.retry': 'Try another file',
  'book.import.uploadFailed': '“{filename}” did not upload',
  'book.import.uploadRetry': 'Try again',
  'book.import.actionFailed': 'Try again in a moment.',
  'book.import.toast.added': {
    one: 'One booking added',
    other: '{count} bookings added',
  },
  'book.import.partial.title': '{written} of {total} bookings were added',
  'book.import.partial.body':
    'The rest are still selected. Adding again writes only those.',
  'book.import.partial.retry': 'Add the rest',
  'book.journeyLink': 'On the transports tab',
  'filter.all': 'Everything',
  'book.remove.body':
    'It comes off the timeline for good. If it is only cancelled, set its status to Cancelled instead so you keep the record.',
  'book.remove.confirm': 'Remove booking',
  'book.menu.edit': 'Edit booking…',
  'book.menu.open': 'Open the booking',
  'book.noDate': 'No date yet',
  'book.until': 'Until',
  'book.provider': 'Provider',
  'book.where': 'Where',
  'book.guests': 'Guests',
  'book.confirmation': 'Confirmation',
  'book.undated': 'Give these a date and they join the timeline',
  /**
   * The status menu's accessible name. Was `` `Status of ${title}` `` — a
   * template literal, so English word order travelled with it.
   */
  statusOf: 'Status of {title}',

  /* ------------------------------------------- the booking dialog */
  /**
   * The two statuses the *picker* spells out more fully than the badge does:
   * a menu has room to say what "pending" means and a chip does not. The other
   * three read the same either way and reuse `book.status.*`.
   */
  'book.statusChoice.none': 'No status yet',
  'book.statusChoice.pending': 'Pending — waiting on them',
  'book.dialog.addTitle': 'Add a booking',
  'book.dialog.editTitle': 'Edit this booking',
  'book.dialog.typeLegend': 'What kind of booking',
  'book.field.namePlaceholder': 'Nishishinjuku 1-19-3',
  'book.field.priceHint': 'Leave it empty if it is not settled yet.',
  'book.field.confirmation': 'Confirmation number',
  'book.field.confirmationHint': 'The code you will be asked for at the desk.',
  'book.field.day': 'Attach to a day',
  'book.field.dayHint': 'Pins it to the itinerary so it shows up on the plan.',
  'book.field.noDay': 'Not on the itinerary',
  'book.field.link': 'Link',
  'book.field.notesPlaceholder':
    'Late check-in arranged. Ask for a room away from the lift.',
  'book.action.add': 'Add booking',
  'book.action.save': 'Save booking',
  'book.action.saving': 'Saving the booking',
  'book.toast.added': 'Booking added',
  'book.toast.addedBody': 'It is on the timeline now.',
  'book.toast.addFailed': 'The booking was not added',
  'book.toast.updated': 'Booking updated',
  'book.toast.updateFailed': 'The booking was not updated',

  'book.emptyFacts':
    'Nothing recorded yet beyond the name. Open it to add the time, the price and the confirmation number.',
  'book.onItinerary': 'On the itinerary: {day}',
  /**
   * Was `` `Day ${day.dayNumber}` `` inside `dayLabel()`. The helper is exported
   * and called from two files, so it takes `t` rather than reaching for a
   * provider it may not be under.
   */
  'book.dayNumber': 'Day {n}',

  /* ------------------------------ the booking type table, per type */
  /**
   * The type picker's odd one out. The other six chips reuse
   * `shell.bookingType.*`, which already names every type for the card badge
   * and the dashboard; only `other` differs, because a chip beside Stay and
   * Ticket has to say "Other" where a badge on a card says "Booking".
   */
  'book.shape.other.label': 'Other',
  /**
   * What the provider, location and date fields are *called* per booking type:
   * a stay checks in and out at an address, a train departs and arrives between
   * two places. `booking-form.ts` holds the table; these are its labels, shared
   * wherever two types ask the same question.
   */
  'book.field.host': 'Hotel or host',
  'book.field.restaurant': 'Restaurant',
  'book.field.operator': 'Operator',
  'book.field.issuer': 'Issued by',
  'book.field.carrier': 'Carrier',
  'book.field.address': 'Address',
  'book.field.meetingPoint': 'Meeting point',
  'book.field.venue': 'Venue',
  'book.field.fromTo': 'From and to',
  'book.field.checkIn': 'Check in',
  'book.field.date': 'Date',
  'book.field.validOn': 'Valid on',
  'book.field.departs': 'Departs',
  'book.field.checkOut': 'Check out',
  'book.field.ends': 'Ends',
  'book.field.arrives': 'Arrives',
  /**
   * The placeholder examples. Brand names carry no translatable words and are
   * listed in the parity test's `PROPER_NOUNS`; everything built around them —
   * "Dinner at …", room counts, museum names — is translated normally.
   */
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Ghibli Museum',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Who is holding this for you',
  'book.example.accommodationTitle': 'Hotel Gracery Shinjuku · 2 twin rooms',
  'book.example.restaurantTitle': 'Dinner at Den',
  'book.example.activityTitle': 'teamLab Planets, 4 tickets',
  'book.example.tourTitle': 'Arashiyama bamboo grove walk',
  'book.example.ticketTitle': 'Ghibli Museum, 10:00 entry',
  'book.example.transportTitle': 'Nozomi 21 to Kyoto',
  'book.example.otherTitle': 'What you have booked',
  'book.hint.accommodation':
    'A hotel, a ryokan, an apartment — anywhere you sleep.',
  'book.hint.restaurant':
    'A booked table. The time is the part you will be held to.',
  'book.hint.activity': 'A class, a bath house, a booked experience.',
  'book.hint.tour': 'Somewhere to be, at a time, with a guide waiting.',
  'book.hint.ticket':
    'A timed entry, a museum pass, a match. Keep the code to hand.',
  /**
   * One line under the type picker. `{module}` is the Transports tab, named by
   * `shell.trip.tab.transports` so the module has one owner for its own name.
   */
  'book.hint.transport':
    'A booked seat. Full transports with carriers and codes belong in {module}.',
  'book.hint.other': 'Anything held in your name that does not fit the others.',

  /* -------------------------------------- lists: the dialogs */
  /**
   * The four kinds a list can be, plus the label for a stored kind this build
   * does not know. `list-utils.ts` holds the table; it maps to keys rather than
   * to English, so the label travels with the locale.
   */
  'lists.kind.packing': 'Packing',
  'lists.kind.todo': 'To-do',
  'lists.kind.shopping': 'Shopping',
  'lists.kind.documents': 'Documents',
  'lists.kind.fallback': 'List',
  'colour.none': 'No colour',
  'colour.pine': 'Pine',
  'colour.inkBlue': 'Ink blue',
  'colour.amber': 'Amber',
  'colour.green': 'Green',
  'colour.red': 'Red',
  'colour.slate': 'Slate',
  'lists.toast.created': 'List created',
  'lists.toast.createdBody': 'Add the first thing you must not forget.',
  'lists.toast.createFailed': 'The list was not created',
  'lists.toast.updated': 'List updated',
  'lists.toast.updateFailed': 'The list was not updated',
  'lists.error.weightLimit': 'A weight limit is a whole number of grams.',
  'lists.dialog.editTitle': 'Edit this list',
  'lists.dialog.editBody':
    'Rename it, change what kind of list it is, or hand it to one traveller.',
  'lists.dialog.addBody':
    'Packing, to-dos, shopping and the documents you must not forget — each one gets its own list.',
  /**
   * One key for the button and the dialog title: both say "New list", and they
   * are the same act named twice.
   */
  'lists.action.new': 'New list',
  'lists.field.namePlaceholder': 'Carry-on',
  'lists.field.kind': 'Kind',
  'lists.field.kindAria': 'Kind of list',
  'lists.field.owner': 'Belongs to',
  'lists.field.ownerHint': 'Shared lists are everyone’s to tick off.',
  'lists.field.everyone': 'Everyone on the trip',
  'lists.field.weightLimit': 'Weight limit',
  'lists.field.weightLimitHint':
    'Grams. Leave it empty if there is no allowance to keep to.',
  'colour.legend': 'Colour',
  'lists.action.saving': 'Saving the list',
  'lists.action.save': 'Save list',
  'lists.action.create': 'Create list',
  'lists.item.toast.added': 'Item added',
  'lists.item.toast.addFailed': 'The item was not added',
  'lists.item.toast.updated': 'Item updated',
  'lists.item.toast.updateFailed': 'The item was not updated',
  'lists.item.error.quantity': 'A quantity is a whole number from 1 to 999.',
  'lists.item.error.weight': 'A weight is a whole number of grams.',
  'lists.item.dialog.editTitle': 'Edit this item',
  'lists.item.dialog.addTitle': 'Add an item',
  'lists.item.field.label': 'Item',
  'lists.item.field.placeholder': 'Passport',
  'field.category': 'Category',
  'lists.item.field.categoryHint': 'Groups the list under a heading. Optional.',
  'lists.item.field.categoryPlaceholder': 'Documents',
  'lists.item.field.priority': 'Priority',
  /**
   * The picker spells a priority out; the badge on a ticked-off row only has
   * room for the word itself, and uses `lists.priority.high`.
   */
  'lists.priorityChoice.high': 'High — do not forget',
  'lists.priorityChoice.low': 'Low — if there is room',
  'lists.priorityChoice.normal': 'Normal',
  'lists.item.field.quantity': 'Quantity',
  'lists.item.field.weight': 'Weight',
  'lists.item.field.weightHint': 'Grams, per unit.',
  'lists.item.field.owner': 'Whose job is this',
  'lists.item.owner.nobody': 'Nobody in particular',
  'lists.item.action.saving': 'Saving the item',
  'lists.item.action.save': 'Save item',
  'lists.item.action.add': 'Add item',
  'lists.template.loadError': 'The templates could not be loaded right now.',
  'lists.template.toast.added': 'List added from a template',
  'lists.template.toast.addFailed': 'The template was not applied',
  'lists.template.error.apply': 'That did not apply',
  'lists.template.error.load': 'The templates did not load',
  'lists.template.empty.title': 'No templates yet',
  'lists.template.empty.body':
    'Save a list as a template once you have one you would build again, and it will show up here for every future trip.',
  'lists.template.applying': 'Applying the template',
  'lists.template.dialogTitle': 'Start from a template',
  'lists.template.loading': 'Loading templates',
  'lists.template.apply': 'Apply template',
  'lists.template.from': 'From a template',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Unassigned',
  'lists.toast.listRemoved': 'List removed',
  'lists.toast.listRemoveFailed': 'The list was not removed',
  'lists.toast.itemRemoved': 'Item removed',
  'lists.toast.itemRemoveFailed': 'The item was not removed',
  'lists.toast.reset': 'List reset',
  'lists.toast.resetBody':
    'Everything is unticked and ready for the next trip.',
  'lists.toast.resetFailed': 'The list was not reset',
  'lists.toast.tickFailed': 'That tick did not save',
  'lists.toast.tickFailedBody': 'The item has been put back the way it was.',
  'lists.toast.assignFailed': 'That assignment did not save',
  'lists.toast.orderFailed': 'The new order did not save',
  'lists.toast.orderFailedBody': 'The list has been put back the way it was.',
  'lists.filter.todo': 'Still to do',
  'lists.filter.done': 'Done',
  'lists.scope.all': 'All lists',
  'lists.scope.shared': 'Shared',
  'lists.scope.mine': 'Mine',
  'lists.empty.mine.title': 'No lists of your own yet',
  'lists.empty.shared.title': 'No shared lists yet',
  'lists.empty.mine.body':
    'A list of your own is only yours to tick off — useful for the things nobody else needs to see.',
  'lists.empty.shared.body':
    'A shared list is everyone’s to tick off, so two people never pack the same adaptor.',
  'lists.remove.list': 'Remove list',
  'lists.remove.item': 'Remove item',
  'lists.remove.itemBody': 'It comes off this list. Nothing else changes.',
  'lists.menu.editList': 'Edit list…',
  'lists.menu.tickAll': 'Tick everything',
  'lists.menu.untickAll': 'Untick everything',
  'lists.menu.reset': 'Reset for the next trip',
  'lists.menu.dragOrderLong': 'Switch to one order you can drag',
  'lists.menu.groupAgain': 'Group by category again',
  'lists.menu.dragOrder': 'Switch to one draggable order',
  'lists.menu.groupByCategory': 'Group by category',
  /**
   * Four whole sentences instead of one built from fragments. The board used to
   * concatenate `"{weight} packed"`, `" of a {limit} allowance"` and
   * `" — over the limit"`, which fixes English word order into every locale;
   * each combination is now its own message and a translator can move the
   * parts where the language wants them.
   */
  'lists.weight.packed': '{weight} packed',
  'lists.weight.packedOver': '{weight} packed — over the limit',
  'lists.weight.packedOf': '{weight} packed of a {limit} allowance',
  'lists.weight.packedOfOver':
    '{weight} packed of a {limit} allowance — over the limit',
  'lists.progress.ticked': '{done} of {total} ticked off',
  'lists.items.empty.title': 'This list is empty',
  'lists.items.empty.body':
    'Add the first thing you must not forget — the field below is the fastest way in.',
  'lists.items.doneEmpty.title': 'Nothing ticked off yet',
  'lists.items.doneEmpty.body': 'Tick something off and it will appear here.',
  'lists.items.todoEmpty.title': 'Everything here is done',
  'lists.items.todoEmpty.body':
    'Every item on this list is ticked. Switch to “{label}” to see them.',
  'lists.category.other': 'Everything else',
  'lists.dnd.fallbackName': 'the item',
  /**
   * The drag-and-drop screen reader announcements. `{name}` is the item, or
   * `lists.dnd.fallbackName` when the row is gone by the time it is read.
   */
  'lists.dnd.picked': 'Picked up {name}.',
  'lists.dnd.dropped': 'Dropped {name}. The new order is being saved.',
  'lists.dnd.cancelled': 'Cancelled. The order is unchanged.',
  'lists.menu.editItem': 'Edit item…',
  'lists.quickAdd.placeholder': 'Add an item and press Enter',
  'lists.quickAdd.aria': 'Add an item to this list',
  'lists.quickAdd.detailsHint': 'Add with a weight, a category or an owner',
  'lists.quickAdd.detailsAria': 'Add an item with all its details',
  'lists.show': 'Show',
  'lists.priority.high': 'High',
  'lists.action.add': 'Add',

  /* ------------------------------- lists: counted in items */
  /**
   * Was `` `${n} item${n === 1 ? '' : 's'}` ``, three times over. `{count}`
   * arrives already grouped for the locale.
   */
  'lists.template.itemCount': {
    one: '{count} item',
    other: '{count} items',
  },
  'lists.template.copiedIn': {
    one: '{count} item copied in, ready to tick off.',
    other: '{count} items copied in, ready to tick off.',
  },
  'lists.remove.listBody': {
    one: 'The list and its {count} item come off this trip. Templates you have saved are untouched.',
    other:
      'The list and its {count} items come off this trip. Templates you have saved are untouched.',
  },

  'lists.item.dialog.body':
    'Everything except the name is optional — a weight makes the pack total real, and a category groups the list.',
  'lists.template.dialogBody':
    'A template is a list you have saved before. Applying one copies it in as a new list on this trip — the original is left alone.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Remove “{name}”?',
  actionsFor: 'Actions for {name}',
  'lists.dnd.reorder': 'Reorder {name}',
  'lists.action.untickItem': 'Untick {name}',
  'lists.action.tickOffItem': 'Tick off {name}',
  'lists.item.assignAria': 'Assign {name} to someone',
  'lists.item.reassignAria': '{item} is {owner}’s — reassign it',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Give this booking a name you will recognise in a list.',
  'error.titleLong': 'Keep the name under 160 characters.',
  /**
   * Was `` `A ${shape.label.toLowerCase()} needs a ${FIELD_NAMES[field]}.` ``:
   * an English article, an English lowercasing and an English word order, all
   * three untranslatable. The booking type is dropped — the picker naming it
   * sits directly above this message — and what is missing is named instead.
   */
  'book.error.required': 'This booking needs a {field}.',
  'book.error.timeNeedsDate': 'A time needs the date it is on.',
  'book.error.endTimeNeedsDate': 'An end time needs the date it is on.',
  'book.error.endsBeforeStart': 'This ends before it starts.',
  'book.fieldName.checkInDay': 'check-in day',
  'book.fieldName.checkOutDay': 'check-out day',
  'book.stay.pickDay': 'Choose a day',
  'book.stay.nights': {
    one: '{count} night',
    other: '{count} nights',
  },
  'book.stay.range': '{from} to {to}',
  'book.stay.label': 'Stay',
  'book.remove.keepsNights':
    'The nights stay on the trip. Only the booking is removed.',
  'book.menu.removeWithStay': 'Remove booking and stay',
  'book.removeStay.body':
    'The booking and the nights it pays for are both removed.',
  'book.toast.stayRemoved': 'Booking and stay removed',
  'book.error.endTimeBeforeStart': 'The end time is before the start time.',
  'book.error.guests': 'Guests must be a whole number up to 1000.',
  'error.price': 'That is not an amount we can read.',
  'book.error.url': 'A link has to start with http:// or https://.',
  'book.error.confirmationLong':
    'That confirmation number is too long to store.',
  /**
   * A field name as it reads *inside* a sentence, which is not the same string
   * as the label above the input: English lowercases it, German does not.
   */
  'book.error.stopGone': 'That stop is not on this trip any more.',
  'book.ledger.unlinked':
    'This booking’s cost line will stay in the trip’s costs, no longer linked to this booking.',
  'book.ledger.updated': 'This booking’s cost line will be updated to {money}.',
  'book.ledger.needsDate':
    'Give this booking a date and its cost will be added to the trip’s costs.',
  'book.ledger.added': 'A {money} line will be added to this trip’s costs.',
  'book.fieldName.provider': 'provider',
  'book.fieldName.location': 'location',
  'book.fieldName.confirmationNumber': 'confirmation number',
  'book.fieldName.link': 'link',
  'book.fieldName.date': 'date',
  'book.fieldName.time': 'time',
  'book.fieldName.endDate': 'end date',
  'book.fieldName.endTime': 'end time',
  'book.fieldName.guests': 'guests',
  'book.fieldName.price': 'price',
  'book.fieldName.stop': 'stop',
  'book.field.stop': 'Linked stop',
  'book.field.stopHint': 'Which stop of the plan this booking is for.',
  'book.field.stopHintEmpty':
    'Add a place to a day first, then you can attach this booking to it',
  'book.field.stopPlaceholder': 'Not tied to a stop',
  'book.field.stopSearch': 'Search stops and days',
  'book.field.stopEmpty': 'No stop matches that',
  'book.ledger.refused.title': 'Saved, but not added to the costs',
  'book.ledger.refused.body':
    'The booking is on the trip. Adding its cost line to the trip’s costs did not go through — try that half again.',
  'book.action.ledgerRetry': 'Add it to the ledger',
  'book.copyConfirmation': 'the confirmation number for {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Flight',
  'transports.mode.train': 'Train',
  'transports.mode.bus': 'Bus',
  'transports.mode.ferry': 'Ferry',
  'transports.mode.car': 'Car',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Transit',
  'transports.mode.metro': 'Metro',
  'transports.mode.tram': 'Tram',
  'transports.mode.bike': 'Bike',
  'transports.mode.walk': 'Walk',
  'transports.mode.other': 'Other',
  'transports.mode.fallback': 'Transport',
  'transports.rank.earliest': 'Earliest arrival',
  'transports.rank.fewestChanges': 'Fewest changes',
  'transports.connection.findStop': 'Find a stop',
  'transports.connection.findStopSearch': 'LIS, Santa Apolónia, Lisboa…',
  'transports.connection.findStopEmpty':
    'No stop with that name in the catalogue.',
  'transports.connection.hideStops': 'Hide the stops',
  'transports.connection.seeStops': 'See the stops',
  'transports.connection.saving': 'Saving the connection',
  'transports.connection.use': 'Use this one',
  'transports.connection.onFoot': 'On foot',
  'transports.connection.service': 'Service',
  'transports.connection.direct': 'direct',
  'transports.connection.changes': {
    one: '{changes} change',
    other: '{changes} changes',
  },
  'transports.connection.tooLong':
    'This connection has more than {max} legs, which is more than one journey record holds. Search a shorter hop and record the rest separately.',
  'transports.connection.refusal.ceiling': 'No searches left this month',
  'transports.connection.refusal.unconfigured':
    'Connection search is off on this deployment',
  'transports.connection.refusal.provider':
    'The timetable service did not answer',
  'transports.connection.refusal.plan': 'Connection search is not on this plan',
  'transports.connection.refusal.planBody':
    'Upgrade the workspace to search timetables from inside a trip. A journey can still be recorded by hand.',
  'transports.connection.refusal.ceilingBody':
    'This month’s allowance of {ceiling} is spent, and renews on the first of next month. A journey can still be recorded by hand.',
  'transports.connection.refusal.unconfiguredBody':
    'No timetable service is set up here, so nothing was searched. Record the journey by hand instead.',
  'transports.connection.refusal.providerBody':
    'Nothing came back to show. Try again in a moment, or record the journey by hand.',
  'transports.connection.invitation':
    'Two stops and a date, and the timetable answers. Nothing is saved until you choose one.',
  'transports.connection.empty':
    'No connection was found between those two stops on that date. Try a neighbouring station, or widen the mode filter.',
  'transports.connection.credit': 'Timetable data from',
  'transports.connection.searchFailed': 'The search did not run',
  'transports.connection.searchFailedBody': 'Try again in a moment.',
  'transports.connection.saved': 'Connection saved',
  'transports.connection.replaced': 'Route replaced',
  'transports.connection.replacedBody':
    'The booking code and the seat are untouched.',
  'transports.connection.saveFailed': 'The connection was not saved',
  'transports.connection.saveError': 'That did not save',
  'transports.connection.fromHint':
    'Pick a stop — a timetable is asked where, not what it is called.',
  'transports.connection.toHint': 'Pick a stop from the catalogue.',
  'transports.connection.timeHint':
    'A timetable answers with the next few departures, so this decides which ones.',
  'transports.connection.onlyModes': 'Only these modes',
  'transports.connection.searching': 'Searching the timetable',
  'transports.connection.search': 'Search connections',
  'transports.connection.title': '{from} to {to}',
  'transports.status.idea': 'Idea',
  'transports.status.pending': 'Pending',
  'transports.status.confirmed': 'Confirmed',
  'transports.status.completed': 'Done',
  'transports.status.cancelled': 'Cancelled',
  'transports.end.fromAirport': 'From airport',
  'transports.end.toAirport': 'To airport',
  'transports.end.fromPort': 'From port',
  'transports.end.toPort': 'To port',
  'transports.end.fromStation': 'From station',
  'transports.end.toStation': 'To station',
  'transports.end.from': 'From',
  'transports.end.to': 'To',
  'transports.end.pickUp': 'Pick-up',
  'transports.end.dropOff': 'Drop-off',
  'transports.end.departureDay': 'Departure day',
  'transports.end.arrivalDay': 'Arrival day',
  'transports.end.pickUpDay': 'Pick-up day',
  'transports.end.returnDay': 'Return day',
  'transports.dayNumber': 'Day {n}',
  'transports.error.titleEmpty':
    'Give this transport a name you will recognise in a list.',
  'transports.error.date': 'A date is written YYYY-MM-DD.',
  'transports.error.time': 'A time is written HH:MM on a 24-hour clock.',
  'transports.error.departureNeedsDate':
    'A departure time needs the date it is on.',
  'transports.error.arrivalNeedsDate':
    'An arrival time needs the date it is on.',
  'transports.error.code': 'A code is 2 to 8 letters or digits.',
  'transports.error.distance':
    'A distance is a number of kilometres, up to 100,000.',
  'transports.error.arrivesBeforeDeparts':
    'This transport arrives before it departs.',
  'transports.error.timingHint':
    'Move one of them so the transport can actually be caught.',
  'transports.error.arrivalDayBeforeDeparture':
    'The arrival day comes before the departure day.',
  'transports.error.returnDayBeforePickUp':
    'The return day comes before the pick-up day.',
  'transports.field.noDay': 'No day yet',
  'transports.fill.legend': 'How to fill this in',
  'transports.fill.manual': 'Enter it yourself',
  'transports.fill.searchAgain': 'Search again',
  'transports.fill.search': 'Search connections',
  'transports.chain.unsplit': 'Put it back as one journey',
  'transports.field.arrivalDayHint':
    'A journey that lands the next morning says so here.',
  'transports.chain.splitHint':
    'Changing trains on the way? Record each part with its own service number, platform, seat and clock.',
  'transports.chain.split': 'Break this into legs',
  'transports.chain.stopNumber': 'stop {n}',
  'transports.chain.change': 'Change {n}',
  'transports.chain.removeStation': 'Remove {label}',
  'transports.chain.findStation': 'Find an airport or station',
  'transports.chain.findStationFor': 'Find an airport or station for {label}',
  'transports.chain.findPlaceholder': 'LHR, Heathrow, London…',
  'transports.chain.findEmpty': 'No match — type the stop in yourself below.',
  'transports.chain.stopLabel': 'Stop',
  'transports.chain.stopPlaceholder': 'Shin-Osaka',
  'transports.chain.timezoneHint': 'Which clock this stop is on',
  'transports.chain.timezoneAt': 'Time zone at {label}',
  'transports.chain.timezonePlaceholder': 'Not stated',
  'transports.chain.timezoneSearch': 'Tokyo, Lisbon, UTC…',
  'transports.chain.acrossClocks': '{gap} across two clocks',
  'transports.chain.addStopAfter': 'Add a stop after {label}',
  'transports.chain.servicePlaceholder': 'Hikari 500',
  'transports.chain.leaves': 'Leaves {label}',
  'transports.chain.reaches': 'Reaches {label}',
  'transports.chain.dayOfLeg': '{label} of leg {n}',
  'transports.chain.formError': 'This chain cannot be saved',
  'transports.chain.atCap':
    'A chain holds at most {max} legs — that is a limit on what one save can carry, not on how many changes a journey may have.',
  'transports.chain.hint':
    'Add a stop on any leg to record a change of train, and each leg keeps its own service number, platform and seat.',
  'transports.field.timezone': 'Time zone',
  'transports.field.platform': 'Platform',
  'transports.chain.legNumber': 'Leg {n}',
  'transports.chain.platform': 'Platform {value}',
  'transports.chain.seat': 'Seat {value}',
  'transports.chain.error.stopName':
    'Every stop needs a name — this is where you change.',
  'transports.chain.error.stopNameLong':
    'Keep a stop’s name under 200 characters.',
  'transports.chain.error.timezone': 'Pick a time zone from the list.',
  'transports.chain.error.tooManyLegs': 'A chain holds at most {max} legs.',
  'transports.bookingRefFor': 'the booking reference for {title}',
  /**
   * One whole sentence. The duration used to sit inside a bold span, which made
   * the copy an English head and an English tail either side of it — a locale
   * that puts the number elsewhere could not be served by that. The emphasis
   * moved to the whole line; the sentence became translatable.
   */
  'transports.doorToDoor': 'That is {gap} door to door.',
  'transports.title.fromTo': '{operator} from {from} to {to}',
  'transports.title.from': '{operator} from {from}',
  'transports.title.to': '{operator} to {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'No times to compare',
  'transports.junction.unknown.detail':
    'Add a date and time to both transports and this hand-over will be checked for you.',
  'transports.junction.impossible.headline':
    'Leaves {gap} before the previous transport lands',
  'transports.junction.impossible.detail':
    '“{to}” departs before “{from}” arrives, so this pair cannot both be caught. Move one of them.',
  'transports.junction.tight.headline': '{gap} to connect',
  'transports.junction.tight.detail':
    'A {mode} usually needs about {required}. This one is tight.',
  'transports.junction.tight.detailAt':
    'A {mode} usually needs about {required} at {place}. This one is tight.',
  'transports.junction.ok.headline': '{gap} in between',
  'transports.junction.ok.detail':
    'Lands at {landing} but the next transport leaves from {boarding} — you will need to get across.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Note shared',
  'collab.note.toast.sharedBody': 'Everyone on the trip can see it now.',
  'collab.note.toast.shareFailed': 'The note was not shared',
  'collab.note.toast.updated': 'Note updated',
  'collab.note.toast.updateFailed': 'The note was not updated',
  'collab.note.dialog.editTitle': 'Edit this note',
  'collab.note.dialog.addTitle': 'New shared note',
  'collab.note.dialog.body':
    'Restaurant recommendations, visa rules, the code for the front door — anything the whole trip needs to remember in one place.',
  'collab.note.field.title': 'Title',
  'collab.note.field.titlePlaceholder': 'Front door code',
  'collab.note.field.body': 'Note',
  'collab.note.field.bodyPlaceholder':
    '4821, then the hash key. The key box is to the left of the door.',
  'collab.note.field.categoryHint':
    'Groups the board under a filter. Optional.',
  'collab.note.field.categoryPlaceholder': 'Logistics',
  'collab.note.field.pin': 'Pin to the top of the board',
  'collab.note.field.pinHint':
    'Pinned notes come first, whatever else is added.',
  'collab.note.action.saving': 'Saving the note',
  'collab.note.action.save': 'Save note',
  'collab.note.action.share': 'Share note',
  'collab.poll.toast.opened': 'Poll opened',
  'collab.poll.toast.openedBody': 'Everyone on the trip can vote now.',
  'collab.poll.toast.openFailed': 'The poll was not opened',
  'collab.poll.dialog.addTitle': 'New poll',
  'collab.poll.field.question': 'Question',
  'collab.poll.field.questionPlaceholder':
    'Where are we eating on the last night?',
  'collab.poll.field.optionsLegend': 'Options',
  'collab.poll.field.option': 'Option {n}',
  /**
   * Two Tokyo restaurants and a spare row, as the placeholder for a poll about
   * where to eat. The two names are on the parity test's `PROPER_NOUNS`.
   */
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Another option',
  'collab.poll.action.addOption': 'Add an option',
  'collab.poll.action.removeOption': 'Remove option {n}',
  'collab.poll.field.multi': 'Let people pick more than one',
  'collab.poll.field.multiHint':
    'Off means one vote each, and changing your mind moves it.',
  'collab.poll.action.opening': 'Opening the poll',
  'collab.poll.action.open': 'Open poll',
  'collab.poll.error.tooFew':
    'A poll needs at least two things to choose between.',
  'collab.poll.error.duplicate':
    'Two options say the same thing. Give each one its own wording.',
  'collab.presence.viewingNow': 'viewing now',
  'collab.presence.unnamed': 'Unnamed member',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} tab open',
    other: '{name} — {count} tabs open',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Agree',
  'collab.reaction.love': 'Love it',
  'collab.reaction.funny': 'Funny',
  'collab.reaction.celebrate': 'Celebrate',
  'collab.reaction.thanks': 'Thank you',
  'collab.reaction.looking': 'Looking',
  /**
   * A reaction chip's accessible name. The `, including you` half used to be a
   * ternary appended to the string, which is a clause English can bolt on the
   * end and most languages cannot — so it is its own whole message.
   */
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, including you',
  'collab.thread.today': 'Today',
  'collab.thread.empty': 'No messages yet',
  'collab.toast.reactionFailed': 'That reaction did not save',
  'collab.toast.messageDeleted': 'Message deleted',
  'collab.toast.deleteFailed': 'The message was not deleted',
  'collab.toast.notSent': 'Not sent',
  'collab.toast.notSentBody':
    'The message could not be sent. Try again in a moment.',
  'collab.toast.messageUpdated': 'Message updated',
  'collab.toast.editFailed': 'The edit did not save',
  'collab.message.deleteTitle': 'Delete this message?',
  'collab.message.deleteBody':
    'The text is removed from the thread. Replies to it keep their place.',
  'collab.message.delete': 'Delete message',
  'collab.message.reply': 'Reply',
  'collab.message.menuEdit': 'Edit message…',
  'collab.message.react': 'React to this message',
  'collab.message.edited': 'edited',
  'collab.message.actionsFor': 'Actions for the message from {name}',
  'collab.compose.editingYours': 'Editing your message',
  'collab.compose.replyingTo': 'Replying to {name}',
  'collab.compose.cancelReply': 'Cancel reply',
  'collab.compose.cancelEdit': 'Cancel edit',
  'collab.compose.placeholder': 'Message the trip',
  'collab.compose.placeholderText': 'Say something to the group…',
  'collab.compose.editPlaceholder': 'Edit your message',
  'collab.compose.editPlaceholderText': 'Change what you said…',
  'collab.compose.send': 'Send message',
  'collab.compose.savingEdit': 'Saving the edit',
  'collab.compose.save': 'Save',
  /**
   * The three keyboard hints under the composer. The key caps themselves stay
   * literal in the markup: `Enter`, `Shift` and `Esc` are printed on the
   * hardware, not written in a language. Only the verbs are copy.
   */
  'collab.hint.sends': 'sends',
  'collab.hint.addsLine': 'adds a line',
  'collab.hint.cancels': 'cancels',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Note removed',
  'collab.toast.noteRemoveFailed': 'The note was not removed',
  'collab.notes.empty.title': 'No shared notes',
  'collab.notes.empty.body':
    'Restaurant recommendations, visa rules, the code for the front door — anything the whole trip needs to remember.',
  'collab.notes.empty.action': 'Write the first note',
  'collab.note.menu.edit': 'Edit note…',
  'collab.note.menu.unpin': 'Unpin',
  'collab.note.menu.pin': 'Pin to the top',
  'collab.note.remove': 'Remove note',
  'collab.note.removeBody':
    'The note comes off the board for everyone on the trip.',
  'collab.note.new': 'New note',
  'collab.poll.toast.voteFailed': 'Your vote did not save',
  'collab.poll.toast.voteFailedBody': 'The tally is unchanged.',
  'collab.poll.toast.closed': 'Poll closed',
  'collab.poll.toast.closeFailed': 'The poll was not closed',
  'collab.poll.toast.removed': 'Poll removed',
  'collab.poll.toast.removeFailed': 'The poll was not removed',
  'collab.polls.heading': 'Polls',
  'collab.polls.empty.title': 'No polls open',
  'collab.polls.empty.body':
    'When the group cannot agree on a restaurant, put it to a vote and let the answer settle itself.',
  'collab.polls.empty.action': 'Ask the group',
  'collab.poll.menu.close': 'Close the poll',
  'collab.poll.remove': 'Remove poll',
  'collab.poll.removeTitle': 'Remove this poll?',
  'collab.poll.actionsFor': 'Actions for the poll “{question}”',
  'collab.badge.pinned': 'Pinned',
  'collab.badge.closed': 'Closed',
  'collab.badge.open': 'Open',
  'collab.badge.multi': 'Pick several',
  'collab.badge.leading': 'Leading',
  'collab.poll.removeBody': {
    one: '“{question}” and its {count} vote are removed for everyone.',
    other: '“{question}” and its {count} votes are removed for everyone.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} of {count} vote',
    other: '{label} — {votes} of {count} votes',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} of {count} vote, including yours',
    other: '{label} — {votes} of {count} votes, including yours',
  },
  'collab.poll.voteCount': {
    one: '{count} vote',
    other: '{count} votes',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Document',
  'files.kind.photo': 'Photo',
  'files.kind.ticket': 'Ticket',
  'files.kind.receipt': 'Receipt',
  'files.kind.map': 'Map',
  'files.kind.other': 'Other',
  /**
   * Two of the six kinds read longer in the picker than on a row: a chip has
   * room for "Ticket", a menu can afford "Ticket or pass". The other four say
   * the same either way and reuse `files.kind.*`.
   */
  'files.kindChoice.ticket': 'Ticket or pass',
  'files.kindChoice.map': 'Map or route',
  'files.toast.removed': 'File removed',
  'files.toast.removeFailed': 'The file was not removed',
  'files.toast.downloadFailed': 'The download did not start',
  'files.toast.gone': 'The file is no longer available in this tab.',
  'files.toast.uploadFailed': 'The upload failed. Try again.',
  'files.toast.updated': 'File updated',
  'files.toast.updateFailed': 'The file was not updated',
  'files.storage.full': 'This workspace is out of storage',
  /**
   * Was three fragments either side of two `formatStorage` calls. One sentence,
   * so a locale can put the numbers where it wants them.
   */
  'files.storage.used':
    '{used} of {limit} is used. Remove a file below, or move the plan up a tier, before adding anything else.',
  'files.storage.perFile': 'up to {size} each',
  'files.action.add': 'Add files',
  'files.action.choose': 'Choose files',
  'files.action.upload': 'Upload files',
  'files.drop.active': 'Drop to upload',
  'files.drop.idle': 'Drag files here',
  'files.empty.title': 'No files on this trip',
  'files.empty.body':
    'Everything you would otherwise dig out of an inbox at a check-in desk belongs here, attached to the trip it is for.',
  'files.empty.hint':
    'Boarding passes, hotel confirmations, tickets, insurance documents and the receipts that back up your expenses.',
  'files.heading': 'Attachments',
  'files.tableCaption': 'Files attached to this trip',
  'files.menu.download': 'Download',
  'files.menu.rename': 'Rename and describe…',
  'files.menu.remove': 'Remove file',
  'files.remove.body':
    'The file is deleted from storage as well as from this trip, and {size} is freed. This cannot be undone.',
  'files.queue.clear': 'Clear finished',
  'files.column.file': 'File',
  'files.column.size': 'Size',
  'files.column.addedBy': 'Added by',
  'files.column.when': 'When',
  'files.status.uploaded': 'Uploaded',
  'files.status.failed': 'Failed',
  'files.status.cancelled': 'Cancelled',
  'files.status.uploading': 'Uploading',
  'files.status.waiting': 'Waiting',
  'files.error.nameEmpty': 'A file needs a name you can find it by.',
  'files.field.kindHint':
    'Decides which filter it sits under and which glyph it gets.',
  'files.field.kindAria': 'Kind of file',
  'files.field.description': 'Description',
  'files.field.descriptionPlaceholder':
    'Insurance policy — covers the whole party, claims line on page 2.',
  'files.dialog.title': 'File details',
  'files.action.saving': 'Saving the file',
  'files.action.save': 'Save details',
  'files.queue.someFailed': {
    one: '{count} file did not upload. The reason is on each row — nothing else in the batch was affected.',
    other:
      '{count} files did not upload. The reason is on each row — nothing else in the batch was affected.',
  },

  'files.action.cancelUploadOf': 'Cancel uploading {name}',
  'files.action.dismissOf': 'Dismiss {name}',
  'files.status.downloadingOf': 'Downloading {name}',
  'files.status.uploadingOf': 'Uploading {name}',
  'files.status.uploadingCount': {
    one: 'Uploading {count} file',
    other: 'Uploading {count} files',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - generated {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': '{title} is ready',
  'files.export.email.body': {
    one: 'Your trip export is ready. It is kept for {count} day.',
    other: 'Your trip export is ready. It is kept for {count} days.',
  },
  'files.export.email.action': 'Open {title}',
  'files.export.email.text': 'Your trip export is ready: {url}',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Upload cancelled.',
  'files.error.badAnswer':
    'The server sent an answer this browser could not read.',
  'files.error.connection':
    'The connection dropped while uploading. Check your network and try again.',
  'files.error.timeout': 'The upload timed out. Try again.',
  'files.error.refused': 'The server refused the upload ({status}).',
  'files.error.downloadShape':
    'The download did not come back in a form we could save.',
  'files.error.downloadFailed': 'The download failed ({status}).',
  'files.toast.uploadedOne': 'File uploaded',
  'files.toast.uploadedManyBody': '{size} added to this trip.',
  'files.toast.failedOne': 'That file did not upload',
  'files.toast.failedManyBody': 'The queue below says why for each one.',
  'files.error.tooMany': {
    one: 'Only {count} file can be added at once, so “{name}” was left out. Drop it in again on its own.',
    other:
      'Only {count} files can be added at once, so “{name}” was left out. Drop it in again on its own.',
  },
  'files.toast.uploadedMany': {
    one: '{count} file uploaded',
    other: '{count} files uploaded',
  },
  'files.toast.failedMany': {
    one: '{count} file did not upload',
    other: '{count} files did not upload',
  },
} as const satisfies NamespaceMessages

export default messages
