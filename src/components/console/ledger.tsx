/**
 * How `platform_audit_log` reads on a screen.
 *
 * `docs/ACCESS.md` §4.4 is the reason that table exists rather than a per-entity revision log: the
 * account screen renders the timeline from it directly, by `(entity_type, entity_id)` on a single
 * index. This module is that rendering's vocabulary — what each action is called, how loud it is,
 * who the actor was, and what a `changes` payload says in words.
 *
 * **Colour discipline, restated because it is easy to lose on a timeline.** `--color-danger` is
 * spent on ban, revoke and delete and on nothing else, so a suspension and a session purge are the
 * only red rows here. Impersonation is `warning`: not destructive, but the one line an auditor came
 * looking for. Everything else is neutral, because a timeline where every row is coloured is a
 * timeline with no colour in it.
 *
 * **A rendered diff, never a payload dump.** The reference screen's nearest equivalent prints a
 * change blob into a table cell raw, where it wraps mid-token and reads as debug output. Every entry
 * here is a sentence with a before/after pair beneath it, and a field the table cannot name is
 * printed as it was stored rather than swallowed.
 */

import { Badge } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'
import { DEFAULT_LOCALE } from '#/lib/i18n/locales'
import { formatConsoleInstant } from './instant'

import type { Locale, MessageKey, Translate } from '#/lib/i18n'

/**
 * What each platform action is called.
 *
 * The keys are `PLATFORM_AUDIT_ACTIONS` from `src/server/db/schema.ts`, and only the thirteen that can
 * name an account as their entity are here: the sixteen catalogue actions belong to screens that
 * land in Faza C and the two `platform.token.*` names to one that lands in Faza E.
 */
const ACTION_KEYS: Readonly<Record<string, MessageKey | undefined>> = {
  'platform.user.created': 'console.audit.action.created',
  'platform.user.updated': 'console.audit.action.updated',
  'platform.user.role_changed': 'console.audit.action.roleChanged',
  'platform.user.banned': 'console.audit.action.banned',
  'platform.user.unbanned': 'console.audit.action.unbanned',
  'platform.user.deleted': 'console.audit.action.deleted',
  'platform.user.password_set': 'console.audit.action.passwordSet',
  'platform.user.email_set': 'console.audit.action.emailSet',
  'platform.user.impersonation_started':
    'console.audit.action.impersonationStarted',
  'platform.user.impersonation_ended':
    'console.audit.action.impersonationEnded',
  'platform.user.impersonation_workspace_changed':
    'console.audit.action.impersonationWorkspaceChanged',
  'platform.session.revoked': 'console.audit.action.sessionRevoked',
  'platform.session.revoked_all': 'console.audit.action.sessionRevokedAll',
}

const ACTION_TONES: Readonly<Record<string, 'danger' | 'warning'>> = {
  'platform.user.banned': 'danger',
  'platform.user.deleted': 'danger',
  'platform.session.revoked': 'danger',
  'platform.session.revoked_all': 'danger',
  'platform.user.impersonation_started': 'warning',
  'platform.user.impersonation_ended': 'warning',
  'platform.user.impersonation_workspace_changed': 'warning',
}

export type AuditTone = 'danger' | 'warning' | 'neutral'

/** The sentence an audit row is titled with. An unknown action prints verbatim. */
export function describePlatformAction(t: Translate, action: string): string {
  const key = ACTION_KEYS[action]
  return key === undefined ? action : t(key)
}

/** How loudly a row reads — see the note on colour at the top of this file. */
export function platformActionTone(action: string): AuditTone {
  return ACTION_TONES[action] ?? 'neutral'
}

/**
 * Who acted, in the reader's words rather than the column's.
 *
 * `system` is a real actor in this ledger and not an absence: `docs/ACCESS.md` §4.3 writes a row
 * under it when a temporary ban lifts itself on the next sign-in, with no operator anywhere near it.
 * An em dash there would read as a missing name rather than as the platform's own hand.
 */
export function describeAuditActor(
  t: Translate,
  kind: string,
  name: string | null,
): { readonly name: string; readonly detail: string | null } {
  if (kind === 'system') {
    return {
      name: t('console.audit.actor.system'),
      detail: t('console.audit.actor.system.detail'),
    }
  }
  if (kind === 'agent') {
    return {
      name: name ?? t('console.audit.actor.agent'),
      detail: t('console.audit.actor.agent.detail'),
    }
  }
  return { name: name ?? t('console.audit.actor.deleted'), detail: null }
}

/**
 * The fields a platform action's `changes` payload can move, named the way the screens name them.
 *
 * The first seven are `auditUserState`'s fixed key set. The rest are what the impersonation and
 * session verbs record (`organizationId` is the workspace id a switch inside an impersonated session moves), and they are here because an unlabelled key is printed as the column stored
 * it — `EXPIRESAT` in tracked capitals, which is a variable name where a reader expected English.
 */
const FIELD_KEYS: Readonly<Record<string, MessageKey | undefined>> = {
  name: 'console.audit.field.name',
  email: 'console.audit.field.email',
  emailVerified: 'console.audit.field.emailVerified',
  role: 'console.audit.field.role',
  banned: 'console.audit.field.banned',
  banReason: 'console.audit.field.banReason',
  banExpiresAt: 'console.audit.field.banExpiresAt',
  revoked: 'console.audit.field.revoked',
  impersonating: 'console.audit.field.impersonating',
  impersonatedBy: 'console.audit.field.impersonatedBy',
  expiresAt: 'console.audit.field.expiresAt',
  targetRole: 'console.audit.field.targetRole',
  sessionId: 'console.audit.field.sessionId',
  organizationId: 'console.audit.field.organizationId',
}

/** A ledger field's label. An unknown key is printed as it was stored. */
export function describeAuditField(t: Translate, field: string): string {
  const key = FIELD_KEYS[field]
  return key === undefined ? field : t(key)
}

const DOT_TONES: Readonly<Record<AuditTone, string>> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  neutral: 'bg-ink-4',
}

export interface AuditDotProps {
  readonly tone: AuditTone
  readonly className?: string
}

/**
 * The marker on the timeline's rail.
 *
 * A ring in the card's own surface colour, so the rail appears to pass behind the dot rather than
 * stopping at it — which is what makes a column of dots read as one thread instead of as bullets.
 */
export function AuditDot({ tone, className }: AuditDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-surface',
        DOT_TONES[tone],
        className,
      )}
    />
  )
}

/** One field a platform action moved, both sides, rendered. */
export interface AuditChange {
  readonly field: string
  readonly before: string
  readonly after: string
}

/** Ordered so a diff reads the way the account screen's own panels do. */
const FIELD_ORDER: ReadonlyArray<string> = [
  'name',
  'email',
  'emailVerified',
  'role',
  'banned',
  'banReason',
  'banExpiresAt',
]

/** The stamp `auditUserState` and the impersonation verbs write: a full ISO-8601 instant. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/**
 * Everything a ledger value can be, as one short string. Never a raw JSON dump in a table cell.
 *
 * An instant is put through the console's own formatter rather than printed as it was stored.
 * `2026-08-25T13:44:25.400Z` in a sentence about a suspension expiring is a serialisation, and the
 * date beside it in the same panel is already `25 Aug 2026, 13:44 UTC`; two spellings of the same
 * kind of thing on one screen is how a reader stops trusting either.
 */
function renderValue(t: Translate, value: unknown, locale: Locale): string {
  if (value === null || value === undefined) return EMPTY
  if (typeof value === 'boolean') {
    return value ? t('console.audit.value.yes') : t('console.audit.value.no')
  }
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (value.length === 0) return EMPTY
    return ISO_INSTANT.test(value) ? formatConsoleInstant(value, locale) : value
  }
  return JSON.stringify(value)
}

/** The one string that means "there was nothing here", shared by the reader and the renderer. */
const EMPTY = '—'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * The fields one action moved, and only those.
 *
 * Both sides of a `platform.user.*` entry carry the same key set (`auditUserState` on the server), so
 * a key whose two values match did not move and is dropped — a diff that lists seven unchanged
 * fields beside the one that changed is a raw payload with extra steps.
 *
 * Takes `unknown` because that is what a `text({ mode: 'json' })` column honestly is. A payload that
 * is not an object, or carries neither side, produces no rows rather than an exception: the ledger is
 * append-only and four hundred days deep, so a row written by an older shape of the code has to
 * render as *something*, and "this action moved nothing we can name" is the truthful something.
 */
export function auditChanges(
  t: Translate,
  payload: unknown,
  locale: Locale = DEFAULT_LOCALE,
): ReadonlyArray<AuditChange> {
  if (typeof payload !== 'object' || payload === null) return []
  const { before, after } = payload as { before?: unknown; after?: unknown }
  const left = asRecord(before)
  const right = asRecord(after)

  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort(
    (a, b) => {
      const rankA = FIELD_ORDER.indexOf(a)
      const rankB = FIELD_ORDER.indexOf(b)
      if (rankA === rankB) return a.localeCompare(b)
      if (rankA < 0) return 1
      if (rankB < 0) return -1
      return rankA - rankB
    },
  )

  const changes: Array<AuditChange> = []
  for (const key of keys) {
    const from = renderValue(t, left[key], locale)
    const to = renderValue(t, right[key], locale)
    if (from === to) continue
    changes.push({ field: key, before: from, after: to })
  }
  return changes
}

export interface AuditChangeListProps {
  /** The `changes` column, verbatim — {@link auditChanges} does the reading. */
  readonly payload: unknown
  readonly className?: string
}

/**
 * The before/after pairs one action moved.
 *
 * A definition list rather than a table: there are at most seven pairs, they are read one at a time,
 * and a two-column table at 360px would put four characters in each cell.
 */
export function AuditChangeList({ payload, className }: AuditChangeListProps) {
  const t = useTranslate()
  const locale = useLocale()
  const changes = auditChanges(t, payload, locale)
  if (changes.length === 0) {
    return null
  }
  return (
    <dl className={cn('flex flex-col gap-1.5', className)}>
      {changes.map((change) => (
        <div
          key={change.field}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
        >
          <dt className="text-micro font-semibold uppercase tracking-label text-ink-4">
            {describeAuditField(t, change.field)}
          </dt>
          {/*
            A field that had no value before is not a change *from* anything, so it is printed as
            the one value it has. "— → user" is a diff of an absence: three glyphs of ceremony in
            front of the only word on the line, and on an impersonation entry it was most of the
            entry. The struck-through half appears when there genuinely was something there.
          */}
          <dd className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-caption">
            {change.before === EMPTY ? null : (
              <>
                <span className="max-w-60 truncate text-ink-4 line-through decoration-ink-4/60">
                  {change.before}
                </span>
                <span aria-hidden className="text-ink-4">
                  &rarr;
                </span>
                <span className="sr-only">{t('console.audit.became')}</span>
              </>
            )}
            <span
              className={cn(
                'max-w-60 truncate font-medium',
                change.after === EMPTY ? 'text-ink-4' : 'text-ink-2',
              )}
            >
              {change.after === EMPTY
                ? t('console.audit.value.cleared')
                : change.after}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

export interface AuditActorBadgeProps {
  readonly kind: string
  readonly role: string | null
  readonly className?: string
}

/**
 * The standing the actor held *at the moment of the action*.
 *
 * `actor_role` is stored rather than joined precisely because `user.role` is mutable
 * (`docs/ACCESS.md` §4.1), so this badge answers "who could do this then", not "who can do it now".
 * A `system` row carries no role and gets no badge — there is nobody to have held one.
 */
export function AuditActorBadge({
  kind,
  role,
  className,
}: AuditActorBadgeProps) {
  const t = useTranslate()
  if (kind === 'system' || role === null) {
    return null
  }
  return (
    <Badge tone="neutral" size="sm" className={className}>
      {t('console.audit.actorBadge', {
        role: t(
          role === 'admin'
            ? 'console.role.admin'
            : role === 'curator'
              ? 'console.role.curator'
              : 'console.role.user',
        ),
      })}
    </Badge>
  )
}
