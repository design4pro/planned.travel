import { LanguageSwitcher } from '#/components/layout/language-switcher'
import { saveVisitorLanguage } from '#/server/fns/locale'

/**
 * The switcher wired to the visitor write, for the two shells that mount it.
 *
 * Kept apart from `LanguageSwitcher` so that component stays presentational and
 * testable without the server layer, and so `MarketingHeader` and `AuthShell`
 * mount one element and need not know what saving means.
 */
export function VisitorLanguageSwitcher({ className }: { className?: string }) {
  return (
    <LanguageSwitcher
      className={className}
      save={(locale) => saveVisitorLanguage({ data: { locale } })}
    />
  )
}
