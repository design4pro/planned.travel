import * as React from 'react'
import { rootRouteId, useRouter, useRouterState } from '@tanstack/react-router'
import { Globe } from 'lucide-react'
import { toast } from 'sonner'

import { LanguagePicker } from '#/components/settings'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  SUPPORTED_LOCALES,
  createTranslator,
  loadCatalogue,
  localeDescriptor,
  useLocale,
  useTranslate,
} from '#/lib/i18n'
import { commitLanguage } from '#/lib/i18n/commit-language'

import type { LocaleChoice } from '#/components/settings'
import type { Locale } from '#/lib/i18n'

/**
 * The root loader's data, read through the router and never by importing the
 * root route: `__root.tsx` already imports `components/layout/*`, so that import
 * would be a cycle and a component depending on a route.
 */
function rootData(
  matches: ReadonlyArray<{
    readonly routeId: string
    readonly loaderData?: unknown
  }>,
): { readonly locale?: unknown; readonly signedIn?: unknown } | null {
  const data = matches.find(
    (match) => match.routeId === rootRouteId,
  )?.loaderData
  return typeof data === 'object' && data !== null ? data : null
}

function isLocale(choice: LocaleChoice): choice is Locale {
  return SUPPORTED_LOCALES.some((descriptor) => descriptor.tag === choice)
}

/**
 * Two columns from 360px, and a single one wherever two would clip a name.
 *
 * The popover is 328px wide at 360px and its inner box 314px, so two tracks and
 * their gap fit down to 153px each. The longest native name needs 150px once
 * the chips drop to `px-2` below `sm` (measured name 110px, mark 16px, gap 8px,
 * padding 16px), so a 9.5rem (152px) floor keeps two columns there and lets
 * `auto-fill` return to one on any narrower screen rather than ellipsising a
 * language.
 */
const COLUMN_MIN = '9.5rem'
const NARROW_CHIPS = 'max-sm:[&_[role=radio]]:px-2'

const TRIGGER = [
  'inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full sm:w-auto sm:px-3',
  'text-label font-medium text-ink-3 select-none focus-ring',
  'transition-colors duration-fast ease-out-quint',
  'hover:bg-hover hover:text-ink active:bg-active',
  'data-[state=open]:bg-hover data-[state=open]:text-ink',
].join(' ')

/**
 * The header's language control for someone who has not signed in.
 *
 * It is presentational and takes the write as a prop, like `LanguagePicker`:
 * the shells that mount it know nothing about sessions or the server, and the
 * connected wrapper decides what saving means.
 *
 * **One visibility rule, in one place.** It renders nothing for a signed-in
 * person, who owns the choice in settings: a control that writes a cookie the
 * negotiation chain ignores must never appear. The flag comes from the root
 * loader, so `/accept-invitation/$id` and `/verify-email` show it to the
 * signed-out and hide it from the signed-in with no code of their own.
 *
 * **The announcement is held here, outside the popover.** The popover unmounts
 * on close and on Escape, so a live region inside it would lose the sentence
 * the moment it was written. The pending state and the result live in this
 * component for the same reason: Escape during a save closes the popover and
 * the outcome still lands. The sentence is spoken by `commit.speak`, a
 * translator for the language that arrived, never by the `t` of the render that
 * began the save, which would read an old-language sentence under the new
 * `<html lang>`. A success has no toast: the page changing language is the
 * confirmation.
 */
export function LanguageSwitcher({
  save,
  className,
}: {
  /** The visitor write; resolves to the language that was stored. */
  readonly save: (locale: Locale) => Promise<{ readonly locale: Locale }>
  readonly className?: string
}) {
  const router = useRouter()
  const t = useTranslate()
  const locale = useLocale()
  const signedIn = useRouterState({
    select: (state) => rootData(state.matches)?.signedIn === true,
  })
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState<Locale | null>(null)
  const [announcement, setAnnouncement] = React.useState('')
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  if (signedIn) return null

  const active = localeDescriptor(locale)

  async function choose(next: Locale): Promise<void> {
    setAnnouncement('')
    setPending(next)

    const commit = await commitLanguage(
      { next, previous: locale, workspace: locale },
      {
        save: async () => save(next),
        // `forcePending` runs the load in the foreground, so what the checks
        // below read is the outcome and not the page before it.
        refresh: () => router.invalidate({ forcePending: true }),
        refreshed: () =>
          !router.state.matches.some((match) => match.status === 'error'),
        // The root loader answers with the language the request negotiated: a
        // browser that dropped the cookie, or a caller who is signed in, leaves
        // it where it was.
        applied: () => rootData(router.state.matches)?.locale === next,
        translatorFor: async (target) =>
          createTranslator(target, await loadCatalogue(target)),
      },
    )

    setPending(null)
    const language = localeDescriptor(commit.inForce).nativeName

    switch (commit.status) {
      case 'rejected':
        toast.error(t('settings.language.saveFailed'), {
          description: t('settings.language.saveFailedBody', { language }),
        })
        return
      case 'stale':
        toast.warning(t('settings.language.reload.title'), {
          description: t('settings.language.reload.body', { language }),
        })
        return
      case 'unapplied':
        toast.warning(t('shell.language.notApplied'))
        return
      case 'switched':
        setOpen(false)
        triggerRef.current?.focus()
        setAnnouncement(commit.speak('shell.language.announce', { language }))
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            aria-label={t('shell.language.trigger', {
              language: active.nativeName,
            })}
            className={cn(TRIGGER, className)}
          >
            <Globe aria-hidden className="size-[18px] shrink-0" />
            <span
              lang={active.tag}
              dir={active.dir === 'rtl' ? 'rtl' : undefined}
              className="hidden sm:inline"
            >
              {active.nativeName}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          padding="none"
          aria-label={t('settings.language.label')}
          className="w-[min(calc(100vw-2rem),24rem)] p-1.5 max-h-[min(70svh,32rem,var(--radix-popover-content-available-height))]"
        >
          <LanguagePicker
            value={locale}
            pending={pending}
            label={t('settings.language.label')}
            description={t('shell.language.hint')}
            columnMin={COLUMN_MIN}
            className={NARROW_CHIPS}
            onSelect={(choice) => {
              if (isLocale(choice)) void choose(choice)
            }}
          />
        </PopoverContent>
      </Popover>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  )
}
