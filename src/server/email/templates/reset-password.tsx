import {
  EmailAction,
  EmailEmphasis,
  EmailFootnote,
  EmailParagraph,
  EmailShell,
} from '../layout'
import { AUTH_FOOTER, expiryWindow, firstName } from '../format'

import type { EmailBrand } from '../layout'

export interface ResetPasswordEmailProps {
  readonly brand: EmailBrand
  readonly name: string
  /** Absolute URL to the reset screen, carrying the single-use token. */
  readonly url: string
  readonly expiresInMinutes: number
}

export function ResetPasswordEmail({
  brand,
  name,
  url,
  expiresInMinutes,
}: ResetPasswordEmailProps) {
  const window = expiryWindow(expiresInMinutes)
  return (
    <EmailShell
      brand={brand}
      eyebrow="Security"
      preview="Choose a new password."
      heading="Reset your password"
      footer={AUTH_FOOTER}
    >
      <EmailParagraph>
        Hi <EmailEmphasis>{firstName(name)}</EmailEmphasis> — use the button
        below to choose a new password.
      </EmailParagraph>
      <EmailParagraph>
        Your current password keeps working until you set a new one, and setting
        one signs out every other device.
      </EmailParagraph>
      <EmailAction label="Choose a new password" url={url} showRawUrl />
      <EmailFootnote>
        This link works once and expires in {window}. If you did not ask for it,
        no action is needed.
      </EmailFootnote>
    </EmailShell>
  )
}
