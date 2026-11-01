/**
 * Everything the settings module says, in the source locale.
 *
 * `docs/SPEC.md` §8 fixes the shape: one flat object of keys, default-exported,
 * at `messages/<locale>/<namespace>.ts`. A screen reads a key as
 * `t('settings.<key>')`, and `../../types.ts` derives the key union from this
 * file — so a typo here is a compile error at the call site rather than English
 * leaking onto a Polish screen (§8.2 bans the silent fallback outright).
 *
 * **What is here.** Every word the seven settings routes and the settings
 * section index put on the screen: headings, hints, option labels, badge text,
 * toast copy and the accessible names that only a screen reader hears. Nothing
 * in `src/routes/_app/settings/**` may hold an English literal, which is what
 * `__tests__/copy-rules.test.ts` reads off the shipped sources.
 *
 * **What is deliberately not here.**
 *
 * - *Identifiers.* An ISO currency code (`EUR`), an IANA zone's own city
 *   segment (`Europe/London` → `London`) and a BCP-47 tag are the same string in
 *   every language, and a key whose translation is byte-identical to English is
 *   what `__tests__/parity.test.ts` calls untranslated copy. They are derived in
 *   the route instead.
 * - *CLDR facts.* Month and weekday names come from `src/lib/format-tables.ts`,
 *   frozen against the workerd/WebKit divergence §8.5 calls a defect. The keys
 *   below never name a month, a weekday or a language.
 * - *A locale's own name.* §8 requires a language to be named in its own
 *   language and script, so all twenty-three come from the frozen registry in
 *   `src/lib/i18n/locales.ts` and none is ever spelled in English. That rule is
 *   why the two `LOCALES` lists this file replaced — eight and five
 *   region-tagged values labelled `English (United Kingdom)` — are gone rather
 *   than translated.
 * - *Plan prices and limits.* An amount, a seat ceiling and a storage quota are
 *   facts about the product and stay in `src/lib/plans.ts`; the billing screen
 *   reads them as data and formats them for the locale. The *words* — a plan's
 *   name, its tagline, its feature bullets — are `billing.plan.<id>.*` below,
 *   because English inside an Arabic shell is exactly what §8.6 forbids. The
 *   marketing pages and the Polar product description keep reading the English
 *   in `plans.ts`, where an operator's record is what is wanted.
 *
 * **Numbers.** §8's rule on numbers inside messages: `count` picks the CLDR
 * plural branch and is never rendered. A number a reader sees arrives as
 * `{value}` — already grouped for the locale by `src/lib/format.ts` — because a
 * raw substitution prints `1234` with no separator in all twenty-three.
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  'workspace.invite.invite': 'Invite',
  'workspace.invite.resend': 'Resend',
  'workspace.invite.revoke': 'Revoke',
  'workspace.invite.confirm': 'Revoke invitation',
  'workspace.invite.expired': 'Expired',
  'workspace.invite.by': 'Invited by {name}',
  'workspace.invite.sent': 'Invitation sent',
  'workspace.invite.revoked': 'Invitation revoked',
  'workspace.invite.delivery':
    'Invitation saved, but email delivery failed. Use Resend to try again.',
  'workspace.invite.duplicate':
    'A pending invitation already exists. Use Resend.',
  'workspace.invite.existing': 'This person is already a workspace member.',
  'workspace.invite.failed':
    'Invitation unavailable. Refresh the list and try again.',
  'workspace.invite.reload': 'Refresh invitations',

  /* ------------------------------------------------------------------ shell */
  /** The settings shell's page header, above the section index. */
  'page.eyebrow': 'Account',
  'page.title': 'Settings',
  'page.description':
    'Everything about you, your workspace and how planned.travel behaves',
  /** The shell's own error boundary — a section that failed to even mount. */
  'page.error': 'Settings did not load',

  /** Accessible name for the section index, which has no visible heading. */
  'nav.label': 'Settings sections',
  'nav.profile': 'Profile',
  'nav.profile.hint': 'You, and how dates and money read',
  'nav.language': 'Language',
  'nav.language.hint': 'The language every screen speaks',
  'nav.appearance': 'Appearance',
  'nav.appearance.hint': 'Theme, motion and the map',
  'nav.security': 'Security',
  'nav.security.hint': 'Password, two-factor, passkeys',
  'nav.notifications': 'Notifications',
  'nav.notifications.hint': 'Inbox, email and push',
  'nav.workspace': 'Workspace',
  'nav.workspace.hint': 'Members and shared defaults',
  'nav.billing': 'Billing',
  'nav.billing.hint': 'Plan, seats and invoices',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Save changes',
  /** The second line of every "that did not save" toast in this module. */
  'error.retryBody': 'Nothing was lost. Check your connection and try again.',
  /**
   * The three membership roles, named. `member` also stands in for an
   * invitation that carries no role, which is what the server stores when the
   * inviter took the default.
   */
  'role.owner': 'Owner',
  'role.admin': 'Admin',
  'role.member': 'Member',

  /* -------------------------------------------------- regional option labels */
  /**
   * The follow-the-workspace option of every personal override. `{value}` is
   * the workspace's own setting, already rendered.
   */
  'regional.workspaceDefault': 'Workspace default — {value}',
  /** Currency names. The ISO code beside them is derived, not translated. */
  'regional.currency.AUD': 'Australian dollar',
  'regional.currency.CAD': 'Canadian dollar',
  'regional.currency.CHF': 'Swiss franc',
  'regional.currency.EUR': 'Euro',
  'regional.currency.GBP': 'Pound sterling',
  'regional.currency.JPY': 'Japanese yen',
  'regional.currency.PLN': 'Polish złoty',
  'regional.currency.SEK': 'Swedish krona',
  'regional.currency.USD': 'US dollar',
  'regional.distance.metric': 'Kilometres',
  'regional.distance.imperial': 'Miles',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Your profile did not load',
  'profile.account.title': 'Your account',
  'profile.account.description':
    'Your name and email come from the account you sign in with.',
  'profile.email.verified': 'Email verified',
  'profile.email.unverified': 'Email not verified',
  'profile.twoFactor.on': 'Two-factor on',
  'profile.figure.workspace': 'Workspace',
  'profile.figure.role': 'Role',
  'profile.figure.joined': 'Member since',
  /** A membership row with no joined date — an account seeded before the column. */
  'profile.figure.joinedUnknown': 'Not recorded',
  'profile.regional.title': 'Dates, money and units',
  'profile.regional.description':
    'These override the workspace defaults for you alone. Leave one on the default and it follows the workspace.',
  'profile.regional.saving': 'Saving your preferences',
  'profile.regional.saved': 'Your preferences are saved',
  'profile.regional.saveFailed': 'Your preferences were not saved',
  /**
   * The language row is a signpost, not a control: the picker has its own
   * screen because a twenty-four-option wrapped grid cannot live in a settings
   * row's fixed control column.
   */
  'profile.language.label': 'Language',
  'profile.language.hint':
    'Chosen on its own screen, where every language is written in its own script.',
  'profile.language.action': 'Change',
  'profile.timezone.label': 'Time zone',
  'profile.timezone.hint':
    'Departure and arrival times are shown against this.',
  'profile.currency.label': 'Currency',
  'profile.currency.hint':
    'New trips start in this currency; each trip can override it.',
  'profile.dateFormat.label': 'Date format',
  'profile.weekStart.label': 'Week starts on',
  'profile.weekStart.hint':
    'Applies to every calendar, including the vacay year grid.',
  'profile.distance.label': 'Distance',

  /* --------------------------------------------------------------- language */
  'language.error': 'Your language settings did not load',
  'language.section.title': 'Language',
  'language.section.description':
    'Every screen, every button and every date reads in the language you pick here — twenty-three of them, each written in its own script.',
  /** The picker's own heading, passed in because the picker never calls `t()`. */
  'language.label': 'Choose a language',
  /** The picker's twenty-fourth option: clear the override, follow the workspace. */
  'language.followWorkspace': 'Follow the workspace',
  /** The state panel above the grid, which names the locale in force. */
  'language.state.yours': 'Your language',
  'language.state.workspace': 'Supplied by the workspace',
  'language.state.hint.override':
    'Your own choice. It applies to you alone, on every device you sign in from.',
  'language.state.hint.workspace':
    'You have no language of your own, so you read whatever the workspace is set to. An owner or an admin can change that under Workspace.',
  /** `{language}` is always the native name, never an English exonym. */
  'language.saved': 'planned.travel now speaks {language}',
  'language.saveFailed': 'Your language was not changed',
  'language.saveFailedBody':
    'Nothing was lost and you are still reading {language}. Check your connection, then pick again.',
  /**
   * The other failure: the row *was* written, and only the page turning round
   * behind it was not. Telling that reader "your language was not changed"
   * would contradict both the database and the chip they are looking at, so it
   * gets its own pair of sentences — saved, not switched, reload to read it.
   */
  'language.reload.title': 'Your language is saved',
  'language.reload.body':
    'This page could not finish switching to {language}. Reload it to read the product in your new language.',
  'language.sample.title': 'How dates and numbers will read',
  'language.sample.description':
    'The same three values, written the way this language writes them.',
  'language.sample.date': 'A date',
  'language.sample.number': 'A number',
  'language.sample.money': 'An amount',
  'language.legal':
    'The terms and the privacy notice are published in English only. Everything else in the product is translated.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'Appearance did not load',
  'appearance.theme.title': 'Theme',
  'appearance.theme.description':
    'Both themes are designed, not inverted. Pick the one you read most comfortably.',
  'appearance.theme.light': 'Light',
  'appearance.theme.lightHint': 'Warm paper, all day',
  'appearance.theme.dark': 'Dark',
  'appearance.theme.darkHint': 'Warm charcoal, never black',
  'appearance.theme.system': 'System',
  'appearance.theme.systemHint': 'Follow the device',
  /** `{palette}` is one of the two `appearance.palette.*` words. */
  'appearance.theme.showing': 'Currently showing the {palette} palette.',
  'appearance.theme.showingSystem':
    'Currently showing the {palette} palette, following your device.',
  'appearance.palette.light': 'light',
  'appearance.palette.dark': 'dark',
  'appearance.motion.title': 'Motion and maps',
  'appearance.motion.label': 'Reduce motion',
  'appearance.motion.hint':
    "Collapses entrance animations to a simple fade. Your operating system's own reduce-motion setting is always respected as well.",
  'appearance.map.label': 'Map style',
  'appearance.map.hint': 'The basemap used on the planner and the atlas.',
  'appearance.map.workspace': 'Follow the workspace',
  'appearance.map.workspaceHint': 'Whatever the workspace owner chose.',
  'appearance.map.auto': 'Automatic',
  'appearance.map.autoHint': 'Follows your light or dark theme.',
  'appearance.map.paper': 'Paper',
  'appearance.map.paperHint': 'Warm and light, whichever theme you are in.',
  'appearance.map.charcoal': 'Charcoal',
  'appearance.map.charcoalHint': 'Warm and dark, whichever theme you are in.',
  'appearance.map.quiet': 'Quiet',
  'appearance.map.quietHint': 'No road names, so your pins read first.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'On a shared screen',
  'appearance.privacy.codesLabel': 'Hide confirmation codes until I ask',
  'appearance.privacy.codesHint':
    'Booking references and confirmation numbers stay masked on the bookings desk and on transports until you click or tap one, and mask again when you move on. Prices are never hidden.',
  'appearance.saveFailed': 'That change was not stored',
  'appearance.saveFailedBody':
    'It is showing here, but the next device you sign in from will not have it.',

  /* --------------------------------------------------------------- security */
  'security.error': 'Security did not load',
  'security.unverified.title': 'Your email address is not verified yet',
  'security.unverified.body':
    'Password resets and trip invitations are sent to {email}. Verifying it is what proves the address is yours.',
  'security.unverified.action': 'Send the link again',
  'security.signin.title': 'Sign-in',
  'security.signin.description':
    'How you prove it is you. Two-factor and passkeys are both stronger than a password alone.',
  'security.email.label': 'Email address',
  'security.email.verified': 'Verified',
  'security.email.unverified': 'Unverified',
  'security.password.label': 'Password',
  'security.password.hint':
    'Change it whenever you like — you will be sent a one-time link rather than asked for the old one.',
  'security.password.action': 'Change password',
  'security.twoFactor.label': 'Two-factor authentication',
  'security.twoFactor.onHint':
    'A code from your authenticator app is asked when you sign in with your email and password, unless you trusted that browser.',
  'security.twoFactor.offHint':
    'Add a six-digit code from an authenticator app on top of your password.',
  'security.twoFactor.on': 'On',
  'security.twoFactor.off': 'Off',
  'security.twoFactor.manage': 'Manage',
  'security.twoFactor.enable': 'Turn on',
  'security.passkeys.label': 'Passkeys',
  'security.passkeys.hint':
    'Sign in with your fingerprint, your face or a security key instead of typing anything.',
  'security.passkeys.action': 'Manage passkeys',
  'security.session.title': 'This session',
  'security.session.description': 'The browser you are reading this in.',
  'security.session.label': 'Signed in as',
  'security.session.expires': 'Expires {date}',
  'security.session.expiresSoon': 'soon',
  'security.session.noExpiry': 'No expiry recorded',
  'security.signOut.label': 'Sign out',
  'security.signOut.hint':
    'Ends this session and returns you to the sign-in page. Other devices stay signed in.',
  'security.signOut.pending': 'Signing out',
  'security.signOut.failed': 'You were not signed out',
  'security.signOut.failedBody': 'Check your connection and try again.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Notification settings did not load',
  'notifications.title': 'Notifications',
  'notifications.description':
    'Every switch applies to you alone. Turning one off never stops the event from happening — it only stops us telling you about it.',
  /** The matrix's caption, read by a screen reader and hidden on screen. */
  'notifications.caption': 'Which notifications reach each channel',
  'notifications.event': 'Event',
  /** One switch's accessible name: the event it belongs to, then the channel. */
  'notifications.switch': '{event} — {channel}',
  'notifications.saveFailed': 'That preference was not saved',
  'notifications.saveFailedBody':
    'The switch has been put back. Check your connection and try again.',
  'notifications.channel.in_app': 'In app',
  'notifications.channel.in_app.hint': 'The bell in the top bar',
  'notifications.channel.email': 'Email',
  'notifications.channel.email.hint': 'Sent to your sign-in address',
  'notifications.channel.push': 'Push',
  'notifications.channel.push.hint': 'On devices where you allowed it',
  /**
   * One label and one description per switchable event. The event types are
   * the stored `notifications.event_type` values, so a row written a year ago
   * still finds its copy here.
   */
  'notifications.event.trip.invited': 'Trip invitations',
  'notifications.event.trip.invited.hint':
    'Someone adds you to a trip they are planning.',
  'notifications.event.trip.updated': 'Plan changes',
  'notifications.event.trip.updated.hint':
    'A day, a stop or a date moves on a trip you are on.',
  'notifications.event.trip.starting_soon': 'Departure reminders',
  'notifications.event.trip.starting_soon.hint':
    'A nudge in the days before a trip begins.',
  'notifications.event.reservation.reminder': 'Booking reminders',
  'notifications.event.reservation.reminder.hint':
    'A stay, a table or a ticket is coming up.',
  'notifications.event.expense.added': 'New expenses',
  'notifications.event.expense.added.hint':
    'Someone logs money spent on a shared trip.',
  'notifications.event.expense.settled': 'Settled balances',
  'notifications.event.expense.settled.hint':
    'A balance you were part of has been paid.',
  'notifications.event.list.assigned': 'Assigned items',
  'notifications.event.list.assigned.hint':
    'Something on a packing or to-do list becomes yours.',
  'notifications.event.collab.message': 'Trip conversation',
  'notifications.event.collab.message.hint':
    'New messages in a trip you are travelling on.',
  'notifications.event.organization.invited': 'Workspace invitations',
  'notifications.event.organization.invited.hint':
    'You are invited into a workspace.',

  'notifications.event.billing.plan_changed': 'Subscription changes',
  'notifications.event.billing.plan_changed.hint':
    'Your workspace moves to a different plan.',
  'notifications.event.billing.invoice_paid': 'Payment receipts',
  'notifications.event.billing.invoice_paid.hint':
    'An invoice for your workspace has been paid.',
  'notifications.event.billing.payment_failed': 'Payment problems',
  'notifications.event.billing.payment_failed.hint':
    'A charge for your workspace did not go through.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'The workspace did not load',
  /** `{plan}` is the catalogue plan's own name; `{date}` is already formatted. */
  'workspace.summary.description': '{plan} plan · created {date}',
  'workspace.summary.createdRecently': 'recently',
  'workspace.summary.billingAction': 'Plan and billing',
  'workspace.seats.label': 'Seats used',
  'workspace.seats.value': '{used} of {limit}',
  'workspace.seats.note':
    'Outstanding invitations count against your seats, so a workspace can never oversubscribe the plan it pays for.',
  'workspace.seatsFull.title': 'Every seat on this plan is taken',
  'workspace.seatsFull.body':
    '{members} and {invitations} fill all {limit} seats.',
  'workspace.seatsFull.action': 'Add seats',
  'workspace.members.count': {
    one: '{value} member',
    other: '{value} members',
  },
  'workspace.invitations.count': {
    one: '{value} pending invitation',
    other: '{value} pending invitations',
  },
  'workspace.members.title': 'Members',
  'workspace.members.description':
    'Everyone who can see the trips, the money and the files in this workspace.',
  'workspace.members.tableLabel': 'Members of this workspace',
  'workspace.members.person': 'Person',
  'workspace.members.role': 'Role',
  'workspace.members.joined': 'Joined',
  'workspace.invitations.title': 'Invitations',
  'workspace.invitations.description':
    'People who have been invited but have not joined yet.',
  'workspace.invitations.emptyTitle': 'No outstanding invitations',
  'workspace.invitations.emptyBody':
    'Everyone invited to this workspace has already joined.',
  'workspace.invitations.expires': 'Expires {date}',
  'workspace.invitations.expiresSoon': 'soon',
  'workspace.defaults.title': 'Shared defaults',
  'workspace.defaults.description':
    'What a new trip and a new member start with. Anyone can override these for themselves in their profile.',
  'workspace.defaults.readOnly': 'Read only',
  'workspace.defaults.saving': 'Saving the workspace defaults',
  'workspace.defaults.saved': 'The workspace defaults are saved',
  'workspace.defaults.saveFailed': 'The workspace defaults were not saved',
  'workspace.defaults.saveFailedBody':
    'Only an owner or an admin may change them. Check your connection, then try again.',
  'workspace.currency.label': 'Default currency',
  'workspace.currency.hint': 'New trips are budgeted in this.',
  'workspace.language.label': 'Language',
  'workspace.language.hint':
    'What a member who has not chosen a language of their own reads.',
  'workspace.timezone.label': 'Time zone',
  'workspace.dateFormat.label': 'Date format',
  'workspace.weekStart.label': 'Week starts on',
  'workspace.distance.label': 'Distance',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'Billing did not load',
  'billing.loading': 'Loading the plan and its receipts',
  /** The nine Polar subscription states, as a customer should read them. */
  'billing.status.none': 'No subscription',
  'billing.status.trialing': 'Trial',
  'billing.status.active': 'Active',
  'billing.status.past_due': 'Payment failed',
  'billing.status.unpaid': 'Unpaid',
  'billing.status.paused': 'Paused',
  'billing.status.canceled': 'Cancelled',
  'billing.status.incomplete': 'Incomplete',
  'billing.status.incomplete_expired': 'Expired',

  'billing.return.pending': 'Checking your plan change',
  'billing.return.checking': 'Checking billing status',
  'billing.return.confirmed': 'Plan confirmed',
  'billing.return.scheduled': 'Plan change scheduled',
  'billing.return.delayed': 'Confirmation is taking longer',
  'billing.return.body':
    'Refresh to check again. If the change remains unconfirmed, contact support.',
  'billing.return.scheduledBody':
    'Your change takes effect on {date}. Your current plan stays in force until then. This does not confirm changes to the number of seats.',

  'billing.checkout.cancelledTitle': 'Checkout cancelled',
  'billing.checkout.cancelledBody':
    'Nothing was charged and your plan has not changed.',
  'billing.portal.backTitle': 'Back from Polar',
  'billing.portal.backBody':
    'Anything you changed there lands here as soon as Polar confirms it.',
  'billing.refresh': 'Refresh',
  'billing.readOnly.title': 'You are a member of this workspace',
  'billing.readOnly.body':
    'Only an owner or an admin can change the subscription. Everything below is read-only for you.',

  'billing.hero.label': 'Current plan',
  'billing.hero.endsAtPeriod': 'Ends at period close',
  'billing.hero.perYear': '/ year',
  'billing.hero.perMonth': '/ month',
  /** The free plan's allowance line. `{trips}` is already formatted. */
  'billing.hero.freeAllowance': '{trips} trips, one traveller',
  'billing.hero.perSeatLine': '{seats} members × {price}',
  'billing.hero.singleTraveller': 'One traveller',
  'billing.price.free': 'Free',
  'billing.provider.opening': 'Opening Polar',
  /** The one line under the plan name that says what happens next, and when. */
  'billing.renewal.trialEndsToday':
    'Your trial ends today. The first charge follows unless you cancel before then.',
  'billing.renewal.trialEndsIn': {
    one: 'Your trial ends in {value} day, and the first charge follows unless you cancel before then.',
    other:
      'Your trial ends in {value} days, and the first charge follows unless you cancel before then.',
  },
  'billing.renewal.trialEnded': 'Your trial has ended.',
  'billing.renewal.endsNoDate': 'This plan is set to end and will not renew.',
  'billing.renewal.endsOn':
    'This plan ends on {date}. Nothing is deleted — the paid modules simply lock.',
  'billing.renewal.pastDue':
    'The last payment did not go through. Update your card to avoid losing the paid modules.',
  'billing.renewal.unpaid':
    'This subscription is unpaid and the paid modules are locked.',
  'billing.renewal.paused':
    'This subscription is paused. Resume it whenever you are ready to travel again.',
  'billing.renewal.lapsed':
    'Choose a plan below to unlock reservations and the journal again.',
  'billing.renewal.incomplete':
    'Polar is still waiting for this payment to be confirmed.',
  'billing.renewal.free':
    'Two trips at a time, on the house. Upgrade whenever you outgrow it.',
  'billing.renewal.auto': 'Renews automatically.',
  'billing.renewal.renewsOn': 'Renews on {date}.',

  'billing.usage.title': 'Usage',
  'billing.usage.description':
    'Counted live, so a meter is never stale. Limits follow the plan in force right now.',
  'billing.quota.seats': 'Members',
  'billing.quota.trips': 'Trips',
  'billing.quota.storageBytes': 'Storage',
  'billing.quota.unlimited': 'Unlimited',
  'billing.quota.places': 'Places',
  'billing.quota.placesHint': 'Across all trips in this workspace',
  'billing.quota.exhausted.places': 'The places allowance is used up',
  'billing.quota.over.places': 'Above the places limit by {value}',
  'billing.quota.noLimit': 'No limit on this plan',
  /** A usage meter's accessible name, including the places meter. */
  'billing.quota.used': '{quota} used',
  /**
   * Being *over* a limit and being exactly *at* one are different situations. A
   * workspace that inherited members from a richer plan is genuinely over, and
   * telling it "you have used every seat" understates the problem.
   */
  'billing.quota.over.seats': {
    one: '{value} seat over the limit on this plan',
    other: '{value} seats over the limit on this plan',
  },
  'billing.quota.over.trips': {
    one: '{value} trip slot over the limit on this plan',
    other: '{value} trip slots over the limit on this plan',
  },
  'billing.quota.over.storage': '{value} over the limit on this plan',
  'billing.quota.exhausted.seats': 'Every seat on this plan is taken',
  'billing.quota.exhausted.trips': 'Every trip slot on this plan is in use',
  'billing.quota.exhausted.storage': 'The storage on this plan is full',
  'billing.quota.left': '{value} left',

  'billing.plans.title': 'Plans',
  'billing.plans.description':
    'Change plan whenever you like. Upgrades are prorated to the day; a downgrade waits until the period you have paid for is over.',
  'billing.interval.label': 'Billing interval',
  'billing.interval.monthly': 'Monthly',
  'billing.interval.yearly': 'Yearly',
  /** The saving badge on the yearly pill. `{value}` is already formatted. */
  /**
   * The three plans, named and described.
   *
   * `src/lib/plans.ts` carries an English `name`, `tagline` and `features` for
   * every plan, and keeps them: the marketing pages read them and Polar is sent
   * one as a product description, where English is the operator's record. On a
   * settings screen it is an untranslated string in the middle of translated
   * copy, which §8.6 does not admit. The mapping from a plan id to these keys is
   * `../../../plan-copy.ts`.
   *
   * A plan *name* is translated like every other word here, and this file used
   * to say the opposite — that it was a proper noun a translation could keep as
   * it stands. It cannot: `__tests__/parity.test.ts` reads a value byte-identical
   * to English as untranslated copy, its proper-noun allow-list is empty, and it
   * belongs to another item, so a translator told to leave `Free` alone was being
   * set an impossible task. What is stable across languages is the plan *id* —
   * `free`, `solo`, `crew` — which is what `src/lib/plans.ts`, Polar and the
   * invoice carry, and no reader ever sees. The word on the screen is a word:
   * `Gratis`, `無料`, and whatever each language calls travelling alone or in a
   * group.
   */
  'billing.plan.free.name': 'Free',
  'billing.plan.free.tagline': 'Plan your next two trips',
  'billing.plan.free.feature.trips': 'Two trips at a time and up to 150 places',
  'billing.plan.free.feature.itinerary': 'Day-by-day itinerary and map',
  'billing.plan.free.feature.lists': 'Packing lists and simple budgets',
  'billing.plan.free.feature.atlas':
    'The world map that tracks where you have been',
  'billing.plan.solo.name': 'Solo',
  'billing.plan.solo.tagline': 'For the traveller who plans everything',
  'billing.plan.solo.feature.trips': 'Unlimited trips and places',
  'billing.plan.solo.feature.modules':
    'Every planning module — reservations, journal, budgets, packing',
  'billing.plan.solo.feature.storage': '5 GB for photos and documents',
  'billing.plan.solo.feature.export': 'PDF and calendar export',
  'billing.plan.crew.name': 'Crew',
  'billing.plan.crew.tagline': 'For families, friends and small teams',
  'billing.plan.crew.feature.members': 'Up to ten members, billed per person',
  'billing.plan.crew.feature.realtime':
    'Real-time collaboration with live cursors',
  'billing.plan.crew.feature.everything':
    'Unlimited trips, places and every module',
  'billing.plan.crew.feature.storage':
    'Shared room for everyone’s photos and documents',

  'billing.plan.current': 'Current plan',
  'billing.plan.currentBadge': 'Current',
  'billing.plan.popular': 'Popular',
  'billing.plan.switchYearly': 'Switch to yearly',
  'billing.plan.switchMonthly': 'Switch to monthly',
  'billing.plan.upgradeTo': 'Upgrade to {plan}',
  'billing.plan.changeTo': 'Change to {plan}',
  'billing.plan.perMemberMonth': '/ member / month',
  'billing.plan.perMonth': '/ month',
  'billing.plan.alwaysFree': 'Always free, no card',
  'billing.plan.billedYearly': '{amount} billed yearly',
  'billing.plan.billedMonthly': '{amount} billed monthly',
  'billing.plan.members': 'Members',
  'billing.plan.membersHint': 'Change it any time — billing follows.',
  'billing.plan.seatOption': {
    one: '{value} member',
    other: '{value} members',
  },

  'billing.invoices.number': 'Invoice',
  'billing.invoices.date': 'Date',
  'billing.invoices.amount': 'Amount',
  'billing.invoices.status': 'Status',
  'billing.invoice.paid': 'Paid',
  'billing.invoice.draft': 'Draft',
  'billing.invoice.void': 'Void',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'The billing provider rejected that request. Try again in a moment.',
  'billing.failure.reference': 'Reference for support: {reference}',
  'billing.failure.forbidden':
    'Your role does not allow that for this workspace’s billing. Ask an owner or an admin.',
  'billing.failure.providerRefused':
    'Polar would not accept that change. Check the seat count against your members, then try again or use the billing portal.',
  'billing.failure.rateLimited':
    'Polar is busy right now. Nothing was changed. Try again in a minute.',
  'billing.failure.notConnected':
    'Billing is not connected on this deployment yet, so nothing was changed. Contact support.',
  'billing.failure.orderNotInvoiceable':
    'Polar cannot issue an invoice for this order. If it has no billing name or address, add them in the billing portal and try again; otherwise contact support.',
  'billing.discount.toggle': 'Have a promotion code?',
  'billing.discount.label': 'Promotion code',
  'billing.discount.hint': 'Applied to the plan you choose next.',
  'billing.discount.hintCurrent':
    'Apply it to your current plan, or choose a plan below.',
  'billing.discount.applyCurrent': 'Apply to current plan',
  'billing.discount.applying': 'Applying code…',
  'billing.discount.invalidFormat': 'Codes are 3 to 64 letters and digits.',
  'billing.discount.rejected.invalid':
    "That code isn't valid. Check it and try again.",
  'billing.discount.rejected.rateLimited':
    'Too many codes tried. Try again in an hour.',
  'billing.discount.rejected.notApplicable':
    "That code doesn't apply to this plan.",
  'billing.discount.rejected.busy':
    "Codes can't be checked right now. Try again in a minute.",
  'billing.discount.nextRenewal':
    'Your promotion code applies from your next renewal.',
  'billing.discount.appliedTitle': 'Promotion code applied',
  'billing.hero.manage': 'Manage billing',
  'billing.hero.manageHint':
    'Cards, billing address, VAT number, receipts and cancellation live with Polar, who issues the invoice.',
  'billing.hero.manageHintNone':
    'There is no billing profile yet. Choosing a paid plan below creates one, and the portal opens from then on.',
  'billing.portal.opening': 'Opening the billing portal',
  'billing.plan.notApplied': 'That change was not applied',
  'billing.plan.cancelInPortal': 'Cancel in the portal',
  'billing.plan.seatsOverMax': {
    one: 'This workspace has {members} members and {plan} bills at most {max}. Remove {value} member before switching.',
    other:
      'This workspace has {members} members and {plan} bills at most {max}. Remove {value} members before switching.',
  },
  'billing.plan.seatsBelowMembers':
    'You have {members} members. Choose at least that many seats — Polar rejects a subscription with fewer seats than assignments.',
  'billing.orders.title': 'Orders',
  'billing.orders.description': 'Every order for this workspace, newest first.',
  'billing.orders.receipts': 'All receipts',
  'billing.orders.unavailableTitle': 'Orders are not loading',
  'billing.orders.unavailableBody':
    'Polar did not answer in time for the history. Everything above is live — try again in a moment, or read the full record in the billing portal.',
  'billing.orders.emptyTitle': 'No orders yet',
  'billing.orders.emptyCustomer':
    'The first invoice appears here as soon as a billing period closes.',
  'billing.orders.emptyNoCustomer':
    'This workspace has never been charged. Choose a paid plan and the invoices collect here.',
  'billing.orders.tableLabel': 'Order history',
  'billing.orders.document': 'Document',
  'billing.orders.dateUnknown': 'Date unknown',
  'billing.order.pending': 'Pending',
  'billing.order.refunded': 'Refunded',
  'billing.order.partiallyRefunded': 'Part refunded',
  'billing.order.noInvoiceDraft': 'No invoice while this order is a draft',
  'billing.order.preparing': 'Preparing',
  'billing.order.renderingHint':
    'Polar is still rendering invoice {number}. The download returns in a few seconds.',
  'billing.order.fetching': 'Fetching the invoice',
  'billing.order.generating': 'Polar is preparing the invoice',
  'billing.order.pdfLabel': 'Invoice {number} as PDF',
  'billing.order.stillWritingTitle': 'Polar is still writing that invoice',
  'billing.order.stillWritingBody':
    'Invoice {number} is being rendered. The download comes back on its own in a few seconds.',
  'billing.order.openFailed': 'That invoice did not open',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Account',
  'passkeys.page.title': 'Passkeys',
  'passkeys.page.description':
    'A passkey lets you sign in with your fingerprint, your face or a security key instead of typing anything.',
  'passkeys.page.back': 'Back to security',
  'passkeys.list.label': 'Your passkeys',
  'passkeys.add.action': 'Add a passkey',
  'passkeys.add.loading': 'Waiting for your device',
  'passkeys.add.added': 'Passkey added',
  'passkeys.add.dismissed': 'No passkey was added',
  'passkeys.add.exists': 'This device already has a passkey for your account',
  'passkeys.add.failed': 'The passkey was not added. Try again.',
  'passkeys.add.stale':
    'For your safety, managing passkeys requires a recent sign-in. Choosing ‘Sign in again’ will sign you out first, then take you to the sign-in page.',
  'passkeys.error.sessionEnded':
    'Your session has ended. Sign in again to continue managing your passkeys.',
  'passkeys.signInAgain': 'Sign in again',
  'passkeys.add.limit':
    'You have reached the limit of {value} passkeys. Remove one to add another.',
  'passkeys.add.unsupported':
    'This browser cannot create passkeys. Try another browser or device.',
  'passkeys.empty.title': 'No passkeys yet',
  'passkeys.empty.body':
    'Add one and you can sign in with your fingerprint, your face or a security key instead of typing anything.',
  'passkeys.row.fallbackName': 'Passkey · added {date}',
  'passkeys.row.added': 'Added {date}',
  'passkeys.row.lastUsed': 'Last used {date}',
  'passkeys.row.neverUsed': 'Not used to sign in yet',
  'passkeys.badge.synced': 'Synced',
  'passkeys.badge.singleDevice': 'On one device only',
  'passkeys.error.title': 'Your passkeys did not load',
  'passkeys.error.retry': 'Try again',
  'passkeys.error.rateLimited':
    'Too many attempts. Try again in a few minutes.',
  'passkeys.error.generic': 'Check your connection and try again.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': 'Rename {name}',
  'passkeys.rename.fieldLabel': 'Name this passkey',
  'passkeys.rename.placeholder': 'Name it, like Work phone',
  'passkeys.rename.saving': 'Saving the name',
  'passkeys.rename.saved': 'Name saved',
  'passkeys.rename.failed': 'The name was not saved',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': 'Remove {name}',
  'passkeys.delete.title': 'Remove this passkey?',
  'passkeys.delete.body': 'You will no longer be able to sign in with {name}.',
  'passkeys.delete.password': 'Password',
  'passkeys.delete.passwordHint': 'Enter your password to confirm.',
  'passkeys.delete.confirmOnly':
    'Your account has no password. Confirm that you want to remove this passkey.',
  'passkeys.delete.confirm': 'Remove passkey',
  'passkeys.delete.cancel': 'Cancel',
  'passkeys.delete.wrongPassword': 'That password is not right.',
  'passkeys.delete.stale':
    'For your safety, removing a passkey requires a recent sign-in. Choosing ‘Sign in again’ will sign you out first, then take you to the sign-in page.',
  'passkeys.delete.removed': 'Passkey removed',
  'passkeys.delete.failed': 'The passkey was not removed. Try again.',
  'passkeys.delete.removing': 'Removing the passkey',
  'passkeys.delete.passwordRequired':
    'Enter your password to remove this passkey.',
  'workspace.departure.leave': 'Leave workspace',
  'workspace.departure.remove': 'Remove member',
  'workspace.departure.title': 'End membership in {workspace}?',
  'workspace.departure.body':
    '{name} will lose access to {workspace}. Their account and retained trips and cost records will stay.',
  'workspace.departure.cancel': 'Cancel',
  'workspace.departure.pending': 'Ending membership…',
  'workspace.departure.lastOwner':
    'Make another member an owner before leaving or removing this owner.',
  'workspace.departure.notPermitted':
    'Your current role cannot remove this member. Refresh the member list before trying again.',
  'workspace.departure.notFound':
    'This person is no longer a member of this workspace.',
  'workspace.departure.impersonated':
    'Stop impersonating before changing workspace membership.',
  'workspace.departure.failed':
    'The result could not be confirmed. Reload the workspace before trying again.',
  'workspace.departure.removed': 'Member removed',
  'workspace.departure.reload': 'Reload workspace',
  'workspace.departure.activationFailed':
    'You left this workspace. Open your next workspace to continue.',
  'workspace.departure.recover': 'Open next workspace',
  'twoFactor.back': 'Back to security',
  'twoFactor.title': 'Two-factor authentication',
  'twoFactor.description':
    'Add a second step when you sign in with your email and password.',
  'twoFactor.error': 'We could not load your two-factor settings.',
  'twoFactor.steps.label': 'Set up two-factor',
  'twoFactor.steps.password': 'Confirm it is you',
  'twoFactor.steps.key': 'Add it to your authenticator',
  'twoFactor.steps.confirm': 'Enter a code',
  'twoFactor.steps.state.done': 'Done',
  'twoFactor.steps.state.current': 'Current step',
  'twoFactor.steps.state.todo': 'Not started',
  'twoFactor.password.label': 'Your password',
  'twoFactor.password.hint': 'We ask again before changing how you sign in.',
  'twoFactor.password.submit': 'Continue',
  'twoFactor.password.pending': 'Setting up',
  'twoFactor.password.invalid': 'That password is not right.',
  'twoFactor.key.intro':
    'You need an authenticator app on your phone. Add this key to it, then come back to this page. Two-factor is not on yet.',
  'twoFactor.key.matrixLabel': 'Setup code. The same key is available as text',
  'twoFactor.key.matrixFailed':
    'We could not draw a code for this key. Enter the setup key in your app.',
  'twoFactor.key.label': 'Setup key',
  'twoFactor.key.copy': 'Copy key',
  'twoFactor.key.copied': 'Key copied',
  'twoFactor.key.copyFailed':
    'Your browser would not copy the key. Select it and copy it by hand.',
  'twoFactor.key.open': 'Open in your authenticator app',
  'twoFactor.key.startOver': 'Start over',
  'twoFactor.key.startOverHint':
    'Starting over makes a new key. A key you already added to an app will stop working.',
  'twoFactor.key.next': 'I have added it',
  'twoFactor.code.label': 'Code from the app',
  'twoFactor.code.hint': 'The six digits the app shows now.',
  'twoFactor.code.submit': 'Turn on two-factor',
  'twoFactor.code.pending': 'Checking',
  'twoFactor.code.invalid':
    'That code did not match. Check the time on your phone and enter the newest code the app shows.',
  'twoFactor.code.unclear':
    'We could not tell whether that worked. Enter the newest code to try again.',
  'twoFactor.rateLimited.title': 'Too many tries in a short time',
  'twoFactor.rateLimited.password':
    'Wait about ten seconds, then try again. Nothing you typed was lost.',
  'twoFactor.rateLimited.code':
    'Wait up to a minute, then try again. Nothing you typed was lost.',
  'twoFactor.codes.title': 'Your backup codes',
  'twoFactor.codes.body':
    'Each code works once if you lose your phone. They are shown only now, so keep them somewhere safe.',
  'twoFactor.codes.copyAll': 'Copy all',
  'twoFactor.codes.copied': 'Backup codes copied',
  'twoFactor.codes.download': 'Download as a text file',
  'twoFactor.codes.copyFailed':
    'Your browser would not copy them. Select the codes and copy them by hand.',
  'twoFactor.codes.stored': 'I have stored these backup codes',
  'twoFactor.codes.done': 'Done',
  'twoFactor.codes.gate': 'Tick the box to continue.',
  'twoFactor.codes.lost':
    'If you leave this page first you can make a new set from this screen, and the old one will stop working.',
  'twoFactor.codes.leave.title': 'Leave without keeping your codes?',
  'twoFactor.codes.leave.body':
    'Your backup codes are shown only once. If you leave now you can make a new set from this screen, and the old one will stop working.',
  'twoFactor.codes.leave.stay': 'Stay here',
  'twoFactor.codes.leave.go': 'Leave',
  'twoFactor.on.title': 'Two-factor is on',
  'twoFactor.on.badge': 'On',
  'twoFactor.on.body':
    'We ask for a code from your authenticator app when you sign in with your email and password, unless you chose to trust that browser. Signing in with Google, Apple or a passkey does not ask for one.',
  'twoFactor.replace.action': 'Replace backup codes',
  'twoFactor.replace.title': 'Replace your backup codes?',
  'twoFactor.replace.body':
    'You will get a new set. The set you have now stops working as soon as you continue.',
  'twoFactor.replace.confirm': 'Replace',
  'twoFactor.replace.pending': 'Replacing',
  'twoFactor.nopassword.title': 'Set a password first',
  'twoFactor.nopassword.body':
    'Two-factor needs a password on this account. The next page asks for your email and sends a link to set one. Setting a password signs you out everywhere, so sign in again and come back here.',
  'twoFactor.nopassword.action': 'Set a password',
  'twoFactor.setup.action': 'Show setup key again',
  'twoFactor.setup.title': 'Setup key',
  'twoFactor.setup.body':
    'Add this key to another device. The key already on your other devices keeps working.',
  'twoFactor.setup.done': 'Done',
  'twoFactor.setup.confirm': 'Show key',
  'twoFactor.setup.pending': 'Checking',
  'twoFactor.off.action': 'Turn off two-factor',
  'twoFactor.off.title': 'Turn off two-factor?',
  'twoFactor.off.body':
    'Anyone with your password will be able to sign in without a code. Your other signed-in devices stay signed in.',
  'twoFactor.off.confirm': 'Turn off',
  'twoFactor.off.pending': 'Turning off',
  'twoFactor.off.cancel': 'Keep it on',
  'twoFactor.off.done': 'Two-factor is off',
} as const satisfies NamespaceMessages

export default messages
