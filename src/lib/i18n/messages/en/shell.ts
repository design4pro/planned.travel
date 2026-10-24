/**
 * Everything the application shell says, in the source locale.
 *
 * `docs/SPEC.md` §8 fixes the shape: one flat object of keys, default-exported,
 * at `messages/<locale>/<namespace>.ts`. A screen reads a key as
 * `t('shell.<key>')`, and `../../types.ts` derives the key union from this file
 * — so a typo here is a compile error at the call site rather than English
 * leaking onto an Arabic screen (§8.2 bans the silent fallback outright).
 *
 * **What is here.** Every word the chrome puts on the screen — the top bar, the
 * pill nav, the mobile tab bar, the trip sub-nav, the user menu, the theme
 * switcher, the notification bell — plus the four screens the shell owns
 * outright: the dashboard, the inbox, the workspace admin console and the two
 * failure surfaces (error boundary and not-found). Nothing in
 * `src/components/layout/**` or in the shell's own route files may hold an
 * English literal, which is what `src/components/layout/__tests__/copy-rules.test.ts`
 * reads off the shipped sources.
 *
 * **Stored notification copy.** `src/server/repos/notifications.ts` deliberately
 * stores a notification as `titleKey` + `bodyKey` + a `params` record and never
 * as a rendered sentence, "so a notification written a year ago still renders in
 * the reader's current language". The `notification.<event>.title` / `.body`
 * pairs below are the catalogue those stored keys resolve against, through
 * `useStoredTranslate()`. A key here is therefore load-bearing at *run* time as
 * well as compile time: renaming one orphans every row already in D1, which is
 * why `notification.fallback.*` exists.
 *
 * **What a stored placeholder may hold.** A proper noun (a trip title, a
 * person's name, a workspace), a piece of the reader's own content (a chat
 * preview, a poll question), or a number the render path groups for the reader.
 * Never a date or a time the *writer* formatted: the row is read months later by
 * someone whose language the writer never knew, so `reservation.reminder` says
 * what to check rather than interpolating `19:00 on Monday 12 October`, which
 * would be English on all twenty-three screens for the life of the row.
 *
 * **What is deliberately not here.**
 *
 * - *Identifiers.* An audit action (`billing.plan_changed`), an entity id and a
 *   country flag are the same string in every language. They are rendered as
 *   data, in a monospace face, exactly so a reader knows they are not prose.
 * - *Plan names.* `Free`, `Solo` and `Crew` are words a reader sees, so they are
 *   catalogue keys — `settings.billing.plan.<id>.name`, authored by the billing
 *   screen that owns that namespace. The admin console reads those same keys
 *   rather than `src/lib/plans.ts`, which keeps the English an operator's record
 *   wants, and rather than declaring a second `shell.plan.*` copy of three words
 *   twenty-two translators would have to keep in step.
 * - *Unit symbols.* `MB`, `GB` and the rest are IEC symbols, not English, and
 *   they are composed in code beside an already-grouped number exactly the way
 *   `formatDistance` composes `km` in `src/lib/format.ts`. A `'{size} MB'` key
 *   would be byte-identical in twenty-two catalogues, which `parity.test.ts`
 *   reads as untranslated copy.
 * - *CLDR facts.* Dates, weekdays, relative times, grouped numbers and the
 *   interval dash come from `src/lib/format.ts`, frozen against the
 *   workerd/WebKit divergence §8.5 calls a defect.
 * - *Primitive copy.* "Loading", "Close", "+3" and the pagination words belong
 *   to `messages/en/ui.ts` and are read through `t('ui.…')` rather than
 *   duplicated here.
 *
 * **Numbers.** §8's rule on numbers inside messages: `count` picks the CLDR
 * plural branch and is never rendered. A number a reader sees arrives as its own
 * named placeholder — already grouped for the locale by `src/lib/format.ts` —
 * because a raw substitution prints `1234` with no separator in all twenty-three.
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* -------------------------------------------------------------- navigation */
  /** Accessible names for the two nav landmarks, neither of which has a heading. */
  'nav.primary': 'Primary sections',
  'nav.mobile': 'Sections',
  /** The wordmark is a link, and a wordmark has no text a screen reader can read. */
  'nav.dashboardLink': 'planned.travel dashboard',
  'nav.homeLink': 'planned.travel home',
  'nav.newTrip': 'New trip',

  /**
   * Two labels per surface: the pill nav has room for a phrase, the 360px tab
   * bar has room for one word. Both are translated, because a truncated
   * translation is the defect the short form exists to prevent.
   */
  'nav.trips': 'My trips',
  'nav.trips.short': 'Trips',
  'nav.vacay': 'Vacay',
  'nav.vacay.short': 'Vacay',
  'nav.atlas': 'Atlas',
  'nav.atlas.short': 'Atlas',
  'nav.journey': 'Journey',
  'nav.journey.short': 'Journey',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Trip sections',
  'trip.nav.back': 'Trips',
  'trip.nav.share': 'Share',
  'trip.nav.shareLabel': 'Share this trip',
  'trip.tab.plan': 'Plan',
  'trip.tab.transports': 'Transports',
  'trip.tab.book': 'Book',
  'trip.tab.lists': 'Lists',
  'trip.tab.costs': 'Costs',
  'trip.tab.files': 'Files',
  'trip.tab.collab': 'Collab',

  /* ------------------------------------------------------------ user menu */
  /** Starts with the visible name, so it stays contained in the accessible name (WCAG 2.5.3). */
  'account.menu': '{name}, account menu',
  'account.settings': 'Settings',
  'account.billing': 'Plan and billing',
  'account.admin': 'Admin',
  'account.signOut': 'Sign out',
  'account.signingOut': 'Signing out…',
  'account.signOutFailed': 'Could not sign you out',
  'account.signOutFailedBody': 'Check your connection and try again.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Workspace',
  'workspace.switched': 'Switched to {name}',
  'workspace.switchFailed': 'Could not switch workspace',
  'workspace.switchFailedBody': 'Check your connection and try again.',
  'workspace.switchUnconfirmedBody':
    'The active workspace could not be confirmed. Reload the page before continuing.',
  'workspace.switchRateLimitedBody':
    'Too many workspace switches. Wait a moment and try again.',
  'workspace.create': 'Create workspace',
  'workspace.createTitle': 'Create a workspace',
  'workspace.createDescription':
    'A separate space for its own trips, places and people. It starts on the Free plan and does not share the plan of the workspace you are in.',
  'workspace.createName': 'Workspace name',
  'workspace.createNameRequired': 'Enter a workspace name.',
  'workspace.createUpgrade':
    '“{workspace}” is on the Free plan, and only a workspace on a paid plan can create another. If another of your workspaces is on a paid plan, switch to it and create from there. Otherwise, upgrade “{workspace}”.',
  'workspace.createLimitReached':
    'You have reached the most workspaces one account can belong to.',
  'workspace.createRoleRequired':
    'Only a workspace admin can create a workspace. Ask an admin of this workspace, or switch to a workspace you administer.',
  'workspace.createFailed': 'Could not create the workspace',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Appearance',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'Match system',
  /** How the current choice is read out in the trigger's accessible name. */
  'theme.state.light': 'light',
  'theme.state.dark': 'dark',
  'theme.state.system': 'matching system',
  'theme.trigger': 'Theme: {state}. Change theme',
  'language.trigger': 'Language: {language}. Change language',
  'language.hint':
    'Remembered on this device. Once you sign in, the language set in your account applies; you can change it in Settings.',
  'language.announce': 'Language changed to {language}',
  'language.notApplied':
    'This browser did not keep your choice. Allow cookies for this site, then choose again.',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Notifications, none unread',
  'bell.unread': {
    one: 'Notifications, {unread} unread',
    other: 'Notifications, {unread} unread',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Inbox',
  'inbox.title': 'Notifications',
  'inbox.error': 'Your inbox did not load',
  'inbox.allRead': 'Everything is read',
  'inbox.unread': {
    one: '{unread} unread message',
    other: '{unread} unread messages',
  },
  'inbox.markAll': 'Mark all read',
  'inbox.markingAll': 'Marking everything read',
  'inbox.cleared': 'Inbox cleared',
  'inbox.markAllFailed': 'Could not mark everything read',
  'inbox.retryHint': 'Check your connection and try again.',
  'inbox.filter.all': 'Everything',
  'inbox.filter.unread': 'Unread',
  'inbox.waiting': {
    one: '{invitations} invitation waiting',
    other: '{invitations} invitations waiting',
  },
  'inbox.empty.title': 'Your inbox is empty',
  'inbox.empty.body':
    'Trip invitations, plan changes, booking reminders and settled balances all arrive here.',
  'inbox.empty.action': 'Back to the dashboard',
  'inbox.emptyUnread.title': 'Nothing unread',
  'inbox.emptyUnread.body':
    'You have read everything. Switch to Everything to look back through the history.',
  'inbox.emptyUnread.action': 'Show everything',
  'inbox.row.new': 'New',
  'inbox.row.accepted': 'Accepted',
  'inbox.row.declined': 'Declined',
  'inbox.row.open': 'Open',
  'inbox.row.markRead': 'Read',
  'inbox.row.markingRead': 'Marking read',
  'inbox.row.markReadFailed': 'Could not mark that read',
  'inbox.preferences':
    'Choose which of these reach your inbox, your email and your phone.',
  'inbox.preferencesAction': 'Notification settings',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'You were invited to {tripTitle}',
  'notification.trip.invited.body': '{actorName} added you to the trip.',
  'notification.trip.updated.title': '{tripTitle} was updated',
  'notification.trip.updated.body': '{actorName} changed the plan.',
  'notification.trip.member_added.title': '{memberName} joined {tripTitle}',
  'notification.trip.member_added.body':
    'They can see the itinerary, the bookings and the money.',
  'notification.trip.member_removed.title': '{memberName} left {tripTitle}',
  'notification.trip.member_removed.body':
    'Their access to the trip has ended.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} starts in {days} day',
    other: '{tripTitle} starts in {days} days',
  },
  'notification.trip.starting_soon.body':
    'Time to check the packing list and the bookings.',
  'notification.trip.copied.title': '{tripTitle} is ready',
  /**
   * Counts the days, and only the days. A message carries one plural count,
   * so a sentence that counted the places too — `'{days} days and {places}
   * places came across.'` — could never get both right: a one-day, one-place
   * copy read "1 days and 1 places", in all twenty-three.
   */
  'notification.trip.copied.body': {
    one: '{days} day came across',
    other: '{days} days came across',
  },
  /**
   * Fragments, not sentences of their own: the renderer hangs each off
   * `copied.body` behind a middle dot, in this order, skipping any whose count
   * is zero. They are separate messages because each counts something of its
   * own and `copied.body` has already spent the one count a message carries.
   */
  'notification.trip.copied.places': {
    one: '{places} place',
    other: '{places} places',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} note dropped',
    other: '{dropped} notes dropped',
  },
  'notification.trip.copyFailed.title': '{tripTitle} could not be copied',
  'notification.trip.copyFailed.body':
    'Nothing was left behind. Try again from the original.',
  'notification.reservation.reminder.title': '{title} is coming up',
  /**
   * No `{when}`. The reminder used to interpolate a date the *writer* had
   * already formatted, which put an English sentence fragment on all
   * twenty-three screens and stayed there for the life of the row. The time and
   * the confirmation code both live on the booking the row links to, so the
   * sentence points at them instead.
   */
  'notification.reservation.reminder.body':
    'Check the time and the confirmation code on the booking.',
  'notification.reservation.confirmed.title': '{title} is confirmed',
  'notification.reservation.confirmed.body':
    'The booking has been marked confirmed on {tripTitle}.',
  'notification.expense.added.title': '{actorName} added an expense',
  'notification.expense.added.body': '{title} on {tripTitle}.',
  'notification.expense.settled.title': '{actorName} settled up',
  'notification.expense.settled.body':
    'The balance on {tripTitle} has been paid.',
  'notification.list.assigned.title': '{actorName} assigned you an item',
  'notification.list.assigned.body': '{title} on {tripTitle}.',
  'notification.collab.message.title': '{actorName} wrote in {tripTitle}',
  'notification.collab.message.body': '{preview}',
  'notification.collab.poll.title': 'A poll is open on {tripTitle}',
  'notification.collab.poll.body': '{question}',
  'notification.organization.invited.title':
    'You were invited to {organizationName}',
  'notification.organization.invited.body':
    'Accept to join the workspace and everything shared in it.',
  'notification.journey.published.title': '{title} was published',
  'notification.journey.published.body':
    'Anyone with the link can now read the journey.',
  'notification.billing.plan_changed.title': 'Your plan changed',
  'notification.billing.plan_changed.body':
    '{organizationName} is now on the {plan} plan.',
  'notification.billing.invoice_paid.title': 'Payment received',
  'notification.billing.invoice_paid.body':
    'The latest invoice for {organizationName} has been paid.',
  'notification.billing.payment_failed.title': 'A payment did not go through',
  'notification.billing.payment_failed.body':
    '{organizationName} is past due. Update the payment method to keep the plan.',
  /**
   * A row whose key this catalogue does not carry — written against a template
   * that has since been renamed, or by a newer deployment. Never the key itself
   * and never an English sentence: §8.2's ban on the silent fallback applies to
   * a stored key exactly as it does to a compiled one.
   */
  'notification.fallback.title': 'Something changed in your workspace',
  'notification.fallback.body': 'Open the trip to see what it was.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'The dashboard did not load',
  'dashboard.blank.title': 'Your next trip starts here',
  'dashboard.blank.body':
    'Create a trip, drop the places you want to see on the map, and planned.travel will build the day-by-day plan around them.',
  'dashboard.blank.action': 'Plan a trip',
  'dashboard.blank.secondary': 'See your atlas',

  'dashboard.upNext': 'Up next',
  'dashboard.openPlan': 'Open the plan',
  'dashboard.hero.travellers': 'Travellers',
  'dashboard.hero.datesMissing': 'Add dates to build days',
  'dashboard.hero.startsIn': 'Starts in',
  'dashboard.hero.started': 'Started',
  'dashboard.hero.today': 'Today',
  'dashboard.hero.startUnknown': 'no start date',
  'dashboard.hero.startToday': 'good luck out there',
  /**
   * The unit under the countdown numeral, and a plural message because of it.
   *
   * The figure is the tile's oversized display numeral and the unit is the line
   * beneath it, so the two cannot share a sentence — but the unit still agrees
   * with the count in most of the twenty-three, and `ar` alone needs four
   * branches where English needs two. §8's rule holds: `count` selects the
   * branch and is never printed, because the reader is already looking at it.
   */
  'dashboard.hero.startPast': { one: 'day ago', other: 'days ago' },
  'dashboard.hero.startFuture': { one: 'day', other: 'days' },
  'dashboard.hero.nights': 'Nights',
  'dashboard.hero.companionsHint': 'on this trip',
  'dashboard.hero.progress': 'Under way',
  'dashboard.hero.places': 'Places',
  'dashboard.hero.placesNone': 'nothing mapped yet',
  'dashboard.hero.placesHint': 'on the map',

  'dashboard.stat.countries': 'Countries visited',
  'dashboard.stat.countriesUnit': 'of {total}',
  'dashboard.stat.countriesNone': 'Mark a country to start your atlas',
  'dashboard.stat.visits': {
    one: '{visits} visit recorded',
    other: '{visits} visits recorded',
  },
  'dashboard.stat.trips': 'Trips total',
  'dashboard.stat.tripsCaption': '{planning} planning · {booked} booked',
  'dashboard.stat.places': 'Places mapped',
  'dashboard.stat.placesNone': 'Nothing on the map yet',
  'dashboard.stat.placesAcross': {
    one: 'across {trips} trip',
    other: 'across {trips} trips',
  },
  'dashboard.stat.bookings': 'Bookings confirmed',
  'dashboard.stat.bookingsNone': 'No bookings coming up',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} booking on the way',
    other: '{bookings} bookings on the way',
  },

  'dashboard.trips.label': 'Your trips',
  'dashboard.trips.all': 'All trips',
  'dashboard.trips.empty.title': 'No trips yet',
  'dashboard.trips.empty.body':
    'Everything you plan will show up here, newest first.',
  'dashboard.trips.empty.action': 'Create a trip',

  'dashboard.bookings.label': 'Upcoming reservations',
  'dashboard.bookings.empty.title': 'Nothing booked yet',
  'dashboard.bookings.empty.body':
    'Confirmed stays, tables and tickets appear here as their dates approach.',

  'dashboard.pipeline.label': 'Trip pipeline',
  'dashboard.pipeline.empty':
    'Nothing in the pipeline. Your first trip will break this down by stage.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} favourite',
    other: '{favourites} favourites',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} archived trip',
    other: '{archived} archived trips',
  },

  'dashboard.storage.label': 'Storage',
  'dashboard.storage.count': '{used} of {limit}',
  'dashboard.storage.files': {
    one: '{files} file across every trip, including photos and tickets.',
    other: '{files} files across every trip, including photos and tickets.',
  },
  'dashboard.storage.more': 'Need more room?',
  'dashboard.storage.plans': 'See plans',

  'dashboard.widgets.label': 'Reference',
  'dashboard.widgets.choose': 'Choose widgets',
  'dashboard.widgets.description':
    'The widgets you keep beside your dashboard.',

  'dashboard.clock.label': 'World clock',
  'dashboard.clock.add': 'Add a time zone',
  'dashboard.clock.search': 'Search cities and regions',
  'dashboard.clock.noMatches': 'No time zone by that name',
  'dashboard.clock.remove': 'Remove {zone}',
  /* The offset is a figure beside a clock, so it says what it is a figure of. */
  'dashboard.clock.offset': '{offset} from your own time',
  'dashboard.clock.here': 'Your own time',
  'dashboard.clock.empty.title': 'No time zones pinned',
  'dashboard.clock.empty.body':
    'Pin a place and read its clock beside your own.',
  /* A zone identifier is a stored value that outlived the runtime that knew it,
     so the reader is told which one and offered the way out rather than shown a
     row that cannot draw. */
  'dashboard.clock.unknown.title': 'This device does not know {zone}',
  'dashboard.clock.unknown.body':
    'Its time cannot be read here. Remove the row to clear this.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'The admin console did not load',
  'admin.denied.title': 'Only workspace admins can open this',
  'admin.denied.body':
    'Ask an owner or an admin of this workspace to change your role if you need it.',
  'admin.denied.action': 'Back to the dashboard',
  'admin.eyebrow': 'Workspace admin',
  'admin.description': '{plan} plan · created {date}',
  'admin.createdUnknown': 'recently',
  'admin.workspaceSettings': 'Workspace settings',
  'admin.billing': 'Plan and billing',

  'admin.invitations.title': {
    one: '{invitations} invitation still outstanding',
    other: '{invitations} invitations still outstanding',
  },
  'admin.invitations.body':
    'Every outstanding invitation counts against the seats your plan pays for.',
  'admin.invitations.action': 'Review invitations',

  'admin.stat.members': 'Members',
  'admin.stat.membersCaption': {
    one: '{invitations} invitation pending',
    other: '{invitations} invitations pending',
  },
  'admin.stat.storage': 'Storage',
  'admin.stat.storageUnit': 'of {limit}',
  'admin.stat.storageUnlimited': 'no cap',
  'admin.stat.storageCaption': 'Files, photos and exports',
  'admin.stat.audit': 'Audit entries',
  'admin.stat.auditCaption': 'Most recent activity shown below',
  'admin.stat.plan': 'Plan',
  'admin.stat.planCaption': 'Quotas are enforced at the repository boundary',

  'admin.quotas.label': 'Quotas',
  'admin.quotas.count': { one: '{metrics} metric', other: '{metrics} metrics' },
  'admin.quotas.unlimited': 'Unlimited',
  'admin.quotas.value': '{used} / {limit}',

  'admin.members.label': 'Members',
  'admin.members.table': 'Members of this workspace',
  'admin.members.person': 'Person',
  'admin.members.role': 'Role',
  'admin.members.joined': 'Joined',
  'admin.members.role.label': 'Role of {name}',
  'admin.members.role.saved': '{name} is now {role}.',
  'admin.members.role.impersonated':
    'A role cannot be changed while you are acting as another account.',
  'admin.members.role.notPermitted':
    'You cannot make that change. Only an owner can grant the owner role or change an owner.',
  'admin.members.role.lastOwner':
    'This is the only owner of the workspace. Make someone else an owner first.',
  'admin.members.role.notFound':
    'This person is no longer in the workspace. The list has been refreshed.',
  'admin.members.role.failed': 'The role could not be changed. Try again.',
  'admin.members.role.promote.title': 'Make {name} an owner?',
  'admin.members.role.promote.body':
    '{name} will have the same power as you: billing, members and settings. An owner can demote or remove any other owner, including you.',
  'admin.members.role.promote.confirm': 'Make owner',
  'admin.members.role.promote.cancel': 'Cancel',

  'admin.activity.label': 'Recent activity',
  'admin.activity.empty.title': 'Nothing recorded yet',
  'admin.activity.empty.body':
    'Every write that matters is appended to the audit trail as it happens.',
  'admin.activity.workspace': 'the workspace itself',
  'admin.actions.label': 'Busiest actions',
  'admin.actions.count': {
    one: '{actions} action',
    other: '{actions} actions',
  },

  /* ---------------------------------------------------------- domain words */
  /**
   * Closed enumerations from `src/server/db/schema.ts`, translated here because
   * a status badge is prose to a reader even though it is a token in the column.
   */
  'tripStatus.draft': 'Draft',
  'tripStatus.planning': 'Planning',
  'tripStatus.booked': 'Booked',
  /**
   * `Active` rather than the warmer `Travelling`, deliberately: the trip cards
   * on the same dashboard render this status through
   * `src/routes/_app/-ui/trip-card.tsx`, which is another item's file and still
   * humanises the token. One screen must not call one status two things.
   */
  'tripStatus.active': 'Active',
  'tripStatus.completed': 'Completed',
  'tripStatus.archived': 'Archived',

  'bookingStatus.none': 'Not booked',
  'bookingStatus.pending': 'Pending',
  'bookingStatus.confirmed': 'Confirmed',
  'bookingStatus.cancelled': 'Cancelled',
  'bookingStatus.completed': 'Done',

  'bookingType.accommodation': 'Stay',
  'bookingType.restaurant': 'Table',
  'bookingType.activity': 'Activity',
  'bookingType.tour': 'Tour',
  'bookingType.ticket': 'Ticket',
  'bookingType.transport': 'Transport',
  'bookingType.other': 'Booking',

  'role.owner': 'Owner',
  'role.admin': 'Admin',
  'role.member': 'Member',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} trip',
    other: '{value} trips',
  },
  'trips.count.favourites': {
    one: '{value} favourite',
    other: '{value} favourites',
  },
  'trips.count.archived': {
    one: '{value} archived',
    other: '{value} archived',
  },
  'trips.atLimit.body':
    'Your plan covers {trips}. Archive one you have finished, or move up a plan to keep more open at once.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'New journey',
  'newJourney.title': 'Start a journey',
  'newJourney.description':
    'A journey is the written side of a trip — entries in date order, with the photos and the weather you remember it by.',
  'newJourney.titlePlaceholder': 'Two weeks in Kyoto',
  'newJourney.subtitle': 'Subtitle',
  'newJourney.subtitleHint': 'One line under the title, on the cover.',
  'newJourney.subtitlePlaceholder': 'Temples, trains and far too much matcha',
  'newJourney.trip': 'Based on a trip',
  'newJourney.tripHint': 'Optional — links the story back to its plan.',
  'newJourney.tripNone': 'Not tied to a trip',
  'newJourney.datesError': 'The end date is before the start.',
  'newJourney.submit': 'Create journey',
  'newJourney.creating': 'Creating the journey',
  'newJourney.created': 'Journey started',
  'newJourney.createdBody': 'Add your first entry to begin the story.',
  'newJourney.error':
    'The journey could not be created. Try again in a moment.',
  'newCollection.trigger': 'New collection',
  'newCollection.title': 'Start a collection',
  'newCollection.description':
    'Somewhere to keep the places you find before you know which trip they belong to.',
  'newCollection.namePlaceholder': 'Coffee worth crossing town for',
  'newCollection.descriptionHint': 'What belongs in here, and what does not.',
  'newCollection.submit': 'Create collection',
  'newCollection.creating': 'Creating the collection',
  'newCollection.created': 'Collection created',
  'newCollection.createdBody': 'Start saving places into it.',
  'newCollection.error':
    'The collection could not be created. Try again in a moment.',

  'newTrip.title': 'Start a new trip',
  'newTrip.description':
    'A title is all you need. Dates build the day-by-day plan, and everything else can wait until you know it.',
  'newTrip.name': 'Trip name',
  'newTrip.namePlaceholder': 'Kyoto in cherry-blossom season',
  'newTrip.destination': 'Destination',
  'newTrip.destinationHint': 'A city, a region, or the whole route.',
  'newTrip.destinationPlaceholder': 'Kyoto, Japan',
  'newTrip.departure': 'Departure',
  'newTrip.return': 'Return',
  'newTrip.returnError': 'The return date is before departure.',
  'newTrip.currency': 'Budget currency',
  'newTrip.currencyHint': 'Every expense on this trip is totalled in it.',
  'newTrip.currencySearch': 'Search by code or name',
  'newTrip.currencyEmpty': 'No currency matches that.',
  'newTrip.currencyFavourites': 'Favourites',
  'newTrip.currencyAll': 'All currencies',
  'newTrip.summary': 'Summary',
  'newTrip.summaryPlaceholder': 'Two weeks of temples, trains and ramen.',
  'newTrip.duration': 'Duration in days',
  'newTrip.durationHint':
    'Without dates, the trip starts with this many undated days.',
  'newTrip.durationDerived': 'Worked out from the two dates.',
  'newTrip.reminder': 'Reminder before departure',
  'newTrip.reminderNone': 'None',
  'newTrip.reminderBefore': {
    one: '{count} day before',
    other: '{count} days before',
  },
  'newTrip.reminderCustom': 'Custom',
  'newTrip.reminderCustomDays': 'Days before departure',
  'newTrip.reminderOn': 'Reminder on {date}',
  'newTrip.reminderNoDeparture': 'Pick a departure date to see the day.',
  'newTrip.submit': 'Create trip',
  'newTrip.creating': 'Creating the trip',
  'newTrip.error': 'The trip could not be created. Try again in a moment.',
  'newTrip.created': 'Trip created',
  'newTrip.createdBody': 'Start dropping places on the map.',
  'newTrip.coverChoose': 'Add a cover image',
  'newTrip.coverChange': 'Change the cover image',
  'newTrip.coverHint':
    'Drop an image here, paste one, or choose a file. PNG, JPEG, WebP, AVIF or GIF.',
  'newTrip.coverChosen': 'Cover image: {name}',
  'newTrip.coverRemove': 'Remove the cover image',
  'newTrip.coverTypeError':
    '“{name}” cannot be a cover image. Choose a PNG, JPEG, WebP, AVIF or GIF.',
  'newTrip.coverSizeError':
    '“{name}” is larger than {max}. Choose a smaller image.',
  'newTrip.coverUploading': 'Uploading the cover image',
  'newTrip.coverFailedTitle': 'The cover image was not added',
  'newTrip.coverFailed':
    'The trip was created, but “{name}” could not be uploaded as its cover.',
  'newTrip.coverRetry': 'Try again',
  'newTrip.coverContinue': 'Open the trip without a cover',
  'newTrip.people': 'People',
  'newTrip.peopleHint':
    'Added as soon as the trip is created. You stay its owner.',
  'newTrip.peoplePlaceholder': 'Choose from your workspace',
  'newTrip.peopleSearch': 'Search by name',
  'newTrip.peopleLoading': 'Loading the people in your workspace',
  'newTrip.peopleLoadError':
    'The people in your workspace could not be loaded. Create the trip and add them from its People screen.',
  'newTrip.peopleNone': 'You are the only person in this workspace so far.',
  'newTrip.peopleNoneMember':
    'A workspace owner or admin can invite more people.',
  'newTrip.peopleInvite': 'Invite people to the workspace',
  'newTrip.peopleChosen': 'Chosen people and their roles',
  'newTrip.peopleFailedTitle':
    'The trip was created, but not everyone was added',
  'newTrip.noticeBothTitle':
    'The trip was created, but not everything was added',
  'newTrip.peopleNotInWorkspace':
    '{name} is no longer in this workspace, so was not added.',
  'newTrip.peopleAlreadyOn': '{name} was already on this trip.',
  'newTrip.peopleUnconfirmed':
    '{name} could not be confirmed. Check People to see whether they were added.',
  'newTrip.peopleContinue': 'Continue',
  'newTrip.peopleRetry': 'Try again',
  'newTrip.coverRetryOnly': 'Try the cover again',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Actions for {title}',
  'tripActions.copy': 'Copy',
  'tripActions.favourite': 'Favourite',
  'tripActions.unfavourite': 'Unfavourite',
  'tripActions.edit': 'Edit',
  'tripActions.archive': 'Archive',
  'tripActions.restore': 'Restore',
  'tripActions.delete': 'Delete',
  'tripActions.deleteForGood': 'Delete permanently',
  'tripActions.starFailed': 'That star did not save',
  'tripActions.starFallback': 'The trip has been put back the way it was.',
  'tripActions.archived': 'Trip archived',
  'tripActions.archiveFailed': 'The trip could not be archived',
  'tripActions.restored': 'Trip restored',
  'tripActions.restoreFailed': 'The trip could not be restored',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Edit trip',
  'editTrip.submit': 'Save changes',
  'editTrip.saving': 'Saving the trip',
  'editTrip.cancel': 'Cancel',
  'editTrip.saved': 'Trip updated',
  'editTrip.errorTitle': 'That did not save',
  'editTrip.retry': 'Try again',
  'editTrip.error': 'The trip could not be saved. Try again in a moment.',
  'editTrip.coverFailed':
    '“{name}” could not be uploaded as the cover. Nothing else has been saved yet.',
  'editTrip.coverContinue': 'Save without the new cover',
  'editTrip.currencyLocked':
    'This trip already has prices in it, so its budget currency can’t be changed here. Use Change budget currency on the Costs tab, or set it back to {current} to save your other changes.',
  'editTrip.currencyReadonly':
    'The budget currency is changed from the Costs tab.',
  'editTrip.currencyLink': 'Open the Costs tab',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Delete “{title}” for good?',
  'deleteTrip.description':
    'There is no undo and no bin. Archiving keeps a trip out of the list without losing it.',
  'deleteTrip.reading': 'Reading what this trip holds',
  'deleteTrip.errorTitle': 'That did not load',
  'deleteTrip.summaryError': 'What this trip holds could not be read.',
  'deleteTrip.confirmLabel': 'Type the trip’s name to confirm',
  'deleteTrip.deleting': 'Deleting the trip',
  'deleteTrip.deleted': 'Trip deleted',
  'deleteTrip.failed': 'The trip could not be deleted',
  'deleteTrip.carried.reservations': {
    one: 'booking',
    other: 'bookings',
  },
  'deleteTrip.carried.transports': {
    one: 'transport',
    other: 'transports',
  },
  'deleteTrip.carried.expenses': {
    one: 'expense',
    other: 'expenses',
  },
  'deleteTrip.carried.files': {
    one: 'file',
    other: 'files',
  },
  'deleteTrip.carried.members': {
    one: 'person',
    other: 'people',
  },
  /* ------------------------------- the copy-a-trip dialog */
  'copyTrip.title': 'Copy “{title}”',
  'copyTrip.nameLabel': 'Name the copy',
  'copyTrip.titleRequired': 'Give the copy a name.',
  'copyTrip.datesLabel': 'Dates',
  'copyTrip.datesTogether': 'Set both dates, or clear them both.',
  'copyTrip.clearDates': 'Copy without dates',
  'copyTrip.carries':
    'Days, places and notes come across. Bookings, money, files and people do not.',
  'copyTrip.shorter':
    'That is shorter than the original. The extra days’ places move to ideas, and their notes are dropped.',
  'copyTrip.submit': 'Copy trip',
  'copyTrip.copying': 'Copying the trip',
  'copyTrip.cancel': 'Cancel',
  'copyTrip.started': 'Copying “{title}”',
  'copyTrip.errorTitle': 'That did not copy',
  'copyTrip.error': 'The trip could not be copied. Try again in a moment.',

  'trips.error': 'Your trips did not load',
  'trips.eyebrow': 'Workspace',
  'trips.nothingPlanned': 'Nothing planned yet',
  'trips.search': 'Search trips',
  'trips.atLimit.title': 'You have filled every trip your plan allows',
  'trips.atLimit.action': 'Compare plans',
  'trips.noMatch.title': 'Nothing matches that filter',
  'trips.noMatch.body':
    'Try a different stage, clear the search, or look in the archive.',
  'trips.noMatch.action': 'Reset filters',
  'trips.empty.body':
    'A trip holds your itinerary, your map, your bookings, your packing lists and the money. Start one and the rest follows.',
  'trips.next.title': 'Somewhere next',
  'trips.next.body':
    'Start a trip and planned.travel builds a day per date, ready for what you have saved.',
  'trips.savedPlaces': 'Saved places',
  'trips.filter.all': 'All',
  'trips.filter.favourites': 'Favourites',
  'trips.view.label': 'Layout',
  'trips.view.grid': 'Grid',
  'trips.view.list': 'List',
  'trips.card.favourite': 'Favourite',
  'trips.card.noDestination': 'Destination not set yet',
  'trips.card.noDates': 'Dates to be set',
  'trips.card.startsIn': 'in {days}d',
  'trips.card.days': '{days}d',
  'trips.card.copying': 'Copying',
  'trips.card.copyingLabel': '{title} is still being copied',
  'trips.card.copyingReason': 'Wait for the copy to finish.',
  'metric.trips': 'Trips',
  'metric.places': 'Places',
  'metric.members': 'Members',
  'metric.files': 'Files',
  'metric.storage_bytes': 'Storage',
  'metric.collections': 'Collections',
  'metric.journeys': 'Journeys',

  /* -------------------------------------------------------------- failures */
  'error.title': 'This did not load',
  'error.body':
    'Nothing was lost. Try again, and if it keeps happening the detail below is what to send us.',
  'error.retry': 'Try again',
  'error.dashboard': 'Back to dashboard',
  'error.reported': 'We have been notified and are looking into it.',
  'error.reference': 'Reference',
  'error.feedback.open': 'Tell us what happened',
  'error.feedback.label': 'What were you doing when this happened?',
  'error.feedback.send': 'Send',
  'error.feedback.sent': 'Thank you — that helps.',
  'error.feedback.failed':
    'That did not send. The reference above still reaches us.',
  'error.root': 'Something went off route',
  /**
   * The heading over a *named* shell state rather than over a thrown
   * diagnostic. The two `session.*` sentences below are authored copy, so the
   * boundary prints them as prose and drops the monospace detail chip — a
   * translated sentence set in the diagnostic face, under "Something went off
   * route", reads as a stack frame the reader is being asked to forward.
   */
  'error.session': 'Your workspace access has changed',

  /* ------------------------------------------------- reporting a problem */
  /**
   * The Sentry User Feedback widget, which is Sentry's own markup inside a
   * shadow DOM and reads every one of these once, when the widget is built.
   * `src/components/layout/feedback-widget.tsx` passes them and rebuilds the
   * widget when the locale changes; the names match the SDK's options one for
   * one so the two lists can be read side by side.
   *
   * Distinct from `error.feedback.*` above, which is the textarea on the error
   * panel: that one is offered after something threw and is tied to the event
   * it threw. This one is offered before anything throws, for everything that
   * is wrong without being an error.
   */
  'feedback.triggerLabel': 'Report a problem',
  'feedback.formTitle': 'Report a problem',
  'feedback.messageLabel': 'What is wrong, or what should change?',
  'feedback.messagePlaceholder':
    'What did you expect, and what happened instead?',
  'feedback.emailLabel': 'Email address',
  'feedback.emailPlaceholder': 'you@example.com',
  'feedback.isRequiredLabel': '(required)',
  'feedback.submitButtonLabel': 'Send report',
  'feedback.cancelButtonLabel': 'Cancel',
  'feedback.confirmButtonLabel': 'Confirm',
  /* The screenshot is a screen capture the browser asks about first, then an
     editor with three rectangles: crop, Highlight, Hide. */
  'feedback.addScreenshotButtonLabel': 'Add a screenshot',
  'feedback.removeScreenshotButtonLabel': 'Remove screenshot',
  'feedback.highlightToolText': 'Highlight',
  'feedback.hideToolText': 'Hide',
  'feedback.successMessageText': 'Thank you — we have your report.',
  'feedback.errorEmptyMessageText':
    'Write a sentence first — an empty report tells us nothing.',
  'feedback.errorTimeoutText':
    'That is taking too long, and we cannot confirm the report was sent.',
  'feedback.errorForbiddenText': 'This page is not allowed to send reports.',
  'feedback.errorGenericText':
    'That did not send. Check the connection, and whether an ad blocker is in the way.',

  'notFound.eyebrow': 'Error 404',
  'notFound.title': 'This page is not on the map',
  'notFound.body':
    'The link may be out of date, or the trip it pointed at was moved or deleted.',
  'notFound.trips': 'All trips',
  'notFound.rootBody':
    'We looked everywhere along the route. The address may be mistyped, or the page has since moved on.',
  'notFound.home': 'Back to home',
  'notFound.plans': 'See the plans',

  /**
   * Two states the shell cannot render around: a session with no workspace, and
   * a membership revoked while the tab was open.
   *
   * `src/routes/_app/-server/shell.ts` throws the *key*, and the boundary
   * resolves it — so the sentence is rendered in the locale the document was
   * negotiated into rather than in whatever `Accept-Language` the failing
   * request happened to carry, and the server side of the shell needs no
   * catalogue of its own. `SHELL_STATE_KEYS` in
   * `src/components/layout/session.ts` is the contract between the two halves.
   */
  'session.noWorkspace':
    'Your account is not attached to a workspace yet. Sign out and back in to finish setting it up.',
  'session.membershipRemoved':
    'Your membership of this workspace has been removed.',
  /**
   * A call from a tab whose workspace is no longer the session's. `workspaceChanged` is the key
   * the server throws (`WORKSPACE_CHANGED_KEY` in `src/lib/workspace-claim.ts`) and the error panel
   * prints; the rest belong to the notice a stale tab opens (`workspace-changed-notice.tsx`).
   * `{name}` is the workspace the tab is showing.
   */
  'session.workspaceChanged':
    'The workspace was changed in another tab or window. Nothing was saved.',
  'session.workspaceChangedTitle': 'The workspace changed in another tab',
  'session.workspaceChangedBody':
    'This tab is showing {name}, but the workspace was changed in another tab or window. Nothing was saved.',
  'session.openCurrentWorkspace': 'Open the current workspace',
  'session.workspaceChangedDismiss': 'Not now',
} as const satisfies NamespaceMessages

export default messages
