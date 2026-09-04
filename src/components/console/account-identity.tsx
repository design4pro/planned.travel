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
import { useTranslate } from '#/lib/i18n'
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
  const t = useTranslate()
  const label = <span className="truncate">{name}</span>

  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      {/*
        Hidden from assistive technology, and that is the whole point of the wrapper.

        `Avatar` carries its own accessible name — an `sr-only` copy of it inside the initials
        fallback, and `alt={name}` on the image — because it is used on its own elsewhere, where a
        circle with two letters in it would otherwise be announced as nothing. Here the name is
        printed one node to the right, so every row of the accounts table announced the person twice
        and the account screen's header announced them twice again. The avatar is decorative in this
        composition: it repeats the name it sits beside and adds nothing a reader cannot already
        hear.

        The duplicate had a second victim worth recording. `consoleAccountPath()` in
        `e2e/helpers/admin.ts` reads the account link out of the accounts document, and an earlier
        version of it matched on proximity to the name — which found the avatar's hidden copy a few
        hundred bytes ahead of the real link and walked the row above for four rounds.
      */}
      <Avatar aria-hidden="true" name={name} src={image} size={size} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-medium text-ink">
            {nameAs ? nameAs(label) : label}
          </span>
          {self ? (
            <Badge tone="outline" size="sm">
              {t('console.identity.you')}
            </Badge>
          ) : null}
        </span>
        <span className={cn('flex min-w-0 items-center gap-2', emailClassName)}>
          <span className="min-w-0 truncate text-caption text-ink-3">
            {email}
          </span>
          <VerificationMark verified={emailVerified} />
        </span>
      </span>
    </span>
  )
}
