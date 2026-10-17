/**
 * The transactional email templates, as React components.
 *
 * `src/server/auth/email.ts` is the only consumer: it owns the message union,
 * the subject lines and the analytics tags, and reaches in here for the bodies.
 * Nothing in this directory touches a Worker binding — product identity arrives
 * as an `EmailBrand` prop — so every template renders under plain Node in a test
 * and under the preview CLI without a running Worker.
 */

export { renderEmailBody } from './render'
export type { RenderedEmailBody } from './render'

export type { EmailBrand } from './layout'

export { VerifyEmail } from './templates/verify-email'
export type { VerifyEmailProps } from './templates/verify-email'

export { ResetPasswordEmail } from './templates/reset-password'
export type { ResetPasswordEmailProps } from './templates/reset-password'

export { EmailChangedEmail } from './templates/email-changed'
export type { EmailChangedEmailProps } from './templates/email-changed'

export { DeleteAccountEmail } from './templates/delete-account'
export type { DeleteAccountEmailProps } from './templates/delete-account'

export { OrganizationInvitationEmail } from './templates/organization-invitation'
export type { OrganizationInvitationEmailProps } from './templates/organization-invitation'

export { SubscriptionConfirmedEmail } from './templates/subscription-confirmed'
export type { SubscriptionConfirmedEmailProps } from './templates/subscription-confirmed'

export { PlanChangedEmail } from './templates/plan-changed'
export type {
  PendingPlanChange,
  PlanChangedEmailProps,
} from './templates/plan-changed'

export { PaymentFailedEmail } from './templates/payment-failed'
export type { PaymentFailedEmailProps } from './templates/payment-failed'

export { PackPurchasedEmail } from './templates/pack-purchased'
export type { PackPurchasedEmailProps } from './templates/pack-purchased'

export { PasskeyChangedEmail } from './templates/passkey-changed'
