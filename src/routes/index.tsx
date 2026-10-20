import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import {
  BillingIntervalToggle,
  ClosingCta,
  FaqList,
  FeatureSpotlights,
  HonestProof,
  LANDING_ANCHORS,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
  ModuleGrid,
  PlanCardGrid,
  Section,
  SectionIntro,
  SkipToContent,
  intervalNote,
} from '#/components/marketing'
import { Button } from '#/components/ui'
import { PAID_PLAN_LIST, PLAN_LIST } from '#/lib/plans'
import { formatPrice } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { PLAN_COPY } from '#/lib/plan-copy'

import type { MessageKey } from '#/lib/i18n'
import type { BillingInterval, PlanPrice } from '#/lib/plans'

const SITE_URL = 'https://planned.travel'
const TITLE = 'planned.travel — plan the trip, not the spreadsheet'
const DESCRIPTION =
  'One itinerary on a real map, shared live with everyone travelling — with the bookings, the shared costs, the packing lists, the journal and a world map of everywhere you have been. Two trips free, forever.'

/**
 * Structured data for the landing page, built from the plan catalogue so the
 * prices a search engine reads can never drift from the prices on the page.
 * Deliberately contains no ratings or review counts: we have none.
 */
const STRUCTURED_DATA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'planned.travel',
  applicationCategory: 'TravelApplication',
  operatingSystem: 'Any modern web browser',
  url: SITE_URL,
  description: DESCRIPTION,
  featureList: [
    'Collaborative day-by-day itinerary planner on an interactive map',
    'Reservations and transport legs with confirmation codes',
    'Shared expenses with settle-up transfers',
    'Packing, to-do and shopping lists',
    'Travel journal',
    'World-map visited-country tracker',
    'Time-off and vacation planner',
  ],
  offers: PLAN_LIST.map((plan) => {
    const price = plan.prices.monthly
    return {
      '@type': 'Offer',
      name: plan.name,
      description: plan.description,
      price: price === null ? '0' : (price.amount / 100).toFixed(2),
      priceCurrency: price === null ? 'USD' : price.currency.toUpperCase(),
    }
  }),
})

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: SITE_URL },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: SITE_URL }],
    scripts: [{ type: 'application/ld+json', children: STRUCTURED_DATA }],
  }),
  component: LandingPage,
})

/**
 * The five questions, as catalogue keys.
 *
 * The last pair is the pricing page's own. Both pages asked whether you can get
 * your data out, and the answer was the same sentence in both files — one
 * sentence with two homes is one sentence that can be edited in one of them, so
 * the landing page reads the pricing key rather than a copy of it.
 */
const FAQ_KEYS: ReadonlyArray<{
  readonly question: MessageKey
  readonly answer: MessageKey
}> = [
  {
    question: 'marketing.landing.faq.seats.q',
    answer: 'marketing.landing.faq.seats.a',
  },
  {
    question: 'marketing.landing.faq.phone.q',
    answer: 'marketing.landing.faq.phone.a',
  },
  {
    question: 'marketing.landing.faq.privacy.q',
    answer: 'marketing.landing.faq.privacy.a',
  },
  {
    question: 'marketing.landing.faq.stop.q',
    answer: 'marketing.landing.faq.stop.a',
  },
  {
    question: 'marketing.pricing.faq.export.q',
    answer: 'marketing.pricing.faq.export.a',
  },
]

function LandingPage() {
  const t = useTranslate()
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <SkipToContent />
      <MarketingHeader anchors={LANDING_ANCHORS} />

      <main id="main" className="flex-1">
        <MarketingHero />
        <FeatureSpotlights />
        <ModuleGrid />
        <HonestProof />
        <PricingSummary />
        <Questions />
        <ClosingCta
          heading={t('marketing.cta.heading')}
          lede={t('marketing.cta.lede')}
        />
      </main>

      <MarketingFooter />
    </div>
  )
}

/* --------------------------------------------------------- pricing summary */

/**
 * The lowest monthly price in the catalogue, unformatted — or `null` when this
 * deployment sells nothing. Read from `src/lib/plans.ts` so the copy below never
 * repeats a figure that lives there.
 */
const CHEAPEST_PAID_MONTHLY: PlanPrice | null =
  PAID_PLAN_LIST.reduce<PlanPrice | null>((best, plan) => {
    const price = plan.prices.monthly
    if (price === null) return best
    return best === null || price.amount < best.amount ? price : best
  }, null)

/**
 * Which of the two plan ledes this deployment can honestly show.
 *
 * A deployment that sells nothing has no cheapest price to name, and naming one
 * anyway would be the restated price §7 forbids. Whether there is a price is a
 * fact about the build, so the choice stays here; the figure itself is formatted
 * against the reader's locale in the component, and never written into a
 * catalogue file.
 */
const PLANS_LEDE_KEY: MessageKey =
  CHEAPEST_PAID_MONTHLY === null
    ? 'marketing.landing.plans.ledeFree'
    : 'marketing.landing.plans.lede'

function PricingSummary() {
  const t = useTranslate()
  const locale = useLocale()
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly')
  const cheapest =
    CHEAPEST_PAID_MONTHLY === null
      ? ''
      : formatPrice(
          CHEAPEST_PAID_MONTHLY.amount,
          CHEAPEST_PAID_MONTHLY.currency,
          locale,
        )

  return (
    <Section
      id="plans"
      tone="tint"
      aria-labelledby="plans-heading"
      className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]"
    >
      <SectionIntro
        headingId="plans-heading"
        eyebrow={t('marketing.anchor.plans')}
        title={t('marketing.landing.plans.title')}
        lede={t(PLANS_LEDE_KEY, { price: cheapest })}
      />

      <BillingIntervalToggle
        value={interval}
        onChange={setBillingInterval}
        note={intervalNote(t, interval)}
        className="mt-9"
      />

      <PlanCardGrid interval={interval} density="compact" className="mt-10" />

      <div className="mt-8 flex justify-center">
        <Button
          asChild
          variant="ghost"
          size="md"
          shape="pill"
          iconAfter={<ArrowRight aria-hidden className="size-4" />}
        >
          <Link to="/pricing">{t('marketing.landing.plans.compare')}</Link>
        </Button>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ questions */

export function Questions() {
  const t = useTranslate()
  return (
    <Section
      id="questions"
      aria-labelledby="questions-heading"
      className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]"
    >
      <SectionIntro
        headingId="questions-heading"
        eyebrow={t('marketing.pricing.questions.eyebrow')}
        title={t('marketing.landing.questions.title')}
        lede={t('marketing.landing.questions.lede')}
      />
      <FaqList
        items={FAQ_KEYS.map((item) => ({
          question: t(item.question),
          // Three of the answers name a plan, and a plan's name is translated:
          // `PLAN_COPY` is the one place that says so, so the sentences take
          // these rather than spelling `Crew` into twenty-three files.
          answer: t(item.answer, {
            free: t(PLAN_COPY.free.name),
            solo: t(PLAN_COPY.solo.name),
            crew: t(PLAN_COPY.crew.name),
          }),
        }))}
        className="mt-12 lg:mt-14"
      />
    </Section>
  )
}
