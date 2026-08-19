// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PLANS, formatPlanAmount, yearlySavingPercent } from '#/lib/plans'
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

afterEach(cleanup)

describe('plan copy helpers', () => {
  it('reads the headline price straight out of the catalogue', () => {
    expect(planPriceHeadline(PLANS.free, 'monthly')).toBe('Free')
    expect(planPriceHeadline(PLANS.solo, 'monthly')).toBe(
      formatPlanAmount(PLANS.solo.prices.monthly?.amount ?? 0, 'usd'),
    )
  })

  it('shows the yearly price as its monthly equivalent', () => {
    const yearly = PLANS.solo.prices.yearly
    expect(yearly).not.toBeNull()
    if (yearly === null) return

    const headline = planPriceHeadline(PLANS.solo, 'yearly')
    expect(headline).toBe(
      formatPlanAmount(Math.round(yearly.amount / 12), 'usd'),
    )
    // The yearly headline must never be dearer than the monthly one, or the
    // discount chip on the toggle would be lying.
    const monthly = PLANS.solo.prices.monthly
    expect(Math.round(yearly.amount / 12)).toBeLessThanOrEqual(
      monthly?.amount ?? 0,
    )
  })

  it('marks the seat-based plan as billed per member', () => {
    expect(planPriceSuffix(PLANS.crew, 'monthly')).toBe('/ member / month')
    expect(planPriceSuffix(PLANS.solo, 'monthly')).toBe('/ month')
    expect(planPriceSuffix(PLANS.free, 'monthly')).toBeNull()
  })

  it('explains what is actually billed in the footnote', () => {
    expect(planPriceFootnote(PLANS.free, 'monthly')).toContain('No card')
    expect(planPriceFootnote(PLANS.solo, 'monthly')).toContain(
      `${PLANS.solo.trialDays}-day free trial`,
    )
    expect(planPriceFootnote(PLANS.solo, 'yearly')).toContain('once a year')
    expect(planPriceFootnote(PLANS.crew, 'yearly')).toContain('per member')
  })

  it('summarises seats and trips in one line', () => {
    expect(planScopeLine(PLANS.free)).toBe('One traveller · 2 trips at a time')
    expect(planScopeLine(PLANS.crew)).toBe(
      `Up to ${PLANS.crew.seatRange.max} members · unlimited trips`,
    )
  })

  it('names the call to action after the plan', () => {
    expect(planCtaLabel(PLANS.free)).toBe('Start for free')
    expect(planCtaLabel(PLANS.crew)).toBe('Start the Crew trial')
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
    expect(intervalNote('monthly')).not.toBe(intervalNote('yearly'))
  })
})

describe('PlanCard', () => {
  it('renders the plan, its price and every feature from the catalogue', () => {
    render(
      <PlanCard
        plan={PLANS.solo}
        interval="monthly"
        cta={<a href="/register">Start</a>}
      />,
    )

    expect(
      screen.getByRole('heading', { level: 3, name: PLANS.solo.name }),
    ).toBeTruthy()
    expect(screen.getByText(PLANS.solo.tagline)).toBeTruthy()
    expect(
      screen.getByText(planPriceHeadline(PLANS.solo, 'monthly')),
    ).toBeTruthy()
    for (const feature of PLANS.solo.features) {
      expect(screen.getByText(feature.label)).toBeTruthy()
    }
    expect(screen.getByRole('link', { name: 'Start' })).toBeTruthy()
  })

  it('drops the per-feature detail lines at compact density', () => {
    const detail = PLANS.solo.features.find((f) => f.detail !== undefined)
    expect(detail?.detail).toBeDefined()
    if (detail?.detail === undefined) return

    const { unmount } = render(
      <PlanCard
        plan={PLANS.solo}
        interval="monthly"
        cta={null}
        density="full"
      />,
    )
    expect(screen.queryByText(detail.detail)).not.toBeNull()
    unmount()

    render(
      <PlanCard
        plan={PLANS.solo}
        interval="monthly"
        cta={null}
        density="compact"
      />,
    )
    expect(screen.queryByText(detail.detail)).toBeNull()
  })

  it('gives the recommended plan the inverse treatment and a badge', () => {
    const recommended = PLANS.solo.recommended ? PLANS.solo : PLANS.crew
    render(<PlanCard plan={recommended} interval="monthly" cta={null} />)
    expect(screen.getByText('Most popular')).toBeTruthy()
  })
})

describe('BillingIntervalToggle', () => {
  it('marks the selected interval and reports a change', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <BillingIntervalToggle
        value="monthly"
        onChange={onChange}
        note={intervalNote('monthly')}
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
    render(<BillingIntervalToggle value="yearly" onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Billing interval' })).toBeTruthy()

    const saving = bestYearlySaving()
    if (saving > 0) {
      // The chip renders a typographic minus sign, so match on the digits.
      expect(screen.getByText(new RegExp(`^\\D?${saving}%$`))).toBeTruthy()
    }
  })
})
