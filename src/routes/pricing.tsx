import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Minus, Sparkles } from 'lucide-react'

import {
  BillingIntervalToggle,
  ClosingCta,
  Eyebrow,
  FaqList,
  MarketingFooter,
  MarketingHeader,
  PlanCardGrid,
  Section,
  SectionIntro,
  SkipToContent,
  intervalNote,
} from '#/components/marketing'
import { Card } from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  MODULE_KEYS,
  PLAN_LIST,
  QUOTA_KEYS,
  QUOTA_LABELS,
  formatQuota,
} from '#/lib/plans'

import type { FaqItem, MarketingAnchor } from '#/components/marketing'
import type { BillingInterval, ModuleKey } from '#/lib/plans'

const TITLE = 'Pricing — planned.travel'
const DESCRIPTION =
  'Plan two trips for nothing. Unlock every module for one traveller, or bring the whole crew along and edit the same itinerary at once.'
const URL = 'https://planned.travel/pricing'

export const Route = createFileRoute('/pricing')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: URL },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
  component: PricingPage,
})

const ANCHORS: ReadonlyArray<MarketingAnchor> = [
  { href: '#plans', label: 'Plans' },
  { href: '#compare', label: 'Compare' },
  { href: '#questions', label: 'Questions' },
]

/** Human labels for the feature switches, in the order they are compared. */
const MODULE_LABELS: { readonly [K in ModuleKey]: string } = {
  itinerary: 'Day-by-day itinerary',
  map: 'Interactive map',
  budget: 'Budgets and expense splitting',
  packing: 'Packing and to-do lists',
  reservations: 'Reservations and bookings',
  journal: 'Travel journal',
  atlas: 'World-map tracker',
  collaboration: 'Invite other travellers',
  realtime: 'Live collaboration',
  offlineMaps: 'Offline maps',
  pdfExport: 'PDF and calendar export',
  prioritySupport: 'Priority support',
}

const FAQ: ReadonlyArray<FaqItem> = [
  {
    question: 'What happens when a trial ends?',
    answer:
      'The trial converts into the paid plan. Polar takes a payment method when the trial starts and charges it the day the trial ends, so cancel before then and you are never charged. Nothing is ever deleted either way: the paid modules lock, your trips stay exactly where they are, and everything unlocks again the moment you subscribe.',
  },
  {
    question: 'Who am I actually buying from?',
    answer:
      'Polar. They are our merchant of record, which means they sell the subscription to you as our reseller, take the payment, issue the invoice in their own name, and determine, collect and remit the sales tax or VAT your country charges. Refunds and card disputes are settled with them too. We are still the people who run the service and answer your email.',
  },
  {
    question: 'Can I change plan halfway through a trip?',
    answer:
      'Yes. Upgrades apply immediately and are prorated to the day; downgrades take effect at the end of the period you have already paid for, so you never lose access you paid for.',
  },
  {
    question: 'How does per-member billing work on Crew?',
    answer:
      'You pay for the seats you actually fill, and you can change the number at any time. Outstanding invitations count against your seats, so a workspace can never quietly oversubscribe the plan.',
  },
  {
    question: 'Do the people I travel with need their own subscription?',
    answer:
      'No. Everyone you invite into a Crew workspace is covered by its seats. They sign in with their own account and see the trips they have been added to.',
  },
  {
    question: 'What counts towards storage?',
    answer:
      'Photographs, tickets, confirmations and any file you attach to a trip. Map tiles and the app itself never count. You can see exactly what is using space in Settings.',
  },
  {
    question: 'Can I get my data out?',
    answer:
      'Always. Every trip exports as a PDF itinerary and as a calendar file, and your places export as GeoJSON. It is your travel, not ours.',
  },
]

function PricingPage() {
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly')

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <SkipToContent />
      <MarketingHeader anchors={ANCHORS} />

      <main id="main" className="flex-1">
        <PlansBand interval={interval} onIntervalChange={setBillingInterval} />
        <Comparison />
        <Questions />
        <ClosingCta
          heading="Your next trip is already worth planning properly"
          lede="Two trips, the whole map, the itinerary and the packing lists — free, with no card and no countdown."
          secondary={{ label: 'See how it works', to: '/' }}
        />
      </main>

      <MarketingFooter />
    </div>
  )
}

/* -------------------------------------------------------------- plans band */

function PlansBand({
  interval,
  onIntervalChange,
}: {
  interval: BillingInterval
  onIntervalChange: (next: BillingInterval) => void
}) {
  return (
    <section
      id="plans"
      aria-labelledby="plans-heading"
      className="relative isolate scroll-mt-[var(--nav-h)] overflow-hidden border-b border-edge-faint"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[26rem] bg-linear-to-b from-brand-subtle via-canvas to-canvas" />
        <div className="absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-brand/12 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-content px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Eyebrow icon={<Sparkles />}>Two trips free, forever</Eyebrow>
          <h1
            id="plans-heading"
            className="mt-6 font-display text-headline text-balance text-ink"
          >
            Plan it properly.
            <br />
            <span className="text-ink-3">Pay for what you use.</span>
          </h1>
          <p className="mt-6 max-w-xl text-subtitle font-normal leading-relaxed text-pretty text-ink-2">
            {DESCRIPTION}
          </p>
        </div>

        <BillingIntervalToggle
          value={interval}
          onChange={onIntervalChange}
          note={intervalNote(interval)}
          className="mt-10"
        />

        <PlanCardGrid interval={interval} className="mt-12" />

        <p className="mx-auto mt-8 max-w-2xl text-center text-caption text-ink-4">
          Prices in US dollars, excluding sales tax or VAT. Polar is our
          merchant of record: it is the seller on your invoice, and it works out
          what your country charges, adds it at checkout and remits it. Cancel
          whenever you like, from inside the product.
        </p>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- comparison */

function IncludedCell({
  included,
  planName,
}: {
  included: boolean
  planName: string
}) {
  return included ? (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full bg-brand-subtle text-brand"
      title={`Included in ${planName}`}
    >
      <Check aria-hidden className="size-3.5" strokeWidth={3} />
      <span className="sr-only">Included</span>
    </span>
  ) : (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full bg-surface-2 text-ink-4"
      title={`Not in ${planName}`}
    >
      <Minus aria-hidden className="size-3.5" />
      <span className="sr-only">Not included</span>
    </span>
  )
}

/** The sticky first column keeps the feature name visible while the table scrolls. */
const rowHeadClasses = cn(
  'sticky left-0 z-10 bg-surface px-5 py-3.5 text-left text-label font-medium text-ink',
)

function Comparison() {
  return (
    <Section
      id="compare"
      tone="tint"
      aria-labelledby="compare-heading"
      className="scroll-mt-[var(--nav-h)]"
    >
      <SectionIntro
        headingId="compare-heading"
        eyebrow="Side by side"
        title="Every limit, compared"
        lede="One table, generated from the same catalogue the billing system reads. If a row says a module is included, the entitlement check agrees with it."
      />

      <Card padding="none" className="mt-12 overflow-hidden lg:mt-14">
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-left">
            <caption className="sr-only">
              Feature and limit comparison across all three plans
            </caption>
            <thead>
              <tr className="border-b border-edge">
                <th
                  scope="col"
                  className={cn(
                    rowHeadClasses,
                    'text-micro font-semibold uppercase tracking-label text-ink-3',
                  )}
                >
                  Feature
                </th>
                {PLAN_LIST.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className="w-32 px-5 py-4 text-center font-display text-subtitle font-bold text-ink"
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-surface-2/60">
                <th
                  scope="colgroup"
                  colSpan={PLAN_LIST.length + 1}
                  className="px-5 py-2.5 text-left text-micro font-semibold uppercase tracking-label text-ink-3"
                >
                  Limits
                </th>
              </tr>
              {QUOTA_KEYS.map((key) => (
                <tr key={key} className="border-b border-edge-faint">
                  <th scope="row" className={rowHeadClasses}>
                    {QUOTA_LABELS[key]}
                  </th>
                  {PLAN_LIST.map((plan) => (
                    <td
                      key={plan.id}
                      className="px-5 py-3.5 text-center text-label tabular-nums text-ink-2"
                    >
                      {formatQuota(key, plan.limits[key])}
                    </td>
                  ))}
                </tr>
              ))}

              <tr className="bg-surface-2/60">
                <th
                  scope="colgroup"
                  colSpan={PLAN_LIST.length + 1}
                  className="px-5 py-2.5 text-left text-micro font-semibold uppercase tracking-label text-ink-3"
                >
                  Modules
                </th>
              </tr>
              {MODULE_KEYS.map((key) => (
                <tr
                  key={key}
                  className="border-b border-edge-faint last:border-b-0"
                >
                  <th scope="row" className={rowHeadClasses}>
                    {MODULE_LABELS[key]}
                  </th>
                  {PLAN_LIST.map((plan) => (
                    <td key={plan.id} className="px-5 py-3.5 text-center">
                      <IncludedCell
                        included={plan.limits[key]}
                        planName={plan.name}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Section>
  )
}

/* ------------------------------------------------------------------ questions */

function Questions() {
  return (
    <Section
      id="questions"
      aria-labelledby="questions-heading"
      className="scroll-mt-[var(--nav-h)]"
    >
      <SectionIntro
        headingId="questions-heading"
        eyebrow="Before you ask"
        title="Questions, answered"
        lede="Billing, trials and getting your data back out again."
      />
      <FaqList items={FAQ} className="mt-12 lg:mt-14" />
    </Section>
  )
}
