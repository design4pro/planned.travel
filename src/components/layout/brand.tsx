import { cn } from '#/lib/cn'

const WORDMARK_SIZES = {
  sm: { mark: 'size-6', word: 'text-[1.0625rem]' },
  md: { mark: 'size-7', word: 'text-[1.25rem]' },
  lg: { mark: 'size-9', word: 'text-[1.625rem]' },
} as const

/**
 * planned.travel's own mark: a dotted route rising from a departure dot to a
 * pinned destination, set in a soft-cornered near-black tile. Drawn in
 * `currentColor`-independent token classes so it inverts with the theme.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" role="presentation" aria-hidden className={cn('shrink-0', className)}>
      <rect width="28" height="28" rx="9" className="fill-accent" />
      <path
        d="M8.6 20.2c0-6 3.6-10.2 9.2-11.4"
        className="stroke-accent-on"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="0.1 3.3"
        fill="none"
        opacity="0.65"
      />
      <circle cx="8.6" cy="20.2" r="2.1" className="fill-accent-on" />
      <path
        d="M18.6 5.6a3.3 3.3 0 0 1 3.3 3.3c0 2.4-3.3 5.5-3.3 5.5s-3.3-3.1-3.3-5.5a3.3 3.3 0 0 1 3.3-3.3Z"
        className="fill-accent-on"
      />
      <circle cx="18.6" cy="8.9" r="1.15" className="fill-accent" />
    </svg>
  )
}

export interface WordmarkProps {
  size?: keyof typeof WORDMARK_SIZES
  /** Show the `.travel` tail — used on the public pages and in the footer. */
  showSuffix?: boolean
  className?: string
}

export function Wordmark({ size = 'md', showSuffix = false, className }: WordmarkProps) {
  const scale = WORDMARK_SIZES[size]
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className={scale.mark} />
      <span
        className={cn(
          'font-display font-extrabold leading-none tracking-tighter text-ink',
          scale.word,
        )}
      >
        planned
        {showSuffix ? (
          <span className="font-bold text-ink-4">.travel</span>
        ) : (
          <span className="text-brand">.</span>
        )}
      </span>
    </span>
  )
}
