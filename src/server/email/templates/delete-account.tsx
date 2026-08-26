import {
  EmailAction,
  EmailCallout,
  EmailEmphasis,
  EmailFootnote,
  EmailParagraph,
  EmailShell,
} from '../layout'
import { AUTH_FOOTER, firstName } from '../format'

import type { EmailBrand } from '../layout'

export interface DeleteAccountEmailProps {
  readonly brand: EmailBrand
  readonly name: string
  /** Absolute URL that confirms and performs the deletion. */
  readonly url: string
}

export function DeleteAccountEmail({
  brand,
  name,
  url,
}: DeleteAccountEmailProps) {
  return (
    <EmailShell
      brand={brand}
      eyebrow="Security"
      preview="This one cannot be undone."
      heading="Confirm account deletion"
      footer={AUTH_FOOTER}
    >
      <EmailParagraph>
        Hi <EmailEmphasis>{firstName(name)}</EmailEmphasis> — confirming will
        permanently delete your {brand.appName} account.
      </EmailParagraph>
      <EmailCallout tone="danger">
        Your trips, saved places, journal entries and uploaded files go with it.
        There is no undo and no backup we can restore from.
      </EmailCallout>
      <EmailAction label="Delete my account" url={url} showRawUrl />
      <EmailFootnote>
        If you did not ask for this, ignore this email and nothing will change.
      </EmailFootnote>
    </EmailShell>
  )
}
