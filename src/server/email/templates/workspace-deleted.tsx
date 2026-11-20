import { EmailParagraph, EmailShell } from '../layout'
import type { EmailBrand } from '../layout'
import type { Locale } from '#/lib/i18n'

/** Receipt copy is already translated; React escapes the ledger's workspace name. */
export function WorkspaceDeletedEmail(props: {
  brand: EmailBrand
  locale: Locale
  heading: string
  body: string
  footer: string
}) {
  return (
    <EmailShell
      brand={props.brand}
      locale={props.locale}
      preview={props.heading}
      heading={props.heading}
      eyebrow={props.heading}
      footer={props.footer}
    >
      <EmailParagraph>
        <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
          {props.body}
        </span>
      </EmailParagraph>
    </EmailShell>
  )
}
