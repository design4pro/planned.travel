import { SYSTEM_ORG_ID, enqueueTask } from '#/server/queue/jobs'
import { APP_NAME, appUrl, taskQueue } from './env'
import { logAuth } from './log'

/**
 * Transactional email is dispatched to the `TASKS` queue rather than sent
 * inline (docs/SPEC.md §5: heavy or slow work never blocks a request).
 *
 * The queue's `email` job carries a fully rendered message (`to`, `subject`,
 * `html`, `text`), so rendering happens here and the consumer only delivers.
 * This module owns both the contract and the templates.
 */
export type AuthEmailMessage =
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

/** Discriminator values, useful to the queue consumer's exhaustive switch. */
export type AuthEmailKind = AuthEmailMessage['kind']

/** Subject, body and analytics tag for one auth email. */
export interface RenderedAuthEmail {
  subject: string
  html: string
  text: string
  tag: string
}

const BRAND_INK = '#16150f'
const BRAND_CANVAS = '#faf9f7'
const BRAND_MUTED = '#5b5951'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Wraps body copy in the branded shell.
 *
 * Email clients strip `<style>` and ignore most modern CSS, so everything is
 * inlined on table cells and no web font is requested.
 */
function shell(input: {
  preheader: string
  heading: string
  paragraphs: Array<string>
  action?: { label: string; url: string }
  footnote?: string
}): string {
  const paragraphs = input.paragraphs
    .map(
      (copy) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND_INK}">${copy}</p>`,
    )
    .join('')

  const action = input.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px">
         <tr><td style="border-radius:12px;background:${BRAND_INK}">
           <a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(input.action.label)}</a>
         </td></tr>
       </table>`
    : ''

  const footnote = input.footnote
    ? `<p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND_MUTED}">${input.footnote}</p>`
    : ''

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND_CANVAS}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_CANVAS}">
  <tr><td align="center" style="padding:40px 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td style="padding:0 0 24px;font-size:17px;font-weight:700;letter-spacing:-0.01em;color:${BRAND_INK}">${APP_NAME}</td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e3e0d8;border-radius:20px;padding:32px">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${BRAND_INK}">${escapeHtml(input.heading)}</h1>
        ${paragraphs}${action}${footnote}
      </td></tr>
      <tr><td style="padding:24px 0 0;font-size:12px;line-height:1.6;color:${BRAND_MUTED}">
        You received this because someone used this address at <a href="${escapeHtml(appUrl())}" style="color:${BRAND_MUTED}">${escapeHtml(appUrl().replace(/^https?:\/\//, ''))}</a>. If it was not you, you can ignore it safely.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function plain(lines: Array<string>): string {
  return `${lines.filter(Boolean).join('\n\n')}\n`
}

function firstName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0] ?? 'there'
}

function expiry(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    if (hours % 24 === 0) {
      const days = hours / 24
      return days === 1 ? '24 hours' : `${days} days`
    }
    return hours === 1 ? 'an hour' : `${hours} hours`
  }
  return `${minutes} minutes`
}

/** Renders one auth email into the payload the queue's `email` job expects. */
export function renderAuthEmail(message: AuthEmailMessage): RenderedAuthEmail {
  switch (message.kind) {
    case 'auth.verify-email': {
      const window = expiry(message.expiresInMinutes)
      return {
        subject: `Confirm your email for ${APP_NAME}`,
        tag: 'auth-verify-email',
        html: shell({
          preheader: 'One tap and your account is ready.',
          heading: 'Confirm your email',
          paragraphs: [
            `Hi ${escapeHtml(firstName(message.name))} — confirm this address and your account is ready to use.`,
          ],
          action: { label: 'Confirm email', url: message.url },
          footnote: `This link works once and expires in ${window}.`,
        }),
        text: plain([
          `Hi ${firstName(message.name)},`,
          `Confirm your email for ${APP_NAME}:`,
          message.url,
          `This link works once and expires in ${window}.`,
        ]),
      }
    }

    case 'auth.reset-password': {
      const window = expiry(message.expiresInMinutes)
      return {
        subject: `Reset your ${APP_NAME} password`,
        tag: 'auth-reset-password',
        html: shell({
          preheader: 'Choose a new password.',
          heading: 'Reset your password',
          paragraphs: [
            `Hi ${escapeHtml(firstName(message.name))} — use the button below to choose a new password.`,
            'Your current password keeps working until you set a new one.',
          ],
          action: { label: 'Choose a new password', url: message.url },
          footnote: `This link works once and expires in ${window}. If you did not ask for it, no action is needed.`,
        }),
        text: plain([
          `Hi ${firstName(message.name)},`,
          `Reset your ${APP_NAME} password:`,
          message.url,
          `This link works once and expires in ${window}. If you did not ask for it, no action is needed.`,
        ]),
      }
    }

    case 'auth.email-changed': {
      return {
        subject: `Confirm your new email for ${APP_NAME}`,
        tag: 'auth-email-changed',
        html: shell({
          preheader: 'Confirm the change to finish it.',
          heading: 'Confirm your new email',
          paragraphs: [
            `Hi ${escapeHtml(firstName(message.name))} — you asked to move this account to <strong>${escapeHtml(message.newEmail)}</strong>.`,
            'Confirm the change and we will start using the new address.',
          ],
          action: { label: 'Confirm the change', url: message.url },
          footnote:
            'If you did not request this, change your password — someone may have access to your account.',
        }),
        text: plain([
          `Hi ${firstName(message.name)},`,
          `Confirm moving your ${APP_NAME} account to ${message.newEmail}:`,
          message.url,
          'If you did not request this, change your password.',
        ]),
      }
    }

    case 'auth.delete-account': {
      return {
        subject: `Confirm deleting your ${APP_NAME} account`,
        tag: 'auth-delete-account',
        html: shell({
          preheader: 'This one cannot be undone.',
          heading: 'Confirm account deletion',
          paragraphs: [
            `Hi ${escapeHtml(firstName(message.name))} — confirming will permanently delete your account, your trips and everything in them.`,
            'This cannot be undone.',
          ],
          action: { label: 'Delete my account', url: message.url },
          footnote: 'If you did not ask for this, ignore this email and nothing will change.',
        }),
        text: plain([
          `Hi ${firstName(message.name)},`,
          `Confirm deleting your ${APP_NAME} account (this cannot be undone):`,
          message.url,
          'If you did not ask for this, ignore this email and nothing will change.',
        ]),
      }
    }

    case 'auth.organization-invitation': {
      const window =
        message.expiresInHours % 24 === 0
          ? `${message.expiresInHours / 24} days`
          : `${message.expiresInHours} hours`
      return {
        subject: `${message.invitedByName} invited you to ${message.organizationName}`,
        tag: 'auth-organization-invitation',
        html: shell({
          preheader: `Join ${message.organizationName} on ${APP_NAME}.`,
          heading: `Join ${escapeHtml(message.organizationName)}`,
          paragraphs: [
            `<strong>${escapeHtml(message.invitedByName)}</strong> (${escapeHtml(message.invitedByEmail)}) invited you to plan with them on ${APP_NAME} as ${escapeHtml(message.role)}.`,
          ],
          action: { label: 'Accept invitation', url: message.url },
          footnote: `This invitation expires in ${window}.`,
        }),
        text: plain([
          `${message.invitedByName} (${message.invitedByEmail}) invited you to ${message.organizationName} on ${APP_NAME} as ${message.role}.`,
          message.url,
          `This invitation expires in ${window}.`,
        ]),
      }
    }
  }
}

/**
 * Renders an auth email and hands it to the queue.
 *
 * A send failure is logged and swallowed rather than propagated: a courier that
 * cannot take the letter must not turn a successful sign-up into a 500. The
 * caller therefore always resolves.
 */
export async function queueAuthEmail(message: AuthEmailMessage): Promise<void> {
  try {
    const rendered = renderAuthEmail(message)
    await enqueueTask(taskQueue(), {
      kind: 'email',
      orgId: SYSTEM_ORG_ID,
      payload: {
        to: [message.to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tag: rendered.tag,
      },
    })
    logAuth('info', 'email.queued', { kind: message.kind, to: message.to })
  } catch (cause) {
    logAuth('error', 'email.queue_failed', {
      kind: message.kind,
      to: message.to,
      reason: cause instanceof Error ? cause.message : 'unknown',
    })
  }
}
