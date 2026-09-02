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
import { useTranslate } from '#/lib/i18n'
import {
  MODULE_KEYS,
  PLAN_LIST,
  QUOTA_KEYS,
  formatQuota,
  isUnlimited,
} from '#/lib/plans'
import { PLAN_COPY, QUOTA_LABEL_KEYS } from '#/lib/plan-copy'

import type { FaqItem, MarketingAnchor } from '#/components/marketing'
import type { MessageKey, Translate } from '#/lib/i18n'
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
  { href: '#plans', labelKey: 'marketing.anchor.plans' },
  { href: '#compare', labelKey: 'marketing.anchor.compare' },
  { href: '#questions', labelKey: 'marketing.anchor.questions' },
]

/**
 * What the comparison table calls each feature switch, in the order compared.
 *
 * `src/server/billing/entitlements.ts` names the same twelve modules in another
 * register — sentence fragments for an error, "does not include the itinerary
 * planner" — and that copy is still English. These are the reader's words, so
 * they are keys.
 */
const MODULE_LABELS: { readonly [K in ModuleKey]: MessageKey } = {
  itinerary: 'marketing.pricing.module.itinerary',
  map: 'marketing.pricing.module.map',
  budget: 'marketing.pricing.module.budget',
  packing: 'marketing.pricing.module.packing',
  reservations: 'marketing.pricing.module.reservations',
  journal: 'marketing.pricing.module.journal',
  atlas: 'marketing.pricing.module.atlas',
  collaboration: 'marketing.pricing.module.collaboration',
  realtime: 'marketing.pricing.module.realtime',
  offlineMaps: 'marketing.pricing.module.offlineMaps',
  pdfExport: 'marketing.pricing.module.pdfExport',
  prioritySupport: 'marketing.pricing.module.prioritySupport',
}

/** The seven questions, as literal key pairs so a typo is a compile error. */
const FAQ_KEYS: ReadonlyArray<{
  readonly question: MessageKey
  readonly answer: MessageKey
}> = [
  {
    question: 'marketing.pricing.faq.trial.q',
    answer: 'marketing.pricing.faq.trial.a',
  },
  {
    question: 'marketing.pricing.faq.seller.q',
    answer: 'marketing.pricing.faq.seller.a',
  },
  {
    question: 'marketing.pricing.faq.change.q',
    answer: 'marketing.pricing.faq.change.a',
  },
  {
    question: 'marketing.pricing.faq.seats.q',
    answer: 'marketing.pricing.faq.seats.a',
  },
  {
    question: 'marketing.pricing.faq.guests.q',
    answer: 'marketing.pricing.faq.guests.a',
  },
  {
    question: 'marketing.pricing.faq.storage.q',
    answer: 'marketing.pricing.faq.storage.a',
  },
  {
    question: 'marketing.pricing.faq.export.q',
    answer: 'marketing.pricing.faq.export.a',
  },
]

/** Built per render, so the answers follow the reader rather than the bundle. */
function faqItems(t: Translate): ReadonlyArray<FaqItem> {
  return FAQ_KEYS.map((entry) => ({
    // Two of these name the seat-based plan, and its name is translated, so
    // `PLAN_COPY` supplies it rather than twenty-three catalogue files.
    question: t(entry.question, { crew: t(PLAN_COPY.crew.name) }),
    answer: t(entry.answer, { crew: t(PLAN_COPY.crew.name) }),
  }))
}

function PricingPage() {
  const t = useTranslate()
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
          heading={t('marketing.cta.heading')}
          lede={t('marketing.cta.lede')}
          secondary={{ label: t('marketing.pricing.cta.secondary'), to: '/' }}
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
  const t = useTranslate()
  return (
    <section
      id="plans"
      aria-labelledby="plans-heading"
      className="relative isolate scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))] overflow-hidden border-b border-edge-faint"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[26rem] bg-linear-to-b from-brand-subtle via-canvas to-canvas" />
        <div className="absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-brand/12 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-content px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Eyebrow icon={<Sparkles />}>
            {t('marketing.pricing.hero.eyebrow')}
          </Eyebrow>
          <h1
            id="plans-heading"
            className="mt-6 font-display text-headline text-balance text-ink"
          >
            {t('marketing.pricing.hero.title')}
            <br />
            <span className="text-ink-3">
              {t('marketing.pricing.hero.titleQuiet')}
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-subtitle font-normal leading-relaxed text-pretty text-ink-2">
            {t('marketing.pricing.hero.lede')}
          </p>
        </div>

        <BillingIntervalToggle
          value={interval}
          onChange={onIntervalChange}
          note={intervalNote(t, interval)}
          className="mt-10"
        />

        <PlanCardGrid interval={interval} className="mt-12" />

        <p className="mx-auto mt-8 max-w-2xl text-center text-caption text-ink-4">
          {t('marketing.pricing.hero.taxNote')}
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
  const t = useTranslate()
  return included ? (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full bg-brand-subtle text-brand"
      title={t('marketing.pricing.compare.includedIn', { plan: planName })}
    >
      <Check aria-hidden className="size-3.5" strokeWidth={3} />
      <span className="sr-only">{t('marketing.pricing.compare.included')}</span>
    </span>
  ) : (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full bg-surface-2 text-ink-4"
      title={t('marketing.pricing.compare.notIn', { plan: planName })}
    >
      <Minus aria-hidden className="size-3.5" />
      <span className="sr-only">
        {t('marketing.pricing.compare.notIncluded')}
      </span>
    </span>
  )
}

/** The sticky first column keeps the feature name visible while the table scrolls. */
const rowHeadClasses = cn(
  'sticky start-0 z-10 bg-surface px-5 py-3.5 text-start text-label font-medium text-ink',
)

function Comparison() {
  const t = useTranslate()
  return (
    <Section
      id="compare"
      tone="tint"
      aria-labelledby="compare-heading"
      className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]"
    >
      <SectionIntro
        headingId="compare-heading"
        eyebrow={t('marketing.pricing.compare.eyebrow')}
        title={t('marketing.pricing.compare.title')}
        lede={t('marketing.pricing.compare.lede')}
      />

      <Card padding="none" className="mt-12 overflow-hidden lg:mt-14">
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-start">
            <caption className="sr-only">
              {t('marketing.pricing.compare.caption')}
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
                  {t('marketing.pricing.compare.feature')}
                </th>
                {PLAN_LIST.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className="w-32 px-5 py-4 text-center font-display text-subtitle font-bold text-ink"
                  >
                    {t(PLAN_COPY[plan.id].name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-surface-2/60">
                <th
                  scope="colgroup"
                  colSpan={PLAN_LIST.length + 1}
                  className="px-5 py-2.5 text-start text-micro font-semibold uppercase tracking-label text-ink-3"
                >
                  {t('marketing.pricing.compare.limits')}
                </th>
              </tr>
              {QUOTA_KEYS.map((key) => (
                <tr key={key} className="border-b border-edge-faint">
                  <th scope="row" className={rowHeadClasses}>
                    {t(QUOTA_LABEL_KEYS[key])}
                  </th>
                  {PLAN_LIST.map((plan) => (
                    <td
                      key={plan.id}
                      className="px-5 py-3.5 text-center text-label tabular-nums text-ink-2"
                    >
                      {isUnlimited(plan.limits[key])
                        ? t('settings.billing.quota.unlimited')
                        : formatQuota(key, plan.limits[key])}
                    </td>
                  ))}
                </tr>
              ))}

              <tr className="bg-surface-2/60">
                <th
                  scope="colgroup"
                  colSpan={PLAN_LIST.length + 1}
                  className="px-5 py-2.5 text-start text-micro font-semibold uppercase tracking-label text-ink-3"
                >
                  {t('marketing.anchor.modules')}
                </th>
              </tr>
              {MODULE_KEYS.map((key) => (
                <tr
                  key={key}
                  className="border-b border-edge-faint last:border-b-0"
                >
                  <th scope="row" className={rowHeadClasses}>
                    {t(MODULE_LABELS[key])}
                  </th>
                  {PLAN_LIST.map((plan) => (
                    <td key={plan.id} className="px-5 py-3.5 text-center">
                      <IncludedCell
                        included={plan.limits[key]}
                        planName={t(PLAN_COPY[plan.id].name)}
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
        title={t('marketing.pricing.questions.title')}
        lede={t('marketing.pricing.questions.lede')}
      />
      <FaqList items={faqItems(t)} className="mt-12 lg:mt-14" />
    </Section>
  )
}
