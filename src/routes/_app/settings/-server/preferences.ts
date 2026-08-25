/**
 * The two narrow calls the personal-preference screens make, each touching only
 * the columns its own screen owns.
 *
 * **Why they are here rather than in `../../-server/settings.ts`.** That module
 * serves the whole settings section, and both of these are deliberate
 * narrowings of calls it already offers — a narrowing whose point is what it
 * *cannot* reach:
 *
 * - {@link loadLanguageSettings} answers the three values `/settings/language`
 *   actually draws. `loadProfile` answers eleven more, and pays six D1 reads for
 *   them, one of which is `listMemberProfiles` — a `member INNER JOIN user` over
 *   the whole tenant, unbounded. A workspace with several hundred members was
 *   scanning its member table to print a sample date, a sample number and a
 *   sample amount. This reads two rows: the traveller's settings and the
 *   workspace's. The currency merge is the same one `loadAppearance` writes for
 *   `mapStyle` — the traveller's value when they have one, the workspace's
 *   otherwise.
 * - {@link saveRegionalOverrides} writes the five regional overrides the profile
 *   form edits and cannot write the sixth. `saveRegionalSettings` requires
 *   `locale` in its payload, so that form re-sent the tag its loader data was
 *   rendered with: a second tab left open while the traveller changed language
 *   in the first would, on Save changes, put the stale tag back — or clear a
 *   freshly-set override to `NULL`. One column, one writer, and the writer for
 *   `user_settings.locale` is `saveLanguagePreference`. `updateUserSettings`
 *   passes its parsed patch through `definedOnly`, so a column this input does
 *   not carry is not in the `SET` clause at all: the guarantee is structural,
 *   not a promise the client is trusted to keep.
 *
 * Nothing here caches. `docs/ARCHITECTURE.md` §4 rule 2 lists no settings key,
 * and the language negotiation these rows feed reads D1 on the next request
 * rather than KV's up-to-sixty-second-stale copy — which is the whole reason a
 * chip click is visible before the toast has faded.
 */
import { createServerFn } from '@tanstack/react-start'

import { DEFAULT_LOCALE } from '#/lib/i18n/locales'
import { resolveLocaleTag } from '#/lib/i18n/negotiate'
import {
  ensureOrganizationSettings,
  ensureUserSettings,
  updateUserSettings,
} from '#/server/repos'
import { appScope } from '../../-server/context'
import { overrideOrNull, regionalSettingsInput } from '../../-server/settings'

import type { Locale } from '#/lib/i18n'

/* ------------------------------------------------------------------- language */

export interface LanguageSettingsPayload {
  /** The traveller's own choice, or `null` while they follow the workspace. */
  readonly override: Locale | null
  /** The tag the workspace supplies to everyone who has not chosen one. */
  readonly workspace: Locale
  /**
   * The currency the amount sample is written in — the traveller's if they set
   * one, the workspace's otherwise.
   */
  readonly currency: string
}

/**
 * The projection, separated from the read so it can be tested without a session.
 *
 * A row written before the picker existed can hold `en-GB`, `pl-PL` or free
 * text. `resolveLocaleTag` is the negotiator's own canonicalisation, so what the
 * screen shows selected is always a tag the message layer can render — and an
 * override it cannot resolve reads as "follow the workspace", exactly as an
 * absent one does, rather than as a chip nothing matches.
 */
export function languageSettingsFrom(
  user: { readonly locale: string | null; readonly currency: string | null },
  organization: { readonly locale: string; readonly defaultCurrency: string },
): LanguageSettingsPayload {
  return {
    override: resolveLocaleTag(user.locale),
    workspace: resolveLocaleTag(organization.locale) ?? DEFAULT_LOCALE,
    currency: user.currency ?? organization.defaultCurrency,
  }
}

export const loadLanguageSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<LanguageSettingsPayload> => {
    const scope = await appScope()
    const [userRow, orgRow] = await Promise.all([
      ensureUserSettings(scope),
      ensureOrganizationSettings(scope),
    ])
    return languageSettingsFrom(userRow, orgRow)
  },
)

/* ------------------------------------------------------------------- regional */

/**
 * The five regional overrides the profile form edits — and not the sixth.
 *
 * Derived from the six rather than restated as five. The trimming, the 64-byte
 * ceiling and the `''`-clears-the-override sentinel are one boundary rule for
 * these columns, and a second copy of it here was a second place for it to
 * drift: a widened ceiling on one side and not the other is a payload D1 takes
 * from one screen and refuses from the next. `.omit()` keeps the rule where the
 * columns are declared and says the only thing this input adds, which is what
 * it *cannot* carry.
 *
 * Zod strips a key an object schema does not declare, so a payload carrying
 * `locale` reaches the handler without one. The language screen is the only
 * writer of that column.
 */
export const regionalOverridesInput = regionalSettingsInput.omit({
  locale: true,
})

export const saveRegionalOverrides = createServerFn({ method: 'POST' })
  .validator(regionalOverridesInput)
  .handler(async ({ data }): Promise<{ readonly saved: true }> => {
    const scope = await appScope()
    await updateUserSettings(scope, {
      timezone: overrideOrNull(data.timezone),
      currency: overrideOrNull(data.currency),
      dateFormat: overrideOrNull(data.dateFormat),
      weekStartsOn: data.weekStartsOn,
      distanceUnit: overrideOrNull(data.distanceUnit),
    })
    return { saved: true }
  })
