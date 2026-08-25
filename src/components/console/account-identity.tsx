/**
 * One account, named the same way on all three console screens.
 *
 * The reference puts a single-initial circle, a name and an address in its users table and then
 * hangs the account's *status* off the colour of a dot inside that circle - which is the one
 * property a colour alone cannot carry, because a reader has to already know the legend. Here the
 * avatar is the avatar, the address is the address, and status is a word in its own column
 * (`AccountStatus`). What rides in this cell instead is the thing an operator actually needs beside
 * a name: whether the address has ever been proved to work, and whether the row is their own.
 */

import { Avatar, Badge } from '#/components/ui'
import { cn } from '#/lib/cn'
import { VerificationMark } from './vocabulary'

import type { AvatarSize } from '#/components/ui'
import type { ReactNode } from 'react'

export interface AccountIdentityProps {
  readonly name: string
  readonly email: string
  readonly image: string | null
  readonly emailVerified: boolean
  /** Marks the operator's own row, the way a workspace member list marks it. */
  readonly self?: boolean
  readonly size?: AvatarSize
  /** Wraps the name — a `Link` on the users table, nothing on the account screen. */
  readonly nameAs?: (name: ReactNode) => ReactNode
  /**
   * Class for the address line.
   *
   * Its one caller passes `lg:hidden`: the wide users table gives the address a sortable column of
   * its own, so repeating it under the name there would print it twice on the same row.
   */
  readonly emailClassName?: string
  readonly className?: string
}

export function AccountIdentity({
  name,
  email,
  image,
  emailVerified,
  self = false,
  size = 'md',
  nameAs,
  emailClassName,
  className,
}: AccountIdentityProps) {
  const label = <span className="truncate">{name}</span>

  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar name={name} src={image} size={size} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-medium text-ink">
            {nameAs ? nameAs(label) : label}
          </span>
          {self ? (
            <Badge tone="outline" size="sm">
              You
            </Badge>
          ) : null}
        </span>
        <span
          className={cn('flex min-w-0 items-center gap-2', emailClassName)}
        >
          <span className="min-w-0 truncate text-caption text-ink-3">
            {email}
          </span>
          <VerificationMark verified={emailVerified} />
        </span>
      </span>
    </span>
  )
}
