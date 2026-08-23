import * as React from 'react'
import { Avatar as AvatarPrimitive } from 'radix-ui'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'
import { useUiCopy } from './copy'

import type { MessageKey } from '#/lib/i18n'
import type { VariantProps } from 'class-variance-authority'

export const avatarVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden align-middle select-none',
  {
    variants: {
      size: {
        xs: 'size-5 text-micro',
        sm: 'size-6 text-micro',
        md: 'size-8 text-caption',
        lg: 'size-10 text-label',
        xl: 'size-14 text-subtitle',
        '2xl': 'size-20 text-title',
      },
      shape: {
        circle: 'rounded-full',
        rounded: 'rounded-md',
      },
    },
    defaultVariants: { size: 'md', shape: 'circle' },
  },
)

export type AvatarSize = NonNullable<
  VariantProps<typeof avatarVariants>['size']
>

/**
 * Six token-only tints. The choice is a hash of the name, so the same traveller
 * keeps the same colour on every screen without anything being stored.
 */
const tints = [
  'bg-brand-subtle text-brand',
  'bg-info-soft text-info',
  'bg-success-soft text-success',
  'bg-warning-soft text-warning',
  'bg-danger-soft text-danger',
  'bg-accent-subtle text-ink-2',
] as const

function tintFor(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0
  }
  return tints[Math.abs(hash) % tints.length] ?? tints[0]
}

/**
 * The sizes a second initial does not fit into.
 *
 * Two glyphs need about 15px of advance at the 11px label these render at, and a
 * 20–24px circle only clears 24px of it once the overlap in an `AvatarStack` has
 * taken its bite — which clipped "RW" into "RV". One letter, deliberately, rather
 * than two letters badly.
 */
const SINGLE_INITIAL_SIZES: ReadonlySet<AvatarSize> = new Set(['xs', 'sm'])

/** "Amelia Voss" → "AV"; "amelia@planned.travel" → "A". */
export function initialsFor(name: string, limit = 2): string {
  const words = name
    .replace(/@.*$/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0]?.[0] ?? ''
  if (limit < 2) return first.toUpperCase()
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

const statusTones = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-danger',
  offline: 'bg-ink-4',
} as const

/**
 * Presence is announced in words, so it never rests on the dot's colour alone —
 * and the words are catalogue keys, so it is announced in the reader's language.
 */
const statusKeys: Record<keyof typeof statusTones, MessageKey> = {
  online: 'ui.avatar.status.online',
  away: 'ui.avatar.status.away',
  busy: 'ui.avatar.status.busy',
  offline: 'ui.avatar.status.offline',
}

const statusSizes = {
  xs: 'size-1.5',
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3',
  xl: 'size-3.5',
  '2xl': 'size-4',
} as const

export type AvatarProps = Omit<
  React.ComponentPropsWithoutRef<'span'>,
  'children'
> &
  VariantProps<typeof avatarVariants> & {
    /** Image URL. Falls back to initials while loading and on error. */
    src?: string | null
    /** The person's name. Drives the initials, the tint and the accessible name. */
    name: string
    /** Presence dot. Announced through the avatar's title, not colour alone. */
    status?: keyof typeof statusTones
    /** Hairline ring — for avatars overlapping a photo or another avatar. */
    ring?: boolean
    /** Overrides the derived initials. */
    initials?: string
  }

/**
 * A traveller's face. Never renders a broken-image icon: Radix swaps in the
 * initials fallback on error, and the fallback is always the same two letters
 * for the same person, so a list of avatars stays visually stable.
 */
export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  (
    {
      className,
      size = 'md',
      shape,
      src,
      name,
      status,
      ring = false,
      initials,
      ...props
    },
    ref,
  ) => {
    const t = useUiCopy()
    return (
      <span
        ref={ref}
        className={cn(
          avatarVariants({ size, shape }),
          ring && 'ring-2 ring-surface',
          status && 'overflow-visible',
          className,
        )}
        {...props}
      >
        <AvatarPrimitive.Root
          className={cn(
            'flex size-full items-center justify-center overflow-hidden',
            shape === 'rounded' ? 'rounded-md' : 'rounded-full',
          )}
        >
          {src ? (
            <AvatarPrimitive.Image
              src={src}
              alt={name}
              className="size-full object-cover"
            />
          ) : null}
          <AvatarPrimitive.Fallback
            // Only an avatar that is waiting on an image delays its fallback; an
            // initials-only avatar must paint on the first frame.
            delayMs={src ? 120 : undefined}
            className={cn(
              'flex size-full items-center justify-center font-semibold',
              tintFor(name),
            )}
          >
            <span aria-hidden="true">
              {initials ??
                initialsFor(
                  name,
                  SINGLE_INITIAL_SIZES.has(size ?? 'md') ? 1 : 2,
                )}
            </span>
            <span className="sr-only">{name}</span>
          </AvatarPrimitive.Fallback>
        </AvatarPrimitive.Root>

        {status ? (
          <span
            className={cn(
              'absolute end-0 bottom-0 rounded-full ring-2 ring-surface',
              statusTones[status],
              statusSizes[size ?? 'md'],
            )}
            role="img"
            aria-label={t(statusKeys[status], { name })}
          />
        ) : null}
      </span>
    )
  },
)
Avatar.displayName = 'Avatar'
