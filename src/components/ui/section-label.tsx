import * as React from 'react'

import { cn } from '#/lib/cn'

export type SectionLabelProps = React.ComponentPropsWithoutRef<'div'> & {
  /** Use a heading level when the label really is a section heading. */
  as?: 'div' | 'span' | 'h2' | 'h3' | 'h4' | 'legend'
  /** Small leading glyph, muted to match the label. */
  icon?: React.ReactNode
  /** Trailing content, pushed to the far edge — a count, a link, an action. */
  action?: React.ReactNode
}

/**
 * The 11px / 600 / `0.08em` / uppercase label that opens every panel in the
 * product. Defined once so the tracking is identical everywhere — the detail
 * that makes a set of cards read as one designed system.
 */
export const SectionLabel = React.forwardRef<HTMLDivElement, SectionLabelProps>(
  ({ className, as = 'div', icon, action, children, ...props }, ref) => {
    // Typed as a div so the forwarded ref stays concrete; the rendered tag is
    // still whatever `as` asked for.
    const Tag = as as 'div'
    return (
      <Tag
        ref={ref}
        className={cn(
          'flex min-w-0 items-center gap-1.5 text-micro font-semibold uppercase tracking-label text-ink-3',
          action && 'w-full justify-between',
          className,
        )}
        {...props}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {icon ? (
            <span
              className="grid size-3.5 shrink-0 place-items-center [&_svg]:size-3.5"
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}
          <span className="truncate">{children}</span>
        </span>
        {action ? (
          <span className="shrink-0 normal-case tracking-normal">{action}</span>
        ) : null}
      </Tag>
    )
  },
)
SectionLabel.displayName = 'SectionLabel'
