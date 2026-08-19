/**
 * Notifications — the in-app inbox, plus the per-channel preferences that decide whether an event
 * also goes out by email, push or webhook.
 *
 * Copy is stored as i18n **keys plus params**, never as rendered sentences, so a notification written
 * a year ago still renders in the reader's current language.
 */

import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_RESPONSES,
  NOTIFICATION_SCOPES,
  NOTIFICATION_TYPES,
  notificationPreferences,
  notifications,
} from '#/server/db/schema'
import { allOf, createTenantRepository, tenantFilter } from './base'
import { definedOnly, idSchema, shortTextSchema } from './validation'
import type { JsonRecord } from '#/server/db/schema'
import type { Notification, NotificationPreference } from '#/server/db/types'
import type { CursorPage, TenantScope } from './base'

export const notificationsRepository = createTenantRepository(notifications, 'notification')
export const notificationPreferencesRepository = createTenantRepository(
  notificationPreferences,
  'notification preference',
)

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const jsonRecordSchema: z.ZodType<JsonRecord> = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
)

export const notifyInput = z.object({
  recipientUserId: idSchema,
  type: z.enum(NOTIFICATION_TYPES).optional(),
  scope: z.enum(NOTIFICATION_SCOPES).optional(),
  entityType: shortTextSchema.nullish(),
  entityId: idSchema.nullish(),
  titleKey: shortTextSchema.min(1),
  titleParams: jsonRecordSchema.nullish(),
  bodyKey: shortTextSchema.min(1),
  bodyParams: jsonRecordSchema.nullish(),
  actionUrl: shortTextSchema.nullish(),
})
export type NotifyInput = z.infer<typeof notifyInput>

export const setPreferenceInput = z.object({
  userId: idSchema.optional(),
  eventType: shortTextSchema.min(1),
  channel: z.enum(NOTIFICATION_CHANNELS),
  isEnabled: z.boolean(),
})
export type SetPreferenceInput = z.infer<typeof setPreferenceInput>

/* -------------------------------------------------------------------------------------------------
 * Inbox
 * ---------------------------------------------------------------------------------------------- */

/** A page of one traveller's inbox, newest first. */
export async function listNotifications(
  scope: TenantScope,
  userId: string,
  options: {
    readonly unreadOnly?: boolean
    readonly limit?: number
    readonly cursor?: string | null
  } = {},
): Promise<CursorPage<Notification>> {
  return notificationsRepository.page(scope, {
    where:
      options.unreadOnly === true
        ? allOf(eq(notifications.recipientUserId, userId), eq(notifications.isRead, false))
        : eq(notifications.recipientUserId, userId),
    limit: options.limit,
    cursor: options.cursor,
  })
}

export async function countUnread(scope: TenantScope, userId: string): Promise<number> {
  return notificationsRepository.count(
    scope,
    allOf(eq(notifications.recipientUserId, userId), eq(notifications.isRead, false)),
  )
}

/** Unread counts grouped by scope — the badge split between trip and workspace news. */
export async function countUnreadByScope(
  scope: TenantScope,
  userId: string,
): Promise<Array<{ readonly scope: string; readonly value: number }>> {
  const rows = await scope.db
    .select({ scope: notifications.scope, value: count() })
    .from(notifications)
    .where(
      tenantFilter(
        scope,
        notifications,
        eq(notifications.recipientUserId, userId),
        eq(notifications.isRead, false),
      ),
    )
    .groupBy(notifications.scope)
    .orderBy(desc(count()))
  return rows
}

/** Notifications still waiting for an accept/decline — trip and workspace invitations. */
export async function listActionable(
  scope: TenantScope,
  userId: string,
): Promise<Array<Notification>> {
  return notificationsRepository.findMany(scope, {
    where: and(
      eq(notifications.recipientUserId, userId),
      eq(notifications.type, 'action'),
      isNull(notifications.response),
    ),
    orderBy: [desc(notifications.createdAt)],
  })
}

export async function notify(scope: TenantScope, input: NotifyInput): Promise<Notification> {
  const values = notifyInput.parse(input)
  return notificationsRepository.insert(scope, { ...values, senderUserId: scope.ctx.userId })
}

/** Fans one event out to several recipients as a single insert. */
export async function notifyMany(
  scope: TenantScope,
  recipients: ReadonlyArray<string>,
  input: Omit<NotifyInput, 'recipientUserId'>,
): Promise<Array<Notification>> {
  const unique = [...new Set(z.array(idSchema).max(500).parse([...recipients]))]
  if (unique.length === 0) {
    return []
  }
  return notificationsRepository.insertMany(
    scope,
    unique.map((recipientUserId) => ({
      ...notifyInput.parse({ ...input, recipientUserId }),
      senderUserId: scope.ctx.userId,
    })),
  )
}

export async function markRead(
  scope: TenantScope,
  notificationId: string,
): Promise<Notification> {
  return notificationsRepository.requireUpdate(scope, notificationId, {
    isRead: true,
    readAt: new Date(),
  })
}

export async function markUnread(
  scope: TenantScope,
  notificationId: string,
): Promise<Notification> {
  return notificationsRepository.requireUpdate(scope, notificationId, {
    isRead: false,
    readAt: null,
  })
}

/** Marks a traveller's whole inbox read. Returns how many rows changed. */
export async function markAllRead(scope: TenantScope, userId: string): Promise<number> {
  const rows = await notificationsRepository.updateWhere(
    scope,
    allOf(eq(notifications.recipientUserId, userId), eq(notifications.isRead, false)),
    { isRead: true, readAt: new Date() },
  )
  return rows.length
}

/** Records an accept/decline on an actionable notification and marks it read. */
export async function respondToNotification(
  scope: TenantScope,
  notificationId: string,
  response: (typeof NOTIFICATION_RESPONSES)[number],
): Promise<Notification> {
  return notificationsRepository.requireUpdate(scope, notificationId, {
    response: z.enum(NOTIFICATION_RESPONSES).parse(response),
    respondedAt: new Date(),
    isRead: true,
    readAt: new Date(),
  })
}

export async function deleteNotification(
  scope: TenantScope,
  notificationId: string,
): Promise<void> {
  await notificationsRepository.requireRemove(scope, notificationId)
}

/** Clears read notifications for a traveller — the "clear all" action. */
export async function clearReadNotifications(
  scope: TenantScope,
  userId: string,
): Promise<number> {
  return notificationsRepository.removeWhere(
    scope,
    allOf(eq(notifications.recipientUserId, userId), eq(notifications.isRead, true)),
  )
}

/** Notifications about one entity — used to fold duplicates before sending a new one. */
export async function listForEntity(
  scope: TenantScope,
  entityType: string,
  entityId: string,
): Promise<Array<Notification>> {
  return notificationsRepository.findMany(scope, {
    where: and(
      eq(notifications.entityType, shortTextSchema.min(1).parse(entityType)),
      eq(notifications.entityId, idSchema.parse(entityId)),
    ),
    orderBy: [desc(notifications.createdAt)],
  })
}

/* -------------------------------------------------------------------------------------------------
 * Preferences
 * ---------------------------------------------------------------------------------------------- */

export async function listPreferences(
  scope: TenantScope,
  userId: string,
): Promise<Array<NotificationPreference>> {
  return notificationPreferencesRepository.findMany(scope, {
    where: eq(notificationPreferences.userId, userId),
    orderBy: [asc(notificationPreferences.eventType), asc(notificationPreferences.channel)],
  })
}

/** Sets one event/channel switch, creating the row on first use. */
export async function setPreference(
  scope: TenantScope,
  input: SetPreferenceInput,
): Promise<NotificationPreference> {
  const values = setPreferenceInput.parse(input)
  const userId = values.userId ?? scope.ctx.userId

  const existing = await notificationPreferencesRepository.findOne(
    scope,
    allOf(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.eventType, values.eventType),
      eq(notificationPreferences.channel, values.channel),
    ),
  )

  if (existing) {
    return notificationPreferencesRepository.requireUpdate(
      scope,
      existing.id,
      definedOnly({ isEnabled: values.isEnabled }),
    )
  }

  return notificationPreferencesRepository.insert(scope, {
    userId,
    eventType: values.eventType,
    channel: values.channel,
    isEnabled: values.isEnabled,
  })
}

/**
 * Whether an event may go out on a channel. Absence of a row means "yes": travellers opt out, never
 * in, so a new event type reaches people without a migration.
 */
export async function isChannelEnabled(
  scope: TenantScope,
  userId: string,
  eventType: string,
  channel: (typeof NOTIFICATION_CHANNELS)[number],
): Promise<boolean> {
  const row = await notificationPreferencesRepository.findOne(
    scope,
    allOf(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.eventType, eventType),
      eq(notificationPreferences.channel, channel),
    ),
  )
  return row?.isEnabled ?? true
}

/** Recipients of `userIds` who still accept `eventType` on `channel`. */
export async function filterEnabledRecipients(
  scope: TenantScope,
  userIds: ReadonlyArray<string>,
  eventType: string,
  channel: (typeof NOTIFICATION_CHANNELS)[number],
): Promise<Array<string>> {
  if (userIds.length === 0) {
    return []
  }
  const rows = await notificationPreferencesRepository.findMany(scope, {
    where: allOf(
      inArray(notificationPreferences.userId, [...userIds]),
      eq(notificationPreferences.eventType, eventType),
      eq(notificationPreferences.channel, channel),
      eq(notificationPreferences.isEnabled, false),
    ),
  })
  const optedOut = new Set(rows.map((row) => row.userId))
  return userIds.filter((userId) => !optedOut.has(userId))
}
