import {
  EmailAction,
  EmailEmphasis,
  EmailFacts,
  EmailFootnote,
  EmailParagraph,
  EmailShell,
} from '../layout'
import { AUTH_FOOTER } from '../format'

import type { EmailBrand } from '../layout'

export interface OrganizationInvitationEmailProps {
  readonly brand: EmailBrand
  /** Display name of the person who sent the invitation. */
  readonly invitedByName: string
  readonly invitedByEmail: string
  readonly organizationName: string
  readonly role: string
  /** Absolute URL to the accept-invitation screen. */
  readonly url: string
  readonly expiresInHours: number
}

function invitationWindow(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24
    return days === 1 ? '24 hours' : `${days} days`
  }
  return hours === 1 ? 'an hour' : `${hours} hours`
}

export function OrganizationInvitationEmail({
  brand,
  invitedByName,
  invitedByEmail,
  organizationName,
  role,
  url,
  expiresInHours,
}: OrganizationInvitationEmailProps) {
  return (
    <EmailShell
      brand={brand}
      eyebrow="Invitation"
      preview={`Join ${organizationName} on ${brand.appName}.`}
      heading={`Join ${organizationName}`}
      footer={AUTH_FOOTER}
    >
      <EmailParagraph>
        <EmailEmphasis>{invitedByName}</EmailEmphasis> invited you to plan trips
        together on {brand.appName}. Accepting adds you to the workspace and to
        everything already in it.
      </EmailParagraph>
      <EmailFacts
        facts={[
          { label: 'Workspace', value: organizationName },
          { label: 'Invited by', value: invitedByEmail },
          { label: 'Your role', value: role },
        ]}
      />
      <EmailAction label="Accept invitation" url={url} showRawUrl />
      <EmailFootnote>
        This invitation expires in {invitationWindow(expiresInHours)}. If you
        were not expecting it, you can ignore it safely.
      </EmailFootnote>
    </EmailShell>
  )
}
