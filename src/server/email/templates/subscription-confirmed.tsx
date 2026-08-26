import {
  EmailAction,
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

export interface SubscriptionConfirmedEmailProps {
  readonly brand: EmailBrand
  readonly name: string
  readonly organizationName: string
  readonly planName: string
  readonly interval: BillingInterval
  /** What Polar charges each period for the whole subscription, in minor units. */
  readonly amountMinor: number
  /** ISO 4217 code of the charge. */
  readonly currency: string
  /** Seats paid for, or `null` when the plan is not seat-based. */
  readonly seats: number | null
  /** ISO instant of the next renewal, or `null` when Polar has not set one. */
  readonly renewsAt: string | null
  /** Hosted Polar Customer Portal URL for this customer. */
  readonly portalUrl: string
}

export function SubscriptionConfirmedEmail({
  brand,
  name,
  organizationName,
  planName,
  interval,
  amountMinor,
  currency,
  seats,
  renewsAt,
  portalUrl,
}: SubscriptionConfirmedEmailProps) {
  const facts: Array<EmailFact> = [
    { label: 'Workspace', value: organizationName },
    { label: 'Plan', value: planName },
    { label: 'Billing', value: intervalLabel(interval) },
  ]
  if (seats !== null) {
    facts.push({ label: 'Seats', value: seatLabel(seats) })
  }
  facts.push({
    label: 'Amount',
    value: amountPerPeriod(amountMinor, currency, interval),
  })
  if (renewsAt !== null) {
    facts.push({ label: 'Renews', value: dateLabel(renewsAt) })
  }

  return (
    <EmailShell
      brand={brand}
      eyebrow="Billing"
      preview={`${planName} is live for ${organizationName}.`}
      heading={`${planName} is live`}
      footer={billingFooter(organizationName)}
    >
      <EmailParagraph>
        Hi <EmailEmphasis>{firstName(name)}</EmailEmphasis> —{' '}
        <EmailEmphasis>{organizationName}</EmailEmphasis> is on {planName} from
        today. Everything the plan includes is already switched on; nobody has
        to do anything else.
      </EmailParagraph>
      <EmailFacts facts={facts} />
      <EmailParagraph>
        Invoices, receipts and the card on file all live in the billing portal.
      </EmailParagraph>
      <EmailAction label="Manage billing" url={portalUrl} />
      <EmailFootnote>
        Polar is the merchant of record for this purchase, so it works out the
        tax and issues the invoice you can hand to an accountant.
      </EmailFootnote>
    </EmailShell>
  )
}
