import { Link } from '@tanstack/react-router'

import { Wordmark } from '#/components/layout/brand'
import { ThemeToggle } from '#/components/layout/theme-toggle'
import { Button, Separator } from '#/components/ui'
import { cn } from '#/lib/cn'

/** The year in the footer notice. A constant, so SSR and hydration agree. */
const COPYRIGHT_YEAR = 2026

export type MarketingAnchor = { readonly href: string; readonly label: string }

/** In-page anchors the landing page hands to the header on wide screens. */
export const LANDING_ANCHORS: ReadonlyArray<MarketingAnchor> = [
  { href: '#planner', label: 'Planner' },
  { href: '#modules', label: 'Modules' },
  { href: '#plans', label: 'Plans' },
  { href: '#questions', label: 'Questions' },
]

/**
 * The one bar every public page wears: wordmark, optional in-page anchors, and
 * the two calls to action. Translucent over the canvas so a long page keeps a
 * sense of depth as it scrolls under the bar, and never taller than `--nav-h`.
 */
export function MarketingHeader({
  anchors = [],
}: {
  anchors?: ReadonlyArray<MarketingAnchor>
}) {
  return (
    <header className="sticky top-0 z-nav border-b border-edge-faint bg-canvas/85 pt-safe backdrop-blur-xl">
      <div className="mx-auto flex h-nav max-w-content items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label="planned.travel home"
          className="shrink-0 rounded-md focus-ring"
        >
          <Wordmark showSuffix />
        </Link>

        {anchors.length === 0 ? null : (
          <nav
            aria-label="On this page"
            className="ml-6 hidden items-center lg:flex"
          >
            {anchors.map((anchor) => (
              <a
                key={anchor.href}
                href={anchor.href}
                className={cn(
                  'rounded-full px-3 py-1.5 text-label font-medium text-ink-3 focus-ring',
                  'transition-colors duration-fast ease-out-quint hover:bg-hover hover:text-ink',
                )}
              >
                {anchor.label}
              </a>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            shape="pill"
            className="hidden sm:inline-flex"
          >
            <Link to="/pricing" activeProps={{ 'aria-current': 'page' }}>
              Pricing
            </Link>
          </Button>
          <ThemeToggle />
          <Button
            asChild
            variant="ghost"
            size="sm"
            shape="pill"
            className="hidden sm:inline-flex"
          >
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="primary" size="sm" shape="pill">
            <Link to="/register">Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

/**
 * Lets a keyboard reader step past the header's links straight into the page.
 * Invisible until focused, then a real, legible button.
 */
export function SkipToContent({ targetId = 'main' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only focus:not-sr-only',
        'focus:fixed focus:top-3 focus:left-3 focus:z-toast',
        'focus:inline-flex focus:h-10 focus:items-center',
        'focus:rounded-md focus:bg-accent focus:px-4',
        'focus:text-label focus:font-semibold focus:text-accent-on',
        'focus:shadow-elevated focus-ring',
      )}
    >
      Skip to content
    </a>
  )
}

type FooterColumn = {
  readonly heading: string
  readonly links: ReadonlyArray<
    | {
        readonly kind: 'route'
        readonly to:
          | '/'
          | '/pricing'
          | '/login'
          | '/register'
          | '/legal/terms'
          | '/legal/privacy'
        readonly label: string
      }
    | { readonly kind: 'anchor'; readonly href: string; readonly label: string }
  >
}

const FOOTER_COLUMNS: ReadonlyArray<FooterColumn> = [
  {
    heading: 'Product',
    links: [
      { kind: 'route', to: '/', label: 'Overview' },
      { kind: 'anchor', href: '/#modules', label: 'Every module' },
      { kind: 'route', to: '/pricing', label: 'Pricing' },
      { kind: 'anchor', href: '/#questions', label: 'Questions' },
    ],
  },
  {
    heading: 'Modules',
    links: [
      { kind: 'anchor', href: '/#planner', label: 'Day planner' },
      { kind: 'anchor', href: '/#costs', label: 'Shared costs' },
      { kind: 'anchor', href: '/#reservations', label: 'Reservations' },
      { kind: 'anchor', href: '/#modules', label: 'Atlas and journal' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { kind: 'route', to: '/register', label: 'Create an account' },
      { kind: 'route', to: '/login', label: 'Sign in' },
      { kind: 'route', to: '/legal/terms', label: 'Terms of service' },
      { kind: 'route', to: '/legal/privacy', label: 'Privacy notice' },
    ],
  },
]

const footerLinkClasses = cn(
  'inline-flex rounded-sm text-label text-ink-3 focus-ring',
  'transition-colors duration-fast ease-out-quint hover:text-ink',
)

/**
 * The real footer: what the product is, where to go next, and the attributions
 * we are obliged to carry for the map data and the platform underneath.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-edge-faint bg-surface-2/40">
      <div className="mx-auto max-w-content px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
          <div className="min-w-0">
            <Wordmark size="md" showSuffix />
            <p className="mt-4 max-w-xs text-label leading-relaxed text-ink-3">
              One place for the itinerary, the map, the bookings, the money and
              the packing list — shared with everyone who is coming.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="primary" size="sm" shape="pill">
                <Link to="/register">Start free</Link>
              </Button>
              <Button asChild variant="secondary" size="sm" shape="pill">
                <Link to="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav
              key={column.heading}
              aria-label={column.heading}
              className="min-w-0"
            >
              <h2 className="text-micro font-semibold uppercase tracking-label text-ink-4">
                {column.heading}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.kind === 'route' ? (
                      <Link to={link.to} className={footerLinkClasses}>
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className={footerLinkClasses}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Separator weight="faint" className="mt-12" />

        <div className="mt-6 flex flex-col gap-3 text-caption text-ink-4 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {COPYRIGHT_YEAR} planned.travel</p>
          <p className="sm:text-right">
            Runs on Cloudflare Workers. Map data &copy; OpenStreetMap
            contributors. Sold and invoiced by Polar, our merchant of record.
          </p>
        </div>
      </div>
    </footer>
  )
}
