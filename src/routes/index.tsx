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
import { PAID_PLAN_LIST, PLAN_LIST, formatPlanAmount } from '#/lib/plans'

import type { FaqItem } from '#/components/marketing'
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

const FAQ: ReadonlyArray<FaqItem> = [
  {
    question: 'Do the people I travel with need to pay too?',
    answer:
      'No. Everyone you invite into a Crew workspace is covered by its seats. They sign in with their own account and see only the trips you added them to.',
  },
  {
    question: 'Does it work properly on a phone?',
    answer:
      'Yes. The mobile layouts are drawn separately rather than squeezed down from the desktop ones, and it is a website, so there is nothing to install and nothing to keep updated.',
  },
  {
    question: 'Can I use the map without a signal?',
    answer:
      'Solo and Crew can download a region before you fly, so the map still draws when you land with no data. Editing the trip itself needs a connection.',
  },
  {
    question: 'Who can see my trip?',
    answer:
      'A trip belongs to one workspace, and only the people invited into that workspace can open it. Nothing is public, there is no discovery feed, and nothing is shared with anyone else by default.',
  },
  {
    question: 'What happens to my trips if I stop paying?',
    answer:
      'Nothing is deleted. The paid modules lock, your trips stay exactly where they are, and everything unlocks again the moment you subscribe. Free stays free with no countdown.',
  },
  {
    question: 'Can I get my data out again?',
    answer:
      'Always. Every trip exports as a PDF itinerary and as a calendar file, and your places export as GeoJSON. It is your travel, not ours.',
  },
]

function LandingPage() {
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
          heading="Your next trip is already worth planning properly"
          lede="Two trips, the whole map, the itinerary and the packing lists — free, with no card and no countdown."
        />
      </main>

      <MarketingFooter />
    </div>
  )
}

/* --------------------------------------------------------- pricing summary */

/**
 * The lowest monthly figure in the catalogue, formatted — or `null` when this
 * deployment sells nothing. Derived at module scope so the copy below never
 * repeats a price that lives in `src/lib/plans.ts`.
 */
const CHEAPEST_PAID_MONTHLY: string | null = (() => {
  const lowest = PAID_PLAN_LIST.reduce<PlanPrice | null>((best, plan) => {
    const price = plan.prices.monthly
    if (price === null) return best
    return best === null || price.amount < best.amount ? price : best
  }, null)
  return lowest === null
    ? null
    : formatPlanAmount(lowest.amount, lowest.currency)
})()

const PLANS_LEDE =
  CHEAPEST_PAID_MONTHLY === null
    ? 'Every plan includes the day planner, the map, budgets and packing lists. Paid plans unlock unlimited trips, reservations, the journal, offline maps and exports.'
    : `Every plan includes the day planner, the map, budgets and packing lists. Paid plans — from ${CHEAPEST_PAID_MONTHLY} a month — unlock unlimited trips, reservations, the journal, offline maps and exports.`

function PricingSummary() {
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly')

  return (
    <Section
      id="plans"
      tone="tint"
      aria-labelledby="plans-heading"
      className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]"
    >
      <SectionIntro
        headingId="plans-heading"
        eyebrow="Plans"
        title="Start free. Pay only once it earns it."
        lede={PLANS_LEDE}
      />

      <BillingIntervalToggle
        value={interval}
        onChange={setBillingInterval}
        note={intervalNote(interval)}
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
          <Link to="/pricing">Compare every limit, line by line</Link>
        </Button>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ questions */

function Questions() {
  return (
    <Section
      id="questions"
      aria-labelledby="questions-heading"
      className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]"
    >
      <SectionIntro
        headingId="questions-heading"
        eyebrow="Before you ask"
        title="Questions, answered plainly"
        lede="The six things people actually want to know before they start planning."
      />
      <FaqList items={FAQ} className="mt-12 lg:mt-14" />
    </Section>
  )
}
