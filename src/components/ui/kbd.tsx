import * as React from 'react'

import { cn } from '#/lib/cn'
import { useHasMounted } from './shared'

const sizes = {
  sm: 'h-4.5 min-w-4.5 px-1 text-micro',
  md: 'h-5.5 min-w-5.5 px-1.5 text-caption',
} as const

export type KbdProps = React.ComponentPropsWithoutRef<'kbd'> & {
  size?: keyof typeof sizes
  /** Sits on an inverse surface — a tooltip, a command palette footer. */
  inverse?: boolean
}

/**
 * One key cap. A real `<kbd>`, so assistive tech announces it as keyboard input
 * rather than as decorative text.
 */
export const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ className, size = 'md', inverse = false, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm border font-ui font-semibold',
        inverse
          ? 'border-inverse-edge bg-inverse-surface text-inverse-on'
          : 'border-edge bg-surface-2 text-ink-3 shadow-card',
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
)
Kbd.displayName = 'Kbd'

export type KbdSequenceProps = Omit<
  React.ComponentPropsWithoutRef<'span'>,
  'children'
> & {
  /** Keys in press order, e.g. `['Mod', 'K']`. `Mod` resolves per platform. */
  keys: Array<string>
  size?: KbdProps['size']
  inverse?: boolean
  /** Separator between caps. A thin `+` reads as "together". */
  separator?: React.ReactNode
}

const glyphs: Record<string, string> = {
  Shift: '⇧',
  Alt: '⌥',
  Option: '⌥',
  Enter: '↵',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
  Tab: '⇥',
}

/**
 * `Ctrl` until the client tells us otherwise, then `⌘` on Apple platforms. The
 * server render is deliberately the non-Apple form: swapping after mount is a
 * one-glyph change inside a fixed-width cap, so nothing reflows.
 */
export function usePlatformModifier(): string {
  const mounted = useHasMounted()
  const isApple =
    mounted &&
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  return isApple ? '⌘' : 'Ctrl'
}

export const KbdSequence = React.forwardRef<HTMLSpanElement, KbdSequenceProps>(
  ({ className, keys, size, inverse, separator = null, ...props }, ref) => {
    const mod = usePlatformModifier()
    return (
      <span
        ref={ref}
        className={cn('inline-flex items-center gap-0.5', className)}
        {...props}
      >
        {keys.map((key, index) => (
          <React.Fragment key={`${key}-${index}`}>
            {index > 0 && separator ? (
              <span className="text-caption text-ink-4" aria-hidden="true">
                {separator}
              </span>
            ) : null}
            <Kbd size={size} inverse={inverse}>
              {key === 'Mod' ? mod : (glyphs[key] ?? key)}
            </Kbd>
          </React.Fragment>
        ))}
      </span>
    )
  },
)
KbdSequence.displayName = 'KbdSequence'
