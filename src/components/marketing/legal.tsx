import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Scale } from 'lucide-react'

import { Alert, Badge, Card, SectionLabel } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { MarketingFooter, MarketingHeader, SkipToContent } from './chrome'

import type { ReactNode } from 'react'

export type LegalSection = {
  /** Anchor id. Also the target of the contents list on the left. */
  readonly id: string
  readonly heading: string
  readonly body: ReactNode
}

export type LegalDocumentProps = {
  eyebrow: string
  title: string
  /** Effective date, already written out — "19 August 2026". */
  updated: string
  version: string
  /** The plain-English summary that opens the document. */
  summary: ReadonlyArray<string>
  sections: ReadonlyArray<LegalSection>
  /** Extra content under the contents list. `LegalPage` puts the sibling document there. */
  aside?: ReactNode
}

/**
 * Typography for legal prose, applied once on the wrapper rather than sprinkled
 * over every paragraph — so the content of a section stays readable as JSX and
 * every document is set identically.
 */
const proseClasses = cn(
  'text-body leading-relaxed text-ink-2',
  '[&_p]:mt-4 [&_p:first-child]:mt-0',
  '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:ps-5',
  '[&_li]:mt-2 [&_li]:ps-1 [&_li]:marker:text-ink-4',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_dl]:mt-4 [&_dt]:mt-3 [&_dt]:font-semibold [&_dt]:text-ink [&_dd]:mt-1',
)

/**
 * A gap a lawyer must fill before launch. Deliberately loud: it is a designed
 * affordance rather than leftover placeholder copy, and it is impossible to
 * ship one of these by accident without seeing it.
 */
export function LegalPlaceholder({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-label font-semibold text-warning">
      {children}
    </span>
  )
}

/**
 * The body of a legal page: the template warning, the plain-English summary, a
 * contents list, and the numbered sections. Kept separate from the page chrome
 * so it can be rendered — and tested — without a router around it.
 */
export function LegalDocument({
  eyebrow,
  title,
  updated,
  version,
  summary,
  sections,
  aside,
}: LegalDocumentProps) {
  const t = useTranslate()
  return (
    <div className="mx-auto w-full max-w-content px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="max-w-3xl">
        <SectionLabel icon={<Scale />}>{eyebrow}</SectionLabel>
        <h1 className="mt-3 font-display text-title font-extrabold tracking-tighter text-balance text-ink sm:text-display">
          {title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="neutral" size="md">
            {t('marketing.legal.badge.version', { version })}
          </Badge>
          <Badge tone="neutral" size="md">
            {t('marketing.legal.badge.effective', { updated })}
          </Badge>
        </div>
      </header>

      <Alert
        tone="warning"
        title={t('marketing.legal.notice.title')}
        className="mt-8 max-w-3xl"
      >
        <p className="text-caption leading-relaxed">
          {t('marketing.legal.notice.body')}
        </p>
      </Alert>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-14">
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--nav-h)+var(--impersonation-h)+2rem)] lg:self-start">
          <nav aria-label={t('marketing.nav.onThisPage')}>
            <SectionLabel as="h2">{t('marketing.legal.contents')}</SectionLabel>
            <ol className="mt-3 flex flex-col gap-1">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={cn(
                      'flex gap-2 rounded-sm py-1 text-label text-ink-3 focus-ring',
                      'transition-colors duration-fast ease-out-quint hover:text-ink',
                    )}
                  >
                    <span className="w-5 shrink-0 tabular-nums text-ink-4">
                      {index + 1}
                    </span>
                    <span className="min-w-0">{section.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {aside === undefined ? null : <div className="mt-6">{aside}</div>}
        </aside>

        <div className="min-w-0">
          <Card padding="none" className="p-6 sm:p-7">
            <SectionLabel as="h2">
              {t('marketing.legal.shortVersion')}
            </SectionLabel>
            <ul className="mt-3 flex flex-col gap-2.5">
              {summary.map((line) => (
                <li key={line} className="flex min-w-0 gap-2.5">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-brand"
                  />
                  <span className="min-w-0 text-label leading-relaxed text-ink-2">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-edge-faint pt-4 text-caption text-ink-4">
              {t('marketing.legal.summaryNote')}
            </p>
          </Card>

          <div className="mt-10 flex flex-col gap-10">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h)+1.5rem)]"
              >
                <h2
                  id={`${section.id}-heading`}
                  className="flex gap-3 font-display text-subtitle font-bold tracking-tight text-ink"
                >
                  <span aria-hidden className="tabular-nums text-ink-4">
                    {index + 1}.
                  </span>
                  <span className="min-w-0">{section.heading}</span>
                </h2>
                <div className={cn('mt-3 ps-0 sm:ps-8', proseClasses)}>
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const legalCrossLinkClasses = cn(
  'inline-flex items-center gap-1 rounded-sm text-label font-medium text-brand focus-ring',
  'transition-colors duration-fast ease-out-quint hover:text-brand-hover',
)

/** The sibling-document card, so each legal page can reach the other one. */
function LegalCrossLinks() {
  const t = useTranslate()
  return (
    <Card variant="inset" padding="none" className="p-4">
      <p className="text-caption leading-relaxed text-ink-3">
        {t('marketing.legal.both')}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        <li>
          <Link to="/legal/terms" className={legalCrossLinkClasses}>
            {t('marketing.footer.link.terms')}
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        </li>
        <li>
          <Link to="/legal/privacy" className={legalCrossLinkClasses}>
            {t('marketing.footer.link.privacy')}
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        </li>
      </ul>
    </Card>
  )
}

/** A legal document wearing the public site's chrome. */
export function LegalPage(props: Omit<LegalDocumentProps, 'aside'>) {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <SkipToContent />
      <MarketingHeader />
      <main id="main" className="flex-1">
        <LegalDocument {...props} aside={<LegalCrossLinks />} />
      </main>
      <MarketingFooter />
    </div>
  )
}
