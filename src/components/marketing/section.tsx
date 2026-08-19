import { cn } from '#/lib/cn'
import { SectionLabel } from '#/components/ui'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

const widths = {
  /** The full marketing measure — feature grids, plan cards, the preview. */
  content: 'max-w-content',
  /** A single readable column — FAQ answers and legal prose. */
  prose: 'max-w-3xl',
} as const

export type SectionProps = ComponentPropsWithoutRef<'section'> & {
  /**
   * `tint` lays a warm band behind the section. Alternating bands are what give
   * a long marketing page its rhythm without a single decorative divider.
   */
  tone?: 'canvas' | 'tint'
  width?: keyof typeof widths
  /** Tightens the vertical padding for a section that follows a related one. */
  density?: 'default' | 'tight'
}

/**
 * One vertical band of the public site. Every section on every public page
 * measures its gutters and its rhythm here, so the whole surface reads as one
 * typeset document rather than a stack of independently spaced blocks.
 */
export function Section({
  className,
  tone = 'canvas',
  width = 'content',
  density = 'default',
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        'relative',
        tone === 'tint' && 'border-y border-edge-faint bg-surface-2/45',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'mx-auto w-full px-4 sm:px-6 lg:px-8',
          widths[width],
          density === 'tight'
            ? 'py-12 sm:py-14 lg:py-16'
            : 'py-16 sm:py-20 lg:py-28',
        )}
      >
        {children}
      </div>
    </section>
  )
}

export type SectionIntroProps = {
  eyebrow: string
  title: ReactNode
  lede?: ReactNode
  /** Trailing action, laid beside the copy on wide screens. */
  action?: ReactNode
  align?: 'left' | 'center'
  /** Set so the surrounding section can point `aria-labelledby` at the heading. */
  headingId?: string
  className?: string
}

/**
 * The eyebrow / heading / lede triplet that opens every band. The heading steps
 * up to the display size only once there is room for it, so a 360px phone never
 * gets a 48px word broken across three lines.
 */
export function SectionIntro({
  eyebrow,
  title,
  lede,
  action,
  align = 'center',
  headingId,
  className,
}: SectionIntroProps) {
  const centred = align === 'center'

  return (
    <div
      className={cn(
        'flex flex-col gap-6',
        centred
          ? 'items-center text-center'
          : 'md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl">
        <SectionLabel className={cn(centred && 'justify-center')}>
          {eyebrow}
        </SectionLabel>
        <h2
          id={headingId}
          className="mt-3 font-display text-title font-extrabold tracking-tighter text-balance text-ink sm:text-display"
        >
          {title}
        </h2>
        {lede === undefined ? null : (
          <p
            className={cn(
              'mt-4 text-body leading-relaxed text-pretty text-ink-2',
              centred && 'mx-auto max-w-xl',
            )}
          >
            {lede}
          </p>
        )}
      </div>
      {action === undefined ? null : <div className="shrink-0">{action}</div>}
    </div>
  )
}

/**
 * The small pill that sits above a hero headline. Brand-tinted, quiet, and the
 * only place on the page where the brand colour carries a background.
 */
export function Eyebrow({
  icon,
  children,
  className,
}: {
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-brand-subtle px-3 py-1.5',
        'text-micro font-semibold uppercase tracking-label text-brand',
        'ring-1 ring-brand/15 ring-inset',
        className,
      )}
    >
      {icon === undefined ? null : (
        <span
          aria-hidden="true"
          className="grid size-3.5 shrink-0 place-items-center [&_svg]:size-3.5"
        >
          {icon}
        </span>
      )}
      {children}
    </span>
  )
}
