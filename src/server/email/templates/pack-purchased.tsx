import {
  EmailAction,
  EmailEmphasis,
  EmailFacts,
  EmailFootnote,
  EmailParagraph,
  EmailShell,
} from '../layout'
import { billingFooter, firstName } from '../format'
import { formatMoneyMinor, pluralise } from '#/lib/format'

import type { EmailBrand } from '../layout'

/**
 * Props are deliberately primitive. Place packs are a later phase and there is
 * no pack entity to import yet, so this template is written against the four
 * facts a receipt needs rather than against a type that does not exist.
 */
export interface PackPurchasedEmailProps {
  readonly brand: EmailBrand
  readonly name: string
  readonly organizationName: string
  readonly packName: string
  /** How many places the pack adds to the workspace's library. */
  readonly placeCount: number
  /** What was charged, in minor units. */
  readonly amountMinor: number
  /** ISO 4217 code of the charge. */
  readonly currency: string
  /** Absolute URL that opens the pack inside the app. */
  readonly packUrl: string
  /** Hosted Polar Customer Portal URL, where the receipt lives. */
  readonly portalUrl: string
}

export function PackPurchasedEmail({
  brand,
  name,
  organizationName,
  packName,
  placeCount,
  amountMinor,
  currency,
  packUrl,
  portalUrl,
}: PackPurchasedEmailProps) {
  const places = pluralise(placeCount, 'place')

  return (
    <EmailShell
      brand={brand}
      eyebrow="Packs"
      preview={`${packName} is unlocked for ${organizationName}.`}
      heading={`${packName} is unlocked`}
      footer={billingFooter(organizationName)}
    >
      <EmailParagraph>
        Hi <EmailEmphasis>{firstName(name)}</EmailEmphasis> —{' '}
        <EmailEmphasis>{packName}</EmailEmphasis> is now part of the place
        library for <EmailEmphasis>{organizationName}</EmailEmphasis>. Its{' '}
        {places} are searchable from the map and drop straight into an
        itinerary, with no import step.
      </EmailParagraph>
      <EmailFacts
        facts={[
          { label: 'Workspace', value: organizationName },
          { label: 'Places', value: places },
          { label: 'Paid', value: formatMoneyMinor(amountMinor, currency) },
        ]}
      />
      <EmailAction
        label="Open the pack"
        url={packUrl}
        secondary={{ label: 'View the receipt', url: portalUrl }}
      />
      <EmailFootnote>
        A pack is bought once and stays with the workspace. Everyone who can see
        the workspace can use it, and it survives a plan change in either
        direction.
      </EmailFootnote>
    </EmailShell>
  )
}
