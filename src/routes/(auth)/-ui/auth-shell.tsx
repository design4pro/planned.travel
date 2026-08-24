/**
 * The frame every authentication screen sits in.
 *
 * Wide viewports get two columns: the form on the warm canvas, and a brand panel
 * that carries the wordmark and one confident line about the product. Narrow
 * viewports drop the panel entirely and keep a single safe-area-aware column —
 * a designed mobile layout, not a squeezed desktop one.
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
 * who has just arrived (`docs/SPEC.md` §8.4 - a designed layout, not a flipped
 * one).
 */
import { Link } from '@tanstack/react-router'
import { Map, Users, Wallet } from 'lucide-react'

import { Wordmark } from '#/components/layout/brand'
import { ThemeToggle } from '#/components/layout/theme-toggle'
import { SectionLabel } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'

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

      <div className="relative flex h-full flex-col justify-between gap-10 p-10 xl:p-14">
        {/* Our own mark, which is Latin in every locale: `dir` isolates it so
            the trailing suffix cannot be reordered by an Arabic paragraph. */}
        <p
          dir="ltr"
          className="font-display text-2xl leading-none font-extrabold tracking-tighter"
        >
          planned<span className="text-brand">.</span>
          <span className="text-inverse-muted">travel</span>
        </p>

        <div className="max-w-md">
          <SectionLabel className="text-inverse-muted">
            {t('auth.panel.eyebrow')}
          </SectionLabel>
          <h2 className="mt-4 font-display text-display font-extrabold tracking-tighter text-balance">
            {t('auth.panel.heading')}
          </h2>
          <p className="mt-5 text-body text-inverse-muted">
            {t('auth.panel.body')}
          </p>
        </div>

        <ul className="flex flex-col gap-5">
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
  return (
    <div className="min-h-svh bg-canvas text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="flex min-h-svh flex-col px-safe pt-safe pb-safe">
        <div className="flex flex-1 flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
          <header className="flex items-center justify-between gap-4">
            <Link
              to="/"
              className="rounded-md focus-ring"
              aria-label={t('auth.shell.home')}
            >
              <Wordmark size="md" showSuffix />
            </Link>
            <ThemeToggle />
          </header>

          <main
            className={cn(
              'mx-auto flex w-full flex-1 flex-col justify-center py-10',
              wide ? 'max-w-xl' : 'max-w-md',
            )}
          >
            <div className="animate-rise">
              <SectionLabel>{eyebrow}</SectionLabel>
              <h1 className="mt-3 font-display text-title font-extrabold tracking-tighter text-balance">
                {heading}
              </h1>
              <p className="mt-3 text-body text-ink-3">{description}</p>

              <div className="mt-8">{children}</div>

              {footer ? (
                <div className="mt-7 text-label text-ink-3">{footer}</div>
              ) : null}
            </div>
          </main>

          {/* The legal pages are owned by the marketing routes; until they
              exist the notice stands on its own rather than pointing anywhere
              that would 404. */}
          <footer className="text-caption text-ink-4">
            <p>{t('auth.shell.legal')}</p>
          </footer>
        </div>
      </div>

      <BrandPanel />
    </div>
  )
}
