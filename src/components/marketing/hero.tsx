import { Link } from '@tanstack/react-router'
import { ArrowRight, MapPin } from 'lucide-react'

import { Button } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { AppPreview } from './app-preview'
import { Eyebrow } from './section'
import { DottedRoute } from './visuals'

import type { MessageKey } from '#/lib/i18n'

/**
 * The four honesty notes under the buttons. Each one is a fact, not a claim.
 *
 * The first is the pricing page's own eyebrow rather than a second copy of it:
 * the two pages make the same promise, and one sentence cannot drift from
 * itself.
 */
const TRUST_NOTES: readonly [MessageKey, MessageKey, MessageKey, MessageKey] = [
  'marketing.pricing.hero.eyebrow',
  'marketing.landing.trust.noCard',
  'marketing.landing.trust.noAds',
  'marketing.landing.trust.export',
]

function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
    >
      {/* A warm brand wash that resolves into the canvas by the fold. */}
      <div className="absolute inset-x-0 top-0 h-[34rem] bg-linear-to-b from-brand-subtle via-canvas to-canvas" />
      <div className="absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-brand/12 blur-3xl" />
      <DottedRoute className="absolute inset-x-0 top-24 hidden text-brand/30 lg:block" />
    </div>
  )
}

/**
 * The first thing anyone sees. Centred editorial copy, two calls to action, and
 * a composed miniature of the real dashboard sitting on the fold — no captured
 * screenshots, so it is crisp on a 2x display and never shifts the layout.
 */
export function MarketingHero() {
  const t = useTranslate()
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden border-b border-edge-faint"
    >
      <HeroBackdrop />

      <div className="mx-auto max-w-content px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-20 lg:px-8 lg:pt-24 lg:pb-28">
        {/* Transform-and-opacity only, and collapsed to nothing by the
            reduced-motion rules in `styles.css`. */}
        <div className="mx-auto flex max-w-3xl animate-rise flex-col items-center text-center">
          <Eyebrow icon={<MapPin />}>
            {t('marketing.landing.hero.eyebrow')}
          </Eyebrow>

          <h1
            id="hero-heading"
            className="mt-6 font-display text-hero text-balance text-ink"
          >
            {t('marketing.landing.hero.title')}
            <br />
            <span className="text-ink-3">
              {t('marketing.landing.hero.titleQuiet')}
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-subtitle font-normal leading-relaxed text-pretty text-ink-2">
            {t('marketing.landing.hero.lede')}
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Button
              asChild
              variant="primary"
              size="lg"
              shape="pill"
              iconAfter={<ArrowRight aria-hidden className="size-4" />}
              className="w-full sm:w-auto"
            >
              <Link to="/register">{t('marketing.action.startPlanning')}</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              shape="pill"
              className="w-full sm:w-auto"
            >
              <Link to="/pricing">{t('marketing.landing.hero.secondary')}</Link>
            </Button>
          </div>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUST_NOTES.map((note) => (
              <li
                key={note}
                className="flex items-center gap-1.5 text-caption text-ink-3"
              >
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-brand"
                />
                {t(note)}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 animate-rise [animation-delay:120ms] sm:mt-16 lg:mt-20">
          <AppPreview className="mx-auto w-full max-w-6xl" />
        </div>
      </div>
    </section>
  )
}
