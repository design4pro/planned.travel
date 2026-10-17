import { createElement } from 'react'
import { createTranslator, loadCatalogue } from '#/lib/i18n'
import { planById } from '#/lib/plans'
import { formatDate } from '#/lib/format'
import { SYSTEM_ORG_ID, enqueueTask } from '#/server/queue/jobs'
import {
  DeleteAccountEmail,
  PasskeyChangedEmail,
  EmailChangedEmail,
  OrganizationInvitationEmail,
  PackPurchasedEmail,
  PaymentFailedEmail,
  PlanChangedEmail,
  ResetPasswordEmail,
  SubscriptionConfirmedEmail,
  VerifyEmail,
  renderEmailBody,
} from '#/server/email'
import { APP_NAME, appUrl, taskQueue } from './env'
import { logAuth } from './log'

import type { ReactElement } from 'react'
import type { BillingInterval, PlanId } from '#/lib/plans'
import type { EmailBrand, PendingPlanChange } from '#/server/email'

/**
 * Transactional email is dispatched to the `TASKS` queue rather than sent
 * inline (docs/SPEC.md §5: heavy or slow work never blocks a request).
 *
 * The queue's `email` job carries a fully rendered message (`to`, `subject`,
 * `html`, `text`), so rendering happens here and the consumer only delivers.
 * This module owns the message contract, the subject lines and the analytics
 * tags; the bodies are React components under `src/server/email`.
 */
export type AuthEmailMessage =
  | {
      kind: 'auth.passkey-added' | 'auth.passkey-removed'
      to: string
      /** Random identity of one committed mutation; never a credential identifier. */
      eventId: string
    }
  | {
      kind: 'auth.verify-email'
      to: string
      name: string
      /** Absolute URL that verifies the address and signs the user in. */
      url: string
      expiresInMinutes: number
    }
  | {
      kind: 'auth.reset-password'
      to: string
      name: string
      /** Absolute URL to the reset-password screen, carrying the token. */
      url: string
      expiresInMinutes: number
    }
  | {
      kind: 'auth.email-changed'
      to: string
      name: string
      url: string
      newEmail: string
    }
  | {
      kind: 'auth.delete-account'
      to: string
      name: string
      url: string
    }
  | {
      kind: 'auth.organization-invitation'
      to: string
      /** Display name of the person who sent the invitation. */
      invitedByName: string
      invitedByEmail: string
      organizationName: string
      role: string
      /** Absolute URL to the accept-invitation screen. */
      url: string
      expiresInHours: number
    }

/**
 * A plan change Polar accepted but scheduled instead of applying.
 *
 * `null` on the message means the change is already in force. The field names
 * are the billing domain's `pendingChange` vocabulary; the plan arrives as an id
 * and is resolved against the catalogue here, so no caller can invent a plan
 * name the pricing page does not use.
 */
export interface PendingPlanChangeMessage {
  planId: PlanId
  interval: BillingInterval
  /** Seats the scheduled plan will bill, or `null` when it is not seat-based. */
  seats: number | null
  /** Per-period cost once it lands, in minor units of the message's currency. */
  amountMinor: number
  /** ISO instant Polar applies it: the end of the period already paid for. */
  effectiveAt: string
}

export type BillingEmailMessage =
  | {
      kind: 'billing.subscription-confirmed'
      to: string
      name: string
      organizationName: string
      planId: PlanId
      interval: BillingInterval
      /** Per-period charge for the whole subscription, in minor units. */
      amountMinor: number
      /** ISO 4217 code of the charge. */
      currency: string
      /** Seats paid for, or `null` when the plan is not seat-based. */
      seats: number | null
      /** ISO instant of the next renewal, or `null` when Polar has not set one. */
      renewsAt: string | null
      /** Hosted Polar Customer Portal URL for this customer. */
      portalUrl: string
    }
  | {
      kind: 'billing.plan-changed'
      to: string
      name: string
      organizationName: string
      /** The plan the workspace was on before the request. */
      previousPlanId: PlanId
      /** The plan in force now — unchanged when `pendingChange` is set. */
      planId: PlanId
      interval: BillingInterval
      amountMinor: number
      currency: string
      seats: number | null
      pendingChange: PendingPlanChangeMessage | null
      portalUrl: string
    }
  | {
      kind: 'billing.payment-failed'
      to: string
      name: string
      organizationName: string
      planId: PlanId
      interval: BillingInterval
      /** The amount Polar could not take, in minor units. */
      amountMinor: number
      currency: string
      seats: number | null
      /** ISO instant of Polar's next retry, or `null` when there will not be one. */
      nextAttemptAt: string | null
      /** ISO instant the subscription lapses if the charge never clears. */
      lapsesAt: string | null
      portalUrl: string
    }
  | {
      kind: 'billing.pack-purchased'
      to: string
      name: string
      organizationName: string
      packName: string
      /** How many places the pack adds to the workspace's library. */
      placeCount: number
      /** What was charged, in minor units. */
      amountMinor: number
      currency: string
      /** Absolute URL that opens the pack inside the app. */
      packUrl: string
      portalUrl: string
    }

/** Every transactional message the product can send. */
export type TransactionalEmailMessage = AuthEmailMessage | BillingEmailMessage

/** Discriminator values, useful to the queue consumer's exhaustive switch. */
export type TransactionalEmailKind = TransactionalEmailMessage['kind']

/** Subject, body and analytics tag for one transactional email. */
export interface RenderedAuthEmail {
  subject: string
  html: string
  text: string
  tag: string
}

/** Subject line, analytics tag and the element that renders both bodies. */
interface EmailDescriptor {
  subject: string
  tag: string
  element: ReactElement
}

function brand(): EmailBrand {
  return { appName: APP_NAME, appUrl: appUrl() }
}

function planName(id: PlanId): string {
  return planById(id).name
}

/** `23 Jun 2026`, falling back to the raw instant rather than to a blank. */
function whenLabel(instant: string): string {
  return formatDate(instant) ?? instant
}

function pendingForTemplate(
  pending: PendingPlanChangeMessage,
): PendingPlanChange {
  return {
    planName: planName(pending.planId),
    interval: pending.interval,
    seats: pending.seats,
    amountMinor: pending.amountMinor,
    effectiveAt: pending.effectiveAt,
  }
}

async function describe(
  message: TransactionalEmailMessage,
): Promise<EmailDescriptor> {
  switch (message.kind) {
    case 'auth.passkey-added':
    case 'auth.passkey-removed': {
      // Transactional templates currently use English; copy still belongs to the catalogue.
      const t = createTranslator('en', await loadCatalogue('en'))
      const heading =
        message.kind === 'auth.passkey-added'
          ? t('auth.passkeyNotice.added')
          : t('auth.passkeyNotice.removed')
      return {
        subject: heading,
        tag: message.kind.replace('.', '-'),
        element: createElement(PasskeyChangedEmail, {
          brand: brand(),
          heading,
          security: t('auth.passkeyNotice.security'),
          action: t('auth.passkeyNotice.action'),
          recovery: t('auth.passkeyNotice.recovery'),
        }),
      }
    }
    case 'auth.verify-email':
      return {
        subject: `Confirm your email for ${APP_NAME}`,
        tag: 'auth-verify-email',
        element: createElement(VerifyEmail, {
          brand: brand(),
          name: message.name,
          url: message.url,
          expiresInMinutes: message.expiresInMinutes,
        }),
      }

    case 'auth.reset-password':
      return {
        subject: `Reset your ${APP_NAME} password`,
        tag: 'auth-reset-password',
        element: createElement(ResetPasswordEmail, {
          brand: brand(),
          name: message.name,
          url: message.url,
          expiresInMinutes: message.expiresInMinutes,
        }),
      }

    case 'auth.email-changed':
      return {
        subject: `Confirm your new email for ${APP_NAME}`,
        tag: 'auth-email-changed',
        element: createElement(EmailChangedEmail, {
          brand: brand(),
          name: message.name,
          url: message.url,
          newEmail: message.newEmail,
        }),
      }

    case 'auth.delete-account':
      return {
        subject: `Confirm deleting your ${APP_NAME} account`,
        tag: 'auth-delete-account',
        element: createElement(DeleteAccountEmail, {
          brand: brand(),
          name: message.name,
          url: message.url,
        }),
      }

    case 'auth.organization-invitation':
      return {
        subject: `${message.invitedByName} invited you to ${message.organizationName}`,
        tag: 'auth-organization-invitation',
        element: createElement(OrganizationInvitationEmail, {
          brand: brand(),
          invitedByName: message.invitedByName,
          invitedByEmail: message.invitedByEmail,
          organizationName: message.organizationName,
          role: message.role,
          url: message.url,
          expiresInHours: message.expiresInHours,
        }),
      }

    case 'billing.subscription-confirmed': {
      const plan = planName(message.planId)
      return {
        subject: `${plan} is live for ${message.organizationName}`,
        tag: 'billing-subscription-confirmed',
        element: createElement(SubscriptionConfirmedEmail, {
          brand: brand(),
          name: message.name,
          organizationName: message.organizationName,
          planName: plan,
          interval: message.interval,
          amountMinor: message.amountMinor,
          currency: message.currency,
          seats: message.seats,
          renewsAt: message.renewsAt,
          portalUrl: message.portalUrl,
        }),
      }
    }

    case 'billing.plan-changed': {
      const plan = planName(message.planId)
      const pending =
        message.pendingChange === null
          ? null
          : pendingForTemplate(message.pendingChange)
      return {
        subject:
          pending === null
            ? `${message.organizationName} is now on ${plan}`
            : `${pending.planName} from ${whenLabel(pending.effectiveAt)}`,
        tag: 'billing-plan-changed',
        element: createElement(PlanChangedEmail, {
          brand: brand(),
          name: message.name,
          organizationName: message.organizationName,
          previousPlanName: planName(message.previousPlanId),
          planName: plan,
          interval: message.interval,
          amountMinor: message.amountMinor,
          currency: message.currency,
          seats: message.seats,
          pendingChange: pending,
          portalUrl: message.portalUrl,
        }),
      }
    }

    case 'billing.payment-failed':
      return {
        subject: `We could not take the payment for ${message.organizationName}`,
        tag: 'billing-payment-failed',
        element: createElement(PaymentFailedEmail, {
          brand: brand(),
          name: message.name,
          organizationName: message.organizationName,
          planName: planName(message.planId),
          interval: message.interval,
          amountMinor: message.amountMinor,
          currency: message.currency,
          seats: message.seats,
          nextAttemptAt: message.nextAttemptAt,
          lapsesAt: message.lapsesAt,
          portalUrl: message.portalUrl,
        }),
      }

    case 'billing.pack-purchased':
      return {
        subject: `${message.packName} is unlocked for ${message.organizationName}`,
        tag: 'billing-pack-purchased',
        element: createElement(PackPurchasedEmail, {
          brand: brand(),
          name: message.name,
          organizationName: message.organizationName,
          packName: message.packName,
          placeCount: message.placeCount,
          amountMinor: message.amountMinor,
          currency: message.currency,
          packUrl: message.packUrl,
          portalUrl: message.portalUrl,
        }),
      }
  }
}

/**
 * Renders one transactional email into the payload the queue's `email` job
 * expects.
 *
 * Asynchronous because React Email's `render()` drives the streaming server
 * renderer to completion. The return type is written out rather than inferred so
 * a caller that forgets to await fails the type check here instead of enqueueing
 * a `Promise` where a string belongs.
 */
export async function renderAuthEmail(
  message: TransactionalEmailMessage,
): Promise<RenderedAuthEmail> {
  const { subject, tag, element } = await describe(message)
  const { html, text } = await renderEmailBody(element)
  return { subject, html, text, tag }
}

/**
 * Renders a transactional email and hands it to the queue.
 *
 * A send failure is logged and swallowed rather than propagated: a courier that
 * cannot take the letter must not turn a successful sign-up into a 500. The
 * caller therefore always resolves.
 */
export async function queueAuthEmail(
  message: TransactionalEmailMessage,
): Promise<void> {
  try {
    const rendered = await renderAuthEmail(message)
    await enqueueTask(taskQueue(), {
      kind: 'email',
      orgId: SYSTEM_ORG_ID,
      payload: {
        ...('eventId' in message ? { eventId: message.eventId } : {}),
        to: [message.to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tag: rendered.tag,
      },
    })
    logAuth('info', 'email.queued', { kind: message.kind, to: message.to })
  } catch {
    logAuth('error', 'email.queue_failed', {
      kind: message.kind,
      to: message.to,
      reason: 'enqueue_failed',
    })
  }
}
