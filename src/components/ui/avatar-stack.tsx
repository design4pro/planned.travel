import * as React from 'react'

import { cn } from '#/lib/cn'
import { formatList } from '#/lib/format'
import { Avatar, avatarVariants } from './avatar'
import { useUiI18n } from './copy'

import type { AvatarSize } from './avatar'

/** Negative gap per size — always a token step, never an eyeballed pixel. */
const overlap = {
  // A fifth of the circle, never more: past that the ring stops reading as a
  // separation and the initial underneath is simply cut in half.
  xs: '-space-x-1',
  sm: '-space-x-1',
  md: '-space-x-1.5',
  lg: '-space-x-2',
  xl: '-space-x-3',
  '2xl': '-space-x-4',
} as const

export type StackPerson = {
  id: string
  name: string
  src?: string | null
}

export type AvatarStackProps = Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'children'
> & {
  people: Array<StackPerson>
  /** Faces shown before the overflow counter takes over. */
  max?: number
  size?: AvatarSize
  /** Adds a "+3" chip after the faces. */
  showOverflow?: boolean
  /** Trailing text, e.g. "2 travellers". */
  label?: React.ReactNode
}

/**
 * Overlapping faces with an overflow counter. The list is announced as one
 * group with a full name list, so a screen reader gets "Amelia Voss, Jonas
 * Reyes and 3 others" instead of six unlabelled images.
 */
export const AvatarStack = React.forwardRef<HTMLDivElement, AvatarStackProps>(
  (
    {
      className,
      people,
      max = 4,
      size = 'md',
      showOverflow = true,
      label,
      ...props
    },
    ref,
  ) => {
    const ui = useUiI18n()
    const shown = people.slice(0, max)
    const hidden = people.length - shown.length
    const names = people.map((person) => person.name)
    // The party is read out as one conjunction list in this locale's own
    // punctuation — `formatList` freezes those separators for the same reason
    // the date tables are frozen (`docs/SPEC.md` §8.5).
    const summary = formatList(
      names.length <= max
        ? names
        : [
            ...names.slice(0, max),
            ui.t('ui.avatar.overflow', { count: names.length - max }),
          ],
      ui.locale,
    )

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2.5', className)}
        {...props}
      >
        <div
          className={cn('flex items-center', overlap[size])}
          role="group"
          aria-label={summary}
        >
          {shown.map((person) => (
            <Avatar
              key={person.id}
              name={person.name}
              src={person.src}
              size={size}
              ring
              aria-hidden="true"
            />
          ))}
          {showOverflow && hidden > 0 ? (
            <span
              className={cn(
                avatarVariants({ size }),
                'bg-surface-inset font-semibold tabular-nums text-ink-3 ring-2 ring-surface',
              )}
              aria-hidden="true"
            >
              +{hidden}
            </span>
          ) : null}
        </div>
        {label ? (
          <span className="text-caption text-ink-3">{label}</span>
        ) : null}
      </div>
    )
  },
)
AvatarStack.displayName = 'AvatarStack'
