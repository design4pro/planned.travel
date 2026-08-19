import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonAlert,
  X,
} from 'lucide-react'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'
import { IconButton } from './icon-button'

import type { VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'

const alertVariants = cva('relative flex gap-3 rounded-lg border', {
  variants: {
    tone: {
      info: 'border-info/25 bg-info-soft text-ink',
      success: 'border-success/25 bg-success-soft text-ink',
      warning: 'border-warning/25 bg-warning-soft text-ink',
      danger: 'border-danger/25 bg-danger-soft text-ink',
      neutral: 'border-edge bg-surface-2 text-ink',
    },
    size: {
      sm: 'p-3',
      md: 'p-4',
    },
  },
  defaultVariants: { tone: 'info', size: 'md' },
})

const toneIcons: Record<
  NonNullable<VariantProps<typeof alertVariants>['tone']>,
  LucideIcon
> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
  neutral: Info,
}

const toneGlyphColors = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-ink-3',
} as const

export type AlertProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof alertVariants> & {
    title?: React.ReactNode
    /** Overrides the tone's default glyph. Pass `null` to drop it entirely. */
    icon?: React.ReactNode | null
    /** Buttons or links under the copy. */
    actions?: React.ReactNode
    onDismiss?: () => void
    dismissLabel?: string
  }

/**
 * An inline message about the page, not about the last action — that is a
 * `toast`. `danger` is announced assertively; every other tone waits its turn,
 * so a validation summary never talks over the reader mid-sentence.
 */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      tone = 'info',
      size,
      title,
      icon,
      actions,
      onDismiss,
      dismissLabel = 'Dismiss',
      children,
      ...props
    },
    ref,
  ) => {
    const Glyph = toneIcons[tone ?? 'info']
    return (
      <div
        ref={ref}
        role={tone === 'danger' ? 'alert' : 'status'}
        aria-live={tone === 'danger' ? 'assertive' : 'polite'}
        className={cn(
          alertVariants({ tone, size }),
          onDismiss && 'pr-11',
          className,
        )}
        {...props}
      >
        {icon === null ? null : (
          <span
            className={cn(
              'mt-px shrink-0 [&_svg]:size-4.5',
              toneGlyphColors[tone ?? 'info'],
            )}
            aria-hidden="true"
          >
            {icon ?? <Glyph />}
          </span>
        )}

        <div className="min-w-0 flex-1">
          {title ? (
            <p className="text-label font-semibold text-ink">{title}</p>
          ) : null}
          {children ? (
            <div className={cn('text-caption text-ink-2', title && 'mt-1')}>
              {children}
            </div>
          ) : null}
          {actions ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>

        {onDismiss ? (
          <IconButton
            icon={<X />}
            label={dismissLabel}
            size="xs"
            variant="ghost"
            onClick={onDismiss}
            className="absolute top-2.5 right-2.5"
          />
        ) : null}
      </div>
    )
  },
)
Alert.displayName = 'Alert'
