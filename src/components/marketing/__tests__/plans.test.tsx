// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  BILLING_INTERVALS,
  PLANS,
  PLAN_LIST,
  formatStorage,
  yearlySavingPercent,
} from '#/lib/plans'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { formatPrice } from '#/lib/format'
import { PLAN_COPY } from '#/lib/plan-copy'
import { I18nProvider, createTranslator } from '#/lib/i18n'
import marketing from '#/lib/i18n/messages/en/marketing'
import settings from '#/lib/i18n/messages/en/settings'
import {
  BillingIntervalToggle,
  PlanCard,
  bestYearlySaving,
  intervalNote,
  planCtaLabel,
  planPriceFootnote,
  planPriceHeadline,
  planPriceSuffix,
  planScopeLine,
} from '../plans'

import { Comparison } from '#/routes/pricing'

import type { Catalogue, MessageKey } from '#/lib/i18n'
import type { ReactNode } from 'react'

afterEach(cleanup)

/**
 * The shipped source catalogue, namespaced the way the translator expects.
 *
 * Built from the real files so a helper pointing at a key nobody wrote fails
 * here — `createTranslator` renders the key itself rather than throwing, which
 * is visible damage a reviewer catches.
 */
/** The catalogue both the translator and the provider read. */
const EN: Catalogue = {
  ...Object.fromEntries(
    Object.entries(marketing).map(([key, message]) => [
      `marketing.${key}`,
      message,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(settings).map(([key, message]) => [
      `settings.${key}`,
      message,
    ]),
  ),
}

const t = createTranslator('en', EN)

/** Renders inside the provider the marketing components require. */
function renderTranslated(ui: ReactNode) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      {ui}
    </I18nProvider>,
  )
}

describe('plan copy helpers', () => {
  it('reads the headline price straight out of the catalogue', () => {
    expect(planPriceHeadline(t, PLANS.free, 'monthly')).toBe('Free')
    expect(planPriceHeadline(t, PLANS.solo, 'monthly')).toBe(
      formatPrice(PLANS.solo.prices.monthly?.amount ?? 0, 'usd'),
    )
  })

  it('shows the yearly price as its monthly equivalent', () => {
    const yearly = PLANS.solo.prices.yearly
    expect(yearly).not.toBeNull()
    if (yearly === null) return

    const headline = planPriceHeadline(t, PLANS.solo, 'yearly')
    expect(headline).toBe(formatPrice(Math.round(yearly.amount / 12), 'usd'))
    // The yearly headline must never be dearer than the monthly one, or the
    // discount chip on the toggle would be lying.
    const monthly = PLANS.solo.prices.monthly
    expect(Math.round(yearly.amount / 12)).toBeLessThanOrEqual(
      monthly?.amount ?? 0,
    )
  })

  it('marks the seat-based plan as billed per member', () => {
    expect(planPriceSuffix(t, PLANS.crew, 'monthly')).toBe('/ member / month')
    expect(planPriceSuffix(t, PLANS.solo, 'monthly')).toBe('/ month')
    expect(planPriceSuffix(t, PLANS.free, 'monthly')).toBeNull()
  })

  it('explains what is actually billed in the footnote', () => {
    // Free asks for nothing, and only free may say so.
    expect(planPriceFootnote(t, PLANS.free, 'monthly')).toBe(
      'No card, no expiry, no countdown',
    )
    expect(planPriceFootnote(t, PLANS.solo, 'monthly')).toBe(
      `${PLANS.solo.trialDays}-day free trial, card up front, charged when it ends`,
    )
    expect(planPriceFootnote(t, PLANS.solo, 'yearly')).toContain('once a year')
    expect(planPriceFootnote(t, PLANS.crew, 'yearly')).toContain('per member')
  })

  it('never tells a paid plan it starts without a card', () => {
    // Polar's checkout collects a payment method when the trial starts — the
    // pricing FAQ and the terms both say so, and no card on a paid plan would
    // contradict them on the same page.
    for (const plan of PLAN_LIST) {
      for (const interval of BILLING_INTERVALS) {
        if (plan.prices[interval] === null) continue
        expect(
          planPriceFootnote(t, plan, interval).toLowerCase(),
        ).not.toContain('no card')
      }
    }
  })

  it('summarises seats and trips in one line', () => {
    expect(planScopeLine(t, PLANS.free)).toBe(
      'One traveller · 2 trips at a time',
    )
    expect(planScopeLine(t, PLANS.crew)).toBe(
      `Up to ${PLANS.crew.seatRange.max} members · unlimited trips`,
    )
  })

  it('names the call to action after the plan', () => {
    expect(planCtaLabel(t, PLANS.free)).toBe('Start for free')
    expect(planCtaLabel(t, PLANS.crew)).toBe('Start the Crew trial')
  })

  it('reports the best yearly saving across the catalogue', () => {
    expect(bestYearlySaving()).toBe(
      Math.max(
        yearlySavingPercent(PLANS.free),
        yearlySavingPercent(PLANS.solo),
        yearlySavingPercent(PLANS.crew),
      ),
    )
    expect(bestYearlySaving([PLANS.free])).toBe(0)
  })

  it('describes each interval differently', () => {
    expect(intervalNote(t, 'monthly')).not.toBe(intervalNote(t, 'yearly'))
  })
})

/**
 * Solo's three named bullets, in the order the card lists them. The fourth states
 * the storage figure, which the card interpolates, so it is asserted separately.
 *
 * One of these is a key the comparison table further down the page uses for the
 * same modules — that reuse is deliberate, and naming them here is what would
 * fail if the card grew a second wording of its own.
 */
const SOLO_BULLETS: ReadonlyArray<MessageKey> = [
  // The settings card says this sentence too, so there is one of it.
  'settings.billing.plan.solo.feature.trips',
  'marketing.pricing.feature.solo.modules',
  'marketing.pricing.module.pdfExport',
]

describe('PlanCard', () => {
  it('renders the plan, its price and every feature from the catalogue', () => {
    renderTranslated(
      <PlanCard
        plan={PLANS.solo}
        interval="monthly"
        cta={<a href="/register">Start</a>}
      />,
    )

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: t(PLAN_COPY.solo.name),
      }),
    ).toBeTruthy()
    expect(screen.getByText(t(PLAN_COPY.solo.tagline))).toBeTruthy()
    expect(
      screen.getByText(planPriceHeadline(t, PLANS.solo, 'monthly')),
    ).toBeTruthy()
    for (const key of SOLO_BULLETS) {
      expect(screen.getByText(t(key))).toBeTruthy()
    }
    expect(
      screen.getByText(
        t('marketing.pricing.feature.storage', {
          size: formatStorage(PLANS.solo.limits.storageBytes ?? 0),
        }),
      ),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Start' })).toBeTruthy()
  })

  it.each(PLAN_LIST)('does not promise offline maps on $id', (plan) => {
    const { container } = renderTranslated(
      <PlanCard plan={plan} interval="monthly" cta={null} />,
    )
    expect(container.textContent).not.toMatch(/offline|download regions/i)
  })

  it('drops the per-feature detail lines at compact density', () => {
    const detail = t('marketing.pricing.feature.solo.modulesDetail')

    const { unmount } = renderTranslated(
      <PlanCard
        plan={PLANS.solo}
        interval="monthly"
        cta={null}
        density="full"
      />,
    )
    expect(screen.queryByText(detail)).not.toBeNull()
    unmount()

    renderTranslated(
      <PlanCard
        plan={PLANS.solo}
        interval="monthly"
        cta={null}
        density="compact"
      />,
    )
    expect(screen.queryByText(detail)).toBeNull()
  })

  it('gives the recommended plan the inverse treatment and a badge', () => {
    const recommended = PLANS.solo.recommended ? PLANS.solo : PLANS.crew
    renderTranslated(
      <PlanCard plan={recommended} interval="monthly" cta={null} />,
    )
    expect(screen.getByText('Most popular')).toBeTruthy()
  })
})

describe('BillingIntervalToggle', () => {
  it('marks the selected interval and reports a change', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderTranslated(
      <BillingIntervalToggle
        value="monthly"
        onChange={onChange}
        note={intervalNote(t, 'monthly')}
      />,
    )

    const monthly = screen.getByRole('button', { name: /monthly/i })
    expect(monthly.getAttribute('aria-pressed')).toBe('true')

    const yearly = screen.getByRole('button', { name: /yearly/i })
    expect(yearly.getAttribute('aria-pressed')).toBe('false')

    await user.click(yearly)
    expect(onChange).toHaveBeenCalledWith('yearly')
  })

  it('labels the group and shows the catalogue saving on the yearly option', () => {
    renderTranslated(
      <BillingIntervalToggle value="yearly" onChange={() => {}} />,
    )
    expect(screen.getByRole('group', { name: 'Billing interval' })).toBeTruthy()

    const saving = bestYearlySaving()
    if (saving > 0) {
      // The chip renders a typographic minus sign, so match on the digits.
      expect(screen.getByText(new RegExp(`^\\D?${saving}%$`))).toBeTruthy()
    }
  })
})

/**
 * The card reads the catalogue, not the English beside the numbers.
 *
 * `plans.ts` still ships an English `name`, `tagline` and `features` for every
 * plan, because the server reads that module and an operator's record wants
 * English — the reasoning `src/lib/plan-copy.ts` records. The card is not that,
 * and every assertion above would stay green if it went back to reading them,
 * because the two say the same sentences in English. This is the difference no
 * rendered output can show.
 */
describe('the card no longer reads the English catalogue', () => {
  const CARD = readFileSync(
    join(process.cwd(), 'src', 'components', 'marketing', 'plans.tsx'),
    'utf8',
  )

  it.each(['name', 'tagline', 'features'])('never renders plan.%s', (field) => {
    // A docblock naming the field is an explanation, not a use, so the source is
    // stripped of comments first — the treatment `plan-copy.test.ts` gives the
    // settings screen for the same reason.
    const code = CARD.replace(/\/\*[\s\S]*?\*\//g, '').replace(
      /^\s*\/\/.*$/gm,
      '',
    )
    expect(code).not.toContain(`plan.${field}`)
  })
})

describe('pricing module comparison', () => {
  it('hides the unbuilt offline feature while retaining shipped modules', () => {
    const { container } = renderTranslated(<Comparison />)
    expect(container.textContent).not.toMatch(/offline|download regions/i)
    expect(
      screen.getByRole('rowheader', {
        name: t('marketing.pricing.module.pdfExport'),
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('rowheader', {
        name: t('marketing.pricing.module.atlas'),
      }),
    ).toBeTruthy()
  })
})
