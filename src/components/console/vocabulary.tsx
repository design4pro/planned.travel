/**
 * One vocabulary for the console's two role scales and one status scale, so the overview, the users
 * table and the account screen never disagree about what a word or a colour means.
 *
 * **Why the tones are what they are, written down because the reference gets exactly this wrong.**
 * The screen this console is measured against paints one saturated red on its primary button *and*
 * on its Administrator badge, while the destructive control in the same rows is a grey outline icon.
 * Identity and danger share a hue there, so the loudest thing on the page is a job title and the
 * only irreversible action is the quietest. Here `--color-danger` is spent on ban, revoke and
 * delete and on nothing else: authority is a *weight* scale rather than a hue — solid ink for
 * `admin`, a hairline for `curator`, a soft grey fill for `user` — which reads as a ladder in both
 * themes and leaves red meaning exactly one thing.
 */

import { CircleSlash, ShieldCheck, UserRound, Wrench } from 'lucide-react'

import { Badge } from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatDate } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'

import type { ShellPlatformRole } from '#/components/layout/session'
import type { BadgeProps, BadgeTone } from '#/components/ui'
import type { MessageKey } from '#/lib/i18n'
import type { LucideIcon } from 'lucide-react'

/**
 * Everything the console says about one platform role, in one place.
 *
 * The words are catalogue *keys* rather than sentences, because this table is module-level data and
 * a translator is a hook. Resolving them here would mean either calling a hook outside a component
 * or keeping twenty-three copies of the table; naming the keys lets the one table stay one table and
 * puts `t()` at the render site, which is where the reader's locale is known.
 */
export interface PlatformRoleDescriptor {
  readonly labelKey: MessageKey
  readonly tone: BadgeTone
  readonly icon: LucideIcon
  /** One sentence, used in the role picker and in the account screen. */
  readonly summaryKey: MessageKey
  /**
   * What the role holds and what it does not, in the reader's words.
   *
   * A rendering of `docs/ACCESS.md` §2's grid rather than a second copy of it: seventy-five literal
   * cells is a table nobody reads on a screen about one person, and `requirePermission` remains the
   * only thing that decides any of it. Both halves are listed on purpose. A list of what an account
   * *may* do answers half the question an operator has in front of them, and the half they came for
   * is usually the other one - "can this curator ban somebody?" is the question, and a permission
   * list that only ever says yes leaves it to be inferred from an absence.
   */
  readonly holds: ReadonlyArray<MessageKey>
  readonly withheld: ReadonlyArray<MessageKey>
}

export const PLATFORM_ROLE_VOCABULARY: Readonly<
  Record<ShellPlatformRole, PlatformRoleDescriptor>
> = {
  admin: {
    labelKey: 'console.role.admin',
    tone: 'accent',
    icon: ShieldCheck,
    summaryKey: 'console.role.admin.summary',
    holds: [
      'console.role.admin.holds.accounts',
      'console.role.admin.holds.bans',
      'console.role.admin.holds.sessions',
      'console.role.admin.holds.impersonate',
      'console.role.admin.holds.curation',
    ],
    withheld: ['console.role.admin.withheld.admins'],
  },
  curator: {
    labelKey: 'console.role.curator',
    tone: 'outline',
    icon: Wrench,
    summaryKey: 'console.role.curator.summary',
    holds: [
      'console.role.curator.holds.places',
      'console.role.curator.holds.packs',
      'console.role.curator.holds.sources',
      'console.role.curator.holds.shares',
    ],
    withheld: [
      'console.role.curator.withheld.accounts',
      'console.role.curator.withheld.tokens',
    ],
  },
  user: {
    labelKey: 'console.role.user',
    tone: 'neutral',
    icon: UserRound,
    summaryKey: 'console.role.user.summary',
    holds: [],
    withheld: ['console.role.user.withheld.everything'],
  },
}

/** Ordered strongest first — the order the role picker and the legend both use. */
export const PLATFORM_ROLE_ORDER: ReadonlyArray<ShellPlatformRole> = [
  'admin',
  'curator',
  'user',
]

/**
 * The platform role a raw `user.role` column resolves to, for rendering only.
 *
 * The column is a comma-joined string for a multi-role account and carries no `CHECK`, so an
 * unrecognised value resolves to `user` rather than to "unset, therefore permissive". This mirrors
 * `resolvePlatformRole` in `src/server/auth/access.ts` — the server never reads what the client
 * decided here, and the guard resolves the column itself on every call — and mirroring it *exactly*
 * is the point rather than a nicety.
 *
 * **The parts are compared as `split(',')` produces them, whitespace and all, and an earlier version
 * of this function trimmed them.** Better Auth's own check does `(role || …).split(',')` with no
 * trim, and it is what runs inside every `auth.api.*` call the console makes, so `' admin , user '`
 * is a column that grants nothing at all. Trimming here would have put an `Admin` badge and a full
 * row of enabled controls on an account the guard treats as a plain `user` — a screen that promises
 * authority the server then refuses. `__tests__/vocabulary.test.ts` asserts the two agree on every
 * shape the column can hold, and that assertion is what found it.
 */
export function displayPlatformRole(role: string | null): ShellPlatformRole {
  if (role === null) return 'user'
  const held = new Set(role.split(','))
  if (held.has('admin')) return 'admin'
  if (held.has('curator')) return 'curator'
  return 'user'
}

export interface PlatformRoleBadgeProps {
  readonly role: ShellPlatformRole
  readonly size?: BadgeProps['size']
  readonly className?: string
}

export function PlatformRoleBadge({
  role,
  size = 'md',
  className,
}: PlatformRoleBadgeProps) {
  const t = useTranslate()
  const descriptor = PLATFORM_ROLE_VOCABULARY[role]
  const Icon = descriptor.icon
  return (
    <Badge tone={descriptor.tone} size={size} className={className}>
      <Icon aria-hidden className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      {t(descriptor.labelKey)}
    </Badge>
  )
}

export interface AccountStatusProps {
  readonly banned: boolean
  /** ISO-8601, or `null` for a permanent ban. */
  readonly banExpiresAt: string | null
  readonly className?: string
}

/**
 * Active or suspended, as one line.
 *
 * Active is a dot and a quiet word rather than a filled badge: every row would otherwise carry a
 * green pill, and a status that is true of nearly every row is noise which hides the one row where
 * it is not. Suspended is the filled `--color-danger` treatment, and it is the only place in this
 * table that colour appears.
 */
export function AccountStatus({
  banned,
  banExpiresAt,
  className,
}: AccountStatusProps) {
  const locale = useLocale()
  const t = useTranslate()
  if (!banned) {
    return (
      <span className={cn('flex items-center gap-1.5 text-ink-3', className)}>
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-success"
        />
        <span className="text-caption">{t('console.status.active')}</span>
      </span>
    )
  }

  const until = formatDate(banExpiresAt, locale)
  return (
    <span className={cn('flex flex-col items-start gap-1', className)}>
      <Badge tone="danger" size="sm" dot>
        {t('console.status.suspended')}
      </Badge>
      <span className="text-micro tabular-nums text-ink-4">
        {until === null
          ? t('console.status.permanent')
          : t('console.status.until', { date: until })}
      </span>
    </span>
  )
}

export interface VerificationMarkProps {
  readonly verified: boolean
  readonly className?: string
}

/** A quiet warning chip on an unverified address, and nothing at all on a verified one. */
export function VerificationMark({
  verified,
  className,
}: VerificationMarkProps) {
  const t = useTranslate()
  if (verified) {
    return null
  }
  return (
    <Badge tone="warning" size="sm" className={className}>
      <CircleSlash aria-hidden className="size-3" />
      {t('console.status.unverified')}
    </Badge>
  )
}
