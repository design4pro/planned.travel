import {
  EmailAction,
  EmailEmphasis,
  EmailFootnote,
  EmailParagraph,
  EmailShell,
} from '../layout'
import { AUTH_FOOTER, firstName } from '../format'

import type { EmailBrand } from '../layout'

export interface EmailChangedEmailProps {
  readonly brand: EmailBrand
  readonly name: string
  /** Absolute URL that completes the change. */
  readonly url: string
  readonly newEmail: string
}

export function EmailChangedEmail({
  brand,
  name,
  url,
  newEmail,
}: EmailChangedEmailProps) {
  return (
    <EmailShell
      brand={brand}
      eyebrow="Security"
      preview="Confirm the change to finish it."
      heading="Confirm your new email"
      footer={AUTH_FOOTER}
    >
      <EmailParagraph>
        Hi <EmailEmphasis>{firstName(name)}</EmailEmphasis> — you asked to move
        this account to <EmailEmphasis>{newEmail}</EmailEmphasis>.
      </EmailParagraph>
      <EmailParagraph>
        Confirm the change and we will start using the new address for sign-in
        and for everything we send you.
      </EmailParagraph>
      <EmailAction label="Confirm the change" url={url} showRawUrl />
      <EmailFootnote>
        If you did not request this, change your password now — someone else may
        have access to your account.
      </EmailFootnote>
    </EmailShell>
  )
}
