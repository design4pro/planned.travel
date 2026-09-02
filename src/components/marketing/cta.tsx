import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { Button, Card } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { Section } from './section'
import { DottedRoute } from './visuals'

export type ClosingCtaProps = {
  heading: string
  lede: string
  /** The quiet second button. Defaults to the pricing page. */
  secondary?: { readonly label: string; readonly to: '/' | '/pricing' }
  className?: string
}

/**
 * The last thing on every public page: one near-black panel, one loud button.
 * The dotted route runs behind it, closing the page with the same motif the
 * hero opened with.
 */
export function ClosingCta({
  heading,
  lede,
  secondary,
  className,
}: ClosingCtaProps) {
  const t = useTranslate()
  // The default lives here rather than in the parameter list, because reading it
  // from the catalogue needs the hook and a parameter default runs before one.
  const second = secondary ?? {
    label: t('marketing.cta.comparePlans'),
    to: '/pricing' as const,
  }
  return (
    <Section className={className} density="tight">
      <Card
        variant="inverse"
        padding="none"
        className="relative isolate overflow-hidden"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 -end-24 size-96 rounded-full bg-brand/30 blur-3xl"
        />
        <DottedRoute className="pointer-events-none absolute inset-x-0 -bottom-8 text-inverse-on/15" />
        <div className="relative flex flex-col items-center gap-6 px-6 py-14 text-center sm:px-10 sm:py-16">
          <h2 className="max-w-2xl font-display text-title font-extrabold tracking-tighter text-balance text-inverse-on sm:text-display">
            {heading}
          </h2>
          <p className="max-w-xl text-body leading-relaxed text-pretty text-inverse-muted">
            {lede}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button
              asChild
              variant="brand"
              size="lg"
              shape="pill"
              iconAfter={<ArrowRight aria-hidden className="size-4" />}
              className="w-full sm:w-auto"
            >
              <Link to="/register">{t('marketing.action.startPlanning')}</Link>
            </Button>
            <Button
              asChild
              variant="inverse"
              size="lg"
              shape="pill"
              className="w-full sm:w-auto"
            >
              <Link to={second.to}>{second.label}</Link>
            </Button>
          </div>
        </div>
      </Card>
    </Section>
  )
}
