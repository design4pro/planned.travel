import { EmailAction, EmailParagraph, EmailShell } from '../layout'
import { AUTH_FOOTER } from '../format'
import type { EmailBrand } from '../layout'

export interface PasskeyChangedEmailProps {
  readonly brand: EmailBrand
  readonly heading: string
  readonly security: string
  readonly action: string
  readonly recovery: string
}

/** No credential data or caller-controlled URL enters this security notice. */
export function PasskeyChangedEmail({
  brand,
  heading,
  security,
  action,
  recovery,
}: PasskeyChangedEmailProps) {
  return (
    <EmailShell
      brand={brand}
      eyebrow={security}
      preview={heading}
      heading={heading}
      footer={AUTH_FOOTER}
    >
      <EmailParagraph>{recovery}</EmailParagraph>
      <EmailAction label={action} url={`${brand.appUrl}/passkeys`} showRawUrl />
    </EmailShell>
  )
}
