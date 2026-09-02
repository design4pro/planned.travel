import {
  Ban,
  Cloud,
  Download,
  HeartHandshake,
  ShieldOff,
  Users,
} from 'lucide-react'

import { Card, SectionLabel } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { Section, SectionIntro } from './section'

import type { MessageKey } from '#/lib/i18n'
import type { LucideIcon } from 'lucide-react'

type Panel = {
  readonly icon: LucideIcon
  readonly label: MessageKey
  readonly heading: MessageKey
  readonly body: MessageKey
}

const PANELS: ReadonlyArray<Panel> = [
  {
    icon: Users,
    label: 'marketing.proof.who.label',
    heading: 'marketing.proof.who.heading',
    body: 'marketing.proof.who.body',
  },
  {
    icon: Ban,
    label: 'marketing.proof.not.label',
    heading: 'marketing.proof.not.heading',
    body: 'marketing.proof.not.body',
  },
  {
    icon: Cloud,
    label: 'marketing.proof.where.label',
    heading: 'marketing.proof.where.heading',
    body: 'marketing.proof.where.body',
  },
]

const PROMISES: ReadonlyArray<{
  readonly icon: LucideIcon
  readonly title: MessageKey
  readonly body: MessageKey
}> = [
  {
    icon: ShieldOff,
    title: 'marketing.proof.promise.ads.title',
    body: 'marketing.proof.promise.ads.body',
  },
  {
    icon: HeartHandshake,
    title: 'marketing.proof.promise.sold.title',
    body: 'marketing.proof.promise.sold.body',
  },
  {
    icon: Download,
    title: 'marketing.proof.promise.leave.title',
    body: 'marketing.proof.promise.leave.body',
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
  const t = useTranslate()
  return (
    <Section
      id="honest"
      aria-labelledby="honest-heading"
      className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]"
    >
      <SectionIntro
        headingId="honest-heading"
        eyebrow={t('marketing.proof.eyebrow')}
        title={t('marketing.proof.title')}
        lede={t('marketing.proof.lede')}
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
              <SectionLabel>{t(panel.label)}</SectionLabel>
              <h3 className="mt-2 font-display text-subtitle font-bold tracking-tight text-balance text-ink">
                {t(panel.heading)}
              </h3>
            </div>
            <p className="text-caption leading-relaxed text-ink-2">
              {t(panel.body)}
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
                  {t(promise.title)}
                </span>
                <span className="mt-1 block text-caption leading-relaxed text-ink-3">
                  {t(promise.body)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-edge-faint pt-5 text-caption leading-relaxed text-ink-3">
          {t('marketing.proof.certification')}
        </p>
      </Card>
    </Section>
  )
}
