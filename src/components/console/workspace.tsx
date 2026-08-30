/**
 * The workspace scale and the billing scale, kept a long way from the platform one.
 *
 * `docs/SPEC.md` §5 says the two role vocabularies must never be conflated, and the account screen
 * is the one place in the product where they appear within a few hundred pixels of each other: a
 * person is `owner` of their workspace and almost certainly `user` on the platform. So the platform
 * scale keeps its glyphed weight ladder (`PlatformRoleBadge`) and the workspace scale is plain text
 * in a column headed "Role" — different shapes, not different shades of the same shape, because a
 * reader who has to tell two badges apart by tone will eventually not.
 *
 * Neither scale spends `--color-danger`. An unpaid invoice is not a destructive act by an operator,
 * and this console reserves red for ban, revoke and delete.
 *
 * **Every describer takes the translator rather than reaching for one.** These are pure functions
 * over a database column, called from table cells and from tests, and a hook cannot be either. The
 * argument keeps the fallback honest as well: a value the table cannot name is still printed exactly
 * as it was stored, in every locale, because the fallback never goes through `t()` at all.
 */

import { Badge } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'

import type { BadgeProps, BadgeTone } from '#/components/ui'
import type { MessageKey, Translate } from '#/lib/i18n'

/** Membership of one workspace — `member.role`, never `user.role`. */
const WORKSPACE_ROLE_KEYS: Readonly<Record<string, MessageKey | undefined>> = {
  owner: 'console.workspace.role.owner',
  admin: 'console.workspace.role.admin',
  member: 'console.workspace.role.member',
}

export function describeWorkspaceRole(t: Translate, role: string): string {
  const key = WORKSPACE_ROLE_KEYS[role]
  return key === undefined ? role : t(key)
}

/** The four billing tiers `subscriptions.plan` can hold. No row at all means Free. */
const PLAN_KEYS: Readonly<Record<string, MessageKey | undefined>> = {
  free: 'console.plan.free',
  starter: 'console.plan.starter',
  pro: 'console.plan.pro',
  business: 'console.plan.business',
}

export function describePlan(t: Translate, plan: string | null): string {
  if (plan === null) return t('console.plan.free')
  const key = PLAN_KEYS[plan]
  return key === undefined ? plan : t(key)
}

/** The eight values `subscriptions.status` can hold, and how urgent each one is. */
const STATUS_DESCRIPTORS: Readonly<
  Record<
    string,
    { readonly key: MessageKey; readonly tone: BadgeTone } | undefined
  >
> = {
  trialing: { key: 'console.subscription.trialing', tone: 'info' },
  active: { key: 'console.subscription.active', tone: 'success' },
  past_due: { key: 'console.subscription.pastDue', tone: 'warning' },
  canceled: { key: 'console.subscription.canceled', tone: 'neutral' },
  incomplete: { key: 'console.subscription.incomplete', tone: 'warning' },
  incomplete_expired: { key: 'console.subscription.expired', tone: 'neutral' },
  unpaid: { key: 'console.subscription.unpaid', tone: 'warning' },
  paused: { key: 'console.subscription.paused', tone: 'neutral' },
}

export interface SubscriptionStatusBadgeProps {
  readonly status: string
  readonly size?: BadgeProps['size']
  readonly className?: string
}

/** A subscription's state as a badge. An unrecognised status prints verbatim, quietly. */
export function SubscriptionStatusBadge({
  status,
  size = 'sm',
  className,
}: SubscriptionStatusBadgeProps) {
  const t = useTranslate()
  const descriptor = STATUS_DESCRIPTORS[status]
  return (
    <Badge
      tone={descriptor?.tone ?? 'neutral'}
      size={size}
      className={className}
    >
      {descriptor === undefined ? status : t(descriptor.key)}
    </Badge>
  )
}
