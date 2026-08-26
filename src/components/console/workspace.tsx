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
 */

import { Badge } from '#/components/ui'

import type { BadgeProps, BadgeTone } from '#/components/ui'

/** Membership of one workspace — `member.role`, never `user.role`. */
const WORKSPACE_ROLE_LABELS: Readonly<Record<string, string>> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

export function describeWorkspaceRole(role: string): string {
  return WORKSPACE_ROLE_LABELS[role] ?? role
}

/** The four billing tiers `subscriptions.plan` can hold. No row at all means Free. */
const PLAN_LABELS: Readonly<Record<string, string>> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
}

export function describePlan(plan: string | null): string {
  if (plan === null) return 'Free'
  return PLAN_LABELS[plan] ?? plan
}

/** The eight values `subscriptions.status` can hold, and how urgent each one is. */
const STATUS_DESCRIPTORS: Readonly<
  Record<string, { readonly label: string; readonly tone: BadgeTone }>
> = {
  trialing: { label: 'Trialing', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  past_due: { label: 'Past due', tone: 'warning' },
  canceled: { label: 'Cancelled', tone: 'neutral' },
  incomplete: { label: 'Incomplete', tone: 'warning' },
  incomplete_expired: { label: 'Expired', tone: 'neutral' },
  unpaid: { label: 'Unpaid', tone: 'warning' },
  paused: { label: 'Paused', tone: 'neutral' },
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
  const descriptor: { readonly label: string; readonly tone: BadgeTone } =
    STATUS_DESCRIPTORS[status] ?? { label: status, tone: 'neutral' }
  return (
    <Badge tone={descriptor.tone} size={size} className={className}>
      {descriptor.label}
    </Badge>
  )
}
