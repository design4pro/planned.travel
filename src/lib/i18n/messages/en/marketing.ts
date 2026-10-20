/**
 * The public pages' copy, in the source locale.
 *
 * `docs/SPEC.md` §8 reserves this namespace by name and §9.8 puts the landing
 * and pricing pages squarely in scope. This file is the header, the footer and
 * the actions they share — the frame every public page wears.
 *
 * **What belongs here.** What the marketing chrome says on its own behalf.
 *
 * **What does not, and will not.** A price. §7 and PRODUCT.md both forbid
 * restating one in copy: `src/lib/plans.ts` and the deployment's Polar product
 * ids are the only authority, and a translated "€9 a month" is a claim that
 * outlives the number it was copied from. Nor a testimonial, a customer count,
 * an uptime figure or a logo — none of those exist, and a catalogue is a
 * comfortable place to quietly invent one.
 *
 * **Proper nouns stay.** planned.travel, Cloudflare Workers, OpenStreetMap and
 * Polar are names, not words; the sentences around them translate.
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  /**
   * The loud button in the header and again in the footer. One key, so the
   * two never drift into two different invitations.
   */
  'action.startFree': 'Start free',
  'action.signIn': 'Sign in',
  'action.pricing': 'Pricing',
  'action.seePricing': 'See pricing',
  'action.skipToContent': 'Skip to content',
  /* -------------------------------------------------------- the header */
  /**
   * The wordmark's accessible name. The product name is a proper noun and
   * stays Latin in every locale; only the word around it translates.
   */
  'nav.home': 'planned.travel home',
  /**
   * Names the in-page anchor nav for a screen reader, which otherwise hears
   * four bare links with no idea what they belong to.
   */
  'nav.onThisPage': 'On this page',
  'anchor.planner': 'Planner',
  /**
   * Serves the header anchor and the footer column of the same name: one
   * word, one translation.
   */
  'anchor.modules': 'Modules',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Drop on day {day}',
  'legal.summaryNote':
    'The summary is here to be read. The sections below are what actually applies.',
  'visual.daysTravelled': 'Days travelled',
  'visual.acrossEveryTrip': 'across every trip',
  'visual.mapFilled': '{percent}% of the map filled in',
  'visual.previewSummary':
    'A preview of the planned.travel dashboard: the next trip with its dates, travellers and place count; totals for countries visited, trips and days travelled; a map of the trip route; and the next two bookings.',
  'visual.placesMapped': {
    one: '{value} place mapped',
    other: '{value} places mapped',
  },
  'visual.splitWays': {
    one: 'not split',
    other: 'split {value} ways',
  },
  'visual.tripTotal': 'Trip total',
  'visual.paidSplit': '{who} paid · {split}',
  'visual.nextUp': 'Next up',
  'visual.ofTotal': '{done} of {total}',
  'visual.awaitingReply': 'Awaiting reply',
  'visual.upcoming': 'Upcoming',
  'visual.days': {
    one: '{value} day',
    other: '{value} days',
  },
  'visual.places': {
    one: '{value} place',
    other: '{value} places',
  },
  'visual.transfersLeft': {
    one: '{value} transfer left',
    other: '{value} transfers left',
  },

  'legal.badge.version': 'Version {version}',
  'legal.badge.effective': 'Effective {updated}',
  'legal.notice.title': 'This is a template, not legal advice',
  'legal.notice.body':
    'It is written in plain English to be a genuinely useful starting point for a small travel-planning service, and every gap a business must fill is highlighted. Have a qualified lawyer in your jurisdiction review and adapt it before you accept a single customer. Nothing here asserts a certification, audit or compliance standard that planned.travel holds.',
  'legal.contents': 'Contents',
  'legal.shortVersion': 'The short version',
  'legal.both': 'Both documents apply together.',

  'landing.plans.title': 'Start free. Pay only once it earns it.',
  'landing.plans.lede':
    'Every plan includes the day planner, the map, budgets and packing lists. Paid plans — from {price} a month — unlock unlimited trips, reservations, the journal and exports.',
  'landing.plans.ledeFree':
    'Every plan includes the day planner, the map, budgets and packing lists. Paid plans unlock unlimited trips, reservations, the journal and exports.',
  'landing.plans.compare': 'Compare every limit, line by line',
  'landing.questions.title': 'Questions, answered plainly',
  'landing.questions.lede':
    'The five things people actually want to know before they start planning.',
  'cta.heading': 'Your next trip is already worth planning properly',
  'cta.lede':
    'Two trips, the whole map, the itinerary and the packing lists — free, with no card and no countdown.',
  'landing.faq.seats.q': 'Do the people I travel with need to pay too?',
  'landing.faq.seats.a':
    'No. Everyone you invite into a {crew} workspace is covered by its seats. They sign in with their own account and see only the trips you added them to.',
  'landing.faq.phone.q': 'Does it work properly on a phone?',
  'landing.faq.phone.a':
    'Yes. The mobile layouts are drawn separately rather than squeezed down from the desktop ones, and it is a website, so there is nothing to install and nothing to keep updated.',
  'landing.faq.privacy.q': 'Who can see my trip?',
  'landing.faq.privacy.a':
    'A trip belongs to one workspace, and only the people invited into that workspace can open it. Nothing is public, there is no discovery feed, and nothing is shared with anyone else by default.',
  'landing.faq.stop.q': 'What happens to my trips if I stop paying?',
  'landing.faq.stop.a':
    'Nothing is deleted. The paid modules lock, your trips stay exactly where they are, and everything unlocks again the moment you subscribe. {free} stays free with no countdown.',

  'action.startPlanning': 'Start planning free',
  'cta.comparePlans': 'Compare the plans',
  'landing.hero.eyebrow': 'Collaborative trip planning',
  'landing.hero.title': 'Plan the trip.',
  'landing.hero.titleQuiet': 'Not the spreadsheet.',
  'landing.hero.lede':
    'One itinerary on a real map, shared live with everyone travelling — with the bookings, the money and the packing list attached to it.',
  'landing.hero.secondary': 'See what it costs',
  'landing.trust.noCard': 'No card to start',
  'landing.trust.noAds': 'No adverts, no affiliate links',
  'landing.trust.export': 'Export everything, any time',

  'proof.eyebrow': 'Straight answers',
  'proof.title': 'No testimonials, because we have not earned any yet',
  'proof.lede':
    'planned.travel is new. Rather than invent a quote or borrow somebody’s logo, here is exactly what it does, who it is for, and what it will never do to you.',
  'proof.who.label': 'Who it is for',
  'proof.who.heading': 'The person who ends up making the spreadsheet',
  'proof.who.body':
    'Couples, families and groups of friends who want one plan everybody can see, instead of six screenshots, three group chats and a shared note nobody has opened since March.',
  'proof.not.label': 'What it is not',
  'proof.not.heading': 'Not a booking site, and not for sale to one',
  'proof.not.body':
    'We take no commission, carry no adverts and place no affiliate links, so nothing on a page is quietly steering you towards a particular hotel. You pay us, which means we work for you.',
  'proof.where.label': 'Where your things live',
  'proof.where.heading': 'On Cloudflare, in your own workspace',
  'proof.where.body':
    'Trips sit in a database scoped to your workspace and files in our own object storage, both served from Cloudflare’s edge. Polar, our merchant of record, runs the checkout and issues the invoice, so your card number never reaches us.',
  'proof.promise.ads.title': 'No advertising, no third-party analytics',
  'proof.promise.ads.body':
    'Nothing on the page is measuring you for somebody else.',
  'proof.promise.sold.title': 'Your trips are never sold or rented',
  'proof.promise.sold.body':
    'Not to advertisers, not to travel companies, not to anyone.',
  'proof.promise.leave.title': 'Leave whenever you like, with everything',
  'proof.promise.leave.body':
    'PDF itineraries, calendar files and your places as GeoJSON.',
  'proof.certification':
    'We hold no security certification today, and we will not imply one. When planned.travel is audited against a standard, this is where we will name the standard, the auditor and the date — and not before.',

  'feature.modules.title': 'The rest of the trip, handled',
  'feature.modules.lede':
    'Each module does one job properly and hands its work to the others. Nothing here is a placeholder tab waiting for a future release.',
  'feature.module.lists.benefit': 'Nobody arrives without the adapter.',
  'feature.module.lists.detail':
    'Packing, to-dos, shopping and documents — one list per job, shared with everyone travelling and ticked off as it happens.',
  'feature.module.journal.name': 'Journal',
  'feature.module.journal.benefit': 'The trip becomes a story, not a folder.',
  'feature.module.journal.detail':
    'Entries in date order with the photographs you took, where you were, the weather, and how the day actually felt.',
  'feature.module.atlas.benefit': 'One map of everywhere you have been.',
  'feature.module.atlas.detail':
    'Mark a country visited and it joins your world map, with the first visit, the most recent, and how many times you have been back.',
  'feature.module.vacay.benefit': 'Book the leave before you book the flight.',
  'feature.module.vacay.detail':
    'Mark the days you are away and the year fills in — weekends, public holidays and everyone else’s time off in the same grid.',
  'feature.module.collab.benefit': 'The decisions stay with the trip.',
  'feature.module.collab.detail':
    'One thread per trip, shared notes for the things everyone must remember, and a poll for when the group cannot agree on dinner.',
  'feature.module.files.benefit': 'Boarding passes where you can find them.',
  'feature.module.files.detail':
    'Confirmations, tickets, insurance documents and receipts attached to the trip they belong to, not buried in an inbox.',

  'feature.planner.title': 'A day-by-day plan drawn on a real map',
  'feature.planner.lede':
    'Collect the places you want to see, then drag them onto a day. The map redraws the route as you go, so you can see immediately when a morning has you crossing the city twice.',
  'feature.planner.point.days':
    'One column per day, with its date, its weather and the place you are sleeping.',
  'feature.planner.point.unscheduled':
    'Places you have not scheduled wait in their own column until they have a day.',
  'feature.planner.point.crew':
    'On {crew}, everyone drags at once — live cursors, instant sync, no refresh.',
  'feature.planner.point.tiles':
    'Vector tiles served from our own storage, so no map vendor is watching you plan.',
  'feature.costs.title': 'Shared costs that actually settle',
  'feature.costs.lede':
    'Log what you spend in the trip’s own currency, split each expense the way you actually agreed, and see the shortest set of transfers that clears the whole thing.',
  'feature.costs.point.split':
    'Split evenly, by share, or by exact amount — per expense, not per trip.',
  'feature.costs.point.currency':
    'Everything converted into one trip currency so the total means something.',
  'feature.costs.point.settle':
    'The settle-up view names who pays whom, and logs the transfer once it happens.',
  'feature.costs.point.receipt':
    'Attach the receipt to the expense, so the number always has its evidence.',
  'feature.book.title': 'Every booking, with the code you need at the door',
  'feature.book.lede':
    'Stays, tables, tours and tickets in one list, next to the flights, trains and ferries that get you between them — each with its confirmation number and the day it belongs to.',
  'feature.book.point.legs':
    'Transport legs carry the seat, the platform, the terminal and the booking code.',
  'feature.book.point.day':
    'A booking is attached to a day, so it shows up in the plan without retyping.',
  'feature.book.point.states':
    'Requested, confirmed and cancelled are separate states, not a note in a field.',
  'feature.book.point.export':
    'Export the whole trip as a PDF itinerary or a calendar file before you fly.',

  'pricing.faq.trial.q': 'What happens when a trial ends?',
  'pricing.faq.trial.a':
    'The trial converts into the paid plan. Polar takes a payment method when the trial starts and charges it the day the trial ends, so cancel before then and you are never charged. Nothing is ever deleted either way: the paid modules lock, your trips stay exactly where they are, and everything unlocks again the moment you subscribe.',
  'pricing.faq.seller.q': 'Who am I actually buying from?',
  'pricing.faq.seller.a':
    'Polar. They are our merchant of record, which means they sell the subscription to you as our reseller, take the payment, issue the invoice in their own name, and determine, collect and remit the sales tax or VAT your country charges. Refunds and card disputes are settled with them too. We are still the people who run the service and answer your email.',
  'pricing.faq.change.q': 'Can I change plan halfway through a trip?',
  'pricing.faq.change.a':
    'Yes. Upgrades apply immediately and are prorated to the day; downgrades take effect at the end of the period you have already paid for, so you never lose access you paid for.',
  'pricing.faq.seats.q': 'How does per-member billing work on {crew}?',
  'pricing.faq.seats.a':
    'You pay for the seats you actually fill, and you can change the number at any time. Outstanding invitations count against your seats, so a workspace can never quietly oversubscribe the plan.',
  'pricing.faq.guests.q':
    'Do the people I travel with need their own subscription?',
  'pricing.faq.guests.a':
    'No. Everyone you invite into a {crew} workspace is covered by its seats. They sign in with their own account and see the trips they have been added to.',
  'pricing.faq.storage.q': 'What counts towards storage?',
  'pricing.faq.storage.a':
    'Photographs, tickets, confirmations and any file you attach to a trip. Map tiles and the app itself never count. You can see exactly what is using space in Settings.',
  'pricing.faq.export.q': 'Can I get my data out?',
  'pricing.faq.export.a':
    'Always. Every trip exports as a PDF itinerary and as a calendar file, and your places export as GeoJSON. It is your travel, not ours.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'No card, no expiry, no countdown',
  'pricing.card.yearlyPerSeat': '{amount} a year per member, billed once',
  'pricing.card.yearly': '{amount} billed once a year',
  'pricing.card.seatsUnlimited': 'Unlimited members',
  'pricing.card.tripsUnlimited': 'unlimited trips',
  'pricing.card.startFree': 'Start for free',
  'pricing.card.startTrial': 'Start the {plan} trial',
  'pricing.card.popular': 'Most popular',
  'pricing.card.noteYearly': 'Billed once a year. Two months on the house.',
  'pricing.card.noteMonthly':
    'Billed monthly. Change or cancel whenever you like.',
  'pricing.card.trial': {
    one: '{value}-day free trial, card up front, charged when it ends',
    other: '{value}-day free trial, card up front, charged when it ends',
  },
  'pricing.card.seatsUpTo': {
    one: 'Up to {value} member',
    other: 'Up to {value} members',
  },
  'pricing.card.trips': {
    one: '{value} trip at a time',
    other: '{value} trips at a time',
  },

  'pricing.feature.storage': '{size} for photos and documents',
  'pricing.feature.storageShared': '{size} shared for photos and documents',
  'pricing.feature.free.tripsDetail': 'Archive one to start another',
  'pricing.feature.solo.modules': 'Every planning module',
  'pricing.feature.solo.modulesDetail':
    'Reservations, journal, budgets, packing',
  'pricing.feature.crew.membersDetail': 'Billed per member, change any time',
  'pricing.feature.crew.realtimeDetail': 'Live cursors and instant sync',
  'pricing.feature.crew.supportDetail':
    'Answers from a person within one working day',

  'pricing.hero.eyebrow': 'Two trips free, forever',
  'pricing.hero.title': 'Plan it properly.',
  'pricing.hero.titleQuiet': 'Pay for what you use.',
  'pricing.hero.lede':
    'Plan two trips for nothing. Unlock every module for one traveller, or bring the whole crew along and edit the same itinerary at once.',
  'pricing.hero.taxNote':
    'Prices in US dollars, excluding sales tax or VAT. Polar is our merchant of record: it is the seller on your invoice, and it works out what your country charges, adds it at checkout and remits it. Cancel whenever you like, from inside the product.',
  'pricing.compare.eyebrow': 'Side by side',
  'pricing.compare.title': 'Every limit, compared',
  'pricing.compare.lede':
    'One table, generated from the same catalogue the billing system reads. If a row says a module is included, the entitlement check agrees with it.',
  'pricing.compare.caption':
    'Feature and limit comparison across all three plans',
  'pricing.compare.feature': 'Feature',
  'pricing.compare.limits': 'Limits',
  'pricing.compare.included': 'Included',
  'pricing.compare.notIncluded': 'Not included',
  'pricing.compare.includedIn': 'Included in {plan}',
  'pricing.compare.notIn': 'Not in {plan}',
  'pricing.questions.eyebrow': 'Before you ask',
  'pricing.questions.title': 'Questions, answered',
  'pricing.questions.lede':
    'Billing, trials and getting your data back out again.',
  'pricing.cta.secondary': 'See how it works',
  'pricing.module.itinerary': 'Day-by-day itinerary',
  'pricing.module.map': 'Interactive map',
  'pricing.module.budget': 'Budgets and expense splitting',
  'pricing.module.packing': 'Packing and to-do lists',
  'pricing.module.reservations': 'Reservations and bookings',
  'pricing.module.journal': 'Travel journal',
  'pricing.module.atlas': 'World-map tracker',
  'pricing.module.collaboration': 'Invite other travellers',
  'pricing.module.realtime': 'Live collaboration',
  'pricing.module.offlineMaps': 'Offline maps',
  'pricing.module.pdfExport': 'PDF and calendar export',
  'pricing.module.prioritySupport': 'Priority support',

  'anchor.plans': 'Plans',
  'anchor.compare': 'Compare',
  'anchor.questions': 'Questions',
  /* -------------------------------------------------------- the footer */
  /**
   * What the product is, in one sentence, for a reader who arrived at the
   * foot of the page. Not a claim — every noun in it is a shipped module.
   */
  'footer.blurb':
    'One place for the itinerary, the map, the bookings, the money and the packing list — shared with everyone who is coming.',
  /**
   * The attributions we are obliged to carry. The three proper nouns stay as
   * they are; the sentence around them is ordinary copy.
   */
  'footer.attribution':
    'Runs on Cloudflare Workers. Map data © OpenStreetMap contributors. Sold and invoiced by Polar, our merchant of record.',
  'footer.column.product': 'Product',
  'footer.column.account': 'Account',
  'footer.link.overview': 'Overview',
  'footer.link.everyModule': 'Every module',
  'footer.link.dayPlanner': 'Day planner',
  'footer.link.sharedCosts': 'Shared costs',
  'footer.link.reservations': 'Reservations',
  'footer.link.atlasJournal': 'Atlas and journal',
  'footer.link.createAccount': 'Create an account',
  'footer.link.terms': 'Terms of service',
  'footer.link.privacy': 'Privacy notice',
} as const satisfies NamespaceMessages

export default messages
