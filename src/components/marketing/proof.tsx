import {
  Ban,
  Cloud,
  Download,
  HeartHandshake,
  ShieldOff,
  Users,
} from 'lucide-react'

import { Card, SectionLabel } from '#/components/ui'
import { Section, SectionIntro } from './section'

import type { LucideIcon } from 'lucide-react'

type Panel = {
  readonly icon: LucideIcon
  readonly label: string
  readonly heading: string
  readonly body: string
}

const PANELS: ReadonlyArray<Panel> = [
  {
    icon: Users,
    label: 'Who it is for',
    heading: 'The person who ends up making the spreadsheet',
    body: 'Couples, families and groups of friends who want one plan everybody can see, instead of six screenshots, three group chats and a shared note nobody has opened since March.',
  },
  {
    icon: Ban,
    label: 'What it is not',
    heading: 'Not a booking site, and not for sale to one',
    body: 'We take no commission, carry no adverts and place no affiliate links, so nothing on a page is quietly steering you towards a particular hotel. You pay us, which means we work for you.',
  },
  {
    icon: Cloud,
    label: 'Where your things live',
    heading: 'On Cloudflare, in your own workspace',
    body: 'Trips sit in a database scoped to your workspace and files in our own object storage, both served from Cloudflare’s edge. Polar, our merchant of record, runs the checkout and issues the invoice, so your card number never reaches us.',
  },
]

const PROMISES: ReadonlyArray<{
  readonly icon: LucideIcon
  readonly title: string
  readonly body: string
}> = [
  {
    icon: ShieldOff,
    title: 'No advertising, no third-party analytics',
    body: 'Nothing on the page is measuring you for somebody else.',
  },
  {
    icon: HeartHandshake,
    title: 'Your trips are never sold or rented',
    body: 'Not to advertisers, not to travel companies, not to anyone.',
  },
  {
    icon: Download,
    title: 'Leave whenever you like, with everything',
    body: 'PDF itineraries, calendar files and your places as GeoJSON.',
  },
]

/**
 * Honest social proof.
 *
 * planned.travel is new, so there are no customers to quote and no logos to
 * show — and inventing either would be the fastest way to lose the reader. This
 * band says instead exactly who the product is for, what it refuses to do, and
 * where the data sits, which is the information a testimonial is standing in
 * for anyway.
 */
export function HonestProof() {
  return (
    <Section
      id="honest"
      aria-labelledby="honest-heading"
      className="scroll-mt-[var(--nav-h)]"
    >
      <SectionIntro
        headingId="honest-heading"
        eyebrow="Straight answers"
        title="No testimonials, because we have not earned any yet"
        lede="planned.travel is new. Rather than invent a quote or borrow somebody’s logo, here is exactly what it does, who it is for, and what it will never do to you."
      />

      <div className="mt-12 grid gap-4 lg:mt-14 lg:grid-cols-3">
        {PANELS.map((panel) => (
          <Card key={panel.label} padding="lg" className="flex flex-col gap-4">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand [&_svg]:size-4.5"
            >
              <panel.icon />
            </span>
            <div className="min-w-0">
              <SectionLabel>{panel.label}</SectionLabel>
              <h3 className="mt-2 font-display text-subtitle font-bold tracking-tight text-balance text-ink">
                {panel.heading}
              </h3>
            </div>
            <p className="text-caption leading-relaxed text-ink-2">
              {panel.body}
            </p>
          </Card>
        ))}
      </div>

      <Card variant="inset" padding="none" className="mt-4 p-6 sm:p-7">
        <ul className="grid gap-6 sm:grid-cols-3">
          {PROMISES.map((promise) => (
            <li key={promise.title} className="flex min-w-0 gap-3">
              <span
                aria-hidden
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface text-brand shadow-card [&_svg]:size-3.5"
              >
                <promise.icon />
              </span>
              <span className="min-w-0">
                <span className="block text-label font-semibold text-ink">
                  {promise.title}
                </span>
                <span className="mt-1 block text-caption leading-relaxed text-ink-3">
                  {promise.body}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-edge-faint pt-5 text-caption leading-relaxed text-ink-3">
          We hold no security certification today, and we will not imply one.
          When planned.travel is audited against a standard, this is where we
          will name the standard, the auditor and the date — and not before.
        </p>
      </Card>
    </Section>
  )
}
