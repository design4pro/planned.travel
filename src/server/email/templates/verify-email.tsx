import {
  EmailAction,
  EmailEmphasis,
  EmailFootnote,
  EmailParagraph,
  EmailShell,
} from '../layout'
import { AUTH_FOOTER, expiryWindow, firstName } from '../format'

import type { EmailBrand } from '../layout'

export interface VerifyEmailProps {
  readonly brand: EmailBrand
  readonly name: string
  /** Absolute URL that verifies the address and signs the reader in. */
  readonly url: string
  readonly expiresInMinutes: number
}

export function VerifyEmail({
  brand,
  name,
  url,
  expiresInMinutes,
}: VerifyEmailProps) {
  const window = expiryWindow(expiresInMinutes)
  return (
    <EmailShell
      brand={brand}
      eyebrow="Account"
      preview="One tap and your account is ready."
      heading="Confirm your email"
      footer={AUTH_FOOTER}
    >
      <EmailParagraph>
        Hi <EmailEmphasis>{firstName(name)}</EmailEmphasis> — confirm this
        address and your {brand.appName} account is ready to use.
      </EmailParagraph>
      <EmailAction label="Confirm email" url={url} showRawUrl />
      <EmailFootnote>
        This link works once and expires in {window}. If you did not create an
        account, ignore this message and nothing happens.
      </EmailFootnote>
    </EmailShell>
  )
}
