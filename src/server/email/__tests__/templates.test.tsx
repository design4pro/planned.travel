/**
 * The templates are judged on three things a mail client will not forgive.
 *
 * Every message must carry a subject, an HTML body and a plain-text body — the
 * queue payload sends `text` when it is present, so a template without one
 * delivers a blank message to any client that does not render HTML. Every URL in
 * the HTML must survive into the text, or the one thing the reader has to click
 * is the one thing the plain-text alternative loses. And nothing may reach the
 * `react-email` CLI, which is a devDependency: an import of it from a template
 * would pull the preview server into the Worker bundle and still build clean.
 *
 * `./env` is mocked because it imports `cloudflare:workers`, which does not
 * resolve outside a Worker; everything else here is the real code path.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { renderAuthEmail } from '#/server/auth/email'
import { renderEmailBody } from '../render'
import { VerifyEmail } from '../templates/verify-email'

import type { TransactionalEmailMessage } from '#/server/auth/email'

vi.mock('#/server/auth/env', () => ({
  APP_NAME: 'planned.travel',
  appUrl: () => 'https://planned.travel',
  taskQueue: () => {
    throw new Error('The queue is not exercised by a rendering test.')
  },
}))

const BRAND = { appName: 'planned.travel', appUrl: 'https://planned.travel' }

const PORTAL_URL =
  'https://polar.sh/planned-travel/portal?customer_session=cs_9f3'

const messages: ReadonlyArray<{
  readonly title: string
  readonly message: TransactionalEmailMessage
}> = [
  ...(['auth.passkey-added', 'auth.passkey-removed'] as const).map((kind) => ({
    title: kind,
    message: {
      kind,
      to: 'ada@example.com',
      eventId: '3b8b78a0-b913-461f-9347-f3f49cc50a71',
    },
  })),
  {
    title: 'auth.verify-email',
    message: {
      kind: 'auth.verify-email',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      url: 'https://planned.travel/api/auth/verify-email?token=vt_7712',
      expiresInMinutes: 1440,
    },
  },
  {
    title: 'auth.reset-password',
    message: {
      kind: 'auth.reset-password',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      url: 'https://planned.travel/reset-password?token=rt_5510',
      expiresInMinutes: 60,
    },
  },
  {
    title: 'auth.email-changed',
    message: {
      kind: 'auth.email-changed',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      url: 'https://planned.travel/api/auth/verify-change?token=ct_2044',
      newEmail: 'ada@analytical.engine',
    },
  },
  {
    title: 'auth.delete-account',
    message: {
      kind: 'auth.delete-account',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      url: 'https://planned.travel/api/auth/delete-user?token=dt_8891',
    },
  },
  {
    title: 'auth.organization-invitation',
    message: {
      kind: 'auth.organization-invitation',
      to: 'grace@example.com',
      invitedByName: 'Ada Lovelace',
      invitedByEmail: 'ada@example.com',
      organizationName: 'Studio Ostrowski',
      role: 'admin',
      url: 'https://planned.travel/accept-invitation/inv_31c8',
      expiresInHours: 168,
    },
  },
  {
    title: 'billing.subscription-confirmed',
    message: {
      kind: 'billing.subscription-confirmed',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      organizationName: 'Studio Ostrowski',
      planId: 'crew',
      interval: 'monthly',
      amountMinor: 3360,
      currency: 'usd',
      seats: 4,
      renewsAt: '2026-09-21T00:00:00.000Z',
      portalUrl: PORTAL_URL,
    },
  },
  {
    title: 'billing.subscription-confirmed, flat fee with no renewal date',
    message: {
      kind: 'billing.subscription-confirmed',
      to: 'ada@example.com',
      name: '',
      organizationName: 'Studio Ostrowski',
      planId: 'solo',
      interval: 'yearly',
      amountMinor: 9000,
      currency: 'usd',
      seats: null,
      renewsAt: null,
      portalUrl: PORTAL_URL,
    },
  },
  {
    title: 'billing.plan-changed, applied immediately',
    message: {
      kind: 'billing.plan-changed',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      organizationName: 'Studio Ostrowski',
      previousPlanId: 'solo',
      planId: 'crew',
      interval: 'monthly',
      amountMinor: 3360,
      currency: 'usd',
      seats: 4,
      pendingChange: null,
      portalUrl: PORTAL_URL,
    },
  },
  {
    title: 'billing.plan-changed, scheduled for period end',
    message: {
      kind: 'billing.plan-changed',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      organizationName: 'Studio Ostrowski',
      previousPlanId: 'crew',
      planId: 'crew',
      interval: 'monthly',
      amountMinor: 3360,
      currency: 'usd',
      seats: 4,
      pendingChange: {
        planId: 'solo',
        interval: 'monthly',
        seats: null,
        amountMinor: 900,
        effectiveAt: '2026-09-21T00:00:00.000Z',
      },
      portalUrl: PORTAL_URL,
    },
  },
  {
    title: 'billing.payment-failed',
    message: {
      kind: 'billing.payment-failed',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      organizationName: 'Studio Ostrowski',
      planId: 'crew',
      interval: 'monthly',
      amountMinor: 3360,
      currency: 'usd',
      seats: 4,
      nextAttemptAt: '2026-08-27T00:00:00.000Z',
      lapsesAt: '2026-09-05T00:00:00.000Z',
      portalUrl: PORTAL_URL,
    },
  },
  {
    title: 'billing.payment-failed, no retry and no lapse date',
    message: {
      kind: 'billing.payment-failed',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      organizationName: 'Studio Ostrowski',
      planId: 'solo',
      interval: 'yearly',
      amountMinor: 9000,
      currency: 'usd',
      seats: null,
      nextAttemptAt: null,
      lapsesAt: null,
      portalUrl: PORTAL_URL,
    },
  },
  {
    title: 'billing.pack-purchased',
    message: {
      kind: 'billing.pack-purchased',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      organizationName: 'Studio Ostrowski',
      packName: 'Dolomites huts and via ferrata',
      placeCount: 128,
      amountMinor: 1900,
      currency: 'usd',
      packUrl: 'https://planned.travel/atlas/packs/dolomites-huts',
      portalUrl: PORTAL_URL,
    },
  },
]

/** Every `href` the document carries, with HTML entities resolved. */
function hrefsIn(html: string): Array<string> {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) =>
    match[1]
      .replaceAll('&amp;', '&')
      .replaceAll('&#x27;', "'")
      .replaceAll('&quot;', '"'),
  )
}

const emailDir = fileURLToPath(new URL('../', import.meta.url))

function sourceFiles(dir: string): Array<string> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}${entry.name}`
    if (entry.isDirectory()) return sourceFiles(`${path}/`)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('transactional email templates', () => {
  it('covers every member of the message union', () => {
    const kinds = new Set(messages.map((entry) => entry.message.kind))
    expect([...kinds].sort()).toEqual([
      'auth.delete-account',
      'auth.email-changed',
      'auth.organization-invitation',
      'auth.passkey-added',
      'auth.passkey-removed',
      'auth.reset-password',
      'auth.verify-email',
      'billing.pack-purchased',
      'billing.payment-failed',
      'billing.plan-changed',
      'billing.subscription-confirmed',
    ])
  })

  it.each(messages)('$title renders a full message', async ({ message }) => {
    const rendered = await renderAuthEmail(message)

    expect(rendered.subject.trim().length).toBeGreaterThan(0)
    expect(rendered.tag.trim().length).toBeGreaterThan(0)
    expect(rendered.html.trim().length).toBeGreaterThan(0)
    expect(rendered.text.trim().length).toBeGreaterThan(0)
    expect(rendered.html).toContain('<!DOCTYPE html')
  })

  it.each(messages)(
    '$title keeps every URL in the plain-text body',
    async ({ message }) => {
      const rendered = await renderAuthEmail(message)
      const hrefs = hrefsIn(rendered.html)

      expect(hrefs.length).toBeGreaterThan(0)
      for (const href of hrefs) {
        expect(rendered.text).toContain(href)
      }
    },
  )

  it.each(messages)('$title ships no placeholder copy', async ({ message }) => {
    const rendered = await renderAuthEmail(message)

    expect(rendered.subject).not.toMatch(
      /lorem|ipsum|TODO|placeholder|undefined/i,
    )
    expect(rendered.text).not.toMatch(/lorem|ipsum|\bTODO\b|placeholder/i)
    expect(rendered.text).not.toContain('undefined')
    expect(rendered.text).not.toContain('NaN')
    expect(rendered.html).not.toContain('[object Object]')
  })

  it('names the workspace and the money in a billing confirmation', async () => {
    const entry = messages.find(
      (candidate) => candidate.title === 'billing.subscription-confirmed',
    )
    if (entry === undefined) throw new Error('fixture missing')

    const rendered = await renderAuthEmail(entry.message)

    expect(rendered.subject).toBe('Crew is live for Studio Ostrowski')
    expect(rendered.text).toContain('$33.60 / month')
    expect(rendered.text).toContain('4 members')
    expect(rendered.text).toContain('21 Sept 2026')
  })

  it('distinguishes a scheduled plan change from an immediate one', async () => {
    const immediate = await renderAuthEmail({
      kind: 'billing.plan-changed',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      organizationName: 'Studio Ostrowski',
      previousPlanId: 'solo',
      planId: 'crew',
      interval: 'monthly',
      amountMinor: 3360,
      currency: 'usd',
      seats: 4,
      pendingChange: null,
      portalUrl: PORTAL_URL,
    })
    const scheduled = await renderAuthEmail({
      kind: 'billing.plan-changed',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      organizationName: 'Studio Ostrowski',
      previousPlanId: 'crew',
      planId: 'crew',
      interval: 'monthly',
      amountMinor: 3360,
      currency: 'usd',
      seats: 4,
      pendingChange: {
        planId: 'solo',
        interval: 'monthly',
        seats: null,
        amountMinor: 900,
        effectiveAt: '2026-09-21T00:00:00.000Z',
      },
      portalUrl: PORTAL_URL,
    })

    expect(immediate.subject).toBe('Studio Ostrowski is now on Crew')
    expect(immediate.text).toContain('in force now')
    expect(immediate.text).not.toContain('Nothing is billed today')

    expect(scheduled.subject).toBe('Solo from 21 Sept 2026')
    expect(scheduled.text).toContain('Nothing is billed today')
    expect(scheduled.text).toContain('21 Sept 2026')
    expect(scheduled.text).not.toContain('in force now')
  })

  it('renders a template element straight from JSX', async () => {
    const { html, text } = await renderEmailBody(
      <VerifyEmail
        brand={BRAND}
        name="Ada Lovelace"
        url="https://planned.travel/api/auth/verify-email?token=vt_1"
        expiresInMinutes={45}
      />,
    )

    expect(html).toContain('Confirm your email')
    expect(text).toContain('Confirm your email')
    expect(text).toContain('45 minutes')
  })
})

describe('worker bundle hygiene', () => {
  it('never imports the react-email preview CLI', () => {
    const offenders = sourceFiles(emailDir).filter((path) =>
      /from ['"]react-email['"]/.test(readFileSync(path, 'utf8')),
    )

    expect(offenders).toEqual([])
  })

  it('reaches React Email only through the components package', () => {
    const specifiers = sourceFiles(emailDir).flatMap((path) =>
      [
        ...readFileSync(path, 'utf8').matchAll(
          /['"](@react-email\/[^'"]+)['"]/g,
        ),
      ].map((match) => match[1]),
    )

    expect(specifiers.length).toBeGreaterThan(0)
    expect([...new Set(specifiers)]).toEqual(['@react-email/components'])
  })

  it('loads the renderer lazily so it stays off the cold-start path', () => {
    const renderSource = readFileSync(`${emailDir}render.ts`, 'utf8')

    expect(renderSource).toContain("await import('@react-email/components')")
    expect(renderSource).not.toMatch(/^import .*@react-email/m)
  })
})

describe('passkey security email copy', () => {
  it.each(['auth.passkey-added', 'auth.passkey-removed'] as const)(
    '%s names the event and explains retained-passkey recovery',
    async (kind) => {
      const rendered = await renderAuthEmail({
        kind,
        to: 'ada@example.com',
        eventId: crypto.randomUUID(),
      })
      expect(rendered.subject).toContain(
        kind === 'auth.passkey-added' ? 'added' : 'removed',
      )
      expect(rendered.html).toContain('https://planned.travel/passkeys')
      expect(rendered.text).toContain('https://planned.travel/passkeys')
      expect(rendered.text).toContain(
        'change your password and end unfamiliar sessions',
      )
      expect(rendered.text).toContain(
        'A password reset does not remove passkeys.',
      )
      expect(rendered.text).toContain('remove any you do not recognize')
      expect(rendered.text).not.toContain('ada@example.com')
    },
  )
})
