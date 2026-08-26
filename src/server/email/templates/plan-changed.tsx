import {
  EmailAction,
  EmailCallout,
  EmailEmphasis,
  EmailFacts,
  EmailFootnote,
  EmailParagraph,
  EmailShell,
} from '../layout'
import {
  amountPerPeriod,
  billingFooter,
  dateLabel,
  firstName,
  intervalLabel,
  seatLabel,
} from '../format'

import type { BillingInterval } from '#/lib/plans'
import type { EmailBrand, EmailFact } from '../layout'

/**
 * A change Polar accepted but has not applied yet.
 *
 * `changePlan()` produces two outcomes and this is the one that distinguishes
 * them: `null` means Polar applied the change on the spot, non-null means it
 * scheduled the change for the end of the period the customer has already paid
 * for and nothing is billed today. The field names are the ones the billing
 * domain's `pendingChange` uses, with the plan resolved to its display name and
 * its per-period cost added, because an email that names a future plan without
 * naming its price is not worth sending.
 */
export interface PendingPlanChange {
  readonly planName: string
  readonly interval: BillingInterval
  /** Seats the scheduled plan will bill, or `null` when it is not seat-based. */
  readonly seats: number | null
  /** Per-period cost once it lands, in minor units of the parent's currency. */
  readonly amountMinor: number
  /** ISO instant Polar applies it: the end of the period already paid for. */
  readonly effectiveAt: string
}

export interface PlanChangedEmailProps {
  readonly brand: EmailBrand
  readonly name: string
  readonly organizationName: string
  /** The plan the workspace was on before this request. */
  readonly previousPlanName: string
  /** The plan in force right now — unchanged when `pendingChange` is set. */
  readonly planName: string
  readonly interval: BillingInterval
  /** Per-period cost of the plan in force, in minor units. */
  readonly amountMinor: number
  /** ISO 4217 code of the charge. */
  readonly currency: string
  /** Seats billed, or `null` when the plan is not seat-based. */
  readonly seats: number | null
  readonly pendingChange: PendingPlanChange | null
  /** Hosted Polar Customer Portal URL for this customer. */
  readonly portalUrl: string
}

export function PlanChangedEmail(props: PlanChangedEmailProps) {
  const {
    brand,
    name,
    organizationName,
    previousPlanName,
    planName,
    interval,
    amountMinor,
    currency,
    seats,
    pendingChange,
    portalUrl,
  } = props

  if (pendingChange !== null) {
    const lands = dateLabel(pendingChange.effectiveAt)
    const facts: Array<EmailFact> = [
      { label: 'Workspace', value: organizationName },
      { label: 'In force', value: `${planName} until ${lands}` },
      { label: 'Scheduled', value: `${pendingChange.planName} from ${lands}` },
      { label: 'Billing', value: intervalLabel(pendingChange.interval) },
    ]
    if (pendingChange.seats !== null) {
      facts.push({ label: 'Seats', value: seatLabel(pendingChange.seats) })
    }
    facts.push({
      label: 'New amount',
      value: amountPerPeriod(
        pendingChange.amountMinor,
        currency,
        pendingChange.interval,
      ),
    })

    return (
      <EmailShell
        brand={brand}
        eyebrow="Billing"
        preview={`${planName} until ${lands}, then ${pendingChange.planName}.`}
        heading={`${pendingChange.planName} from ${lands}`}
        footer={billingFooter(organizationName)}
      >
        <EmailCallout tone="brand">
          Nothing is billed today. The change takes effect on {lands}, when the
          period you have already paid for ends.
        </EmailCallout>
        <EmailParagraph>
          Hi <EmailEmphasis>{firstName(name)}</EmailEmphasis> — Polar has
          scheduled the move to{' '}
          <EmailEmphasis>{pendingChange.planName}</EmailEmphasis> for{' '}
          <EmailEmphasis>{organizationName}</EmailEmphasis>. Until then the
          workspace keeps {planName} and every limit that comes with it, so
          nothing you have built changes in the meantime.
        </EmailParagraph>
        <EmailFacts facts={facts} />
        <EmailAction label="Manage billing" url={portalUrl} />
        <EmailFootnote>
          Choosing another plan before {lands} replaces this scheduled change
          and applies straight away, so the switch you make last is the one that
          counts.
        </EmailFootnote>
      </EmailShell>
    )
  }

  const facts: Array<EmailFact> = [
    { label: 'Workspace', value: organizationName },
    { label: 'Was', value: previousPlanName },
    { label: 'Now', value: planName },
    { label: 'Billing', value: intervalLabel(interval) },
  ]
  if (seats !== null) {
    facts.push({ label: 'Seats', value: seatLabel(seats) })
  }
  facts.push({
    label: 'Amount',
    value: amountPerPeriod(amountMinor, currency, interval),
  })

  return (
    <EmailShell
      brand={brand}
      eyebrow="Billing"
      preview={`${organizationName} moved from ${previousPlanName} to ${planName}.`}
      heading={`You are now on ${planName}`}
      footer={billingFooter(organizationName)}
    >
      <EmailParagraph>
        Hi <EmailEmphasis>{firstName(name)}</EmailEmphasis> —{' '}
        <EmailEmphasis>{organizationName}</EmailEmphasis> has moved from{' '}
        {previousPlanName} to {planName}, and the change is in force now.
      </EmailParagraph>
      <EmailFacts facts={facts} />
      <EmailParagraph>
        Polar works out the difference for the part of this period you had
        already paid for and settles it against your invoices. The exact figure
        is in the billing portal.
      </EmailParagraph>
      <EmailAction label="Manage billing" url={portalUrl} />
      <EmailFootnote>
        Polar is the merchant of record for this subscription, so it works out
        the tax and issues the invoice you can hand to an accountant.
      </EmailFootnote>
    </EmailShell>
  )
}
