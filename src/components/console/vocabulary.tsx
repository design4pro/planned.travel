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

import type { ShellPlatformRole } from '#/components/layout/session'
import type { BadgeProps, BadgeTone } from '#/components/ui'
import type { LucideIcon } from 'lucide-react'

/** Everything the console says about one platform role, in one place. */
export interface PlatformRoleDescriptor {
  readonly label: string
  readonly tone: BadgeTone
  readonly icon: LucideIcon
  /** One sentence, used in the role picker and in the account screen. */
  readonly summary: string
  /**
   * What the role holds and what it does not, in the reader's words.
   *
   * A rendering of `docs/ACCESS.md` §2's grid rather than a second copy of it: seventy-two literal
   * cells is a table nobody reads on a screen about one person, and `requirePermission` remains the
   * only thing that decides any of it. Both halves are listed on purpose. A list of what an account
   * *may* do answers half the question an operator has in front of them, and the half they came for
   * is usually the other one - "can this curator ban somebody?" is the question, and a permission
   * list that only ever says yes leaves it to be inferred from an absence.
   */
  readonly holds: ReadonlyArray<string>
  readonly withheld: ReadonlyArray<string>
}

export const PLATFORM_ROLE_VOCABULARY: Readonly<
  Record<ShellPlatformRole, PlatformRoleDescriptor>
> = {
  admin: {
    label: 'Admin',
    tone: 'accent',
    icon: ShieldCheck,
    summary:
      'Full platform authority: accounts, roles, bans, sessions and impersonation.',
    holds: [
      'Create accounts and set platform roles',
      'Suspend accounts and lift suspensions',
      'Revoke sessions and set passwords',
      'Impersonate an account for fifteen minutes',
      'Everything a curator may do',
    ],
    withheld: ['Impersonate another platform admin'],
  },
  curator: {
    label: 'Curator',
    tone: 'outline',
    icon: Wrench,
    summary:
      'The catalogue, packs, sources and share moderation. Nothing that touches accounts.',
    holds: [
      'Read, write and publish catalogue places',
      'Read, write and publish place packs',
      'Read and run catalogue sources',
      'Review and revoke shared links',
    ],
    withheld: [
      'Anything that touches an account or a session',
      'Issuing or revoking machine credentials',
    ],
  },
  user: {
    label: 'User',
    tone: 'neutral',
    icon: UserRound,
    summary: 'No platform surface at all. This is nearly everybody.',
    holds: [],
    withheld: ['Every platform statement, without exception'],
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
  const descriptor = PLATFORM_ROLE_VOCABULARY[role]
  const Icon = descriptor.icon
  return (
    <Badge tone={descriptor.tone} size={size} className={className}>
      <Icon aria-hidden className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      {descriptor.label}
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
  if (!banned) {
    return (
      <span className={cn('flex items-center gap-1.5 text-ink-3', className)}>
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-success"
        />
        <span className="text-caption">Active</span>
      </span>
    )
  }

  const until = formatDate(banExpiresAt)
  return (
    <span className={cn('flex flex-col items-start gap-1', className)}>
      <Badge tone="danger" size="sm" dot>
        Suspended
      </Badge>
      <span className="text-micro tabular-nums text-ink-4">
        {until === null ? 'Permanent' : `Until ${until}`}
      </span>
    </span>
  )
}

export interface VerificationMarkProps {
  readonly verified: boolean
  readonly className?: string
}

/** A quiet warning chip on an unverified address, and nothing at all on a verified one. */
export function VerificationMark({ verified, className }: VerificationMarkProps) {
  if (verified) {
    return null
  }
  return (
    <Badge tone="warning" size="sm" className={className}>
      <CircleSlash aria-hidden className="size-3" />
      Unverified
    </Badge>
  )
}
