/**
 * The language a new account opens in. The sole production caller of seedUserLocale is
 * auth/signup-locale.ts, from the user-created hook. This leaf never imports the auth runtime and
 * imports no other repository than the `base` primitives, so the console graph that reaches the
 * auth layer reaches this one insert and nothing of `settings.ts` (docs/SPEC.md §5, issue #1174).
 */
import { z } from 'zod'
import { LOCALE_TAGS } from '#/lib/i18n/locales'
import { userSettings } from '#/server/db/schema'
import { prepareTenantInsert } from './base'
import type { Locale } from '#/lib/i18n/locales'
import type { TenantScope } from './base'

/**
 * Inserts `user_settings.locale` for the scope's own user in the scope's own organization, unless a
 * row for that pair already exists.
 *
 * **Insert-if-absent, never an update**: a row that exists is somebody's saved choice, and a retried
 * hook must add nothing. The conflict is resolved by the `(organization_id, user_id)` unique index,
 * so two racing calls cannot write two rows either. The tag is checked against the registry the
 * message layer ships (the caller hands over an already negotiated {@link Locale}; this is the
 * defence for a caller that did not), the same set `localeSchema` in `settings.ts` narrows to.
 * With `saveLanguagePreference` this is the second writer of the column, and the only one that
 * inserts; see the note in `src/routes/_app/settings/-server/preferences.ts`.
 */
export async function seedUserLocale(
  scope: TenantScope,
  locale: Locale,
): Promise<void> {
  await prepareTenantInsert(scope, userSettings, {
    userId: scope.ctx.userId,
    locale: z.enum(LOCALE_TAGS).parse(locale),
  }).onConflictDoNothing()
}
