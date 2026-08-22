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
  billingFooter,
  dateLabel,
  firstName,
  intervalLabel,
  seatLabel,
} from '../format'
import { formatMoneyMinor } from '#/lib/format'

import type { BillingInterval } from '#/lib/plans'
import type { EmailBrand, EmailFact } from '../layout'

export interface PaymentFailedEmailProps {
  readonly brand: EmailBrand
  readonly name: string
  readonly organizationName: string
  readonly planName: string
  readonly interval: BillingInterval
  /** The amount Polar could not take, in minor units. */
  readonly amountMinor: number
  /** ISO 4217 code of the attempted charge. */
  readonly currency: string
  /** Seats billed, or `null` when the plan is not seat-based. */
  readonly seats: number | null
  /** ISO instant of Polar's next retry, or `null` when there will not be one. */
  readonly nextAttemptAt: string | null
  /** ISO instant the subscription lapses if the charge never clears. */
  readonly lapsesAt: string | null
  /** Hosted Polar Customer Portal URL, where the card is changed. */
  readonly portalUrl: string
}

export function PaymentFailedEmail({
  brand,
  name,
  organizationName,
  planName,
  interval,
  amountMinor,
  currency,
  seats,
  nextAttemptAt,
  lapsesAt,
  portalUrl,
}: PaymentFailedEmailProps) {
  const amount = formatMoneyMinor(amountMinor, currency)
  const facts: Array<EmailFact> = [
    { label: 'Workspace', value: organizationName },
    { label: 'Plan', value: planName },
    { label: 'Billing', value: intervalLabel(interval) },
  ]
  if (seats !== null) {
    facts.push({ label: 'Seats', value: seatLabel(seats) })
  }
  facts.push({ label: 'Amount due', value: amount })
  facts.push({
    label: 'Next attempt',
    value: nextAttemptAt === null ? 'No further attempt' : dateLabel(nextAttemptAt),
  })

  return (
    <EmailShell
      brand={brand}
      eyebrow="Billing"
      preview={`${amount} for ${organizationName} could not be taken.`}
      heading="We could not take this payment"
      footer={billingFooter(organizationName)}
    >
      <EmailCallout tone="danger">
        The payment method on file for {organizationName} was declined, so this
        period of {planName} is unpaid.
      </EmailCallout>
      <EmailParagraph>
        Hi <EmailEmphasis>{firstName(name)}</EmailEmphasis> — nothing has been
        switched off and nobody has lost access. Updating the card is usually
        all it takes.
      </EmailParagraph>
      <EmailFacts facts={facts} />
      <EmailParagraph>
        {nextAttemptAt === null
          ? 'Update the payment method in the billing portal and Polar charges it straight away.'
          : `Update the payment method in the billing portal and Polar charges it straight away, otherwise it retries on ${dateLabel(nextAttemptAt)}.`}
      </EmailParagraph>
      <EmailAction label="Update payment method" url={portalUrl} />
      <EmailFootnote>
        {lapsesAt === null
          ? 'If the charge never clears, the workspace moves to the Free plan and its Free limits apply again. Nothing is deleted.'
          : `If it is still unpaid on ${dateLabel(lapsesAt)}, ${organizationName} moves to the Free plan and its Free limits apply again. Nothing is deleted.`}
      </EmailFootnote>
    </EmailShell>
  )
}
