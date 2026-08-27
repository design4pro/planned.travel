/**
 * Notification dispatch — the composition layer between a write path and the inbox.
 *
 * `src/server/repos/notifications.ts` owns the rows; this module owns the decision of
 * *who* gets one. It contains no SQL: it resolves the recipient set from trip
 * membership under the caller's scope, drops the actor, de-duplicates, filters per
 * channel through the opt-out preference table, writes the in-app rows, and hands one
 * email envelope per recipient to the `TASKS` queue.
 *
 * Three properties are load-bearing and each has a test of its own:
 *
 * - **Authorisation is `requireTrip`, never `listTripMembers`.** `listTripMembers` is
 *   `findMany` under `tenantFilter`, so a trip id belonging to another organization
 *   returns `[]` rather than raising. Fanning out over that empty list would succeed
 *   silently and look exactly like a trip whose only member is the actor. So the trip
 *   is resolved first and the membership read only afterwards.
 * - **Recipients derive exclusively from `trip_members`.** No recipient list ever
 *   arrives from a browser. `notifications.recipient_user_id` carries no foreign key,
 *   so a user id from another tenant handed to `notifyMany` *would* be written — which
 *   is why this module, and not the repository, is the filtering chokepoint. If a guest
 *   representation ever lands, it is filtered here.
 * - **A dispatch failure never fails the save.** Callers use {@link dispatchQuietly},
 *   which swallows and logs exactly as `mirrorToRoom` does; inside `dispatch`, a queue
 *   that rejects is logged and the in-app rows still stand.
 *
 * Fan-out is bounded here rather than metered: notification rows are not a quota-bearing
 * resource, and the three member ceilings in the codebase disagree with each other, so
 * both writes chunk against the limit that half actually has. See {@link IN_APP_CHUNK_SIZE}
 * and {@link EMAIL_CHUNK_SIZE}.
 */

import { z } from 'zod'

import { DEFAULT_LOCALE } from '#/lib/i18n/locales'
import {
  createStoredTranslator,
  createTranslator,
  loadCatalogue,
} from '#/lib/i18n/catalogue'
import { negotiate } from '#/lib/i18n/negotiate'
import { AUDIT_ACTION_PATTERN } from '#/server/db/audit-action'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_SCOPES,
  NOTIFICATION_TYPES,
} from '#/server/db/schema'
import { createLogger, serializeError } from '#/server/observability'
import { enqueueTasks } from '#/server/queue/jobs'
import {
  filterEnabledRecipients,
  getOrganizationSettings,
  idSchema,
  listTripMembers,
  listUserProfiles,
  notifyMany,
  requireTrip,
  shortTextSchema,
} from '#/server/repos'

import type { Locale, MessageParams } from '#/lib/i18n'
import type { JsonRecord } from '#/server/db/schema'
import type { Logger } from '#/server/observability'
import type { EnqueueInput } from '#/server/queue/jobs'
import type { TaskKind, TaskQueue } from '#/server/queue/types'
import type { TenantScope } from '#/server/repos'

/* -------------------------------------------------------------------------------------------------
 * Bounds
 * ---------------------------------------------------------------------------------------------- */

/**
 * In-app recipients per `notifyMany` call.
 *
 * Mirrors the `z.array(idSchema).max(500)` in `src/server/repos/notifications.ts`, which is a
 * *rejecting* validator rather than a cap: a 501st recipient throws and writes no row at all.
 * Chunking turns it into a cap without editing it.
 */
export const IN_APP_CHUNK_SIZE = 500

/**
 * Email envelopes per `enqueueTasks` call.
 *
 * Derived, not chosen. A `sendBatch` array holds at most 100 messages *and* at most 256 KB in
 * total; {@link EMAIL_BODY_BYTE_CAP} keeps a rendered body under 8 KiB, which with the envelope's
 * own fields is under 9 KiB per message, and 256 KB ÷ 9 KiB ≈ 28. So the byte limit is the one
 * that binds, and 25 clears it with margin while clearing the message cap four times over.
 */
export const EMAIL_CHUNK_SIZE = 25

/**
 * User ids per `listUserProfiles` call — its own `z.array(idSchema).max(200)` rejects above this,
 * the same shape of validator {@link IN_APP_CHUNK_SIZE} chunks against.
 */
export const PROFILE_CHUNK_SIZE = 200

/**
 * The rendered body an email envelope carries — `html` and `text` together — is held under this
 * many bytes. It is the input to {@link EMAIL_CHUNK_SIZE}'s arithmetic, so the two move together:
 * raise this and the chunk size has to come down.
 */
export const EMAIL_BODY_BYTE_CAP = 8 * 1024

/**
 * Cloudflare's `sendBatch` payload ceiling, read decimally — the conservative of the two readings
 * of "256 KB", and 3% smaller than the binary one. Asserted by the fan-out test, never relied on.
 */
export const QUEUE_BATCH_BYTE_CAP = 256_000

/** Envelope ids are `z.string().max(128)` in `src/server/queue/types.ts`. */
const TASK_ID_MAX_LENGTH = 128

/** Provider-side analytics label. Fixed, because `tag` is `max(40)` and an event kind is not. */
const EMAIL_TAG = 'notification'

/** Channels this deployment has a transport for. `push` and `webhook` have neither provider nor binding. */
const SERVED_CHANNELS = new Set<NotificationChannel>(['in_app', 'email'])

type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

/* -------------------------------------------------------------------------------------------------
 * Input
 * ---------------------------------------------------------------------------------------------- */

const eventParamsSchema: z.ZodType<JsonRecord> = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
)

/**
 * What a write path hands to {@link dispatch}.
 *
 * It validates the *caller*, not the client: no recipient list is expressible here, so there is
 * nothing arriving from a browser to distrust. `notify()` re-validates the row shape on the way
 * into D1 and that redundancy is deliberate.
 *
 * `kind` is both the notification's translation key and the `eventType` the preference table is
 * keyed by, so opting out of `collab.message` opts out of exactly the events that carry it. Its
 * 40-character bound is the envelope-id budget: `notify:` + kind + entity id + recipient id has
 * to fit {@link TASK_ID_MAX_LENGTH}.
 */
export const notificationEventSchema = z.strictObject({
  kind: z
    .string()
    .trim()
    .min(1)
    .max(40, { error: 'An event kind must fit the queue envelope id.' })
    // The lowercase-dotted-key rule, imported rather than re-declared: `docs/ACCESS.md` §4.2 keeps
    // one spelling of that character class in the tree and a standing test fails a second one.
    .regex(AUDIT_ACTION_PATTERN, {
      error: 'An event kind is a lowercase dotted key, like `collab.message`.',
    }),
  tripId: idSchema,
  entityType: shortTextSchema.min(1),
  entityId: idSchema,
  /** Absent for a system event — a reminder sweep or a billing follow-up excludes nobody. */
  actorUserId: idSchema.optional(),
  type: z.enum(NOTIFICATION_TYPES).default('info'),
  scope: z.enum(NOTIFICATION_SCOPES).default('trip'),
  /** Both default to `kind`; the render layer strips a legacy `.title`/`.body` suffix either way. */
  titleKey: shortTextSchema.min(1).optional(),
  bodyKey: shortTextSchema.min(1).optional(),
  titleParams: eventParamsSchema.optional(),
  bodyParams: eventParamsSchema.optional(),
  actionUrl: shortTextSchema.min(1).optional(),
  /**
   * Narrows the membership-derived recipient set — the members an expense actually charged, say.
   * It is applied as an *intersection*, so it can only ever remove people: a user id that is not a
   * member of this trip in this organization is not reachable through it, which is what keeps
   * `trip_members` the sole source of recipients. Absent means "every member but the actor".
   */
  audienceUserIds: z.array(idSchema).max(500).optional(),
  /**
   * Channels to attempt. `in_app` is always attempted whether or not it is named: the row in the
   * inbox is the durable record, and a channel with no transport degrades to it.
   */
  channels: z
    .array(z.enum(NOTIFICATION_CHANNELS))
    .min(1)
    .default(['in_app', 'email']),
})

/** What a caller writes. The output type carries the defaults the schema fills in. */
export type NotificationEvent = z.input<typeof notificationEventSchema>

/* -------------------------------------------------------------------------------------------------
 * Ports and result
 * ---------------------------------------------------------------------------------------------- */

export interface DispatchDeps {
  /**
   * The `TASKS` queue. `null` disables the email half outright, which is what a runtime with no
   * binding — and every test that is not about email — passes.
   */
  readonly queue: TaskQueue | null
  readonly logger?: Logger
  /** Origin used to absolutise a relative `actionUrl` in the email. */
  readonly appUrl?: string
  readonly now?: () => number
}

export interface DispatchResult {
  /** Trip members who were eligible before per-channel filtering, actor already removed. */
  readonly recipients: ReadonlyArray<string>
  readonly inAppWritten: number
  readonly emailsEnqueued: number
  /** Channels the event asked for that this deployment cannot serve. */
  readonly unservedChannels: ReadonlyArray<NotificationChannel>
}

/** Memoised per isolate: the logger holds no request state. */
let fallbackLogger: Logger | undefined

function log(deps: DispatchDeps): Logger {
  if (deps.logger !== undefined) return deps.logger
  fallbackLogger ??= createLogger({ context: { component: 'notifications' } })
  return fallbackLogger
}

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------------- */

function chunk<T>(items: ReadonlyArray<T>, size: number): Array<Array<T>> {
  const out: Array<Array<T>> = []
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size))
  }
  return out
}

/**
 * The queue envelope id for one recipient.
 *
 * Deterministic and *per person*: a redelivery sends one message to one person. The obvious
 * alternative — one envelope carrying the whole recipient list, which `emailPayloadSchema.to`
 * would allow — is wrong twice over. `handleEmail` posts `to` as a single provider message, so
 * fifty travellers would each read the other forty-nine addresses; and its provider idempotency
 * key is built from `to.join(',')`, so adding one recipient changes the key and re-sends to
 * everybody already served.
 */
export function notificationTaskId(
  kind: string,
  entityId: string,
  recipientUserId: string,
): string {
  return `notify:${kind}:${entityId}:${recipientUserId}`
}

const encoder = new TextEncoder()

function byteLength(value: string): number {
  return encoder.encode(value).byteLength
}

/** Truncates to a byte budget without splitting a UTF-8 sequence. */
function truncateBytes(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return ''
  const encoded = encoder.encode(value)
  if (encoded.byteLength <= maxBytes) return value
  return new TextDecoder('utf-8', { fatal: false })
    .decode(encoded.slice(0, maxBytes))
    .replace(/�+$/u, '')
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Params reach the body verbatim — a trip title is user input and is escaped, never trusted. */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character] ?? character,
  )
}

/** Rows written before the `.title`/`.body` suffix was dropped still carry it. */
function eventOf(key: string): string {
  return key.replace(/\.(?:title|body)$/, '')
}

/**
 * The stored params record, in the shape the message layer wants.
 *
 * `null` and booleans are dropped rather than stringified: neither is a word in any language, and
 * a template that needed one would render with its token still visible. `count` and `days` also
 * select a CLDR plural branch, so they are carried as numbers.
 */
function messageParams(params: JsonRecord | undefined): MessageParams {
  const bag: Record<string, string | number> = {}
  let count: number | null = null
  for (const [name, value] of Object.entries(params ?? {})) {
    if (typeof value === 'number') {
      bag[name] = value
      if (name === 'count' || name === 'days') count = value
      continue
    }
    if (typeof value !== 'string' || value === '') continue
    bag[name] = value
  }
  return count === null ? bag : { ...bag, count }
}

/* -------------------------------------------------------------------------------------------------
 * Email rendering
 * ---------------------------------------------------------------------------------------------- */

/** Where the `shell` namespace keeps the stored notification templates. */
const STORED_PREFIX = 'shell.notification.'

interface RenderedNotification {
  readonly subject: string
  readonly html: string
  readonly text: string
}

/**
 * Renders one event into the message body the queue's `email` job expects.
 *
 * The sentences come out of the shipped catalogue rather than being written here, because copy is
 * never hardcoded (`docs/SPEC.md` §9) — the same `shell.notification.<kind>.title` / `.body` pair
 * the inbox renders. It is rendered once, in the *workspace's* language: resolving each
 * recipient's own override would be one settings read per person, and the per-recipient
 * preference matrix is `ACC-05`'s row, not this stage's.
 */
async function renderNotificationEmail(
  locale: Locale,
  event: z.output<typeof notificationEventSchema>,
  appUrl: string | undefined,
): Promise<RenderedNotification> {
  const catalogue = await loadCatalogue(locale)
  const tStored = createStoredTranslator(locale, catalogue)
  const t = createTranslator(locale, catalogue)

  // `interpolate` leaves an unknown token exactly as written, which is visible damage in a
  // sentence. A template with a hole in it degrades to the designed fallback instead.
  const resolve = (
    key: string,
    half: 'title' | 'body',
    params: MessageParams,
  ): string | null => {
    const rendered = tStored(`${STORED_PREFIX}${eventOf(key)}.${half}`, params)
    return rendered === null || rendered.includes('{') ? null : rendered
  }

  const titleParams = messageParams(event.titleParams ?? event.bodyParams)
  const bodyParams = messageParams(event.bodyParams ?? event.titleParams)
  const title =
    resolve(event.titleKey ?? event.kind, 'title', titleParams) ??
    t('shell.notification.fallback.title')
  const body =
    resolve(event.bodyKey ?? event.kind, 'body', bodyParams) ??
    t('shell.notification.fallback.body')

  const href = absoluteUrl(event.actionUrl, appUrl)
  return { subject: title.slice(0, 200), ...fitBody(title, body, href) }
}

/**
 * The two representations of one notification, shrunk until they fit {@link EMAIL_BODY_BYTE_CAP}
 * together.
 *
 * The budget is on the pair rather than on each, because the queue's 256 KB `sendBatch` ceiling is
 * charged the whole serialised message. Only the body sentence is shortened — a truncated subject
 * line reads as a bug, a truncated preview reads as a preview.
 */
function fitBody(
  title: string,
  body: string,
  href: string | null,
): { readonly html: string; readonly text: string } {
  const link =
    href === null
      ? ''
      : `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`
  const tail = href === null ? '' : `\n\n${href}`

  let candidate = body
  for (let attempt = 0; ; attempt += 1) {
    const html = `<p>${escapeHtml(title)}</p><p>${escapeHtml(candidate)}</p>${link}`
    const text = `${title}\n\n${candidate}${tail}`
    const size = byteLength(html) + byteLength(text)
    if (size <= EMAIL_BODY_BYTE_CAP || candidate === '') {
      return { html, text }
    }
    // Shrink in proportion to the overshoot rather than by the overshoot itself: the sentence is
    // charged twice, once escaped into the HTML and once raw in the plain text, and escaping turns
    // one `&` into five bytes on the first of those. A proportional step converges in two passes
    // where subtracting the overshoot would undershoot to nothing.
    const room =
      Math.floor(byteLength(candidate) * (EMAIL_BODY_BYTE_CAP / size)) - 16
    // The last pass drops the sentence outright rather than looping forever: the title and the
    // link are bounded, so an empty body always fits.
    candidate = attempt >= 8 ? '' : truncateBytes(candidate, room)
  }
}

function absoluteUrl(
  actionUrl: string | undefined,
  appUrl: string | undefined,
): string | null {
  if (actionUrl === undefined) return null
  if (/^https?:\/\//i.test(actionUrl)) return actionUrl
  if (appUrl === undefined) return null
  return `${appUrl.replace(/\/+$/, '')}/${actionUrl.replace(/^\/+/, '')}`
}

/* -------------------------------------------------------------------------------------------------
 * Dispatch
 * ---------------------------------------------------------------------------------------------- */

/** Profiles for a recipient set, chunked against `listUserProfiles`' own `max(200)`. */
async function emailsFor(
  scope: TenantScope,
  userIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const byUser = new Map<string, string>()
  for (const batch of chunk(userIds, PROFILE_CHUNK_SIZE)) {
    for (const profile of await listUserProfiles(scope, batch)) {
      if (profile.email !== '') byUser.set(profile.userId, profile.email)
    }
  }
  return byUser
}

/**
 * Fills in `actorName` when the caller left it out.
 *
 * Almost every template in the `shell.notification.*` family opens with `{actorName}`, and the
 * name is a profile read the call sites would otherwise each have to make *before* handing over —
 * outside the try/catch that keeps a notification failure from failing the save. Resolving it here
 * puts that read inside the isolated region and keeps the two write paths to one call each. A
 * caller that supplies the name pays nothing.
 */
async function withActorName(
  scope: TenantScope,
  event: z.output<typeof notificationEventSchema>,
): Promise<z.output<typeof notificationEventSchema>> {
  const actorUserId = event.actorUserId
  if (actorUserId === undefined) return event
  const supplied =
    event.titleParams?.actorName !== undefined ||
    event.bodyParams?.actorName !== undefined
  if (supplied) return event

  const actor = (await listUserProfiles(scope, [actorUserId])).at(0)
  if (actor === undefined) return event
  return {
    ...event,
    titleParams: { ...event.titleParams, actorName: actor.name },
    bodyParams: { ...event.bodyParams, actorName: actor.name },
  }
}

/** The workspace's language — the one language dispatch can know without a read per recipient. */
async function workspaceLocale(scope: TenantScope): Promise<Locale> {
  const settings = await getOrganizationSettings(scope)
  return settings === null
    ? DEFAULT_LOCALE
    : negotiate({ workspace: settings.locale })
}

async function writeInApp(
  scope: TenantScope,
  event: z.output<typeof notificationEventSchema>,
  recipients: ReadonlyArray<string>,
): Promise<number> {
  let written = 0
  for (const batch of chunk(recipients, IN_APP_CHUNK_SIZE)) {
    const rows = await notifyMany(scope, batch, {
      type: event.type,
      scope: event.scope,
      entityType: event.entityType,
      entityId: event.entityId,
      titleKey: event.titleKey ?? event.kind,
      titleParams: event.titleParams ?? null,
      bodyKey: event.bodyKey ?? event.kind,
      bodyParams: event.bodyParams ?? null,
      actionUrl: event.actionUrl ?? null,
    })
    written += rows.length
  }
  return written
}

async function enqueueEmails(
  scope: TenantScope,
  event: z.output<typeof notificationEventSchema>,
  recipients: ReadonlyArray<string>,
  deps: DispatchDeps,
): Promise<number> {
  const queue = deps.queue
  if (queue === null || recipients.length === 0) return 0

  const addresses = await emailsFor(scope, recipients)
  const rendered = await renderNotificationEmail(
    await workspaceLocale(scope),
    event,
    deps.appUrl,
  )

  const inputs: Array<EnqueueInput<TaskKind>> = []
  let unaddressable = 0
  for (const recipientUserId of recipients) {
    const to = addresses.get(recipientUserId)
    const id = notificationTaskId(event.kind, event.entityId, recipientUserId)
    // No address, or three ids that together outgrow the envelope's own `max(128)`. Both leave the
    // in-app row standing, and neither is silent: an envelope the queue would reject is worse than
    // a counted omission.
    if (to === undefined || id.length > TASK_ID_MAX_LENGTH) {
      unaddressable += 1
      continue
    }
    inputs.push({
      kind: 'email',
      orgId: scope.ctx.organizationId,
      id,
      payload: {
        to: [to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tag: EMAIL_TAG,
      },
    })
  }

  if (unaddressable > 0) {
    log(deps).info('notification recipients had no reachable email envelope', {
      kind: event.kind,
      organizationId: scope.ctx.organizationId,
      unaddressable,
    })
  }

  let enqueued = 0
  for (const batch of chunk(inputs, EMAIL_CHUNK_SIZE)) {
    await enqueueTasks(queue, batch, deps.now)
    enqueued += batch.length
  }
  return enqueued
}

/**
 * Fans one event out to the trip's other members.
 *
 * Throws only for an unresolvable trip — the authorisation failure a caller must not swallow
 * silently in a test. A queue that rejects is logged and the in-app rows still stand, and
 * {@link dispatchQuietly} is what production write paths call.
 */
export async function dispatch(
  scope: TenantScope,
  input: NotificationEvent,
  deps: DispatchDeps,
): Promise<DispatchResult> {
  const event = notificationEventSchema.parse(input)

  // Authorisation. `listTripMembers` returns `[]` for a foreign trip and must never be the check.
  await requireTrip(scope, event.tripId)

  const members = await listTripMembers(scope, event.tripId)
  const audience =
    event.audienceUserIds === undefined ? null : new Set(event.audienceUserIds)
  const recipients = [...new Set(members.map((row) => row.userId))].filter(
    (userId) =>
      userId !== event.actorUserId &&
      (audience === null || audience.has(userId)),
  )

  const requested = new Set<NotificationChannel>(event.channels)
  const unservedChannels = [...requested].filter(
    (channel) => !SERVED_CHANNELS.has(channel),
  )
  if (unservedChannels.length > 0) {
    // One line, not one per recipient: the in-app row below is what the reader actually gets.
    log(deps).info('notification channel has no transport', {
      kind: event.kind,
      organizationId: scope.ctx.organizationId,
      channels: unservedChannels,
      recipients: recipients.length,
    })
  }

  if (recipients.length === 0) {
    return { recipients, inAppWritten: 0, emailsEnqueued: 0, unservedChannels }
  }

  const named = await withActorName(scope, event)

  const inAppRecipients = await filterEnabledRecipients(
    scope,
    recipients,
    event.kind,
    'in_app',
  )
  const inAppWritten = await writeInApp(scope, named, inAppRecipients)

  let emailsEnqueued = 0
  if (requested.has('email')) {
    try {
      const emailRecipients = await filterEnabledRecipients(
        scope,
        recipients,
        event.kind,
        'email',
      )
      emailsEnqueued = await enqueueEmails(scope, named, emailRecipients, deps)
    } catch (cause) {
      // D1 already holds the inbox rows. A queue that cannot take the letter must not undo them.
      log(deps).warn('notification email hand-off failed', {
        kind: event.kind,
        organizationId: scope.ctx.organizationId,
        recipients: recipients.length,
        ...serializeError(cause),
      })
    }
  }

  return { recipients, inAppWritten, emailsEnqueued, unservedChannels }
}

/**
 * {@link dispatch}, with every failure logged and swallowed.
 *
 * The shape `mirrorToRoom` established: D1 is the durable record and has already been written by
 * the time this runs, so a notification that cannot be delivered must never turn a successful save
 * into a failed one. Returns `null` when it swallowed something.
 */
export async function dispatchQuietly(
  scope: TenantScope,
  input: NotificationEvent,
  deps: DispatchDeps,
): Promise<DispatchResult | null> {
  try {
    return await dispatch(scope, input, deps)
  } catch (cause) {
    log(deps).warn('notification dispatch failed', {
      kind: typeof input.kind === 'string' ? input.kind : 'unknown',
      organizationId: scope.ctx.organizationId,
      ...serializeError(cause),
    })
    return null
  }
}
