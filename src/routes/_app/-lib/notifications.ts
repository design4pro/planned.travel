/**
 * Notification copy.
 *
 * The `notifications` table stores a message *key* plus its parameters rather
 * than a rendered sentence, so the same row can be re-read in any language and
 * so a template can be corrected after the fact. This module is the English
 * rendering of those keys, and the switchboard the preferences screen draws.
 */

import type { JsonRecord } from '#/server/db/schema'

export interface NotificationCopy {
  readonly title: string
  readonly body: string
}

/**
 * `{token}` placeholders are filled from the row's params. A template is only
 * used when every one of its placeholders is present, so a half-populated row
 * degrades to a plain readable heading instead of a sentence with a hole in it.
 */
const CATALOGUE: Record<string, NotificationCopy | undefined> = {
  'trip.invited': {
    title: 'You were invited to {tripTitle}',
    body: '{actorName} added you to the trip.',
  },
  'trip.updated': {
    title: '{tripTitle} was updated',
    body: '{actorName} changed the plan.',
  },
  'trip.member_added': {
    title: '{memberName} joined {tripTitle}',
    body: 'They can see the itinerary, the bookings and the money.',
  },
  'trip.member_removed': {
    title: '{memberName} left {tripTitle}',
    body: 'Their access to the trip has ended.',
  },
  'trip.starting_soon': {
    title: '{tripTitle} starts in {days} days',
    body: 'Time to check the packing list and the bookings.',
  },
  'reservation.reminder': {
    title: '{title} is coming up',
    body: '{when} — the confirmation is on the booking.',
  },
  'reservation.confirmed': {
    title: '{title} is confirmed',
    body: 'The booking has been marked confirmed on {tripTitle}.',
  },
  'expense.added': {
    title: '{actorName} added an expense',
    body: '{title} on {tripTitle}.',
  },
  'expense.settled': {
    title: '{actorName} settled up',
    body: 'The balance on {tripTitle} has been paid.',
  },
  'list.assigned': {
    title: '{actorName} assigned you an item',
    body: '{title} on {tripTitle}.',
  },
  'collab.message': {
    title: '{actorName} wrote in {tripTitle}',
    body: '{preview}',
  },
  'collab.poll': {
    title: 'A poll is open on {tripTitle}',
    body: '{question}',
  },
  'organization.invited': {
    title: 'You were invited to {organizationName}',
    body: 'Accept to join the workspace and everything shared in it.',
  },
  'journey.published': {
    title: '{title} was published',
    body: 'Anyone with the link can now read the journey.',
  },
  'billing.plan_changed': {
    title: 'Your plan changed',
    body: '{organizationName} is now on the {plan} plan.',
  },
}

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g

/** Strips the `.title` / `.body` suffix a stored key carries. */
function eventKeyOf(key: string): string {
  return key.replace(/\.(title|body)$/, '')
}

/** `trip.starting_soon.title` → `Trip starting soon`. */
export function humaniseKey(key: string): string {
  const words = eventKeyOf(key)
    .replace(/[._-]+/g, ' ')
    .trim()
  if (words.length === 0) {
    return key
  }
  return words.slice(0, 1).toUpperCase() + words.slice(1)
}

/** Fills a template, or returns `null` when a placeholder has no value. */
function interpolate(
  template: string,
  params: JsonRecord | null,
): string | null {
  const resolved = new Map<string, string>()

  for (const match of template.matchAll(PLACEHOLDER)) {
    const token = match[1]
    const value = params?.[token]
    if (value === undefined || value === null || value === '') {
      return null
    }
    resolved.set(token, String(value))
  }

  return template.replace(
    PLACEHOLDER,
    (_match, token: string) => resolved.get(token) ?? '',
  )
}

export interface RenderedNotification {
  readonly title: string
  readonly body: string | null
}

/** The sentence a person actually reads in the inbox. */
export function renderNotification(input: {
  readonly titleKey: string
  readonly titleParams: JsonRecord | null
  readonly bodyKey: string
  readonly bodyParams: JsonRecord | null
}): RenderedNotification {
  const copy = CATALOGUE[eventKeyOf(input.titleKey)]

  const title =
    copy === undefined
      ? null
      : interpolate(copy.title, input.titleParams ?? input.bodyParams)
  const body =
    copy === undefined
      ? null
      : interpolate(copy.body, input.bodyParams ?? input.titleParams)

  return {
    title: title ?? humaniseKey(input.titleKey),
    body:
      body ??
      (input.bodyKey === input.titleKey ? null : humaniseKey(input.bodyKey)),
  }
}

/* ------------------------------------------------------------- preferences */

export interface NotificationEvent {
  readonly eventType: string
  readonly label: string
  readonly description: string
}

/** The switches the preferences screen offers, grouped by what they are about. */
export const NOTIFICATION_EVENTS: ReadonlyArray<NotificationEvent> = [
  {
    eventType: 'trip.invited',
    label: 'Trip invitations',
    description: 'Someone adds you to a trip they are planning.',
  },
  {
    eventType: 'trip.updated',
    label: 'Plan changes',
    description: 'A day, a stop or a date moves on a trip you are on.',
  },
  {
    eventType: 'trip.starting_soon',
    label: 'Departure reminders',
    description: 'A nudge in the days before a trip begins.',
  },
  {
    eventType: 'reservation.reminder',
    label: 'Booking reminders',
    description: 'A stay, a table or a ticket is coming up.',
  },
  {
    eventType: 'expense.added',
    label: 'New expenses',
    description: 'Someone logs money spent on a shared trip.',
  },
  {
    eventType: 'expense.settled',
    label: 'Settled balances',
    description: 'A balance you were part of has been paid.',
  },
  {
    eventType: 'list.assigned',
    label: 'Assigned items',
    description: 'Something on a packing or to-do list becomes yours.',
  },
  {
    eventType: 'collab.message',
    label: 'Trip conversation',
    description: 'New messages in a trip you are travelling on.',
  },
  {
    eventType: 'organization.invited',
    label: 'Workspace invitations',
    description: 'You are invited into a workspace.',
  },
]

/** Channel labels, in the order they are offered. */
export const CHANNEL_LABELS: ReadonlyArray<{
  readonly channel: 'in_app' | 'email' | 'push'
  readonly label: string
  readonly hint: string
}> = [
  { channel: 'in_app', label: 'In app', hint: 'The bell in the top bar' },
  { channel: 'email', label: 'Email', hint: 'Sent to your sign-in address' },
  { channel: 'push', label: 'Push', hint: 'On devices where you allowed it' },
]
