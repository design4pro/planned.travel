import { cn } from '#/lib/cn'

export type FaqItem = { readonly question: string; readonly answer: string }

export type FaqListProps = {
  items: ReadonlyArray<FaqItem>
  /** One column reads better for long legal-ish answers; two for short ones. */
  columns?: 1 | 2
  className?: string
}

/**
 * Questions on `<details>` elements rather than a hand-rolled accordion: it is
 * keyboard operable, findable by the browser's own in-page search even while
 * collapsed, and it works with JavaScript still on its way.
 */
export function FaqList({ items, columns = 2, className }: FaqListProps) {
  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 2 ? 'sm:grid-cols-2' : 'mx-auto max-w-2xl',
        className,
      )}
    >
      {items.map((item) => (
        <details
          key={item.question}
          className={cn(
            'group rounded-xl border border-edge-faint bg-surface p-5 shadow-card',
            'transition-shadow duration-base ease-out-quint open:shadow-elevated',
          )}
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-sm text-label font-semibold text-ink focus-ring">
            {item.question}
            <span
              aria-hidden
              className={cn(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-3',
                'transition-transform duration-base ease-out-quint group-open:rotate-45',
              )}
            >
              <svg
                viewBox="0 0 12 12"
                className="size-3"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M6 2v8M2 6h8"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </summary>
          <p className="mt-3 text-caption leading-relaxed text-ink-2">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  )
}
