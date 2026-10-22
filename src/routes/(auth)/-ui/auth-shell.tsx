/**
 * The frame every authentication screen sits in.
 *
 * Wide viewports get two columns: the form on the warm canvas, and a brand panel
 * that carries the wordmark and one confident line about the product. Narrow
 * viewports drop the panel entirely and keep a single safe-area-aware column —
 * a designed mobile layout, not a squeezed desktop one. Four sizes, four
 * compositions rather than one stretched four ways:
 *
 *   - below `sm`   the form and nothing else; chrome close to the edge.
 *   - `sm`–`lg`    the same column, with the three promises returning as a
 *                  compact ribbon under the card, so a tablet is not a phone
 *                  with margins.
 *   - `lg`–`2xl`   two tracks, the poster taking the smaller one.
 *   - `2xl` and up the tracks even out, the poster's headline steps up to the
 *                  hero size and its promises go three across, and the form
 *                  column's chrome joins the card's measure. Left alone, a
 *                  2560-wide page put a 448px card in a 26% track beside a
 *                  74% field of near-empty ink: stretched, not composed.
 *
 * The panel is built from the `inverse` token family, so it deliberately flips
 * with the theme: near-black under light, bone-white under dark, exactly like
 * the inverse cards elsewhere in the product.
 *
 * It is also the whole of the RTL design for these screens. The two columns are
 * grid tracks, so in `ar` the panel lands on the left and the form on the right
 * with no rule of its own; what does need saying is the art. The diagonal wash,
 * the corner bloom and the climbing route all point the way reading travels, so
 * each one is mirrored under `rtl:` rather than left pointing back at a reader
 * who has just arrived (`docs/SPEC.md` §9 rule 4 - a designed layout, not a flipped
 * one).
 */
import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Map, Users, Wallet } from 'lucide-react'

import { Wordmark } from '#/components/layout/brand'
import { ThemeToggle } from '#/components/layout/theme-toggle'
import { VisitorLanguageSwitcher } from '#/components/layout/visitor-language-switcher'
import { SectionLabel, Separator } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'

import type { MessageKey } from '#/lib/i18n'
import type { ReactNode } from 'react'

/**
 * A dotted route climbing across the panel: the same idea as the brand mark,
 * drawn at poster scale. Purely decorative, so it is hidden from the a11y tree
 * and it never animates — a login screen is not the place for a moving picture.
 *
 * The whole drawing mirrors under `rtl:` so the route still climbs away from the
 * reader's starting corner. `-scale-x-100` compiles to the `scale` property
 * rather than to `transform`, which is what keeps it out of the reduced-motion
 * block's reach; the attribute the icon rule uses is for glyphs, and this is a
 * picture.
 */
function RouteMotif() {
  return (
    <svg
      viewBox="0 0 480 720"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      role="presentation"
      className="pointer-events-none absolute inset-0 size-full text-inverse-on rtl:-scale-x-100"
    >
      {/* Latitude hairlines: enough structure to read as a chart, not a grid. */}
      {[120, 240, 360, 480, 600].map((y) => (
        <line
          key={y}
          x1="-40"
          x2="520"
          y1={y}
          y2={y}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.07"
        />
      ))}
      <path
        d="M-20 610C90 600 118 470 196 432c86-42 96-146 176-186 44-22 92-26 148-14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.1 12"
        opacity="0.32"
      />
      {[
        { cx: 74, cy: 604, r: 5 },
        { cx: 196, cy: 432, r: 4 },
        { cx: 322, cy: 268, r: 4 },
      ].map((node) => (
        <circle
          key={`${node.cx}-${node.cy}`}
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          fill="currentColor"
          opacity="0.28"
        />
      ))}
      <circle
        cx="424"
        cy="220"
        r="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.55"
      />
      <circle cx="424" cy="220" r="4" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

/** The three promises, as catalogue keys: a glyph, a claim, and the evidence. */
const PROMISES: ReadonlyArray<{
  readonly id: string
  readonly icon: typeof Map
  readonly title: MessageKey
  readonly detail: MessageKey
}> = [
  {
    id: 'map',
    icon: Map,
    title: 'auth.panel.map.title',
    detail: 'auth.panel.map.detail',
  },
  {
    id: 'group',
    icon: Users,
    title: 'auth.panel.group.title',
    detail: 'auth.panel.group.detail',
  },
  {
    id: 'costs',
    icon: Wallet,
    title: 'auth.panel.costs.title',
    detail: 'auth.panel.costs.detail',
  },
]

function BrandPanel() {
  const t = useTranslate()
  return (
    <aside className="relative hidden overflow-hidden bg-inverse text-inverse-on lg:block">
      {/* Two grounds, stacked: a diagonal wash, then a brand bloom top-left. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-inverse via-inverse to-brand/35 rtl:bg-linear-to-bl"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-radial-[at_16%_4%] from-brand/30 via-transparent to-transparent rtl:bg-radial-[at_84%_4%]"
      />
      <RouteMotif />
      {/* The motif is a poster, and the copy is the message. A scrim rising from
          the foot keeps the two from arguing: without it a decorative node landed
          squarely on the word "Edits" and read as a rendering fault. */}
      <div
        aria-hidden="true"
        className="absolute start-0 end-0 bottom-0 h-2/3 bg-linear-to-t from-inverse via-inverse/85 to-transparent"
      />

      {/* Mark at the top, message in the middle, evidence along the foot. The
          three-way split is what keeps a 1440-tall panel from reading as a
          block of text adrift in ink, and it is the reason the `2xl` step
          changes the *size* of those three things rather than their places. */}
      <div className="relative flex h-full flex-col justify-between gap-10 p-10 xl:p-14 2xl:p-16">
        {/* Our own mark, which is Latin in every locale: `dir` isolates it so
            the trailing suffix cannot be reordered by an Arabic paragraph.
            From `lg` this is the page's only way back to the site, because the
            header opposite drops its lockup at exactly that width rather than
            print the same name twice — so the mark is a link, not a heading.
            `self-start` keeps the hit area on the word instead of stretching it
            the width of the panel. The focus outline is drawn on this dark
            ground, where `--color-ring` reaches only 2.6:1, so it takes
            `inverse-brand` and its 7.9:1 instead. */}
        <Link
          to="/"
          dir="ltr"
          aria-label={t('auth.shell.home')}
          className="self-start rounded-md font-display text-2xl leading-none font-extrabold tracking-tighter focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse-brand 2xl:text-3xl"
        >
          planned<span className="text-brand">.</span>
          <span className="text-inverse-muted">travel</span>
        </Link>

        {/* At `2xl` the headline takes the hero step and the measure opens to
            five columns of it, so the line breaks three ways instead of five
            and the panel carries a poster rather than a paragraph. The body
            keeps a reading measure of its own — widening both would make the
            supporting line as loud as the claim. */}
        <div className="max-w-md 2xl:max-w-5xl">
          <SectionLabel className="text-inverse-muted">
            {t('auth.panel.eyebrow')}
          </SectionLabel>
          <h2 className="mt-4 font-display text-display font-extrabold tracking-tighter text-balance 2xl:text-hero">
            {t('auth.panel.heading')}
          </h2>
          <p className="mt-5 max-w-md text-body text-inverse-muted 2xl:mt-7 2xl:max-w-2xl 2xl:text-subtitle 2xl:font-normal">
            {t('auth.panel.body')}
          </p>
        </div>

        {/* Three across once the panel is wide enough to seat them, so the extra
            width at 2560 is used rather than left as margin — but measured, not
            stretched: a full-bleed row across an 1152px panel puts 200px of
            nothing inside each cell. */}
        <ul className="flex flex-col gap-5 2xl:grid 2xl:max-w-5xl 2xl:grid-cols-3 2xl:gap-8">
          {PROMISES.map(({ id, icon: Icon, title, detail }) => (
            <li key={id} className="flex items-start gap-3.5">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-inverse-surface ring-1 ring-inverse-edge ring-inset">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-label font-semibold">
                  {t(title)}
                </span>
                <span className="mt-0.5 block text-caption text-inverse-muted">
                  {t(detail)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

/**
 * The tablet band's share of the poster.
 *
 * Between `sm` and `lg` there is no room for the panel and too much room for a
 * bare form, so the same three promises come back as a ribbon under the card —
 * glyph over claim, no supporting line, sized to the measure the form already
 * occupies. Below `sm` it is suppressed: a phone's designed layout is the form
 * and nothing else, and above `lg` the panel says all of this properly.
 */
function PromiseRibbon({ className }: { className?: string }) {
  const t = useTranslate()
  return (
    <div className={cn('hidden pb-6 sm:block lg:hidden', className)}>
      <Separator className="mb-5" />
      <ul className="grid grid-cols-3 gap-3">
        {PROMISES.map(({ id, icon: Icon, title }) => (
          <li key={id} className="flex flex-col gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-ink-2 ring-1 ring-edge-faint ring-inset">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-caption font-medium text-ink-2 text-balance">
              {t(title)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface AuthShellProps {
  /** Small caps line above the heading — which step of the flow this is. */
  eyebrow: string
  heading: string
  /** One sentence of orientation under the heading. */
  description: ReactNode
  /** The form, or whichever state the screen is currently in. */
  children: ReactNode
  /** Quiet line under the card: the cross-link to the other flow. */
  footer?: ReactNode
  /** Widens the card for the two-column states (invitation, backup codes). */
  wide?: boolean
}

export function AuthShell({
  eyebrow,
  heading,
  description,
  children,
  footer,
  wide = false,
}: AuthShellProps) {
  const t = useTranslate()

  /**
   * These screens change state by replacing themselves: the submitting button
   * unmounts, a confirmation panel takes its place and focus falls to `<body>`,
   * so a screen-reader user hears silence at exactly the moment something
   * happened. Moving focus to the new heading is the same move a router makes
   * on a navigation, and the heading is where the answer is written.
   *
   * A translated heading is the same screen, so a locale change keeps focus.
   * Never on first paint, which is why the ref is consulted rather than the
   * effect simply run: four of the seven screens autofocus a field, and
   * stealing that focus would be a worse bug than the one this fixes.
   */
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const painted = React.useRef(false)
  const locale = useLocale()
  const previousLocale = React.useRef(locale)
  React.useEffect(() => {
    const localeChanged = previousLocale.current !== locale
    previousLocale.current = locale
    if (!painted.current) {
      painted.current = true
      return
    }
    if (!localeChanged) headingRef.current?.focus()
  }, [heading, locale])

  /**
   * One measure for the card, and — once the form track is wide enough for the
   * difference to read as a mistake — for the chrome above and below it too.
   * Below `2xl` the wordmark and the legal notice sit on the column's own
   * gutter, which is a 117px offset from the card at 1440 and reads as a frame;
   * at 2560 the same rule would open a 336px gap and read as three unrelated
   * blocks, so there the chrome joins the card's edge instead.
   */
  const measure = wide ? 'max-w-xl 2xl:max-w-2xl' : 'max-w-md 2xl:max-w-lg'
  const chrome = wide ? '2xl:max-w-2xl' : '2xl:max-w-lg'

  return (
    <div className="min-h-svh bg-canvas text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-svh flex-col px-safe pt-safe pb-safe">
        <div className="flex flex-1 flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
          {/* The brand belongs to whichever half of the page is on screen.
              From `lg` the panel opposite carries the wordmark, so repeating it
              here made the same name twice in one viewport; the header drops to
              the theme toggle alone and a hairline keeps the one-sided row from
              reading as an accident. Below `lg` the panel is hidden, so this is
              the only mark on the page and the lockup stays — and the home link
              moves with it: at `lg` the panel's wordmark is the one that links. */}
          <header
            className={cn(
              'mx-auto flex w-full items-center justify-between gap-4 lg:justify-end lg:border-b lg:border-edge-faint lg:pb-4',
              chrome,
            )}
          >
            <Link
              to="/"
              className="rounded-md focus-ring lg:hidden"
              aria-label={t('auth.shell.home')}
            >
              <Wordmark size="md" showSuffix />
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <VisitorLanguageSwitcher />
            </div>
          </header>

          <main
            className={cn(
              'mx-auto flex w-full flex-1 flex-col justify-center py-10',
              measure,
            )}
          >
            <div className="animate-rise">
              <SectionLabel>{eyebrow}</SectionLabel>
              {/* The heading steps up with the track it sits in. A 26px line
                  above a 512px card, opposite a 96px poster, reads as a caption
                  rather than as the page's own name. */}
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-3 font-display text-title font-extrabold tracking-tighter outline-none text-balance 2xl:mt-4 2xl:text-display"
              >
                {heading}
              </h1>
              <p className="mt-3 text-body text-ink-3 2xl:mt-4 2xl:text-subtitle 2xl:font-normal">
                {description}
              </p>

              <div className="mt-8">{children}</div>

              {footer ? (
                <div className="mt-7 text-label text-ink-3">{footer}</div>
              ) : null}
            </div>
          </main>

          <PromiseRibbon className={cn('mx-auto w-full', measure)} />

          {/* The legal pages are `src/routes/legal/**`, which SPEC §9 rule 8 keeps in
              English; the notice names them rather than linking them, because
              splitting one sentence into three keys would fix the English word
              order onto twenty-two other grammars. */}
          <footer
            className={cn('mx-auto w-full text-caption text-ink-4', chrome)}
          >
            <p>{t('auth.shell.legal')}</p>
          </footer>
        </div>
      </div>

      <BrandPanel />
    </div>
  )
}
