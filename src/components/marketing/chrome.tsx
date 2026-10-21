import { Link } from '@tanstack/react-router'

import { Wordmark } from '#/components/layout/brand'
import { ThemeToggle } from '#/components/layout/theme-toggle'
import { VisitorLanguageSwitcher } from '#/components/layout/visitor-language-switcher'
import { Button, Separator } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'

import type { MessageKey } from '#/lib/i18n'

/** The year in the footer notice. A constant, so SSR and hydration agree. */
const COPYRIGHT_YEAR = 2026

export type MarketingAnchor = {
  readonly href: string
  readonly labelKey: MessageKey
}

/** In-page anchors the landing page hands to the header on wide screens. */
export const LANDING_ANCHORS: ReadonlyArray<MarketingAnchor> = [
  { href: '#planner', labelKey: 'marketing.anchor.planner' },
  { href: '#modules', labelKey: 'marketing.anchor.modules' },
  { href: '#plans', labelKey: 'marketing.anchor.plans' },
  { href: '#questions', labelKey: 'marketing.anchor.questions' },
]

/**
 * The one bar every public page wears: wordmark, optional in-page anchors, and
 * the two calls to action. Translucent over the canvas so a long page keeps a
 * sense of depth as it scrolls under the bar, and never taller than `--nav-h`.
 *
 * It pins at `top-0` rather than composing `--impersonation-h` like the app
 * shell's nav does, and that is not an omission: the marketing tree renders under
 * `RootDocument`, which carries no session and therefore never renders the
 * impersonation bar (`docs/ACCESS.md` §6.1). The token is `0rem` on every page
 * this header appears on. The section anchors below it compose the term anyway,
 * because a scroll offset costs nothing to keep in one shape across the product.
 */
export function MarketingHeader({
  anchors = [],
  minimal = false,
}: {
  anchors?: ReadonlyArray<MarketingAnchor>
  /**
   * The wordmark and the theme toggle only. A page that carries its own sign-in (a trip invite
   * link keeps its `?redirect=`) must not offer links that drop it, or "Sign in" to someone who
   * already is.
   */
  minimal?: boolean
}) {
  const t = useTranslate()

  return (
    <header className="sticky top-0 z-nav border-b border-edge-faint bg-canvas/85 pt-safe backdrop-blur-xl">
      <div className="mx-auto flex h-nav max-w-content items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label={t('marketing.nav.home')}
          className="shrink-0 rounded-md focus-ring"
        >
          <Wordmark showSuffix compact />
        </Link>

        {anchors.length === 0 ? null : (
          <nav
            aria-label={t('marketing.nav.onThisPage')}
            className="ms-6 hidden items-center lg:flex"
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
                {t(anchor.labelKey)}
              </a>
            ))}
          </nav>
        )}

        <div className="ms-auto flex items-center gap-1">
          {minimal ? (
            <>
              <ThemeToggle />
              <VisitorLanguageSwitcher />
            </>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                shape="pill"
                className="hidden sm:inline-flex"
              >
                <Link to="/pricing" activeProps={{ 'aria-current': 'page' }}>
                  {t('marketing.action.pricing')}
                </Link>
              </Button>
              <ThemeToggle />
              <VisitorLanguageSwitcher />
              <Button
                asChild
                variant="ghost"
                size="sm"
                shape="pill"
                className="hidden sm:inline-flex"
              >
                <Link to="/login">{t('marketing.action.signIn')}</Link>
              </Button>
              <Button asChild variant="primary" size="sm" shape="pill">
                <Link to="/register">{t('marketing.action.startFree')}</Link>
              </Button>
            </>
          )}
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
  const t = useTranslate()

  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only focus:not-sr-only',
        'focus:fixed focus:top-3 focus:start-3 focus:z-toast',
        'focus:inline-flex focus:h-10 focus:items-center',
        'focus:rounded-md focus:bg-accent focus:px-4',
        'focus:text-label focus:font-semibold focus:text-accent-on',
        'focus:shadow-elevated focus-ring',
      )}
    >
      {t('marketing.action.skipToContent')}
    </a>
  )
}

type FooterColumn = {
  readonly headingKey: MessageKey
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
        readonly labelKey: MessageKey
      }
    | {
        readonly kind: 'anchor'
        readonly href: string
        readonly labelKey: MessageKey
      }
  >
}

const FOOTER_COLUMNS: ReadonlyArray<FooterColumn> = [
  {
    headingKey: 'marketing.footer.column.product',
    links: [
      { kind: 'route', to: '/', labelKey: 'marketing.footer.link.overview' },
      {
        kind: 'anchor',
        href: '/#modules',
        labelKey: 'marketing.footer.link.everyModule',
      },
      { kind: 'route', to: '/pricing', labelKey: 'marketing.action.pricing' },
      {
        kind: 'anchor',
        href: '/#questions',
        labelKey: 'marketing.anchor.questions',
      },
    ],
  },
  {
    headingKey: 'marketing.anchor.modules',
    links: [
      {
        kind: 'anchor',
        href: '/#planner',
        labelKey: 'marketing.footer.link.dayPlanner',
      },
      {
        kind: 'anchor',
        href: '/#costs',
        labelKey: 'marketing.footer.link.sharedCosts',
      },
      {
        kind: 'anchor',
        href: '/#reservations',
        labelKey: 'marketing.footer.link.reservations',
      },
      {
        kind: 'anchor',
        href: '/#modules',
        labelKey: 'marketing.footer.link.atlasJournal',
      },
    ],
  },
  {
    headingKey: 'marketing.footer.column.account',
    links: [
      {
        kind: 'route',
        to: '/register',
        labelKey: 'marketing.footer.link.createAccount',
      },
      { kind: 'route', to: '/login', labelKey: 'marketing.action.signIn' },
      {
        kind: 'route',
        to: '/legal/terms',
        labelKey: 'marketing.footer.link.terms',
      },
      {
        kind: 'route',
        to: '/legal/privacy',
        labelKey: 'marketing.footer.link.privacy',
      },
    ],
  },
]

const footerLinkClasses = cn(
  'inline-flex rounded-sm text-label text-ink-3 focus-ring',
  'transition-colors duration-fast ease-out-quint hover:text-ink',
)

/**
 * The real footer: what the product is, where to go next, and the attributions
 * we are obliged to carry for the map data and the platform underneath. `minimal` drops the two
 * sign-up calls to action, for the same reason as the header's.
 */
export function MarketingFooter({ minimal = false }: { minimal?: boolean }) {
  const t = useTranslate()
  // Sign-in and sign-up links are dead ends here for the same reason; terms and privacy stay.
  const columns = minimal
    ? FOOTER_COLUMNS.map((column) => ({
        ...column,
        links: column.links.filter(
          (link) =>
            link.kind !== 'route' ||
            (link.to !== '/login' && link.to !== '/register'),
        ),
      }))
    : FOOTER_COLUMNS

  return (
    <footer className="border-t border-edge-faint bg-surface-2/40">
      <div className="mx-auto max-w-content px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
          <div className="min-w-0">
            <Wordmark size="md" showSuffix />
            <p className="mt-4 max-w-xs text-label leading-relaxed text-ink-3">
              {t('marketing.footer.blurb')}
            </p>
            {minimal ? null : (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild variant="primary" size="sm" shape="pill">
                  <Link to="/register">{t('marketing.action.startFree')}</Link>
                </Button>
                <Button asChild variant="secondary" size="sm" shape="pill">
                  <Link to="/pricing">{t('marketing.action.seePricing')}</Link>
                </Button>
              </div>
            )}
          </div>

          {columns.map((column) => (
            <nav
              key={column.headingKey}
              aria-label={t(column.headingKey)}
              className="min-w-0"
            >
              <h2 className="text-micro font-semibold uppercase tracking-label text-ink-4">
                {t(column.headingKey)}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.labelKey}>
                    {link.kind === 'route' ? (
                      <Link to={link.to} className={footerLinkClasses}>
                        {t(link.labelKey)}
                      </Link>
                    ) : (
                      <a href={link.href} className={footerLinkClasses}>
                        {t(link.labelKey)}
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
          <p className="sm:text-end">{t('marketing.footer.attribution')}</p>
        </div>
      </div>
    </footer>
  )
}
